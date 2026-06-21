const COOKIE_JAR_KEY = 'sources:cookie-jar:v1'
const memory = {}

function readJar() {
  try {
    if (typeof uni !== 'undefined' && uni.getStorageSync) {
      const value = uni.getStorageSync(COOKIE_JAR_KEY)
      return value && typeof value === 'object' ? value : {}
    }
  } catch (error) {}
  return { ...memory }
}

function writeJar(value) {
  Object.keys(memory).forEach(key => delete memory[key])
  Object.assign(memory, value)
  try {
    if (typeof uni !== 'undefined' && uni.setStorageSync) uni.setStorageSync(COOKIE_JAR_KEY, value)
  } catch (error) {}
}

function hostOf(url) {
  try { return new URL(String(url || '')).hostname.toLowerCase() } catch (error) { return '' }
}

function entryKey(sourceId, host) {
  return `${String(sourceId || '')}::${String(host || '')}`
}

export function saveSourceCookie(sourceId, url, cookie, options = {}) {
  const host = hostOf(url)
  const value = String(cookie || '').trim()
  if (!sourceId || !host || !value) return false
  const jar = readJar()
  jar[entryKey(sourceId, host)] = {
    sourceId: String(sourceId), host, cookie: value,
    expiresAt: Number(options.expiresAt || 0), updatedAt: Date.now()
  }
  writeJar(jar)
  return true
}

export function getSourceCookie(sourceId, url) {
  const host = hostOf(url)
  const jar = readJar()
  const key = entryKey(sourceId, host)
  const entry = jar[key]
  if (!entry) return ''
  if (entry.expiresAt && entry.expiresAt <= Date.now()) {
    delete jar[key]
    writeJar(jar)
    return ''
  }
  return String(entry.cookie || '')
}

export function clearSourceCookies(sourceId) {
  const jar = readJar()
  let removed = 0
  Object.keys(jar).forEach(key => {
    if (jar[key] && jar[key].sourceId === String(sourceId)) { delete jar[key]; removed += 1 }
  })
  writeJar(jar)
  return removed
}

export function getSourceCookieSummary(sourceId) {
  const jar = readJar()
  return Object.values(jar).filter(entry => entry && entry.sourceId === String(sourceId)).map(entry => ({
    host: entry.host,
    cookie: `[REDACTED:${String(entry.cookie || '').length}]`,
    expiresAt: Number(entry.expiresAt || 0),
    updatedAt: Number(entry.updatedAt || 0)
  }))
}
