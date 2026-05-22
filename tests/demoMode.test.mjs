import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildDemoModeChecklist,
  buildDemoModePreset,
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

const profile = readFileSync(new URL('../pages/profile/profile.vue', import.meta.url), 'utf8')
assert.match(profile, /demoMode/)
assert.match(profile, /一键演示准备/)
assert.match(profile, /applyDemoMode/)

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
assert.match(readme, /一键演示准备/)

const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
assert.match(ci, /demoMode\.test\.mjs/)

console.log('demoMode tests passed')
