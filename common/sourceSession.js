export const SOURCE_SESSIONS_KEY = 'sources:sessions'

const memoryStore = {}

function readStorage(key, fallback) {
  try {
    if (typeof uni !== 'undefined' && uni.getStorageSync) {
      const value = uni.getStorageSync(key)
      return value === '' || value == null ? fallback : value
    }
  } catch (error) {
    return fallback
  }
  return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : fallback
}

function writeStorage(key, value) {
  try {
    if (typeof uni !== 'undefined' && uni.setStorageSync) {
      uni.setStorageSync(key, value)
      return
    }
  } catch (error) {
    // fall through to memory
  }
  memoryStore[key] = value
}

function normalizeTimestamp(value) {
  const number = Number(value || 0)
  return Number.isFinite(number) ? number : 0
}

export function normalizeSourceSession(sourceId, value = {}) {
  const raw = value && typeof value === 'object' ? value : {}
  return {
    id: raw.id || `${sourceId || raw.sourceId || 'source'}-${Date.now()}`,
    sourceId: sourceId || raw.sourceId || '',
    lane: raw.lane || 'manual-cookie',
    origin: String(raw.origin || ''),
    cookie: String(raw.cookie || raw.cookieHeader || ''),
    userAgent: String(raw.userAgent || ''),
    referer: String(raw.referer || ''),
    storageStateJson: String(raw.storageStateJson || raw.storage_state_json || ''),
    localStorageJson: String(raw.localStorageJson || raw.local_storage_json || ''),
    sessionStorageJson: String(raw.sessionStorageJson || raw.session_storage_json || ''),
    expiresAt: normalizeTimestamp(raw.expiresAt || raw.expires_at),
    lastVerifiedAt: normalizeTimestamp(raw.lastVerifiedAt || raw.last_verified_at),
    updatedAt: normalizeTimestamp(raw.updatedAt) || Date.now(),
    status: raw.status || 'active'
  }
}

function getSessionStore() {
  const store = readStorage(SOURCE_SESSIONS_KEY, {})
  return store && typeof store === 'object' ? store : {}
}

function writeSessionStore(store) {
  writeStorage(SOURCE_SESSIONS_KEY, store && typeof store === 'object' ? store : {})
}

export function getSourceSession(sourceId) {
  if (!sourceId) return null
  const session = getSessionStore()[sourceId]
  return session ? normalizeSourceSession(sourceId, session) : null
}

export function getActiveSourceSession(sourceId) {
  const session = getSourceSession(sourceId)
  return sourceSessionStatus(session) === 'active' ? session : null
}

export function saveSourceSession(sourceId, session = {}) {
  if (!sourceId) throw new Error('sourceId is required')
  const store = getSessionStore()
  const normalized = normalizeSourceSession(sourceId, {
    ...session,
    sourceId,
    updatedAt: Date.now()
  })
  store[sourceId] = normalized
  writeSessionStore(store)
  return normalized
}

export function saveManualSourceSession(sourceId, session = {}) {
  return saveSourceSession(sourceId, {
    ...session,
    lane: session.lane || 'manual-cookie',
    status: session.status || 'active'
  })
}

export function clearSourceSession(sourceId) {
  if (!sourceId) return false
  const store = getSessionStore()
  const existed = !!store[sourceId]
  delete store[sourceId]
  writeSessionStore(store)
  return existed
}

export function sourceSessionStatus(session) {
  if (!session) return 'none'
  if (session.status && session.status !== 'active') return session.status
  if (session.expiresAt && session.expiresAt <= Date.now()) return 'expired'
  if (session.cookie || session.storageStateJson || session.localStorageJson || session.sessionStorageJson) return 'active'
  return 'empty'
}

export function buildSourceSessionHeaders(sourceId) {
  const session = getActiveSourceSession(sourceId)
  if (!session) return {}
  const headers = {}
  if (session.cookie) headers.Cookie = session.cookie
  if (session.userAgent) headers['User-Agent'] = session.userAgent
  if (session.referer) headers.Referer = session.referer
  return headers
}

export function getAllSourceSessions() {
  return getSessionStore()
}
