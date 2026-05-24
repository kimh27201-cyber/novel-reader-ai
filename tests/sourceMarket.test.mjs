import assert from 'node:assert/strict'
import {
  createSourceMarketUrl,
  fetchMarketSourcePreview,
  fetchSourceMarketItems,
  parseSourceMarketItems,
  resolveMarketScanTarget
} from '../common/sourceMarket.js'

const listHtml = `
  <h2><a href="/yuedu/shuyuan/content/id/7285.html">小说狂人czbooks.net https://czbooks.net</a></h2>
  <p>05/23 22:36</p>
  <p>GPT制作书源 · 3.X 发 搜 · 用户: tester 下载:56</p>
  <h2><a href="/yuedu/shuyuan/content/id/7001.html">书趣阁 https://example.com</a></h2>
  <p>1天前</p>
  <p>3.X 搜 图 · 用户: reader 下载:300</p>
`

const items = parseSourceMarketItems(listHtml, 'https://www.yckceo.com/yuedu/shuyuan/index.html')
assert.equal(items.length, 2)
assert.equal(items[0].title, '小说狂人czbooks.net')
assert.equal(items[0].baseUrl, 'https://czbooks.net')
assert.equal(items[0].downloads, 56)
assert.deepEqual(items[0].tags, ['3.X', '发', '搜'])
assert.equal(items[0].detailUrl, 'https://www.yckceo.com/yuedu/shuyuan/content/id/7285.html')

assert.equal(
  createSourceMarketUrl({ provider: 'yckceo', keyword: '书趣阁' }),
  'https://www.yckceo.com/yuedu/shuyuan/index.html?key=%E4%B9%A6%E8%B6%A3%E9%98%81'
)

assert.deepEqual(resolveMarketScanTarget('https://www.yckceo.com/yuedu/shuyuan/content/id/7285.html'), {
  type: 'detail',
  url: 'https://www.yckceo.com/yuedu/shuyuan/content/id/7285.html'
})
assert.deepEqual(resolveMarketScanTarget('https://www.yckceo.com/yuedu/shuyuan/json/id/7285.json'), {
  type: 'json',
  url: 'https://www.yckceo.com/yuedu/shuyuan/json/id/7285.json'
})
assert.deepEqual(resolveMarketScanTarget('https://www.yckceo.com/yuedu/shuyuan/index.html'), {
  type: 'market',
  url: 'https://www.yckceo.com/yuedu/shuyuan/index.html'
})

const requested = []
globalThis.fetch = async url => {
  requested.push(String(url))
  return {
    text: async () => String(url).includes('/json/id/7285.json')
      ? JSON.stringify({
        bookSourceName: '小说狂人czbooks.net',
        bookSourceGroup: 'GPT制作书源',
        bookSourceUrl: 'https://czbooks.net',
        searchUrl: 'https://czbooks.net/search?q={{key}}'
      })
      : '<input id="jsonurl" value="https://www.yckceo.com/yuedu/shuyuan/json/id/7285.json">'
  }
}

const preview = await fetchMarketSourcePreview('https://www.yckceo.com/yuedu/shuyuan/content/id/7285.html')
assert.equal(preview.source.name, '小说狂人czbooks.net')
assert.equal(preview.source.group, 'GPT制作书源')
assert.equal(preview.jsonUrl, 'https://www.yckceo.com/yuedu/shuyuan/json/id/7285.json')
assert.ok(requested.some(url => url.includes('/json/id/7285.json')))

globalThis.fetch = async () => ({ text: async () => listHtml })
const fetchedItems = await fetchSourceMarketItems({ provider: 'yckceo', keyword: '小说' })
assert.equal(fetchedItems.length, 2)

console.log('sourceMarket tests passed')
