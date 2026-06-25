import assert from 'node:assert/strict'
import {
  backendBookId,
  backendChapterId,
  ensureBackendToken,
  isBackendBookId,
  addBackendBookWithChapters,
  syncBackendSourceFromLocal,
  listBackendBooks,
  loadBackendSourceContent,
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

  assert.deepEqual(toBackendBookPayload({
    title: 'Local Source Book',
    author: 'Author',
    bookUrl: 'https://book',
    tocUrl: 'https://toc',
    sourceId: 'source-user-local'
  }), {
    title: 'Local Source Book',
    author: 'Author',
    cover_url: '',
    description: '',
    book_url: 'https://book',
    toc_url: 'https://toc',
    source_id: null
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

async function testListBackendBooksAcceptsWrappedBackendResponse() {
  const calls = []
  const books = await listBackendBooks({
    getToken: () => 'token',
    listBooks: async () => ({
      books: [{
        id: 7,
        title: 'Wrapped Book',
        author: 'Author',
        cover_url: '',
        description: '',
        book_url: 'https://book',
        toc_url: '',
        source_id: 1
      }]
    }),
    listChapters: async bookId => {
      calls.push(bookId)
      return []
    }
  })

  assert.equal(books.length, 1)
  assert.equal(books[0].id, 'backend:7')
  assert.deepEqual(calls, [7])
}

async function testLoadBackendSourceContentWritesResolvedContentBackToChapter() {
  const calls = []
  const content = await loadBackendSourceContent({
    sourceId: 5
  }, {
    backendId: 12,
    url: 'https://chapter'
  }, {
    getToken: () => 'token',
    loadSourceContent: async (sourceId, payload) => {
      calls.push(['load', sourceId, payload.chapterUrl])
      return { content: '解析后的正文' }
    },
    updateChapterContent: async (chapterId, contentValue) => {
      calls.push(['update', chapterId, contentValue])
      return { id: chapterId, content: contentValue, is_cached: true }
    }
  })

  assert.equal(content, '解析后的正文')
  assert.deepEqual(calls, [
    ['load', 5, 'https://chapter'],
    ['update', 12, '解析后的正文']
  ])
}

async function testAddBackendBookWithChaptersPreflightsFirstChapterBeforeCreatingBook() {
  let createBookCalled = false
  await assert.rejects(() => addBackendBookWithChapters({
    sourceId: 8,
    title: 'Book',
    author: 'Author',
    bookUrl: 'https://book'
  }, [{
    index: 0,
    title: 'Chapter 1',
    url: 'https://chapter'
  }], {
    getToken: () => 'token',
    loadSourceContent: async () => {
      throw new Error('正文解析为空')
    },
    createBook: async () => {
      createBookCalled = true
      return { id: 1 }
    }
  }), /正文解析为空/)
  assert.equal(createBookCalled, false)
}

async function testSyncBackendSourceFromLocalImportsRawSourceAndReturnsBackendId() {
  const calls = []
  const source = await syncBackendSourceFromLocal({
    name: '速读谷',
    baseUrl: 'https://www.sudugu.org',
    raw: {
      bookSourceName: '速读谷',
      bookSourceUrl: 'https://www.sudugu.org'
    }
  }, {
    getToken: () => 'token',
    importSources: async content => {
      calls.push(JSON.parse(content).bookSourceName)
      return {
        imported_count: 1,
        sources: [{
          id: 9,
          name: '速读谷',
          base_url: 'https://www.sudugu.org',
          group: '用户源',
          enabled: true,
          compatibility: 'v1 compatible'
        }]
      }
    }
  })

  assert.deepEqual(calls, ['速读谷'])
  assert.equal(source.backendId, 9)
}

testBackendIds()
testMappingBackendBookAndChapter()
testPayloads()
testSourceMappingAndAuthGuard()
await testListBackendBooksAcceptsWrappedBackendResponse()
await testLoadBackendSourceContentWritesResolvedContentBackToChapter()
await testAddBackendBookWithChaptersPreflightsFirstChapterBeforeCreatingBook()
await testSyncBackendSourceFromLocalImportsRawSourceAndReturnsBackendId()

console.log('backendLibrary tests passed')
