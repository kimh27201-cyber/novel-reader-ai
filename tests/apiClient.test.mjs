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

async function testUnauthorizedClearsToken() {
  const { client } = createClient(() => ({
    statusCode: 401,
    data: { detail: 'Invalid authentication token' }
  }))
  client.setToken('expired')

  await assert.rejects(() => client.getMe(), /Invalid authentication token/)
  assert.equal(client.getToken(), '')
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
await testUnauthorizedClearsToken()
await testPromiseRequestAdapterIsSupported()

console.log('apiClient tests passed')
