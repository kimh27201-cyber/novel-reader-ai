import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
const appTheme = readFileSync(new URL('../common/appTheme.js', import.meta.url), 'utf8')
const activity = readFileSync(
  new URL('../android-webview-shell/src/com/novelreader/v1/MainActivity.java', import.meta.url),
  'utf8'
)
const styles = readFileSync(
  new URL('../android-webview-shell/res/values/styles.xml', import.meta.url),
  'utf8'
)

assert.match(styles, /android:windowBackground">#070A0F/)
assert.match(styles, /android:windowLightStatusBar">false/)

assert.match(activity, /settings\.setCacheMode\(WebSettings\.LOAD_DEFAULT\)/)
assert.doesNotMatch(activity, /LOAD_NO_CACHE|clearCache\(true\)/)
assert.match(activity, /webView\.setAlpha\(0f\)/)
assert.match(activity, /addJavascriptInterface\(new LaunchBridge\(\), "NovelReaderLaunch"\)/)
assert.match(activity, /class LaunchBridge/)
assert.match(activity, /public void saveTheme\(String themeId\)/)
assert.match(activity, /public void ready\(String themeId\)/)
assert.match(activity, /revealLaunchContent\("vue-ready"\)/)
assert.match(activity, /LAUNCH_REVEAL_TIMEOUT_MS = 5000L/)
assert.match(activity, /launchHandler\.removeCallbacksAndMessages\(null\)/)

assert.match(appTheme, /export function primeAppTheme/)
assert.match(appTheme, /export function notifyAppFirstPaint/)
assert.match(appTheme, /bridge\.saveTheme\(next\)/)
assert.match(appTheme, /bridge\.ready\(next\)/)

const primeIndex = main.indexOf('primeAppTheme()')
const mountIndex = main.indexOf('app.$mount()')
assert.ok(primeIndex >= 0 && mountIndex > primeIndex, 'theme tokens must be restored before Vue mounts')
assert.match(main, /requestAnimationFrame\(\(\) => requestAnimationFrame\(reveal\)\)/)

console.log('cold start theme tests passed')
