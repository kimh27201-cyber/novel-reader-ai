import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const store = {}
const requestCalls = []
let failFirstProxyFetch = true

globalThis.uni = {
  getStorageSync(key) {
    return store[key]
  },
  setStorageSync(key, value) {
    store[key] = value
  },
  request(options) {
    requestCalls.push(options)
    if (options.url.endsWith('/api/proxy/fetch') && failFirstProxyFetch) {
      failFirstProxyFetch = false
      options.fail({ errMsg: 'temporary blocked' })
      return
    }
    options.success({
      statusCode: 200,
      data: {
        text: JSON.stringify({
          items: [{
            name: 'Anti Book',
            author: 'Anti Author',
            url: '/book/anti'
          }]
        }),
        status_code: 200,
        final_url: options.data && options.data.url
      }
    })
  }
}

const {
  getSourceAntiCrawlerSettings,
  getSourceConfigs,
  importSourcesFromAny,
  saveSourceAntiCrawlerSettings,
  testSourceSearch
} = await import('../common/bookSources.js')

const sourceJson = JSON.stringify([{
  bookSourceName: 'Anti Source',
  bookSourceUrl: 'https://anti.example.com',
  bookSourceGroup: 'Anti',
  searchUrl: 'https://anti.example.com/search?keyword={{key}}',
  ruleSearch: {
    bookList: '$.items[*]',
    name: '$.name',
    author: '$.author',
    bookUrl: '$.url'
  },
  ruleToc: {
    chapterList: '$.chapters[*]',
    chapterName: '$.title',
    chapterUrl: '$.url'
  },
  ruleContent: {
    content: '$.content'
  }
}])

await importSourcesFromAny(sourceJson)
const source = getSourceConfigs().find(item => item.name === 'Anti Source')

const defaults = getSourceAntiCrawlerSettings(source.id)
assert.equal(defaults.requestIntervalMs, 1500)
assert.equal(defaults.retryCount, 0)
assert.equal(defaults.retryIntervalMs, 800)
assert.equal(defaults.charset, 'auto')

const saved = saveSourceAntiCrawlerSettings(source.id, {
  requestIntervalMs: 25,
  retryCount: 1,
  retryIntervalMs: 10,
  charset: 'gbk',
  userAgent: 'NovelReader-Test-UA',
  headersText: 'Cookie: token=abc\nReferer: https://anti.example.com/home\nX-Custom: one'
})
assert.equal(saved.requestIntervalMs, 25)
assert.equal(saved.retryCount, 1)
assert.deepEqual(saved.headers, {
  Cookie: 'token=abc',
  Referer: 'https://anti.example.com/home',
  'X-Custom': 'one'
})

const refreshed = getSourceConfigs().find(item => item.id === source.id)
assert.equal(refreshed.antiCrawler.userAgent, 'NovelReader-Test-UA')
assert.equal(refreshed.antiCrawler.charset, 'gbk')

const result = await testSourceSearch(source.id, 'anti', { timeoutMs: 3000, failOnEmpty: true })
assert.equal(result.count, 1)
assert.equal(requestCalls.filter(call => call.url.endsWith('/api/proxy/fetch')).length, 2)

const secondProxyRequest = requestCalls.filter(call => call.url.endsWith('/api/proxy/fetch'))[1]
assert.equal(secondProxyRequest.data.charset, 'gbk')
assert.equal(secondProxyRequest.data.headers['User-Agent'], 'NovelReader-Test-UA')
assert.equal(secondProxyRequest.data.headers.Cookie, 'token=abc')
assert.equal(secondProxyRequest.data.headers.Referer, 'https://anti.example.com/home')
assert.equal(secondProxyRequest.data.headers['X-Custom'], 'one')

const library = readFileSync(new URL('../pages/library/library.vue', import.meta.url), 'utf8')
assert.match(library, /antiCrawler/)
assert.match(library, /saveSourceAntiCrawlerSettings/)
assert.match(library, /User-Agent/)
assert.match(library, /Cookie/)
assert.match(library, /重试/)

console.log('sourceAntiCrawler tests passed')
