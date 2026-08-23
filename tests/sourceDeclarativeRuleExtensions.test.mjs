import assert from 'node:assert/strict'

import {
  applyListRule,
  applyRule,
  createRuleFlowContext,
  exportRuleFlowValues,
  parseRequestSpec,
  renderTemplate
} from '../common/sourceEngine.js'
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
assert.equal(applyListRule('<ul class="list"><li>甲</li><li>乙</li></ul>', 'ul.list@li').length, 2)
assert.equal(applyListRule('<ul class="sort_list"><li>甲</li></ul>', '.sort_list@li').length, 1)
assert.equal(applyListRule('<div class="block">甲</div><div class="block">乙</div>', 'class.block.[0:-1]').length, 1)
assert.equal(applyRule('<div class="block"><div class="block_txt"><h2><a href="/book/1">剑来</a></h2></div></div>', 'class.block_txt@tag.h2@tag.a@text'), '剑来')
assert.equal(applyListRule('<ul class="liebiao2"><li>甲</li></ul>', '.liebiao2 li').length, 1)
const chainedDescendants = '<div class="catalogyfw_list"><ul><li><a href="/old">旧章</a></li></ul></div><div class="catalogyfw_list"><ul><li><a href="/one">第一章</a></li><li><a href="/two">第二章</a></li></ul></div>'
assert.equal(applyListRule(chainedDescendants, '.catalogyfw_list.1@ul li a').length, 2)
assert.equal(applyRule(chainedDescendants, '.catalogyfw_list.1@ul li a@0@href'), '/one')
assert.equal(applyListRule(html, '.txt-list li:not(:first-child)').length, 2)
assert.equal(applyListRule(html, 'class.txt-list@li:not(:first-child)').length, 2)
assert.equal(applyRule(html, '.text-[18px]@text'), '第一本')
assert.equal(applyRule('<span class="text-[#555]">特殊类名</span>', 'class.text-[#555]@text'), '特殊类名')
assert.deepEqual(applyListRule(html, '.txt-list li.0:2').map(item => applyRule(item, '@text')), ['忽略', '第一本'])
assert.equal(applyRule(html, '.txt-list li.-1@text'), '第二本')
assert.equal(applyRule('<a href="/next">下一页</a><a href="/last">尾页</a>', 'text.下一页@href'), '/next')
assert.equal(applyRule('<div><img src="/cover.jpg" title="真实书名" alt="备用书名"></div>', 'div@img@title'), '真实书名')
assert.equal(applyRule('<div><img src="/cover.jpg" title="真实书名" alt="备用书名"></div>', 'div@img@alt'), '备用书名')
const metadataHtml = '<meta property="og:novel:author" content="作者甲"><meta property="og:novel:category status" content="玄幻 连载"><a href="/book/1" data-id="book-1">书名</a>'
assert.equal(applyRule(metadataHtml, '[property$=author]@content'), '作者甲')
assert.equal(applyRule(metadataHtml, '[property~=category|update_time]@content'), '玄幻 连载')
assert.equal(applyRule(metadataHtml, '[data-id^=book-]@text'), '书名')
assert.equal(applyRule(metadataHtml, '[data-id*=ook-]@text'), '书名')
assert.equal(applyRule(metadataHtml, '[data-id|=book]@text'), '书名')
const pseudoHtml = '<section class="card"><a>剑来</a></section><section class="card"><span>其他</span></section>'
assert.equal(applyListRule(pseudoHtml, 'section.card:has(a)').length, 1)
assert.equal(applyRule(pseudoHtml, 'section.card:contains(剑来)@text'), '剑来')
assert.deepEqual(applyRule(pseudoHtml, 'p:has(strong font:contains(简介)) + p@text||section.card@text'), ['剑来', '其他'])
assert.equal(applyRule(html, '.txt-list li:eq(-1)@text'), '第二本')
const xpathBooks = applyListRule(html, "//div[@class='bookbox']")
assert.equal(xpathBooks.length, 1)
assert.deepEqual(applyRule(xpathBooks[0], "//div[@class='bookname']/a/text()"), ['XPath 书名'])
assert.deepEqual(applyRule(xpathBooks[0], "//div[@class='bookname']/a/@href"), ['/xpath'])

const json = { data: [{ item: { title: '甲' } }, { item: { title: '乙' } }] }
assert.deepEqual(applyRule(json, '$..title'), ['甲', '乙'])
assert.equal(renderTemplate('/book/{{$.articleid}}', { $: { articleid: 42 } }), '/book/42')
assert.equal(applyRule({ articleid: 42 }, 'https://example.com/book/{{$.articleid}}', { $: { articleid: 42 } }), 'https://example.com/book/42')
assert.equal(applyRule({ articleid: 42 }, 'articleid'), 42)

const ruleFlow = createRuleFlowContext('source-a')
const flowContext = { ruleFlow, $: { id: 42 } }
assert.equal(applyRule({ id: 42, name: '示例书' }, '$.name@put:{book:$.id}', flowContext), '示例书')
assert.equal(applyRule({}, '/v2/book/@get:{book}/chapters', flowContext), '/v2/book/42/chapters')
assert.equal(applyRule({ id: 43, name: '示例书二' }, 'name@put:{book:id}', flowContext), '示例书二')
assert.equal(applyRule('', '@get:{book}', flowContext), '43')
assert.equal(applyRule({}, 'resourceid=@get:{book}&page=1', flowContext), 'resourceid=43&page=1')
assert.equal(parseRequestSpec('/chapter?resourceid=@get:{book}', flowContext, 'https://example.com').url, 'https://example.com/chapter?resourceid=43')
assert.equal(renderTemplate('{{java.getString("book")}}', flowContext), '43')
assert.deepEqual(exportRuleFlowValues(ruleFlow), { book: '43' })
assert.equal(applyRule('<h1>书名</h1><span class="author">作者</span>', '@put:{n:"h1@text",a:".author@text"}', { ruleFlow }), '<h1>书名</h1><span class="author">作者</span>')
assert.equal(applyRule('', '@get:{n}', { ruleFlow }), '书名')
assert.throws(
  () => applyRule({ id: 'x'.repeat(128) }, '$.id@put:{large:$.id}', { ruleFlow: createRuleFlowContext('source-a', {}, { maxValueChars: 64 }) }),
  error => error && error.code === 'SCRIPT_BUDGET_EXCEEDED'
)
assert.equal(applyRule('', '@get:{book}', { ruleFlow: createRuleFlowContext('source-b') }), '')
assert.deepEqual(executeJsRule('J(result)', { result: '{"id":7}' }), { id: 7 })
assert.equal(executeJsRule('Base()', { baseUrl: 'https://example.com/path?q=1' }), 'https://example.com')
let cookieCleared = 0
assert.equal(
  renderTemplate('{{cookie.removeCookie(source.getKey())}}/search/{{source.getKey()}}', {
    sourceKey: 'https://example.com',
    clearSourceCookie: () => { cookieCleared += 1 }
  }),
  '/search/https://example.com'
)
assert.equal(cookieCleared, 1)

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
