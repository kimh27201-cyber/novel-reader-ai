import { renderedFetch, WebViewCapabilityError } from './webViewBridge.js'

function sourceRaw(source = {}) {
  return source && (source.raw || source) || {}
}

function normalizeRuleObject(rule) {
  if (!rule) return {}
  if (typeof rule === 'object') return rule
  try {
    return JSON.parse(rule)
  } catch (error) {
    return {}
  }
}

function clamp(value, min, max, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(String(url || '').trim())
}

function resolveTrialUrl(value, baseUrl) {
  const text = String(value || '').trim()
  if (!text) return ''
  try {
    return new URL(text, String(baseUrl || text)).toString()
  } catch (error) {
    return text
  }
}

function renderSearchUrl(value, keyword) {
  const encoded = encodeURIComponent(String(keyword || '测试'))
  return String(value || '')
    .replace(/\{\{\s*(?:key|keyword|searchKey)\s*\}\}/gi, encoded)
    .replace(/\{\s*(?:key|keyword|searchKey)\s*\}/gi, encoded)
}

function pickBookListSelector(rule) {
  const object = normalizeRuleObject(rule)
  return String(object.bookList || object.books || object.list || '').trim()
}

export function buildRenderedFetchTrialTarget(source = {}, options = {}) {
  const raw = sourceRaw(source)
  const baseUrl = raw.bookSourceUrl || raw.sourceUrl || raw.baseUrl || source.baseUrl || ''
  const keyword = options.keyword || '测试'
  const candidates = [
    {
      source: 'exploreUrl',
      url: raw.exploreUrl || raw.ruleExploreUrl || raw.explore,
      waitSelector: pickBookListSelector(raw.ruleExplore),
      reason: '发现页最适合验证列表渲染'
    },
    {
      source: 'searchUrl',
      url: renderSearchUrl(raw.searchUrl, keyword),
      waitSelector: pickBookListSelector(raw.ruleSearch),
      reason: '搜索页适合验证关键词结果渲染'
    },
    {
      source: 'loginUrl',
      url: raw.loginUrl,
      waitSelector: '',
      reason: '登录页适合验证会话和 Cookie bridge'
    },
    {
      source: 'bookSourceUrl',
      url: baseUrl,
      waitSelector: '',
      reason: '书源首页适合验证基础 WebView 访问'
    }
  ]
  const candidate = candidates.find(item => String(item.url || '').trim())
  if (!candidate) {
    return { url: '', waitSelector: '', source: 'none', reason: '当前书源缺少可试运行 URL' }
  }
  return {
    ...candidate,
    url: resolveTrialUrl(candidate.url, baseUrl),
    waitSelector: String(candidate.waitSelector || '').slice(0, 300)
  }
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
