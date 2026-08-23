import assert from 'node:assert/strict'

const store = {}
globalThis.uni = {
  getStorageSync(key) { return store[key] },
  setStorageSync(key, value) { store[key] = value },
  request(options) {
    options.success({
      statusCode: 200,
      data: {
        text: '<div class="bookbox"><div class="bookname"><a href="/book/1">剑来</a></div><div class="author">烽火戏诸侯</div></div>',
        status_code: 200,
        final_url: String(options.data && options.data.url || '')
      }
    })
  }
}

const { getSourceConfigs, importSourcesFromAny, searchSourceBooks } = await import('../common/bookSources.js')
await importSourcesFromAny(JSON.stringify({
  bookSourceName: '可选元数据安全降级',
  bookSourceUrl: 'https://optional.example.com',
  searchUrl: '/search?q={{key}}',
  ruleSearch: {
    bookList: '.bookbox',
    name: '.bookname a@text',
    bookUrl: '.bookname a@href',
    author: '.author@text',
    coverUrl: '##book/(\\d+)##$1###@js:Math.floor(result/1000)'
  },
  ruleBookInfo: { name: 'h1@text', tocUrl: '.toc@href' },
  ruleToc: { chapterList: 'a', chapterName: '@text', chapterUrl: '@href' },
  ruleContent: { content: '#content@text' }
}))
const source = getSourceConfigs().find(item => item.name === '可选元数据安全降级')
const result = await searchSourceBooks(source.id, '剑来', { allowDisabled: true, timeoutMs: 1000 })
assert.equal(result.count, 1)
assert.equal(result.results[0].title, '剑来')
assert.equal(result.results[0].book.coverUrl, '')

console.log('sourceOptionalMetadata tests passed')
