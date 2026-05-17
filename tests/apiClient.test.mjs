import assert from 'node:assert/strict'
import { createApiClient } from '../common/apiClient.js'

function createStorage() {
  const values = new Map()
  return {
    getStorageSync(key) {
      return values.get(key) || ''
    },
    setStorageSync(key, value) {
      values.set(key, value)
    },
    removeStorageSync(key) {
      values.delete(key)
    }
  }
}

function createClient(responder) {
  const storage = createStorage()
  const calls = []
  const client = createApiClient({
    ...storage,
    request(options) {
      calls.push(options)
      const response = responder(options)
      options.success(response)
    }
  })
  return { client, calls }
}

function withTimeout(promise, message = 'request timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), 100))
  ])
}

async function testLoginStoresToken() {
  const { client, calls } = createClient(() => ({
    statusCode: 200,
    data: { access_token: 'token-123', token_type: 'bearer' }
  }))

  const result = await client.login('student', 'secret123')

  assert.equal(result.access_token, 'token-123')
  assert.equal(client.getToken(), 'token-123')
  assert.equal(calls[0].url, 'http://127.0.0.1:8000/api/auth/login')
  assert.equal(calls[0].method, 'POST')
  assert.deepEqual(calls[0].data, { username: 'student', password: 'secret123' })
}

async function testAuthorizedRequestUsesBearerToken() {
  const { client, calls } = createClient(() => ({
    statusCode: 200,
    data: { username: 'student' }
  }))
  client.setToken('token-abc')

  await client.getMe()

  assert.equal(calls[0].header.Authorization, 'Bearer token-abc')
  assert.equal(calls[0].url, 'http://127.0.0.1:8000/api/auth/me')
}

async function testSummaryAndChatUseBackendRoutes() {
  const { client, calls } = createClient(() => ({
    statusCode: 201,
    data: { provider: 'mock' }
  }))
  client.setToken('token-abc')

  await client.summarizeChapter({ chapterText: '正文', bookId: null, chapterId: null })
  await client.chatWithAI({ question: '问题', context: '上下文', bookId: null, chapterId: null })

  assert.equal(calls[0].url, 'http://127.0.0.1:8000/api/ai/summary')
  assert.deepEqual(calls[0].data, { chapter_text: '正文', book_id: null, chapter_id: null })
  assert.equal(calls[1].url, 'http://127.0.0.1:8000/api/ai/chat')
  assert.deepEqual(calls[1].data, { question: '问题', context: '上下文', book_id: null, chapter_id: null })
}

async function testAIHistoryRoutesUseFilters() {
  const { client, calls } = createClient(() => ({
    statusCode: 200,
    data: []
  }))
  client.setToken('token-abc')

  await client.listSummaries({ book_id: 12, chapter_id: 34 })
  await client.listChats({ book_id: 12 })

  assert.equal(calls[0].url, 'http://127.0.0.1:8000/api/ai/summaries?book_id=12&chapter_id=34')
  assert.equal(calls[1].url, 'http://127.0.0.1:8000/api/ai/chats?book_id=12')
}

async function testLibraryAndReadingHistoryRoutes() {
  const { client, calls } = createClient(() => ({
    statusCode: 200,
    data: {}
  }))
  client.setToken('token-abc')

  await client.listBooks()
  await client.createBook({ title: 'Book', author: 'Author' })
  await client.getBook(12)
  await client.listChapters(12)
  await client.createChapter(12, { chapter_index: 0, title: 'Start' })
  await client.getChapter(34)
  await client.saveReadingHistory({ book_id: 12, chapter_index: 2, page_index: 3, progress_percent: 50 })
  await client.getReadingHistory(12)

  assert.equal(calls[0].url, 'http://127.0.0.1:8000/api/books')
  assert.equal(calls[1].method, 'POST')
  assert.equal(calls[1].url, 'http://127.0.0.1:8000/api/books')
  assert.deepEqual(calls[1].data, { title: 'Book', author: 'Author' })
  assert.equal(calls[2].url, 'http://127.0.0.1:8000/api/books/12')
  assert.equal(calls[3].url, 'http://127.0.0.1:8000/api/books/12/chapters')
  assert.equal(calls[4].method, 'POST')
  assert.equal(calls[4].url, 'http://127.0.0.1:8000/api/books/12/chapters')
  assert.deepEqual(calls[4].data, { chapter_index: 0, title: 'Start' })
  assert.equal(calls[5].url, 'http://127.0.0.1:8000/api/chapters/34')
  assert.equal(calls[6].method, 'POST')
  assert.equal(calls[6].url, 'http://127.0.0.1:8000/api/reading-history')
  assert.deepEqual(calls[6].data, { book_id: 12, chapter_index: 2, page_index: 3, progress_percent: 50 })
  assert.equal(calls[7].url, 'http://127.0.0.1:8000/api/reading-history?book_id=12')
}

async function testSourceRoutes() {
  const { client, calls } = createClient(() => ({
    statusCode: 200,
    data: {}
  }))
  client.setToken('token-abc')

  await client.listSources()
  await client.importDemoSource()
  await client.importSources('[{}]')
  await client.searchSource(5, { keyword: 'star', page: 2 })
  await client.loadSourceToc(5, { bookUrl: 'https://example.com/book', tocUrl: 'https://example.com/toc' })
  await client.loadSourceContent(5, { chapterUrl: 'https://example.com/chapter' })

  assert.equal(calls[0].url, 'http://127.0.0.1:8000/api/sources')
  assert.equal(calls[1].method, 'POST')
  assert.equal(calls[1].url, 'http://127.0.0.1:8000/api/sources/import-demo')
  assert.equal(calls[2].method, 'POST')
  assert.deepEqual(calls[2].data, { content: '[{}]' })
  assert.equal(calls[3].url, 'http://127.0.0.1:8000/api/sources/5/search')
  assert.deepEqual(calls[3].data, { keyword: 'star', page: 2 })
  assert.equal(calls[4].url, 'http://127.0.0.1:8000/api/sources/5/toc')
  assert.deepEqual(calls[4].data, { book_url: 'https://example.com/book', toc_url: 'https://example.com/toc' })
  assert.equal(calls[5].url, 'http://127.0.0.1:8000/api/sources/5/content')
  assert.deepEqual(calls[5].data, { chapter_url: 'https://example.com/chapter' })
}

async function testUnauthorizedClearsToken() {
  const { client } = createClient(() => ({
    statusCode: 401,
    data: { detail: 'Invalid authentication token' }
  }))
  client.setToken('expired')

  await assert.rejects(() => client.getMe(), /Invalid authentication token/)
  assert.equal(client.getToken(), '')
}

async function testUnifiedErrorMessageIsPreferred() {
  const { client } = createClient(() => ({
    statusCode: 400,
    data: {
      detail: 'legacy detail',
      error: {
        code: 'bad_request',
        message: '统一错误消息',
        request_id: 'request-1'
      }
    }
  }))

  await assert.rejects(() => client.listBooks(), /统一错误消息/)
}

async function testPromiseRequestAdapterIsSupported() {
  const storage = createStorage()
  const client = createApiClient({
    ...storage,
    request() {
      return Promise.resolve({
        statusCode: 200,
        data: { username: 'student' }
      })
    }
  })

  const result = await withTimeout(client.getMe())

  assert.deepEqual(result, { username: 'student' })
}

await testLoginStoresToken()
await testAuthorizedRequestUsesBearerToken()
await testSummaryAndChatUseBackendRoutes()
await testAIHistoryRoutesUseFilters()
await testLibraryAndReadingHistoryRoutes()
await testSourceRoutes()
await testUnauthorizedClearsToken()
await testUnifiedErrorMessageIsPreferred()
await testPromiseRequestAdapterIsSupported()

console.log('apiClient tests passed')
