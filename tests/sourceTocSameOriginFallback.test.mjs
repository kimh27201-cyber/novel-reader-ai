import assert from 'node:assert/strict'

const store = {}
globalThis.uni = {
  getStorageSync(key) { return store[key] },
  setStorageSync(key, value) { store[key] = value },
  request(options) {
    const requestUrl = String(options.data && options.data.url || '')
    options.success({
      statusCode: 200,
      data: {
        text: `
          <main class="new-catalog">
            <a href="/chapter/1">第一章 开始</a>
            <a href="/chapter/2">第二章 远行</a>
            <a href="/chapter/3">第三章 归来</a>
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

const { getSourceConfigs, importSourcesFromAny, loadOnlineToc } = await import('../common/bookSources.js')
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
assert.deepEqual(chapters.map(item => item.title), ['第一章 开始', '第二章 远行', '第三章 归来'])
assert.ok(chapters.every(item => item.url.startsWith('https://toc-fallback.example.com/')))
assert.ok(chapters.every(item => item.metadataOrigin === 'same_origin_chapter_fallback'))

console.log('sourceTocSameOriginFallback tests passed')
