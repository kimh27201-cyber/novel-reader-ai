import { friendlyErrorMessage } from './uiFeedback.js'

const DEFAULT_BASE_URL = 'http://127.0.0.1:8000'
const BASE_URL_KEY = 'novelReaderBackendBaseUrl'
const TOKEN_KEY = 'novelReaderBackendToken'
const REFRESH_TOKEN_KEY = 'novelReaderBackendRefreshToken'
const DIAGNOSTIC_LIMIT = 20

export class ApiError extends Error {
  constructor(message, statusCode, data) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.data = data
  }
}

function getUni() {
  if (typeof uni === 'undefined') {
    return null
  }
  return uni
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\s+/g, '').replace(/\/+$/, '') || DEFAULT_BASE_URL
}

function defaultRequest(options) {
  const uniApi = getUni()
  if (!uniApi || !uniApi.request) {
    options.fail({ errMsg: '当前环境不支持网络请求' })
    return null
  }
  return uniApi.request(options)
}

function getErrorMessage(data, fallback) {
  if (data && data.error && data.error.message) {
    return data.error.message
  }
  if (data && data.detail) {
    return typeof data.detail === 'string' ? data.detail : fallback
  }
  if (data && data.message) {
    return data.message
  }
  return fallback
}

function parseResponseData(data) {
  if (typeof data !== 'string') {
    return data
  }
  const text = data.trim()
  if (!text || !/^[\[{]/.test(text)) {
    return data
  }
  try {
    return JSON.parse(text)
  } catch (error) {
    return data
  }
}

function getHeaderValue(headers, name) {
  if (!headers || typeof headers !== 'object') {
    return ''
  }
  const expected = String(name).toLowerCase()
  const key = Object.keys(headers).find(item => item.toLowerCase() === expected)
  return key ? String(headers[key] || '') : ''
}

function mergeLoginTokenFromHeader(path, data, response) {
  if (path !== '/api/auth/login' || (data && data.access_token)) {
    return data
  }
  const token = getHeaderValue(response.header || response.headers, 'X-Access-Token')
  if (!token) {
    return data
  }
  return {
    ...(data && typeof data === 'object' ? data : {}),
    access_token: token,
    token_type: 'bearer'
  }
}

function redactUrl(value) {
  return String(value || '').replace(/access_token=[^&]+/g, 'access_token=<redacted>')
}

function responseKeys(data) {
  return data && typeof data === 'object' && !Array.isArray(data) ? Object.keys(data).slice(0, 8) : []
}

function storageGetter(deps, methodName) {
  const uniApi = getUni()
  return deps[methodName] || (uniApi && uniApi[methodName] ? uniApi[methodName].bind(uniApi) : null)
}

export function createApiClient(deps = {}) {
  const getStorageSync = storageGetter(deps, 'getStorageSync') || (() => '')
  const setStorageSync = storageGetter(deps, 'setStorageSync') || (() => {})
  const removeStorageSync = storageGetter(deps, 'removeStorageSync') || (() => {})
  const requestAdapter = deps.request || (options => defaultRequest(options))
  const diagnostics = []
  let memoryToken = ''
  let memoryRefreshToken = ''
  let refreshPromise = null

  function recordDiagnostic(entry) {
    const safeEntry = {
      time: new Date().toISOString(),
      ...entry
    }
    diagnostics.push(safeEntry)
    if (diagnostics.length > DIAGNOSTIC_LIMIT) {
      diagnostics.shift()
    }
    if (typeof console !== 'undefined' && console.info) {
      console.info('[NovelReaderApi]', JSON.stringify(safeEntry))
    }
  }

  function getBaseUrl() {
    return normalizeBaseUrl(getStorageSync(BASE_URL_KEY))
  }

  function setBaseUrl(baseUrl) {
    const normalized = normalizeBaseUrl(baseUrl)
    setStorageSync(BASE_URL_KEY, normalized)
    return normalized
  }

  function getToken() {
    const storedToken = String(getStorageSync(TOKEN_KEY) || '')
    if (storedToken) {
      memoryToken = storedToken
      return storedToken
    }
    return memoryToken
  }

  function setToken(token) {
    memoryToken = String(token || '')
    setStorageSync(TOKEN_KEY, memoryToken)
    recordDiagnostic({
      event: 'token-store',
      hasMemoryToken: !!memoryToken
    })
  }

  function getRefreshToken() {
    const storedToken = String(getStorageSync(REFRESH_TOKEN_KEY) || '')
    if (storedToken) {
      memoryRefreshToken = storedToken
      return storedToken
    }
    return memoryRefreshToken
  }

  function setRefreshToken(token) {
    memoryRefreshToken = String(token || '')
    if (memoryRefreshToken) {
      setStorageSync(REFRESH_TOKEN_KEY, memoryRefreshToken)
    } else {
      removeStorageSync(REFRESH_TOKEN_KEY)
    }
  }

  function setTokenPair(data = {}) {
    if (data.access_token) setToken(data.access_token)
    if (data.refresh_token) setRefreshToken(data.refresh_token)
    return data
  }

  function clearTokens() {
    memoryToken = ''
    memoryRefreshToken = ''
    removeStorageSync(TOKEN_KEY)
    removeStorageSync(REFRESH_TOKEN_KEY)
  }

  const clearToken = clearTokens

  function rawRequest(path, options = {}) {
    const method = options.method || 'GET'
    const auth = options.auth !== false
    const header = {
      Accept: 'application/json',
      ...(options.header || {})
    }
    if (method !== 'GET') {
      header['Content-Type'] = 'application/json'
    }
    if (auth && getToken()) {
      header.Authorization = `Bearer ${getToken()}`
    }
    const requestPath = path
    const requestUrl = `${getBaseUrl()}${requestPath}`

    return new Promise((resolve, reject) => {
      const maybePromise = requestAdapter({
        url: requestUrl,
        method,
        data: options.data,
        header,
        success(response) {
          const statusCode = Number(response.statusCode || 0)
          const data = mergeLoginTokenFromHeader(path, parseResponseData(response.data), response)
          recordDiagnostic({
            event: 'response',
            method,
            path,
            url: redactUrl(requestUrl),
            statusCode,
            auth,
            hasStoredToken: !!getToken(),
            sentAccessTokenQuery: requestUrl.includes('access_token='),
            responseKeys: responseKeys(data)
          })
          if (statusCode >= 200 && statusCode < 300) {
            resolve(data)
            return
          }
          response.data = data
          reject(new ApiError(getErrorMessage(response.data, `请求失败：${statusCode}`), statusCode, response.data))
        },
        fail(error) {
          recordDiagnostic({
            event: 'fail',
            method,
            path,
            url: redactUrl(requestUrl),
            auth,
            hasStoredToken: !!getToken(),
            sentAccessTokenQuery: requestUrl.includes('access_token='),
            message: friendlyErrorMessage(error, 'network request failed')
          })
          reject(new ApiError(friendlyErrorMessage(error, '网络请求失败'), 0, error))
        }
      })
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(response => {
          const statusCode = Number(response.statusCode || 0)
          const data = mergeLoginTokenFromHeader(path, parseResponseData(response.data), response)
          recordDiagnostic({
            event: 'response',
            method,
            path,
            url: redactUrl(requestUrl),
            statusCode,
            auth,
            hasStoredToken: !!getToken(),
            sentAccessTokenQuery: requestUrl.includes('access_token='),
            responseKeys: responseKeys(data)
          })
          if (statusCode >= 200 && statusCode < 300) {
            resolve(data)
            return
          }
          response.data = data
          reject(new ApiError(getErrorMessage(response.data, `请求失败：${statusCode}`), statusCode, response.data))
        }).catch(error => {
          reject(error instanceof ApiError ? error : new ApiError(friendlyErrorMessage(error, '网络请求失败'), 0, error))
        })
      }
    })
  }

  function refreshTokens() {
    if (refreshPromise) return refreshPromise
    const refreshToken = getRefreshToken()
    if (!refreshToken) {
      return Promise.reject(new ApiError('登录状态已过期，请重新登录', 401, null))
    }
    refreshPromise = rawRequest('/api/auth/refresh', {
      method: 'POST',
      auth: false,
      data: { refresh_token: refreshToken }
    }).then(setTokenPair).catch(error => {
      clearTokens()
      throw error
    }).finally(() => {
      refreshPromise = null
    })
    return refreshPromise
  }

  async function request(path, options = {}) {
    try {
      return await rawRequest(path, options)
    } catch (error) {
      const canRefresh = error instanceof ApiError && error.statusCode === 401 &&
        options.auth !== false && options.retryAfterRefresh !== false && !!getRefreshToken()
      if (!canRefresh) {
        if (error instanceof ApiError && error.statusCode === 401 && options.auth !== false) clearTokens()
        throw error
      }
      await refreshTokens()
      const retryData = typeof options.dataAfterRefresh === 'function'
        ? options.dataAfterRefresh()
        : options.data
      try {
        return await rawRequest(path, { ...options, data: retryData, retryAfterRefresh: false })
      } catch (retryError) {
        if (retryError instanceof ApiError && retryError.statusCode === 401) clearTokens()
        throw retryError
      }
    }
  }

  return {
    getBaseUrl,
    setBaseUrl,
    getToken,
    setToken,
    getRefreshToken,
    setRefreshToken,
    setTokenPair,
    clearToken,
    clearTokens,
    getDiagnostics() {
      return diagnostics.slice()
    },
    clearDiagnostics() {
      diagnostics.splice(0, diagnostics.length)
    },
    request,
    login(username, password) {
      return request('/api/auth/login', {
        method: 'POST',
        auth: false,
        data: { username, password }
      }).then(data => {
        setTokenPair(data)
        if (!data || !data.refresh_token) setRefreshToken('')
        return data
      })
    },
    refresh() {
      return refreshTokens()
    },
    async logout() {
      const refreshToken = getRefreshToken()
      try {
        if (!refreshToken) return { revoked: false }
        return await request('/api/auth/logout', {
          method: 'POST',
          data: { refresh_token: refreshToken },
          dataAfterRefresh: () => ({ refresh_token: getRefreshToken() })
        })
      } finally {
        clearTokens()
      }
    },
    getMe() {
      return request('/api/auth/me')
    },
    healthCheck() {
      return request('/api/health', { auth: false })
    },
    listBooks(params = {}) {
      return request(`/api/books${buildQuery(params)}`)
    },
    createBook(payload) {
      return request('/api/books', {
        method: 'POST',
        data: payload
      })
    },
    getBook(bookId) {
      return request(`/api/books/${bookId}`)
    },
    updateBook(bookId, payload) {
      return request(`/api/books/${bookId}`, {
        method: 'PATCH',
        data: payload
      })
    },
    deleteBook(bookId) {
      return request(`/api/books/${bookId}`, { method: 'DELETE' })
    },
    listChapters(bookId) {
      return request(`/api/books/${bookId}/chapters`)
    },
    createChapter(bookId, payload) {
      return request(`/api/books/${bookId}/chapters`, {
        method: 'POST',
        data: payload
      })
    },
    getChapter(chapterId) {
      return request(`/api/chapters/${chapterId}`)
    },
    updateChapterContent(chapterId, content) {
      return request(`/api/chapters/${chapterId}/content`, {
        method: 'PATCH',
        data: { content }
      })
    },
    saveReadingHistory(payload) {
      return request('/api/reading-history', {
        method: 'POST',
        data: payload
      })
    },
    getReadingHistory(bookId) {
      return request(`/api/reading-history${buildQuery({ book_id: bookId })}`)
    },
    listSources(params = {}) {
      return request(`/api/sources${buildQuery(params)}`)
    },
    importDemoSource() {
      return request('/api/sources/import-demo', {
        method: 'POST'
      })
    },
    importSources(content) {
      return request('/api/sources/import', {
        method: 'POST',
        data: { content }
      })
    },
    deleteSource(sourceId) {
      return request(`/api/sources/${sourceId}`, {
        method: 'DELETE'
      })
    },
    updateSource(sourceId, payload) {
      return request(`/api/sources/${sourceId}`, {
        method: 'PATCH',
        data: payload
      })
    },
    getSourceSession(sourceId) {
      return request(`/api/sources/${sourceId}/session`)
    },
    saveSourceSession(sourceId, session = {}) {
      return request(`/api/sources/${sourceId}/session`, {
        method: 'PUT',
        data: {
          origin: String(session.origin || ''),
          cookie: String(session.cookie || session.cookieHeader || ''),
          user_agent: String(session.userAgent || session.user_agent || ''),
          referer: String(session.referer || ''),
          storage_state_json: String(session.storageStateJson || session.storage_state_json || ''),
          local_storage_json: String(session.localStorageJson || session.local_storage_json || ''),
          session_storage_json: String(session.sessionStorageJson || session.session_storage_json || ''),
          expires_at: Number(session.expiresAt || session.expires_at || 0) || 0,
          last_verified_at: Number(session.lastVerifiedAt || session.last_verified_at || 0) || 0,
          status: String(session.status || 'active')
        }
      })
    },
    deleteSourceSession(sourceId) {
      return request(`/api/sources/${sourceId}/session`, {
        method: 'DELETE'
      })
    },
    proxyFetch(url, options = {}) {
      return request('/api/proxy/fetch', {
        method: 'POST',
        auth: true,
        data: {
          url,
          method: String(options.method || 'GET').toUpperCase(),
          headers: options.headers || options.header || {},
          body: options.body !== undefined ? options.body : options.data || '',
          charset: options.charset || '',
          throttle_ms: Number.isFinite(Number(options.throttleMs)) ? Math.max(0, Number(options.throttleMs)) : 0
        }
      })
    },
    searchSource(sourceId, { keyword, page = 1 }) {
      return request(`/api/sources/${sourceId}/search`, {
        method: 'POST',
        data: { keyword, page }
      })
    },
    multiSourceSearch(payload) {
      return request('/api/search/books', {
        method: 'POST',
        data: payload
      })
    },
    diagnoseSource(sourceId, payload = {}) {
      return request(`/api/sources/${sourceId}/diagnostics`, {
        method: 'POST',
        data: payload
      })
    },
    diagnoseSources(payload = {}) {
      return request('/api/sources/diagnostics', {
        method: 'POST',
        data: payload
      })
    },
    loadSourceToc(sourceId, { bookUrl, tocUrl = null }) {
      return request(`/api/sources/${sourceId}/toc`, {
        method: 'POST',
        data: {
          book_url: bookUrl,
          toc_url: tocUrl
        }
      })
    },
    loadSourceContent(sourceId, { chapterUrl }) {
      return request(`/api/sources/${sourceId}/content`, {
        method: 'POST',
        data: { chapter_url: chapterUrl }
      })
    },
    listTtsVoices() {
      return request('/api/tts/voices')
    },
    synthesizeTts({ text, voiceId, voice_id, rate = 1 }) {
      return request('/api/tts/synthesize', {
        method: 'POST',
        data: {
          text: String(text || ''),
          voice_id: String(voiceId || voice_id || ''),
          rate: Number(rate)
        }
      })
    },
    summarizeChapter({ chapterText, bookId = null, chapterId = null }) {
      return request('/api/ai/summary', {
        method: 'POST',
        data: {
          chapter_text: chapterText,
          book_id: bookId,
          chapter_id: chapterId
        }
      })
    },
    chatWithAI({ question, context, bookId = null, chapterId = null }) {
      return request('/api/ai/chat', {
        method: 'POST',
        data: {
          question,
          context,
          book_id: bookId,
          chapter_id: chapterId
        }
      })
    },
    listSummaries(params = {}) {
      const query = buildQuery(params)
      return request(`/api/ai/summaries${query}`)
    },
    listChats(params = {}) {
      const query = buildQuery(params)
      return request(`/api/ai/chats${query}`)
    },
    listAiCalls(params = {}) {
      const query = buildQuery(params)
      return request(`/api/ai/calls${query}`)
    },
    syncPush({ deviceId, device_id, mutations = [] }) {
      return request('/api/sync/push', {
        method: 'POST',
        data: {
          device_id: deviceId || device_id,
          mutations
        }
      })
    },
    syncPull({ deviceId, device_id, cursor = 0, limit = 200 }) {
      return request(`/api/sync/pull${buildQuery({
        device_id: deviceId || device_id,
        cursor,
        limit
      })}`)
    }
  }
}

function buildQuery(params) {
  const items = Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
  return items.length ? `?${items.join('&')}` : ''
}

const apiClient = createApiClient()

export default apiClient
