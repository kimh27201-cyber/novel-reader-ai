import assert from 'node:assert/strict'

const store = {}
globalThis.uni = {
  getStorageSync(key) { return store[key] },
  setStorageSync(key, value) { store[key] = value },
  request(options) {
    const requestUrl = String(options.data && options.data.url || '')
    if (requestUrl.includes('invalid-toc.example.com')) {
      options.success({
        statusCode: 200,
        data: {
          text: '<div class="info"><h1>安全目录降级</h1></div><div class="btns"><a href="/read">阅读</a><a href="javascript:openCatalog()">目录</a><a href="/share">分享</a></div>',
          status_code: 200,
          final_url: requestUrl
        }
      })
      return
    }
    if (requestUrl.includes('invalid-next.example.com')) {
      options.success({
        statusCode: 200,
        data: {
          text: `<article id="content">${'这是一段安全的小说正文。'.repeat(8)}</article><nav class="chapter-page"><a href="javascript:nextPage()">下一页</a></nav>`,
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
          <main class="chapterlist">
            <a href="/chapter/1">序幕</a>
            <a href="/chapter/2">远行</a>
            <a href="/chapter/3">归来</a>
            <a href="https://outside.example/chapter/4">第四章 跨域</a>
            <a href="/rank">排行榜</a>
          </main>
        `,
        status_code: 200,
        final_url: requestUrl
      }
    })
  }
}

const { getSourceConfigs, importSourcesFromAny, loadOnlineBookInfo, loadOnlineChapter, loadOnlineToc } = await import('../common/bookSources.js')
await importSourcesFromAny(JSON.stringify({
  bookSourceName: '同域目录降级',
  bookSourceUrl: 'https://toc-fallback.example.com',
  searchUrl: '/search?q={{key}}',
  ruleSearch: { bookList: '.book', name: 'h3@text', bookUrl: 'a@href' },
  ruleBookInfo: { name: 'h1@text', tocUrl: '.toc@href' },
  ruleToc: { chapterList: '.old-catalog li', chapterName: 'span@text', chapterUrl: 'a@href' },
  ruleContent: { content: '#content@text' }
}))

const source = getSourceConfigs().find(item => item.name === '同域目录降级')
const chapters = await loadOnlineToc({
  id: 'toc-fallback-book',
  sourceId: source.id,
  title: '测试小说',
  bookUrl: 'https://toc-fallback.example.com/book/1',
  tocUrl: 'https://toc-fallback.example.com/catalog/1'
})

assert.equal(chapters.length, 3)
assert.deepEqual(chapters.map(item => item.title), ['序幕', '远行', '归来'])
assert.ok(chapters.every(item => item.url.startsWith('https://toc-fallback.example.com/')))
assert.ok(chapters.every(item => item.metadataOrigin === 'same_origin_chapter_fallback'))

await importSourcesFromAny(JSON.stringify({
  bookSourceName: '非 HTTP 目录降级',
  bookSourceUrl: 'https://invalid-toc.example.com',
  searchUrl: '/search?q={{key}}',
  ruleSearch: { bookList: '.book', name: 'h3@text', bookUrl: 'a@href' },
  ruleBookInfo: { name: '.info h1@text', tocUrl: '.btns a.-2@href' },
  ruleToc: { chapterList: '.chapter-list a', chapterName: '@text', chapterUrl: '@href' },
  ruleContent: { content: '#content@text' }
}))
const invalidTocSource = getSourceConfigs().find(item => item.name === '非 HTTP 目录降级')
const detail = await loadOnlineBookInfo({
  id: 'invalid-toc-book',
  sourceId: invalidTocSource.id,
  title: '安全目录降级',
  bookUrl: 'https://invalid-toc.example.com/book/1'
})
assert.equal(detail.tocUrl, detail.bookUrl)

await importSourcesFromAny(JSON.stringify({
  bookSourceName: '非 HTTP 正文下一页降级',
  bookSourceUrl: 'https://invalid-next.example.com',
  searchUrl: '/search?q={{key}}',
  ruleSearch: { bookList: '.book', name: 'h3@text', bookUrl: 'a@href' },
  ruleBookInfo: { name: 'h1@text' },
  ruleToc: { chapterList: 'a', chapterName: '@text', chapterUrl: '@href' },
  ruleContent: { content: '#content@html', nextContentUrl: '.chapter-page a@href' }
}))
const invalidNextSource = getSourceConfigs().find(item => item.name === '非 HTTP 正文下一页降级')
const loaded = await loadOnlineChapter(
  { id: 'invalid-next-book', sourceId: invalidNextSource.id, title: '测试小说', bookUrl: 'https://invalid-next.example.com/book/1' },
  { index: 0, title: '第一章', url: 'https://invalid-next.example.com/chapter/1' }
)
assert.ok(loaded.content.length >= 50)

console.log('sourceTocSameOriginFallback tests passed')
