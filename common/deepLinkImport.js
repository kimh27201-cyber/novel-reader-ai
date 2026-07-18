import {
  buildImportPreview,
  detectImportInputType,
  normalizeBookSources,
  resolveImportInput
} from './bookSources.js'

export const PENDING_DEEP_LINK_IMPORT_KEY = 'import:pending-deep-link'
const EVENT_NAME = 'NovelReaderDeepLink'
const DUPLICATE_DEEP_LINK_WINDOW_MS = 3000
let lastHandledDeepLink = { uri: '', time: 0 }

function getUniApi(api) {
  return api || globalThis.uni || {}
}

export function extractDeepLinkUri(event) {
  const detail = event && event.detail !== undefined ? event.detail : event
  if (typeof detail === 'string') return detail.trim()
  if (!detail || typeof detail !== 'object') return ''
  return String(detail.uri || detail.url || detail.data || '').trim()
}

export function isImportableDeepLink(uri) {
  const raw = String(uri || '').trim()
  if (!raw) return false
  if (/^(?:yuedu|legado):\/\//i.test(raw)) return true
  const detected = detectImportInputType(raw)
  return ['import-link', 'json-url', 'repository-detail', 'repository-page', 'url', 'json'].includes(detected.type)
}

export function normalizeDeepLinkImportInput(uri) {
  const raw = String(uri || '').trim()
  if (!/^(?:yuedu|legado):\/\//i.test(raw)) return raw

  const paramNames = ['src', 'url', 'source', 'sourceUrl', 'bookSourceUrl', 'data']
  try {
    const parsed = new URL(raw)
    for (const name of paramNames) {
      const value = parsed.searchParams.get(name)
      if (value && value.trim()) return value.trim()
    }
  } catch (error) {
    // Fall through to the regex fallback for malformed but common deep links.
  }

  const query = raw.split('?')[1] || ''
  for (const name of paramNames) {
    const match = query.match(new RegExp(`(?:^|&)${name}=([^&]+)`, 'i'))
    if (match && match[1]) {
      try {
        return decodeURIComponent(match[1]).trim()
      } catch (error) {
        return match[1].trim()
      }
    }
  }
  return raw
}

export function readPendingDeepLinkImport(api) {
  const uniApi = getUniApi(api)
  try {
    return uniApi.getStorageSync ? uniApi.getStorageSync(PENDING_DEEP_LINK_IMPORT_KEY) || null : null
  } catch (error) {
    return null
  }
}

export function clearPendingDeepLinkImport(api) {
  const uniApi = getUniApi(api)
  try {
    if (uniApi.removeStorageSync) uniApi.removeStorageSync(PENDING_DEEP_LINK_IMPORT_KEY)
    else if (uniApi.setStorageSync) uniApi.setStorageSync(PENDING_DEEP_LINK_IMPORT_KEY, '')
  } catch (error) {
    // Ignore storage cleanup failures.
  }
}

export function consumeNativeDeepLinkImport(env = globalThis) {
  const bridge = env && env.NovelReaderDeepLinkBridge
  if (!bridge || typeof bridge.consumeDeepLink !== 'function') return null
  try {
    const uri = String(bridge.consumeDeepLink() || '').trim()
    if (!uri) return null
    return {
      uri,
      input: normalizeDeepLinkImportInput(uri),
      createdAt: Date.now()
    }
  } catch (error) {
    return null
  }
}

export function prepareDeepLinkImport(uri, options = {}) {
  const raw = String(uri || '').trim()
  if (!isImportableDeepLink(raw)) {
    throw new Error('No importable deep link payload was recognized')
  }

  const storage = getUniApi(options.storage)
  const navigator = getUniApi(options.navigator)
  const payload = {
    uri: raw,
    input: normalizeDeepLinkImportInput(raw),
    createdAt: Date.now()
  }

  if (storage.setStorageSync) {
    storage.setStorageSync(PENDING_DEEP_LINK_IMPORT_KEY, payload)
  }
  if (navigator.navigateTo) {
    navigator.navigateTo({ url: '/pages/import/scan?deepLink=1' })
  }
  return payload
}

export async function buildDeepLinkImportPreview(uri, options = {}) {
  const resolved = await resolveImportInput(normalizeDeepLinkImportInput(uri), options)
  if (resolved.action === 'navigate') {
    throw new Error('This deep link opens a source market list page, not a single importable source.')
  }
  return {
    ...buildImportPreview(normalizeBookSources(resolved.rawSources, resolved.sourceMeta), options.existingSources),
    sourceUrl: resolved.sourceUrl
  }
}

export function handleNovelReaderDeepLink(event, options = {}) {
  const uri = extractDeepLinkUri(event)
  if (!uri) return false
  const now = Date.now()
  if (lastHandledDeepLink.uri === uri && now - lastHandledDeepLink.time < DUPLICATE_DEEP_LINK_WINDOW_MS) {
    return true
  }
  lastHandledDeepLink = { uri, time: now }
  prepareDeepLinkImport(uri, options)
  return true
}

export function registerNovelReaderDeepLinkListener(env = globalThis, options = {}) {
  if (!env || typeof env.addEventListener !== 'function') return () => {}
  if (typeof env.__novelReaderDeepLinkUnsubscribe === 'function') {
    env.__novelReaderDeepLinkUnsubscribe()
  }
  const listener = event => {
    try {
      handleNovelReaderDeepLink(event, options)
    } catch (error) {
      const uniApi = getUniApi(options.navigator)
      if (uniApi.showToast) {
        uniApi.showToast({ title: error.message || '无法处理导入链接', icon: 'none' })
      }
    }
  }
  env.addEventListener(EVENT_NAME, listener)
  if (env.__novelReaderPendingDeepLink) {
    setTimeout(() => listener({ detail: env.__novelReaderPendingDeepLink }), 0)
  }
  const unsubscribe = () => {
    if (typeof env.removeEventListener === 'function') {
      env.removeEventListener(EVENT_NAME, listener)
    }
  }
  env.__novelReaderDeepLinkUnsubscribe = unsubscribe
  return unsubscribe
}
