import assert from 'node:assert/strict'

const store = {}
globalThis.uni = {
  getStorageSync(key) { return store[key] },
  setStorageSync(key, value) { store[key] = value }
}

const {
  assessReadableContentQuality,
  CONTENT_SANITIZER_VERSION,
  importSourcesWithStats,
  loadOnlineChapter,
  sanitizeReadableContent,
  searchSourceBooks
} = await import('../common/bookSources.js')

const cleaned = sanitizeReadableContent(`
  <style>.reader{display:none}</style>
  <script>track();</script>
  <!-- hidden -->
  <p>第一段正文（保留括号）和 English dialogue。</p>
  chap_tp(); theme();

  <p>第二段正文。</p>
  <p>第二段正文。</p>
`)
assert.doesNotMatch(cleaned.text, /track|chap_tp|theme|display:none/)
assert.match(cleaned.text, /第一段正文（保留括号）和 English dialogue。/)
assert.equal(cleaned.text.match(/第二段正文。/g).length, 1)
assert.equal(assessReadableContentQuality('短章').status, 'short')
assert.equal(assessReadableContentQuality('短章').readable, true)
assert.equal(assessReadableContentQuality('<script>only();</script>').errorCode, 'CONTENT_EMPTY')

const source = importSourcesWithStats(JSON.stringify({
  bookSourceName: 'Cache sanitizer source',
  bookSourceUrl: 'https://cache-sanitizer.example',
  searchUrl: '/search?q={{key}}',
  ruleSearch: { bookList: '$.items[*]', name: '$.name', bookUrl: '$.url' },
  ruleToc: { chapterList: '$.chapters[*]', chapterName: '$.title', chapterUrl: '$.url' },
  ruleContent: { content: '$.content' }
})).importedSources[0]

globalThis.fetch = async url => ({
  ok: true,
  status: 200,
  url: String(url),
  headers: new Headers({ 'Content-Type': 'application/json' }),
  text: async () => JSON.stringify({ items: [{ name: '缓存书', url: '/book/1' }] })
})
const searched = await searchSourceBooks(source.id, '缓存', { failOnEmpty: true, limit: 1 })
const book = searched.results[0].book
store[`sources:chapter:${book.id}:0`] = '<p>缓存正文。</p>\nchap_tp(); theme();'
store['sources:chapter-cache-meta'] = {
  [`${book.id}:0`]: { bookId: book.id, chapterIndex: 0, chapterTitle: '第一章', sanitizerVersion: 0 }
}
const cached = await loadOnlineChapter(book, { title: '第一章', url: '/chapter/1', index: 0 })
assert.equal(cached.content, '缓存正文。')
assert.equal(store['sources:chapter-cache-meta'][`${book.id}:0`].sanitizerVersion, CONTENT_SANITIZER_VERSION)
assert.equal(store['sources:chapter-cache-meta'][`${book.id}:0`].cleanedChars, '缓存正文。'.length)

delete globalThis.fetch
delete globalThis.uni
console.log('sourceContentSanitizer tests passed')
