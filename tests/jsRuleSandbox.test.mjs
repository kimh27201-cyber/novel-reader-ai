import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { executeJsRule, JsRuleSandboxError } from '../common/jsRuleSandbox.js'

assert.equal(executeJsRule('result.trim().toUpperCase()', { result: '  abc ' }), 'ABC')
assert.equal(executeJsRule('encodeURIComponent(key)', { key: '中文 书' }), encodeURIComponent('中文 书'))
assert.equal(executeJsRule('decodeURIComponent(result)', { result: '%E4%B9%A6' }), '书')
assert.equal(executeJsRule('base64Decode(result)', { result: '5Lmm' }), '书')
assert.equal(executeJsRule('base64Encode(result)', { result: '书' }), '5Lmm')
assert.equal(executeJsRule('jsonParse(result).name', { result: '{"name":"book"}' }), 'book')
assert.equal(executeJsRule('resolveUrl(result, baseUrl)', { result: '/a', baseUrl: 'https://example.com/root/' }), 'https://example.com/a')
assert.equal(executeJsRule('result.replace(/book/g, "novel")', { result: 'book-book' }), 'novel-novel')
assert.equal(
  executeJsRule('<js>var url = "https://example.com/search"; var post = JSON.stringify({method: "POST", body: "q=" + encodeURIComponent(key), headers: {"Content-Type": "application/x-www-form-urlencoded"}}); url + "," + post;</js>', { key: '剑来' }),
  `https://example.com/search,{"method":"POST","body":"q=${encodeURIComponent('剑来')}","headers":{"Content-Type":"application/x-www-form-urlencoded"}}`
)
assert.equal(
  executeJsRule(`@js:
let data = JSON.stringify({ContentAnchorBatch: [{BookID: book.kind, ChapterSeqNo: [result]}], Scene: "chapter"})
let option = {method: "POST", body: data}
"https://example.com/content," + JSON.stringify(option)`, { result: '8', book: { kind: '6305' } }),
  'https://example.com/content,{"method":"POST","body":"{\\"ContentAnchorBatch\\":[{\\"BookID\\":\\"6305\\",\\"ChapterSeqNo\\":[\\"8\\"]}],\\"Scene\\":\\"chapter\\"}"}'
)

for (const rule of ['fetch("https://x")', 'java.ajax()', 'window.location', 'document.cookie', 'eval("1")', 'while(true){}']) {
  assert.throws(() => executeJsRule(rule, {}), error => error instanceof JsRuleSandboxError && error.code === 'UNSUPPORTED_JS_CAPABILITY')
}
assert.throws(
  () => executeJsRule('result.trim()', { result: 'x' }, { timeoutMs: 0 }),
  error => error instanceof JsRuleSandboxError && error.code === 'JS_RULE_TIMEOUT'
)

const sandboxSource = readFileSync(new URL('../common/jsRuleSandbox.js', import.meta.url), 'utf8')
assert.doesNotMatch(sandboxSource, /\?\?/, 'HBuilderX H5 build must not receive untranspiled nullish coalescing syntax')

console.log('jsRuleSandbox tests passed')
