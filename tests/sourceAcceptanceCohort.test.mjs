import assert from 'node:assert/strict'

import {
  buildStableSourceSeeds,
  buildCurrentAcceptanceCohort,
  combineAcceptanceWindows,
  createLockedAcceptanceManifest,
  summarizeAcceptanceWindow,
  validateAcceptanceWindowPair,
  verifyLockedAcceptanceManifest
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

const manifestRows = rows.slice(0, 20).map((row, index) => ({ ...row, configHash: `config-${index}` }))
const manifest = createLockedAcceptanceManifest(manifestRows, {
  cohortId: 'stage12-qualification',
  createdAt: '2026-08-13T00:00:00.000Z',
  target: 20,
  blockSize: 5,
  timeoutMs: 12000
})
assert.equal(manifest.entries.length, 20)
assert.equal(verifyLockedAcceptanceManifest(manifest).valid, true)
assert.equal(verifyLockedAcceptanceManifest({ ...manifest, entries: manifest.entries.slice().reverse() }).errorCode, 'MANIFEST_HASH_MISMATCH')

const qualificationSamples = Array.from({ length: 20 }, (_, index) => ({
  id: manifest.entries[index].id,
  sourceKey: manifest.entries[index].sourceKey,
  configHash: `config-${index}`,
  expectedConfigHash: `config-${index}`,
  actualConfigHash: `config-${index}`,
  configStatus: 'matched',
  capturedAt: '2026-08-13T00:00:00.000Z',
  windowId: 'qualification-a',
  flow: { status: index < 16 ? 'passed' : 'failed', errorCode: index < 16 ? '' : 'SEARCH_EMPTY', elapsedMs: 100 + index }
}))
const qualificationA = {
  windowId: 'qualification-a', capturedAt: '2026-08-13T00:00:00.000Z', completedAt: '2026-08-13T01:00:00.000Z', cohortId: manifest.cohortId,
  manifest, samples: qualificationSamples
}
const qualificationB = {
  windowId: 'qualification-b', referenceWindowId: 'qualification-a', capturedAt: '2026-08-14T01:00:00.000Z', cohortId: manifest.cohortId,
  manifest, samples: qualificationSamples.map(row => ({ ...row, capturedAt: '2026-08-14T01:00:00.000Z', windowId: 'qualification-b' }))
}
const gate = validateAcceptanceWindowPair(qualificationA, qualificationB)
assert.equal(gate.gatePassed, true)
assert.equal(validateAcceptanceWindowPair(qualificationA, { ...qualificationB, capturedAt: '2026-08-13T12:00:00.000Z' }).gatePassed, false)
assert.ok(validateAcceptanceWindowPair(qualificationA, { ...qualificationB, capturedAt: '2026-08-14T00:30:00.000Z' }).errors.includes('WINDOW_SEPARATION_TOO_SHORT'))
assert.ok(validateAcceptanceWindowPair(qualificationA, { ...qualificationB, samples: qualificationB.samples.slice().reverse() }).errors.includes('WINDOW_B_SAMPLE_MISMATCH'))
assert.equal(buildStableSourceSeeds(gate, [qualificationA, qualificationB]).length, 16)
assert.deepEqual(buildStableSourceSeeds({ ...gate, gatePassed: false }, [qualificationA, qualificationB]), [])

console.log('sourceAcceptanceCohort tests passed')
