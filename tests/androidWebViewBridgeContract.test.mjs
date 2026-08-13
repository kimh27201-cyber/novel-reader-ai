import assert from 'node:assert/strict'
import fs from 'node:fs'

const mainActivity = fs.readFileSync('android-webview-shell/src/com/novelreader/v1/MainActivity.java', 'utf8')

assert.match(mainActivity, /addJavascriptInterface\(new RenderedHtmlBridge\(\), "NovelReaderWebViewParser"\)/)
assert.match(mainActivity, /@JavascriptInterface\s+public String getBridgeInfo\(\)/)
assert.match(mainActivity, /payload\.put\("contractVersion", 1\)/)
assert.match(mainActivity, /payload\.put\("runtime", "android-webview-shell"\)/)
assert.match(mainActivity, /payload\.put\("platform", "android"\)/)
assert.match(mainActivity, /features\.put\("renderedFetch", true\)/)
assert.match(mainActivity, /features\.put\("openLogin", true\)/)
assert.match(mainActivity, /features\.put\("readCookie", true\)/)
assert.match(mainActivity, /methods\.put\("fetchRenderedHtml"\)/)
assert.match(mainActivity, /methods\.put\("openLoginPage"\)/)
assert.match(mainActivity, /methods\.put\("getCookie"\)/)
assert.match(mainActivity, /@JavascriptInterface\s+public String readChapters\(String keysJson\)/)
assert.match(mainActivity, /if \(keys\.length\(\) > 10000\) return "\{\}"/)
assert.match(mainActivity, /public String getMemoryInfo\(\)/)
assert.match(mainActivity, /payload\.put\("totalPssKb", memoryInfo\.getTotalPss\(\)\)/)

console.log('androidWebViewBridgeContract tests passed')
