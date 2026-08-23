import assert from 'node:assert/strict'

const store = {}
let networkType = '4g'
let requests = 0
globalThis.uni = {
  getStorageSync: key => store[key],
  setStorageSync: (key, value) => { store[key] = value },
  getNetworkType: ({ success }) => success({ networkType }),
  request(options) {
    requests += 1
    options.success({
      statusCode: 200,
      data: { text: JSON.stringify({ items: [{ name: 'Warm Book', url: '/book/1' }] }), status_code: 200, final_url: options.data.url }
    })
  }
}

const { importSourcesFromAny } = await import('../common/bookSources.js')
const { setSourceWarmupForeground, startSourceWarmup } = await import('../common/sourceWarmup.js')

await importSourcesFromAny(JSON.stringify([{
  bookSourceName: 'Warmup Source',
  bookSourceUrl: 'https://warmup.example.com',
  searchUrl: 'https://warmup.example.com/search?q={{key}}',
  ruleSearch: { bookList: '$.items[*]', name: '$.name', bookUrl: '$.url' }
}]))
setSourceWarmupForeground(true)
assert.equal((await startSourceWarmup({ maxSources: 1 })).reason, 'not_wifi')
assert.equal(requests, 0)
networkType = 'wifi'
const report = await startSourceWarmup({ maxSources: 1 })
assert.equal(report.attempted, 1)
assert.equal(report.succeeded, 1)
assert.equal(requests, 1)

console.log('sourceWarmup tests passed')
