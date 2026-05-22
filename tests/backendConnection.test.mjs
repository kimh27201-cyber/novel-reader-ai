import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  analyzeBackendBaseUrl,
  buildBackendStartCommands,
  normalizeBackendBaseUrl
} from '../common/backendConnection.js'
import { createApiClient } from '../common/apiClient.js'

assert.equal(normalizeBackendBaseUrl(' http://127.0.0.1:8000/// '), 'http://127.0.0.1:8000')
assert.equal(normalizeBackendBaseUrl(''), 'http://127.0.0.1:8000')
assert.equal(normalizeBackendBaseUrl('192.168.1.8:8000'), 'http://192.168.1.8:8000')

const loopback = analyzeBackendBaseUrl('http://localhost:8000')
assert.equal(loopback.normalized, 'http://localhost:8000')
assert.equal(loopback.mobileReady, false)
assert.match(loopback.message, /真机/)
assert.match(loopback.message, /局域网 IP/)

const lan = analyzeBackendBaseUrl('http://192.168.1.8:8000')
assert.equal(lan.mobileReady, true)
assert.match(lan.message, /适合真机/)

const originalURL = globalThis.URL
try {
  globalThis.URL = undefined
  const appRuntimeLan = analyzeBackendBaseUrl('http://192.168.254.222:8000')
  assert.equal(appRuntimeLan.host, '192.168.254.222')
  assert.equal(appRuntimeLan.mobileReady, true)
  const appRuntimeLoopback = analyzeBackendBaseUrl('http://127.0.0.1:8000')
  assert.equal(appRuntimeLoopback.host, '127.0.0.1')
  assert.equal(appRuntimeLoopback.mobileReady, false)
} finally {
  globalThis.URL = originalURL
}

const commands = buildBackendStartCommands('192.168.1.8')
assert.ok(commands.some(line => line.includes('--host 0.0.0.0')))
assert.ok(commands.some(line => line.includes('http://192.168.1.8:8000')))

const calls = []
const client = createApiClient({
  getStorageSync(key) {
    return key === 'novelReaderBackendBaseUrl' ? 'http://192.168.1.8:8000' : ''
  },
  setStorageSync() {},
  removeStorageSync() {},
  request(options) {
    calls.push(options)
    options.success({ statusCode: 200, data: { status: 'ok' } })
  }
})

const health = await client.healthCheck()
assert.deepEqual(health, { status: 'ok' })
assert.equal(calls[0].url, 'http://192.168.1.8:8000/api/health')
assert.equal(calls[0].method, 'GET')
assert.equal(calls[0].header.Authorization, undefined)

const profile = readFileSync(new URL('../pages/profile/profile.vue', import.meta.url), 'utf8')
assert.match(profile, /checkBackendHealth/)
assert.match(profile, /saveBackendBaseUrl/)
assert.match(profile, /backendAddressTip/)
assert.match(profile, /真机/)

console.log('backendConnection tests passed')
