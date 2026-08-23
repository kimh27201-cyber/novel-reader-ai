import assert from 'node:assert/strict'

const store = { novelReaderBackendToken: 'test-token' }
const calls = []
let backendFails = false
globalThis.uni = {
  getStorageSync: key => store[key],
  setStorageSync: (key, value) => { store[key] = value },
  removeStorageSync: key => { delete store[key] },
  request(options) {
    calls.push({ url: String(options.url || ''), target: String(options.data && options.data.url || '') })
    if (String(options.url).includes('/api/sources') && options.method === 'GET') {
      if (backendFails) return options.fail({ errMsg: 'backend offline' })
      return options.success({ statusCode: 200, data: [{ id: 7, name: 'Backend Source', enabled: true }] })
    }
    if (String(options.url).includes('/api/sources/7/search')) {
      return options.success({ statusCode: 200, data: { books: [{ title: 'Unified Book', author: 'Author', book_url: '/backend/book', source_id: 7, source_name: 'Backend Source' }] } })
    }
    if (String(options.url).includes('/api/proxy/fetch')) {
      return options.success({
        statusCode: 200,
        data: { text: JSON.stringify({ items: [{ name: 'Unified Book', author: 'Author', url: '/local/book' }] }), status_code: 200, final_url: options.data.url }
      })
    }
    return options.fail({ errMsg: 'unexpected request' })
  }
}

const { importSourcesFromAny } = await import('../common/bookSources.js')
const { searchUnifiedBooks } = await import('../common/sourceSearchRuntime.js')

await importSourcesFromAny(JSON.stringify([{
  bookSourceName: 'Local Source',
  bookSourceUrl: 'https://local-source.example.com',
  searchUrl: 'https://local-source.example.com/search?q={{key}}',
  ruleSearch: { bookList: '$.items[*]', name: '$.name', author: '$.author', bookUrl: '$.url' },
  ruleToc: { chapterList: '$.chapters[*]', chapterName: '$.title', chapterUrl: '$.url' },
  ruleContent: { content: '$.content' }
}]))

const updates = []
const merged = await searchUnifiedBooks('unified', {
  sourceLimit: 1,
  concurrency: 1,
  timeoutMs: 3000,
  onResults: results => updates.push(results.length)
})
assert.equal(merged.results.length, 1)
assert.equal(merged.results[0].route, 'local-source', '同书结果应优先本地已验证线路')
assert.equal(merged.results[0].alternateRoutes.length, 1)
assert.ok(calls.some(call => call.target.includes('local-source.example.com')), '登录后仍必须调用手机本地书源')
assert.ok(calls.some(call => call.url.includes('/api/sources')), '登录后应并行合并后端来源')
assert.ok(updates.length >= 1)

backendFails = true
const localOnly = await searchUnifiedBooks('backend-down', { sourceLimit: 1, concurrency: 1, timeoutMs: 3000, forceRefresh: true })
assert.equal(localOnly.results.length, 1)
assert.match(localOnly.backend.error, /offline|后端|请求/i)

console.log('sourceUnifiedSearch tests passed')
