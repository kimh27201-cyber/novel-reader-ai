import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const store = {}
const requestedUrls = []

globalThis.uni = {
  getStorageSync(key) {
    return store[key]
  },
  setStorageSync(key, value) {
    store[key] = value
  },
  removeStorageSync(key) {
    delete store[key]
  }
}

globalThis.fetch = async rawUrl => {
  const url = String(rawUrl)
  requestedUrls.push(url)
  if (url.includes('/search')) {
    return {
      text: async () => JSON.stringify({
        items: [{
          name: 'Performance Book',
          author: 'Performance Author',
          latest: 'Chapter 2',
          url: '/book/performance'
        }]
      })
    }
  }
  if (url.endsWith('/book/performance')) {
    return {
      text: async () => JSON.stringify({
        name: 'Performance Book',
        author: 'Performance Author',
        intro: 'A book for cache testing',
        tocUrl: '/book/performance/toc',
        cover: '/cover/performance.jpg'
      })
    }
  }
  if (url.endsWith('/book/performance/toc')) {
    return {
      text: async () => JSON.stringify({
        chapters: [
          { title: 'Chapter 1', url: '/book/performance/1' },
          { title: 'Chapter 2', url: '/book/performance/2' }
        ]
      })
    }
  }
  if (url.endsWith('/book/performance/1')) {
    return {
      text: async () => JSON.stringify({
        content: 'Performance chapter content\nSecond paragraph'
      })
    }
  }
  throw new Error(`unexpected url ${url}`)
}

const {
  clearOnlineChapterCache,
  clearOnlineDataCache,
  getOnlineDataCacheSettings,
  getOnlineDataCacheStats,
  getSourceConfigs,
  importSourcesFromAny,
  loadOnlineBookInfo,
  loadOnlineChapter,
  loadOnlineToc,
  saveChapterCacheSettings,
  saveOnlineDataCacheSettings,
  searchOnlineBooks
} = await import('../common/bookSources.js')

await importSourcesFromAny(JSON.stringify([{
  bookSourceName: 'Performance Source',
  bookSourceUrl: 'https://performance.example.com',
  bookSourceGroup: 'Performance',
  searchUrl: 'https://performance.example.com/search?keyword={{key}}',
  ruleSearch: {
    bookList: '$.items[*]',
    name: '$.name',
    author: '$.author',
    latestChapter: '$.latest',
    bookUrl: '$.url'
  },
  ruleBookInfo: {
    name: '$.name',
    author: '$.author',
    intro: '$.intro',
    tocUrl: '$.tocUrl',
    coverUrl: '$.cover'
  },
  ruleToc: {
    chapterList: '$.chapters[*]',
    chapterName: '$.title',
    chapterUrl: '$.url'
  },
  ruleContent: {
    content: '$.content'
  }
}]))

const source = getSourceConfigs().find(item => item.name === 'Performance Source')
store['sources:settings'] = {
  [source.id]: {
    lastTest: {
      status: 'passed',
      testedAt: Date.now(),
      keyword: 'performance',
      count: 1,
      message: ''
    }
  }
}

assert.deepEqual(getOnlineDataCacheSettings(), {
  searchTtlMs: 10 * 60 * 1000,
  detailTtlMs: 30 * 60 * 1000,
  tocTtlMs: 6 * 60 * 60 * 1000,
  maxEntries: 80
})

saveOnlineDataCacheSettings({
  searchTtlMs: 600000,
  detailTtlMs: 1800000,
  tocTtlMs: 21600000,
  maxEntries: 80
})
clearOnlineDataCache()

const searchHits = []
const firstSearch = await searchOnlineBooks('performance', {
  sourceLimit: 1,
  timeoutMs: 3000,
  onCacheHit: hit => searchHits.push(hit)
})
assert.equal(firstSearch.length, 1)
assert.equal(requestedUrls.filter(url => url.includes('/search')).length, 1)

const secondSearch = await searchOnlineBooks('performance', {
  sourceLimit: 1,
  timeoutMs: 3000,
  onCacheHit: hit => searchHits.push(hit)
})
assert.equal(secondSearch.length, 1)
assert.equal(requestedUrls.filter(url => url.includes('/search')).length, 1)
assert.equal(searchHits.some(hit => hit.scope === 'search'), true)

await searchOnlineBooks('performance', {
  sourceLimit: 1,
  timeoutMs: 3000,
  forceRefresh: true
})
assert.equal(requestedUrls.filter(url => url.includes('/search')).length, 2)

const detailHits = []
const info = await loadOnlineBookInfo(firstSearch[0].book, {
  onCacheHit: hit => detailHits.push(hit)
})
assert.equal(requestedUrls.filter(url => url.endsWith('/book/performance')).length, 1)
const cachedInfo = await loadOnlineBookInfo(firstSearch[0].book, {
  onCacheHit: hit => detailHits.push(hit)
})
assert.equal(cachedInfo.intro, 'A book for cache testing')
assert.equal(requestedUrls.filter(url => url.endsWith('/book/performance')).length, 1)
assert.equal(detailHits.some(hit => hit.scope === 'detail'), true)

const tocHits = []
const chapters = await loadOnlineToc(info, {
  onCacheHit: hit => tocHits.push(hit)
})
assert.equal(chapters.length, 2)
assert.equal(requestedUrls.filter(url => url.endsWith('/book/performance/toc')).length, 1)
const cachedChapters = await loadOnlineToc(info, {
  onCacheHit: hit => tocHits.push(hit)
})
assert.equal(cachedChapters.length, 2)
assert.equal(requestedUrls.filter(url => url.endsWith('/book/performance/toc')).length, 1)
assert.equal(tocHits.some(hit => hit.scope === 'toc'), true)

saveOnlineDataCacheSettings({
  searchTtlMs: 1,
  detailTtlMs: 1,
  tocTtlMs: 1,
  maxEntries: 80
})
clearOnlineDataCache('search')
await searchOnlineBooks('expired', { sourceLimit: 1, timeoutMs: 3000 })
const beforeExpirySearchRequests = requestedUrls.filter(url => url.includes('/search')).length
await new Promise(resolve => setTimeout(resolve, 5))
await searchOnlineBooks('expired', { sourceLimit: 1, timeoutMs: 3000 })
assert.equal(requestedUrls.filter(url => url.includes('/search')).length, beforeExpirySearchRequests + 1)

const stats = getOnlineDataCacheStats()
assert.equal(stats.total <= 80, true)
assert.equal(typeof stats.search, 'number')
assert.equal(typeof stats.detail, 'number')
assert.equal(typeof stats.toc, 'number')

saveChapterCacheSettings({ preloadCount: 0, maxChapters: 5, offlineMode: false })
clearOnlineChapterCache()
const loadedChapter = await loadOnlineChapter(info, chapters[0], { autoPreload: false })
assert.equal(loadedChapter.loadStatus, 'loaded')
const beforeOfflineRequests = requestedUrls.length
saveChapterCacheSettings({ offlineMode: true })
const cachedChapter = await loadOnlineChapter(info, chapters[0], { autoPreload: false })
assert.equal(cachedChapter.loadStatus, 'cached')
assert.equal(requestedUrls.length, beforeOfflineRequests)

const bookshelf = readFileSync(new URL('../pages/bookshelf/bookshelf.vue', import.meta.url), 'utf8')
assert.match(bookshelf, /visibleBooks/)
assert.match(bookshelf, /@scrolltolower="loadMoreBooks"/)
assert.match(bookshelf, /lazy-load/)

const sourceBook = readFileSync(new URL('../pages/sourceBook/sourceBook.vue', import.meta.url), 'utf8')
assert.match(sourceBook, /visibleChapters/)
assert.match(sourceBook, /@scrolltolower="loadMoreChapters"/)
assert.match(sourceBook, /lazy-load/)

const reader = readFileSync(new URL('../pages/reader/reader.vue', import.meta.url), 'utf8')
assert.match(reader, /visibleCatalogChapters/)
assert.match(reader, /@scrolltolower="loadMoreCatalogChapters"/)

const searchPage = readFileSync(new URL('../pages/search/search.vue', import.meta.url), 'utf8')
assert.match(searchPage, /lazy-load/)

console.log('performanceOptimization tests passed')
