import assert from 'node:assert/strict'

const store = {}
globalThis.uni = {
  getStorageSync(key) { return store[key] },
  setStorageSync(key, value) { store[key] = value },
  removeStorageSync(key) { delete store[key] }
}

const {
  clearPerformanceReport,
  finishPerformanceSpan,
  getPerformanceReport,
  recordPerformanceMetric,
  samplePerformanceMemory,
  startPerformanceSpan
} = await import('../common/performanceMetrics.js')

clearPerformanceReport()
const span = startPerformanceSpan('source.snapshot', { sourceCount: 5330, keyword: '不得保存' })
const metric = finishPerformanceSpan(span, { status: 'success', body: '不得保存正文' })
assert.equal(metric.sourceCount, 5330)
assert.equal('keyword' in metric, false)
assert.equal('body' in metric, false)
assert.equal(finishPerformanceSpan(span), null)
recordPerformanceMetric('tab.navigation', 120, { route: 'pages/search/search' })
const report = getPerformanceReport()
assert.equal(report.count, 2)
assert.equal(report.summary.find(item => item.name === 'tab.navigation').p95Ms, 120)
globalThis.NovelReaderLaunch = { getMemoryInfo: () => JSON.stringify({ totalPssKb: 230000, secret: 'nope' }) }
const memoryMetric = samplePerformanceMemory('test')
assert.equal(memoryMetric.memoryKb, 230000)
assert.equal('secret' in memoryMetric, false)
delete globalThis.NovelReaderLaunch
assert.equal(JSON.stringify(report).includes('不得保存'), false)
clearPerformanceReport()
assert.equal(getPerformanceReport().count, 0)

delete globalThis.uni
console.log('performanceMetrics tests passed')
