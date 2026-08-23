import assert from 'node:assert/strict'

const store = {}
globalThis.uni = {
  getStorageSync(key) { return store[key] },
  setStorageSync(key, value) { store[key] = value },
  request(options) {
    const requestUrl = String(options.data && options.data.url || '')
    if (requestUrl.includes('detail-fallback.example.com')) {
      options.success({
        statusCode: 200,
        data: {
          text: `
            <html><head>
              <meta property="og:novel:book_name" content="斗破苍穹">
              <link rel="canonical" href="https://detail-fallback.example.com/book/7">
            </head><body><h1>斗破苍穹</h1></body></html>
          `,
          status_code: 200,
          final_url: requestUrl
        }
      })
      return
    }
    if (requestUrl.includes('external-detail.example.com')) {
      options.success({
        statusCode: 200,
        data: {
          text: '<meta property="og:title" content="斗破苍穹"><link rel="canonical" href="https://outside.example/book/7">',
          status_code: 200,
          final_url: requestUrl
        }
      })
      return
    }
    if (requestUrl.includes('routed-detail.example.com')) {
      options.success({
        statusCode: 200,
        data: {
          text: '<section class="book-hd"><h1>诡秘之主</h1></section>',
          status_code: 200,
          final_url: requestUrl
        }
      })
      return
    }
    options.success({
      statusCode: 200,
      data: {
        text: `
          <div class="new-result"><a href="/book/42"><h2>剑来</h2></a></div>
          <nav><a href="/search?q=剑来">搜索剑来</a></nav>
          <a href="https://outside.example/book/1">剑来外站链接</a>
        `,
        status_code: 200,
        final_url: requestUrl
      }
    })
  }
}

const { getSourceConfigs, importSourcesFromAny, searchSourceBooks } = await import('../common/bookSources.js')
await importSourcesFromAny(JSON.stringify({
  bookSourceName: '关键词同域降级',
  bookSourceUrl: 'https://fallback.example.com',
  searchUrl: '/search?q={{key}}',
  ruleSearch: {
    bookList: '.old-result',
    name: 'h3@text',
    bookUrl: 'h3 a@href'
  },
  ruleBookInfo: { name: 'h1@text', tocUrl: '.toc@href' },
  ruleToc: { chapterList: 'a', chapterName: '@text', chapterUrl: '@href' },
  ruleContent: { content: '#content@text' }
}))
const source = getSourceConfigs().find(item => item.name === '关键词同域降级')
const result = await searchSourceBooks(source.id, '剑来', { allowDisabled: true, timeoutMs: 1000 })
assert.equal(result.count, 1)
assert.equal(result.results[0].title, '剑来')
assert.equal(result.results[0].book.bookUrl, 'https://fallback.example.com/book/42')
assert.equal(result.results[0].metadataOrigin, 'same_origin_keyword_fallback')

for (const [name, baseUrl] of [
  ['详情元数据降级', 'https://detail-fallback.example.com'],
  ['跨域详情拒绝', 'https://external-detail.example.com'],
  ['搜索跳转详情降级', 'https://routed-detail.example.com']
]) {
  await importSourcesFromAny(JSON.stringify({
    bookSourceName: name,
    bookSourceUrl: baseUrl,
    searchUrl: '/search?q={{key}}',
    ruleSearch: { bookList: '.missing', name: 'h3@text', bookUrl: 'h3 a@href' },
    ruleBookInfo: { name: 'h1@text', tocUrl: '.toc@href' },
    ruleToc: { chapterList: 'a', chapterName: '@text', chapterUrl: '@href' },
    ruleContent: { content: '#content@text' }
  }))
}

const detailSource = getSourceConfigs().find(item => item.name === '详情元数据降级')
const detailResult = await searchSourceBooks(detailSource.id, '斗破苍穹', { allowDisabled: true, timeoutMs: 1000 })
assert.equal(detailResult.count, 1)
assert.equal(detailResult.results[0].metadataOrigin, 'same_origin_detail_fallback')
assert.equal(detailResult.results[0].book.bookUrl, 'https://detail-fallback.example.com/book/7')

const externalSource = getSourceConfigs().find(item => item.name === '跨域详情拒绝')
const externalResult = await searchSourceBooks(externalSource.id, '斗破苍穹', { allowDisabled: true, timeoutMs: 1000 })
assert.equal(externalResult.count, 0)

const routedSource = getSourceConfigs().find(item => item.name === '搜索跳转详情降级')
const routedResult = await searchSourceBooks(routedSource.id, '诡秘之主', { allowDisabled: true, timeoutMs: 1000 })
assert.equal(routedResult.count, 1)
assert.equal(routedResult.results[0].metadataOrigin, 'same_origin_detail_fallback')
assert.match(routedResult.results[0].book.bookUrl, /^https:\/\/routed-detail\.example\.com\/search\?q=/)

console.log('sourceSearchKeywordFallback tests passed')
