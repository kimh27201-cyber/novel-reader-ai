import assert from 'node:assert/strict'

const store = {}
globalThis.uni = {
  getStorageSync(key) {
    return store[key]
  },
  setStorageSync(key, value) {
    store[key] = value
  }
}

const {
  analyzeBookSourceCompatibility,
  buildImportPreview,
  normalizeBookSources
} = await import('../common/bookSources.js')

const cssSource = normalizeBookSources({
  bookSourceName: '速读谷(SUDUGU)',
  bookSourceUrl: 'https://www.sudugu.example',
  exploreUrl: '[{\"title\":\"玄幻小说\",\"url\":\"/xuanhuan/{{page}}\"}]',
  ruleExplore: { bookList: '.book', name: '.name', bookUrl: 'a@href' },
  searchUrl: 'https://www.sudugu.example/search?q={{key}}',
  ruleSearch: { bookList: '.book', name: '.name', bookUrl: 'a@href' },
  ruleBookInfo: { name: 'h1', author: '.author' },
  ruleToc: { chapterList: '.chapter', chapterName: 'a', chapterUrl: 'a@href' },
  ruleContent: { content: '.content' }
})[0]

const jsExploreSource = normalizeBookSources({
  bookSourceName: '速读谷子',
  bookSourceUrl: 'https://www.suduguzi.example',
  exploreUrl: '@js:org.jsoup.Jsoup.parse(java.ajax(source.bookSourceUrl))',
  ruleExplore: { bookList: '.book' },
  searchUrl: 'https://www.suduguzi.example/search?q={{key}}',
  ruleSearch: { bookList: '.book', name: '.name', bookUrl: 'a@href' },
  ruleBookInfo: { name: 'h1' },
  ruleToc: { chapterList: '.chapter', chapterName: 'a', chapterUrl: 'a@href' },
  ruleContent: { content: '.content' }
})[0]

const jsContentSource = normalizeBookSources({
  bookSourceName: '爱去小说网',
  bookSourceUrl: 'https://www.aiqu.example',
  exploreUrl: '[{\"title\":\"玄幻\",\"url\":\"/xuanhuan/{{page}}\"}]',
  ruleExplore: { bookList: '.book', name: '.name', bookUrl: 'a@href' },
  searchUrl: 'https://www.aiqu.example/search?q={{key}},{\"charset\":\"gbk\"}',
  ruleSearch: { bookList: '.book', name: '.name', bookUrl: 'a@href' },
  ruleBookInfo: { name: 'h1' },
  ruleToc: { chapterList: '.chapter', chapterName: 'a', chapterUrl: 'a@href' },
  ruleContent: { content: '@js:result.replace(/广告[\\s\\S]*/, \"\")' }
})[0]

const cssCompatibility = analyzeBookSourceCompatibility(cssSource)
assert.equal(cssCompatibility.level, 'compatible')
assert.equal(cssCompatibility.importable, true)
assert.equal(cssCompatibility.searchable, true)
assert.equal(cssCompatibility.discoverable, true)
assert.equal(cssCompatibility.contentReadable, true)

const jsExploreCompatibility = analyzeBookSourceCompatibility(jsExploreSource)
assert.equal(jsExploreCompatibility.level, 'h5Unsupported')
assert.equal(jsExploreCompatibility.importable, true)
assert.equal(jsExploreCompatibility.searchable, true)
assert.equal(jsExploreCompatibility.discoverable, false)
assert.ok(jsExploreCompatibility.unsupportedReasons.some(item => item.stage === 'explore' && /java\.ajax|org\.jsoup|@js/i.test(item.reason)))

const jsContentCompatibility = analyzeBookSourceCompatibility(jsContentSource)
assert.equal(jsContentCompatibility.level, 'compatible')
assert.equal(jsContentCompatibility.importable, true)
assert.equal(jsContentCompatibility.searchable, true)
assert.equal(jsContentCompatibility.discoverable, true)
assert.equal(jsContentCompatibility.contentReadable, true)
assert.equal(jsContentCompatibility.status, 'ready')

const preview = buildImportPreview([jsContentSource], [])
assert.equal(preview.incompatible, 0)
assert.equal(preview.partialCompatible, 0)
assert.equal(preview.sources[0].action, 'import')
assert.equal(preview.sources[0].compatibleLevel, 'compatible')

console.log('yckCompatibility tests passed')
