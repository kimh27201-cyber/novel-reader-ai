export class WebViewCapabilityError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'WebViewCapabilityError'
    this.code = code
  }
}

function clamp(value, min, max, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback
}

function parseResult(payload) {
  if (typeof payload === 'string') {
    try { return JSON.parse(payload) } catch (error) { return { error: payload } }
  }
  return payload && typeof payload === 'object' ? payload : { error: 'WebView 返回结果无效' }
}

export function hasRenderedFetchBridge() {
  return getWebViewBridgeCapabilities().renderedFetch
}

export function getWebViewBridgeCapabilities() {
  const parser = typeof window !== 'undefined' ? window.NovelReaderWebViewParser : null
  const methods = parser && typeof parser === 'object'
    ? Object.keys(parser).filter(key => typeof parser[key] === 'function').sort()
    : []
  return {
    available: !!parser,
    renderedFetch: !!(parser && typeof parser.fetchRenderedHtml === 'function'),
    openLogin: !!(parser && typeof parser.openLoginPage === 'function'),
    readCookie: !!(parser && typeof parser.getCookie === 'function'),
    methods
  }
}

export function probeWebViewBridge(required = ['renderedFetch', 'openLogin', 'readCookie']) {
  const capabilities = getWebViewBridgeCapabilities()
  const missing = required.filter(key => !capabilities[key])
  const status = missing.length ? 'missing' : 'ready'
  return {
    status,
    capabilities,
    missing,
    checkedAt: new Date().toISOString(),
    message: status === 'ready'
      ? 'WebView bridge 可用'
      : '未检测到完整 Android WebView bridge'
  }
}

export function openSourceLogin(url) {
  const target = String(url || '').trim()
  if (!/^https?:\/\//i.test(target)) throw new WebViewCapabilityError('INVALID_URL', '登录地址无效')
  if (!hasRenderedFetchBridge() || typeof window.NovelReaderWebViewParser.openLoginPage !== 'function') {
    throw new WebViewCapabilityError('APK_REQUIRED', '打开登录页仅 Android APK 支持')
  }
  return window.NovelReaderWebViewParser.openLoginPage(target) !== false
}

export function readSourceLoginCookie(url) {
  const target = String(url || '').trim()
  if (!hasRenderedFetchBridge() || typeof window.NovelReaderWebViewParser.getCookie !== 'function') {
    throw new WebViewCapabilityError('APK_REQUIRED', '保存登录状态仅 Android APK 支持')
  }
  return String(window.NovelReaderWebViewParser.getCookie(target) || '')
}

export function renderedFetch(url, options = {}) {
  const requestUrl = String(url || '').trim()
  if (!/^https?:\/\//i.test(requestUrl)) {
    return Promise.reject(new WebViewCapabilityError('INVALID_URL', 'WebView 仅支持 HTTP/HTTPS 地址'))
  }
  if (!hasRenderedFetchBridge()) {
    return Promise.reject(new WebViewCapabilityError('APK_REQUIRED', '该能力仅 Android APK 支持'))
  }
  const timeoutMs = clamp(options.timeoutMs, 500, 30000, 10000)
  const bridgeOptions = {
    headers: options.headers && typeof options.headers === 'object' ? options.headers : {},
    cookie: String(options.cookie || ''),
    userAgent: String(options.userAgent || ''),
    waitMs: clamp(options.waitMs, 0, 10000, 500),
    waitSelector: String(options.waitSelector || '').slice(0, 300),
    timeoutMs
  }
  return new Promise((resolve, reject) => {
    const callbackName = `__novelReaderRendered_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const cleanup = () => {
      clearTimeout(timer)
      try { delete window[callbackName] } catch (error) { window[callbackName] = undefined }
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new WebViewCapabilityError('WEBVIEW_TIMEOUT', 'WebView 渲染超时'))
    }, timeoutMs + 100)
    window[callbackName] = payload => {
      cleanup()
      const result = parseResult(payload)
      if (result.error) {
        reject(new WebViewCapabilityError('WEBVIEW_FAILED', String(result.error)))
        return
      }
      resolve({
        html: String(result.html || ''),
        finalUrl: String(result.finalUrl || requestUrl),
        title: String(result.title || ''),
        cookie: String(result.cookie || ''),
        status: Number(result.status || 200),
        error: ''
      })
    }
    try {
      const accepted = window.NovelReaderWebViewParser.fetchRenderedHtml(
        requestUrl,
        JSON.stringify(bridgeOptions),
        callbackName
      )
      if (accepted === false) throw new Error('WebView 拒绝了渲染请求')
    } catch (error) {
      cleanup()
      reject(new WebViewCapabilityError('WEBVIEW_FAILED', error.message || 'WebView 渲染启动失败'))
    }
  })
}
