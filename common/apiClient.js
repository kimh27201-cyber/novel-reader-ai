import { friendlyErrorMessage } from './uiFeedback.js'

const DEFAULT_BASE_URL = 'http://127.0.0.1:8000'
const BASE_URL_KEY = 'novelReaderBackendBaseUrl'
const TOKEN_KEY = 'novelReaderBackendToken'

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
  return String(value || DEFAULT_BASE_URL).trim().replace(/\/+$/, '') || DEFAULT_BASE_URL
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

function storageGetter(deps, methodName) {
  const uniApi = getUni()
  return deps[methodName] || (uniApi && uniApi[methodName] ? uniApi[methodName].bind(uniApi) : null)
}

export function createApiClient(deps = {}) {
  const getStorageSync = storageGetter(deps, 'getStorageSync') || (() => '')
  const setStorageSync = storageGetter(deps, 'setStorageSync') || (() => {})
  const removeStorageSync = storageGetter(deps, 'removeStorageSync') || (() => {})
  const requestAdapter = deps.request || (options => defaultRequest(options))

  function getBaseUrl() {
    return normalizeBaseUrl(getStorageSync(BASE_URL_KEY))
  }

  function setBaseUrl(baseUrl) {
    const normalized = normalizeBaseUrl(baseUrl)
    setStorageSync(BASE_URL_KEY, normalized)
    return normalized
  }

  function getToken() {
    return String(getStorageSync(TOKEN_KEY) || '')
  }

  function setToken(token) {
    setStorageSync(TOKEN_KEY, String(token || ''))
  }

  function clearToken() {
    removeStorageSync(TOKEN_KEY)
  }

  function request(path, options = {}) {
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

    return new Promise((resolve, reject) => {
      const maybePromise = requestAdapter({
        url: `${getBaseUrl()}${path}`,
        method,
        data: options.data,
        header,
        success(response) {
          const statusCode = Number(response.statusCode || 0)
          if (statusCode >= 200 && statusCode < 300) {
            resolve(response.data)
            return
          }
          if (statusCode === 401) {
            clearToken()
          }
          reject(new ApiError(getErrorMessage(response.data, `请求失败：${statusCode}`), statusCode, response.data))
        },
        fail(error) {
          reject(new ApiError(friendlyErrorMessage(error, '网络请求失败'), 0, error))
        }
      })
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(response => {
          const statusCode = Number(response.statusCode || 0)
          if (statusCode >= 200 && statusCode < 300) {
            resolve(response.data)
            return
          }
          if (statusCode === 401) {
            clearToken()
          }
          reject(new ApiError(getErrorMessage(response.data, `请求失败：${statusCode}`), statusCode, response.data))
        }).catch(error => {
          reject(error instanceof ApiError ? error : new ApiError(friendlyErrorMessage(error, '网络请求失败'), 0, error))
        })
      }
    })
  }

  return {
    getBaseUrl,
    setBaseUrl,
    getToken,
    setToken,
    clearToken,
    request,
    login(username, password) {
      return request('/api/auth/login', {
        method: 'POST',
        auth: false,
        data: { username, password }
      }).then(data => {
        if (data && data.access_token) {
          setToken(data.access_token)
        }
        return data
      })
    },
    getMe() {
      return request('/api/auth/me')
    },
    healthCheck() {
      return request('/api/health', { auth: false })
    },
    listBooks() {
      return request('/api/books')
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
    saveReadingHistory(payload) {
      return request('/api/reading-history', {
        method: 'POST',
        data: payload
      })
    },
    getReadingHistory(bookId) {
      return request(`/api/reading-history${buildQuery({ book_id: bookId })}`)
    },
    listSources() {
      return request('/api/sources')
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
    searchSource(sourceId, { keyword, page = 1 }) {
      return request(`/api/sources/${sourceId}/search`, {
        method: 'POST',
        data: { keyword, page }
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
