import assert from 'node:assert/strict'

const store = {}
const targets = []
globalThis.uni = {
  getStorageSync: key => store[key],
  setStorageSync: (key, value) => { store[key] = value },
  request(options) {
    const target = String(options.data && options.data.url || '')
    targets.push(target)
    if (/explore-[12]\.example\.com/.test(target)) return options.fail({ errMsg: 'request:fail net::ERR_NAME_NOT_RESOLVED' })
    return options.success({
      statusCode: 200,
      data: { text: JSON.stringify({ items: [{ name: 'Catalog Book', url: '/book/1' }] }), status_code: 200, final_url: target }
    })
  }
}

const {
  buildExploreCatalog,
  getSourceConfigs,
  importSourcesFromAny,
  openExploreCatalogEntry
} = await import('../common/bookSources.js')

const sources = ['玄幻小说', '玄幻', '玄幻魔法', '玄幻分类'].map((title, index) => ({
  bookSourceName: `Explore ${index + 1}`,
  bookSourceUrl: `https://explore-${index + 1}.example.com`,
  exploreUrl: `${title}::/list`,
  ruleExplore: { bookList: '$.items[*]', name: '$.name', bookUrl: '$.url' }
}))
await importSourcesFromAny(JSON.stringify(sources))
const catalog = buildExploreCatalog(getSourceConfigs())
const fantasy = catalog.find(item => item.title === '玄幻')
assert.ok(fantasy)
assert.equal(fantasy.providerCount, 4)

const result = await openExploreCatalogEntry(fantasy, { timeoutMs: 1000 })
assert.equal(result.results.length, 1)
assert.equal(result.provider.sourceName, 'Explore 3')
assert.equal(result.attempts.length, 3, '聚合发现最多尝试前三个提供者')
assert.equal(targets.some(target => target.includes('explore-4.example.com')), false)

console.log('sourceExploreCatalog tests passed')
