import assert from 'node:assert/strict'
import {
  applyListRule,
  applyRule,
  parseRequestSpec,
  parseSourceJson,
  renderTemplate,
  resolveUrl
} from '../common/sourceEngine.js'
import {
  getSourceConfigs,
  importSourcesFromJson,
  pickOnlineSearchSources,
  setSourceEnabled
} from '../common/bookSources.js'

const html = `
  <ul class="result-list">
    <li><h3><a href="/book/1">第一本书</a></h3><span class="author">作者甲</span></li>
    <li><h3><a href="/book/2">第二本书</a></h3><span class="author">作者乙</span></li>
  </ul>
`

const items = applyListRule(html, '.result-list li')
assert.equal(items.length, 2)
assert.equal(applyRule(items[0], 'h3 a@text'), '第一本书')
assert.equal(applyRule(items[1], 'h3 a@href'), '/book/2')
assert.equal(applyRule(items[0], '.missing@text||.author@text'), '作者甲')
assert.equal(applyRule('作者：张三 / 类型：玄幻', '##.*作者[:： ]*([^\\s/]+).*##$1'), '张三')

const json = { data: { books: [{ name: '书源小说', url: '/novel/9' }] } }
assert.deepEqual(applyListRule(json, '$.data.books[*]').map(item => item.name), ['书源小说'])
assert.equal(applyRule(json, '$.data.books[0].name'), '书源小说')

assert.equal(renderTemplate('/search/{{key}}/{{page}}', { key: '剑来', page: 2 }), '/search/%E5%89%91%E6%9D%A5/2')
assert.equal(resolveUrl('/book/1', 'https://example.com/root/'), 'https://example.com/book/1')

const request = parseRequestSpec('https://example.com/search,{"method":"POST","body":"key={{key}}","headers":{"X-Test":"{{page}}"}}', {
  key: 'abc',
  page: 3
})
assert.equal(request.method, 'POST')
assert.equal(request.data, 'key=abc')
assert.equal(request.header['X-Test'], '3')

const sourceJson = JSON.stringify([{
  bookSourceName: '测试源',
  bookSourceUrl: 'https://example.com',
  searchUrl: 'https://example.com/search?q={{key}}',
  ruleSearch: { bookList: '$.data.books[*]', name: '$.name', bookUrl: '$.url' },
  ruleToc: { chapterList: '$.chapters[*]', chapterName: '$.title', chapterUrl: '$.url' },
  ruleContent: { content: '$.content' }
}])

const parsed = parseSourceJson(sourceJson)
assert.equal(parsed.length, 1)
assert.equal(parsed[0].compatibility, 'v1 兼容')

const before = getSourceConfigs().length
assert.equal(importSourcesFromJson(sourceJson), 1)
assert.equal(getSourceConfigs().length, before + 1)
setSourceEnabled(parsed[0].id, false)
assert.equal(getSourceConfigs().find(source => source.id === parsed[0].id).enabled, false)

const searchSources = pickOnlineSearchSources([
  { id: 'off', enabled: false, raw: { searchUrl: '/off', ruleSearch: { bookList: '$.items[*]' } } },
  { id: 'one', enabled: true, raw: { searchUrl: '/one', ruleSearch: { bookList: '$.items[*]' } } },
  { id: 'two', enabled: true, raw: { searchUrl: '/two', ruleSearch: { bookList: '$.items[*]' } } },
  { id: 'three', enabled: true, raw: { searchUrl: '/three', ruleSearch: { bookList: '$.items[*]' } } },
  { id: 'four', enabled: true, raw: { searchUrl: '/four', ruleSearch: { bookList: '$.items[*]' } } }
])
assert.deepEqual(searchSources.map(source => source.id), ['one', 'two', 'three'])

console.log('sourceEngine tests passed')
