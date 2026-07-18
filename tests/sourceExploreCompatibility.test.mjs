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
  applyImportPreview,
  buildImportPreview,
  getSourceExploreEntries,
  normalizeBookSources
} = await import('../common/bookSources.js')

const source = normalizeBookSources({
  bookSourceName: 'JS Explore Source',
  bookSourceUrl: 'https://js-explore.example',
  exploreUrl: '@js:result.split(\"|\").map(item => item)',
  ruleExplore: { bookList: '.book', name: '.name', bookUrl: 'a@href' },
  searchUrl: 'https://js-explore.example/search?q={{key}}',
  ruleSearch: { bookList: '.book', name: '.name', bookUrl: 'a@href' }
})[0]

const result = applyImportPreview(buildImportPreview([source], []))
assert.equal(result.actualWritten, 1)

const entries = getSourceExploreEntries(source.id)
assert.equal(entries.available, false)
assert.equal(entries.canSearchFallback, true)
assert.equal(entries.reasonCode, 'complex_explore_rule')
assert.match(entries.reason, /@js|JS|暂不支持/)

console.log('sourceExploreCompatibility tests passed')
