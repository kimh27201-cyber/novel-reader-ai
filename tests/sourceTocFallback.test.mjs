import assert from 'node:assert/strict'

const store = {}
globalThis.uni = {
  getStorageSync(key) { return store[key] },
  setStorageSync(key, value) { store[key] = value }
}

globalThis.fetch = async rawUrl => {
  const url = String(rawUrl)
  let body = ''
  if (url.includes('/search')) {
    body = '<div class="item"><h3><a href="/book/1">斗破苍穹</a></h3></div>'
  } else if (url.endsWith('/book/1')) {
    body = '<h1>斗破苍穹</h1><div id="list"><li><a href="/book/1/chapter-1">第一章</a></li><li><a href="/book/1/chapter-2">第二章</a></li><li><a href="/book/1/chapter-3">第三章</a></li></div>'
  } else if (url.endsWith('/book/1/chapter-1')) {
    body = '<div id="content">这是第一章的真实正文内容，用来验证目录地址失效以后可以回退到书籍详情页中的内嵌目录，并继续完成正文解析。</div>'
  } else {
    throw new Error(`unexpected url ${url}`)
  }
  return { ok: true, status: 200, url, headers: new Headers({ 'Content-Type': 'text/html' }), text: async () => body }
}

const { importSourcesFromAny, getSourceConfigs, runSourceReadingFlow } = await import('../common/bookSources.js')

await importSourcesFromAny(JSON.stringify({
  bookSourceName: 'TOC fallback source',
  bookSourceUrl: 'https://toc-fallback.example',
  searchUrl: '/search?q={{key}}',
  ruleSearch: { bookList: '.item', name: 'h3@a@text', bookUrl: '' },
  ruleBookInfo: { name: 'h1@text', tocUrl: '#list@a@href' },
  ruleToc: { chapterList: '#list@li', chapterName: '@a@text', chapterUrl: '@a@href' },
  ruleContent: { content: '#content@text' }
}))

const source = getSourceConfigs().find(item => item.name === 'TOC fallback source')
const flow = await runSourceReadingFlow(source.id, '斗破苍穹', { timeoutMs: 1000 })
assert.equal(flow.stages.every(stage => stage.status === 'passed'), true)
assert.equal(flow.chapters.length, 3)
assert.match(flow.chapter.content, /真实正文内容/)

delete globalThis.fetch
delete globalThis.uni
console.log('sourceTocFallback tests passed')
