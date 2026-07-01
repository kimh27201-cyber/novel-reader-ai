import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getAndroidDemoReadiness } from '../common/androidReadiness.js'

const blocked = getAndroidDemoReadiness({
  backendBaseUrl: 'http://127.0.0.1:8000',
  backendUser: null,
  backendHealth: ''
})

assert.equal(blocked.canRecordDemo, false)
assert.equal(blocked.readyCount, 0)
assert.equal(blocked.actionCount, 3)
assert.equal(blocked.manualCount, 2)
assert.equal(blocked.items[0].id, 'backend-address')
assert.equal(blocked.items[0].state, 'action')
assert.match(blocked.items[0].detail, /局域网 IP/)

const ready = getAndroidDemoReadiness({
  backendBaseUrl: 'http://192.168.1.8:8000',
  backendUser: { username: 'student' },
  backendHealth: '健康检查通过：ok'
})

assert.equal(ready.canRecordDemo, true)
assert.equal(ready.readyCount, 3)
assert.equal(ready.actionCount, 0)
assert.equal(ready.manualCount, 2)
assert.deepEqual(
  ready.items.map(item => item.state),
  ['ready', 'ready', 'ready', 'manual', 'manual']
)
assert.match(ready.summary, /主链路已准备/)
assert.match(ready.items[3].detail, /DCloud AppID/)
assert.match(ready.items[4].detail, /HBuilderX/)

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'))
assert.equal(manifest.versionName, '1.0.0')
assert.equal(manifest.versionCode, '10000')
assert.ok(manifest['app-plus'].distribute.android.permissions.includes('android.permission.CAMERA'))

const profile = readFileSync(new URL('../pages/profile/profile.vue', import.meta.url), 'utf8')
assert.match(profile, /androidReadiness/)
assert.match(profile, /APK 展示准备/)

const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
assert.match(ci, /find tests -maxdepth 1 -name "\*\.test\.mjs"/)

const packaging = readFileSync(new URL('../docs/PACKAGING_ANDROID.md', import.meta.url), 'utf8')
assert.match(packaging, /novel-reader-1\.0\.0-android-v1\.apk/)

console.log('androidReadiness tests passed')
