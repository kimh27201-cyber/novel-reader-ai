import apiClient from './apiClient.js'

export const unsupportedRulePattern = /(<js>|<\/js>|@js:|java\.|cookie\.|webview|loginUrl|header\s*=|eval\()/i

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
  const base = String(source.bookSourceUrl || source.sourceUrl || source.name || source.bookSourceName || Date.now())
  let hash = 0
  for (let index = 0; index < base.length; index += 1) {
    hash = ((hash << 5) - hash) + base.charCodeAt(index)
    hash |= 0
  }
  return `source-${Math.abs(hash).toString(36)}`
}

export function normalizeSourceConfig(input, defaults = {}) {
  const raw = input.raw || input
  const name = raw.bookSourceName || raw.name || raw.sourceName || defaults.name || '未命名书源'
  const baseUrl = raw.bookSourceUrl || raw.sourceUrl || raw.baseUrl || defaults.baseUrl || ''
  const id = input.id || defaults.id || createSourceId(raw)
  const incompatible = hasUnsupportedRule(raw)

  return {
    id,
    name,
    baseUrl: trimTrailingSlash(baseUrl),
    group: raw.bookSourceGroup || raw.group || defaults.group || '用户导入',
    enabled: input.enabled !== undefined ? !!input.enabled : defaults.enabled !== undefined ? !!defaults.enabled : true,
    recommended: input.recommended !== undefined ? !!input.recommended : raw.recommended !== undefined ? !!raw.recommended : !!defaults.recommended,
    raw,
    compatibility: incompatible ? '不兼容 v1：包含 JS/Cookie/登录类规则' : 'v1 兼容',
    importedAt: input.importedAt !== undefined ? input.importedAt : defaults.importedAt !== undefined ? defaults.importedAt : Date.now(),
    updatedAt: Date.now()
  }
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

  if (/^(?:yuedu|legado):\/\//i.test(raw)) {
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
      const value = readJsonPath(context, name)
      return Array.isArray(value) ? value[0] || '' : value || ''
    }
    return context[name] == null ? '' : context[name]
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
  const text = renderTemplate(String(spec || '').trim(), context)
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
    options = {}
  }

  return {
    url: resolveUrl(match[1], baseUrl),
    method: String(options.method || (options.body ? 'POST' : 'GET')).toUpperCase(),
    header: renderObject(options.headers || options.header || {}, context),
    data: renderTemplate(options.body || options.data || '', context),
    charset: options.charset || ''
  }
}

export function requestText(spec) {
  const requestUrl = getRuntimeRequestUrl(spec.url)
  if (shouldUseBackendProxy(spec.url)) {
    return apiClient.proxyFetch(spec.url, {
      method: spec.method || 'GET',
      headers: spec.header || {},
      body: spec.data || '',
      charset: spec.charset || ''
    }).then(data => {
      if (data && typeof data.text === 'string') return data.text
      return typeof data === 'string' ? data : JSON.stringify(data || '')
    }).catch(() => directRequestText(requestUrl, spec))
  }

  return directRequestText(requestUrl, spec)
}

function directRequestText(requestUrl, spec) {
  if (typeof uni !== 'undefined' && uni.request) {
    return new Promise((resolve, reject) => {
      uni.request({
        url: requestUrl,
        method: spec.method || 'GET',
        header: spec.header || {},
        data: spec.data || undefined,
        timeout: 12000,
        responseType: 'text',
        success: response => {
          const data = response.data
          resolve(typeof data === 'string' ? data : JSON.stringify(data || ''))
        },
        fail: () => reject(new Error('网络请求失败'))
      })
    })
  }

  if (typeof fetch !== 'undefined') {
    return fetch(requestUrl, {
      method: spec.method || 'GET',
      headers: spec.header || {},
      body: spec.method === 'POST' ? spec.data : undefined
    }).then(response => response.text())
  }

  return Promise.reject(new Error('当前环境不支持网络请求'))
}

function shouldUseBackendProxy(url) {
  return /^https?:\/\//i.test(String(url || ''))
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
  if (hasUnsupportedRule(rule)) return ''
  if (typeof rule === 'object') return rule

  const options = splitFallbacks(String(rule))
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
  if (text === '@text' || text === 'text') return extractText(input)
  if (text === '@html' || text === 'html') return asArray(input).join('')
  if (text.startsWith('$.')) return readJsonPath(input, text)

  const tokens = text.split('@').map(item => item.trim()).filter(Boolean)
  let value = input
  tokens.forEach((token, index) => {
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

  return asArray(input).flatMap(fragment => selectHtml(String(fragment || ''), selector))
}

function selectHtml(html, selector) {
  const steps = String(selector || '').split(/\s+|>/).map(item => item.trim()).filter(Boolean)
  if (!steps.length) return [html]
  let current = [html]
  steps.forEach(step => {
    current = current.flatMap(fragment => selectSimpleHtml(fragment, step))
  })
  return current
}

function selectSimpleHtml(html, selector) {
  const indexMatch = selector.match(/^(.*?)(?:\.|\[)(\d+)\]?$/)
  const cleanSelector = indexMatch ? indexMatch[1] : selector
  const requestedIndex = indexMatch ? Number(indexMatch[2]) : null
  const { tag, id, className } = parseSimpleSelector(cleanSelector)

  if (!tag && (id || className)) {
    const tagged = selectByAttribute(html, id, className)
    if (requestedIndex !== null) return tagged[requestedIndex] ? [tagged[requestedIndex]] : []
    return tagged
  }

  const tagPattern = tag || '[a-zA-Z][\\w:-]*'
  const pattern = new RegExp(`<(${tagPattern})([^>]*)>([\\s\\S]*?)<\\/\\1>`, 'gi')
  const matches = []
  let match

  while ((match = pattern.exec(html))) {
    const attrs = match[2] || ''
    if (id && !new RegExp(`\\bid=["']?${escapeRegExp(id)}["']?`, 'i').test(attrs)) continue
    if (className && !new RegExp(`\\bclass=["'][^"']*\\b${escapeRegExp(className)}\\b`, 'i').test(attrs)) continue
    matches.push(match[0])
  }

  const selfClosing = new RegExp(`<(${tagPattern})([^>]*)\\/?>`, 'gi')
  while ((match = selfClosing.exec(html))) {
    const attrs = match[2] || ''
    if (!/^(img|input|meta|link|br)$/i.test(match[1])) continue
    if (id && !new RegExp(`\\bid=["']?${escapeRegExp(id)}["']?`, 'i').test(attrs)) continue
    if (className && !new RegExp(`\\bclass=["'][^"']*\\b${escapeRegExp(className)}\\b`, 'i').test(attrs)) continue
    matches.push(match[0])
  }

  if (requestedIndex !== null) return matches[requestedIndex] ? [matches[requestedIndex]] : []
  return matches
}

function selectByAttribute(html, id, className) {
  const pattern = /<([a-zA-Z][\w:-]*)([^>]*)>/gi
  const matches = []
  let match

  while ((match = pattern.exec(html))) {
    const tag = match[1]
    const attrs = match[2] || ''
    if (id && !new RegExp(`\\bid=["']?${escapeRegExp(id)}["']?`, 'i').test(attrs)) continue
    if (className && !new RegExp(`\\bclass=["'][^"']*\\b${escapeRegExp(className)}\\b`, 'i').test(attrs)) continue

    if (/^(img|input|meta|link|br)$/i.test(tag)) {
      matches.push(match[0])
      continue
    }

    const close = new RegExp(`<\\/${escapeRegExp(tag)}>`, 'i')
    const rest = html.slice(pattern.lastIndex)
    const closeMatch = rest.match(close)
    matches.push(closeMatch ? html.slice(match.index, pattern.lastIndex + closeMatch.index + closeMatch[0].length) : match[0])
  }

  return matches
}

function parseSimpleSelector(selector) {
  if (selector.startsWith('#')) return { id: selector.slice(1) }
  if (selector.startsWith('.')) return { className: selector.slice(1) }
  const classMatch = selector.match(/^([a-zA-Z][\w:-]*)?\.([\w-]+)$/)
  if (classMatch) return { tag: classMatch[1] || '', className: classMatch[2] }
  const idMatch = selector.match(/^([a-zA-Z][\w:-]*)?#([\w-]+)$/)
  if (idMatch) return { tag: idMatch[1] || '', id: idMatch[2] }
  return { tag: selector || '' }
}

function applyAccessor(input, accessor) {
  const token = String(accessor || '').replace(/^@/, '')
  if (token === 'text' || token === 'textNodes' || token === 'ownText') return extractText(input)
  if (token === 'html') return asArray(input).join('')
  if (/^\d+$/.test(token)) return asArray(input)[Number(token)] || ''
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

function extractAttr(input, attr) {
  if (typeof input === 'object' && input !== null) return input[attr] || ''
  const match = String(input || '').match(new RegExp(`\\b${escapeRegExp(attr)}=["']([^"']*)["']`, 'i'))
  return match ? decodeHtml(match[1]) : ''
}

function readJsonPath(input, path) {
  if (typeof input !== 'object' || input === null) return ''
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
  return /^(text|textNodes|ownText|html|href|src|content|value|\d+|\$\.)/.test(token)
}

function isSelectorToken(token) {
  return /^(class\.|id\.|tag\.|#|\.)/.test(String(token || ''))
}

function normalizeSelectorToken(token) {
  const value = String(token || '').trim()
  if (value.startsWith('class.')) return `.${value.slice(6)}`
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
