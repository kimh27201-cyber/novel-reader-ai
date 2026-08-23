import assert from 'node:assert/strict'

globalThis.uni = {
  getStorageSync() { return undefined },
  setStorageSync() {},
  removeStorageSync() {}
}

const { buildSourceLibraryDiagnostics, selectSourceRetryCandidates } = await import('../common/bookSources.js')

const report = buildSourceLibraryDiagnostics([
  { compatible: true, runtimeState: 'passed', resultCount: 2, checkedAt: 10 },
  { compatible: true, runtimeState: 'untested' },
  { compatible: true, runtimeState: 'probing' },
  { compatible: true, runtimeState: 'cooldown', errorCode: 'DNS_ERROR', checkedAt: 20, cooldownUntil: 1 },
  { compatible: true, runtimeState: 'cooldown', errorCode: 'DNS_ERROR', checkedAt: 30, cooldownUntil: Date.now() + 60000 },
  { compatible: false, runtimeState: 'blocked', errorCode: 'SCRIPT_BLOCKED', httpStatus: 403, checkedAt: 40 }
])

assert.deepEqual(report.counts, {
  total: 6,
  verified: 1,
  untested: 2,
  probing: 1,
  cooldown: 2,
  blocked: 1,
  retryReady: 1,
  failed: 3,
  incompatible: 1,
  stable: 0
})
assert.deepEqual(report.topErrors[0], { code: 'DNS_ERROR', httpStatus: 0, count: 2, retryReady: 1 })
assert.equal(report.lastCheckedAt, 40)

const retryCandidates = selectSourceRetryCandidates([
  { id: 'later', enabled: true, compatible: true, searchable: true, runtimeState: 'cooldown', cooldownUntil: 200, checkedAt: 1, errorCode: 'TIMEOUT', group: 'A' },
  { id: 'ready-b', enabled: true, compatible: true, searchable: true, runtimeState: 'cooldown', cooldownUntil: 10, checkedAt: 2, errorCode: 'TIMEOUT', group: 'A' },
  { id: 'ready-a', enabled: true, compatible: true, searchable: true, runtimeState: 'cooldown', cooldownUntil: 5, checkedAt: 3, errorCode: 'TIMEOUT', group: 'A' },
  { id: 'blocked', enabled: true, compatible: true, searchable: true, runtimeState: 'blocked', cooldownUntil: 0, errorCode: 'LOGIN_REQUIRED', group: 'A' },
  { id: 'other-error', enabled: true, compatible: true, searchable: true, runtimeState: 'cooldown', cooldownUntil: 1, errorCode: 'DNS_ERROR', group: 'A' }
], { now: 100, errorCode: 'TIMEOUT', group: 'A', limit: 2 })
assert.deepEqual(retryCandidates.map(item => item.id), ['ready-a', 'ready-b'])

delete globalThis.uni
console.log('sourceLibraryDiagnostics tests passed')
