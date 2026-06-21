import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { detectSourceCompatibilityLevel, hasUnsupportedRule, parseRequestSpec } from '../common/sourceEngine.js'

assert.equal(detectSourceCompatibilityLevel({ ruleSearch: { bookList: '.book' } }).level, 'full_css')
assert.equal(detectSourceCompatibilityLevel({ header: '{"Referer":"https://a"}' }).level, 'need_headers')
assert.equal(detectSourceCompatibilityLevel({ ruleSearch: '<js>result.trim()</js>' }).level, 'need_js_sandbox')
assert.equal(detectSourceCompatibilityLevel({ ruleSearch: 'webView=true' }).level, 'need_webview')
assert.equal(detectSourceCompatibilityLevel({ loginUrl: 'https://a/login' }).level, 'need_login')
assert.equal(detectSourceCompatibilityLevel({ comment: '需要验证码后访问' }).level, 'unsupported')
assert.equal(detectSourceCompatibilityLevel({ ruleSearch: 'webView=true' }, { android: false }).environmentSupported, false)
assert.equal(detectSourceCompatibilityLevel({ ruleSearch: 'webView=true' }, { android: true }).environmentSupported, true)
assert.match(detectSourceCompatibilityLevel({ loginUrl: 'https://a/login' }, { android: false }).nextAction, /Android APK/)
assert.equal(hasUnsupportedRule('<js>resolveUrl(key, baseUrl)</js>'), false)
assert.equal(hasUnsupportedRule('<js>java.ajax()</js>'), true)
assert.equal(parseRequestSpec('<js>resolveUrl(key, baseUrl)</js>', { key: '/search', baseUrl: 'https://a.test' }).url, 'https://a.test/search')

const libraryPage = readFileSync(new URL('../pages/library/library.vue', import.meta.url), 'utf8')
assert.match(libraryPage, /compatibilityLevel/)
assert.match(libraryPage, /environmentSupported/)
assert.match(libraryPage, /nextAction/)
assert.match(libraryPage, /openSelectedSourceLogin/)
assert.match(libraryPage, /saveSelectedSourceLogin/)
assert.match(libraryPage, /clearSelectedSourceCookie/)

console.log('sourceCompatibilityLevel tests passed')
