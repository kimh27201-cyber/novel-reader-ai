import assert from 'node:assert/strict'
import { executeJsRule, JsRuleSandboxError } from '../common/jsRuleSandbox.js'

assert.equal(executeJsRule('result.trim().toUpperCase()', { result: '  abc ' }), 'ABC')
assert.equal(executeJsRule('encodeURIComponent(key)', { key: '中文 书' }), encodeURIComponent('中文 书'))
assert.equal(executeJsRule('decodeURIComponent(result)', { result: '%E4%B9%A6' }), '书')
assert.equal(executeJsRule('base64Decode(result)', { result: '5Lmm' }), '书')
assert.equal(executeJsRule('base64Encode(result)', { result: '书' }), '5Lmm')
assert.equal(executeJsRule('jsonParse(result).name', { result: '{"name":"book"}' }), 'book')
assert.equal(executeJsRule('resolveUrl(result, baseUrl)', { result: '/a', baseUrl: 'https://example.com/root/' }), 'https://example.com/a')
assert.equal(executeJsRule('result.replace(/book/g, "novel")', { result: 'book-book' }), 'novel-novel')

for (const rule of ['fetch("https://x")', 'java.ajax()', 'window.location', 'document.cookie', 'eval("1")', 'while(true){}']) {
  assert.throws(() => executeJsRule(rule, {}), error => error instanceof JsRuleSandboxError && error.code === 'UNSUPPORTED_JS_CAPABILITY')
}
assert.throws(
  () => executeJsRule('result.trim()', { result: 'x' }, { timeoutMs: 0 }),
  error => error instanceof JsRuleSandboxError && error.code === 'JS_RULE_TIMEOUT'
)

console.log('jsRuleSandbox tests passed')
