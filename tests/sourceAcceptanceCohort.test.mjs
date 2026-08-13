import assert from 'node:assert/strict'

import {
  buildCurrentAcceptanceCohort,
  combineAcceptanceWindows,
  summarizeAcceptanceWindow
} from '../common/sourceAcceptanceCohort.js'

const rows = []
for (let index = 0; index < 30; index += 1) {
  rows.push({
    id: index + 1,
    layer: ['recent', 'middle', 'older'][index % 3],
    sourceKey: `key-${index}`,
    sha256: `hash-${index}`,
    _source: { baseUrl: `https://host${Math.floor(index / 3)}.example/path` }
  })
}
const cohort = buildCurrentAcceptanceCohort(rows, { target: 20, maxPerHost: 2, blockSize: 5 })
assert.equal(cohort.rows.length, 20)
assert.equal(cohort.blocks.length, 4)
const hosts = cohort.rows.reduce((counts, row) => {
  const host = new URL(row._source.baseUrl).hostname
  counts[host] = Number(counts[host] || 0) + 1
  return counts
}, {})
assert.ok(Object.values(hosts).every(count => count <= 2))

const samples = [
  ...Array.from({ length: 16 }, (_, index) => ({ id: `pass-${index}`, flow: { status: 'passed', errorCode: '' } })),
  ...Array.from({ length: 4 }, (_, index) => ({ id: `empty-${index}`, flow: { status: 'failed', errorCode: 'SEARCH_EMPTY' } })),
  { id: 'network', flow: { status: 'failed', errorCode: 'NETWORK_ERROR' } },
  { id: 'metadata', flow: { status: 'failed', errorCode: 'SEARCH_RESULT_INCOMPLETE' } }
]
const summary = summarizeAcceptanceWindow(samples)
assert.equal(summary.runtimeEligible, 21)
assert.equal(summary.runtimeExcluded, 1)
assert.equal(summary.flowPassed, 16)
assert.equal(summary.metadataFailures, 1)

const windowOne = { windowId: 'w1', capturedAt: '2026-08-13T00:00:00.000Z', samples }
const windowTwo = { windowId: 'w2', capturedAt: '2026-08-14T00:00:00.000Z', samples: samples.map(row => ({ ...row })) }
assert.equal(combineAcceptanceWindows([windowOne, windowTwo], { minimumRate: 70 }).gatePassed, true)
assert.equal(combineAcceptanceWindows([windowOne, windowTwo]).gatePassed, false)
assert.equal(combineAcceptanceWindows([windowOne, { ...windowTwo, capturedAt: '2026-08-13T12:00:00.000Z' }], { minimumRate: 70 }).gatePassed, false)

console.log('sourceAcceptanceCohort tests passed')
