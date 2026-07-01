import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildApkMilestoneReadiness } from '../common/apkMilestoneReadiness.js'

const blocked = buildApkMilestoneReadiness({
  h5BuildReady: true,
  phonePreflightAssetReady: true,
  androidBridgeContractReady: true,
  apkBuildScriptReady: true,
  gitSynced: false,
  phoneConnected: false,
  apkBuilt: false
})

assert.equal(blocked.status, 'blocked')
assert.equal(blocked.canNotifyForPhone, false)
assert.equal(blocked.actionCount, 1)
assert.ok(blocked.items.some(item => item.id === 'github-sync' && item.state === 'action'))
assert.match(blocked.summary, /自动门禁/)

const ready = buildApkMilestoneReadiness({
  h5BuildReady: true,
  phonePreflightAssetReady: true,
  androidBridgeContractReady: true,
  apkBuildScriptReady: true,
  gitSynced: true,
  phoneConnected: false,
  apkBuilt: false
})

assert.equal(ready.status, 'ready-to-package')
assert.equal(ready.canNotifyForPhone, true)
assert.equal(ready.actionCount, 0)
assert.equal(ready.manualCount, 2)
assert.match(ready.summary, /连接手机/)

const complete = buildApkMilestoneReadiness({
  h5BuildReady: true,
  phonePreflightAssetReady: true,
  androidBridgeContractReady: true,
  apkBuildScriptReady: true,
  gitSynced: true,
  phoneConnected: true,
  apkBuilt: true
})

assert.equal(complete.status, 'complete')
assert.equal(complete.canNotifyForPhone, false)
assert.equal(complete.actionCount, 0)
assert.ok(complete.items.every(item => item.state === 'ready'))

const script = readFileSync(new URL('../scripts/check_apk_milestone_readiness.mjs', import.meta.url), 'utf8')
assert.match(script, /buildApkMilestoneReadiness/)
assert.match(script, /androidPhonePreflight/)
assert.match(script, /execFileSync\('git', \['status'/)
assert.match(script, /V2\\\.apk/)
assert.match(script, /AssetsRoot/)

console.log('apkMilestoneReadiness tests passed')
