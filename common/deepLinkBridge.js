const EMPTY_PAYLOAD = { ok: false, reason: 'empty' }

function getBridge(env = globalThis) {
  return env && env.NovelReaderDeepLinkBridge
    || typeof window !== 'undefined' && window.NovelReaderDeepLinkBridge
    || typeof globalThis !== 'undefined' && globalThis.NovelReaderDeepLinkBridge
    || null
}

function parseBridgePayload(raw) {
  if (!raw) return EMPTY_PAYLOAD
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(String(raw))
  } catch (error) {
    return EMPTY_PAYLOAD
  }
}

export function hasNativeDeepLinkBridge(env = globalThis) {
  const bridge = getBridge(env)
  return !!(bridge && typeof bridge.peekDeepLink === 'function')
}

export function peekNativeDeepLink(env = globalThis) {
  const bridge = getBridge(env)
  if (!bridge || typeof bridge.peekDeepLink !== 'function') return EMPTY_PAYLOAD
  try {
    return parseBridgePayload(bridge.peekDeepLink())
  } catch (error) {
    return { ok: false, reason: 'peek-failed' }
  }
}

export function ackNativeDeepLink(id, env = globalThis) {
  const bridge = getBridge(env)
  if (!id || !bridge || typeof bridge.ackDeepLink !== 'function') return false
  try {
    return bridge.ackDeepLink(String(id)) === true
  } catch (error) {
    return false
  }
}

export function normalizeDeepLinkToImportInput(rawUri) {
  const raw = String(rawUri || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (!/^(?:yuedu|legado):\/\//i.test(raw)) return raw

  const paramNames = ['url', 'src', 'source', 'data', 'content', 'json', 'sourceUrl', 'bookSourceUrl']
  try {
    const parsed = new URL(raw)
    for (const name of paramNames) {
      const value = parsed.searchParams.get(name)
      if (value && value.trim()) return value.trim()
    }
  } catch (error) {
    // Fall back to query parsing below.
  }

  const query = raw.split('?')[1] || ''
  for (const name of paramNames) {
    const match = query.match(new RegExp(`(?:^|&)${name}=([^&]+)`, 'i'))
    if (!match || !match[1]) continue
    try {
      return decodeURIComponent(match[1]).trim()
    } catch (error) {
      return match[1].trim()
    }
  }
  return raw
}

export async function hydrateImportInputFromNativeBridge(options = {}) {
  const env = options.env || globalThis
  const payload = peekNativeDeepLink(env)
  if (!payload || !payload.ok || !payload.uri) return null

  const input = normalizeDeepLinkToImportInput(payload.uri)
  if (!input || !input.trim()) return null

  const uniApi = options.uniApi || globalThis.uni
  if (uniApi && uniApi.setStorageSync) {
    try {
      uniApi.setStorageSync('pending_deeplink_import_input', input.trim())
    } catch (error) {
      // Storage is best-effort; the caller still receives the input.
    }
  }

  return {
    id: payload.id || '',
    uri: payload.uri,
    input: input.trim(),
    createdAt: payload.createdAt || 0,
    source: payload.source || ''
  }
}
