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
    data: { access_token: 'token-123', refresh_token: 'refresh-1234567890', token_type: 'bearer' }
  }))

  const result = await client.login('student', 'secret123')

  assert.equal(result.access_token, 'token-123')
  assert.equal(client.getToken(), 'token-123')
  assert.equal(client.getRefreshToken(), 'refresh-1234567890')
  assert.equal(calls[0].url, 'http://127.0.0.1:8000/api/auth/login')
  assert.equal(calls[0].method, 'POST')
  assert.deepEqual(calls[0].data, { username: 'student', password: 'secret123' })
}

async function testLoginParsesStringJsonResponse() {
  const { client } = createClient(() => ({
    statusCode: 200,
    data: '{"access_token":"token-from-string","token_type":"bearer"}'
  }))

  const result = await client.login('student', 'secret123')

  assert.equal(result.access_token, 'token-from-string')
  assert.equal(client.getToken(), 'token-from-string')
}

async function testLoginCanReadTokenFromResponseHeader() {
  const { client } = createClient(() => ({
    statusCode: 200,
    data: {},
    header: { 'X-Access-Token': 'token-from-header' }
  }))

  const result = await client.login('student', 'secret123')

  assert.equal(result.access_token, 'token-from-header')
  assert.equal(client.getToken(), 'token-from-header')
}

async function testAuthorizedRequestUsesBearerToken() {
  const { client, calls } = createClient(() => ({
    statusCode: 200,
    data: { username: 'student' }
  }))
  client.setToken('token-abc')

  await client.getMe()

  assert.equal(calls[0].header.Authorization, 'Bearer token-abc')
  assert.equal(calls[0].header['X-Access-Token'], undefined)
  assert.equal(calls[0].url, 'http://127.0.0.1:8000/api/auth/me')
}

async function testLoginUsesMemoryTokenWhenStorageReadBackFails() {
  const calls = []
  const client = createApiClient({
    getStorageSync(key) {
      return key === 'novelReaderBackendBaseUrl' ? 'http://127.0.0.1:8000' : ''
    },
    setStorageSync() {},
    removeStorageSync() {},
    request(options) {
      calls.push(options)
      if (options.url.endsWith('/api/auth/login')) {
        options.success({
          statusCode: 200,
          data: { access_token: 'token-memory', token_type: 'bearer' }
        })
        return
      }
      options.success({
        statusCode: 200,
        data: { username: 'student' }
      })
    }
  })

  await client.login('student', 'secret123')
  await client.getMe()

  assert.equal(client.getToken(), 'token-memory')
  assert.equal(calls[1].header.Authorization, 'Bearer token-memory')
  assert.equal(calls[1].header['X-Access-Token'], undefined)
  assert.equal(calls[1].url, 'http://127.0.0.1:8000/api/auth/me')
}

async function testDiagnosticsRedactAccessToken() {
  const { client } = createClient(() => ({
    statusCode: 200,
    data: { username: 'student' }
  }))
  client.setToken('token-secret')

  await client.getMe()

  const diagnostics = client.getDiagnostics().filter(item => item.event === 'response')
  assert.equal(diagnostics.length, 1)
  assert.equal(diagnostics[0].statusCode, 200)
  assert.equal(diagnostics[0].sentAccessTokenQuery, false)
  assert.doesNotMatch(diagnostics[0].url, /access_token=/)
  assert.doesNotMatch(diagnostics[0].url, /token-secret/)
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
  await client.listAiCalls({ call_type: 'summary', status_value: 'failed' })

  assert.equal(calls[0].url, 'http://127.0.0.1:8000/api/ai/summaries?book_id=12&chapter_id=34')
  assert.equal(calls[1].url, 'http://127.0.0.1:8000/api/ai/chats?book_id=12')
  assert.equal(calls[2].url, 'http://127.0.0.1:8000/api/ai/calls?call_type=summary&status_value=failed')
}

async function testBaseUrlWhitespaceIsNormalized() {
  const { client, calls } = createClient(() => ({
    statusCode: 200,
    data: { status: 'ok' }
  }))

  assert.equal(client.setBaseUrl(' http://127.0.0.1: 8000/// '), 'http://127.0.0.1:8000')
  await client.healthCheck()

  assert.equal(calls[0].url, 'http://127.0.0.1:8000/api/health')
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
  await client.getSourceSession(5)
  await client.saveSourceSession(5, {
    origin: 'https://example.com',
    cookie: 'sid=abc',
    userAgent: 'NovelReaderTest/1.0',
    referer: 'https://example.com/login'
  })
  await client.deleteSourceSession(5)

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
  assert.equal(calls[6].url, 'http://127.0.0.1:8000/api/sources/5/session')
  assert.equal(calls[7].method, 'PUT')
  assert.equal(calls[7].url, 'http://127.0.0.1:8000/api/sources/5/session')
  assert.deepEqual(calls[7].data, {
    origin: 'https://example.com',
    cookie: 'sid=abc',
    user_agent: 'NovelReaderTest/1.0',
    referer: 'https://example.com/login',
    storage_state_json: '',
    local_storage_json: '',
    session_storage_json: '',
    expires_at: 0,
    last_verified_at: 0,
    status: 'active'
  })
  assert.equal(calls[8].method, 'DELETE')
  assert.equal(calls[8].url, 'http://127.0.0.1:8000/api/sources/5/session')
}

async function testProxyFetchUsesBackendProxyRoute() {
  const { client, calls } = createClient(() => ({
    statusCode: 200,
    data: { text: '<html>ok</html>', status_code: 200, final_url: 'https://example.com/search' }
  }))
  client.setToken('token-abc')

  const result = await client.proxyFetch('https://example.com/search', {
    method: 'POST',
    headers: { Referer: 'https://example.com' },
    body: 'q=星轨',
    charset: 'gbk'
  })

  assert.equal(result.text, '<html>ok</html>')
  assert.equal(calls[0].url, 'http://127.0.0.1:8000/api/proxy/fetch')
  assert.equal(calls[0].method, 'POST')
  assert.deepEqual(calls[0].data, {
    url: 'https://example.com/search',
    method: 'POST',
    headers: { Referer: 'https://example.com' },
    body: 'q=星轨',
    charset: 'gbk',
    throttle_ms: 0
  })
  assert.equal(calls[0].header.Authorization, 'Bearer token-abc')
}

async function testUnauthorizedRefreshesAndRetriesOnce() {
  let meCalls = 0
  const { client, calls } = createClient(options => {
    if (options.url.endsWith('/api/auth/refresh')) {
      return {
        statusCode: 200,
        data: { access_token: 'fresh-access', refresh_token: 'fresh-refresh-token' }
      }
    }
    if (options.url.endsWith('/api/auth/me')) {
      meCalls += 1
      return meCalls === 1
        ? { statusCode: 401, data: { detail: 'expired' } }
        : { statusCode: 200, data: { username: 'student' } }
    }
    throw new Error(`unexpected URL: ${options.url}`)
  })
  client.setTokenPair({ access_token: 'expired-access', refresh_token: 'old-refresh-token' })

  const me = await client.getMe()

  assert.equal(me.username, 'student')
  assert.equal(calls.length, 3)
  assert.deepEqual(calls[1].data, { refresh_token: 'old-refresh-token' })
  assert.equal(calls[1].header.Authorization, undefined)
  assert.equal(calls[2].header.Authorization, 'Bearer fresh-access')
  assert.equal(client.getRefreshToken(), 'fresh-refresh-token')
}

async function testLogoutRevokesAndClearsTokenPair() {
  const { client, calls } = createClient(() => ({ statusCode: 200, data: { revoked: true } }))
  client.setTokenPair({ access_token: 'access', refresh_token: 'refresh-token-value' })

  const result = await client.logout()

  assert.deepEqual(result, { revoked: true })
  assert.equal(calls[0].url, 'http://127.0.0.1:8000/api/auth/logout')
  assert.deepEqual(calls[0].data, { refresh_token: 'refresh-token-value' })
  assert.equal(client.getToken(), '')
  assert.equal(client.getRefreshToken(), '')
}

async function testConcurrentUnauthorizedRequestsShareRefresh() {
  let refreshCalls = 0
  let initialMeCalls = 0
  const { client } = createClient(options => {
    if (options.url.endsWith('/api/auth/refresh')) {
      refreshCalls += 1
      return { statusCode: 200, data: { access_token: 'fresh', refresh_token: 'rotated-refresh' } }
    }
    if (options.header.Authorization === 'Bearer expired') {
      initialMeCalls += 1
      return { statusCode: 401, data: { detail: 'expired' } }
    }
    return { statusCode: 200, data: { username: 'student' } }
  })
  client.setTokenPair({ access_token: 'expired', refresh_token: 'refresh-token' })

  const results = await Promise.all([client.getMe(), client.getMe()])

  assert.equal(initialMeCalls, 2)
  assert.equal(refreshCalls, 1)
  assert.deepEqual(results.map(item => item.username), ['student', 'student'])
}

async function testBackendV2ContractRoutes() {
  const { client, calls } = createClient(() => ({ statusCode: 200, data: {} }))
  client.setToken('token-abc')

  await client.updateBook(12, { title: 'Updated' })
  await client.deleteBook(12)
  await client.updateSource(5, { enabled: false })
  await client.syncPush({ deviceId: 'device-1', mutations: [{ mutation_id: 'mutation-1' }] })
  await client.syncPull({ deviceId: 'device-1', cursor: 8, limit: 20 })
  await client.multiSourceSearch({ keyword: 'star', source_ids: [5] })
  await client.diagnoseSource(5, { keyword: 'star' })
  await client.diagnoseSources({ source_ids: [5] })

  assert.deepEqual(calls.map(call => [call.method, call.url]), [
    ['PATCH', 'http://127.0.0.1:8000/api/books/12'],
    ['DELETE', 'http://127.0.0.1:8000/api/books/12'],
    ['PATCH', 'http://127.0.0.1:8000/api/sources/5'],
    ['POST', 'http://127.0.0.1:8000/api/sync/push'],
    ['GET', 'http://127.0.0.1:8000/api/sync/pull?device_id=device-1&cursor=8&limit=20'],
    ['POST', 'http://127.0.0.1:8000/api/search/books'],
    ['POST', 'http://127.0.0.1:8000/api/sources/5/diagnostics'],
    ['POST', 'http://127.0.0.1:8000/api/sources/diagnostics']
  ])
  assert.deepEqual(calls[3].data, { device_id: 'device-1', mutations: [{ mutation_id: 'mutation-1' }] })
}

async function testTtsContractRoutes() {
  const { client, calls } = createClient(() => ({
    statusCode: 200,
    data: { voices: [] }
  }))
  client.setToken('token-abc')

  await client.listTtsVoices()
  await client.synthesizeTts({
    text: '云端试听文案',
    voiceId: 'loli',
    rate: 1.2
  })

  assert.deepEqual(calls.map(call => [call.method, call.url]), [
    ['GET', 'http://127.0.0.1:8000/api/tts/voices'],
    ['POST', 'http://127.0.0.1:8000/api/tts/synthesize']
  ])
  assert.deepEqual(calls[1].data, {
    text: '云端试听文案',
    voice_id: 'loli',
    rate: 1.2
  })
  assert.equal(calls[1].header.Authorization, 'Bearer token-abc')
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
await testLoginParsesStringJsonResponse()
await testLoginCanReadTokenFromResponseHeader()
await testBaseUrlWhitespaceIsNormalized()
await testAuthorizedRequestUsesBearerToken()
await testLoginUsesMemoryTokenWhenStorageReadBackFails()
await testDiagnosticsRedactAccessToken()
await testSummaryAndChatUseBackendRoutes()
await testAIHistoryRoutesUseFilters()
await testLibraryAndReadingHistoryRoutes()
await testSourceRoutes()
await testProxyFetchUsesBackendProxyRoute()
await testUnauthorizedRefreshesAndRetriesOnce()
await testLogoutRevokesAndClearsTokenPair()
await testConcurrentUnauthorizedRequestsShareRefresh()
await testBackendV2ContractRoutes()
await testTtsContractRoutes()
await testUnauthorizedClearsToken()
await testUnifiedErrorMessageIsPreferred()
await testPromiseRequestAdapterIsSupported()

console.log('apiClient tests passed')
