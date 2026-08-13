import assert from 'node:assert/strict'

const storage = {
  'sources:schema-version': 4,
  'sources:settings': {}
}
globalThis.uni = {
  getStorageSync(key) { return storage[key] },
  setStorageSync(key, value) { storage[key] = value },
  removeStorageSync(key) { delete storage[key] }
}

const makeSource = index => ({
  id: `discover-${index}`,
  sourceKey: `discover-key-${index}`,
  name: `发现源${index}`,
  baseUrl: `https://discover-${index}.example`,
  enabled: true,
  compatibilityLevel: 'full_css',
  raw: {
    bookSourceName: `发现源${index}`,
    bookSourceUrl: `https://discover-${index}.example`,
    searchUrl: '/search?q={{key}}',
    exploreUrl: `玄幻::/xuanhuan\n最新::/latest`,
    ruleSearch: { bookList: '.item', name: '@text', bookUrl: '@href' },
    ruleExplore: { bookList: '.item', name: '@text', bookUrl: '@href' }
  }
})
storage['sources:user'] = Array.from({ length: 40 }, (_, index) => makeSource(index))

const {
  cancelPendingSourceDiscoveryCache,
  getSourceDiscoverySnapshot,
  getSourceLibraryPage,
  getSourceSnapshot,
  persistSourceConfigs,
  prepareSourceDiscoveryCache
} = await import('../common/bookSources.js')

const page = getSourceLibraryPage({ limit: 30 })
assert.equal(page.stats.total, 40)
assert.equal(cancelPendingSourceDiscoveryCache(), true)
const prepared = prepareSourceDiscoveryCache({ sources: getSourceSnapshot().sources, immediate: true })
assert.equal(prepared.ready, true)
assert.equal(prepared.count > 0, true)

const cached = getSourceDiscoverySnapshot({ preferCache: true })
assert.equal(cached.catalog.some(item => item.title === '玄幻'), true)
assert.equal(cached.catalog.some(item => item.title === '最新'), true)

persistSourceConfigs([...storage['sources:user'], makeSource(40)])
const invalidated = getSourceDiscoverySnapshot({ preferCache: true })
assert.equal(invalidated.catalog.length, 0)

delete globalThis.uni
console.log('sourceDiscoveryPrecompute tests passed')
