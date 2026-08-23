import assert from 'node:assert/strict'

const store = {}
globalThis.uni = {
  getStorageSync(key) { return store[key] },
  setStorageSync(key, value) { store[key] = value }
}

globalThis.fetch = async rawUrl => {
  const url = String(rawUrl)
  let body
  if (url.includes('/search')) {
    body = JSON.stringify({ data: { state: [{ title: '斗破苍穹', author: '天蚕土豆', groupID: 'RID_6305' }] } })
  } else if (url.includes('/book?resourceId=6305')) {
    body = JSON.stringify({ resourceName: '斗破苍穹', resourceID: '6305', author: '天蚕土豆' })
  } else if (url.includes('/toc?bookId=6305')) {
    body = JSON.stringify({ rows: [{ id: '1', name: '第一章' }, { id: '2', name: '第二章' }, { id: '3', name: '第三章' }] })
  } else if (url.includes('/content/6305/1')) {
    body = JSON.stringify({ text: '这是使用书籍上下文模板加载的真实正文内容，用于验证搜索、详情、目录和正文阶段都可以访问 book.kind。' })
  } else {
    throw new Error(`unexpected url ${url}`)
  }
  return { ok: true, status: 200, url, headers: new Headers({ 'Content-Type': 'application/json' }), text: async () => body }
}

const { importSourcesFromAny, getSourceConfigs, runSourceReadingFlow } = await import('../common/bookSources.js')

await importSourcesFromAny(JSON.stringify({
  bookSourceName: 'Book context template source',
  bookSourceUrl: 'https://book-context.example',
  searchUrl: '/search?q={{key}}',
  ruleSearch: {
    bookList: '$.data.state[*]',
    name: '$.title',
    author: '$.author',
    kind: '$.groupID##.*_##',
    bookUrl: '/book?resourceId={{book.kind}}'
  },
  ruleBookInfo: {
    name: '$.resourceName',
    author: '$.author',
    kind: '$.resourceID',
    tocUrl: '/toc?bookId={{book.kind}}'
  },
  ruleToc: {
    chapterList: '$.rows[*]',
    chapterName: '$.name',
    chapterUrl: '/content/{{book.kind}}/{{$.id}}'
  },
  ruleContent: { content: '$.text' }
}))

const source = getSourceConfigs().find(item => item.name === 'Book context template source')
const flow = await runSourceReadingFlow(source.id, '斗破苍穹', { timeoutMs: 1000 })
assert.equal(flow.stages.every(stage => stage.status === 'passed'), true)
assert.equal(flow.book.kind, '6305')
assert.equal(flow.chapters.length, 3)
assert.match(flow.chapter.content, /书籍上下文模板/)

delete globalThis.fetch
delete globalThis.uni
console.log('sourceBookContextTemplate tests passed')
