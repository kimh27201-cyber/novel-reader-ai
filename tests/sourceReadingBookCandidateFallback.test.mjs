import assert from 'node:assert/strict'

const store = {}
globalThis.uni = {
  getStorageSync(key) { return store[key] },
  setStorageSync(key, value) { store[key] = value }
}

globalThis.fetch = async rawUrl => {
  const url = String(rawUrl)
  if (url.includes('/search')) {
    return { text: async () => '<ul class="result"><li><a href="/book/short"><span>测试书短篇</span></a></li><li><a href="/book/full"><span>测试书长篇</span></a></li></ul>' }
  }
  if (url.endsWith('/book/short') || url.endsWith('/book/full')) {
    const id = url.endsWith('/short') ? 'short' : 'full'
    return { text: async () => `<h1>测试书${id}</h1><a class="toc" href="/book/${id}/toc">目录</a>` }
  }
  if (url.endsWith('/book/short/toc')) {
    return { text: async () => '<div class="chapters"><a href="/book/short/1">第1章</a><a href="/book/short/2">第2章</a></div>' }
  }
  if (url.endsWith('/book/full/toc')) {
    return { text: async () => '<div class="chapters"><a href="/book/full/1">第1章</a><a href="/book/full/2">第2章</a><a href="/book/full/3">第3章</a></div>' }
  }
  if (/\/book\/full\/\d$/.test(url)) {
    return { text: async () => `<article>${'这是可阅读的正文内容。'.repeat(8)}</article>` }
  }
  throw new Error(`unexpected url ${url}`)
}

const { getSourceConfigs, importSourcesFromAny, runSourceReadingFlow } = await import('../common/bookSources.js')

await importSourcesFromAny(JSON.stringify({
  bookSourceName: '多结果候选回退源',
  bookSourceUrl: 'https://candidate.example',
  searchUrl: '/search?q={{key}}',
  ruleSearch: { bookList: '.result li', name: 'span@text', bookUrl: 'a@href' },
  ruleBookInfo: { name: 'h1@text', tocUrl: '.toc@href' },
  ruleToc: { chapterList: '.chapters a', chapterName: '@text', chapterUrl: '@href' },
  ruleContent: { content: 'article@text' }
}))

const source = getSourceConfigs().find(item => item.name === '多结果候选回退源')
const flow = await runSourceReadingFlow(source.id, '测试书', {
  timeoutMs: 1000,
  minimumChapters: 3,
  bookCandidateLimit: 3
})
assert.equal(flow.book.bookUrl.endsWith('/book/full'), true)
assert.equal(flow.chapters.length, 3)
assert.equal(flow.chapter.content.length >= 50, true)

delete globalThis.fetch
delete globalThis.uni
console.log('sourceReadingBookCandidateFallback tests passed')
