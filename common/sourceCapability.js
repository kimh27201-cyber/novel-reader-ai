import {
  detectSourceCompatibilityLevel,
  detectSourceFeatures,
  detectSourceFormat,
  hasUnsupportedRule
} from './sourceEngine.js'
import { getSourceCookie } from './sourceCookieJar.js'

function normalizeRuleObject(rule) {
  if (!rule) return {}
  if (typeof rule === 'object') return rule
  try {
    return JSON.parse(rule)
  } catch (error) {
    return {}
  }
}

function sourceRaw(source = {}) {
  return source && (source.raw || source) || {}
}

function hasRule(raw, names = []) {
  return names.some(name => Object.keys(normalizeRuleObject(raw[name])).length > 0)
}

function hasTextField(raw, names = []) {
  return names.some(name => {
    const value = raw[name]
    return value !== false && value != null && String(value).trim() !== ''
  })
}

function sourceText(raw) {
  try {
    return JSON.stringify(raw || {})
  } catch (error) {
    return String(raw || '')
  }
}

function hasCookieNeed(raw) {
  const text = sourceText(raw)
  if (/cookie\./i.test(text)) return true
  if (/"cookie"\s*:/i.test(text) || /\bCookie\s*:/i.test(text)) return true
  return hasTextField(raw, ['loginUrl', 'loginUi', 'loginCheck'])
}

function detectJsMode(raw, features) {
  const text = sourceText(raw)
  if (/webview|window\.|document\.|DOMStorage|localStorage|sessionStorage/i.test(text)) return 'browser-only'
  if (/<js>|\bjava\.|\beval\s*\(|\bFunction\s*\(/i.test(text) || features.js) return 'builtin-only'
  return 'none'
}

export function buildSourceCapability(source = {}, options = {}) {
  const raw = sourceRaw(source)
  const features = source.features || detectSourceFeatures(raw)
  const levelInfo = detectSourceCompatibilityLevel(raw, options.environment || {})
  const text = sourceText(raw)
  const supportsSearch = hasTextField(raw, ['searchUrl']) && hasRule(raw, ['ruleSearch'])
  const supportsExplore = hasTextField(raw, ['exploreUrl', 'ruleExploreUrl', 'explore']) && hasRule(raw, ['ruleExplore', 'ruleSearch'])
  const supportsDetail = hasRule(raw, ['ruleBookInfo'])
  const supportsToc = hasRule(raw, ['ruleToc'])
  const supportsContent = hasRule(raw, ['ruleContent'])
  const requiresWebView = !!features.webView || /webview/i.test(text)
  const requiresJsDom = /window\.|document\.|DOMStorage|localStorage|sessionStorage/i.test(text)
  const requiresRenderedHtml = requiresWebView || requiresJsDom || levelInfo.level === 'need_webview'
  const savedCookie = getSourceCookie(source.id, source.baseUrl || raw.bookSourceUrl || raw.sourceUrl || raw.baseUrl || '')
  const requiresCookie = hasCookieNeed(raw)
  const requiresLogin = hasTextField(raw, ['loginUrl', 'loginUi', 'loginCheck'])
  const jsMode = detectJsMode(raw, features)
  const notes = []

  if (!supportsExplore) notes.push('No directly parsable explore entry.')
  if (requiresCookie) notes.push('Session or Cookie may be required.')
  if (requiresWebView) notes.push('WebView-assisted lane may be required.')
  if (requiresRenderedHtml) notes.push('Rendered DOM may be required.')
  if (hasUnsupportedRule(raw)) notes.push('Contains rules blocked by the H5 engine.')
  if (savedCookie) notes.push('Saved Cookie is available.')

  const lastSuccessfulLane = source.health && source.health.bestLane
    || source.lastSuccessfulLane
    || ''

  return {
    sourceId: source.id || raw.id || '',
    sourceName: source.name || raw.bookSourceName || raw.name || '',
    sourceGroup: source.group || raw.bookSourceGroup || '',
    formatVersion: source.formatVersion || detectSourceFormat(raw),
    supportsSearch,
    supportsExplore,
    supportsDetail,
    supportsToc,
    supportsContent,
    requiresCookie,
    requiresLogin,
    requiresJsDom,
    requiresWebView,
    requiresRenderedHtml,
    jsMode,
    lastSuccessfulLane,
    riskLevel: requiresCookie || requiresLogin ? 'session-required' : requiresRenderedHtml ? 'browser-assisted' : 'trusted-http',
    compatibilityLevel: levelInfo.level,
    environmentSupported: levelInfo.environmentSupported,
    notes
  }
}

export function sourceCapabilitySummary(capability = {}) {
  const lanes = []
  if (!capability.requiresRenderedHtml && !capability.requiresCookie) lanes.push('HTTP')
  if (capability.requiresCookie) lanes.push('HTTP+Cookie')
  if (capability.jsMode === 'builtin-only') lanes.push('Rule JS')
  if (capability.requiresWebView) lanes.push('WebView')
  if (capability.requiresRenderedHtml) lanes.push('Rendered DOM')
  return lanes.length ? lanes.join(' / ') : 'HTTP'
}
