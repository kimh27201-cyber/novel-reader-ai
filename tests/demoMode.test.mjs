import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildDemoModeChecklist,
  buildDemoModePreset,
  buildOfflineDemoStatus,
  getDemoAccount
} from '../common/demoMode.js'

const account = getDemoAccount()
assert.deepEqual(account, {
  username: 'student',
  password: 'secret123'
})

const loopbackPreset = buildDemoModePreset('http://127.0.0.1:8000')
assert.equal(loopbackPreset.backendReady, false)
assert.match(loopbackPreset.backendMessage, /局域网 IP/)
assert.equal(loopbackPreset.username, 'student')
assert.equal(loopbackPreset.password, 'secret123')

const lanPreset = buildDemoModePreset('192.168.1.8:8000')
assert.equal(lanPreset.backendReady, true)
assert.equal(lanPreset.baseUrl, 'http://192.168.1.8:8000')
assert.match(lanPreset.backendMessage, /适合真机/)

const checklist = buildDemoModeChecklist({
  backendReady: true,
  healthReady: true,
  loggedIn: false
})

assert.deepEqual(
  checklist.map(item => item.id),
  ['backend', 'login', 'import', 'search', 'reader', 'ai-history']
)
assert.equal(checklist[0].state, 'ready')
assert.equal(checklist[1].state, 'action')
assert.equal(checklist[2].state, 'manual')
assert.match(checklist[2].detail, /演示源/)

const offlineStatus = buildOfflineDemoStatus({
  builtInBookCount: 2,
  hasTxtSample: true,
  backendReady: false,
  loggedIn: false
})
assert.equal(offlineStatus.ready, true)
assert.equal(offlineStatus.mode, 'offline')
assert.match(offlineStatus.summary, /离线演示/)
assert.deepEqual(
  offlineStatus.items.map(item => item.id),
  ['builtin-books', 'txt-sample', 'reader-fallback', 'backend-optional']
)
assert.equal(offlineStatus.items[0].state, 'ready')
assert.equal(offlineStatus.items[1].state, 'ready')
assert.equal(offlineStatus.items[2].state, 'ready')
assert.equal(offlineStatus.items[3].state, 'manual')

const onlineStatus = buildOfflineDemoStatus({
  builtInBookCount: 2,
  hasTxtSample: true,
  backendReady: true,
  loggedIn: true
})
assert.equal(onlineStatus.mode, 'online')
assert.match(onlineStatus.summary, /在线演示/)

const profile = readFileSync(new URL('../pages/profile/profile.vue', import.meta.url), 'utf8')
assert.match(profile, /demoMode/)
assert.match(profile, /一键演示准备/)
assert.match(profile, /applyDemoMode/)
assert.match(profile, /offlineDemoStatus/)
assert.match(profile, /本地阅读兜底/)
assert.match(profile, /goLibrary\(\)/)

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
assert.match(readme, /一键演示准备/)

const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
assert.match(ci, /find tests -maxdepth 1 -name "\*\.test\.mjs"/)

console.log('demoMode tests passed')
