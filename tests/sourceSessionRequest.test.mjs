import assert from 'node:assert/strict'

const store = {}
globalThis.uni = {
  getStorageSync(key) {
    return store[key]
  },
  setStorageSync(key, value) {
    store[key] = value
  },
  removeStorageSync(key) {
    delete store[key]
  }
}

const {
  getSourceConfigs,
  importSourcesFromAny,
  searchSourceBooks
} = await import('../common/bookSources.js')
const {
  clearSourceSession,
  saveManualSourceSession
} = await import('../common/sourceSession.js')

await importSourcesFromAny(JSON.stringify([{
  bookSourceName: 'Session Request Source',
  bookSourceUrl: 'https://session.example.com',
  searchUrl: 'https://session.example.com/search?q={{key}}',
  ruleSearch: {
    bookList: '$.items[*]',
    name: '$.name',
    author: '$.author',
    bookUrl: '$.url'
  },
  ruleBookInfo: { name: '$.name' },
  ruleToc: { chapterList: '$.chapters[*]', chapterName: '$.title', chapterUrl: '$.url' },
  ruleContent: { content: '$.content' }
}]))

const source = getSourceConfigs().find(item => item.name === 'Session Request Source')
assert.ok(source)

let capturedHeaders = null
globalThis.uni.request = options => {
  capturedHeaders = options.data && options.data.headers || {}
  options.success({
    statusCode: 200,
    data: {
      text: JSON.stringify({
        items: [
          { name: 'Session Book', author: 'Tester', url: '/book/1' }
        ]
      }),
      status_code: 200,
      final_url: options.data && options.data.url
    }
  })
}

saveManualSourceSession(source.id, {
  cookie: 'sid=abc; theme=dark',
  userAgent: 'SessionAgent/1.0',
  referer: 'https://session.example.com/login',
  expiresAt: Date.now() + 60000
})

const result = await searchSourceBooks(source.id, 'session', { timeoutMs: 1000 })
assert.equal(result.count, 1)
assert.equal(capturedHeaders.Cookie, 'sid=abc; theme=dark')
assert.equal(capturedHeaders['User-Agent'], 'SessionAgent/1.0')
assert.equal(capturedHeaders.Referer, 'https://session.example.com/login')

saveManualSourceSession(source.id, {
  cookie: 'sid=expired',
  userAgent: 'ExpiredAgent/1.0',
  referer: 'https://session.example.com/old',
  expiresAt: Date.now() - 1000
})

capturedHeaders = null
await searchSourceBooks(source.id, 'session', { timeoutMs: 1000 })
assert.notEqual(capturedHeaders.Cookie, 'sid=expired')
assert.notEqual(capturedHeaders['User-Agent'], 'ExpiredAgent/1.0')
assert.notEqual(capturedHeaders.Referer, 'https://session.example.com/old')

assert.equal(clearSourceSession(source.id), true)

console.log('sourceSessionRequest tests passed')
