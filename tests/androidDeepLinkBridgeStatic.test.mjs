import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const manifest = readFileSync(new URL('../android-webview-shell/AndroidManifest.xml', import.meta.url), 'utf8')
const mainActivity = readFileSync(new URL('../android-webview-shell/src/com/novelreader/v1/MainActivity.java', import.meta.url), 'utf8')

assert.match(mainActivity, /onNewIntent\s*\(\s*Intent\s+intent\s*\)/)
assert.match(mainActivity, /setIntent\(intent\)/)
assert.match(mainActivity, /NovelReaderDeepLinkBridge/)
assert.match(mainActivity, /peekDeepLink/)
assert.match(mainActivity, /ackDeepLink/)
assert.match(mainActivity, /SharedPreferences/)
assert.match(mainActivity, /openImportScanPage/)
assert.match(mainActivity, /fromDeepLink=1/)
assert.doesNotMatch(mainActivity, /input="\s*\+/)

const addBridgeIndex = mainActivity.indexOf('addJavascriptInterface(new DeepLinkBridge()')
const configureIndex = mainActivity.indexOf('configureWebView(webView)')
const firstRuntimeLoadIndex = mainActivity.indexOf('webView.loadUrl(APP_URL')
assert.ok(addBridgeIndex >= 0)
assert.ok(configureIndex >= 0)
assert.ok(firstRuntimeLoadIndex >= 0)
assert.ok(configureIndex < firstRuntimeLoadIndex)

assert.match(manifest, /android\.intent\.action\.VIEW/)
assert.match(manifest, /android\.intent\.category\.BROWSABLE/)
assert.match(manifest, /android:scheme="yuedu"/)
assert.match(manifest, /android:scheme="legado"/)

console.log('androidDeepLinkBridgeStatic tests passed')
