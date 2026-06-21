import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { scanImportPayload } from '../common/importAdapters.js'

const pagesConfig = JSON.parse(readFileSync(new URL('../pages.json', import.meta.url), 'utf8'))
const pagePaths = pagesConfig.pages.map(page => page.path)
assert.ok(pagePaths.includes('pages/import/scan'), 'pages/import/scan must be registered as a standalone scan import page')

const scanPage = readFileSync(new URL('../pages/import/scan.vue', import.meta.url), 'utf8')
assert.match(scanPage, /source-scan-page/)
assert.match(scanPage, /scanImportPayload/)
assert.match(scanPage, /previewSourcesFromAny/)
assert.match(scanPage, /importSourcesFromAny/)
assert.match(scanPage, /扫码导入/)
assert.match(scanPage, /粘贴链接/)

const libraryPage = readFileSync(new URL('../pages/library/library.vue', import.meta.url), 'utf8')
assert.match(libraryPage, /\/pages\/import\/scan/)

const nativeEvents = []
const nativePayload = await scanImportPayload({}, {
  nativeTimeoutMs: 200,
  runtime: {
    NovelReaderScan: {
      scanQr(callbackName) {
        nativeEvents.push(callbackName)
        globalThis[callbackName]({
          ok: true,
          result: 'https://example.com/native-sources.json'
        })
        return true
      }
    }
  }
})
assert.equal(nativePayload, 'https://example.com/native-sources.json')
assert.equal(nativeEvents.length, 1)
assert.equal(globalThis[nativeEvents[0]], undefined, 'native scan callback must be cleaned up')

const nativeFailure = await assert.rejects(
  () => scanImportPayload({}, {
    nativeTimeoutMs: 20,
    runtime: {
      NovelReaderScan: {
        scanQr(callbackName) {
          globalThis[callbackName]({ ok: false, error: 'No QR scanner app' })
          return true
        }
      }
    }
  }),
  /No QR scanner app|扫码/
)
assert.equal(nativeFailure, undefined)

const mainActivity = readFileSync(new URL('../android-webview-shell/src/com/novelreader/v1/MainActivity.java', import.meta.url), 'utf8')
assert.match(mainActivity, /SCAN_QR_REQUEST/)
assert.match(mainActivity, /addJavascriptInterface\(new ScanBridge\(\), "NovelReaderScan"\)/)
assert.match(mainActivity, /com\.google\.zxing\.client\.android\.SCAN/)
assert.match(mainActivity, /QR_CODE_MODE/)
assert.match(mainActivity, /evaluateJavascript/)

console.log('v2ScanImport tests passed')
