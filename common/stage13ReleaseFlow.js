const SCHEMA_VERSION = 1
const DAY_MS = 24 * 60 * 60 * 1000

function iso(value = Date.now()) {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error('STAGE13_INVALID_TIME')
  return date.toISOString()
}

function reportGatePassed(report = {}) {
  const gate = report.metrics && report.metrics.gate || report.gate || {}
  if (gate.denominatorPassed === true && gate.ratePassed === true) return true
  const denominator = Number(report.metrics && report.metrics.runtimeEligible || report.runtimeEligible || 0)
  const rate = Number(report.metrics && report.metrics.flowRatePercent || report.flowRatePercent || 0)
  return denominator >= 20 && rate >= 80
}

function historyEntry(type, at, detail = {}) {
  return { type, at: iso(at), ...detail }
}

export function createStage13ReleaseState(options = {}) {
  const now = iso(options.now || Date.now())
  return {
    schemaVersion: SCHEMA_VERSION,
    phase: 'preflight',
    acceptanceCommit: String(options.acceptanceCommit || ''),
    engineFingerprint: String(options.engineFingerprint || ''),
    manifestHash: '',
    windowAId: '',
    windowACompletedAt: '',
    windowBNotBefore: '',
    completedSourceIds: [],
    retryCount: 0,
    lastHeartbeatAt: now,
    gateStatus: 'pending',
    blockingReason: '',
    updatedAt: now,
    history: [historyEntry('created', now)]
  }
}

function assertRuntimeFrozen(state, event) {
  if (event.acceptanceCommit && state.acceptanceCommit && event.acceptanceCommit !== state.acceptanceCommit) {
    throw new Error('STAGE13_ACCEPTANCE_COMMIT_CHANGED')
  }
  if (event.engineFingerprint && state.engineFingerprint && event.engineFingerprint !== state.engineFingerprint) {
    throw new Error('STAGE13_ENGINE_FINGERPRINT_CHANGED')
  }
}

function withEvent(state, type, now, patch = {}, detail = {}) {
  return {
    ...state,
    ...patch,
    lastHeartbeatAt: iso(now),
    updatedAt: iso(now),
    history: [...(state.history || []), historyEntry(type, now, detail)]
  }
}

export function runStage13ReleaseFlow(inputState = {}, event = {}) {
  const state = inputState && inputState.schemaVersion === SCHEMA_VERSION
    ? inputState
    : createStage13ReleaseState(inputState)
  const type = String(event.type || 'heartbeat')
  const now = event.now || Date.now()

  if (type === 'heartbeat') return withEvent(state, type, now)
  if (type === 'preflight_passed') {
    return withEvent(state, type, now, { phase: 'prequalification', blockingReason: '' })
  }
  if (type === 'prequalification_completed') {
    const passed = reportGatePassed(event.report)
    const manifestHash = String(event.report && event.report.manifestHash || event.manifestHash || state.manifestHash || '')
    const completedSourceIds = Array.isArray(event.completedSourceIds)
      ? event.completedSourceIds.map(String)
      : Array.isArray(event.report && event.report.samples)
        ? event.report.samples.map(sample => String(sample && sample.id || '')).filter(Boolean)
        : state.completedSourceIds
    return withEvent(state, type, now, {
      phase: passed ? 'qualification_a' : 'prequalification',
      gateStatus: passed ? 'prequalified' : 'failed',
      blockingReason: passed ? '' : 'PREQUALIFICATION_GATE_FAILED',
      manifestHash,
      completedSourceIds
    }, { passed, manifestHash, completedCount: completedSourceIds.length })
  }
  if (type === 'window_a_completed') {
    const passed = reportGatePassed(event.report)
    const completedAt = iso(event.completedAt || event.report && (event.report.completedAt || event.report.capturedAt) || now)
    if (!passed) {
      return withEvent(state, type, now, {
        phase: 'prequalification',
        gateStatus: 'failed',
        blockingReason: 'WINDOW_A_GATE_FAILED',
        manifestHash: '',
        windowAId: '',
        windowACompletedAt: '',
        windowBNotBefore: ''
      }, { passed: false })
    }
    const manifestHash = String(event.report && event.report.manifestHash || event.manifestHash || '')
    if (!manifestHash) throw new Error('STAGE13_MANIFEST_HASH_REQUIRED')
    return withEvent(state, type, now, {
      phase: 'waiting_b',
      gateStatus: 'window_a_passed',
      blockingReason: '',
      manifestHash,
      windowAId: String(event.report && event.report.windowId || event.windowAId || ''),
      windowACompletedAt: completedAt,
      windowBNotBefore: iso(Date.parse(completedAt) + DAY_MS)
    }, { passed: true, manifestHash })
  }
  if (type === 'window_b_completed') {
    assertRuntimeFrozen(state, event)
    if (state.phase !== 'qualification_b') throw new Error('STAGE13_WINDOW_B_NOT_READY')
    const passed = reportGatePassed(event.report)
    return withEvent(state, type, now, {
      phase: passed ? 'combine' : 'prequalification',
      gateStatus: passed ? 'window_b_passed' : 'failed',
      blockingReason: passed ? '' : 'WINDOW_B_GATE_FAILED'
    }, { passed })
  }
  if (type === 'combined') {
    assertRuntimeFrozen(state, event)
    const passed = event.report && event.report.gatePassed === true
    return withEvent(state, type, now, {
      phase: passed ? 'release' : 'prequalification',
      gateStatus: passed ? 'passed' : 'failed',
      blockingReason: passed ? '' : 'COMBINED_GATE_FAILED'
    }, { passed })
  }
  if (type === 'release_completed') {
    return withEvent(state, type, now, { phase: 'complete', gateStatus: 'passed', blockingReason: '' })
  }
  if (type === 'retry') {
    return withEvent(state, type, now, { retryCount: Math.min(2, Number(state.retryCount || 0) + 1) })
  }
  if (type === 'blocked') {
    return withEvent(state, type, now, { phase: 'blocked', blockingReason: String(event.reason || 'UNKNOWN_BLOCKER') })
  }
  throw new Error(`STAGE13_UNKNOWN_EVENT:${type}`)
}

export function getStage13ReleaseStatus(state = {}, options = {}) {
  const now = Date.parse(iso(options.now || Date.now()))
  const notBefore = Date.parse(state.windowBNotBefore || 0)
  return {
    phase: String(state.phase || 'preflight'),
    gateStatus: String(state.gateStatus || 'pending'),
    blockingReason: String(state.blockingReason || ''),
    resumable: state.phase !== 'complete' && state.phase !== 'blocked',
    windowBReady: state.phase === 'waiting_b' && Number.isFinite(notBefore) && now >= notBefore,
    remainingMs: state.phase === 'waiting_b' && Number.isFinite(notBefore) ? Math.max(0, notBefore - now) : 0,
    lastHeartbeatAt: String(state.lastHeartbeatAt || '')
  }
}

export function resumeStage13ReleaseFlow(state = {}, options = {}) {
  assertRuntimeFrozen(state, options)
  const now = options.now || Date.now()
  const status = getStage13ReleaseStatus(state, { now })
  if (state.phase === 'waiting_b' && status.windowBReady) {
    return withEvent(state, 'window_b_ready', now, { phase: 'qualification_b', blockingReason: '' })
  }
  return withEvent(state, 'resumed', now)
}

export default {
  createStage13ReleaseState,
  runStage13ReleaseFlow,
  getStage13ReleaseStatus,
  resumeStage13ReleaseFlow
}
