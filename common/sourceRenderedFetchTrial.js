import { renderedFetch, WebViewCapabilityError } from './webViewBridge.js'

function clamp(value, min, max, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(String(url || '').trim())
}

export function buildRenderedFetchTrialRequest(options = {}) {
  return {
    url: String(options.url || '').trim(),
    waitSelector: String(options.waitSelector || '').trim().slice(0, 300),
    waitMs: clamp(options.waitMs, 0, 10000, 500),
    timeoutMs: clamp(options.timeoutMs, 500, 30000, 10000),
    cookie: String(options.cookie || ''),
    userAgent: String(options.userAgent || ''),
    referer: String(options.referer || '')
  }
}

export async function runRenderedFetchTrial(options = {}) {
  const request = buildRenderedFetchTrialRequest(options)
  const startedAt = new Date().toISOString()
  const started = Date.now()

  if (!isHttpUrl(request.url)) {
    return {
      status: 'invalid',
      errorCode: 'INVALID_URL',
      message: 'WebView 渲染 URL 必须是 HTTP/HTTPS 地址',
      request,
      startedAt,
      elapsedMs: 0
    }
  }

  try {
    const result = await renderedFetch(request.url, {
      waitSelector: request.waitSelector,
      waitMs: request.waitMs,
      timeoutMs: request.timeoutMs,
      cookie: request.cookie,
      userAgent: request.userAgent,
      headers: request.referer ? { Referer: request.referer } : {}
    })
    return {
      status: 'passed',
      message: 'WebView 渲染试运行通过',
      request,
      startedAt,
      elapsedMs: Date.now() - started,
      httpStatus: result.status,
      finalUrl: result.finalUrl,
      title: result.title,
      htmlLength: String(result.html || '').length,
      cookieCaptured: !!result.cookie
    }
  } catch (error) {
    const code = error && error.code || 'WEBVIEW_FAILED'
    return {
      status: error instanceof WebViewCapabilityError && code === 'APK_REQUIRED' ? 'unsupported' : 'failed',
      errorCode: code,
      message: error && error.message || 'WebView 渲染试运行失败',
      request,
      startedAt,
      elapsedMs: Date.now() - started
    }
  }
}
