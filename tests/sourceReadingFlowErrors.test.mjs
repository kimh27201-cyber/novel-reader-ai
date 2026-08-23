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

const raw = {
  bookSourceName: 'Empty classification source',
  bookSourceUrl: 'https://empty-classification.example',
  searchUrl: '/search?q={{key}}',
  ruleSearch: { bookList: '.book', name: 'a@text', bookUrl: 'a@href' },
  ruleToc: { chapterList: '.chapter', chapterName: 'a@text', chapterUrl: 'a@href' },
  ruleContent: { content: '#content@text' }
}
const imported = importSourcesWithStats(JSON.stringify(raw)).importedSources[0]

globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  url: 'https://empty-classification.example/search?q=test',
  headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' }),
  text: async () => '<html><body><main>站点页面结构已经变化</main></body></html>'
})
await assert.rejects(
  () => testSourceSearch(imported.id, '测试', { failOnEmpty: true }),
  error => error && error.code === 'PARSE_EMPTY'
)
let lastTest = getSourceConfig(imported.id).lastTest
assert.equal(lastTest.errorCode, 'PARSE_EMPTY')
assert.equal(lastTest.failedStage, 'search')
assert.ok(lastTest.diagnostics.responseLength > 0)
assert.match(lastTest.diagnostics.responseFingerprint, /^[a-f0-9]{8}$/)
assert.equal(JSON.stringify(lastTest.diagnostics).includes('站点页面结构'), false)

globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  headers: new Headers(),
  text: async () => '<html><body>没有找到相关作品</body></html>'
})
await assert.rejects(
  () => testSourceSearch(imported.id, '不存在的作品', { failOnEmpty: true }),
  error => error && error.code === 'SEARCH_EMPTY'
)
lastTest = getSourceConfig(imported.id).lastTest
assert.equal(lastTest.errorCode, 'SEARCH_EMPTY')

globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  headers: new Headers(),
  text: async () => '<html><body><div class="stencil-overall"><span class="domain-name">Example</span></div></body></html>'
})
await assert.rejects(
  () => testSourceSearch(imported.id, '测试', { failOnEmpty: true }),
  error => error && error.code === 'SITE_UNREACHABLE'
)

globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  headers: new Headers({ 'Content-Type': 'application/json' }),
  text: async () => JSON.stringify({ data: [], totalNum: 0, status: 1 })
})
await assert.rejects(
  () => testSourceSearch(imported.id, '测试', { failOnEmpty: true }),
  error => error && error.code === 'SEARCH_EMPTY'
)

const movedPostSource = importSourcesWithStats(JSON.stringify({
  bookSourceName: 'Moved POST source',
  bookSourceUrl: 'https://old-post.example',
  header: { Authorization: 'Bearer old-origin', Cookie: 'session=old-origin' },
  searchUrl: '/search,{"method":"POST","body":"searchkey={{key}}"}',
  ruleSearch: { bookList: '.librarylist li', name: '.name@text', bookUrl: 'a@href' },
  ruleToc: { chapterList: '.chapter', chapterName: 'a@text', chapterUrl: 'a@href' },
  ruleContent: { content: '#content@text' }
})).importedSources[0]
const movedRequests = []
globalThis.fetch = async (url, options = {}) => {
  const request = {
    url: String(url),
    method: String(options.method || 'GET').toUpperCase(),
    body: options.body || '',
    headers: Object.fromEntries(new Headers(options.headers || {}).entries())
  }
  movedRequests.push(request)
  if (request.method === 'GET') {
    return {
      ok: true,
      status: 200,
      url: 'https://new-post.example/',
      headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' }),
      text: async () => '<html><body>canonical home</body></html>'
    }
  }
  if (request.url.startsWith('https://new-post.example/')) {
    return {
      ok: true,
      status: 200,
      url: 'https://new-post.example/search',
      headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' }),
      text: async () => '<ul class="librarylist"><li><a href="/book/1"><span class="name">Test Book</span></a></li></ul>'
    }
  }
  return {
    ok: true,
    status: 200,
    url: 'https://new-post.example/search',
    headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' }),
    text: async () => '<html><body>moved</body></html>'
  }
}
const movedResult = await testSourceSearch(movedPostSource.id, 'keyword', { failOnEmpty: true })
assert.equal(movedResult.count, 1)
assert.equal(movedResult.results[0].book.bookUrl, 'https://new-post.example/book/1')
assert.deepEqual(movedRequests.map(item => [item.method, item.url]), [
  ['GET', 'https://old-post.example'],
  ['POST', 'https://new-post.example/search']
])
assert.equal(movedRequests[1].body, 'searchkey=keyword')
assert.equal(movedRequests[0].headers.authorization, undefined)
assert.equal(movedRequests[0].headers.cookie, undefined)
assert.equal(movedRequests[1].headers.authorization, undefined)
assert.equal(movedRequests[1].headers.cookie, undefined)

delete globalThis.fetch
delete globalThis.uni
console.log('sourceReadingFlowErrors tests passed')
