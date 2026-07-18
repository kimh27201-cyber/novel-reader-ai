import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  PENDING_DEEP_LINK_IMPORT_KEY,
  buildDeepLinkImportPreview,
  consumeNativeDeepLinkImport,
  extractDeepLinkUri,
  handleNovelReaderDeepLink,
  normalizeDeepLinkImportInput,
  prepareDeepLinkImport
} from '../common/deepLinkImport.js'

const manifest = readFileSync(new URL('../android-webview-shell/AndroidManifest.xml', import.meta.url), 'utf8')
assert.match(manifest, /android\.intent\.action\.VIEW/)
assert.match(manifest, /android\.intent\.category\.DEFAULT/)
assert.match(manifest, /android\.intent\.category\.BROWSABLE/)
assert.match(manifest, /android:scheme="yuedu"/)
assert.match(manifest, /android:scheme="legado"/)

const mainActivity = readFileSync(new URL('../android-webview-shell/src/com/novelreader/v1/MainActivity.java', import.meta.url), 'utf8')
assert.match(mainActivity, /onNewIntent\s*\(\s*Intent\s+intent\s*\)/)
assert.match(mainActivity, /getDataString\(\)/)
assert.match(mainActivity, /PendingDeepLinkStore/)
assert.match(mainActivity, /SharedPreferences/)
assert.match(mainActivity, /openImportScanPage/)
assert.match(mainActivity, /fromDeepLink=1/)
assert.doesNotMatch(mainActivity, /appUrlForDeepLink/)
assert.doesNotMatch(mainActivity, /input=\s*"\s*\+/)
assert.doesNotMatch(mainActivity, /URLEncoder\.encode/)
assert.match(mainActivity, /NovelReaderDeepLinkBridge/)
assert.match(mainActivity, /peekDeepLink/)
assert.match(mainActivity, /ackDeepLink/)
assert.match(mainActivity, /consumeDeepLink/)
assert.match(mainActivity, /evaluateJavascript/)

const deepLinkModule = readFileSync(new URL('../common/deepLinkImport.js', import.meta.url), 'utf8')
assert.match(deepLinkModule, /NovelReaderDeepLink/)
assert.match(deepLinkModule, /detectImportInputType/)
assert.match(deepLinkModule, /resolveImportInput/)
assert.match(deepLinkModule, /buildImportPreview/)
assert.match(deepLinkModule, /normalizeDeepLinkImportInput/)
assert.match(deepLinkModule, /consumeNativeDeepLinkImport/)
assert.match(deepLinkModule, /__novelReaderPendingDeepLink/)
assert.match(deepLinkModule, /\/pages\/import\/scan/)

const scanPage = readFileSync(new URL('../pages/import/scan.vue', import.meta.url), 'utf8')
assert.match(scanPage, /readPendingDeepLinkImport/)
assert.match(scanPage, /normalizeDeepLinkImportInput/)
assert.match(scanPage, /hydrateImportInputFromNativeBridge/)
assert.match(scanPage, /ackNativeDeepLink/)
assert.match(scanPage, /previewInput/)
assert.match(scanPage, /清除旧阅读/)

const uri = 'legado://import/bookSource?src=https%3A%2F%2Fwww.yckceo.com%2Fyuedu%2Fshuyuan%2Fjson%2Fid%2F7514.json'
const normalizedInput = 'https://www.yckceo.com/yuedu/shuyuan/json/id/7514.json'
assert.equal(extractDeepLinkUri({ detail: { uri } }), uri)
assert.equal(normalizeDeepLinkImportInput(uri), normalizedInput)
assert.deepEqual(consumeNativeDeepLinkImport({
  NovelReaderDeepLinkBridge: {
    consumeDeepLink() {
      return uri
    }
  }
}).input, normalizedInput)

const writes = {}
const navigations = []
const result = prepareDeepLinkImport(uri, {
  storage: {
    setStorageSync(key, value) {
      writes[key] = value
    }
  },
  navigator: {
    navigateTo(options) {
      navigations.push(options.url)
    }
  }
})
assert.equal(result.uri, uri)
assert.equal(result.input, normalizedInput)
assert.equal(writes[PENDING_DEEP_LINK_IMPORT_KEY].uri, uri)
assert.equal(writes[PENDING_DEEP_LINK_IMPORT_KEY].input, normalizedInput)
assert.ok(navigations[0].includes('/pages/import/scan'))

const duplicateNavigations = []
assert.equal(handleNovelReaderDeepLink({ detail: { uri: `${uri}&dedupe=1` } }, {
  storage: { setStorageSync() {} },
  navigator: {
    navigateTo(options) {
      duplicateNavigations.push(options.url)
    }
  }
}), true)
assert.equal(handleNovelReaderDeepLink({ detail: { uri: `${uri}&dedupe=1` } }, {
  storage: { setStorageSync() {} },
  navigator: {
    navigateTo(options) {
      duplicateNavigations.push(options.url)
    }
  }
}), true)
assert.equal(duplicateNavigations.length, 1)

globalThis.uni = {
  request(options) {
    options.success({
      statusCode: 200,
      data: {
        text: JSON.stringify([{
          bookSourceName: 'Deep Link Preview Source',
          bookSourceUrl: 'https://deeplink.example.com',
          searchUrl: 'https://deeplink.example.com/search?q={{key}}',
          ruleSearch: { bookList: '$.items[*]', name: '$.name', bookUrl: '$.url' }
        }]),
        status_code: 200,
        final_url: options.data.url
      }
    })
  }
}
const preview = await buildDeepLinkImportPreview(uri)
assert.equal(preview.imported, 1)
assert.equal(preview.sources[0].name, 'Deep Link Preview Source')

console.log('androidDeepLinkImport tests passed')
