import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  applyRule,
  createSourceKey,
  normalizeSourceConfig
} from '../common/sourceEngine.js'
import {
  analyzeBookSourceCompatibility,
  applySourceImport,
  buildImportPreview,
  previewSourceImport
} from '../common/bookSources.js'

const store = {}
globalThis.uni = {
  getStorageSync(key) { return store[key] },
  setStorageSync(key, value) { store[key] = value }
}

const raw = {
  bookSourceName: '稳定键源',
  bookSourceUrl: 'https://example.com/',
  searchUrl: '/search?q={{key}}',
  ruleSearch: { bookList: '$.books[*]', name: '$.name', bookUrl: '$.url' },
  ruleToc: { chapterList: '.chapter', chapterName: 'a@text', chapterUrl: 'a@href', nextTocUrl: '.next@href' },
  ruleContent: { content: '#content@text', nextContentUrl: '.next@href' }
}

assert.equal(createSourceKey(raw), createSourceKey({ ...raw, bookSourceUrl: 'https://example.com' }))
const source = normalizeSourceConfig(raw)
assert.equal(source.sourceKey, createSourceKey(raw))

const analysis = analyzeBookSourceCompatibility(source)
assert.equal(analysis.status, 'ready')
assert.equal(analysis.android_supported, true)
assert.equal(analysis.backend_supported, true)

assert.equal(applyRule('<div><b>A</b><span>B</span></div>', 'b@text&&span@text'), 'AB')
assert.equal(applyRule(['A', 'B', 'C'], '@-1'), 'C')
assert.equal(applyRule(['A', 'B', 'C'], '@!0'), 'C')
assert.equal(applyRule({ data: { title: 'JSONPath' } }, '@json:$.data.title'), 'JSONPath')

const restricted = normalizeSourceConfig({
  bookSourceName: '受限源',
  bookSourceUrl: 'https://restricted.example',
  searchUrl: '@js:java.ajax("/search")',
  ruleSearch: { bookList: '.book' },
  ruleToc: { chapterList: '.chapter' },
  ruleContent: { content: '@js:java.getString("x")' }
})
const restrictedPreview = buildImportPreview([restricted], [])
assert.equal(restrictedPreview.sources[0].status, 'blocked')
assert.equal(restrictedPreview.sources[0].enabled, false)
const restrictedResult = applySourceImport(restrictedPreview)
assert.equal(restrictedResult.actualWritten, 1)
assert.equal(restrictedResult.importedSources[0].enabled, false)

const resolvedPreview = previewSourceImport({ rawSources: raw, sourceMeta: { source: 'test' } })
assert.equal(resolvedPreview.total, 1)
assert.equal(resolvedPreview.sources[0].sourceKey, source.sourceKey)

const javaSource = fs.readFileSync('android-webview-shell/src/com/novelreader/v1/SourceHttpBridge.java', 'utf8')
const activitySource = fs.readFileSync('android-webview-shell/src/com/novelreader/v1/MainActivity.java', 'utf8')
assert.match(activitySource, /addJavascriptInterface\(sourceHttpBridge, "NovelReaderHttp"\)/)
assert.match(javaSource, /Executors\.newFixedThreadPool\(4\)/)
assert.match(javaSource, /isLoopbackAddress\(\)/)
assert.match(javaSource, /isSiteLocalAddress\(\)/)
assert.match(javaSource, /TOO_MANY_REDIRECTS/)
assert.match(javaSource, /ABSOLUTE_MAX_BYTES/)
assert.match(javaSource, /removeHeaderIgnoreCase\(headers, "Authorization"\)/)
assert.match(javaSource, /cookieKey\(sourceKey, currentUrl\)/)

delete globalThis.uni
console.log('sourceRuntimeV3 tests passed')
