import assert from 'node:assert/strict'

import {
  createStage13ReleaseState,
  getStage13ReleaseStatus,
  resumeStage13ReleaseFlow,
  runStage13ReleaseFlow
} from '../common/stage13ReleaseFlow.js'

const identity = { acceptanceCommit: 'commit-a', engineFingerprint: 'engine-a', now: '2026-08-24T00:00:00.000Z' }
let state = createStage13ReleaseState(identity)
assert.equal(state.phase, 'preflight')
state = runStage13ReleaseFlow(state, { type: 'preflight_passed', now: '2026-08-24T00:01:00.000Z' })
assert.equal(state.phase, 'prequalification')

const failed = runStage13ReleaseFlow(state, {
  type: 'prequalification_completed',
  now: '2026-08-24T01:00:00.000Z',
  report: {
    manifestHash: 'manifest-prequalification',
    samples: [{ id: 101 }, { id: 102 }],
    metrics: { runtimeEligible: 20, flowRatePercent: 79 }
  }
})
assert.equal(failed.phase, 'prequalification')
assert.equal(failed.blockingReason, 'PREQUALIFICATION_GATE_FAILED')
assert.equal(failed.manifestHash, 'manifest-prequalification')
assert.deepEqual(failed.completedSourceIds, ['101', '102'])

state = runStage13ReleaseFlow(state, {
  type: 'prequalification_completed',
  now: '2026-08-24T01:00:00.000Z',
  report: { metrics: { gate: { denominatorPassed: true, ratePassed: true } } }
})
assert.equal(state.phase, 'qualification_a')
state = runStage13ReleaseFlow(state, {
  type: 'window_a_completed',
  now: '2026-08-24T02:05:00.000Z',
  report: {
    windowId: 'stage13-a',
    manifestHash: 'manifest-a',
    capturedAt: '2026-08-24T01:05:00.000Z',
    completedAt: '2026-08-24T02:00:00.000Z',
    metrics: { runtimeEligible: 20, flowRatePercent: 80 }
  }
})
assert.equal(state.phase, 'waiting_b')
assert.equal(state.windowBNotBefore, '2026-08-25T02:00:00.000Z')
assert.equal(getStage13ReleaseStatus(state, { now: '2026-08-25T01:59:59.000Z' }).windowBReady, false)
assert.equal(resumeStage13ReleaseFlow(state, { ...identity, now: '2026-08-25T01:59:59.000Z' }).phase, 'waiting_b')
state = resumeStage13ReleaseFlow(state, { ...identity, now: '2026-08-25T02:00:00.000Z' })
assert.equal(state.phase, 'qualification_b')
assert.throws(() => resumeStage13ReleaseFlow(state, { acceptanceCommit: 'commit-b', engineFingerprint: 'engine-a' }), /COMMIT_CHANGED/)

state = runStage13ReleaseFlow(state, {
  type: 'window_b_completed',
  now: '2026-08-25T03:00:00.000Z',
  ...identity,
  report: { metrics: { runtimeEligible: 25, flowRatePercent: 84 } }
})
assert.equal(state.phase, 'combine')
state = runStage13ReleaseFlow(state, { type: 'combined', now: '2026-08-25T03:01:00.000Z', ...identity, report: { gatePassed: true } })
assert.equal(state.phase, 'release')
state = runStage13ReleaseFlow(state, { type: 'release_completed', now: '2026-08-25T04:00:00.000Z' })
assert.equal(state.phase, 'complete')
assert.equal(getStage13ReleaseStatus(state).resumable, false)

console.log('stage13ReleaseFlow tests passed')
