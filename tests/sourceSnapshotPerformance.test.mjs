import assert from 'node:assert/strict'

const store = {}
let sourceReadCount = 0
let settingsWriteCount = 0
globalThis.uni = {
  getStorageSync(key) {
    if (key === 'sources:user') sourceReadCount += 1
    return store[key]
  },
  setStorageSync(key, value) {
    if (key === 'sources:settings') settingsWriteCount += 1
    store[key] = value
  },
  removeStorageSync(key) { delete store[key] }
}

const sources = Array.from({ length: 5330 }, (_, index) => ({
  id: `source-${index}`,
  sourceKey: `key-${index}`,
  name: `书源${index}`,
  baseUrl: `https://source-${index % 100}.example`,
  group: `分组${index % 20}`,
  enabled: true,
  compatibilityLevel: 'full_css',
  raw: {
    bookSourceName: `书源${index}`,
    bookSourceUrl: `https://source-${index % 100}.example`,
    searchUrl: '/search?q={{key}}',
    ruleSearch: { bookList: '.item', name: '@text', bookUrl: '@href' }
  }
}))
store['sources:user'] = sources
store['sources:schema-version'] = 4
store['sources:settings'] = {}

const {
  getSourceConfig,
  getSourceConfigs,
  getSourceLibraryPage,
  getSourceSnapshot,
  prepareSourceIndexes,
  flushPendingSourceRuntimeWrites,
  writeSourceRuntimeStageResult
} = await import('../common/bookSources.js')

const first = getSourceSnapshot()
const second = getSourceSnapshot()
assert.equal(first, second)
assert.equal(getSourceConfigs().length, 5330)
assert.equal(getSourceConfig('source-4321').name, '书源4321')
assert.equal(sourceReadCount <= 1, true)
const page = getSourceLibraryPage({ keyword: '书源12', limit: 30 })
assert.equal(page.rows.length <= 30, true)
assert.equal(page.rows.every(item => !Object.prototype.hasOwnProperty.call(item, 'raw')), true)
assert.equal(page.stats.total, 5330)
const report = await prepareSourceIndexes({ batchSize: 100 })
assert.equal(report.count, 5330)

for (let index = 0; index < 20; index += 1) {
  writeSourceRuntimeStageResult(`source-${index}`, 'search', {
    status: 'passed',
    resultCount: index + 1,
    latencyMs: 10 + index
  })
}
assert.equal(settingsWriteCount, 0)
assert.equal(flushPendingSourceRuntimeWrites(), true)
assert.equal(settingsWriteCount, 1)

delete globalThis.uni
console.log('sourceSnapshotPerformance tests passed')
