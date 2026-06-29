import assert from 'node:assert/strict'
import {
  applyListRule,
  applyRule,
  detectSourceImportPayload,
  extractJsonPayload,
  extractRepositorySourceUrl,
  getRuntimeRequestUrl,
  parseRequestSpec,
  parseSourceJson,
  requestText,
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

const legado3Html = `
  <div class="book">
    <a href="/book/3"><span class="name">第三本书</span></a>
    <span class="author">作者丙</span>
  </div>
  <div id="content"><p>第一段</p><p>第二段</p></div>
`
assert.equal(applyRule(legado3Html, 'class.book@tag.a@href'), '/book/3')
assert.equal(applyRule(legado3Html, 'class.book@tag.span.0@text'), '第三本书')
assert.equal(applyRule(legado3Html, 'id.content@textNodes'), '第一段\n第二段')

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

const importLink = 'yuedu://bookSource/import?src=https%3A%2F%2Fwww.yck2026.top%2Fyuedu%2Fshuyuan%2Fjson%2F7274.json'
assert.deepEqual(detectSourceImportPayload('[{"bookSourceName":"A"}]'), {
  type: 'json',
  value: '[{"bookSourceName":"A"}]'
})
assert.equal(detectSourceImportPayload('https://example.com/a.json').type, 'json-url')
assert.equal(detectSourceImportPayload('https://www.yck2026.top/yuedu/shuyuan/content/id/7274.html').type, 'repository-page')
assert.equal(detectSourceImportPayload(importLink).type, 'import-link')
assert.equal(detectSourceImportPayload(importLink).value, 'https://www.yck2026.top/yuedu/shuyuan/json/7274.json')

const repoHtml = `
  <a class="btn" href="/yuedu/shuyuan/json/id/7274.json">下载 JSON</a>
  <a href="legado://import?src=https%3A%2F%2Fexample.com%2Fignored.json">一键导入</a>
`
assert.equal(
  extractRepositorySourceUrl(repoHtml, 'https://www.yck2026.top/yuedu/shuyuan/content/id/7274.html'),
  'https://www.yck2026.top/yuedu/shuyuan/json/id/7274.json'
)

const yckDetailHtml = `
  <a href="/yuedu/shuyuan/index.html">source list</a>
  <pre>/*
    author comment, not json
  */</pre>
  <input id="jsonurl" value="https://www.yck2026.top/yuedu/shuyuan/json/id/7274.json">
  <pre class="layui-code" id="jsonpre">{
    "bookSourceName": "YCK Detail Source",
    "bookSourceUrl": "detail-source"
  }</pre>
`
assert.equal(
  extractRepositorySourceUrl(yckDetailHtml, 'https://www.yck2026.top/yuedu/shuyuan/content/id/7274.html'),
  'https://www.yck2026.top/yuedu/shuyuan/json/id/7274.json'
)
assert.equal(JSON.parse(extractJsonPayload(yckDetailHtml)).bookSourceName, 'YCK Detail Source')

globalThis.window = { location: { protocol: 'http:' } }
assert.equal(
  getRuntimeRequestUrl('https://www.yck2026.top/yuedu/shuyuan/content/id/7274.html'),
  '/yck2026-proxy/yuedu/shuyuan/content/id/7274.html'
)
globalThis.window = { location: { protocol: 'file:' } }
assert.equal(
  getRuntimeRequestUrl('https://www.yck2026.top/yuedu/shuyuan/content/id/7274.html'),
  'https://www.yck2026.top/yuedu/shuyuan/content/id/7274.html'
)
delete globalThis.window

const proxyCalls = []
globalThis.uni = {
  request(options) {
    proxyCalls.push(options)
    options.success({
      statusCode: 200,
      data: { text: '<html>proxied</html>', status_code: 200, final_url: options.data.url }
    })
  }
}
assert.equal(
  await requestText({
    url: 'https://novel.example.com/search',
    method: 'POST',
    header: { Referer: 'https://novel.example.com' },
    data: 'q=abc',
    charset: 'gbk'
  }),
  '<html>proxied</html>'
)
assert.equal(proxyCalls[0].url, 'http://127.0.0.1:8000/api/proxy/fetch')
assert.deepEqual(proxyCalls[0].data, {
  url: 'https://novel.example.com/search',
  method: 'POST',
  headers: { Referer: 'https://novel.example.com' },
  body: 'q=abc',
  charset: 'gbk',
  throttle_ms: 0
})
delete globalThis.uni

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
assert.equal(parsed[0].compatibilityLevel, 'full_css')
assert.equal(parsed[0].compatibility, '完整兼容')

const recommended = parseSourceJson(JSON.stringify([{
  bookSourceName: '推荐 3.x 源',
  bookSourceUrl: 'https://recommended.example.com',
  recommended: true
}]))
assert.equal(recommended[0].recommended, true)

const legado3 = parseSourceJson(JSON.stringify([{
  bookSourceName: 'Legado 3X Source',
  bookSourceUrl: 'https://legado3.example.com',
  bookSourceGroup: '3X 分组',
  bookSourceType: 0,
  comment: '需要登录后使用',
  weight: 7,
  exploreUrl: 'https://legado3.example.com/explore',
  loginUrl: 'https://legado3.example.com/login',
  loginUi: [{ name: '账号', type: 'text' }]
}]))[0]
assert.equal(legado3.formatVersion, '3.x')
assert.equal(legado3.group, '3X 分组')
assert.equal(legado3.comment, '需要登录后使用')
assert.equal(legado3.weight, 7)
assert.equal(legado3.features.explore, true)
assert.equal(legado3.features.login, true)
assert.equal(legado3.features.webView, false)
assert.equal(legado3.compatibilityLevel, 'need_login')
assert.match(legado3.compatibility, /需登录/)

const before = getSourceConfigs().length
assert.equal(importSourcesFromJson(sourceJson), 1)
assert.equal(getSourceConfigs().length, before + 1)
setSourceEnabled(parsed[0].id, false)
assert.equal(getSourceConfigs().find(source => source.id === parsed[0].id).enabled, false)

const searchSources = pickOnlineSearchSources([
  { id: 'off', enabled: false, raw: { searchUrl: '/off', ruleSearch: { bookList: '$.items[*]' } } },
  { id: 'one', enabled: true, lastTest: { status: 'passed' }, raw: { searchUrl: '/one', ruleSearch: { bookList: '$.items[*]' } } },
  { id: 'two', enabled: true, lastTest: { status: 'passed' }, raw: { searchUrl: '/two', ruleSearch: { bookList: '$.items[*]' } } },
  { id: 'three', enabled: true, lastTest: { status: 'passed' }, raw: { searchUrl: '/three', ruleSearch: { bookList: '$.items[*]' } } },
  { id: 'four', enabled: true, lastTest: { status: 'untested' }, raw: { searchUrl: '/four', ruleSearch: { bookList: '$.items[*]' } } }
])
assert.deepEqual(searchSources.map(source => source.id), ['one', 'two', 'three'])

console.log('sourceEngine tests passed')
