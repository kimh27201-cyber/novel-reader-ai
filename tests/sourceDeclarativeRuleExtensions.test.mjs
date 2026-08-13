import assert from 'node:assert/strict'

import { applyListRule, applyRule, renderTemplate } from '../common/sourceEngine.js'
import { JsRuleSandboxError, executeJsRule } from '../common/jsRuleSandbox.js'

const html = `
  <ul class="txt-list">
    <li><a href="/ignore">忽略</a></li>
    <li><a href="/one"><span class="text-[18px]">第一本</span></a></li>
    <li><a href="/two">第二本</a></li>
  </ul>
  <div class="bookbox"><div class="bookname"><a href="/xpath">XPath 书名</a></div></div>
`

assert.equal(applyListRule(html, '.txt-list li!0').length, 2)
assert.equal(applyListRule(html, '.txt-list li:not(:first-child)').length, 2)
assert.equal(applyListRule(html, 'class.txt-list@li:not(:first-child)').length, 2)
assert.equal(applyRule(html, '.text-[18px]@text'), '第一本')
const xpathBooks = applyListRule(html, "//div[@class='bookbox']")
assert.equal(xpathBooks.length, 1)
assert.deepEqual(applyRule(xpathBooks[0], "//div[@class='bookname']/a/text()"), ['XPath 书名'])
assert.deepEqual(applyRule(xpathBooks[0], "//div[@class='bookname']/a/@href"), ['/xpath'])

const json = { data: [{ item: { title: '甲' } }, { item: { title: '乙' } }] }
assert.deepEqual(applyRule(json, '$..title'), ['甲', '乙'])
assert.equal(renderTemplate('/book/{{$.articleid}}', { $: { articleid: 42 } }), '/book/42')
assert.equal(applyRule({ articleid: 42 }, 'https://example.com/book/{{$.articleid}}', { $: { articleid: 42 } }), 'https://example.com/book/42')

assert.equal(applyRule(html, "//div[contains(@class,'book')]"), '')
assert.throws(
  () => executeJsRule('result + result + result', { result: 'x' }, { maxOperations: 1 }),
  error => error instanceof JsRuleSandboxError && error.code === 'JS_RULE_BUDGET_EXCEEDED'
)
assert.throws(
  () => executeJsRule('eval("1")', {}),
  error => error instanceof JsRuleSandboxError && error.code === 'UNSUPPORTED_JS_CAPABILITY'
)

console.log('sourceDeclarativeRuleExtensions tests passed')
