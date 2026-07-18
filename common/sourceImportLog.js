const IMPORT_LOGS_KEY = 'sources:import-logs'
const MAX_IMPORT_LOGS = 30

const memoryStore = {}

function getStorage(key, defaultValue) {
  try {
    if (typeof uni !== 'undefined' && uni.getStorageSync) {
      const value = uni.getStorageSync(key)
      return value === '' || value == null ? defaultValue : value
    }
  } catch (error) {
    return defaultValue
  }
  return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : defaultValue
}

function setStorage(key, value) {
  try {
    if (typeof uni !== 'undefined' && uni.setStorageSync) {
      uni.setStorageSync(key, value)
      return
    }
  } catch (error) {
    // fall through to memory store
  }
  memoryStore[key] = value
}

function normalizeItem(item = {}) {
  const raw = item && typeof item === 'object' ? item : {}
  return {
    name: String(raw.name || ''),
    url: String(raw.url || ''),
    status: String(raw.status || 'failed'),
    reason: String(raw.reason || ''),
    h5Unsupported: !!raw.h5Unsupported,
    unsupportedReason: String(raw.unsupportedReason || raw.reason || ''),
    saved: !!raw.saved
  }
}

function firstDefined(...values) {
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] !== undefined && values[index] !== null) {
      return values[index]
    }
  }
  return undefined
}

export function normalizeImportLog(log = {}) {
  const raw = log && typeof log === 'object' ? log : {}
  const items = Array.isArray(raw.items) ? raw.items.map(normalizeItem) : []
  const total = Number(firstDefined(raw.total, raw.parsedCount, items.length, 0))
  const success = Number(firstDefined(raw.success, raw.successCount, 0))
  const failed = Number(firstDefined(raw.failed, raw.failedCount, 0))
  const skipped = Number(firstDefined(raw.skipped, raw.skippedCount, 0))
  const duplicated = Number(firstDefined(raw.duplicated, raw.duplicatedCount, 0))
  const unsupported = Number(firstDefined(raw.unsupported, raw.unsupportedCount, raw.incompatibleCount, 0))
  const failureReasons = Array.isArray(raw.failureReasons)
    ? raw.failureReasons
    : items
      .filter(item => item.status !== 'success' && item.reason)
      .map(item => item.reason)
  return {
    id: String(raw.id || Date.now()),
    time: raw.time || (raw.importTime ? new Date(raw.importTime).toISOString() : new Date().toISOString()),
    source: String(raw.source || 'unknown'),
    rawType: String(raw.rawType || raw.originalType || 'unknown'),
    sourceText: String(raw.sourceText || raw.sourceUrl || ''),
    total,
    success,
    failed,
    skipped,
    duplicated,
    unsupported,
    items,
    storageCount: Number(raw.storageCount || 0),
    importTime: raw.importTime || Date.parse(raw.time || '') || Date.now(),
    sourceUrl: String(raw.sourceUrl || raw.sourceText || ''),
    originalType: String(raw.originalType || raw.rawType || 'unknown'),
    parsedCount: total,
    successCount: Number(firstDefined(raw.successCount, success + unsupported)),
    failedCount: failed,
    skippedCount: skipped + duplicated,
    duplicatedCount: duplicated,
    unsupportedCount: unsupported,
    failureReasons
  }
}

export function getImportLogs(limit = MAX_IMPORT_LOGS) {
  const logs = getStorage(IMPORT_LOGS_KEY, [])
  const rows = Array.isArray(logs) ? logs : []
  return rows.map(normalizeImportLog).slice(0, Math.max(0, Number(limit) || MAX_IMPORT_LOGS))
}

export function saveImportLog(log) {
  const current = getImportLogs(MAX_IMPORT_LOGS)
  const normalized = normalizeImportLog(log)
  const next = [normalized, ...current].slice(0, MAX_IMPORT_LOGS)
  setStorage(IMPORT_LOGS_KEY, next)
  return normalized
}

export function clearImportLogs() {
  setStorage(IMPORT_LOGS_KEY, [])
}
