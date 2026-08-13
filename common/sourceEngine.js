import { normalizeHeaders } from './headerUtils.js'
import { executeJsRule } from './jsRuleSandbox.js'
import { renderedFetch } from './webViewBridge.js'
import { requestSourceText as transportRequestSourceText } from './sourceTransport.js'
import { SourceRuntimeError } from './sourceErrors.js'

export const unsupportedRulePattern = /(?:java\.|eval\(|\bFunction\s*\(|\bfetch\s*\(|XMLHttpRequest|WebSocket|\bwindow\.|\bdocument\.|localStorage|sessionStorage|\brequire\s*\(|\bprocess\.|\bwhile\s*\(|\bfor\s*\()/i

export function cleanText(value) {
  return String(value == null ? '' : value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function hasUnsupportedRule(value) {
  if (!value) return false
  return unsupportedRulePattern.test(typeof value === 'string' ? value : JSON.stringify(value))
}

export function createSourceId(source) {
  const name = String(source.bookSourceName || source.name || source.sourceName || '').trim().toLowerCase()
  const url = trimTrailingSlash(String(source.bookSourceUrl || source.sourceUrl || source.baseUrl || ''))
    .trim()
    .toLowerCase()
  // A site can publish multiple independently named sources on the same base URL.
  // Keep legacy stored ids unchanged, but make newly generated ids match sourceKey identity.
  const base = `${name}\n${url}` || String(Date.now())
  let hash = 0
  for (let index = 0; index < base.length; index += 1) {
    hash = ((hash << 5) - hash) + base.charCodeAt(index)
    hash |= 0
  }
  return `source-${Math.abs(hash).toString(36)}`
}

export function createSourceKey(source) {
  const name = String(source.bookSourceName || source.name || source.sourceName || '').trim().toLowerCase()
  const url = trimTrailingSlash(String(source.bookSourceUrl || source.sourceUrl || source.baseUrl || ''))
    .trim()
    .toLowerCase()
  const identity = `${name}\n${url}`
  let hash = 2166136261
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `source-key-${(hash >>> 0).toString(36)}`
}

export function normalizeSourceConfig(input, defaults = {}) {
  const raw = input.raw || input
  const name = raw.bookSourceName || raw.name || raw.sourceName || defaults.name || '未命名书源'
  const baseUrl = raw.bookSourceUrl || raw.sourceUrl || raw.baseUrl || defaults.baseUrl || ''
  const id = input.id || defaults.id || createSourceId(raw)
  const incompatible = hasUnsupportedRule(raw)
  const features = detectSourceFeatures(raw)
  const levelInfo = detectSourceCompatibilityLevel(raw)
  const compatibilityLabels = {
    full_css: '完整兼容',
    need_headers: '兼容（需请求头/Cookie）',
    need_js_sandbox: '兼容（安全 JS 子集）',
    need_webview: '条件兼容（需 Android WebView）',
    need_login: '条件兼容（需登录）',
    unsupported: '不兼容（受限能力）'
  }

  return {
    id,
    sourceKey: input.sourceKey || defaults.sourceKey || createSourceKey(raw),
    name,
    baseUrl: trimTrailingSlash(baseUrl),
    group: raw.bookSourceGroup || raw.group || defaults.group || '用户导入',
    formatVersion: detectSourceFormat(raw),
    features,
    comment: raw.comment || raw.bookSourceComment || raw.sourceComment || '',
    weight: Number(raw.weight || raw.customOrder || defaults.weight || 0),
    respondTimeMs: Number(raw.respondTime || raw.respondTimeMs || defaults.respondTimeMs || 0),
    enabled: input.enabled !== undefined ? !!input.enabled : defaults.enabled !== undefined ? !!defaults.enabled : true,
    recommended: input.recommended !== undefined ? !!input.recommended : raw.recommended !== undefined ? !!raw.recommended : !!defaults.recommended,
    raw,
    compatibilityLevel: incompatible ? 'unsupported' : levelInfo.level,
    compatibility: incompatible ? '不兼容（包含危险脚本能力）' : compatibilityLabels[levelInfo.level],
    importedAt: input.importedAt !== undefined ? input.importedAt : defaults.importedAt !== undefined ? defaults.importedAt : Date.now(),
    updatedAt: Date.now()
  }
}

export function detectSourceFormat(raw = {}) {
  if (!raw || typeof raw !== 'object') return 'legacy'
  const legado3Fields = [
    'bookSourceType',
    'bookSourceComment',
    'customOrder',
    'enabledCookieJar',
    'exploreUrl',
    'lastUpdateTime',
    'loginCheck',
    'loginUi',
    'loginUrl',
    'weight'
  ]
  return legado3Fields.some(field => Object.prototype.hasOwnProperty.call(raw, field)) ? '3.x' : 'legacy'
}

export function detectSourceFeatures(raw = {}) {
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw || {})
  return {
    login: hasNonEmptySourceField(raw, ['loginUrl', 'loginUi', 'loginCheck']),
    explore: hasNonEmptySourceField(raw, ['exploreUrl', 'ruleExplore']),
    cookie: /cookie\./i.test(text) || !!raw.enabledCookieJar,
    headers: hasNonEmptySourceField(raw, ['header', 'headers', 'httpHeader']),
    webView: /webview/i.test(text),
    jsRule: /<js>|<\/js>|@js:|java\.|eval\(/i.test(text)
  }
}

export function detectSourceCompatibilityLevel(raw = {}, environment = {}) {
  const source = raw && (raw.raw || raw) || {}
  const text = typeof source === 'string' ? source : JSON.stringify(source)
  const android = environment.android === true
  let level = 'full_css'
  if (/(验证码|人机验证|强风控|付费|会员专享|captcha|cloudflare|turnstile|recaptcha|paywall)/i.test(text)) level = 'unsupported'
  else if (hasNonEmptySourceField(source, ['loginUrl', 'loginUi', 'loginCheck'])) level = 'need_login'
  else if (/webview/i.test(text)) level = 'need_webview'
  else if (/<js>|<\/js>|@js:/i.test(text)) level = 'need_js_sandbox'
  else if (hasNonEmptySourceField(source, ['header', 'headers', 'httpHeader']) || /cookie\./i.test(text) || source.enabledCookieJar) level = 'need_headers'

  const environmentSupported = level === 'unsupported'
    ? false
    : (level === 'need_webview' || level === 'need_login') ? android : true
  const nextActions = {
    full_css: '可直接运行并进行全链路测试',
    need_headers: '通过后端代理传递 UA、Referer 或 Cookie',
    need_js_sandbox: '使用安全 JS 子集；超出白名单时需改写规则',
    need_webview: android ? '使用 Android WebView 获取渲染后 HTML' : '请在 Android APK 中使用动态渲染能力',
    need_login: android ? '请手动打开登录页并保存登录状态' : '请在 Android APK 中手动登录后保存 Cookie',
    unsupported: '不自动绕过验证码、强风控、会员或付费限制'
  }
  return { level, environmentSupported, nextAction: nextActions[level] }
}

function hasNonEmptySourceField(raw = {}, names = []) {
  if (!raw || typeof raw !== 'object') return false
  return names.some(name => {
    const value = raw[name]
    if (value === false || value == null) return false
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'object') return Object.keys(value).length > 0
    return String(value).trim() !== ''
  })
}

export function parseSourceJson(text) {
  const parsed = JSON.parse(extractJsonPayload(text))
  const list = Array.isArray(parsed) ? parsed : parsed.bookSourceUrl || parsed.bookSourceName ? [parsed] : parsed.sources
  if (!Array.isArray(list)) {
    throw new Error('书源 JSON 必须是数组，或包含 sources 数组')
  }
  return list.map(item => normalizeSourceConfig(item))
}

export function detectSourceImportPayload(input) {
  const raw = String(input || '').trim()
  if (!raw) return { type: 'unknown', value: '' }
  if (raw[0] === '[' || raw[0] === '{') return { type: 'json', value: raw }

  const importUrl = extractImportLinkUrl(raw)
  if (importUrl) return { type: 'import-link', value: importUrl }

  if (/^https?:\/\/.+\.json(?:[?#].*)?$/i.test(raw)) return { type: 'json-url', value: raw }
  if (/^https?:\/\/.+\/(?:yuedu\/)?(?:shuyuan|article|index|content|source|booksource)/i.test(raw) || /yck(?:2026|ceo)\.(?:top|com)/i.test(raw)) {
    return { type: 'repository-page', value: raw }
  }
  if (/^https?:\/\//i.test(raw)) return { type: 'url', value: raw }
  return { type: 'unknown', value: raw }
}

export function extractImportLinkUrl(value) {
  const raw = decodeHtml(String(value || '').trim())
  if (!raw) return ''

  const direct = raw.match(/(?:src|url|data)=([^&\s"'<>]+)/i)
  if (direct) return decodeURIComponentSafe(direct[1])

  if (/^(?:yuedu|legado|booksource):\/\//i.test(raw)) {
    const queryStart = raw.indexOf('?')
    if (queryStart >= 0) {
      const params = new URLSearchParams(raw.slice(queryStart + 1))
      const found = params.get('src') || params.get('url') || params.get('data')
      if (found) return decodeURIComponentSafe(found)
    }
  }

  const encodedUrl = raw.match(/https?%3A%2F%2F[^&\s"'<>]+/i)
  if (encodedUrl) return decodeURIComponentSafe(encodedUrl[0])

  return ''
}

export function extractRepositorySourceUrl(html, baseUrl = '') {
  const text = String(html || '')
  const directJson = text.match(/https?:\/\/[^"'<> ]+\.json(?:\?[^"'<> ]*)?/i)
  if (directJson) return directJson[0]

  const jsonUrlInput = text.match(/id=["']jsonurl["'][^>]*\bvalue=["']([^"']+)["']/i)
    || text.match(/\bvalue=["']([^"']+\.json(?:\?[^"']*)?)["'][^>]*id=["']jsonurl["']/i)
  if (jsonUrlInput) return resolveUrl(decodeHtml(jsonUrlInput[1]), baseUrl)

  const attrMatches = [...text.matchAll(/(?:href|data-url|data-src|url|value)=["']([^"']+)["']/gi)]
    .map(match => decodeHtml(match[1]))
  const found = attrMatches.find(link => /\.json(?:[?#].*)?$/i.test(link))
    || attrMatches.find(link => /(?:download|booksource|source)[^"'<> ]*\.json/i.test(link))
  if (found) return resolveUrl(found, baseUrl)

  const importLink = extractImportLinkUrl(text)
  if (importLink) return resolveUrl(importLink, baseUrl)

  const inline = findInlineJsonPayload(text)
  return inline ? `data:application/json,${encodeURIComponent(inline)}` : ''
}

export function findInlineJsonPayload(html) {
  try {
    return extractJsonPayload(html)
  } catch (error) {
    return ''
  }
}

export function extractJsonPayload(text) {
  const raw = String(text || '').trim()
  if (!raw) throw new Error('书源内容为空')
  if (raw[0] === '[' || raw[0] === '{') return raw

  const embedded = extractEmbeddedJsonPayload(raw)
  if (embedded) return embedded

  const textarea = raw.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/i)
  if (textarea) return decodeHtml(textarea[1]).trim()

  const pre = raw.match(/<(pre|code)[^>]*>([\s\S]*?)<\/\1>/i)
  if (pre) return decodeHtml(pre[2]).trim()

  const arrayStart = raw.indexOf('[')
  const arrayEnd = raw.lastIndexOf(']')
  if (arrayStart >= 0 && arrayEnd > arrayStart) return raw.slice(arrayStart, arrayEnd + 1)

  const objectStart = raw.indexOf('{')
  const objectEnd = raw.lastIndexOf('}')
  if (objectStart >= 0 && objectEnd > objectStart) return raw.slice(objectStart, objectEnd + 1)

  throw new Error('没有识别到 JSON 书源内容')
}

export function decodeHtml(value) {
  return String(value || '')
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
}

export function renderTemplate(template, context = {}) {
  return String(template || '').replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key) => {
    const name = key.trim()
    if (name === 'key' || name === 'keyword') return encodeURIComponent(context.key || context.keyword || '')
    if (name === 'page') return context.page || 1
    if (name.startsWith('$.')) {
      const value = readJsonPath(context.$ && typeof context.$ === 'object' ? context.$ : context, name)
      return Array.isArray(value) ? value[0] || '' : value || ''
    }
    if (context[name] != null) return context[name]
    try {
      return executeJsRule(name, context)
    } catch (error) {
      return ''
    }
  })
}

export function resolveUrl(url, baseUrl) {
  const value = String(url || '').trim()
  if (!value) return ''
  if (/^(https?:)?\/\//i.test(value)) return value.startsWith('//') ? `https:${value}` : value
  try {
    return new URL(value, ensureBaseUrl(baseUrl)).toString()
  } catch (error) {
    return value
  }
}

export function parseRequestSpec(spec, context = {}, baseUrl = '') {
  const rawSpec = String(spec || '').trim()
  const requestContext = { ...context, baseUrl: context.baseUrl || baseUrl }
  const text = /^(?:<js>|@js:)/i.test(rawSpec)
    ? String(executeJsRule(rawSpec, {
      ...requestContext,
      result: requestContext.result == null ? (requestContext.key || '') : requestContext.result
    }))
    : renderTemplate(rawSpec, requestContext)
  const match = text.match(/^([^,]+),\s*(\{[\s\S]*\})\s*$/)
  if (!match) {
    return {
      url: resolveUrl(text, baseUrl),
      method: 'GET',
      header: {},
      data: ''
    }
  }

  let options = {}
  try {
    options = JSON.parse(match[2])
  } catch (error) {
    throw new SourceRuntimeError('REQUEST_TEMPLATE_UNSUPPORTED', '书源请求模板中的 JSON 配置无效', {
      stage: 'request',
      cause: error
    })
  }

  const method = String(options.method || (options.body != null || options.data != null ? 'POST' : 'GET')).toUpperCase()
  if (!['GET', 'POST'].includes(method)) {
    throw new SourceRuntimeError('REQUEST_TEMPLATE_UNSUPPORTED', `暂不支持请求方法：${method}`, { stage: 'request' })
  }
  const header = normalizeHeaders(options.headers || options.header || {}, { channel: 'proxy', context: requestContext })
  const data = renderTemplate(options.body == null ? options.data || '' : options.body, requestContext)
  if (method === 'POST' && data && !Object.keys(header).some(key => key.toLowerCase() === 'content-type')) {
    header['Content-Type'] = 'application/x-www-form-urlencoded'
  }

  return {
    url: resolveUrl(match[1], baseUrl),
    method,
    header,
    data,
    charset: options.charset || ''
  }
}

const sourceRequestTimestamps = new Map()

function clampRequestNumber(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, Math.round(number)))
}

function sleep(ms) {
  const delay = Number(ms || 0)
  if (delay <= 0) return Promise.resolve()
  return new Promise(resolve => setTimeout(resolve, delay))
}

function requestRateLimitKey(spec = {}) {
  if (spec.rateLimitKey) return String(spec.rateLimitKey)
  try {
    return new URL(spec.url).origin
  } catch (error) {
    return String(spec.url || 'default')
  }
}

async function waitForRequestInterval(spec = {}) {
  const interval = clampRequestNumber(spec.requestIntervalMs, 0, 10000, 0)
  if (!interval) return
  const key = requestRateLimitKey(spec)
  const now = Date.now()
  const last = sourceRequestTimestamps.get(key) || 0
  const waitMs = Math.max(0, interval - (now - last))
  if (waitMs) await sleep(waitMs)
  sourceRequestTimestamps.set(key, Date.now())
}

export async function requestText(spec) {
  const requestUrl = getRuntimeRequestUrl(spec.url)
  const retryCount = clampRequestNumber(spec.retryCount, 0, 3, 0)
  const retryIntervalMs = clampRequestNumber(spec.retryIntervalMs, 0, 10000, 0)
  const attempts = retryCount + 1
  let lastError

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await waitForRequestInterval(spec)
      return await requestTextOnce(requestUrl, spec, attempt === attempts - 1)
    } catch (error) {
      lastError = error
      if (attempt < attempts - 1) {
        await sleep(retryIntervalMs)
      }
    }
  }

  throw lastError || new Error('网络请求失败')
}

function requestTextOnce(requestUrl, spec) {
  if (spec.rendered) {
    return renderedFetch(spec.url, {
      headers: normalizeHeaders(spec.header || {}, { channel: 'proxy' }),
      cookie: spec.cookie || '',
      userAgent: spec.userAgent || '',
      waitMs: spec.waitMs,
      waitSelector: spec.waitSelector,
      timeoutMs: spec.timeoutMs || 10000
    }).then(result => result.html)
  }
  return transportRequestSourceText({
    url: /^https?:\/\//i.test(String(spec.url || '')) ? spec.url : requestUrl,
    method: spec.method || 'GET',
    headers: spec.header || {},
    body: spec.data || '',
    charset: spec.charset || '',
    cookie: spec.cookie || '',
    userAgent: spec.userAgent || '',
    referer: spec.referer || '',
    timeoutMs: spec.timeoutMs || 12000,
    maxBytes: spec.maxBytes,
    sourceKey: spec.sourceKey
  }, {
    sourceKey: spec.sourceKey,
    useBackend: spec.useBackend !== false,
    backendOnly: !!spec.backendOnly
  }).then(response => response.text)
}

export function getRuntimeRequestUrl(url) {
  const value = String(url || '')
  if (typeof window === 'undefined') return value
  const protocol = window.location && window.location.protocol
  if (protocol !== 'http:' && protocol !== 'https:') return value

  try {
    const parsed = new URL(value)
    if (/^www\.yckceo\.com$/i.test(parsed.hostname)) {
      return `/yckceo-proxy${parsed.pathname}${parsed.search}`
    }
    if (/^www\.yck2026\.top$/i.test(parsed.hostname)) {
      return `/yck2026-proxy${parsed.pathname}${parsed.search}`
    }
    return value
  } catch (error) {
    return value
  }
}

export function parseResponsePayload(text) {
  const raw = String(text || '')
  try {
    return JSON.parse(raw)
  } catch (error) {
    return raw
  }
}

export function applyRule(input, rule, context = {}) {
  if (!rule && rule !== 0) return ''
  if (typeof rule === 'object') return rule

  const text = String(rule).trim()
  if (/^(?:<js>|@js:)/i.test(text)) {
    return executeJsRule(text, { ...context, result: input })
  }
  if (hasUnsupportedRule(rule)) return ''

  const options = splitFallbacks(text)
  for (let index = 0; index < options.length; index += 1) {
    const value = applyRulePart(input, options[index], context)
    if (Array.isArray(value) ? value.length : String(value || '').trim()) {
      return value
    }
  }
  return ''
}

export function applyListRule(input, rule, context = {}) {
  const value = applyRule(input, rule, context)
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

function applyRulePart(input, rule, context) {
  const chainedJsIndex = String(rule || '').indexOf('@js:')
  if (chainedJsIndex > 0) {
    const selected = applyRulePart(input, String(rule).slice(0, chainedJsIndex), context)
    return executeJsRule(String(rule).slice(chainedJsIndex), { ...context, result: selected })
  }
  const concatRules = String(rule || '').split('&&').map(item => item.trim()).filter(Boolean)
  if (concatRules.length > 1) {
    const values = concatRules.map(item => applyRulePart(input, item, context))
    if (values.some(Array.isArray)) {
      const size = Math.max(...values.map(value => asArray(value).length))
      return Array.from({ length: size }, (_, index) => values.map(value => {
        const items = asArray(value)
        return items[index] == null ? items[0] || '' : items[index]
      }).join(''))
    }
    return values.join('')
  }
  const parts = String(rule || '').split('##')
  let value = applySelectorPipeline(input, renderTemplate(parts[0], context))

  for (let index = 1; index < parts.length; index += 2) {
    const pattern = parts[index]
    const replacement = parts[index + 1] == null ? '' : parts[index + 1]
    value = replaceValue(value, pattern, replacement)
  }

  return value
}

function applySelectorPipeline(input, rule) {
  const text = String(rule || '').trim()
  if (!text) return input
  if (/^https?:\/\//i.test(text)) return text
  if (/^(?:\/(?!\/)|\.{1,2}\/)/.test(text)) return text
  if (text === '@text' || text === 'text') return extractText(input)
  if (text === '@html' || text === 'html') return asArray(input).join('')
  if (/^(?:@?json:)/i.test(text)) return readJsonPath(input, text.replace(/^(?:@?json:)/i, ''))
  if (/^(?:@?xpath:|\/\/)/i.test(text)) return selectXPath(input, text.replace(/^(?:@?xpath:)/i, ''))
  if (text.startsWith('$.')) return readJsonPath(input, text)

  const tokens = text.split('@').map(item => item.trim()).filter(Boolean)
  const startsWithAccessor = text.startsWith('@')
    && tokens.length === 1
    && !/^@(?:css|json|xpath|js):/i.test(text)
  let value = input
  tokens.forEach((token, index) => {
    if (index === 0 && startsWithAccessor) {
      value = applyAccessor(value, token)
      return
    }
    if ((index === 0 && !isAccessor(token)) || isSelectorToken(token)) {
      value = selectValues(value, normalizeSelectorToken(token))
      return
    }
    value = applyAccessor(value, token)
  })
  return value
}

function selectValues(input, selector) {
  if (typeof input === 'object' && input !== null && !Array.isArray(input)) {
    const byPath = readJsonPath(input, selector)
    if (Array.isArray(byPath) ? byPath.length : byPath) return byPath
  }

  if (/^(?:xpath:|\/\/)/i.test(selector)) {
    return selectXPath(input, String(selector).replace(/^xpath:/i, ''))
  }
  return asArray(input).flatMap(fragment => selectHtml(String(fragment || ''), selector))
}

function selectHtml(html, selector) {
  if (typeof DOMParser !== 'undefined') {
    try {
      const document = new DOMParser().parseFromString(String(html || ''), 'text/html')
      const nodes = Array.from(document.querySelectorAll(String(selector || '')))
      if (nodes.length) return nodes.map(node => node.outerHTML || node.textContent || '')
    } catch (error) {
      // Continue with the deterministic parser used by Node tests and older WebViews.
    }
  }
  const steps = String(selector || '').split(/\s+|>/).map(item => item.trim()).filter(Boolean)
  if (!steps.length) return [html]
  let current = [html]
  steps.forEach(step => {
    current = current.flatMap(fragment => selectSimpleHtml(fragment, step))
  })
  return current
}

function selectSimpleHtml(html, selector) {
  const excludeMatch = String(selector || '').match(/^(.*)!(\d+)$/)
  const excludeFirst = /:not\(\s*:first-child\s*\)$/i.test(String(selector || ''))
  const normalizedSelector = String(selector || '')
    .replace(/:not\(\s*:first-child\s*\)$/i, '')
    .replace(/:nth-child\(n\)$/i, '')
    .replace(/!(\d+)$/, '')
  const pseudo = extractSelectorPseudo(normalizedSelector)
  const indexMatch = pseudo.selector.match(/^(.*?)(?:\.|\[)(\d+)\]?$/)
  const cleanSelector = indexMatch ? indexMatch[1] : pseudo.selector
  const requestedIndex = indexMatch ? Number(indexMatch[2]) : pseudo.index
  const { tag, id, classNames, attr } = parseSimpleSelector(cleanSelector)

  if (id || classNames.length || attr) {
    const tagged = selectByAttribute(html, id, classNames, attr, tag)
    if (excludeMatch) return tagged.filter((_, index) => index !== Number(excludeMatch[2]))
    if (excludeFirst) return tagged.slice(1)
    if (requestedIndex === 'last') return tagged.length ? [tagged[tagged.length - 1]] : []
    if (requestedIndex !== null) return tagged[requestedIndex] ? [tagged[requestedIndex]] : []
    return tagged
  }

  const tagPattern = tag || '[a-zA-Z][\\w:-]*'
  const pattern = new RegExp(`<(${tagPattern})([^>]*)>`, 'gi')
  const matches = []
  let match

  while ((match = pattern.exec(html))) {
    const attrs = match[2] || ''
    if (id && !new RegExp(`\\bid=["']?${escapeRegExp(id)}["']?`, 'i').test(attrs)) continue
    if (!hasRequiredClasses(attrs, classNames)) continue
    if (attr && !matchesAttributeSelector(attrs, attr)) continue
    matches.push(sliceBalancedElement(html, match.index, pattern.lastIndex, match[1], match[0]))
  }

  if (excludeMatch) return matches.filter((_, index) => index !== Number(excludeMatch[2]))
  if (excludeFirst) return matches.slice(1)
  if (requestedIndex === 'last') return matches.length ? [matches[matches.length - 1]] : []
  if (requestedIndex !== null) return matches[requestedIndex] ? [matches[requestedIndex]] : []
  return matches
}

function selectByAttribute(html, id, classNames = [], attr = null, tagName = '') {
  const pattern = /<([a-zA-Z][\w:-]*)([^>]*)>/gi
  const matches = []
  let match

  while ((match = pattern.exec(html))) {
    const tag = match[1]
    const attrs = match[2] || ''
    if (tagName && tag.toLowerCase() !== String(tagName).toLowerCase()) continue
    if (id && !new RegExp(`\\bid=["']?${escapeRegExp(id)}["']?`, 'i').test(attrs)) continue
    if (!hasRequiredClasses(attrs, classNames)) continue
    if (attr && !matchesAttributeSelector(attrs, attr)) continue

    matches.push(sliceBalancedElement(html, match.index, pattern.lastIndex, tag, match[0]))
  }

  return matches
}

function sliceBalancedElement(html, start, openEnd, tag, openingTag) {
  if (/\/>$/.test(openingTag) || /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i.test(tag)) {
    return html.slice(start, openEnd)
  }
  const pattern = new RegExp(`<\\/?${escapeRegExp(tag)}\\b[^>]*>`, 'gi')
  pattern.lastIndex = openEnd
  let depth = 1
  let token
  while ((token = pattern.exec(html))) {
    if (/^<\//.test(token[0])) depth -= 1
    else if (!/\/>$/.test(token[0])) depth += 1
    if (depth === 0) return html.slice(start, pattern.lastIndex)
  }
  return html.slice(start, openEnd)
}

function parseSimpleSelector(selector) {
  const rawAttrMatch = selector.match(/^(.*?)(\[[^\]]+\])$/)
  const parsedAttr = rawAttrMatch ? parseAttributeSelector(rawAttrMatch[2]) : null
  const attrMatch = parsedAttr ? rawAttrMatch : null
  const baseSelector = attrMatch ? attrMatch[1] : selector
  const attr = parsedAttr
  const tagMatch = baseSelector.match(/^([a-zA-Z][\w:-]*)/)
  const tag = tagMatch ? tagMatch[1] : ''
  const suffix = baseSelector.slice(tag.length)
  const idMatch = suffix.match(/#([\w-]+)/)
  const classNames = [...suffix.matchAll(/\.([\w\-\[\]]+)/g)].map(match => match[1])

  if (suffix && suffix.replace(/#[\w-]+|\.[\w\-\[\]]+/g, '')) {
    return { tag: baseSelector || '', id: '', classNames: [], attr }
  }

  return { tag, id: idMatch ? idMatch[1] : '', classNames, attr }
}

function hasRequiredClasses(attrs, classNames = []) {
  const expected = Array.isArray(classNames) ? classNames : [classNames]
  const match = String(attrs || '').match(/\bclass=["']([^"']*)["']/i)
  if (!match) return expected.length === 0
  const actual = new Set(String(match[1] || '').split(/\s+/).filter(Boolean))
  return expected.every(className => actual.has(className))
}

function extractSelectorPseudo(selector) {
  const text = String(selector || '').trim()
  const indexed = text.match(/^(.*?):nth-(?:of-type|child)\((\d+)\)$/i)
  if (indexed) return { selector: indexed[1], index: Math.max(0, Number(indexed[2]) - 1) }
  if (/:last-child$/i.test(text)) return { selector: text.replace(/:last-child$/i, ''), index: 'last' }
  if (/:first-child$/i.test(text)) return { selector: text.replace(/:first-child$/i, ''), index: 0 }
  return { selector: text, index: null }
}

function parseAttributeSelector(selector) {
  const match = String(selector || '').match(/^\[\s*([\w:-]+)\s*(\*?=)\s*["']?([^"'\]]*)["']?\s*\]$/)
  if (!match) return null
  return {
    name: match[1],
    operator: match[2],
    value: match[3]
  }
}

function matchesAttributeSelector(attrs, attr) {
  if (!attr || !attr.name) return true
  const value = extractAttr(`<x ${attrs}></x>`, attr.name)
  if (!value) return false
  return attr.operator === '*=' ? value.includes(attr.value) : value === attr.value
}

function applyAccessor(input, accessor) {
  const token = String(accessor || '').replace(/^@/, '')
  if (token === 'text' || token === 'textNodes') return extractText(input)
  if (token === 'ownText') return extractOwnText(input)
  if (token === 'html') return asArray(input).join('')
  if (token === 'children') return asArray(input).flatMap(extractDirectChildren)
  if (/^\d+$/.test(token)) return asArray(input)[Number(token)] || ''
  if (/^-\d+$/.test(token)) {
    const values = asArray(input)
    return values[values.length + Number(token)] || ''
  }
  if (/^!\d+$/.test(token)) return asArray(input).slice().reverse()[Number(token.slice(1))] || ''
  if (token.startsWith('$.')) return readJsonPath(input, token)

  const values = asArray(input).map(item => extractAttr(item, token)).filter(Boolean)
  return values.length > 1 ? values : values[0] || ''
}

function extractText(input) {
  const values = asArray(input).map(item => {
    if (typeof item === 'object' && item !== null) return cleanText(JSON.stringify(item))
    return cleanText(item)
  }).filter(Boolean)
  return values.length > 1 ? values : values[0] || ''
}

function extractOwnText(input) {
  const values = asArray(input).map(item => cleanText(String(item || '')
    .replace(/<([a-zA-Z][\w:-]*)\b[^>]*>[\s\S]*?<\/\1>/g, ' ')))
    .filter(Boolean)
  return values.length > 1 ? values : values[0] || ''
}

function selectXPath(input, expression) {
  if (typeof DOMParser === 'undefined' || typeof document === 'undefined' || !document.evaluate) {
    return selectSimpleXPath(input, expression)
  }
  const output = []
  asArray(input).forEach(fragment => {
    try {
      const parsed = new DOMParser().parseFromString(String(fragment || ''), 'text/html')
      const snapshot = parsed.evaluate(
        String(expression || ''),
        parsed,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      )
      for (let index = 0; index < snapshot.snapshotLength; index += 1) {
        const node = snapshot.snapshotItem(index)
        output.push(node && (node.outerHTML || node.nodeValue || node.textContent) || '')
      }
    } catch (error) {
      // Invalid XPath returns an empty result and can fall back through ||.
    }
  })
  return output
}

function selectSimpleXPath(input, expression) {
  const text = String(expression || '').trim()
  if (!/^\/\//.test(text) || /\||::|\b(?:contains|starts-with|normalize-space)\s*\(/i.test(text)) return []
  const steps = text.replace(/^\/+/, '').split(/\/+|\/\//).map(item => item.trim()).filter(Boolean)
  let values = asArray(input)
  for (const step of steps) {
    if (step === 'text()') {
      values = asArray(extractText(values))
      continue
    }
    const attrOnly = step.match(/^@([\w:-]+)$/)
    if (attrOnly) {
      values = asArray(applyAccessor(values, attrOnly[1]))
      continue
    }
    const matched = step.match(/^([a-zA-Z][\w:-]*|\*)(?:\[@(class|id|[\w:-]+)=['"]([^'"]+)['"]\])?(?:\[(\d+)\])?$/)
    if (!matched) return []
    const tag = matched[1] === '*' ? '' : matched[1]
    const attr = matched[2]
    const attrValue = matched[3]
    let selector = tag || '*'
    if (attr === 'class') selector += `.${attrValue.split(/\s+/).filter(Boolean).join('.')}`
    else if (attr === 'id') selector += `#${attrValue}`
    else if (attr) selector += `[${attr}="${attrValue}"]`
    values = values.flatMap(fragment => selectHtml(String(fragment || ''), selector))
    if (matched[4]) {
      const index = Math.max(0, Number(matched[4]) - 1)
      values = values[index] == null ? [] : [values[index]]
    }
  }
  return values
}

function extractAttr(input, attr) {
  if (typeof input === 'object' && input !== null) return input[attr] || ''
  const quoted = String(input || '').match(new RegExp(`\\b${escapeRegExp(attr)}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'))
  if (quoted) return decodeHtml(quoted[2])
  const unquoted = String(input || '').match(new RegExp(`\\b${escapeRegExp(attr)}\\s*=\\s*([^\\s>]+)`, 'i'))
  return unquoted ? decodeHtml(unquoted[1]) : ''
}

function readJsonPath(input, path) {
  if (typeof input !== 'object' || input === null) return ''
  const recursive = String(path || '').match(/^\$\.\.([A-Za-z_$][\w$]*)$/)
  if (recursive) {
    const matches = []
    const visit = value => {
      if (!value || typeof value !== 'object') return
      if (Object.prototype.hasOwnProperty.call(value, recursive[1])) matches.push(value[recursive[1]])
      Object.values(value).forEach(visit)
    }
    visit(input)
    const flattened = matches.flat()
    return flattened.length > 1 ? flattened : flattened[0] == null ? '' : flattened[0]
  }
  const filter = String(path || '').match(/^([\s\S]*?)\[\?\(@\.([A-Za-z_$][\w$]*)\s*(==|!=)\s*([^\]]+?)\)\]([\s\S]*)$/)
  if (filter) {
    const candidates = asArray(readJsonPath(input, filter[1] || '$.*')).flat()
    const expected = parseJsonPathFilterValue(filter[4])
    const filtered = candidates.filter(item => {
      const actual = item && typeof item === 'object' ? item[filter[2]] : undefined
      return filter[3] === '==' ? actual == expected : actual != expected // Legado JSONPath uses loose scalar comparison.
    })
    if (!filter[5]) return filtered
    const mapped = filtered.flatMap(item => asArray(readJsonPath(item, `$${filter[5]}`)))
    return mapped.length > 1 ? mapped : mapped[0] == null ? '' : mapped[0]
  }
  const normalized = String(path || '').replace(/^\$\./, '').replace(/\[(\d+|\*)\]/g, '.$1')
  const parts = normalized.split('.').filter(Boolean)
  let values = [input]

  parts.forEach(part => {
    values = values.flatMap(item => {
      if (part === '*') return Array.isArray(item) ? item : Object.values(item || {})
      if (Array.isArray(item) && /^\d+$/.test(part)) return item[Number(part)] == null ? [] : [item[Number(part)]]
      if (item && Object.prototype.hasOwnProperty.call(item, part)) return [item[part]]
      return []
    })
  })

  const flattened = values.flat()
  return flattened.length > 1 ? flattened : flattened[0] == null ? '' : flattened[0]
}

function parseJsonPathFilterValue(value) {
  const text = String(value || '').trim()
  if ((text[0] === '"' && text[text.length - 1] === '"') || (text[0] === "'" && text[text.length - 1] === "'")) return text.slice(1, -1)
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text)
  if (text === 'true') return true
  if (text === 'false') return false
  if (text === 'null') return null
  return text
}

function extractDirectChildren(fragment) {
  const html = String(fragment || '').trim()
  const opening = html.match(/^<([a-zA-Z][\w:-]*)\b[^>]*>/)
  let inner = html
  if (opening) {
    const closing = new RegExp(`<\/${escapeRegExp(opening[1])}\\s*>\\s*$`, 'i')
    inner = html.replace(opening[0], '').replace(closing, '')
  }

  const tokens = /<\/?([a-zA-Z][\w:-]*)\b[^>]*>/g
  const voidTags = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i
  const children = []
  let depth = 0
  let start = -1
  let token
  while ((token = tokens.exec(inner))) {
    const full = token[0]
    const closing = /^<\//.test(full)
    const selfClosing = /\/>$/.test(full) || voidTags.test(token[1])
    if (!closing) {
      if (depth === 0) start = token.index
      if (!selfClosing) depth += 1
      else if (depth === 0 && start >= 0) {
        children.push(inner.slice(start, tokens.lastIndex))
        start = -1
      }
      continue
    }
    if (depth > 0) depth -= 1
    if (depth === 0 && start >= 0) {
      children.push(inner.slice(start, tokens.lastIndex))
      start = -1
    }
  }
  return children
}

function replaceValue(input, pattern, replacement) {
  const regex = new RegExp(pattern, 'g')
  if (Array.isArray(input)) return input.map(item => String(item || '').replace(regex, replacement))
  return String(input || '').replace(regex, replacement)
}

function renderObject(object, context) {
  return Object.keys(object || {}).reduce((result, key) => {
    result[key] = renderTemplate(object[key], context)
    return result
  }, {})
}

function splitFallbacks(rule) {
  return String(rule || '').split('||').map(item => item.trim()).filter(Boolean)
}

function isAccessor(token) {
  return /^(?:text|textNodes|ownText|html|children|href|src|content|value|-?\d+|!\d+|\$\..+)$/.test(String(token || ''))
}

function isSelectorToken(token) {
  const value = String(token || '').trim()
  if (isAccessor(value)) return false
  return /^(class\.|id\.|tag\.|css:|xpath:|json:|\/\/|#|\.)/i.test(value)
    || /^[a-zA-Z][\w:-]*(?:[#.\[:!][\s\S]*)?$/.test(value)
}

function normalizeSelectorToken(token) {
  const value = String(token || '').trim()
  if (/^css:/i.test(value)) return value.replace(/^css:/i, '')
  if (value.startsWith('class.')) return `.${value.slice(6).split(/\s+/).filter(Boolean).join('.')}`
  if (value.startsWith('id.')) return `#${value.slice(3)}`
  if (value.startsWith('tag.')) return value.slice(4)
  return value
}

function asArray(value) {
  if (Array.isArray(value)) return value
  return value == null || value === '' ? [] : [value]
}

function trimTrailingSlash(url) {
  return String(url || '').replace(/\/+$/, '')
}

function ensureBaseUrl(url) {
  const value = String(url || '').trim()
  if (/^https?:\/\//i.test(value)) return value
  return value ? `https://${value}` : 'https://example.com'
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractEmbeddedJsonPayload(html) {
  const blocks = [...String(html || '').matchAll(/<(textarea|pre|code)([^>]*)>([\s\S]*?)<\/\1>/gi)]
  for (const block of blocks) {
    const attrs = block[2] || ''
    const decoded = decodeHtml(block[3]).trim()
    const looksLikeSource = /jsonpre|layui-code|bookSource(Name|Url)|sources/i.test(attrs + decoded)
    if (!looksLikeSource) continue
    const sliced = sliceJsonLike(decoded)
    if (sliced) return sliced
  }
  return ''
}

function sliceJsonLike(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (raw[0] === '[' || raw[0] === '{') return raw
  const arrayStart = raw.indexOf('[')
  const arrayEnd = raw.lastIndexOf(']')
  if (arrayStart >= 0 && arrayEnd > arrayStart) return raw.slice(arrayStart, arrayEnd + 1)
  const objectStart = raw.indexOf('{')
  const objectEnd = raw.lastIndexOf('}')
  if (objectStart >= 0 && objectEnd > objectStart) return raw.slice(objectStart, objectEnd + 1)
  return ''
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(value)
  } catch (error) {
    return value
  }
}
