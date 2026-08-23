import assert from 'node:assert/strict'

const store = {}
globalThis.uni = {
  getStorageSync(key) { return store[key] },
  setStorageSync(key, value) { store[key] = value }
}

globalThis.fetch = async rawUrl => {
  const url = String(rawUrl)
  if (url.includes('/search')) {
    const bookId = url.includes('keyword=bad') ? 'bad' : 'good'
    return {
      text: async () => `<ul class="result"><li><a href="/book/${bookId}"><span class="title">Test book</span></a></li></ul>`
    }
  }
  const bookMatch = url.match(/\/book\/(bad|good)$/)
  if (bookMatch) {
    return {
      text: async () => `<h1 id="title">Test book</h1><a class="catalog" href="/book/${bookMatch[1]}/catalog">Catalog</a>`
    }
  }
  const catalogMatch = url.match(/\/book\/(bad|good)\/catalog$/)
  if (catalogMatch) {
    return {
      text: async () => `<div id="catalog"><a href="/book/${catalogMatch[1]}/chapter-1">Chapter 1</a></div>`
    }
  }
  if (url.endsWith('/book/bad/chapter-1')) {
    return { text: async () => '<article id="content"></article>' }
  }
  if (url.endsWith('/book/good/chapter-1')) {
    return { text: async () => `<article id="content">${'Readable chapter content. '.repeat(4)}</article>` }
  }
  throw new Error(`unexpected url ${url}`)
}

const {
  getSourceConfigs,
  importSourcesFromAny,
  runSourceReadingFlow
} = await import('../common/bookSources.js')

await importSourcesFromAny(JSON.stringify({
  bookSourceName: 'Keyword fallback source',
  bookSourceUrl: 'https://keyword-fallback.example',
  searchUrl: '/search?keyword={{key}}',
  ruleSearch: { bookList: '.result li', name: '.title@text', bookUrl: 'a@href' },
  ruleBookInfo: { name: '#title@text', tocUrl: '.catalog@href' },
  ruleToc: { chapterList: '#catalog a', chapterName: '@text', chapterUrl: '@href' },
  ruleContent: { content: '#content@text' }
}))

const source = getSourceConfigs().find(item => item.name === 'Keyword fallback source')
const flow = await runSourceReadingFlow(source.id, ['bad', 'good'], { timeoutMs: 1000 })
assert.equal(flow.keyword, 'good')
assert.equal(flow.chapter.content.length >= 50, true)
assert.deepEqual(flow.keywordAttempts.map(item => [item.keyword, item.status, item.errorCode]), [
  ['bad', 'failed', 'CONTENT_EMPTY'],
  ['good', 'passed', '']
])

delete globalThis.fetch
delete globalThis.uni
console.log('sourceReadingKeywordFallback tests passed')
