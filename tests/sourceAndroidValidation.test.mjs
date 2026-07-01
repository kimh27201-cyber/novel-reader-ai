import assert from 'node:assert/strict'
import { buildAndroidPhonePreflight } from '../common/sourceAndroidValidation.js'

const baseChecklist = [
  { key: 'bridge-profile', title: '1. Bridge Profile', state: 'ready', label: '已通过', detail: 'bridge ready' },
  { key: 'rendered-fetch', title: '2. Rendered Fetch', state: 'waiting', label: '待验证', detail: 'run rendered fetch' },
  { key: 'cookie-capture', title: '4. Cookie', state: 'action', label: '需处理', detail: 'readCookie missing' }
]

const blocked = buildAndroidPhonePreflight({
  sourceId: 's1',
  sourceName: 'Complex Source',
  platform: 'h5',
  summary: { total: 3, readyCount: 1, actionCount: 1, waitingCount: 1, completeCount: 1 },
  checklist: baseChecklist
})

assert.equal(blocked.status, 'blocked')
assert.equal(blocked.readyForPhone, false)
assert.equal(blocked.blockers.length, 1)
assert.equal(blocked.blockers[0].key, 'cookie-capture')
assert.equal(blocked.pending.length, 1)
assert.equal(blocked.phoneSteps.length, 3)
assert.match(blocked.nextAction, /Cookie/)

const phoneRequired = buildAndroidPhonePreflight({
  checklist: baseChecklist.filter(item => item.state !== 'action')
})

assert.equal(phoneRequired.status, 'phone-required')
assert.equal(phoneRequired.readyForPhone, true)
assert.equal(phoneRequired.pending[0].key, 'rendered-fetch')
assert.equal(phoneRequired.phoneSteps[1].requiresPhone, true)
assert.match(phoneRequired.nextAction, /Rendered Fetch/)

const complete = buildAndroidPhonePreflight({
  checklist: [
    { key: 'bridge-profile', title: '1. Bridge Profile', state: 'ready', label: '已通过', detail: 'bridge ready' },
    { key: 'login-page', title: '3. 登录页', state: 'skipped', label: '可跳过', detail: 'not required' }
  ]
})

assert.equal(complete.status, 'complete')
assert.equal(complete.readyForPhone, true)
assert.equal(complete.blockers.length, 0)
assert.equal(complete.pending.length, 0)
assert.equal(complete.completed.length, 2)
assert.match(complete.nextAction, /里程碑/)

console.log('sourceAndroidValidation tests passed')
