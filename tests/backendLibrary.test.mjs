import assert from 'node:assert/strict'
import {
  backendBookId,
  backendChapterId,
  ensureBackendToken,
  isBackendBookId,
  mapBackendBook,
  mapBackendChapter,
  mapBackendSource,
  mapSourceBookResult,
  toBackendBookId,
  toBackendBookPayload,
  toBackendChapterPayload,
  toReadingHistoryPayload
} from '../common/backendLibrary.js'

function testBackendIds() {
  assert.equal(toBackendBookId(42), 'backend:42')
  assert.equal(isBackendBookId('backend:42'), true)
  assert.equal(isBackendBookId('local-42'), false)
  assert.equal(backendBookId('backend:42'), 42)
  assert.equal(backendBookId({ backendId: 7 }), 7)
  assert.equal(backendChapterId({ backendId: 9 }), 9)
}

function testMappingBackendBookAndChapter() {
  const book = mapBackendBook({
    id: 42,
    title: 'Star Library',
    author: 'Reader',
    cover_url: 'https://img',
    description: 'Desc',
    book_url: 'https://book',
    toc_url: 'https://toc',
    source_id: 5
  }, [{
    id: 99,
    chapter_index: 0,
    title: 'Chapter 1',
    url: 'https://chapter',
    content: 'Body',
    is_cached: true
  }])

  assert.equal(book.id, 'backend:42')
  assert.equal(book.backendId, 42)
  assert.equal(book.source, 'backend')
  assert.equal(book.coverUrl, 'https://img')
  assert.equal(book.bookUrl, 'https://book')
  assert.equal(book.tocUrl, 'https://toc')
  assert.equal(book.chapters[0].id, 'backend-chapter:99')
  assert.equal(book.chapters[0].backendId, 99)
  assert.equal(book.chapters[0].chapterIndex, 0)

  const chapter = mapBackendChapter({ id: 4, chapter_index: 2, title: 'C', url: 'u', content: '', is_cached: false })
  assert.deepEqual(chapter, {
    id: 'backend-chapter:4',
    backendId: 4,
    chapterIndex: 2,
    title: 'C',
    url: 'u',
    content: '',
    isCached: false
  })
}

function testPayloads() {
  assert.deepEqual(toBackendBookPayload({
    title: 'Book',
    author: 'Author',
    coverUrl: 'cover',
    intro: 'Intro',
    bookUrl: 'book-url',
    tocUrl: 'toc-url',
    sourceId: 3
  }), {
    title: 'Book',
    author: 'Author',
    cover_url: 'cover',
    description: 'Intro',
    book_url: 'book-url',
    toc_url: 'toc-url',
    source_id: 3
  })

  assert.deepEqual(toBackendChapterPayload({
    index: 1,
    title: 'Chapter',
    url: 'chapter-url',
    content: 'Body',
    isCached: true
  }), {
    chapter_index: 1,
    title: 'Chapter',
    url: 'chapter-url',
    content: 'Body',
    is_cached: true
  })

  assert.deepEqual(toReadingHistoryPayload({
    book: { backendId: 42 },
    chapter: { backendId: 99 },
    chapterIndex: 2,
    pageIndex: 4,
    progressPercent: 73
  }), {
    book_id: 42,
    chapter_id: 99,
    chapter_index: 2,
    page_index: 4,
    progress_percent: 73
  })
}

function testSourceMappingAndAuthGuard() {
  assert.deepEqual(mapBackendSource({
    id: 5,
    name: 'Demo',
    base_url: 'https://demo',
    group: 'Group',
    enabled: true,
    compatibility: 'v1'
  }), {
    id: 'backend-source:5',
    backendId: 5,
    name: 'Demo',
    baseUrl: 'https://demo',
    group: 'Group',
    enabled: true,
    compatibility: 'v1',
    source: 'backend'
  })

  assert.deepEqual(mapSourceBookResult({
    title: 'Book',
    author: 'Author',
    book_url: 'https://book',
    source_id: 5,
    source_name: 'Demo',
    latest_chapter: 'Latest',
    intro: 'Intro',
    cover_url: 'Cover'
  }), {
    type: 'backend-online',
    title: 'Book',
    author: 'Author',
    bookUrl: 'https://book',
    sourceId: 5,
    sourceName: 'Demo',
    latestChapter: 'Latest',
    intro: 'Intro',
    coverUrl: 'Cover',
    subtitle: 'Author · Demo',
    snippet: 'Intro'
  })

  assert.throws(() => ensureBackendToken({ getToken: () => '' }), /请先登录后端/)
}

testBackendIds()
testMappingBackendBookAndChapter()
testPayloads()
testSourceMappingAndAuthGuard()

console.log('backendLibrary tests passed')
