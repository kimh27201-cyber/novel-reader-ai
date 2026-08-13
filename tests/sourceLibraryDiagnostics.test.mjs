import assert from 'node:assert/strict'

globalThis.uni = {
  getStorageSync() { return undefined },
  setStorageSync() {},
  removeStorageSync() {}
}

const { buildSourceLibraryDiagnostics } = await import('../common/bookSources.js')

const report = buildSourceLibraryDiagnostics([
  { compatible: true, runtimeState: 'passed', resultCount: 2, checkedAt: 10 },
  { compatible: true, runtimeState: 'untested' },
  { compatible: true, runtimeState: 'probing' },
  { compatible: true, runtimeState: 'cooldown', errorCode: 'DNS_ERROR', checkedAt: 20 },
  { compatible: true, runtimeState: 'cooldown', errorCode: 'DNS_ERROR', checkedAt: 30 },
  { compatible: false, runtimeState: 'blocked', errorCode: 'SCRIPT_BLOCKED', httpStatus: 403, checkedAt: 40 }
])

assert.deepEqual(report.counts, {
  total: 6,
  verified: 1,
  untested: 2,
  probing: 1,
  cooldown: 2,
  blocked: 1,
  failed: 3,
  incompatible: 1
})
assert.deepEqual(report.topErrors[0], { code: 'DNS_ERROR', httpStatus: 0, count: 2 })
assert.equal(report.lastCheckedAt, 40)

delete globalThis.uni
console.log('sourceLibraryDiagnostics tests passed')
