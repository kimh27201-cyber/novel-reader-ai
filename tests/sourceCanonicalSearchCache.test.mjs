import assert from 'node:assert/strict'

const store = {}
const upstreamRequests = []
globalThis.uni = {
  getStorageSync(key) { return store[key] },
  setStorageSync(key, value) { store[key] = value },
  request(options) {
    const request = options.data || {}
    const url = String(request.url || '')
    upstreamRequests.push({ url, method: request.method, headers: request.headers || {}, body: request.body || '' })
    let text = '<html><body>empty</body></html>'
    let finalUrl = url
    if (url === 'https://old.example' || url === 'https://old.example/') finalUrl = 'https://canonical.example/'
    if (url.startsWith('https://canonical.example/search') && String(request.body || '').includes(encodeURIComponent('剑来'))) {
      text = '<div class="result"><a href="/book/2"><span>剑来</span></a></div>'
    }
    options.success({
      statusCode: 200,
      data: { text, status_code: 200, final_url: finalUrl, headers: {} }
    })
  }
}

const { getSourceConfigs, importSourcesFromAny, searchSourceBooks } = await import('../common/bookSources.js')

await importSourcesFromAny(JSON.stringify({
  bookSourceName: '规范域名缓存源',
  bookSourceUrl: 'https://old.example',
  searchUrl: '/search,{"method":"POST","body":"q={{key}}"}',
  header: { Authorization: 'source-secret', Cookie: 'session=source' },
  ruleSearch: { bookList: '.result', name: 'span@text', bookUrl: 'a@href' },
  ruleBookInfo: { name: 'h1@text' },
  ruleToc: { chapterList: '.chapters a', chapterName: '@text', chapterUrl: '@href' },
  ruleContent: { content: 'article@text' }
}))

const source = getSourceConfigs().find(item => item.name === '规范域名缓存源')
const first = await searchSourceBooks(source.id, '斗破苍穹', { allowDisabled: true, timeoutMs: 1000 })
assert.equal(first.count, 0)
const oldSearchCount = upstreamRequests.filter(item => item.url.startsWith('https://old.example/search')).length

const second = await searchSourceBooks(source.id, '剑来', { allowDisabled: true, timeoutMs: 1000 })
assert.equal(second.count, 1, JSON.stringify(upstreamRequests))
assert.equal(upstreamRequests.filter(item => item.url.startsWith('https://old.example/search')).length, oldSearchCount)
const last = upstreamRequests.at(-1)
assert.equal(last.url.startsWith('https://canonical.example/search'), true)
assert.equal(Object.keys(last.headers).some(name => /^(cookie|authorization)$/i.test(name)), false)

delete globalThis.uni
console.log('sourceCanonicalSearchCache tests passed')
