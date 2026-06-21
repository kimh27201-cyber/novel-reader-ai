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
  }
}

globalThis.fetch = async rawUrl => {
  const url = String(rawUrl)
  requestedUrls.push(url)
  if (url.includes('/search')) {
    return {
      text: async () => JSON.stringify({
        items: [{
          name: 'Cache Book',
          author: 'Cache Author',
          url: '/book/cache'
        }]
      })
    }
  }
  if (url.endsWith('/book/cache')) {
    return {
      text: async () => JSON.stringify({
        name: 'Cache Book',
        author: 'Cache Author',
        tocUrl: '/book/cache/toc'
      })
    }
  }
  if (url.endsWith('/book/cache/toc')) {
    return {
      text: async () => JSON.stringify({
        chapters: [
          { title: 'Chapter 1', url: '/book/cache/1' },
          { title: 'Chapter 2', url: '/book/cache/2' },
          { title: 'Chapter 3', url: '/book/cache/3' },
          { title: 'Chapter 4', url: '/book/cache/4' }
        ]
      })
    }
  }
  const chapter = url.match(/\/book\/cache\/(\d+)$/)
  if (chapter) {
    return {
      text: async () => JSON.stringify({
        content: `Cache content chapter ${chapter[1]}\nSecond paragraph ${chapter[1]}`
      })
    }
  }
  throw new Error(`unexpected url ${url}`)
}

const {
  addOnlineBookToShelf,
  clearOnlineChapterCache,
  exportOnlineBookTxt,
  getChapterCacheSettings,
  getOnlineChapterCacheStats,
  getOnlineShelfBooks,
  getSourceConfigs,
  importSourcesFromAny,
  loadOnlineBookInfo,
  loadOnlineChapter,
  loadOnlineToc,
  preloadOnlineChapters,
  saveChapterCacheSettings,
  searchOnlineBooks,
  testSourceSearch
} = await import('../common/bookSources.js')

await importSourcesFromAny(JSON.stringify([{
  bookSourceName: 'Cache Source',
  bookSourceUrl: 'https://cache.example.com',
  searchUrl: 'https://cache.example.com/search?keyword={{key}}',
  ruleSearch: {
    bookList: '$.items[*]',
    name: '$.name',
    author: '$.author',
    bookUrl: '$.url'
  },
  ruleBookInfo: {
    name: '$.name',
    author: '$.author',
    tocUrl: '$.tocUrl'
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

const defaults = getChapterCacheSettings()
assert.equal(defaults.preloadCount, 1)
assert.equal(defaults.maxChapters, 120)
assert.equal(defaults.offlineMode, false)

const settings = saveChapterCacheSettings({
  preloadCount: 2,
  maxChapters: 3,
  offlineMode: false
})
assert.deepEqual(settings, {
  preloadCount: 2,
  maxChapters: 3,
  offlineMode: false
})

assert.equal(getOnlineShelfBooks().length, 0)

const source = getSourceConfigs().find(item => item.name === 'Cache Source')
const searchReady = await testSourceSearch(source.id, 'cache', { timeoutMs: 2000, failOnEmpty: true })
assert.equal(searchReady.count, 1)

const [result] = await searchOnlineBooks('cache', { sourceLimit: 1, timeoutMs: 2000 })
const info = await loadOnlineBookInfo(result.book)
const chapters = await loadOnlineToc(info)
let book = addOnlineBookToShelf({ ...info, chapters })

const loaded = await loadOnlineChapter(book, chapters[0], { autoPreload: true })
assert.equal(loaded.loadStatus, 'loaded')

book = getOnlineShelfBooks().find(item => item.id === book.id)
assert.equal(book.chapters[0].isCached, true)
assert.equal(book.chapters[1].isCached, true)
assert.equal(book.chapters[2].isCached, true)

const preload = await preloadOnlineChapters(book, 2, { count: 2 })
assert.equal(preload.loaded >= 1, true)

const stats = getOnlineChapterCacheStats(book.id)
assert.equal(stats.cachedChapters <= 3, true)
assert.equal(stats.books >= 1, true)
assert.equal(stats.totalChars > 0, true)

const beforeOfflineRequests = requestedUrls.length
saveChapterCacheSettings({ offlineMode: true, preloadCount: 2, maxChapters: 3 })
const cachedChapter = await loadOnlineChapter(book, { ...chapters[0], content: '' })
assert.equal(cachedChapter.loadStatus, 'cached')
await assert.rejects(
  () => loadOnlineChapter(book, { ...chapters[3], content: '', isCached: false }),
  /离线模式|缓存/
)
assert.equal(requestedUrls.length, beforeOfflineRequests)

const exported = exportOnlineBookTxt(book.id)
assert.match(exported.fileName, /Cache Book\.txt/)
assert.match(exported.text, /Cache Book/)
assert.match(exported.text, /Chapter 1/)
assert.match(exported.text, /Cache content chapter/)

const cleared = clearOnlineChapterCache(book.id)
assert.equal(cleared.removed > 0, true)
assert.equal(getOnlineChapterCacheStats(book.id).cachedChapters, 0)

const reader = readFileSync(new URL('../pages/reader/reader.vue', import.meta.url), 'utf8')
assert.match(reader, /preloadOnlineChapters/)
assert.match(reader, /autoPreload/)

const sourceBook = readFileSync(new URL('../pages/sourceBook/sourceBook.vue', import.meta.url), 'utf8')
assert.match(sourceBook, /cacheStats/)
assert.match(sourceBook, /exportOnlineBookTxt/)
assert.match(sourceBook, /offlineMode/)

console.log('onlineChapterCacheStrategy tests passed')
