import apiClient from './apiClient.js'
import { normalizeHeaders } from './headerUtils.js'
import { asSourceRuntimeError, SourceRuntimeError } from './sourceErrors.js'

const DEFAULT_TIMEOUT_MS = 12000
let callbackSequence = 0

function clamp(value, minimum, maximum, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(maximum, Math.max(minimum, Math.round(number)))
}

function getNativeBridge() {
  if (typeof window === 'undefined') return null
  const bridge = window.NovelReaderHttp
  return bridge && typeof bridge.request === 'function' ? bridge : null
}

export function getSourceTransportCapabilities() {
  const bridge = getNativeBridge()
  if (!bridge || typeof bridge.capabilities !== 'function') {
    return { native: false, methods: ['GET', 'POST'], charsets: ['utf-8'], rendered: false }
  }
  try {
    const value = bridge.capabilities()
    return typeof value === 'string' ? JSON.parse(value) : value
  } catch (error) {
    return { native: true, methods: ['GET', 'POST'], charsets: ['utf-8', 'gbk', 'gb2312'] }
  }
}

function nativeRequest(request) {
  const bridge = getNativeBridge()
  if (!bridge) return Promise.reject(new Error('Android 原生网络桥不可用'))
  const timeoutMs = clamp(request.timeoutMs, 1000, 60000, DEFAULT_TIMEOUT_MS)
  const callbackName = `__novelReaderHttpCallback_${Date.now()}_${callbackSequence += 1}`

  return new Promise((resolve, reject) => {
    let settled = false
    const cleanup = () => {
      if (typeof window !== 'undefined') delete window[callbackName]
      clearTimeout(timer)
    }
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      const error = new Error('书源请求超时')
      error.code = 'TIMEOUT'
      reject(error)
    }, timeoutMs + 1500)

    window[callbackName] = payload => {
      if (settled) return
      settled = true
      cleanup()
      let response = payload
      try {
        if (typeof response === 'string') response = JSON.parse(response)
      } catch (error) {
        reject(new Error('原生网络桥返回了无效数据'))
        return
      }
      if (!response || response.ok !== true) {
        const failure = new Error(response && response.message ? response.message : '书源网络请求失败')
        failure.code = response && response.errorCode ? response.errorCode : 'NETWORK_ERROR'
        failure.status = Number(response && response.status) || 0
        reject(failure)
        return
      }
      resolve(response)
    }

    try {
      const accepted = bridge.request(JSON.stringify(request), callbackName)
      if (accepted === false) throw new Error('原生网络桥拒绝了请求')
    } catch (error) {
      settled = true
      cleanup()
      reject(error)
    }
  })
}

function directRequest(request) {
  const headers = normalizeHeaders(request.headers || {}, {
    channel: typeof window !== 'undefined' ? 'direct' : 'proxy'
  })
  const startedAt = Date.now()
  if (typeof uni !== 'undefined' && uni.request) {
    return new Promise((resolve, reject) => {
      uni.request({
        url: request.url,
        method: request.method || 'GET',
        header: headers,
        data: request.body || undefined,
        timeout: request.timeoutMs || DEFAULT_TIMEOUT_MS,
        responseType: 'text',
        success: response => {
          const value = response.data
          const status = Number(response.statusCode || 200)
          const ok = status >= 200 && status < 400
          resolve({
            ok,
            status,
            finalUrl: request.url,
            headers: response.header || {},
            text: typeof value === 'string' ? value : JSON.stringify(value || ''),
            charset: resolveResponseCharset(request.charset, response.header || {}),
            elapsedMs: Date.now() - startedAt,
            errorCode: ok ? '' : `HTTP_${status}`,
            message: ok ? '' : `HTTP ${status}`
          })
        },
        fail: error => reject(asSourceRuntimeError(error && error.errMsg || '网络请求失败'))
      })
    })
  }

  if (typeof fetch === 'undefined') return Promise.reject(new Error('当前环境不支持网络请求'))
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), request.timeoutMs || DEFAULT_TIMEOUT_MS) : 0
  return fetch(request.url, {
    method: request.method || 'GET',
    headers,
    body: String(request.method || 'GET').toUpperCase() === 'POST' ? request.body : undefined,
    signal: controller ? controller.signal : undefined,
    redirect: 'follow'
  }).then(async response => {
    const status = Number(response.status || 200)
    const ok = response.ok == null ? status >= 200 && status < 400 : response.ok
    const responseHeaders = responseHeadersToObject(response.headers)
    const charset = resolveResponseCharset(request.charset, responseHeaders)
    const text = await readResponseText(response, charset)
    return {
      ok,
      status,
      finalUrl: response.url || request.url,
      headers: responseHeaders,
      text,
      charset,
      elapsedMs: Date.now() - startedAt,
      errorCode: ok ? '' : `HTTP_${status}`,
      message: ok ? '' : `HTTP ${status}`
    }
  }).catch(error => {
    if (error && error.name === 'AbortError') {
      throw new SourceRuntimeError('TIMEOUT', '书源请求超时', { retryable: true, cause: error })
    }
    throw asSourceRuntimeError(error)
  }).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

function responseHeadersToObject(headers) {
  const output = {}
  if (!headers) return output
  if (typeof headers.forEach === 'function') {
    headers.forEach((value, key) => { output[key] = value })
    return output
  }
  return Object.keys(headers).reduce((result, key) => {
    result[key] = headers[key]
    return result
  }, output)
}

function resolveResponseCharset(requested, headers = {}) {
  const forced = String(requested || '').trim().toLowerCase()
  if (forced && forced !== 'auto') return forced
  const contentTypeKey = Object.keys(headers).find(key => key.toLowerCase() === 'content-type')
  const match = String(contentTypeKey ? headers[contentTypeKey] : '').match(/charset\s*=\s*["']?([^;"'\s]+)/i)
  return String(match && match[1] || 'utf-8').toLowerCase()
}

async function readResponseText(response, charset) {
  if (/^utf-?8$/i.test(charset) || typeof response.arrayBuffer !== 'function' || typeof TextDecoder === 'undefined') {
    return response.text()
  }
  try {
    const bytes = await response.arrayBuffer()
    return new TextDecoder(charset).decode(bytes)
  } catch (error) {
    throw new SourceRuntimeError('CHARSET_ERROR', `响应解码失败：${charset}`, { cause: error })
  }
}

function isH5Runtime() {
  return typeof window !== 'undefined' && window.location && /^https?:$/.test(window.location.protocol)
}

async function backendProxyRequest(normalized) {
  const data = await apiClient.proxyFetch(normalized.url, {
    method: normalized.method,
    headers: normalized.headers,
    body: normalized.body,
    charset: normalized.charset,
    throttleMs: 0
  })
  return {
    ok: true,
    status: Number(data && (data.status || data.status_code)) || 200,
    finalUrl: (data && (data.final_url || data.finalUrl)) || normalized.url,
    headers: (data && data.headers) || {},
    text: data && typeof data.text === 'string' ? data.text : typeof data === 'string' ? data : JSON.stringify(data || ''),
    charset: (data && data.charset) || normalized.charset || 'utf-8',
    elapsedMs: Number(data && (data.elapsed_ms || data.elapsedMs)) || 0,
    errorCode: '',
    message: ''
  }
}

export async function requestSourceText(request = {}, runtimeContext = {}) {
  const normalized = {
    url: String(request.url || ''),
    method: String(request.method || 'GET').toUpperCase(),
    headers: normalizeHeaders(request.headers || request.header || {}, { channel: 'proxy' }),
    body: request.body == null ? request.data || '' : request.body,
    charset: request.charset || '',
    timeoutMs: clamp(request.timeoutMs, 1000, 60000, DEFAULT_TIMEOUT_MS),
    maxBytes: clamp(request.maxBytes, 1024, 8 * 1024 * 1024, 4 * 1024 * 1024),
    sourceKey: String(request.sourceKey || runtimeContext.sourceKey || ''),
    cookie: String(request.cookie || ''),
    userAgent: String(request.userAgent || ''),
    referer: String(request.referer || '')
  }
  if (!/^https?:\/\//i.test(normalized.url)) throw new Error('仅允许访问 HTTP/HTTPS 书源地址')
  if (getNativeBridge()) return nativeRequest(normalized)

  // Node-based compatibility tests expose uni.request without a browser window.
  // Keeping this adapter does not affect APK/H5 routing, but preserves the previous API mock contract.
  if (typeof window === 'undefined' && typeof uni !== 'undefined' && uni.request) {
    return backendProxyRequest(normalized)
  }

  if (isH5Runtime() && runtimeContext.useBackend !== false && apiClient.getToken()) {
    try {
      return await backendProxyRequest(normalized)
    } catch (error) {
      if (runtimeContext.backendOnly) throw error
    }
  }

  const response = await directRequest(normalized)
  if (!response.ok) {
    throw new SourceRuntimeError(response.errorCode || 'NETWORK_ERROR', response.message || '书源网络请求失败', {
      status: response.status,
      retryable: Number(response.status) >= 500
    })
  }
  return response
}

export default { getSourceTransportCapabilities, requestSourceText }
