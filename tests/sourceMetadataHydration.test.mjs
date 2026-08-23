import assert from 'node:assert/strict'

const store = {}
globalThis.uni = {
  getStorageSync(key) { return store[key] },
  setStorageSync(key, value) { store[key] = value }
}

const {
  getSourceConfig,
  importSourcesWithStats,
  testSourceSearch
} = await import('../common/bookSources.js')

const makeSource = (name, host, detailRule) => ({
  bookSourceName: name,
  bookSourceUrl: `https://${host}`,
  searchUrl: '/search?q={{key}}',
  ruleSearch: { bookList: '$.items[*]', bookUrl: '$.url' },
  ruleBookInfo: { name: detailRule, author: '#author@text' },
  ruleToc: { chapterList: '.chapter', chapterName: 'a@text', chapterUrl: 'a@href' },
  ruleContent: { content: '#content@text' }
})

const good = importSourcesWithStats(JSON.stringify(makeSource('Metadata good', 'metadata-good.example', '#title@text'))).importedSources[0]
const bad = importSourcesWithStats(JSON.stringify(makeSource('Metadata bad', 'metadata-bad.example', '#missing@text'))).importedSources[0]
const inferredUrl = importSourcesWithStats(JSON.stringify({
  ...makeSource('Metadata inferred URL', 'metadata-inferred.example', '#title@text'),
  ruleSearch: { bookList: '.item', name: 'h3@a@text', bookUrl: '' }
})).importedSources[0]

globalThis.fetch = async url => {
  const target = String(url)
  const body = target.includes('metadata-inferred.example/search')
    ? '<div class="item"><h3><a href="/book/6808">斗破苍穹</a></h3></div>'
    : target.includes('/search')
    ? JSON.stringify({ items: [{ url: '/book/1' }] })
    : '<html><h1 id="title">斗破苍穹</h1><span id="author">天蚕土豆</span></html>'
  return {
    ok: true,
    status: 200,
    url: target,
    headers: new Headers({ 'Content-Type': target.includes('/search') ? 'application/json' : 'text/html' }),
    text: async () => body
  }
}

const hydrated = await testSourceSearch(good.id, '斗破苍穹', { failOnEmpty: true, limit: 3 })
assert.equal(hydrated.count, 1)
assert.equal(hydrated.results[0].title, '斗破苍穹')
assert.equal(hydrated.results[0].book.author, '天蚕土豆')
assert.equal(hydrated.results[0].metadataStatus, 'complete')
assert.equal(hydrated.incompleteResultCount, 1)
assert.equal(hydrated.metadataFailureCount, 0)
assert.doesNotMatch(JSON.stringify(hydrated), /未命名小说/)

await assert.rejects(
  () => testSourceSearch(bad.id, '斗破苍穹', { failOnEmpty: true }),
  error => error && error.code === 'SEARCH_RESULT_INCOMPLETE'
)
assert.equal(getSourceConfig(bad.id).runtimeV2.search.errorCode, 'SEARCH_RESULT_INCOMPLETE')
assert.equal(getSourceConfig(bad.id).runtimeV2.search.status, 'cooldown')

const inferred = await testSourceSearch(inferredUrl.id, '斗破苍穹', { failOnEmpty: true })
assert.equal(inferred.count, 1)
assert.equal(inferred.results[0].title, '斗破苍穹')
assert.equal(inferred.results[0].book.bookUrl, 'https://metadata-inferred.example/book/6808')

delete globalThis.fetch
delete globalThis.uni
console.log('sourceMetadataHydration tests passed')
