import {
  applyListRule,
  applyRule,
  cleanText,
  createSourceKey,
  detectSourceCompatibilityLevel,
  detectSourceFeatures,
  detectSourceFormat,
  detectSourceImportPayload,
  extractRepositorySourceUrl,
  hasUnsupportedRule,
  normalizeSourceConfig,
  parseRequestSpec,
  parseResponsePayload,
  renderTemplate,
  parseSourceJson,
  requestText,
  resolveUrl
} from './sourceEngine.js'
import { friendlyErrorMessage } from './uiFeedback.js'
import { normalizeHeaders } from './headerUtils.js'
import { asSourceRuntimeError, classifySourceFailure, SourceRuntimeError } from './sourceErrors.js'
import { clearSourceCookies, getSourceCookie } from './sourceCookieJar.js'
import { buildSourceSessionHeaders, getActiveSourceSession } from './sourceSession.js'
import { requestSourceText as requestSourceResponse } from './sourceTransport.js'
import {
  clearImportLogs as clearStoredImportLogs,
  getImportLogs as getStoredImportLogs,
  saveImportLog
} from './sourceImportLog.js'
import {
  assessReadableContentQuality,
  CONTENT_SANITIZER_VERSION,
  sanitizeReadableContent
} from './sourceContentSanitizer.js'
import { finishPerformanceSpan, startPerformanceSpan } from './performanceMetrics.js'

export { assessReadableContentQuality, CONTENT_SANITIZER_VERSION, sanitizeReadableContent } from './sourceContentSanitizer.js'

const canonicalSearchBaseCache = new Map()
const sourceRuntimeHashCache = new WeakMap()

const USER_SOURCES_KEY = 'sources:user'
const SOURCE_SCHEMA_VERSION_KEY = 'sources:schema-version'
const SOURCE_SCHEMA_VERSION = 4
const NATIVE_SOURCE_MANIFEST_KEY = 'sources:user:native-manifest:v1'
const NATIVE_SOURCE_CHUNK_PREFIX = 'sources:user:native-chunk:v1'
const NATIVE_SOURCE_CHUNK_SIZE = 25
const SOURCE_SETTINGS_KEY = 'sources:settings'
const SOURCE_REVISION_KEY = 'sources:revision:v1'
const SOURCE_INDEX_CACHE_KEY = 'sources:index-cache:v1'
const SOURCE_DISCOVERY_CACHE_KEY = 'sources:discovery-cache:v1'
const IMPORT_HISTORY_KEY = 'sources:import-history'
const ONLINE_SEARCH_SETTINGS_KEY = 'sources:online-search-settings'
const ONLINE_BOOKS_KEY = 'sources:online-books'
const ONLINE_DRAFT_KEY = 'sources:online-draft'
const CHAPTER_CACHE_SETTINGS_KEY = 'sources:chapter-cache-settings'
const CHAPTER_CACHE_META_KEY = 'sources:chapter-cache-meta'
const ONLINE_DATA_CACHE_SETTINGS_KEY = 'sources:online-data-cache-settings'
const ONLINE_DATA_CACHE_KEY = 'sources:online-data-cache'
export const ONLINE_SOURCE_SEARCH_LIMIT = 20
export const ONLINE_SOURCE_TIMEOUT_MS = 6000
export const ONLINE_SOURCE_TEST_TIMEOUT_MAX_MS = 30000
export const ONLINE_SEARCH_DEFAULTS = {
  concurrency: 4,
  timeoutMs: ONLINE_SOURCE_TIMEOUT_MS,
  resultLimit: 80,
  sourceLimit: ONLINE_SOURCE_SEARCH_LIMIT,
  autoWarmup: true,
  mergeBackend: true
}
const SOURCE_RUNTIME_STAGES = ['search', 'explore', 'detail', 'toc', 'content']
// 仅用于首次可用池冷启动；一旦真实检测失败，仍按 runtimeV2 冷却，不会强行继续请求。
const SOURCE_BOOTSTRAP_KEYS = new Set(['source-key-1489xuk', 'source-key-13zaxtq'])
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
export const SOURCE_ANTI_CRAWLER_DEFAULTS = {
  requestIntervalMs: 1500,
  retryCount: 0,
  retryIntervalMs: 800,
  charset: 'auto',
  userAgent: '',
  headersText: ''
}
export const CHAPTER_CACHE_DEFAULTS = {
  preloadCount: 1,
  maxChapters: 120,
  offlineMode: false
}
export const ONLINE_DATA_CACHE_DEFAULTS = {
  searchTtlMs: 10 * 60 * 1000,
  detailTtlMs: 30 * 60 * 1000,
  tocTtlMs: 6 * 60 * 60 * 1000,
  maxEntries: 80
}
const chapterCacheKey = (bookId, chapterIndex) => `sources:chapter:${bookId}:${chapterIndex}`
const ONLINE_BOOK_PLACEHOLDER_TITLE = '未命名小说'

const memoryStore = {}
let userSourcesCache = null
let userSourcesCacheManifest = ''
let sourceSettingsCache = null
let sourceSnapshotCache = null
let sourceSnapshotVersion = 1
let sourceIndexCache = null
let sourceIndexJob = null
let pendingSourceRuntimeWriteTimer = null
let pendingSourceRuntimeDirty = false

function clearSourceCaches(reason = 'changed') {
  sourceSnapshotVersion += 1
  sourceSnapshotCache = null
  sourceIndexCache = null
  if (sourceIndexJob) sourceIndexJob.cancelled = true
  sourceIndexJob = null
  return { version: sourceSnapshotVersion, reason }
}

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

function removeStorage(key) {
  try {
    if (typeof uni !== 'undefined' && uni.removeStorageSync) {
      uni.removeStorageSync(key)
      return
    }
    if (typeof uni !== 'undefined' && uni.setStorageSync) {
      uni.setStorageSync(key, '')
      return
    }
  } catch (error) {
    // fall through to memory
  }
  delete memoryStore[key]
}

function nativeSourceStorage() {
  const bridge = typeof globalThis !== 'undefined' && globalThis.NovelReaderSourceStorage
  return bridge
    && typeof bridge.writeChapter === 'function'
    && typeof bridge.readChapter === 'function'
    && typeof bridge.removeChapter === 'function'
    ? bridge
    : null
}

function nativeChunkKey(generation, index) {
  return `${NATIVE_SOURCE_CHUNK_PREFIX}:${generation}:${index}`
}

function readNativeUserSources() {
  const bridge = nativeSourceStorage()
  if (!bridge) return null
  const manifestText = String(bridge.readChapter(NATIVE_SOURCE_MANIFEST_KEY) || '')
  if (!manifestText) return null
  if (Array.isArray(userSourcesCache) && userSourcesCacheManifest === manifestText) return userSourcesCache
  try {
    const manifest = JSON.parse(manifestText)
    const chunkCount = Number(manifest.chunkCount || 0)
    if (!manifest.generation || chunkCount < 0 || chunkCount > 10000) throw new Error('invalid source manifest')
    const sources = []
    const chunkKeys = Array.from({ length: chunkCount }, (_, index) => nativeChunkKey(manifest.generation, index))
    let batch = null
    if (typeof bridge.readChapters === 'function' && chunkKeys.length) {
      try {
        batch = JSON.parse(String(bridge.readChapters(JSON.stringify(chunkKeys)) || '{}'))
      } catch (error) {}
    }
    for (let index = 0; index < chunkCount; index += 1) {
      const key = chunkKeys[index]
      const chunkText = String(batch && batch[key] != null ? batch[key] : bridge.readChapter(key) || '')
      if (!chunkText) throw new Error(`missing source chunk ${index}`)
      const chunk = JSON.parse(chunkText)
      if (!Array.isArray(chunk)) throw new Error(`invalid source chunk ${index}`)
      sources.push(...chunk)
    }
    if (Number(manifest.total || 0) !== sources.length) throw new Error('source manifest count mismatch')
    userSourcesCache = sources
    userSourcesCacheManifest = manifestText
    return sources
  } catch (error) {
    return null
  }
}

function writeNativeUserSources(sources) {
  const bridge = nativeSourceStorage()
  if (!bridge) return false
  let previous = null
  try {
    previous = JSON.parse(String(bridge.readChapter(NATIVE_SOURCE_MANIFEST_KEY) || 'null'))
  } catch (error) {}
  const generation = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const chunks = []
  for (let index = 0; index < sources.length; index += NATIVE_SOURCE_CHUNK_SIZE) {
    chunks.push(sources.slice(index, index + NATIVE_SOURCE_CHUNK_SIZE))
  }
  chunks.forEach((chunk, index) => {
    if (!bridge.writeChapter(nativeChunkKey(generation, index), JSON.stringify(chunk))) {
      throw new Error(`本机书源分片写入失败：${index + 1}/${chunks.length}`)
    }
  })
  const manifest = { version: 1, generation, chunkCount: chunks.length, total: sources.length, updatedAt: Date.now() }
  if (!bridge.writeChapter(NATIVE_SOURCE_MANIFEST_KEY, JSON.stringify(manifest))) {
    throw new Error('本机书源索引写入失败')
  }
  if (previous && previous.generation && previous.generation !== generation) {
    const oldCount = Math.max(0, Math.min(10000, Number(previous.chunkCount || 0)))
    for (let index = 0; index < oldCount; index += 1) bridge.removeChapter(nativeChunkKey(previous.generation, index))
  }
  userSourcesCache = sources
  userSourcesCacheManifest = JSON.stringify(manifest)
  return true
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

function getFieldRule(rule, names) {
  return names.map(name => rule[name]).find(Boolean) || ''
}

function firstValue(value) {
  if (Array.isArray(value)) return value.find(item => cleanText(item)) || ''
  return value || ''
}

function pickText(input, rule, names, context) {
  return cleanText(firstValue(applyRule(input, getFieldRule(rule, names), context)))
}

function pickUrl(input, rule, names, context, baseUrl) {
  return resolveUrl(firstValue(applyRule(input, getFieldRule(rule, names), context)), baseUrl)
}

function deriveBookUrlRuleFromTitle(rule) {
  const text = String(rule || '').trim()
  if (!text) return ''
  const declarative = text.split('@js:')[0].trim()
  if (!declarative || /^(?:<js>|@js:)/i.test(declarative)) return ''
  if (/@(?:text|textNodes|ownText|html)$/i.test(declarative)) {
    return declarative.replace(/@(?:text|textNodes|ownText|html)$/i, '@href')
  }
  if (/(?:^|@)a(?:[.#\[:][^@]*)?$/i.test(declarative)) return `${declarative}@href`
  return ''
}

function getUserSources() {
  const nativeSources = readNativeUserSources()
  const stored = nativeSources == null ? readStorage(USER_SOURCES_KEY, []) : nativeSources
  const sources = Array.isArray(stored) ? stored : []
  let changed = Number(readStorage(SOURCE_SCHEMA_VERSION_KEY, 0)) < SOURCE_SCHEMA_VERSION
  const migrated = sources.map(source => {
    if (source && source.sourceKey) return source
    changed = true
    return { ...source, sourceKey: createSourceKey(source && (source.raw || source) || {}) }
  })
  if (changed) {
    writeUserSources(migrated)
    writeStorage(SOURCE_SCHEMA_VERSION_KEY, SOURCE_SCHEMA_VERSION)
  }
  return migrated
}

function writeUserSources(sources) {
  const list = Array.isArray(sources) ? sources : []
  if (writeNativeUserSources(list)) removeStorage(USER_SOURCES_KEY)
  else {
    writeStorage(USER_SOURCES_KEY, list)
    userSourcesCache = null
    userSourcesCacheManifest = ''
  }
  writeStorage(SOURCE_SCHEMA_VERSION_KEY, SOURCE_SCHEMA_VERSION)
  writeStorage(SOURCE_REVISION_KEY, Date.now())
  removeStorage(SOURCE_INDEX_CACHE_KEY)
  removeStorage(SOURCE_DISCOVERY_CACHE_KEY)
  clearSourceCaches('sources-written')
}

export function getSourceStorageCapabilities() {
  return {
    native: !!nativeSourceStorage(),
    mode: nativeSourceStorage() ? 'native-chunks' : 'web-storage',
    recommendedBulkLimit: nativeSourceStorage() ? 10000 : 500
  }
}

export function persistSourceConfigs(sources) {
  writeUserSources(sources)
  return getUserSources()
}

export function getStoredSourceConfigs() {
  return getUserSources().slice()
}

function uniqueStrings(values = []) {
  const seen = new Set()
  return (Array.isArray(values) ? values : [values])
    .map(value => String(value || '').trim())
    .filter(value => {
      if (!value || seen.has(value)) return false
      seen.add(value)
      return true
    })
}

function getSourceSettings() {
  if (sourceSettingsCache) return sourceSettingsCache
  const value = readStorage(SOURCE_SETTINGS_KEY, {})
  sourceSettingsCache = value && typeof value === 'object' ? value : {}
  return sourceSettingsCache
}

function writeSourceSettings(settings) {
  if (pendingSourceRuntimeWriteTimer) clearTimeout(pendingSourceRuntimeWriteTimer)
  pendingSourceRuntimeWriteTimer = null
  pendingSourceRuntimeDirty = false
  sourceSettingsCache = settings && typeof settings === 'object' ? settings : {}
  writeStorage(SOURCE_SETTINGS_KEY, settings)
  removeStorage(SOURCE_INDEX_CACHE_KEY)
  removeStorage(SOURCE_DISCOVERY_CACHE_KEY)
  clearSourceCaches('settings-written')
}

function writeSourceSettingsDeferred(settings, sourceId = '') {
  sourceSettingsCache = settings && typeof settings === 'object' ? settings : {}
  if (sourceId && sourceSnapshotCache && sourceSnapshotCache.byId.has(sourceId)) {
    const current = sourceSnapshotCache.byId.get(sourceId)
    const merged = mergeSourceWithSettings(current, sourceSettingsCache[sourceId] || {})
    const index = sourceSnapshotCache.indexById.get(sourceId)
    if (Number.isInteger(index)) sourceSnapshotCache.sources[index] = merged
    sourceSnapshotCache.byId.set(sourceId, merged)
    sourceIndexCache = null
  }
  pendingSourceRuntimeDirty = true
  if (pendingSourceRuntimeWriteTimer) return
  pendingSourceRuntimeWriteTimer = setTimeout(() => flushPendingSourceRuntimeWrites(), 250)
  if (pendingSourceRuntimeWriteTimer && typeof pendingSourceRuntimeWriteTimer.unref === 'function') {
    pendingSourceRuntimeWriteTimer.unref()
  }
}

export function flushPendingSourceRuntimeWrites() {
  if (pendingSourceRuntimeWriteTimer) clearTimeout(pendingSourceRuntimeWriteTimer)
  pendingSourceRuntimeWriteTimer = null
  if (!pendingSourceRuntimeDirty) return false
  pendingSourceRuntimeDirty = false
  writeStorage(SOURCE_SETTINGS_KEY, sourceSettingsCache || {})
  clearSourceCaches('runtime-flushed')
  return true
}

function normalizeSourceTest(value) {
  if (!value || typeof value !== 'object') return { status: 'untested' }
  const status = value.status === 'passed' || value.status === 'failed' ? value.status : 'untested'
  return {
    status,
    testedAt: Number(value.testedAt || 0),
    keyword: String(value.keyword || ''),
    count: Number(value.count || 0),
    message: String(value.message || ''),
    errorCode: String(value.errorCode || ''),
    failedStage: String(value.failedStage || ''),
    httpStatus: Number(value.httpStatus || 0),
    retryable: value.retryable === true,
    diagnostics: value.diagnostics && typeof value.diagnostics === 'object' ? value.diagnostics : null
  }
}

function normalizeSourceExploreTest(value) {
  if (!value || typeof value !== 'object') return { status: 'untested' }
  const status = value.status === 'passed' || value.status === 'failed' ? value.status : 'untested'
  return {
    status,
    testedAt: Number(value.testedAt || 0),
    entryTitle: String(value.entryTitle || ''),
    count: Number(value.count || 0),
    message: String(value.message || ''),
    errorCode: String(value.errorCode || ''),
    httpStatus: Number(value.httpStatus || 0),
    retryable: value.retryable === true
  }
}

function hashSourceRuntimeConfig(source = {}) {
  if (source && typeof source === 'object' && sourceRuntimeHashCache.has(source)) return sourceRuntimeHashCache.get(source)
  const raw = source.raw || source || {}
  const identity = [
    source.sourceKey || '',
    raw.bookSourceName || source.name || '',
    raw.bookSourceUrl || source.baseUrl || '',
    raw.searchUrl || '',
    raw.exploreUrl || '',
    raw.ruleSearch || {},
    raw.ruleBookInfo || {},
    raw.ruleToc || {},
    raw.ruleContent || {}
  ]
  const text = stableStringify(identity)
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  const value = `v2-${(hash >>> 0).toString(16)}`
  if (source && typeof source === 'object') sourceRuntimeHashCache.set(source, value)
  return value
}

function defaultRuntimeStage(configHash) {
  return {
    status: 'untested',
    checkedAt: 0,
    lastSuccessAt: 0,
    lastFailureAt: 0,
    resultCount: 0,
    latencyMs: 0,
    errorCode: '',
    httpStatus: 0,
    consecutiveFailures: 0,
    cooldownUntil: 0,
    configHash
  }
}

function legacyRuntimeStage(source, stage, configHash) {
  const base = defaultRuntimeStage(configHash)
  if (stage === 'search') {
    const legacy = normalizeSourceTest(source.lastTest)
    if (legacy.status === 'untested') return base
    return {
      ...base,
      status: legacy.status === 'passed' ? 'passed' : 'cooldown',
      checkedAt: legacy.testedAt,
      lastSuccessAt: legacy.status === 'passed' ? legacy.testedAt : 0,
      lastFailureAt: legacy.status === 'failed' ? legacy.testedAt : 0,
      resultCount: legacy.count,
      errorCode: legacy.errorCode,
      httpStatus: legacy.httpStatus,
      consecutiveFailures: legacy.status === 'failed' ? 1 : 0,
      cooldownUntil: legacy.status === 'failed' ? legacy.testedAt + sourceRuntimeCooldownMs(legacy.errorCode, 1) : 0
    }
  }
  if (stage === 'explore') {
    const legacy = normalizeSourceExploreTest(source.exploreTest)
    if (legacy.status === 'untested') return base
    return {
      ...base,
      status: legacy.status === 'passed' ? 'passed' : 'cooldown',
      checkedAt: legacy.testedAt,
      lastSuccessAt: legacy.status === 'passed' ? legacy.testedAt : 0,
      lastFailureAt: legacy.status === 'failed' ? legacy.testedAt : 0,
      resultCount: legacy.count,
      errorCode: legacy.errorCode,
      httpStatus: legacy.httpStatus,
      consecutiveFailures: legacy.status === 'failed' ? 1 : 0,
      cooldownUntil: legacy.status === 'failed' ? legacy.testedAt + sourceRuntimeCooldownMs(legacy.errorCode, 1) : 0
    }
  }
  const healthStageId = stage === 'detail' ? 'bookInfo' : stage
  const health = normalizeSourceHealth(source.health)
  const legacy = health.stages.find(item => item.id === healthStageId)
  if (!legacy) return base
  return {
    ...base,
    status: legacy.status === 'passed' ? 'passed' : 'cooldown',
    checkedAt: health.checkedAt,
    lastSuccessAt: legacy.status === 'passed' ? health.checkedAt : 0,
    lastFailureAt: legacy.status === 'failed' ? health.checkedAt : 0,
    latencyMs: legacy.elapsedMs,
    errorCode: legacy.errorCode,
    httpStatus: legacy.httpStatus,
    consecutiveFailures: legacy.status === 'failed' ? 1 : 0,
    cooldownUntil: legacy.status === 'failed' ? health.checkedAt + sourceRuntimeCooldownMs(legacy.errorCode, 1) : 0
  }
}

function normalizeRuntimeStage(value, fallback, configHash) {
  if (!value || typeof value !== 'object' || value.configHash !== configHash) return fallback
  const allowed = ['untested', 'probing', 'passed', 'cooldown', 'blocked']
  return {
    status: allowed.includes(value.status) ? value.status : fallback.status,
    checkedAt: Number(value.checkedAt || 0),
    lastSuccessAt: Number(value.lastSuccessAt || 0),
    lastFailureAt: Number(value.lastFailureAt || 0),
    resultCount: Number(value.resultCount || 0),
    latencyMs: Number(value.latencyMs || 0),
    errorCode: String(value.errorCode || ''),
    httpStatus: Number(value.httpStatus || 0),
    consecutiveFailures: Number(value.consecutiveFailures || 0),
    cooldownUntil: Number(value.cooldownUntil || 0),
    configHash
  }
}

export function normalizeSourceRuntimeV2(source = {}, options = {}) {
  const stored = source.runtimeV2 && typeof source.runtimeV2 === 'object' ? source.runtimeV2 : {}
  const legacySearch = normalizeSourceTest(source.lastTest)
  const legacyExplore = normalizeSourceExploreTest(source.exploreTest)
  const legacyHealth = normalizeSourceHealth(source.health)
  const needsConfigHash = options.forceHash === true || !!stored.configHash ||
    legacySearch.status !== 'untested' || legacyExplore.status !== 'untested' || legacyHealth.checkedAt > 0
  const configHash = needsConfigHash ? hashSourceRuntimeConfig(source) : ''
  const runtime = { version: 2, configHash }
  if (!needsConfigHash) {
    SOURCE_RUNTIME_STAGES.forEach(stage => { runtime[stage] = defaultRuntimeStage('') })
    return runtime
  }
  SOURCE_RUNTIME_STAGES.forEach(stage => {
    runtime[stage] = normalizeRuntimeStage(stored[stage], legacyRuntimeStage(source, stage, configHash), configHash)
  })
  return runtime
}

function sourceRuntimeCooldownMs(errorCode, consecutiveFailures = 1) {
  const code = String(errorCode || '').toUpperCase()
  if (/LOGIN|CAPTCHA|VERIFY|PAID|COOKIE_REQUIRED/.test(code)) return -1
  if (/DNS/.test(code)) return 6 * HOUR_MS
  if (/HTTP_FORBIDDEN|HTTP_RATE_LIMIT|HTTP_403|HTTP_429/.test(code)) return 12 * HOUR_MS
  if (/HTTP_SERVER|HTTP_5\d\d/.test(code)) return HOUR_MS
  if (/HTTP_NOT_FOUND|HTTP_404|HTTP_410|PARSE_EMPTY|RULE_EMPTY|SEARCH_EMPTY|SEARCH_RESULT_INCOMPLETE|DETAIL_EMPTY|DETAIL_METADATA_EMPTY|TOC_EMPTY|CONTENT_EMPTY|CONTENT_NOISE/.test(code)) return 7 * DAY_MS
  if (/TIMEOUT|NETWORK|SITE_UNREACHABLE|CONNECTION/.test(code)) {
    if (consecutiveFailures >= 3) return 12 * HOUR_MS
    if (consecutiveFailures >= 2) return 2 * HOUR_MS
    return 30 * 60 * 1000
  }
  if (/UNSUPPORTED|SCRIPT_BLOCKED|SECURITY/.test(code)) return -1
  return 30 * 60 * 1000
}

export function writeSourceRuntimeStageResult(sourceId, stage, result = {}) {
  if (!sourceId || !SOURCE_RUNTIME_STAGES.includes(stage)) return null
  const source = getSourceConfig(sourceId)
  if (!source) return null
  const runtime = normalizeSourceRuntimeV2(source, { forceHash: true })
  const previous = runtime[stage]
  const now = Date.now()
  const explicitStatus = String(result.status || '')
  let next
  if (explicitStatus === 'probing') {
    next = { ...previous, status: 'probing', checkedAt: now, configHash: runtime.configHash }
  } else if (explicitStatus === 'passed' || result.ok === true) {
    next = {
      ...previous,
      status: 'passed',
      checkedAt: now,
      lastSuccessAt: now,
      resultCount: Number(result.resultCount || result.count || 0),
      latencyMs: Number(result.latencyMs || 0),
      errorCode: '',
      httpStatus: Number(result.httpStatus || 0),
      consecutiveFailures: 0,
      cooldownUntil: 0,
      configHash: runtime.configHash
    }
  } else {
    const failureCount = previous.consecutiveFailures + 1
    const errorCode = String(result.errorCode || 'NETWORK_ERROR')
    const cooldownMs = sourceRuntimeCooldownMs(errorCode, failureCount)
    next = {
      ...previous,
      status: cooldownMs < 0 ? 'blocked' : 'cooldown',
      checkedAt: now,
      lastFailureAt: now,
      resultCount: Number(result.resultCount || result.count || 0),
      latencyMs: Number(result.latencyMs || 0),
      errorCode,
      httpStatus: Number(result.httpStatus || 0),
      consecutiveFailures: failureCount,
      cooldownUntil: cooldownMs < 0 ? 0 : now + cooldownMs,
      configHash: runtime.configHash
    }
  }
  const settings = getSourceSettings()
  settings[sourceId] = {
    ...(settings[sourceId] || {}),
    runtimeV2: { ...runtime, [stage]: next },
    updatedAt: Date.now()
  }
  writeSourceSettingsDeferred(settings, sourceId)
  return next
}

function writeSourceTestResult(sourceId, result) {
  const settings = getSourceSettings()
  settings[sourceId] = {
    ...(settings[sourceId] || {}),
    lastTest: {
      status: result.status,
      testedAt: Date.now(),
      keyword: result.keyword || '',
      count: Number(result.count || 0),
      message: result.message || '',
      errorCode: result.errorCode || '',
      failedStage: result.failedStage || '',
      httpStatus: Number(result.httpStatus || 0),
      retryable: result.retryable === true,
      diagnostics: result.diagnostics && typeof result.diagnostics === 'object' ? result.diagnostics : null
    },
    updatedAt: Date.now()
  }
  writeSourceSettingsDeferred(settings, sourceId)
}

function writeSourceExploreTestResult(sourceId, result) {
  if (!sourceId) return
  const settings = getSourceSettings()
  settings[sourceId] = {
    ...(settings[sourceId] || {}),
    exploreTest: {
      status: result.status,
      testedAt: Date.now(),
      entryTitle: result.entryTitle || '',
      count: Number(result.count || 0),
      message: result.message || '',
      errorCode: result.errorCode || '',
      httpStatus: Number(result.httpStatus || 0),
      retryable: result.retryable === true
    },
    updatedAt: Date.now()
  }
  writeSourceSettingsDeferred(settings, sourceId)
}

function hasNonEmptyField(raw = {}, names = []) {
  if (!raw || typeof raw !== 'object') return false
  return names.some(name => {
    const value = raw[name]
    if (value === false || value == null) return false
    return String(value).trim() !== ''
  })
}

function parseSourceHeaders(raw = {}, context = {}) {
  const value = raw.header || raw.headers || raw.httpHeader
  return normalizeHeaders(value, { channel: 'proxy', context })
}

function parseHeadersText(text = '') {
  return String(text || '').split(/\r?\n/).reduce((result, line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return result
    const separator = trimmed.indexOf(':')
    if (separator <= 0) return result
    const name = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim()
    if (!name || !value) return result
    result[name] = value
    return result
  }, {})
}

function headersToText(headers = {}) {
  return Object.keys(headers || {})
    .filter(name => name && headers[name] != null && headers[name] !== '')
    .map(name => `${name}: ${headers[name]}`)
    .join('\n')
}

function normalizeSourceAntiCrawler(value = {}) {
  const raw = value && typeof value === 'object' ? value : {}
  const headersText = String(raw.headersText || headersToText(raw.headers) || '').slice(0, 2000)
  const charset = ['auto', 'utf-8', 'gbk', 'gb2312'].includes(String(raw.charset || '').toLowerCase())
    ? String(raw.charset || '').toLowerCase()
    : SOURCE_ANTI_CRAWLER_DEFAULTS.charset
  return {
    requestIntervalMs: clampNumber(raw.requestIntervalMs, 0, 10000, SOURCE_ANTI_CRAWLER_DEFAULTS.requestIntervalMs),
    retryCount: clampNumber(raw.retryCount, 0, 3, SOURCE_ANTI_CRAWLER_DEFAULTS.retryCount),
    retryIntervalMs: clampNumber(raw.retryIntervalMs, 0, 10000, SOURCE_ANTI_CRAWLER_DEFAULTS.retryIntervalMs),
    charset,
    userAgent: String(raw.userAgent || '').trim().slice(0, 240),
    headersText,
    headers: parseHeadersText(headersText)
  }
}

export function getSourceAntiCrawlerSettings(sourceId) {
  const source = getSourceConfig(sourceId)
  return normalizeSourceAntiCrawler(source && source.antiCrawler)
}

export function saveSourceAntiCrawlerSettings(sourceId, antiCrawler = {}) {
  if (!sourceId) throw new Error('书源不存在或已删除')
  const settings = getSourceSettings()
  settings[sourceId] = {
    ...(settings[sourceId] || {}),
    antiCrawler: normalizeSourceAntiCrawler(antiCrawler),
    updatedAt: Date.now()
  }
  writeSourceSettings(settings)
  return normalizeSourceAntiCrawler(settings[sourceId].antiCrawler)
}

function hasRequiredCookie(raw = {}) {
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw || {})
  if (/cookie\./i.test(text)) return true
  const headers = typeof raw === 'object' ? parseSourceHeaders(raw, {
    baseUrl: raw.bookSourceUrl || raw.sourceUrl || raw.baseUrl || ''
  }) : {}
  return Object.keys(headers).some(key => key.toLowerCase() === 'cookie' && String(headers[key] || '').trim())
}

function createSourceRequestSpec(source, url, context = {}, baseUrl = '') {
  const raw = source && (source.raw || source) || {}
  const requestContext = {
    baseUrl: source && source.baseUrl || raw.bookSourceUrl || raw.sourceUrl || raw.baseUrl || baseUrl,
    ...context
  }
  const spec = parseRequestSpec(url, requestContext, baseUrl || requestContext.baseUrl)
  const antiCrawler = normalizeSourceAntiCrawler(source && source.antiCrawler)
  const antiCrawlerHeaders = {
    ...antiCrawler.headers
  }
  const savedCookie = getSourceCookie(source && source.id, spec.url)
  if (savedCookie) antiCrawlerHeaders.Cookie = savedCookie
  if (antiCrawler.userAgent) {
    antiCrawlerHeaders['User-Agent'] = antiCrawler.userAgent
  }
  const session = getActiveSourceSession(source && source.id)
  const sessionHeaders = buildSourceSessionHeaders(source && source.id)
  return {
    ...spec,
    charset: spec.charset || (antiCrawler.charset === 'auto' ? '' : antiCrawler.charset),
    requestIntervalMs: antiCrawler.requestIntervalMs,
    retryCount: antiCrawler.retryCount,
    retryIntervalMs: antiCrawler.retryIntervalMs,
    rateLimitKey: source && source.id || requestContext.baseUrl || spec.url,
    rendered: context.rendered === false ? false : !!(source && source.features && source.features.webView),
    cookie: session && session.cookie || savedCookie,
    userAgent: session && session.userAgent || antiCrawler.userAgent,
    header: normalizeHeaders({
      ...parseSourceHeaders(raw, requestContext),
      ...antiCrawlerHeaders,
      ...sessionHeaders,
      ...(spec.header || {})
    }, { channel: 'proxy', context: requestContext })
  }
}

export function getSourceConfigs() {
  return getSourceSnapshot().sources.slice()
}

export function getSourceConfig(sourceId) {
  return getSourceSnapshot().byId.get(sourceId)
}

export function invalidateSourceSnapshot(reason = 'manual') {
  return clearSourceCaches(reason)
}

export function getSourceSnapshot(options = {}) {
  if (!sourceSnapshotCache || options.force === true) {
    const span = startPerformanceSpan('source.snapshot')
    const settings = getSourceSettings()
    const startedAt = Date.now()
    const sources = getUserSources().map(source => mergeSourceWithSettings(source, settings[source.id] || {}))
    sourceSnapshotCache = {
      version: sourceSnapshotVersion,
      createdAt: Date.now(),
      buildMs: Date.now() - startedAt,
      sources,
      byId: new Map(sources.map(source => [source.id, source])),
      indexById: new Map(sources.map((source, index) => [source.id, index]))
    }
    finishPerformanceSpan(span, { sourceCount: sources.length, status: 'built' })
  }
  return sourceSnapshotCache
}

function sourceIndexSummary(source) {
  const raw = source.raw || source
  const compatible = source.compatibilityLevel !== 'unsupported' && !hasUnsupportedRule(raw)
  const runtime = normalizeSourceRuntimeV2(source).search
  return {
    id: source.id,
    name: source.name,
    group: source.group || '未分组',
    baseUrl: source.baseUrl || '',
    enabled: source.enabled !== false,
    compatibility: source.compatibility || '',
    compatible,
    searchable: compatible && !!raw.searchUrl && !!raw.ruleSearch,
    runtimeStatus: runtime.status === 'cooldown' ? 'failed' : runtime.status,
    updatedAt: Number(source.updatedAt || 0)
  }
}

function currentSourceRevision() {
  const bridge = nativeSourceStorage()
  if (bridge) {
    try {
      const manifest = String(bridge.readChapter(NATIVE_SOURCE_MANIFEST_KEY) || '')
      if (manifest) return `native:${manifest}`
    } catch (error) {}
  }
  return `web:${Number(readStorage(SOURCE_REVISION_KEY, 0) || 0)}`
}

function buildSourceIndexCache(summaries, revision, elapsedMs = 0, status = 'built') {
  const groups = new Map()
  summaries.forEach(item => groups.set(item.group, Number(groups.get(item.group) || 0) + 1))
  return {
    version: sourceSnapshotVersion,
    revision,
    summaries,
    byId: new Map(summaries.map(item => [item.id, item])),
    groups,
    report: {
      cancelled: false,
      cached: status === 'cached',
      version: sourceSnapshotVersion,
      count: summaries.length,
      groupCount: groups.size,
      elapsedMs
    }
  }
}

function restorePersistedSourceIndex() {
  const revision = currentSourceRevision()
  const cached = readStorage(SOURCE_INDEX_CACHE_KEY, null)
  if (!cached || cached.revision !== revision || !Array.isArray(cached.summaries)) return null
  if (cached.summaries.length > 10000) return null
  sourceIndexCache = buildSourceIndexCache(cached.summaries, revision, 0, 'cached')
  return sourceIndexCache
}

function persistSourceIndex(index) {
  if (!index || !Array.isArray(index.summaries)) return
  writeStorage(SOURCE_INDEX_CACHE_KEY, {
    schemaVersion: 1,
    revision: index.revision || currentSourceRevision(),
    createdAt: Date.now(),
    summaries: index.summaries
  })
}

export async function prepareSourceIndexes(options = {}) {
  if (sourceIndexCache) return sourceIndexCache.report
  const persisted = restorePersistedSourceIndex()
  if (persisted) return persisted.report
  const snapshot = getSourceSnapshot()
  if (sourceIndexCache && sourceIndexCache.version === snapshot.version) return sourceIndexCache.report
  if (sourceIndexJob && sourceIndexJob.version === snapshot.version) return sourceIndexJob.promise
  const job = { version: snapshot.version, cancelled: false, promise: null }
  const batchSize = Math.max(10, Math.min(200, Number(options.batchSize || 100)))
  job.promise = (async () => {
    const span = startPerformanceSpan('source.index')
    const startedAt = Date.now()
    const summaries = []
    const groups = new Map()
    for (let index = 0; index < snapshot.sources.length; index += batchSize) {
      if (job.cancelled || snapshot.version !== sourceSnapshotVersion) return { cancelled: true, version: snapshot.version }
      snapshot.sources.slice(index, index + batchSize).forEach(source => {
        const summary = sourceIndexSummary(source)
        summaries.push(summary)
        groups.set(summary.group, Number(groups.get(summary.group) || 0) + 1)
      })
      if (index + batchSize < snapshot.sources.length) await new Promise(resolve => setTimeout(resolve, 0))
    }
    sourceIndexCache = buildSourceIndexCache(summaries, currentSourceRevision(), Date.now() - startedAt)
    sourceIndexCache.version = snapshot.version
    sourceIndexCache.report.version = snapshot.version
    persistSourceIndex(sourceIndexCache)
    finishPerformanceSpan(span, { sourceCount: summaries.length, count: groups.size, status: 'built' })
    return sourceIndexCache.report
  })().finally(() => {
    if (sourceIndexJob === job) sourceIndexJob = null
  })
  sourceIndexJob = job
  return job.promise
}

function ensureSynchronousSourceIndex() {
  if (sourceIndexCache) return sourceIndexCache
  const persisted = restorePersistedSourceIndex()
  if (persisted) return persisted
  const snapshot = getSourceSnapshot()
  const summaries = snapshot.sources.map(sourceIndexSummary)
  sourceIndexCache = buildSourceIndexCache(summaries, currentSourceRevision())
  sourceIndexCache.version = snapshot.version
  sourceIndexCache.report.version = snapshot.version
  persistSourceIndex(sourceIndexCache)
  return sourceIndexCache
}

export function getSourceLibraryPage(query = {}) {
  const span = startPerformanceSpan('source.library-page')
  const index = ensureSynchronousSourceIndex()
  const keyword = String(query.keyword || '').trim().toLowerCase()
  const group = String(query.group || query.sourceGroupFilter || '全部分组')
  const filter = String(query.filter || query.sourceFilter || 'all')
  const sort = String(query.sort || 'manual')
  const offset = Math.max(0, Number(query.offset || 0))
  const limit = Math.max(1, Math.min(100, Number(query.limit || 30)))
  const filtered = index.summaries.filter(item => {
    if (group !== '全部分组' && item.group !== group) return false
    if (filter === 'enabled' && !item.enabled) return false
    if (filter === 'disabled' && item.enabled) return false
    if (filter === 'incompatible' && item.compatible) return false
    if (!keyword) return true
    return [item.name, item.group, item.baseUrl, item.compatibility, item.id].some(value => String(value || '').toLowerCase().includes(keyword))
  })
  if (sort === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
  else if (sort === 'group') filtered.sort((a, b) => a.group.localeCompare(b.group, 'zh-Hans-CN') || a.name.localeCompare(b.name, 'zh-Hans-CN'))
  else if (sort === 'updated') filtered.sort((a, b) => b.updatedAt - a.updatedAt)
  else if (sort === 'enabled') filtered.sort((a, b) => Number(b.enabled) - Number(a.enabled))
  const result = {
    version: index.version,
    total: filtered.length,
    offset,
    limit,
    rows: filtered.slice(offset, offset + limit),
    groups: ['全部分组', ...Array.from(index.groups.keys()).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))],
    groupStats: Array.from(index.groups.entries()).map(([group, count]) => ({ group, count })).sort((a, b) => a.group.localeCompare(b.group, 'zh-Hans-CN')),
    stats: {
      total: index.summaries.length,
      enabled: index.summaries.filter(item => item.enabled).length,
      incompatible: index.summaries.filter(item => !item.compatible).length,
      searchable: index.summaries.filter(item => item.searchable).length
    }
  }
  finishPerformanceSpan(span, { sourceCount: index.summaries.length, count: result.rows.length, status: 'ready' })
  return result
}

function mergeSourceWithSettings(source, saved = {}) {
  const merged = {
    ...source,
    name: saved.name || source.name,
    group: saved.group || source.group,
    enabled: saved.enabled !== undefined ? saved.enabled : source.enabled,
    updatedAt: saved.updatedAt || source.updatedAt,
    lastTest: saved.lastTest || source.lastTest || '',
    exploreTest: saved.exploreTest || source.exploreTest || null,
    health: saved.health || source.health || null,
    quality: saved.quality || source.quality || null,
    acceptanceWindows: Array.isArray(saved.acceptanceWindows) ? saved.acceptanceWindows : (source.acceptanceWindows || []),
    runtimeV2: saved.runtimeV2 || source.runtimeV2 || null,
    antiCrawler: normalizeSourceAntiCrawler(saved.antiCrawler || source.antiCrawler)
  }
  merged.runtimeV2 = normalizeSourceRuntimeV2(merged)
  return merged
}

export function setSourceEnabled(sourceId, enabled) {
  const settings = getSourceSettings()
  settings[sourceId] = {
    ...(settings[sourceId] || {}),
    enabled: !!enabled,
    updatedAt: Date.now()
  }
  writeSourceSettings(settings)
}

export function batchSetSourcesEnabled(sourceIds, enabled) {
  const ids = Array.isArray(sourceIds) ? sourceIds.filter(Boolean) : []
  const settings = getSourceSettings()
  const now = Date.now()
  ids.forEach(sourceId => {
    settings[sourceId] = {
      ...(settings[sourceId] || {}),
      enabled: !!enabled,
      updatedAt: now
    }
  })
  writeSourceSettings(settings)
  return { updated: ids.length, enabled: !!enabled }
}

export function updateSourceMetadata(sourceId, metadata = {}) {
  const source = getSourceConfig(sourceId)
  if (!source) throw new Error('书源不存在或已删除')
  const name = cleanText(metadata.name).slice(0, 60)
  const group = cleanText(metadata.group).slice(0, 40)
  if (!name) throw new Error('书源名称不能为空')
  const settings = getSourceSettings()
  settings[sourceId] = {
    ...(settings[sourceId] || {}),
    name,
    group: group || '未分组',
    updatedAt: Date.now()
  }
  writeSourceSettings(settings)
  return getSourceConfig(sourceId)
}

export function deleteUserSource(sourceId) {
  writeUserSources(getUserSources().filter(source => source.id !== sourceId))
  const settings = getSourceSettings()
  delete settings[sourceId]
  writeSourceSettings(settings)
  clearSourceCookies(sourceId)
}

export function getUnsupportedRuleReasons(source) {
  const raw = source && (source.raw || source)
  if (!raw) return []
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw)
  const reasons = []
  if (/(?:java\.|eval\(|\bFunction\s*\(|\bfetch\s*\(|XMLHttpRequest|WebSocket|\bwindow\.|\bdocument\.)/i.test(text)) reasons.push('包含 JS 规则')
  if (hasRequiredCookie(raw)) reasons.push('依赖 Cookie')
  if (hasNonEmptyField(raw, ['loginUrl', 'loginUi', 'loginCheck'])) reasons.push('依赖登录')
  if (/webview/i.test(text)) reasons.push('依赖 WebView')
  return reasons
}

export function getSourceDiagnostics(source) {
  const raw = (source && (source.raw || source)) || {}
  const reasons = getUnsupportedRuleReasons(source)
  const levelInfo = detectSourceCompatibilityLevel(raw, {
    android: typeof window !== 'undefined' && !!window.NovelReaderWebViewParser
  })
  const compatible = !hasUnsupportedRule(raw) && levelInfo.environmentSupported
  const lastTest = normalizeSourceTest(source && source.lastTest)
  const exploreTest = normalizeSourceExploreTest(source && source.exploreTest)
  const health = normalizeSourceHealth(source && source.health)
  const runtimeV2 = normalizeSourceRuntimeV2(source || {})
  const now = Date.now()
  const featureFlags = source && source.features || detectSourceFeatures(raw)
  const formatVersion = source && source.formatVersion || detectSourceFormat(raw)
  const ruleSearch = normalizeRuleObject(raw.ruleSearch)
  const ruleToc = normalizeRuleObject(raw.ruleToc)
  const ruleContent = normalizeRuleObject(raw.ruleContent)
  const ruleBookInfo = normalizeRuleObject(raw.ruleBookInfo)
  const ruleSummary = {
    search: compatible && !!(raw.searchUrl && Object.keys(ruleSearch).length),
    bookInfo: compatible && !!Object.keys(ruleBookInfo).length,
    toc: compatible && !!Object.keys(ruleToc).length,
    content: compatible && !!Object.keys(ruleContent).length,
    explore: !!(raw.exploreUrl || raw.ruleExplore)
  }
  const searchRuntime = runtimeV2.search
  const exploreRuntime = runtimeV2.explore
  const searchCooling = searchRuntime.status === 'cooldown' && searchRuntime.cooldownUntil > now
  const exploreCooling = exploreRuntime.status === 'cooldown' && exploreRuntime.cooldownUntil > now
  const networkStatus = compatible ? lastTest.status : 'incompatible'
  const exploreStatus = compatible ? exploreTest.status : 'incompatible'
  const searchable = compatible && ruleSummary.search && searchRuntime.status !== 'blocked' && !searchCooling
  const verifiedSearchable = searchable && searchRuntime.status === 'passed' && searchRuntime.resultCount > 0
  const statusTitle = !compatible
    ? '规则不兼容'
    : searchRuntime.status === 'blocked'
      ? '需要人工处理'
      : searchCooling
        ? '临时冷却中'
        : searchRuntime.status === 'passed' && searchRuntime.resultCount > 0
          ? '已进入可用池'
          : '规则兼容，可智能检测'
  const statusDesc = !compatible
    ? (reasons.length ? reasons.join('、') : '包含 H5 暂不支持的复杂规则')
    : searchRuntime.status === 'blocked'
      ? '该来源需要登录、验证码或包含越界规则，只允许人工处理。'
      : searchCooling
        ? `${lastTest.message || searchRuntime.errorCode || '最近检测失败'}，冷却结束后会自动重新进入候选池。`
        : searchRuntime.status === 'passed' && searchRuntime.resultCount > 0
          ? `最近返回 ${searchRuntime.resultCount} 条结果，搜索时优先使用。`
          : '无需手动逐个测试，联网搜索或 Wi-Fi 空闲时会自动检测。'
  return {
    id: source && source.id || '',
    name: source && source.name || raw.bookSourceName || '未命名书源',
    group: source && source.group || raw.bookSourceGroup || '用户导入',
    baseUrl: source && source.baseUrl || raw.bookSourceUrl || raw.sourceUrl || '',
    formatVersion,
    featureFlags,
    comment: source && source.comment || raw.comment || raw.bookSourceComment || raw.sourceComment || '',
    weight: Number(source && source.weight || raw.weight || raw.customOrder || 0),
    enabled: !!(source && source.enabled),
    imported: !!(source && source.importedAt),
    compatible,
    searchable,
    verifiedSearchable,
    searchCooling,
    exploreCooling,
    networkStatus,
    exploreStatus,
    compatibilityLevel: levelInfo.level,
    environmentSupported: levelInfo.environmentSupported,
    nextAction: levelInfo.nextAction,
    compatibility: compatible ? 'v1 兼容' : '不兼容',
    statusTitle,
    statusDesc,
    lastTest,
    exploreTest,
    health,
    runtimeV2,
    reasons: compatible ? [] : (reasons.length ? reasons : ['包含 H5 暂不支持的复杂规则']),
    ruleSummary
  }
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

function cloneCacheValue(value) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch (error) {
    return value
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function getOnlineDataCacheStore() {
  const raw = readStorage(ONLINE_DATA_CACHE_KEY, {})
  const store = raw && typeof raw === 'object' ? raw : {}
  return {
    search: store.search && typeof store.search === 'object' ? store.search : {},
    detail: store.detail && typeof store.detail === 'object' ? store.detail : {},
    toc: store.toc && typeof store.toc === 'object' ? store.toc : {}
  }
}

function writeOnlineDataCacheStore(store) {
  writeStorage(ONLINE_DATA_CACHE_KEY, {
    search: store.search && typeof store.search === 'object' ? store.search : {},
    detail: store.detail && typeof store.detail === 'object' ? store.detail : {},
    toc: store.toc && typeof store.toc === 'object' ? store.toc : {}
  })
}

function ttlNumber(value, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(7 * 24 * 60 * 60 * 1000, Math.max(0, Math.round(number)))
}

export function getOnlineDataCacheSettings() {
  const raw = readStorage(ONLINE_DATA_CACHE_SETTINGS_KEY, {})
  return {
    searchTtlMs: ttlNumber(raw.searchTtlMs, ONLINE_DATA_CACHE_DEFAULTS.searchTtlMs),
    detailTtlMs: ttlNumber(raw.detailTtlMs, ONLINE_DATA_CACHE_DEFAULTS.detailTtlMs),
    tocTtlMs: ttlNumber(raw.tocTtlMs, ONLINE_DATA_CACHE_DEFAULTS.tocTtlMs),
    maxEntries: clampNumber(raw.maxEntries, 1, 200, ONLINE_DATA_CACHE_DEFAULTS.maxEntries)
  }
}

export function saveOnlineDataCacheSettings(settings = {}) {
  const next = {
    ...getOnlineDataCacheSettings(),
    ...settings
  }
  const normalized = {
    searchTtlMs: ttlNumber(next.searchTtlMs, ONLINE_DATA_CACHE_DEFAULTS.searchTtlMs),
    detailTtlMs: ttlNumber(next.detailTtlMs, ONLINE_DATA_CACHE_DEFAULTS.detailTtlMs),
    tocTtlMs: ttlNumber(next.tocTtlMs, ONLINE_DATA_CACHE_DEFAULTS.tocTtlMs),
    maxEntries: clampNumber(next.maxEntries, 1, 200, ONLINE_DATA_CACHE_DEFAULTS.maxEntries)
  }
  writeStorage(ONLINE_DATA_CACHE_SETTINGS_KEY, normalized)
  enforceOnlineDataCacheLimit(normalized.maxEntries)
  return normalized
}

export function clearOnlineDataCache(scope = '') {
  const store = getOnlineDataCacheStore()
  const target = String(scope || 'all')
  const scopes = target === 'all' ? ['search', 'detail', 'toc'] : [target]
  let removed = 0
  scopes.forEach(item => {
    if (!store[item]) return
    removed += Object.keys(store[item]).length
    store[item] = {}
  })
  writeOnlineDataCacheStore(store)
  return { removed }
}

export function getOnlineDataCacheStats() {
  const store = getOnlineDataCacheStore()
  const search = Object.keys(store.search).length
  const detail = Object.keys(store.detail).length
  const toc = Object.keys(store.toc).length
  return {
    search,
    detail,
    toc,
    total: search + detail + toc
  }
}

function getOnlineDataCacheTtl(scope) {
  const settings = getOnlineDataCacheSettings()
  if (scope === 'detail') return settings.detailTtlMs
  if (scope === 'toc') return settings.tocTtlMs
  return settings.searchTtlMs
}

function readOnlineDataCache(scope, key, options = {}) {
  if (options.forceRefresh) return null
  const ttl = getOnlineDataCacheTtl(scope)
  if (!ttl) return null
  const store = getOnlineDataCacheStore()
  const bucket = store[scope] || {}
  const entry = bucket[key]
  if (!entry || typeof entry !== 'object') return null
  const ageMs = Date.now() - Number(entry.cachedAt || 0)
  if (ageMs < 0 || ageMs > ttl) {
    delete bucket[key]
    store[scope] = bucket
    writeOnlineDataCacheStore(store)
    return null
  }
  if (typeof options.onCacheHit === 'function') {
    options.onCacheHit({
      scope,
      key,
      cachedAt: Number(entry.cachedAt || 0),
      ageMs
    })
  }
  return cloneCacheValue(entry.value)
}

function writeOnlineDataCache(scope, key, value) {
  const store = getOnlineDataCacheStore()
  const bucket = store[scope] || {}
  bucket[key] = {
    cachedAt: Date.now(),
    value: cloneCacheValue(value)
  }
  store[scope] = bucket
  writeOnlineDataCacheStore(store)
  enforceOnlineDataCacheLimit(getOnlineDataCacheSettings().maxEntries)
  return value
}

function enforceOnlineDataCacheLimit(maxEntries = ONLINE_DATA_CACHE_DEFAULTS.maxEntries) {
  const store = getOnlineDataCacheStore()
  const entries = ['search', 'detail', 'toc'].flatMap(scope => {
    return Object.entries(store[scope] || {}).map(([key, entry]) => ({
      scope,
      key,
      cachedAt: Number(entry && entry.cachedAt || 0)
    }))
  }).sort((left, right) => left.cachedAt - right.cachedAt)
  while (entries.length > maxEntries) {
    const item = entries.shift()
    if (item && store[item.scope]) delete store[item.scope][item.key]
  }
  writeOnlineDataCacheStore(store)
}

function onlineDataCacheKey(scope, value) {
  return `${scope}:${stableStringify(value)}`
}

export function getOnlineSearchSettings() {
  const raw = readStorage(ONLINE_SEARCH_SETTINGS_KEY, {})
  return {
    concurrency: clampNumber(raw.concurrency, 1, 10, ONLINE_SEARCH_DEFAULTS.concurrency),
    timeoutMs: clampNumber(raw.timeoutMs, 3000, 15000, ONLINE_SEARCH_DEFAULTS.timeoutMs),
    resultLimit: clampNumber(raw.resultLimit, 20, 120, ONLINE_SEARCH_DEFAULTS.resultLimit),
    sourceLimit: clampNumber(raw.sourceLimit, 10, 30, ONLINE_SEARCH_DEFAULTS.sourceLimit),
    autoWarmup: raw.autoWarmup !== false,
    mergeBackend: raw.mergeBackend !== false
  }
}

export function saveOnlineSearchSettings(settings = {}) {
  const next = {
    ...getOnlineSearchSettings(),
    ...settings
  }
  const normalized = {
    concurrency: clampNumber(next.concurrency, 1, 10, ONLINE_SEARCH_DEFAULTS.concurrency),
    timeoutMs: clampNumber(next.timeoutMs, 3000, 15000, ONLINE_SEARCH_DEFAULTS.timeoutMs),
    resultLimit: clampNumber(next.resultLimit, 20, 120, ONLINE_SEARCH_DEFAULTS.resultLimit),
    sourceLimit: clampNumber(next.sourceLimit, 10, 30, ONLINE_SEARCH_DEFAULTS.sourceLimit),
    autoWarmup: next.autoWarmup !== false,
    mergeBackend: next.mergeBackend !== false
  }
  writeStorage(ONLINE_SEARCH_SETTINGS_KEY, normalized)
  return normalized
}

export function getChapterCacheSettings() {
  const raw = readStorage(CHAPTER_CACHE_SETTINGS_KEY, {})
  return {
    preloadCount: clampNumber(raw.preloadCount, 0, 10, CHAPTER_CACHE_DEFAULTS.preloadCount),
    maxChapters: clampNumber(raw.maxChapters, 0, 2000, CHAPTER_CACHE_DEFAULTS.maxChapters),
    offlineMode: !!raw.offlineMode
  }
}

export function saveChapterCacheSettings(settings = {}) {
  const next = {
    ...getChapterCacheSettings(),
    ...settings
  }
  const normalized = {
    preloadCount: clampNumber(next.preloadCount, 0, 10, CHAPTER_CACHE_DEFAULTS.preloadCount),
    maxChapters: clampNumber(next.maxChapters, 0, 2000, CHAPTER_CACHE_DEFAULTS.maxChapters),
    offlineMode: !!next.offlineMode
  }
  writeStorage(CHAPTER_CACHE_SETTINGS_KEY, normalized)
  enforceChapterCacheLimit(normalized)
  return normalized
}

function getChapterCacheMeta() {
  const raw = readStorage(CHAPTER_CACHE_META_KEY, {})
  return raw && typeof raw === 'object' ? raw : {}
}

function writeChapterCacheMeta(meta) {
  writeStorage(CHAPTER_CACHE_META_KEY, meta && typeof meta === 'object' ? meta : {})
}

function chapterCacheMetaKey(bookId, chapterIndex) {
  return `${bookId}:${Number(chapterIndex || 0)}`
}

function readOnlineChapterCache(bookId, chapterIndex) {
  const storageKey = chapterCacheKey(bookId, chapterIndex)
  const cached = String(readStorage(storageKey, '') || '')
  if (!cached) return ''
  const key = chapterCacheMetaKey(bookId, chapterIndex)
  const meta = getChapterCacheMeta()
  const current = meta[key] && typeof meta[key] === 'object' ? meta[key] : {}
  if (Number(current.sanitizerVersion || 0) >= CONTENT_SANITIZER_VERSION) return cached
  const sanitized = sanitizeReadableContent(cached, { chapterTitle: current.chapterTitle })
  if (sanitized.text !== cached) writeStorage(storageKey, sanitized.text)
  meta[key] = {
    ...current,
    bookId,
    chapterIndex: Number(chapterIndex || 0),
    chars: sanitized.cleanedChars,
    rawChars: sanitized.rawChars,
    cleanedChars: sanitized.cleanedChars,
    sanitizerVersion: CONTENT_SANITIZER_VERSION,
    cachedAt: Number(current.cachedAt || Date.now())
  }
  writeChapterCacheMeta(meta)
  return sanitized.text
}

function writeOnlineChapterCache(book, chapter, content, protectedKeys = []) {
  const sanitized = sanitizeReadableContent(content, { chapterTitle: chapter && chapter.title })
  const text = sanitized.text
  if (!book || !book.id || !chapter || !text) return ''
  const index = Number(chapter.index || 0)
  writeStorage(chapterCacheKey(book.id, index), text)
  const key = chapterCacheMetaKey(book.id, index)
  const meta = getChapterCacheMeta()
  meta[key] = {
    bookId: book.id,
    bookTitle: book.title || '',
    chapterIndex: index,
    chapterTitle: chapter.title || `第 ${index + 1} 章`,
    chars: text.length,
    rawChars: sanitized.rawChars,
    cleanedChars: sanitized.cleanedChars,
    sanitizerVersion: CONTENT_SANITIZER_VERSION,
    cachedAt: Date.now()
  }
  writeChapterCacheMeta(meta)
  enforceChapterCacheLimit(getChapterCacheSettings(), [key, ...protectedKeys])
  return text
}

function removeOnlineChapterCache(bookId, chapterIndex, meta = getChapterCacheMeta()) {
  removeStorage(chapterCacheKey(bookId, chapterIndex))
  delete meta[chapterCacheMetaKey(bookId, chapterIndex)]
  markOnlineChapterCacheRemoved(bookId, chapterIndex)
  return meta
}

function markOnlineChapterCacheRemoved(bookId, chapterIndex) {
  const index = Number(chapterIndex || 0)
  const books = getOnlineShelfBooks()
  if (!books.some(book => book.id === bookId)) return
  const next = books.map(book => {
    if (book.id !== bookId) return book
    return {
      ...book,
      chapters: (book.chapters || []).map(chapter => {
        if (Number(chapter.index || 0) !== index) return chapter
        return {
          ...chapter,
          content: '',
          isCached: false,
          loadStatus: chapter.errorMessage ? 'failed' : 'idle'
        }
      })
    }
  })
  writeStorage(ONLINE_BOOKS_KEY, next)
}

function enforceChapterCacheLimit(settings = getChapterCacheSettings(), protectedKeys = []) {
  const maxChapters = clampNumber(settings.maxChapters, 0, 2000, CHAPTER_CACHE_DEFAULTS.maxChapters)
  if (!maxChapters) return
  const protectedSet = new Set(protectedKeys.filter(Boolean))
  const meta = getChapterCacheMeta()
  let entries = Object.keys(meta)
    .map(key => ({ key, ...meta[key] }))
    .filter(item => item.bookId)
    .sort((left, right) => {
      const chapterDiff = Number(right.chapterIndex || 0) - Number(left.chapterIndex || 0)
      return chapterDiff || Number(left.cachedAt || 0) - Number(right.cachedAt || 0)
    })
  while (entries.length > maxChapters) {
    const removable = entries.find(item => !protectedSet.has(item.key)) || entries[0]
    if (!removable) break
    removeOnlineChapterCache(removable.bookId, removable.chapterIndex, meta)
    entries = entries.filter(item => item.key !== removable.key)
  }
  writeChapterCacheMeta(meta)
}

export function getOnlineChapterCacheStats(bookId = '') {
  const meta = getChapterCacheMeta()
  const books = new Set()
  let cachedChapters = 0
  let totalChars = 0
  Object.keys(meta).forEach(key => {
    const item = meta[key]
    if (!item || (bookId && item.bookId !== bookId)) return
    cachedChapters += 1
    totalChars += Number(item.chars || 0)
    if (item.bookId) books.add(item.bookId)
  })

  getOnlineShelfBooks().forEach(book => {
    if (bookId && book.id !== bookId) return
    ;(book.chapters || []).forEach((chapter, index) => {
      const key = chapterCacheMetaKey(book.id, index)
      if (meta[key]) return
      const content = chapter.content || readOnlineChapterCache(book.id, index)
      if (!content) return
      cachedChapters += 1
      totalChars += String(content).length
      books.add(book.id)
    })
  })

  return {
    books: bookId ? (cachedChapters ? 1 : 0) : books.size,
    cachedChapters,
    totalChars
  }
}

export function clearOnlineChapterCache(bookId = '') {
  const meta = getChapterCacheMeta()
  let removed = 0
  Object.keys(meta).forEach(key => {
    const item = meta[key]
    if (!item || (bookId && item.bookId !== bookId)) return
    removeOnlineChapterCache(item.bookId, item.chapterIndex, meta)
    removed += 1
  })
  getOnlineShelfBooks().forEach(book => {
    if (bookId && book.id !== bookId) return
    ;(book.chapters || []).forEach((chapter, index) => {
      const cached = readOnlineChapterCache(book.id, index)
      if (!cached) return
      removeOnlineChapterCache(book.id, index, meta)
      removed += 1
    })
  })
  writeChapterCacheMeta(meta)
  if (bookId) {
    const books = getOnlineShelfBooks().map(book => {
      if (book.id !== bookId) return book
      return {
        ...book,
        chapters: (book.chapters || []).map(chapter => ({
          ...chapter,
          content: '',
          isCached: false,
          loadStatus: chapter.errorMessage ? 'failed' : 'idle'
        }))
      }
    })
    writeStorage(ONLINE_BOOKS_KEY, books)
  }
  return { removed }
}

export function exportOnlineBookTxt(bookId) {
  const book = getOnlineBook(bookId)
  if (!book) throw new Error('书籍不存在或已删除')
  const lines = [
    book.title,
    `作者：${book.author || '未知作者'}`,
    `来源：${book.sourceName || '在线书源'}`,
    ''
  ]
  ;(book.chapters || []).forEach((chapter, index) => {
    const content = chapter.content || readOnlineChapterCache(book.id, index)
    if (!content) return
    lines.push(chapter.title || `第 ${index + 1} 章`, '', String(content).trim(), '')
  })
  return {
    fileName: `${book.title || 'online-book'}.txt`,
    text: lines.join('\n')
  }
}

function updateOnlineBookChapterCache(book, loadedChapter) {
  if (!book || !book.id || !loadedChapter) return book
  const current = getOnlineBook(book.id) || normalizeOnlineBookForShelf(book)
  const chapters = (current.chapters && current.chapters.length ? current.chapters : book.chapters || []).map((chapter, index) => {
    if (index !== Number(loadedChapter.index || 0)) return chapter
    return {
      ...chapter,
      ...loadedChapter,
      isCached: !!loadedChapter.isCached,
      loadStatus: loadedChapter.loadStatus || 'cached',
      errorMessage: ''
    }
  })
  return addOnlineBookToShelf({
    ...current,
    chapters
  })
}

export async function preloadOnlineChapters(book, startIndex = 0, options = {}) {
  const settings = getChapterCacheSettings()
  if (settings.offlineMode) {
    return { total: 0, loaded: 0, skipped: 0, failed: 0 }
  }
  const count = clampNumber(options.count, 0, 10, settings.preloadCount)
  if (!book || !book.id || !count) {
    return { total: 0, loaded: 0, skipped: 0, failed: 0 }
  }
  let latestBook = getOnlineBook(book.id) || normalizeOnlineBookForShelf(book)
  const protectedKeys = [
    ...Object.keys(getChapterCacheMeta()),
    ...(latestBook.chapters || []).reduce((keys, chapter, index) => {
      if (chapter.content || chapter.isCached || readOnlineChapterCache(latestBook.id, index)) {
        keys.push(chapterCacheMetaKey(latestBook.id, index))
      }
      return keys
    }, [])
  ]
  const start = Number(startIndex || 0) + 1
  const end = Math.min((latestBook.chapters || []).length, start + count)
  const summary = { total: Math.max(0, end - start), loaded: 0, skipped: 0, failed: 0 }
  for (let index = start; index < end; index += 1) {
    const chapter = (latestBook.chapters || [])[index]
    if (!chapter) continue
    if (chapter.content || chapter.isCached || readOnlineChapterCache(latestBook.id, index)) {
      summary.skipped += 1
      continue
    }
    try {
      await loadOnlineChapter(latestBook, chapter, {
        autoPreload: false,
        protectedCacheKeys: protectedKeys
      })
      summary.loaded += 1
      latestBook = getOnlineBook(latestBook.id) || latestBook
    } catch (error) {
      summary.failed += 1
    }
  }
  return summary
}

function normalizeSourceQuality(value = {}) {
  value = value && typeof value === 'object' ? value : {}
  const searchCount = Number(value.searchCount || 0)
  const successCount = Number(value.successCount || 0)
  const failCount = Number(value.failCount || 0)
  const totalElapsedMs = Number(value.totalElapsedMs || 0)
  const averageElapsedMs = searchCount > 0
    ? Math.round(totalElapsedMs / searchCount)
    : Number(value.averageElapsedMs || 0)
  const successRate = searchCount > 0 ? successCount / searchCount : 0
  const speedScore = averageElapsedMs > 0
    ? Math.max(0, 30 - Math.min(30, Math.round(averageElapsedMs / 250)))
    : 15
  const qualityScore = Math.max(0, Math.min(100, Math.round(successRate * 70 + speedScore)))
  return {
    searchCount,
    successCount,
    failCount,
    totalElapsedMs,
    averageElapsedMs,
    lastElapsedMs: Number(value.lastElapsedMs || 0),
    lastResultCount: Number(value.lastResultCount || 0),
    lastError: String(value.lastError || ''),
    updatedAt: Number(value.updatedAt || 0),
    qualityScore
  }
}

function normalizeSourceHealth(value = {}) {
  if (!value || typeof value !== 'object') {
    return {
      status: 'untested',
      score: 0,
      keyword: '',
      checkedAt: 0,
      elapsedMs: 0,
      failedStage: '',
      errorCode: '',
      message: '',
      stages: [],
      stageCount: 0,
      passed: 0,
      failed: 0
    }
  }
  const stages = Array.isArray(value.stages) ? value.stages.map(stage => ({
    id: String(stage.id || ''),
    title: String(stage.title || stage.id || ''),
    status: stage.status === 'failed' ? 'failed' : stage.status === 'skipped' ? 'skipped' : 'passed',
    message: String(stage.message || ''),
    errorCode: String(stage.errorCode || ''),
    httpStatus: Number(stage.httpStatus || 0),
    retryable: stage.retryable === true,
    elapsedMs: Number(stage.elapsedMs || 0)
  })).filter(stage => stage.id) : []
  const passed = stages.filter(stage => stage.status === 'passed').length
  const failed = stages.filter(stage => stage.status === 'failed').length
  const score = Number.isFinite(Number(value.score))
    ? Math.max(0, Math.min(100, Math.round(Number(value.score))))
    : calculateHealthScore(stages)
  return {
    status: value.status === 'passed' ? 'passed' : failed ? 'failed' : score >= 80 ? 'passed' : 'failed',
    score,
    keyword: String(value.keyword || ''),
    checkedAt: Number(value.checkedAt || 0),
    elapsedMs: Number(value.elapsedMs || stages.reduce((sum, stage) => sum + Number(stage.elapsedMs || 0), 0)),
    stageCount: stages.length,
    passed,
    failed,
    failedStage: String(value.failedStage || ((stages.find(stage => stage.status === 'failed') || {}).id || '')),
    errorCode: String(value.errorCode || ((stages.find(stage => stage.status === 'failed') || {}).errorCode || '')),
    message: String(value.message || ''),
    stages
  }
}

function calculateHealthScore(stages = []) {
  const weights = {
    search: 25,
    bookInfo: 20,
    toc: 20,
    content: 25,
    shelf: 10
  }
  return Math.max(0, Math.min(100, Math.round(stages.reduce((sum, stage) => {
    return sum + (stage.status === 'passed' ? (weights[stage.id] || 10) : 0)
  }, 0))))
}

function writeSourceHealthResult(sourceId, health) {
  if (!sourceId) return normalizeSourceHealth(health)
  const normalized = normalizeSourceHealth(health)
  const settings = getSourceSettings()
  settings[sourceId] = {
    ...(settings[sourceId] || {}),
    health: normalized,
    updatedAt: Date.now()
  }
  writeSourceSettingsDeferred(settings, sourceId)
  return normalized
}

export function recordSourceAcceptanceWindow(sourceId, result = {}) {
  if (!sourceId || !result.windowId) return []
  const settings = getSourceSettings()
  const current = Array.isArray((settings[sourceId] || {}).acceptanceWindows)
    ? settings[sourceId].acceptanceWindows.slice()
    : []
  const normalized = {
    windowId: String(result.windowId).slice(0, 80),
    status: result.status === 'passed' ? 'passed' : 'failed',
    checkedAt: Number(result.checkedAt || Date.now()),
    errorCode: result.status === 'passed' ? '' : String(result.errorCode || '')
  }
  const next = current.filter(item => item && item.windowId !== normalized.windowId)
  next.push(normalized)
  next.sort((left, right) => Number(right.checkedAt || 0) - Number(left.checkedAt || 0))
  settings[sourceId] = {
    ...(settings[sourceId] || {}),
    acceptanceWindows: next.slice(0, 4),
    updatedAt: Date.now()
  }
  writeSourceSettings(settings)
  return settings[sourceId].acceptanceWindows
}

function writeSourceQualityResult(sourceId, result = {}) {
  if (!sourceId) return normalizeSourceQuality()
  const settings = getSourceSettings()
  const current = normalizeSourceQuality((settings[sourceId] || {}).quality)
  const elapsedMs = Number(result.elapsedMs || 0)
  const ok = result.status === 'success'
  const next = normalizeSourceQuality({
    searchCount: current.searchCount + 1,
    successCount: current.successCount + (ok ? 1 : 0),
    failCount: current.failCount + (ok ? 0 : 1),
    totalElapsedMs: current.totalElapsedMs + elapsedMs,
    lastElapsedMs: elapsedMs,
    lastResultCount: Number(result.count || 0),
    lastError: ok ? '' : String(result.message || ''),
    updatedAt: Date.now()
  })
  settings[sourceId] = {
    ...(settings[sourceId] || {}),
    quality: next,
    updatedAt: Date.now()
  }
  writeSourceSettingsDeferred(settings, sourceId)
  return next
}

export function getSourceQualityStats() {
  const settings = getSourceSettings()
  return Object.keys(settings).reduce((result, sourceId) => {
    if (settings[sourceId] && settings[sourceId].quality) {
      result[sourceId] = normalizeSourceQuality(settings[sourceId].quality)
    }
    return result
  }, {})
}

export function detectImportInputType(input) {
  const payload = detectSourceImportPayload(input)
  const yck = resolveYckCeoUrl(payload.value || input)
  if (yck.isYck) {
    if (yck.action === 'navigate') return { type: 'repository-list', value: yck.url }
    if (yck.kind === 'content') return { type: 'repository-detail', value: yck.url, sourceUrl: yck.sourceUrl }
    if (yck.kind === 'json') return { type: 'json-url', value: yck.url, sourceUrl: yck.sourceUrl }
  }
  if (payload.type === 'repository-page') {
    const value = String(payload.value || '').trim()
    if (/\/yuedu\/shuyuan\/index\.html(?:[?#].*)?$/i.test(value)) {
      return { type: 'repository-list', value }
    }
    if (/\/yuedu\/shuyuan\/content\/id\/\d+\.html(?:[?#].*)?$/i.test(value)) {
      return { type: 'repository-detail', value }
    }
  }
  return payload
}

export function extractYckSourceId(input) {
  const value = normalizeYckInput(input)
  const match = value.match(/\/yuedu\/shuyuan\/(?:content|json)\/id\/(\d+)\.(?:html|json)(?:[?#].*)?$/i)
  return match ? match[1] : ''
}

export function buildYckJsonUrl(id) {
  const value = String(id || '').trim()
  return value ? `https://www.yckceo.com/yuedu/shuyuan/json/id/${value}.json` : ''
}

export function buildYckContentUrl(id) {
  const value = String(id || '').trim()
  return value ? `https://www.yckceo.com/yuedu/shuyuan/content/id/${value}.html` : ''
}

export function detectYckCeoUrl(input) {
  const value = normalizeYckInput(input)
  if (!/https?:\/\/(?:www\.)?yck(?:ceo\.com|2026\.top)\//i.test(value)) {
    return { isYck: false, kind: '', id: '', url: value }
  }
  if (/\/yuedu\/shuyuan\/index\.html(?:[?#].*)?$/i.test(value)) {
    return { isYck: true, kind: 'list', id: '', url: value }
  }
  const id = extractYckSourceId(value)
  if (/\/yuedu\/shuyuan\/content\/id\/\d+\.html(?:[?#].*)?$/i.test(value)) {
    return { isYck: true, kind: 'content', id, url: value }
  }
  if (/\/yuedu\/shuyuan\/json\/id\/\d+\.json(?:[?#].*)?$/i.test(value)) {
    return { isYck: true, kind: 'json', id, url: value }
  }
  return { isYck: true, kind: 'unknown', id, url: value }
}

export function resolveYckCeoUrl(input) {
  const detected = detectYckCeoUrl(input)
  if (!detected.isYck) return detected
  if (detected.kind === 'list') {
    return { ...detected, action: 'navigate', sourceUrl: detected.url }
  }
  if (detected.kind === 'content' && detected.id) {
    const jsonUrl = buildYckJsonUrl(detected.id)
    return {
      ...detected,
      originalUrl: detected.url,
      url: jsonUrl,
      action: 'fetch-json',
      sourceUrl: jsonUrl
    }
  }
  if (detected.kind === 'json') {
    return {
      ...detected,
      action: 'fetch-json',
      sourceUrl: detected.url
    }
  }
  return detected
}

function normalizeYckInput(input) {
  const payload = detectSourceImportPayload(input)
  return String(payload.value || input || '').trim()
}

export async function resolveImportInput(input, options = {}) {
  const detected = detectImportInputType(input)
  if (detected.type === 'json') {
    return {
      type: 'json',
      rawSources: detected.value,
      sourceMeta: { source: options.source || 'text' }
    }
  }
  if (detected.type === 'repository-list') {
    return {
      type: 'repository-list',
      action: 'navigate',
      url: detected.value,
      sourceMeta: { source: options.source || 'repository-list', sourceUrl: detected.value }
    }
  }
  if (
    detected.type === 'import-link' ||
    detected.type === 'json-url' ||
    detected.type === 'repository-detail' ||
    detected.type === 'repository-page' ||
    detected.type === 'url'
  ) {
    const requestUrl = detected.sourceUrl || detected.value
    const loaded = await loadSourceImportTextFromUrl(requestUrl, options)
    return {
      type: loaded.inputType || (detected.type === 'import-link' ? 'json-url' : detected.type),
      rawSources: loaded.text,
      sourceUrl: loaded.sourceUrl,
      sourceMeta: {
        source: options.source || importSourceLabel(detected.type),
        sourceUrl: loaded.sourceUrl || requestUrl
      }
    }
  }
  throw new Error('No importable book source JSON, URL, or source market link was recognized')
}

function importSourceLabel(type) {
  if (type === 'repository-detail') return 'repository-detail'
  if (type === 'import-link') return 'import-link'
  if (type === 'json-url') return 'json-url'
  return 'url'
}

export function normalizeBookSources(rawSources, sourceMeta = {}) {
  const sources = typeof rawSources === 'string'
    ? parseSourceJson(rawSources)
    : Array.isArray(rawSources)
      ? rawSources.map(item => normalizeSourceConfig(item))
      : [normalizeSourceConfig(rawSources)]
  return sources.map(source => ({
    ...source,
    sourceMeta: {
      source: sourceMeta.source || '',
      sourceUrl: sourceMeta.sourceUrl || source.sourceUrl || ''
    }
  }))
}

export function analyzeBookSourceCompatibility(source) {
  const raw = (source && (source.raw || source)) || {}
  const features = source && source.features || detectSourceFeatures(raw)
  const ruleSearch = normalizeRuleObject(raw.ruleSearch)
  const ruleBookInfo = normalizeRuleObject(raw.ruleBookInfo)
  const ruleToc = normalizeRuleObject(raw.ruleToc)
  const ruleContent = normalizeRuleObject(raw.ruleContent)
  const ruleExplore = normalizeRuleObject(raw.ruleExplore)
  const name = String(raw.bookSourceName || raw.name || source && source.name || '').trim()
  const baseUrl = String(raw.bookSourceUrl || raw.sourceUrl || source && source.baseUrl || '').trim()
  const sourceType = Number(raw.bookSourceType || 0)
  const supportedSourceType = sourceType === 0
  const unsupportedReasons = []
  const stageUnsupported = {
    search: hasStageUnsupportedRule({ searchUrl: raw.searchUrl, ruleSearch: raw.ruleSearch }),
    explore: hasStageUnsupportedRule({ exploreUrl: raw.exploreUrl || raw.ruleExploreUrl || raw.explore, ruleExplore: raw.ruleExplore }),
    detail: hasStageUnsupportedRule(raw.ruleBookInfo),
    toc: hasStageUnsupportedRule(raw.ruleToc),
    content: hasStageUnsupportedRule(raw.ruleContent)
  }

  Object.keys(stageUnsupported).forEach(stage => {
    if (!stageUnsupported[stage]) return
    unsupportedReasons.push({
      stage,
      reason: stageUnsupported[stage]
    })
  })
  if (!supportedSourceType) {
    unsupportedReasons.push({
      stage: 'import',
      reason: `书源类型 ${sourceType} 已保存，但当前阶段仅运行文字小说（bookSourceType=0）`
    })
  }

  const hasSearchRule = !!(raw.searchUrl && Object.keys(ruleSearch).length)
  const hasExploreUrl = !!(raw.exploreUrl || raw.ruleExploreUrl || raw.explore)
  const hasExploreRule = hasExploreUrl && Object.keys(ruleExplore).length > 0
  const hasDetailRule = Object.keys(ruleBookInfo).length > 0
  const hasTocRule = Object.keys(ruleToc).length > 0
  const hasContentRule = Object.keys(ruleContent).length > 0
  const searchable = hasSearchRule && !stageUnsupported.search
  const discoverable = hasExploreRule && !stageUnsupported.explore
  const detailReadable = hasDetailRule && !stageUnsupported.detail
  const tocReadable = hasTocRule && !stageUnsupported.toc
  const contentReadable = hasContentRule && !stageUnsupported.content
  const diagnosticExploreOnly = hasExploreUrl && !stageUnsupported.explore
  const identityValid = !!(name && baseUrl)
  const importable = identityValid

  let level = 'compatible'
  if (!identityValid) level = 'importUnsupported'
  else if (stageUnsupported.search || stageUnsupported.explore || stageUnsupported.detail || stageUnsupported.toc) level = 'h5Unsupported'
  else if (stageUnsupported.content || features.cookie || features.login || features.webView) level = 'partialCompatible'

  const compatible = level === 'compatible'
  const reasons = uniqueStrings(unsupportedReasons.map(item => item.reason))
  if (!identityValid && !reasons.length) {
    reasons.push('Missing required fields：缺少书源名称或基础地址')
    unsupportedReasons.push({
      stage: 'import',
      reason: 'Missing required fields：缺少书源名称或基础地址'
    })
  }

  let status = 'ready'
  let errorCode = ''
  if (!identityValid) {
    status = 'invalid'
    errorCode = 'INVALID_IDENTITY'
  } else if (!supportedSourceType) {
    status = 'blocked'
    errorCode = 'SOURCE_TYPE_UNSUPPORTED'
  } else if (source && source.compatibilityLevel === 'unsupported' || hasUnsupportedRule(raw)) {
    status = 'blocked'
    errorCode = 'SCRIPT_UNSUPPORTED'
    if (!reasons.length) reasons.push('包含未映射的高风险脚本或宿主能力')
  } else if (features.login) {
    status = 'needs_login'
    errorCode = 'LOGIN_REQUIRED'
  } else if (
    stageUnsupported.content
    || (stageUnsupported.search && !discoverable)
    || (stageUnsupported.explore && !searchable)
  ) {
    status = 'blocked'
    errorCode = 'SCRIPT_UNSUPPORTED'
  } else if (!searchable && !discoverable || !tocReadable || !contentReadable || unsupportedReasons.length) {
    status = 'partial'
    errorCode = 'PARTIAL_CAPABILITY'
  }

  const androidSupported = supportedSourceType && (status === 'ready' || status === 'partial' || status === 'needs_login')
  const h5Supported = status === 'ready' && !features.cookie && !features.webView && !features.login
  const backendSupported = status === 'ready' && !features.webView && !unsupportedReasons.length

  return {
    importable,
    visibleAfterImport: importable,
    searchable,
    discoverable,
    detailReadable,
    tocReadable,
    contentReadable,
    level,
    compatibleLevel: level,
    unsupportedReasons,
    compatible,
    reasons: compatible ? [] : (reasons.length ? reasons : ['Contains unsupported complex rules']),
    features,
    requiresCookie: !!features.cookie,
    requiresLogin: !!features.login,
    requiresWebView: !!features.webView,
    rules: {
      search: !!(raw.searchUrl && Object.keys(ruleSearch).length),
      bookInfo: !!Object.keys(ruleBookInfo).length,
      toc: !!Object.keys(ruleToc).length,
      content: !!Object.keys(ruleContent).length
    },
    sourceType,
    supportedSourceType,
    status,
    errorCode,
    android_supported: androidSupported,
    h5_supported: h5Supported,
    backend_supported: backendSupported
  }
}

function hasStageUnsupportedRule(value) {
  if (!value) return ''
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  if (!text || text === '{}') return ''
  const checks = [
    { pattern: /java\.ajax/i, reason: '规则调用 java.ajax，当前版本未映射该异步宿主 API' },
    { pattern: /org\.jsoup/i, reason: '规则依赖 org.jsoup，当前版本仅支持 CSS/XPath/JSONPath 解析' },
    { pattern: /\bjava\./i, reason: '规则依赖未列入白名单的 java.* 能力' },
    { pattern: /webview/i, reason: '规则需要 WebView 渲染通道' },
    { pattern: /\beval\s*\(|\bFunction\s*\(/i, reason: '规则使用动态 JavaScript 执行' },
    { pattern: /@js:[\s\S]*\.(?:map|filter|reduce)\s*\(/i, reason: 'JS 规则使用当前白名单未开放的数组回调' },
    { pattern: /CryptoJS|base64 dynamic decode/i, reason: '规则需要当前未支持的动态解码或加密逻辑' }
  ]
  const found = checks.find(item => item.pattern.test(text))
  return found ? found.reason : ''
}

export function buildImportPreview(sources = [], existingSources = getUserSources(), options = {}) {
  const existing = Array.isArray(existingSources) ? existingSources : []
  const existingByKey = new Map(existing.map(source => [source.sourceKey || createSourceKey(source.raw || source), source]))
  const resolvedByKey = new Map(existingByKey)
  const duplicateStrategy = options.duplicateStrategy === 'skip' ? 'skip' : 'overwrite'
  const rows = (Array.isArray(sources) ? sources : []).map(source => {
    const compatibility = analyzeBookSourceCompatibility(source)
    const sourceKey = source.sourceKey || createSourceKey(source.raw || source)
    const existingSource = resolvedByKey.get(sourceKey)
    const duplicate = !!existingSource
    const invalid = compatibility.status === 'invalid'
    const unsupported = compatibility.status !== 'ready'
    const compatible = compatibility.compatible
    const action = invalid
      ? 'invalid'
      : duplicate
        ? (duplicateStrategy === 'skip' ? 'skip' : 'overwrite')
        : 'import'
    const row = {
      ...source,
      id: existingSource ? existingSource.id : source.id,
      sourceKey,
      enabled: compatibility.status === 'ready' || (!options.enableReadyOnly && compatibility.status === 'partial')
        ? source.enabled !== false
        : false,
      action,
      duplicate,
      invalid,
      unsupported,
      compatible,
      compatibilityStatus: compatibility.level,
      compatibleLevel: compatibility.level,
      importable: compatibility.importable,
      searchable: compatibility.searchable,
      discoverable: compatibility.discoverable,
      detailReadable: compatibility.detailReadable,
      tocReadable: compatibility.tocReadable,
      contentReadable: compatibility.contentReadable,
      unsupportedReasons: compatibility.unsupportedReasons,
      reasons: compatibility.reasons,
      rules: compatibility.rules,
      features: compatibility.features,
      requiresCookie: compatibility.requiresCookie,
      requiresLogin: compatibility.requiresLogin,
      requiresWebView: compatibility.requiresWebView,
      status: compatibility.status,
      errorCode: compatibility.errorCode,
      android_supported: compatibility.android_supported,
      h5_supported: compatibility.h5_supported,
      backend_supported: compatibility.backend_supported,
      sourceType: compatibility.sourceType,
      supportedSourceType: compatibility.supportedSourceType,
      format: source.formatVersion || detectSourceFormat(source.raw || source),
      source: source.sourceMeta && source.sourceMeta.source || '',
      sourceUrl: source.sourceMeta && source.sourceMeta.sourceUrl || '',
      sourceName: source.name,
      comment: source.comment || (source.raw && (source.raw.bookSourceComment || source.raw.sourceComment)) || '',
      weight: Number(source.weight || source.raw && (source.raw.weight || source.raw.customOrder) || 0)
    }
    resolvedByKey.set(sourceKey, row)
    return row
  })
  return summarizeImportPreviewRows(rows)
}

function summarizeImportPreviewRows(rows = []) {
  const groups = rows.map(source => source.group || source.raw && source.raw.bookSourceGroup || 'User Import')
  return {
    total: rows.length,
    imported: rows.filter(source => source.action === 'import').length,
    updated: rows.filter(source => source.action === 'overwrite').length,
    skipped: rows.filter(source => source.action === 'skip').length,
    failed: 0,
    incompatible: rows.filter(source => source.status === 'blocked' || source.status === 'invalid').length,
    unsupported: rows.filter(source => source.status !== 'ready' && source.status !== 'invalid').length,
    partialCompatible: rows.filter(source => source.compatibleLevel === 'partialCompatible').length,
    groups: Array.from(new Set(groups)),
    sources: rows
  }
}

export function applyImportPreview(preview, options = {}) {
  const rows = Array.isArray(preview && preview.sources) ? preview.sources : []
  const duplicateStrategy = options.duplicateStrategy === 'skip' ? 'skip' : 'overwrite'
  const deferred = options.deferPersistence === true
  const current = Array.isArray(options.currentSources) ? options.currentSources : getUserSources()
  const nextById = new Map(current.map(source => [source.id, source]))
  const skippedIds = new Set()
  const appliedIds = new Set()
  let imported = 0
  let updated = 0
  let skipped = 0
  const historyRows = []

  rows.forEach(row => {
    const exists = nextById.has(row.id)
    if (row.action === 'invalid' || row.status === 'invalid') {
      skipped += 1
      skippedIds.add(row.id)
      historyRows.push(buildImportHistoryItem(row, 'unsupported', options))
      return
    }
    if (exists && (duplicateStrategy === 'skip' || row.action === 'skip')) {
      skipped += 1
      skippedIds.add(row.id)
      historyRows.push(buildImportHistoryItem(row, 'skipped', options))
      return
    }
    nextById.set(row.id, stripImportPreviewFields(row))
    appliedIds.add(row.id)
    if (exists) {
      updated += 1
      historyRows.push(buildImportHistoryItem(row, 'overwritten', options))
    } else {
      imported += 1
      historyRows.push(buildImportHistoryItem(row, 'added', options))
    }
  })

  const appliedRows = Array.from(appliedIds)
    .filter(id => !skippedIds.has(id))
    .map(id => nextById.get(id))
    .filter(Boolean)
  const untouchedRows = current.filter(source => !appliedIds.has(source.id))
  const nextSources = [...appliedRows, ...untouchedRows]
  if (!deferred) writeUserSources(nextSources)
  const visibleCheck = deferred
    ? {
        total: appliedRows.length,
        visible: 0,
        hidden: appliedRows.length,
        deferred: true,
        items: appliedRows.map(source => ({ id: source.id, name: source.name, visible: false, enabled: !!source.enabled, reason: '等待批量提交' }))
      }
    : verifyImportedSourcesVisible(appliedRows)
  if (!deferred) {
    recordImportHistory(historyRows.map(item => ({
      ...item,
      visible: visibleCheck.items.some(visibleItem => visibleItem.id === item.id && visibleItem.visible)
    })))
  }

  const result = {
    total: rows.length,
    imported,
    updated,
    skipped,
    failed: 0,
    incompatible: rows.filter(source => source.status === 'blocked' || source.status === 'invalid').length,
    unsupported: rows.filter(source => source.status !== 'ready' && source.status !== 'invalid').length,
    partialCompatible: rows.filter(source => source.compatibleLevel === 'partialCompatible').length,
    actualWritten: imported + updated,
    visible: visibleCheck.visible,
    visibleCheck,
    importedSources: appliedRows,
    sources: rows,
    nextSources
  }
  if (!deferred) result.importLog = recordImportLog(buildImportLog(preview, rows, result, options))
  return result
}

export function verifyImportedSourcesVisible(importedSources = []) {
  const visibleSources = getSourceConfigs()
  const visibleById = new Map(visibleSources.map(source => [source.id, source]))
  const items = (Array.isArray(importedSources) ? importedSources : []).map(source => {
    const visible = !!(source && source.id && visibleById.has(source.id))
    return {
      id: source && source.id || '',
      name: source && source.name || '',
      visible,
      enabled: visible ? !!visibleById.get(source.id).enabled : false,
      reason: visible ? '' : 'Imported source was not found by getSourceConfigs() after persistence'
    }
  })
  return {
    total: items.length,
    visible: items.filter(item => item.visible).length,
    hidden: items.filter(item => !item.visible).length,
    items
  }
}

export function recordImportHistory(items = []) {
  const rows = (Array.isArray(items) ? items : [items]).filter(Boolean)
  if (!rows.length) return getRecentImportHistory()
  const current = getRecentImportHistory(100)
  const next = [
    ...rows.map(item => ({
      id: item.id || '',
      name: item.name || '',
      url: item.url || '',
      group: item.group || '',
      sourceType: item.sourceType || '',
      importMethod: item.importMethod || 'unknown',
      importTime: item.importTime || Date.now(),
      action: item.action || 'skipped',
      visible: !!item.visible,
      compatibleLevel: item.compatibleLevel || '',
      reason: item.reason || ''
    })),
    ...current
  ].slice(0, 20)
  writeStorage(IMPORT_HISTORY_KEY, next)
  return next
}

export function getRecentImportHistory(limit = 20) {
  const rows = readStorage(IMPORT_HISTORY_KEY, [])
  const list = Array.isArray(rows) ? rows : []
  return list.slice(0, Math.max(0, Number(limit) || 20))
}

export function recordImportLog(entry = {}) {
  return saveImportLog(entry)
}

export function getImportLogs(limit = 20) {
  return getStoredImportLogs(limit)
}

export function clearImportLogs() {
  return clearStoredImportLogs()
}

function buildImportLog(preview, rows = [], result = {}, options = {}) {
  const normalizedRows = Array.isArray(rows) ? rows : []
  const sourceRow = normalizedRows.find(row => row && (row.source || row.sourceUrl)) || {}
  const rawType = options.rawType
    || options.originalType
    || preview && preview.originalType
    || preview && preview.type
    || sourceRow.source
    || (normalizedRows.length ? detectSourceFormat(normalizedRows[0].raw || normalizedRows[0]) : '')
    || 'unknown'
  const items = normalizedRows.map(row => buildImportLogItem(row, result))
  const success = items.filter(item => item.status === 'success').length
  const unsupported = items.filter(item => item.status === 'unsupported').length
  const duplicated = items.filter(item => item.status === 'duplicated').length
  const skipped = items.filter(item => item.status === 'skipped').length
  const failed = items.filter(item => item.status === 'failed' || item.status === 'blocked').length
  return {
    id: `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    time: new Date().toISOString(),
    source: options.importMethod || sourceRow.source || 'unknown',
    rawType,
    sourceText: options.sourceText || options.sourceUrl || preview && preview.sourceUrl || sourceRow.sourceUrl || '',
    total: normalizedRows.length,
    success,
    failed,
    skipped,
    duplicated,
    unsupported,
    items,
    storageCount: getSourceConfigs().length,
    importTime: Date.now(),
    sourceUrl: options.sourceUrl || preview && preview.sourceUrl || sourceRow.sourceUrl || '',
    originalType: rawType,
    parsedCount: normalizedRows.length,
    successCount: Number(result.actualWritten || 0),
    importedCount: Number(result.imported || 0),
    updatedCount: Number(result.updated || 0),
    skippedCount: Number(result.skipped || 0),
    incompatibleCount: Number(result.incompatible || 0),
    failedCount: failed
  }
}

function buildImportLogItem(row = {}, result = {}) {
  const raw = row.raw || row || {}
  const reason = collectImportFailureReasons([row]).join('; ')
  const saved = Array.isArray(result.importedSources)
    ? result.importedSources.some(source => source && source.id === row.id)
    : false
  const h5Unsupported = row.compatibleLevel === 'h5Unsupported' || row.compatibleLevel === 'partialCompatible'
  let status = 'success'
  let itemReason = saved ? '导入成功，已保存到本地书源列表' : ''
  if (row.action === 'invalid' || row.status === 'invalid') {
    status = 'blocked'
    itemReason = reason || '书源缺少必要字段或需要当前版本不支持的特殊能力'
  } else if (row.action === 'skip' && row.duplicate) {
    status = 'duplicated'
    itemReason = '重复书源，已跳过'
  } else if (row.action === 'skip') {
    status = 'skipped'
    itemReason = reason || '已跳过'
  } else if (saved && h5Unsupported) {
    status = 'unsupported'
    itemReason = reason || '该书源部分规则依赖 JS / WebView，当前版本不执行第三方 JS'
  }
  return {
    name: row.name || row.sourceName || raw.bookSourceName || '',
    url: raw.bookSourceUrl || row.baseUrl || '',
    status,
    reason: itemReason,
    h5Unsupported,
    unsupportedReason: h5Unsupported ? itemReason : '',
    saved
  }
}

function collectImportFailureReasons(rows = []) {
  const reasons = []
  rows.forEach(row => {
    if (Array.isArray(row.unsupportedReasons)) {
      row.unsupportedReasons.forEach(item => reasons.push(item && item.reason))
    }
    if (Array.isArray(row.reasons)) {
      row.reasons.forEach(reason => reasons.push(reason))
    }
  })
  return uniqueStrings(reasons)
}

function buildImportHistoryItem(row, action, options = {}) {
  const raw = row && (row.raw || row) || {}
  return {
    id: row.id,
    name: row.name || row.sourceName || raw.bookSourceName || '',
    url: raw.bookSourceUrl || row.baseUrl || '',
    group: row.group || raw.bookSourceGroup || '',
    sourceType: row.format || row.formatVersion || detectSourceFormat(raw),
    importMethod: options.importMethod || row.source || row.sourceMeta && row.sourceMeta.source || 'unknown',
    importTime: Date.now(),
    action,
    visible: false,
    compatibleLevel: row.compatibleLevel || row.compatibilityStatus || '',
    /*
    reason: Array.isArray(row.unsupportedReasons) && row.unsupportedReasons.length
      ? row.unsupportedReasons.map(item => item.reason).join('；')
      : Array.isArray(row.reasons) ? row.reasons.join('；') : ''
  }
}

    */
    reason: Array.isArray(row.unsupportedReasons) && row.unsupportedReasons.length
      ? uniqueStrings(row.unsupportedReasons.map(item => item.reason)).join('; ')
      : Array.isArray(row.reasons) ? uniqueStrings(row.reasons).join('; ') : ''
  }
}

function stripImportPreviewFields(source) {
  const {
    action,
    duplicate,
    unsupported,
    invalid,
    compatible,
    compatibilityStatus,
    importable,
    searchable,
    discoverable,
    detailReadable,
    tocReadable,
    contentReadable,
    unsupportedReasons,
    reasons,
    rules,
    requiresCookie,
    requiresLogin,
    requiresWebView,
    source: sourceLabel,
    sourceName,
    ...rest
  } = source
  return rest
}

export function importSourcesFromJson(text) {
  return importSourcesWithStats(text).sources.length
}

export function previewSourcesImport(text) {
  return buildImportPreview(normalizeBookSources(text, { source: 'text' }), getUserSources())
}

export async function previewSourcesFromAny(input) {
  const resolved = await resolveImportInput(input)
  if (resolved.action === 'navigate') {
    throw new Error('This is a source market list page. Open the source market page first.')
  }
  return {
    ...buildImportPreview(normalizeBookSources(resolved.rawSources, resolved.sourceMeta), getUserSources()),
    sourceUrl: resolved.sourceUrl
  }
}

export async function previewSourcesFromUrl(url) {
  const loaded = await loadSourceImportTextFromUrl(url)
  return {
    ...buildImportPreview(normalizeBookSources(loaded.text, {
      source: 'url',
      sourceUrl: loaded.sourceUrl
    }), getUserSources()),
    sourceUrl: loaded.sourceUrl
  }
}

export function importSourcesWithStats(text, options = {}) {
  const preview = buildImportPreview(normalizeBookSources(text, { source: options.source || 'text' }), getUserSources(), options)
  return applyImportPreview(preview, options)
}

export async function importSourcesFromUrl(url) {
  const result = await importSourcesFromUrlWithStats(url)
  return result.sources.length
}

export async function importSourcesFromUrlWithStats(url) {
  const loaded = await loadSourceImportTextFromUrl(url)
  const preview = buildImportPreview(normalizeBookSources(loaded.text, {
    source: 'url',
    sourceUrl: loaded.sourceUrl
  }), getUserSources())
  return applyImportPreview(preview)
}

async function loadSourceImportTextFromUrl(url, options = {}) {
  const spec = parseRequestSpec(url, {}, url)
  const loadText = options.fetchText
    ? targetUrl => options.fetchText(targetUrl, parseRequestSpec(targetUrl, {}, targetUrl))
    : targetUrl => requestText(parseRequestSpec(targetUrl, {}, targetUrl))
  const text = await loadText(spec.url)
  const pageJsonUrl = /^\s*</.test(String(text || '')) ? extractJsonLink(text, spec.url) || extractRepositorySourceUrl(text, spec.url) : ''
  if (pageJsonUrl) {
    if (/^data:application\/json,/i.test(pageJsonUrl)) {
      return {
        text: decodeURIComponent(pageJsonUrl.replace(/^data:application\/json,/i, '')),
        sourceUrl: pageJsonUrl
      }
    }
    const jsonText = await loadText(pageJsonUrl)
    return {
      text: jsonText,
      sourceUrl: pageJsonUrl
    }
  }
  try {
    parseSourceJson(text)
    return {
      text,
      sourceUrl: spec.url
    }
  } catch (error) {
    const directJsonUrl = extractJsonLink(text, spec.url) || extractRepositorySourceUrl(text, spec.url)
    if (!directJsonUrl) throw error
    if (/^data:application\/json,/i.test(directJsonUrl)) {
      return {
        text: decodeURIComponent(directJsonUrl.replace(/^data:application\/json,/i, '')),
        sourceUrl: directJsonUrl
      }
    }
    const jsonText = await loadText(directJsonUrl)
    return {
      text: jsonText,
      sourceUrl: directJsonUrl
    }
  }
}

export async function importSourcesFromAny(input) {
  const resolved = await resolveImportInput(input)
  if (resolved.action === 'navigate') {
    throw new Error('This is a source market list page. Open the source market page first.')
  }
  const preview = buildImportPreview(normalizeBookSources(resolved.rawSources, resolved.sourceMeta), getUserSources())
  return applyImportPreview(preview)
}

export const resolveSourceImport = resolveImportInput

export function previewSourceImport(resolution, options = {}) {
  if (!resolution || resolution.action === 'navigate') {
    throw new Error('书源仓库列表页需要先选择单个书源')
  }
  return buildImportPreview(
    normalizeBookSources(resolution.rawSources, resolution.sourceMeta || {}),
    getUserSources(),
    options
  )
}

export function applySourceImport(preview, options = {}) {
  return applyImportPreview(preview, options)
}

export function saveOnlineBookDraft(book) {
  writeStorage(ONLINE_DRAFT_KEY, book)
}

export function getOnlineBookDraft() {
  return readStorage(ONLINE_DRAFT_KEY, null)
}

export function getOnlineShelfBooks() {
  return readStorage(ONLINE_BOOKS_KEY, []).map(normalizeOnlineBookForShelf)
}

export function getOnlineBook(bookId) {
  return getOnlineShelfBooks().find(book => book.id === bookId)
}

export function addOnlineBookToShelf(book) {
  const normalized = normalizeOnlineBookForShelf(book)
  const current = getOnlineShelfBooks().filter(item => item.id !== normalized.id)
  writeStorage(ONLINE_BOOKS_KEY, [normalized, ...current])
  return normalized
}

export function deleteOnlineBookFromShelf(bookId) {
  const current = getOnlineShelfBooks()
  const next = current.filter(book => book.id !== bookId)
  writeStorage(ONLINE_BOOKS_KEY, next)
  return next.length !== current.length
}

function sourceHost(source) {
  try {
    return new URL(String(source.baseUrl || (source.raw && source.raw.bookSourceUrl) || '')).hostname.toLowerCase()
  } catch (error) {
    return String(source.baseUrl || source.id || '')
  }
}

function diversifySources(items = []) {
  const queues = new Map()
  items.forEach(item => {
    const host = sourceHost(item.source)
    if (!queues.has(host)) queues.set(host, [])
    queues.get(host).push(item)
  })
  const output = []
  while (queues.size) {
    Array.from(queues.entries()).forEach(([host, queue]) => {
      const item = queue.shift()
      if (item) output.push(item)
      if (!queue.length) queues.delete(host)
    })
  }
  return output
}

export function selectDiverseSourceCandidates(candidates = [], limit = ONLINE_SOURCE_SEARCH_LIMIT, perHostLimit = 2) {
  const maximum = Math.max(0, Number(limit || 0))
  const hostMaximum = Math.max(1, Number(perHostLimit || 2))
  const hostCounts = new Map()
  const output = []
  for (const source of Array.isArray(candidates) ? candidates : []) {
    if (!source || output.length >= maximum) break
    const host = sourceHost(source)
    const count = Number(hostCounts.get(host) || 0)
    if (count >= hostMaximum) continue
    hostCounts.set(host, count + 1)
    output.push(source)
  }
  return output
}

function sourceCandidateScore(item) {
  const quality = normalizeSourceQuality(item.source.quality)
  const speed = Math.max(0, 20 - Math.round(Number(item.runtime.latencyMs || quality.averageElapsedMs || 0) / 300))
  const bootstrap = SOURCE_BOOTSTRAP_KEYS.has(item.source.sourceKey) ? 100000 : 0
  return bootstrap + (item.tier * 1000) + (quality.qualityScore * 5) + speed + Number(item.source.weight || 0) / 1000
}

export function buildSourceCandidatePool(sources = getSourceConfigs(), context = {}) {
  const now = Number(context.now || Date.now())
  const excluded = new Set(Array.isArray(context.excludeSourceIds) ? context.excludeSourceIds : [])
  const pool = {
    verified: [],
    untested: [],
    retryable: [],
    cooling: [],
    blocked: [],
    candidates: [],
    counts: { total: 0, verified: 0, untested: 0, retryable: 0, cooling: 0, blocked: 0 }
  }
  ;(Array.isArray(sources) ? sources : getSourceConfigs()).forEach(source => {
    if (!source || excluded.has(source.id)) return
    pool.counts.total += 1
    const raw = source.raw || source
    const textSource = Number(raw.bookSourceType || 0) === 0
    const runtimeV2 = normalizeSourceRuntimeV2(source)
    const runtime = runtimeV2.search
    const storedStatus = String(source.status || '')
    const statusEligible = storedStatus
      ? storedStatus === 'ready' || storedStatus === 'partial'
      : getSourceDiagnostics(source).compatible
    const searchRulePresent = hasNonEmptyField(raw, ['searchUrl']) && hasNonEmptyField(raw, ['ruleSearch'])
    const searchRuleSafe = !hasStageUnsupportedRule({ searchUrl: raw.searchUrl, ruleSearch: raw.ruleSearch })
    if (!source.enabled || !textSource || !statusEligible || !searchRulePresent || !searchRuleSafe || runtime.status === 'blocked') {
      pool.blocked.push(source)
      pool.counts.blocked += 1
      return
    }
    if (runtime.status === 'cooldown' && runtime.cooldownUntil > now) {
      pool.cooling.push(source)
      pool.counts.cooling += 1
      return
    }
    const health = normalizeSourceHealth(source.health)
    const stableWindowPasses = new Set((source.acceptanceWindows || [])
      .filter(item => item && item.status === 'passed')
      .map(item => item.windowId)).size
    const healthFresh = health.status === 'passed' && health.checkedAt >= now - (7 * DAY_MS)
    const searchFresh = runtime.status === 'passed' && runtime.resultCount > 0 && runtime.lastSuccessAt >= now - (72 * HOUR_MS)
    const item = {
      source,
      diagnostics: { runtimeV2, health },
      runtime,
      tier: stableWindowPasses >= 2 ? 6 : healthFresh ? 5 : searchFresh ? 4 : runtime.status === 'passed' ? 3 : runtime.status === 'cooldown' ? 1 : 2
    }
    if (healthFresh || searchFresh) {
      pool.verified.push(item)
      pool.counts.verified += 1
    } else if (runtime.status === 'cooldown') {
      pool.retryable.push(item)
      pool.counts.retryable += 1
    } else {
      pool.untested.push(item)
      pool.counts.untested += 1
    }
  })
  const sortItems = items => diversifySources(items.sort((left, right) => sourceCandidateScore(right) - sourceCandidateScore(left)))
  pool.verified = sortItems(pool.verified)
  pool.untested = sortItems(pool.untested)
  pool.retryable = sortItems(pool.retryable)
  const ordered = [
    ...pool.verified.slice(0, 6),
    ...pool.untested,
    ...pool.retryable,
    ...pool.verified.slice(6)
  ]
  pool.candidates = ordered.map(item => item.source)
  return pool
}

export function getSourcePoolStats(sources = getSourceConfigs()) {
  const pool = buildSourceCandidatePool(sources)
  return {
    ...pool.counts,
    available: pool.candidates.length,
    checkedAt: Date.now()
  }
}

export function pickOnlineSearchSources(sources = getSourceConfigs(), limit = ONLINE_SOURCE_SEARCH_LIMIT) {
  return buildSourceCandidatePool(Array.isArray(sources) ? sources : getSourceConfigs()).candidates.slice(0, limit)
}

export function getOnlineExploreEntries(options = {}) {
  const sources = options.sources || getSourceConfigs()
  const limit = Number(options.limit || 0)
  const entries = sources
    .filter(source => {
      const raw = source.raw || source
      const storedStatus = String(source.status || '')
      const statusEligible = storedStatus
        ? storedStatus === 'ready' || storedStatus === 'partial'
        : getSourceDiagnostics(source).compatible
      const runtime = normalizeSourceRuntimeV2(source).explore
      const cooling = runtime.status === 'cooldown' && runtime.cooldownUntil > Date.now()
      const ruleSafe = !hasStageUnsupportedRule({
        exploreUrl: raw.exploreUrl || raw.ruleExploreUrl || raw.explore,
        ruleExplore: raw.ruleExplore
      })
      return source.enabled && statusEligible && ruleSafe && runtime.status !== 'blocked' && !cooling
    })
    .flatMap(source => parseSourceExploreUrl(source))
  return limit > 0 ? entries.slice(0, limit) : entries
}

function normalizeExploreCatalogTitle(title, kind = 'category') {
  const text = cleanText(title).replace(/[\s·|丨]/g, '')
  const mappings = [
    [/玄幻|奇幻/, '玄幻'], [/都市|现实|生活/, '都市'], [/历史|架空/, '历史'],
    [/仙侠|修真/, '仙侠'], [/武侠/, '武侠'], [/科幻|末世/, '科幻'],
    [/网游|游戏|电竞/, '网游'], [/言情|女生|女频/, '言情'], [/悬疑|灵异|惊悚/, '悬疑'],
    [/军事|战争/, '军事'], [/完本|完结/, '完本'], [/最新|新书|更新/, '最新'],
    [/热搜|热门|人气|畅销/, '热门'], [/收藏/, '收藏'], [/推荐/, '推荐']
  ]
  const matched = mappings.find(([pattern]) => pattern.test(text))
  if (matched) return matched[1]
  const stripped = text.replace(/小说|分类|频道|书库|榜单|排行榜|排行|总榜|榜$/g, '')
  return stripped || (kind === 'rank' ? '排行' : kind === 'latest' ? '最新' : '其他')
}

function exploreProviderScore(entry, sourceMap) {
  const source = sourceMap.get(entry.sourceId)
  if (!source) return 0
  const runtimeV2 = normalizeSourceRuntimeV2(source)
  const health = normalizeSourceHealth(source.health)
  const quality = normalizeSourceQuality(source.quality)
  const fullReading = health.status === 'passed' ? 10000 : 0
  const explored = runtimeV2.explore.status === 'passed' ? 5000 : 0
  const speed = Math.max(0, 1000 - Number(runtimeV2.explore.latencyMs || quality.averageElapsedMs || 1000))
  return fullReading + explored + (quality.qualityScore * 20) + speed + Number(source.weight || 0)
}

export function buildExploreCatalog(sources = getSourceConfigs(), preparedEntries = null) {
  const sourceList = Array.isArray(sources) ? sources : getSourceConfigs()
  const sourceMap = new Map(sourceList.map(source => [source.id, source]))
  const entries = Array.isArray(preparedEntries) ? preparedEntries : getOnlineExploreEntries({ sources: sourceList })
  const groups = new Map()
  entries.forEach(entry => {
    const title = normalizeExploreCatalogTitle(entry.title, entry.kind)
    const key = `${entry.kind}:${title}`
    if (!groups.has(key)) {
      groups.set(key, {
        id: `catalog:${key}`,
        key,
        title,
        kind: entry.kind,
        providers: [],
        providerCount: 0
      })
    }
    const group = groups.get(key)
    if (!group.providers.some(item => item.sourceId === entry.sourceId)) group.providers.push(entry)
  })
  return Array.from(groups.values()).map(group => {
    group.providers.sort((left, right) => exploreProviderScore(right, sourceMap) - exploreProviderScore(left, sourceMap))
    group.providerCount = group.providers.length
    group.sourceId = group.providers[0] && group.providers[0].sourceId || ''
    group.sourceName = group.providers[0] && group.providers[0].sourceName || ''
    return group
  }).sort((left, right) => {
    const kindOrder = { category: 0, rank: 1, latest: 2 }
    const leftOrder = kindOrder[left.kind] === undefined ? 9 : kindOrder[left.kind]
    const rightOrder = kindOrder[right.kind] === undefined ? 9 : kindOrder[right.kind]
    return leftOrder - rightOrder || right.providerCount - left.providerCount || left.title.localeCompare(right.title)
  })
}

export function getSourceDiscoverySnapshot(options = {}) {
  const span = startPerformanceSpan('source.discovery')
  const revision = currentSourceRevision()
  if (options.preferCache === true) {
    const cached = readStorage(SOURCE_DISCOVERY_CACHE_KEY, null)
    if (cached && cached.revision === revision && cached.result && Array.isArray(cached.result.catalog)) {
      finishPerformanceSpan(span, { sourceCount: Number(cached.sourceCount || 0), count: cached.result.catalog.length, status: 'cached' })
      return cached.result
    }
    if (!Array.isArray(options.sources) || !options.sources.length) {
      const empty = {
        version: sourceSnapshotVersion,
        candidates: [],
        counts: { total: 0, verified: 0, untested: 0, retryable: 0, cooling: 0, blocked: 0, available: 0 },
        entries: [],
        catalog: []
      }
      finishPerformanceSpan(span, { sourceCount: 0, count: 0, status: 'empty-cache' })
      return empty
    }
  }
  const snapshot = Array.isArray(options.sources) ? null : getSourceSnapshot()
  const sources = Array.isArray(options.sources) ? options.sources : snapshot.sources
  const pool = buildSourceCandidatePool(sources)
  const candidates = pool.candidates
    .slice(0, Math.max(20, Math.min(40, Number(options.candidateLimit || 30))))
    .map(sourceIndexSummary)
  const entries = getOnlineExploreEntries({ sources })
  const catalog = buildExploreCatalog(sources, entries).filter(entry => {
    if (entry.kind === 'category') return true
    if (entry.kind === 'rank') return true
    return entry.kind === 'latest'
  }).slice(0, Math.max(30, Math.min(80, Number(options.catalogLimit || 48))))
  const retainedEntries = []
  const retainedKeys = new Set()
  catalog.forEach(item => item.providers.slice(0, 3).forEach(provider => {
    const key = `${provider.sourceId}:${provider.url}:${provider.title}`
    if (retainedKeys.has(key)) return
    retainedKeys.add(key)
    retainedEntries.push(provider)
  }))
  const result = {
    version: snapshot ? snapshot.version : sourceSnapshotVersion,
    candidates,
    counts: { ...pool.counts, available: pool.candidates.length },
    entries: retainedEntries.slice(0, 120),
    catalog
  }
  writeStorage(SOURCE_DISCOVERY_CACHE_KEY, {
    schemaVersion: 1,
    revision,
    sourceCount: sources.length,
    createdAt: Date.now(),
    result
  })
  finishPerformanceSpan(span, { sourceCount: sources.length, count: catalog.length, status: 'ready' })
  return result
}

export async function openExploreCatalogEntry(category, options = {}) {
  const providers = Array.isArray(category && category.providers) ? category.providers.slice(0, 3) : []
  const attempts = []
  for (let index = 0; index < providers.length; index += 2) {
    const batch = providers.slice(index, index + 2)
    const results = await Promise.all(batch.map(async provider => {
      try {
        const books = await exploreOnlineBooks(provider, options)
        if (!books.length) {
          writeSourceExploreTestResult(provider.sourceId, {
            status: 'failed', entryTitle: provider.title, count: 0,
            message: '分类页面没有解析出图书', errorCode: 'PARSE_EMPTY'
          })
          writeSourceRuntimeStageResult(provider.sourceId, 'explore', {
            status: 'failed', errorCode: 'PARSE_EMPTY', resultCount: 0
          })
          throw new SourceRuntimeError('PARSE_EMPTY', '分类页面没有解析出图书', { stage: 'explore' })
        }
        attempts.push({ sourceId: provider.sourceId, sourceName: provider.sourceName, status: 'passed', count: books.length, errorCode: '' })
        return { provider, books }
      } catch (error) {
        const failure = classifySourceFailure(error, { stage: 'explore' })
        attempts.push({ sourceId: provider.sourceId, sourceName: provider.sourceName, status: 'failed', count: 0, errorCode: failure.errorCode })
        return null
      }
    }))
    const winner = results.find(item => item && item.books.length)
    if (winner) {
      return { categoryKey: category.key, provider: winner.provider, results: winner.books, attempts }
    }
  }
  const error = new SourceRuntimeError('EXPLORE_PROVIDERS_FAILED', '已尝试多个发现来源，暂时都不可用', { stage: 'explore', retryable: true })
  error.attempts = attempts
  throw error
}

export function getSourceExploreEntries(sourceOrId) {
  const source = resolveExploreSource(sourceOrId)
  if (!source) {
    return createUnavailableExploreResult('', '', '未找到该书源', 'source_missing')
  }
  const raw = source.raw || source
  if (!raw.exploreUrl && !raw.ruleExploreUrl && !raw.explore) {
    return createUnavailableExploreResult(source.id, source.name, '该书源没有发现页配置，仅支持书名搜索', 'no_explore_url', source)
  }

  const entries = parseSourceExploreUrl(source)
  if (!entries.length) {
    return createUnavailableExploreResult(source.id, source.name, '该书源未提供可浏览分类', 'no_explore_url', source)
  }

  const capability = hasExploreCapability(source)
  if (!capability.available) {
    return createUnavailableExploreResult(source.id, source.name, capability.reason, capability.reasonCode, source)
  }

  if (!source.enabled) {
    return createUnavailableExploreResult(source.id, source.name, '请先启用该书源', 'source_disabled', source)
  }

  const groups = []
  entries.forEach(entry => {
    const name = entry.group || '发现入口'
    let group = groups.find(item => item.name === name)
    if (!group) {
      group = { name, entries: [] }
      groups.push(group)
    }
    group.entries.push(entry)
  })

  return {
    sourceId: source.id,
    sourceName: source.name,
    available: true,
    reasonCode: '',
    canSearchFallback: false,
    reason: '',
    entries,
    groups
  }
}

function withTimeout(promise, ms, sourceName) {
  let timer = 0
  return Promise.race([
    Promise.resolve(promise).finally(() => {
      if (timer) clearTimeout(timer)
    }),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new SourceRuntimeError('TIMEOUT', `${sourceName || '书源'}响应超时`, {
        retryable: true
      })), ms)
    })
  ])
}

function getSourceRespondTimeMs(source) {
  const value = Number(
    (source && source.respondTimeMs) ||
    (source && source.raw && (source.raw.respondTime || source.raw.respondTimeMs)) ||
    0
  )
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.min(Math.max(value, 0), ONLINE_SOURCE_TEST_TIMEOUT_MAX_MS)
}

function getSourceTimeoutBudget(source, timeoutMs, options = {}) {
  const base = Math.max(0, Number(timeoutMs || ONLINE_SOURCE_TIMEOUT_MS))
  const sourceBudget = options.respectSourceRespondTime ? getSourceRespondTimeMs(source) : 0
  const effectiveBase = Math.max(base, sourceBudget)
  const antiCrawler = normalizeSourceAntiCrawler(source && source.antiCrawler)
  return effectiveBase + antiCrawler.requestIntervalMs + (antiCrawler.retryCount * (antiCrawler.retryIntervalMs + effectiveBase))
}

export async function exploreOnlineBooks(entry, options = {}) {
  if (!entry || !entry.sourceId || !entry.url) return []
  const source = getSourceConfig(entry.sourceId)
  const timeoutMs = getSourceTimeoutBudget(source, options.timeoutMs || ONLINE_SOURCE_TIMEOUT_MS)
  const startedAt = Date.now()
  writeSourceRuntimeStageResult(entry.sourceId, 'explore', { status: 'probing' })
  try {
    const results = await withTimeout(exploreSourceEntry(entry, options), timeoutMs, entry.sourceName)
    writeSourceExploreTestResult(entry.sourceId, {
      status: 'passed',
      entryTitle: entry.title,
      count: results.length
    })
    writeSourceRuntimeStageResult(entry.sourceId, 'explore', {
      status: 'passed', resultCount: results.length,
      latencyMs: Date.now() - startedAt, httpStatus: 200
    })
    return results
  } catch (error) {
    const runtimeError = asSourceRuntimeError(error, { stage: 'explore' })
    const failure = classifySourceFailure(runtimeError, { stage: 'explore' })
    writeSourceExploreTestResult(entry.sourceId, {
      status: 'failed',
      entryTitle: entry.title,
      message: friendlyErrorMessage(runtimeError, '发现入口打开失败'),
      errorCode: failure.errorCode,
      httpStatus: failure.status,
      retryable: failure.retryable
    })
    writeSourceRuntimeStageResult(entry.sourceId, 'explore', {
      status: 'failed', errorCode: failure.errorCode, httpStatus: failure.status,
      latencyMs: Date.now() - startedAt
    })
    throw runtimeError
  }
}

export async function loadSourceExploreBooks(sourceOrId, entry, options = {}) {
  const source = resolveExploreSource(sourceOrId)
  if (!source) throw new Error('未找到该书源')
  if (!source.enabled) throw new Error('请先启用该书源')
  if (!entry || entry.sourceId !== source.id || !entry.url) throw new Error('发现入口无效')

  const page = Math.max(1, Number(options.page || 1))
  const results = await exploreOnlineBooks(entry, { ...options, page })
  const books = results.map(result => ({
    ...result.book,
    origin: 'explore',
    exploreTitle: entry.title
  }))

  return {
    sourceId: source.id,
    sourceName: source.name,
    entryTitle: entry.title,
    page,
    hasMore: !!entry.paginated && books.length > 0,
    books,
    diagnostics: results.diagnostics || {
      requestUrl: '', httpStatus: 0, responseLength: 0, charset: '', usedRule: '',
      parsedCount: books.length, failedStage: '', errorMessage: '', viaProxy: false
    }
  }
}

export async function runAdaptiveSourceSearch(keyword, options = {}) {
  const word = String(keyword || '').trim()
  if (!word) return {
    keyword: '', results: [], attempted: 0, succeeded: 0, empty: 0, failed: 0,
    attemptedSourceIds: [], errorsByCode: {}, hasMore: false, elapsedMs: 0,
    poolStats: getSourcePoolStats(options.sources || getSourceConfigs())
  }

  const searchOptions = normalizeOnlineSearchOptions(options)
  const allSources = options.sources || getSourceConfigs()
  const pool = buildSourceCandidatePool(allSources, { excludeSourceIds: options.excludeSourceIds })
  const selected = selectDiverseSourceCandidates(pool.candidates, searchOptions.sourceLimit, 2)
  const startedAt = Date.now()
  const deadline = startedAt + clampNumber(options.roundTimeoutMs, 10000, 30000, 20000)
  const report = {
    keyword: word,
    results: [],
    attempted: 0,
    succeeded: 0,
    empty: 0,
    failed: 0,
    attemptedSourceIds: [],
    sourceNames: [],
    errorsByCode: {},
    completeResultCount: 0,
    incompleteResultCount: 0,
    metadataFailureCount: 0,
    hasMore: pool.candidates.length > selected.length,
    elapsedMs: 0,
    poolStats: { ...pool.counts, available: pool.candidates.length }
  }
  const cacheKey = onlineDataCacheKey('search', {
    word,
    sourceIds: selected.map(source => source.id),
    resultLimit: searchOptions.resultLimit
  })
  const cached = readOnlineDataCache('search', cacheKey, options)
  if (cached) {
    report.results = cached
    report.elapsedMs = Date.now() - startedAt
    if (typeof options.onResults === 'function') options.onResults(cached.slice(), { ...report, cached: true })
    return { ...report, cached: true }
  }
  const groups = []
  let done = 0
  const batches = []
  if (selected.length) {
    batches.push(selected.slice(0, Math.min(6, selected.length)))
    for (let index = batches[0].length; index < selected.length; index += 5) {
      batches.push(selected.slice(index, index + 5))
    }
  }
  for (const batch of batches) {
    if (Date.now() >= deadline || (options.signal && options.signal.cancelled)) {
      report.hasMore = true
      break
    }
    const batchGroups = await runConcurrent(batch, searchOptions.concurrency, async source => {
      const sourceStartedAt = Date.now()
      report.attempted += 1
      report.attemptedSourceIds.push(source.id)
      report.sourceNames.push(source.name)
      writeSourceRuntimeStageResult(source.id, 'search', { status: 'probing' })
      try {
        const remainingMs = Math.max(500, Math.min(searchOptions.timeoutMs, deadline - Date.now()))
        const sourceResults = await withTimeout(searchSource(source, word), remainingMs, source.name)
        const metadataReport = sourceResults.metadataReport || {}
        report.incompleteResultCount += Number(metadataReport.incompleteResultCount || 0)
        report.metadataFailureCount += Number(metadataReport.metadataFailureCount || 0)
        if (!sourceResults.length) throw createEmptySearchError(sourceResults.diagnostics || {})
        const elapsedMs = Date.now() - sourceStartedAt
        const quality = writeSourceQualityResult(source.id, {
          status: 'success', count: sourceResults.length, elapsedMs
        })
        writeSourceRuntimeStageResult(source.id, 'search', {
          status: 'passed', resultCount: sourceResults.length, latencyMs: elapsedMs, httpStatus: 200
        })
        writeSourceTestResult(source.id, { status: 'passed', keyword: word, count: sourceResults.length })
        report.succeeded += 1
        report.completeResultCount += sourceResults.length
        done += 1
        emitSearchProgress(options.onProgress, {
          done, total: selected.length, source,
          status: 'success',
          count: sourceResults.length, elapsedMs, startedAt, qualityScore: quality.qualityScore
        })
        return sourceResults.map(item => decorateSearchResult(item, quality))
      } catch (error) {
        const elapsedMs = Date.now() - sourceStartedAt
        const failure = classifySourceFailure(error, { stage: 'search' })
        const message = friendlyErrorMessage(error, '搜索失败')
        const quality = writeSourceQualityResult(source.id, {
          status: 'failed', count: 0, elapsedMs, message
        })
        writeSourceRuntimeStageResult(source.id, 'search', {
          status: 'failed', errorCode: failure.errorCode,
          httpStatus: failure.status, latencyMs: elapsedMs
        })
        writeSourceTestResult(source.id, {
          status: 'failed', keyword: word, count: 0, message,
          errorCode: failure.errorCode, failedStage: failure.stage,
          httpStatus: failure.status, retryable: failure.retryable
        })
        if (failure.errorCode === 'SEARCH_EMPTY') report.empty += 1
        else report.failed += 1
        report.errorsByCode[failure.errorCode] = Number(report.errorsByCode[failure.errorCode] || 0) + 1
        done += 1
        emitSearchProgress(options.onProgress, {
          done, total: selected.length, source, status: 'failed', count: 0,
          elapsedMs, startedAt, message, qualityScore: quality.qualityScore
        })
        return []
      }
    })
    groups.push(...batchGroups)
    report.results = dedupeOnlineSearchResults(groups.flat()).slice(0, searchOptions.resultLimit)
    if (typeof options.onResults === 'function') options.onResults(report.results.slice(), { ...report })
  }
  report.elapsedMs = Date.now() - startedAt
  report.hasMore = report.hasMore || report.attempted < selected.length
  writeOnlineDataCache('search', cacheKey, report.results)
  flushPendingSourceRuntimeWrites()
  return report
}

export async function searchOnlineBooks(keyword, options = {}) {
  const report = await runAdaptiveSourceSearch(keyword, options)
  return report.results
}

function normalizeOnlineSearchOptions(options = {}) {
  const saved = getOnlineSearchSettings()
  const legacyLimit = options.limit == null ? undefined : options.limit
  return {
    concurrency: clampNumber(options.concurrency, 1, 10, saved.concurrency),
    timeoutMs: clampNumber(options.timeoutMs, 3000, 15000, saved.timeoutMs),
    resultLimit: clampNumber(options.resultLimit, 20, 120, legacyLimit || saved.resultLimit),
    sourceLimit: clampNumber(options.sourceLimit || legacyLimit, 1, 30, saved.sourceLimit)
  }
}

async function runConcurrent(items, concurrency, worker) {
  const results = new Array(items.length)
  let nextIndex = 0
  const workerCount = Math.min(Math.max(1, concurrency), items.length || 1)
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await worker(items[index], index)
    }
  }))
  return results
}

function emitSearchProgress(handler, payload) {
  if (typeof handler !== 'function') return
  handler({
    done: payload.done,
    total: payload.total,
    sourceId: payload.source.id,
    sourceName: payload.source.name,
    status: payload.status,
    count: payload.count,
    elapsedMs: payload.elapsedMs,
    totalElapsedMs: Date.now() - payload.startedAt,
    message: payload.message || '',
    qualityScore: payload.qualityScore
  })
}

function decorateSearchResult(item, quality) {
  const score = quality && Number.isFinite(quality.qualityScore) ? quality.qualityScore : 0
  return {
    ...item,
    sourceQualityScore: score
  }
}

function dedupeOnlineSearchResults(results = []) {
  const seen = new Map()
  const output = []
  results.forEach(item => {
    if (!item || item.type === 'source-error') {
      if (item) output.push(item)
      return
    }
    const book = item.book || {}
    const key = `${cleanText(item.title || book.title).toLowerCase()}::${cleanText(book.author || '').toLowerCase()}`
    if (!key || key === '::') {
      output.push(item)
      return
    }
    if (!seen.has(key)) {
      const next = { ...item, duplicateCount: 1, alternateSources: [] }
      seen.set(key, next)
      output.push(next)
      return
    }
    const current = seen.get(key)
    const duplicateCount = Number(current.duplicateCount || 1) + 1
    const alternatives = Array.isArray(current.alternateSources) ? current.alternateSources : []
    alternatives.push(item)
    const currentScore = Number(current.sourceQualityScore || 0)
    const nextScore = Number(item.sourceQualityScore || 0)
    if (nextScore > currentScore) {
      Object.assign(current, item, { duplicateCount, alternateSources: alternatives })
      return
    }
    current.duplicateCount = duplicateCount
    current.alternateSources = alternatives
  })
  return output
}

export function parseSourceExploreUrl(sourceOrId) {
  const source = resolveExploreSource(sourceOrId)
  if (!source) return []
  const raw = source && (source.raw || source) || {}
  const value = raw.exploreUrl || raw.ruleExploreUrl || raw.explore
  const entries = parseExploreSourceValue(value)

  return entries
    .filter(entry => entry.url)
    .map((entry, index) => ({
      id: `${source.id}:explore:${index}`,
      sourceId: source.id,
      sourceName: source.name,
      sourceGroup: source.group,
      title: entry.title || `Explore ${index + 1}`,
      group: entry.group || '',
      kind: entry.kind || inferExploreKind(entry.title, entry.url),
      url: resolveExploreEntryUrl(entry.url, source.baseUrl),
      paginated: hasExplorePaginationTemplate(entry.url)
    }))
    .filter(entry => entry.url)
}

function parseExploreSourceValue(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => parseExploreEntryValue(item, index))
  }
  if (value && typeof value === 'object') {
    if (value.url || value.href || value.link || value.value) return parseExploreEntryValue(value, 0)
    return Object.keys(value).flatMap(group => {
      const groupValue = value[group]
      const items = Array.isArray(groupValue) ? groupValue : [groupValue]
      return items.flatMap((item, index) => {
        return parseExploreEntryValue({
          ...(item && typeof item === 'object' ? item : { title: String(item || ''), url: '' }),
          group
        }, index)
      })
    })
  }

  const text = String(value || '').trim()
  if (!text) return []
  if (text[0] === '[' || text[0] === '{') {
    try {
      return parseExploreSourceValue(JSON.parse(text))
    } catch (error) {
      return []
    }
  }
  return text.split(/\r?\n|\\n|&&/).flatMap((line, index) => parseExploreEntryValue(line, index))
}

function resolveExploreSource(sourceOrId) {
  if (!sourceOrId) return null
  if (typeof sourceOrId === 'string') return getSourceConfig(sourceOrId) || null
  if (sourceOrId.id && sourceOrId.raw) return sourceOrId
  return normalizeSourceConfig(sourceOrId)
}

function createUnavailableExploreResult(sourceId, sourceName, reason, reasonCode = 'unavailable', source = null) {
  return {
    sourceId,
    sourceName,
    available: false,
    reasonCode,
    canSearchFallback: !!(source && hasSourceSearchFallback(source)),
    reason,
    entries: [],
    groups: []
  }
}

function getExploreRuleCompatibility(source) {
  const raw = source && (source.raw || source) || {}
  const exploreUrl = raw.exploreUrl || raw.ruleExploreUrl || raw.explore || ''
  const ruleExplore = raw.ruleExplore || {}
  if (/@js:[\s\S]*\.(?:map|filter|reduce)\s*\(/i.test(String(exploreUrl || ''))) {
    return { compatible: false, reason: '该书源发现页的 JS 超出当前安全白名单', reasonCode: 'complex_explore_rule' }
  }
  if (hasUnsupportedRule({ exploreUrl, ruleExplore }) || /webview/i.test(JSON.stringify({ exploreUrl, ruleExplore }))) {
    return { compatible: false, reason: '该书源的发现入口包含复杂 JS 或 WebView 规则', reasonCode: 'complex_explore_rule' }
  }
  if (hasComplexExploreTemplate(exploreUrl)) {
    return { compatible: false, reason: '该书源的发现入口包含当前不支持的复杂分页模板', reasonCode: 'complex_explore_rule' }
  }
  return { compatible: true, reason: '', reasonCode: '' }
}

export function hasExploreCapability(sourceOrId) {
  const source = resolveExploreSource(sourceOrId)
  if (!source) return { available: false, reason: '未找到该书源', reasonCode: 'source_missing', usedRule: '' }
  const raw = source.raw || source
  const exploreUrl = raw.exploreUrl || raw.ruleExploreUrl || raw.explore
  if (!exploreUrl) return { available: false, reason: '该书源没有发现页入口', reasonCode: 'no_explore_url', usedRule: '' }
  const compatibility = getExploreRuleCompatibility(source)
  if (!compatibility.compatible) return { available: false, reason: compatibility.reason, reasonCode: compatibility.reasonCode, usedRule: '' }
  const exploreRule = normalizeRuleObject(raw.ruleExplore)
  const searchRule = normalizeRuleObject(raw.ruleSearch)
  if (Object.keys(exploreRule).length) return { available: true, reason: '', usedRule: 'ruleExplore' }
  if (Object.keys(searchRule).length) return { available: true, reason: '', usedRule: 'ruleSearch' }
  return { available: false, reason: '仅有分类入口，缺少发现页解析规则', reasonCode: 'no_explore_rule', usedRule: '' }
}

function hasSourceSearchFallback(source) {
  const raw = source && (source.raw || source) || {}
  const ruleSearch = normalizeRuleObject(raw.ruleSearch)
  return !!(raw.searchUrl && Object.keys(ruleSearch).length && !hasUnsupportedRule({
    searchUrl: raw.searchUrl,
    ruleSearch
  }))
}

function hasComplexExploreTemplate(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value || '')
  return [...text.matchAll(/\{\{\s*([\s\S]*?)\s*\}\}/g)].some(match => {
    const expression = String(match[1] || '').trim()
    return !/^(?:page|page\s*\+\s*1|key|keyword|baseUrl|\$\.[\w.[\]*-]+)$/.test(expression)
  })
}

function hasExplorePaginationTemplate(value) {
  const text = String(value || '')
  return /\{\{\s*page(?:\s*\+\s*1)?\s*\}\}|\{page\}|\$page|%page%/i.test(text)
}

function renderExplorePageUrl(url, page) {
  const current = Math.max(1, Number(page || 1))
  return String(url || '')
    .replace(/\{\{\s*page\s*\+\s*1\s*\}\}/gi, String(current + 1))
    .replace(/\{\{\s*page\s*\}\}/gi, String(current))
    .replace(/\{page\}/gi, String(current))
    .replace(/\$page/gi, String(current))
    .replace(/%page%/gi, String(current))
}

function resolveExploreEntryUrl(url, baseUrl) {
  const templates = []
  const protectedUrl = String(url || '').trim().replace(/\{\{[\s\S]*?\}\}|\{page\}|\$page|%page%/gi, value => {
    const token = `__SOURCE_TEMPLATE_${templates.length}__`
    templates.push(value)
    return token
  })
  if (!protectedUrl) return ''

  const resolved = resolveUrl(protectedUrl, baseUrl)
  const restored = templates.reduce((value, template, index) => {
    return value.replace(`__SOURCE_TEMPLATE_${index}__`, template)
  }, resolved)
  return /^https?:\/\//i.test(restored) ? restored : ''
}

function parseExploreEntryValue(value, index = 0) {
  if (!value) return []
  if (typeof value === 'object') {
    const title = cleanText(value.title || value.name || value.label || value.group || '')
    const url = String(value.url || value.href || value.link || value.value || '').trim()
    const group = cleanText(value.group || value.category || '')
    return url ? [{ group, title: title || `Explore ${index + 1}`, url, kind: inferExploreKind(title, url) }] : []
  }

  const text = String(value || '').trim()
  if (!text) return []
  const parts = text.split('::').map(item => cleanText(item)).filter(Boolean)
  if (parts.length >= 4) {
    const url = parts[parts.length - 2]
    const title = parts[parts.length - 3]
    return [{ group: parts.slice(0, -3).join(' / '), title, url, note: parts[parts.length - 1], kind: inferExploreKind(title, url) }]
  }
  if (parts.length >= 3) {
    const url = parts[parts.length - 1]
    const title = parts[parts.length - 2]
    return [{ group: parts.slice(0, -2).join(' / '), title, url, kind: inferExploreKind(title, url) }]
  }
  if (parts.length === 2) {
    return [{ title: parts[0], url: parts[1], kind: inferExploreKind(parts[0], parts[1]) }]
  }
  const pair = text.match(/^(.+?)\s*(?:=>|\||,)\s*(.+)$/)
  if (pair) {
    const title = cleanText(pair[1])
    const url = cleanText(pair[2])
    return url ? [{ title: title || `Explore ${index + 1}`, url, kind: inferExploreKind(title, url) }] : []
  }
  if (/^https?:\/\//i.test(text) || /^\//.test(text)) {
    return [{ title: `Explore ${index + 1}`, url: text, kind: inferExploreKind('', text) }]
  }
  return []
}

function inferExploreKind(title, url) {
  const text = `${title || ''} ${url || ''}`
  if (/(latest|new|update|\u6700\u8fd1|\u6700\u65b0|\u66f4\u65b0|\u5165\u5e93)/i.test(text)) return 'latest'
  if (/(rank|top|hot|\u6392\u884c|\u699c|\u70b9\u51fb|\u6536\u85cf|\u63a8\u8350|\u8bc4\u5206|\u65e5\u699c|\u5468\u699c|\u6708\u699c)/i.test(text)) return 'rank'
  return 'category'
}

async function exploreSourceEntry(entry, options = {}) {
  const source = getSourceConfig(entry.sourceId)
  if (!source) throw new Error('source not found')
  const capability = hasExploreCapability(source)
  if (!capability.available) throw new Error(capability.reason)

  const raw = source.raw || {}
  const rule = normalizeRuleObject(raw.ruleExplore || raw.ruleSearch)

  const page = Number(options.page || 1)
  const requestUrl = renderExplorePageUrl(entry.url, page)
  const requestSpec = createSourceRequestSpec(source, requestUrl, {
    key: entry.title,
    keyword: entry.title,
    page
  }, source.baseUrl)
  const diagnostics = {
    requestUrl: requestSpec.url,
    httpStatus: 0,
    responseLength: 0,
    charset: requestSpec.charset || 'auto',
    usedRule: capability.usedRule,
    parsedCount: 0,
    failedStage: '',
    errorMessage: '',
    viaProxy: /^https?:\/\//i.test(requestSpec.url)
  }
  let html
  let list
  try {
    html = await requestText(requestSpec)
    diagnostics.httpStatus = 200
    diagnostics.responseLength = String(html || '').length
  } catch (error) {
    diagnostics.failedStage = 'request'
    diagnostics.errorMessage = error && error.message || '请求失败'
    error.diagnostics = diagnostics
    throw error
  }
  try {
    const payload = parseResponsePayload(html)
    const listRule = getFieldRule(rule, ['bookList', 'list', 'books'])
    list = applyListRule(payload, listRule, { key: entry.title, keyword: entry.title, page, $: payload })
  } catch (error) {
    diagnostics.failedStage = 'parse'
    diagnostics.errorMessage = error && error.message || '解析失败'
    error.diagnostics = diagnostics
    throw error
  }

  const parsedResults = list.map(item => {
    const context = { key: entry.title, keyword: entry.title, page, $: item }
    const rawTitle = pickText(item, rule, ['name', 'bookName', 'title'], context)
    const book = normalizeOnlineBookForShelf({
      sourceId: source.id,
      sourceName: source.name,
      sourceGroup: source.group,
      bookUrl: pickUrl(item, rule, ['bookUrl', 'url', 'link'], context, source.baseUrl),
      title: rawTitle,
      author: pickText(item, rule, ['author', 'bookAuthor'], context) || 'Unknown',
      kind: pickText(item, rule, ['kind', 'category', 'type'], context) || entry.title || 'Explore',
      latestChapter: pickText(item, rule, ['latestChapter', 'lastChapter', 'last'], context),
      intro: pickText(item, rule, ['intro', 'description', 'desc'], context),
      coverUrl: pickUrl(item, rule, ['coverUrl', 'cover', 'image'], context, source.baseUrl),
      metadataStatus: rawTitle ? 'complete' : 'needs_detail',
      metadataOrigin: 'explore'
    }, { preserveMissingTitle: true })

    return {
      type: 'online',
      bookId: book.id,
      title: book.title,
      subtitle: `${book.author} · ${source.name}`,
      snippet: book.latestChapter || book.kind || 'Explore result',
      sourceId: source.id,
      sourceName: source.name,
      exploreTitle: entry.title,
      metadataStatus: rawTitle ? 'complete' : 'needs_detail',
      book
    }
  }).filter(result => result.book.bookUrl)
  const hydrated = await hydrateSourceSearchResults(parsedResults, {
    maxItems: 3,
    concurrency: 2,
    timeoutMs: Math.min(4000, Number(options.timeoutMs || 4000))
  })
  const results = hydrated.results.slice(0, options.limit || 80)
  diagnostics.parsedCount = results.length
  diagnostics.completeResultCount = hydrated.completeResultCount
  diagnostics.incompleteResultCount = hydrated.incompleteResultCount
  diagnostics.metadataFailureCount = hydrated.metadataFailureCount
  if (!results.length) {
    diagnostics.failedStage = 'empty_result'
    diagnostics.errorMessage = '分类页请求成功，但没有解析出图书。可能原因：分类规则与搜索规则不同、目标页面结构变化、需要 Cookie / Referer / User-Agent，或该书源依赖 JS / WebView。'
  }
  results.diagnostics = diagnostics
  return results
}

export async function testSourceSearch(sourceId, keyword, options = {}) {
  const word = String(keyword || '').trim()
  if (!word) throw new Error('请输入测试关键词')
  const source = getSourceConfig(sourceId)
  if (!source) throw new Error('书源不存在或已删除')
  const diagnostics = getSourceDiagnostics(source)
  if (!diagnostics.compatible) {
    throw new Error(`当前书源不兼容：${diagnostics.reasons.join('、')}`)
  }
  if (!source.enabled && !options.allowDisabled) {
    throw new Error('当前书源已停用，请先启用后测试')
  }
  const timeoutMs = options.timeoutMs || ONLINE_SOURCE_TIMEOUT_MS
  const startedAt = Date.now()
  writeSourceRuntimeStageResult(source.id, 'search', { status: 'probing' })
  let results
  try {
    results = await withTimeout(searchSource(source, word), getSourceTimeoutBudget(source, timeoutMs, {
      respectSourceRespondTime: true
    }), source.name)
  } catch (error) {
    const failure = classifySourceFailure(error, { stage: 'search' })
    writeSourceTestResult(source.id, {
      status: 'failed',
      keyword: word,
      message: friendlyErrorMessage(error, '网络请求失败'),
      errorCode: failure.errorCode,
      failedStage: failure.stage,
      httpStatus: failure.status,
      retryable: failure.retryable
    })
    writeSourceRuntimeStageResult(source.id, 'search', {
      status: 'failed', errorCode: failure.errorCode, httpStatus: failure.status,
      latencyMs: Date.now() - startedAt
    })
    throw asSourceRuntimeError(error, { stage: 'search' })
  }
  if (!results.length) {
    const searchDiagnostics = results && results.diagnostics || {}
    const error = createEmptySearchError(searchDiagnostics)
    writeSourceTestResult(source.id, {
      status: 'failed',
      keyword: word,
      count: 0,
      message: error.message,
      errorCode: error.code,
      failedStage: error.stage,
      diagnostics: searchDiagnostics
    })
    writeSourceRuntimeStageResult(source.id, 'search', {
      status: 'failed', errorCode: error.code, latencyMs: Date.now() - startedAt
    })
    if (options.failOnEmpty) throw error
    return {
      sourceId,
      keyword: word,
      count: 0,
      results: [],
      completeResultCount: 0,
      incompleteResultCount: Number(searchDiagnostics.incompleteResultCount || 0),
      metadataFailureCount: Number(searchDiagnostics.metadataFailureCount || 0)
    }
  }
  writeSourceTestResult(source.id, {
    status: 'passed',
    keyword: word,
    count: results.length
  })
  writeSourceRuntimeStageResult(source.id, 'search', {
    status: 'passed', resultCount: results.length, latencyMs: Date.now() - startedAt, httpStatus: 200
  })
  return {
    sourceId,
    keyword: word,
    count: results.length,
    results: results.slice(0, options.limit || 5),
    completeResultCount: results.length,
    incompleteResultCount: Number(results.diagnostics && results.diagnostics.incompleteResultCount || 0),
    metadataFailureCount: Number(results.diagnostics && results.diagnostics.metadataFailureCount || 0)
  }
}

export async function searchSourceBooks(sourceId, keyword, options = {}) {
  const word = String(keyword || '').trim()
  if (!word) throw new Error('请输入搜索关键词')
  const source = getSourceConfig(sourceId)
  if (!source) throw new Error('书源不存在或已删除')
  if (!source.enabled && !options.allowDisabled) {
    throw new Error('当前书源已停用，请先启用后搜索')
  }
  if (!hasSourceSearchFallback(source)) {
    throw new Error('当前书源没有可用的搜索规则')
  }

  const timeoutMs = options.timeoutMs || ONLINE_SOURCE_TIMEOUT_MS
  const startedAt = Date.now()
  writeSourceRuntimeStageResult(source.id, 'search', { status: 'probing' })
  let results
  try {
    results = await withTimeout(searchSource(source, word), getSourceTimeoutBudget(source, timeoutMs, {
      respectSourceRespondTime: true
    }), source.name)
  } catch (error) {
    const failure = classifySourceFailure(error, { stage: 'search' })
    writeSourceRuntimeStageResult(source.id, 'search', {
      status: 'failed', errorCode: failure.errorCode, httpStatus: failure.status,
      latencyMs: Date.now() - startedAt
    })
    writeSourceTestResult(source.id, {
      status: 'failed', keyword: word, count: 0,
      message: friendlyErrorMessage(error, '搜索失败'), errorCode: failure.errorCode,
      failedStage: failure.stage, httpStatus: failure.status, retryable: failure.retryable
    })
    throw asSourceRuntimeError(error, { stage: 'search' })
  }
  const limit = Number(options.limit || 0)
  const filtered = limit > 0 ? results.slice(0, limit) : results
  if (!filtered.length) {
    const searchDiagnostics = results && results.diagnostics || {}
    const error = createEmptySearchError(searchDiagnostics)
    writeSourceRuntimeStageResult(source.id, 'search', {
      status: 'failed', errorCode: error.code, latencyMs: Date.now() - startedAt
    })
    writeSourceTestResult(source.id, {
      status: 'failed', keyword: word, count: 0,
      message: error.message, errorCode: error.code, failedStage: error.stage,
      diagnostics: searchDiagnostics
    })
    if (options.failOnEmpty) throw error
    return {
      sourceId,
      sourceName: source.name,
      keyword: word,
      count: 0,
      results: [],
      completeResultCount: 0,
      incompleteResultCount: Number(searchDiagnostics.incompleteResultCount || 0),
      metadataFailureCount: Number(searchDiagnostics.metadataFailureCount || 0)
    }
  }
  writeSourceRuntimeStageResult(source.id, 'search', {
    status: 'passed', resultCount: filtered.length, latencyMs: Date.now() - startedAt, httpStatus: 200
  })
  writeSourceTestResult(source.id, { status: 'passed', keyword: word, count: filtered.length })
  return {
    sourceId,
    sourceName: source.name,
    keyword: word,
    count: filtered.length,
    results: filtered,
    completeResultCount: filtered.length,
    incompleteResultCount: Number(results.diagnostics && results.diagnostics.incompleteResultCount || 0),
    metadataFailureCount: Number(results.diagnostics && results.diagnostics.metadataFailureCount || 0)
  }
}

export async function runSourceReadingFlow(sourceId, keyword, options = {}) {
  const keywords = (Array.isArray(keyword) ? keyword : [keyword])
    .map(item => String(item || '').trim())
    .filter(Boolean)
  if (!keywords.length) throw new Error('请输入至少一个验收关键词')
  const keywordAttempts = []
  let lastError
  for (const candidate of keywords) {
    try {
      const flow = await runSingleSourceReadingFlow(sourceId, candidate, options)
      return { ...flow, keywordAttempts: [...keywordAttempts, { keyword: candidate, status: 'passed', errorCode: '' }] }
    } catch (error) {
      lastError = error
      const failure = classifySourceFailure(error)
      const flowStages = Array.isArray(error && error.flowStages) ? error.flowStages : []
      if (flowStages.length) {
        writeSourceHealthResult(sourceId, {
          status: 'failed', keyword: candidate, checkedAt: Date.now(),
          failedStage: failure.stage, errorCode: failure.errorCode,
          message: friendlyErrorMessage(error, '完整阅读链路失败'), stages: flowStages
        })
      }
      keywordAttempts.push({ keyword: candidate, status: 'failed', errorCode: failure.errorCode })
      if (!['SEARCH_EMPTY', 'PARSE_EMPTY', 'DETAIL_EMPTY', 'TOC_EMPTY', 'CONTENT_EMPTY'].includes(failure.errorCode)) break
    }
  }
  if (lastError) {
    lastError.keywordAttempts = keywordAttempts
    throw lastError
  }
  throw new Error('无可用验收关键词')
}

async function runSingleSourceReadingFlow(sourceId, keyword, options = {}) {
  const stages = []
  const keywords = [String(keyword || '').trim()].filter(Boolean)
  const runStage = async (id, title, action) => {
    const startedAt = Date.now()
    try {
      const result = await action()
      stages.push({ id, title, status: 'passed', message: '通过', elapsedMs: Date.now() - startedAt })
      return result
    } catch (error) {
      const failure = classifySourceFailure(error, { stage: id })
      const message = friendlyErrorMessage(error, `${title}失败`)
      stages.push({ id, title, status: 'failed', message, errorCode: failure.errorCode, httpStatus: failure.status, retryable: failure.retryable, elapsedMs: Date.now() - startedAt })
      const wrapped = new SourceRuntimeError(failure.errorCode, `${title}失败：${message}`, {
        stage: failure.stage || id,
        status: failure.status,
        retryable: failure.retryable,
        diagnostics: error && error.diagnostics,
        cause: error
      })
      wrapped.flowStages = stages
      throw wrapped
    }
  }

  const search = await runStage('search', '搜索', async () => {
    let lastError
    for (const candidate of keywords) {
      try {
        return await testSourceSearch(sourceId, candidate, {
          timeoutMs: options.timeoutMs,
          limit: options.limit || 5,
          failOnEmpty: true
        })
      } catch (error) {
        lastError = error
      }
    }
    throw lastError || new Error('无搜索结果')
  })
  const first = search.results.find(item => item && item.type === 'online' && item.book)
  if (!first) {
    const error = new SourceRuntimeError('SEARCH_EMPTY', '搜索结果里没有可阅读书籍', { stage: 'search' })
    error.flowStages = stages
    throw error
  }

  const info = await runStage('bookInfo', '详情', () => loadOnlineBookInfo(first.book))
  const chapters = await runStage('toc', '目录', () => loadOnlineToc(info))
  if (!chapters.length) {
    const error = new SourceRuntimeError('TOC_EMPTY', '目录解析为空', { stage: 'toc' })
    error.flowStages = stages
    throw error
  }

  const chapterIndex = Math.max(0, Math.min(Number(options.chapterIndex || 0), chapters.length - 1))
  const loadedChapter = await runStage('content', '正文', () => loadOnlineChapter(info, chapters[chapterIndex]))
  const shelfChapters = chapters.map((chapter, index) => {
    if (index !== loadedChapter.index) return chapter
    return {
      ...loadedChapter,
      isCached: true,
      loadStatus: 'cached',
      errorMessage: ''
    }
  })
  const shelfBook = await runStage('shelf', '加入书架', () => Promise.resolve(addOnlineBookToShelf({
    ...info,
    latestChapter: info.latestChapter || loadedChapter.title,
    chapters: shelfChapters
  })))
  const health = writeSourceHealthResult(sourceId, {
    status: 'passed', score: calculateHealthScore(stages), keyword: search.keyword,
    checkedAt: Date.now(), elapsedMs: stages.reduce((sum, stage) => sum + Number(stage.elapsedMs || 0), 0),
    message: `完整阅读链路通过：${shelfBook.title}`, stages
  })

  return {
    sourceId,
    keyword: search.keyword,
    search,
    book: shelfBook,
    chapters: shelfBook.chapters,
    chapter: loadedChapter,
    stages,
    health
  }
}

async function runSourceHealthFlow(sourceId, keyword, options = {}) {
  const stages = []
  const runStage = async (id, title, action) => {
    const startedAt = Date.now()
    try {
      const result = await action()
      stages.push({ id, title, status: 'passed', message: '通过', elapsedMs: Date.now() - startedAt })
      return result
    } catch (error) {
      const failure = classifySourceFailure(error, { stage: id })
      const message = friendlyErrorMessage(error, `${title}失败`)
      stages.push({ id, title, status: 'failed', message, errorCode: failure.errorCode, httpStatus: failure.status, retryable: failure.retryable, elapsedMs: Date.now() - startedAt })
      const wrapped = new SourceRuntimeError(failure.errorCode, `${title}失败：${message}`, {
        stage: failure.stage || id,
        status: failure.status,
        retryable: failure.retryable,
        diagnostics: error && error.diagnostics,
        cause: error
      })
      wrapped.flowStages = stages
      throw wrapped
    }
  }

  const search = await runStage('search', '搜索', () => testSourceSearch(sourceId, keyword, {
    timeoutMs: options.timeoutMs,
    limit: options.limit || 5,
    failOnEmpty: true
  }))
  const first = search.results.find(item => item && item.type === 'online' && item.book)
  if (!first) {
    const error = new SourceRuntimeError('SEARCH_EMPTY', '搜索结果里没有可阅读书籍', { stage: 'search' })
    error.flowStages = stages
    throw error
  }
  const info = await runStage('bookInfo', '详情', () => loadOnlineBookInfo(first.book))
  const chapters = await runStage('toc', '目录', () => loadOnlineToc(info))
  if (!chapters.length) {
    const error = new SourceRuntimeError('TOC_EMPTY', '目录解析为空', { stage: 'toc' })
    error.flowStages = stages
    throw error
  }
  const chapterIndex = Math.max(0, Math.min(Number(options.chapterIndex || 0), chapters.length - 1))
  const loadedChapter = await runStage('content', '正文', () => loadOnlineChapter(info, chapters[chapterIndex]))
  return {
    sourceId,
    keyword: search.keyword,
    search,
    book: info,
    chapters,
    chapter: loadedChapter,
    stages
  }
}

export async function runSourceHealthCheck(sourceId, keyword, options = {}) {
  const startedAt = Date.now()
  try {
    const flow = await runSourceHealthFlow(sourceId, keyword, options)
    const stages = flow.stages.map(stage => ({
      id: stage.id,
      title: stage.title,
      status: stage.status,
      message: stage.message,
      errorCode: stage.errorCode || '',
      httpStatus: Number(stage.httpStatus || 0),
      retryable: stage.retryable === true,
      elapsedMs: Number(stage.elapsedMs || 0)
    }))
    const health = writeSourceHealthResult(sourceId, {
      status: 'passed',
      score: calculateHealthScore(stages),
      keyword: flow.keyword,
      checkedAt: Date.now(),
      elapsedMs: Date.now() - startedAt,
      message: `全链路通过：${flow.book.title}`,
      stages
    })
    return {
      sourceId,
      ...health,
      book: flow.book,
      chapter: flow.chapter
    }
  } catch (error) {
    const stages = Array.isArray(error.flowStages) ? error.flowStages.map(stage => ({
      id: stage.id,
      title: stage.title,
      status: stage.status,
      message: stage.message,
      errorCode: stage.errorCode || '',
      httpStatus: Number(stage.httpStatus || 0),
      retryable: stage.retryable === true,
      elapsedMs: Number(stage.elapsedMs || 0)
    })) : []
    const health = writeSourceHealthResult(sourceId, {
      status: 'failed',
      score: calculateHealthScore(stages),
      keyword,
      checkedAt: Date.now(),
      elapsedMs: Date.now() - startedAt,
      failedStage: (stages.find(stage => stage.status === 'failed') || {}).id || '',
      errorCode: (stages.find(stage => stage.status === 'failed') || {}).errorCode || classifySourceFailure(error).errorCode,
      message: friendlyErrorMessage(error, '全链路健康检测失败'),
      stages
    })
    return {
      sourceId,
      ...health
    }
  }
}

export async function batchCheckSourceHealth(options = {}) {
  const sourceIds = Array.isArray(options.sourceIds)
    ? options.sourceIds
    : getSourceConfigs().filter(source => source.enabled).map(source => source.id)
  const keyword = String(options.keyword || '').trim()
  if (!keyword) throw new Error('请输入健康检测关键词')

  const results = []
  for (let index = 0; index < sourceIds.length; index += 1) {
    const sourceId = sourceIds[index]
    const source = getSourceConfig(sourceId)
    let result
    if (!source) {
      result = {
        sourceId,
        name: '已删除书源',
        status: 'failed',
        score: 0,
        message: '书源不存在',
        stages: []
      }
    } else {
      result = await runSourceHealthCheck(sourceId, keyword, options)
      result.name = source.name
    }
    results.push(result)
    if (typeof options.onProgress === 'function') {
      options.onProgress({
        ...result,
        index: index + 1,
        total: sourceIds.length
      })
    }
  }

  const sorted = results.slice().sort((left, right) => Number(right.score || 0) - Number(left.score || 0))
  return {
    total: sourceIds.length,
    passed: results.filter(item => item.status === 'passed').length,
    failed: results.filter(item => item.status === 'failed').length,
    results: sorted
  }
}

export async function batchTestSources(options = {}) {
  const word = String(options.keyword || '').trim()
  if (!word) throw new Error('请输入测试关键词')

  const sourceIds = Array.isArray(options.sourceIds) ? new Set(options.sourceIds) : null
  const group = String(options.group || '').trim()
  const selected = getSourceConfigs().filter(source => {
    if (sourceIds && !sourceIds.has(source.id)) return false
    if (group && source.group !== group) return false
    return sourceIds ? true : source.enabled
  })
  const summary = {
    total: selected.length,
    tested: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    results: []
  }

  for (let index = 0; index < selected.length; index += 1) {
    const source = selected[index]
    const diagnostics = getSourceDiagnostics(source)
    let item
    if (!source.enabled) {
      summary.skipped += 1
      item = {
        sourceId: source.id,
        name: source.name,
        group: source.group,
        status: 'skipped',
        message: '书源已停用'
      }
    } else if (!diagnostics.compatible) {
      summary.skipped += 1
      item = {
        sourceId: source.id,
        name: source.name,
        group: source.group,
        status: 'skipped',
        message: diagnostics.reasons.join('、') || 'H5 不兼容'
      }
    } else {
      summary.tested += 1
      try {
        const result = await testSourceSearch(source.id, word, {
          timeoutMs: options.timeoutMs,
          limit: options.limit,
          failOnEmpty: true
        })
        summary.passed += 1
        item = {
          sourceId: source.id,
          name: source.name,
          group: source.group,
          status: 'passed',
          count: result.count,
          message: `返回 ${result.count} 条结果`
        }
      } catch (error) {
        summary.failed += 1
        item = {
          sourceId: source.id,
          name: source.name,
          group: source.group,
          status: 'failed',
          count: 0,
          message: friendlyErrorMessage(error, '书源测试失败')
        }
      }
    }
    summary.results.push(item)
    if (typeof options.onProgress === 'function') {
      options.onProgress({
        ...item,
        index: index + 1,
        total: selected.length,
        tested: summary.tested,
        passed: summary.passed,
        failed: summary.failed,
        skipped: summary.skipped
      })
    }
  }

  return summary
}

async function runTrackedReadingStage(book, stage, action) {
  const sourceId = book && book.sourceId
  const startedAt = Date.now()
  if (sourceId) writeSourceRuntimeStageResult(sourceId, stage, { status: 'probing' })
  try {
    const result = await action()
    const resultCount = Array.isArray(result) ? result.length : stage === 'content' ? cleanText(result && result.content).length : 1
    if (sourceId) {
      writeSourceRuntimeStageResult(sourceId, stage, {
        status: 'passed', resultCount, latencyMs: Date.now() - startedAt, httpStatus: 200
      })
    }
    return result
  } catch (error) {
    const failure = classifySourceFailure(error, { stage })
    if (sourceId) {
      writeSourceRuntimeStageResult(sourceId, stage, {
        status: 'failed', errorCode: failure.errorCode, httpStatus: failure.status,
        latencyMs: Date.now() - startedAt
      })
    }
    throw asSourceRuntimeError(error, { stage })
  }
}

async function loadOnlineBookInfoInternal(book, options = {}) {
  const source = getSourceConfig(book.sourceId)
  if (!source) throw new Error('书源不存在或已删除')
  const rule = normalizeRuleObject(source.raw.ruleBookInfo)
  if (!Object.keys(rule).length) return book

  const cacheKey = onlineDataCacheKey('detail', {
    sourceId: book.sourceId,
    bookUrl: book.bookUrl,
    title: book.title
  })
  const cached = readOnlineDataCache('detail', cacheKey, options)
  if (cached) return cached

  const html = await requestText(createSourceRequestSpec(source, book.bookUrl, {}, source.baseUrl))
  const payload = parseResponsePayload(html)
  const context = { ...book, book, $: payload }
  const parsedFields = {
    title: pickText(payload, rule, ['name', 'bookName', 'title'], context) || book.title,
    author: pickText(payload, rule, ['author', 'bookAuthor'], context) || book.author,
    intro: pickText(payload, rule, ['intro', 'description', 'desc'], context) || book.intro,
    kind: pickText(payload, rule, ['kind', 'category', 'type'], context) || book.kind,
    latestChapter: pickText(payload, rule, ['latestChapter', 'lastChapter', 'last'], context) || book.latestChapter,
    coverUrl: pickUrl(payload, rule, ['coverUrl', 'cover', 'image'], context, source.baseUrl) || book.coverUrl
  }
  const resolvedBook = { ...book, ...parsedFields }
  const resolvedContext = { ...resolvedBook, book: resolvedBook, $: payload }
  const next = {
    ...book,
    ...parsedFields,
    tocUrl: pickUrl(payload, rule, ['tocUrl', 'chapterUrl', 'catalogUrl'], resolvedContext, book.bookUrl) || book.tocUrl || book.bookUrl
  }
  const normalized = normalizeOnlineBookForShelf(next)
  writeOnlineDataCache('detail', cacheKey, normalized)
  return normalized
}

export async function loadOnlineBookInfo(book, options = {}) {
  return runTrackedReadingStage(book, 'detail', () => loadOnlineBookInfoInternal(book, options))
}

async function loadOnlineTocInternal(book, options = {}) {
  const source = getSourceConfig(book.sourceId)
  if (!source) throw new Error('书源不存在或已删除')
  const rule = normalizeRuleObject(source.raw.ruleToc)
  if (!Object.keys(rule).length) throw new Error('这个书源没有目录规则')

  const tocUrl = book.tocUrl || book.bookUrl
  const cacheKey = onlineDataCacheKey('toc', {
    sourceId: book.sourceId,
    bookId: book.id,
    tocUrl
  })
  const cached = readOnlineDataCache('toc', cacheKey, options)
  if (cached) return cached

  const listRule = getFieldRule(rule, ['chapterList', 'list', 'toc'])
  const chapters = []
  const seenPages = new Set()
  const seenChapters = new Set()
  const maxPages = clampNumber(options.maxPages, 1, 10, 5)
  const routeCandidates = uniqueStrings([tocUrl, book.bookUrl])
  for (const routeUrl of routeCandidates) {
    let currentUrl = routeUrl
    for (let page = 1; currentUrl && page <= maxPages && !seenPages.has(currentUrl); page += 1) {
      seenPages.add(currentUrl)
      const html = await requestText(createSourceRequestSpec(source, currentUrl, { ...book, page }, source.baseUrl))
      const payload = parseResponsePayload(html)
      const list = applyListRule(payload, listRule, { ...book, book, page, $: payload })
      list.forEach(item => {
        const index = chapters.length
        const context = { ...book, book, index, page, $: item }
        const title = pickText(item, rule, ['chapterName', 'name', 'title'], context) || `第 ${index + 1} 章`
        const url = pickUrl(item, rule, ['chapterUrl', 'url', 'link'], context, currentUrl)
        const key = `${title}\n${url}`
        if (!title || !url || seenChapters.has(key)) return
        seenChapters.add(key)
        const cachedChapter = !!readStorage(chapterCacheKey(book.id, index), '')
        chapters.push({
          title,
          url,
          index,
          isCached: cachedChapter,
          loadStatus: cachedChapter ? 'cached' : 'idle',
          errorMessage: ''
        })
      })
      currentUrl = pickUrl(payload, rule, ['nextTocUrl', 'nextUrl'], { ...book, book, page, $: payload }, currentUrl)
    }
    if (chapters.length) break
  }

  if (!chapters.length) throw new SourceRuntimeError('TOC_EMPTY', '目录解析为空，请换一个书源', { stage: 'toc' })
  writeOnlineDataCache('toc', cacheKey, chapters)
  return chapters
}

export async function loadOnlineToc(book, options = {}) {
  return runTrackedReadingStage(book, 'toc', () => loadOnlineTocInternal(book, options))
}

async function loadOnlineChapterInternal(book, chapter, options = {}) {
  const cached = readOnlineChapterCache(book.id, chapter.index)
  if (cached) return { ...chapter, content: cached, isCached: true, loadStatus: 'cached', errorMessage: '' }

  const cacheSettings = getChapterCacheSettings()
  if (cacheSettings.offlineMode) {
    throw new Error('离线模式下只能阅读已缓存章节')
  }

  const source = getSourceConfig(book.sourceId)
  if (!source) throw new Error('书源不存在或已删除')
  const rule = normalizeRuleObject(source.raw.ruleContent)
  if (!Object.keys(rule).length) throw new Error('这个书源没有正文规则')

  const contents = []
  const seenPages = new Set()
  const maxPages = clampNumber(options.maxPages, 1, 10, 5)
  let currentUrl = chapter.url
  for (let page = 1; currentUrl && page <= maxPages && !seenPages.has(currentUrl); page += 1) {
    seenPages.add(currentUrl)
    const html = await requestText(createSourceRequestSpec(source, currentUrl, { ...book, ...chapter, page }, source.baseUrl))
    const payload = parseResponsePayload(html)
    const rawPageContent = firstValue(applyRule(
      payload,
      getFieldRule(rule, ['content', 'text']),
      { ...book, book, ...chapter, chapter, page, $: payload }
    ))
    const pageContent = sanitizeReadableContent(rawPageContent, { chapterTitle: chapter.title, page })
    if (pageContent.text) contents.push(pageContent.text)
    currentUrl = pickUrl(payload, rule, ['nextContentUrl', 'nextUrl'], { ...book, book, ...chapter, chapter, page, $: payload }, currentUrl)
  }
  const sanitizedContent = sanitizeReadableContent(uniqueStrings(contents).join('\n\n'), { chapterTitle: chapter.title })
  const content = sanitizedContent.text
  const contentQuality = assessReadableContentQuality(sanitizedContent)
  if (!content) throw new SourceRuntimeError('CONTENT_EMPTY', '正文解析为空，请换一个书源', { stage: 'content' })
  if (!contentQuality.readable) {
    throw new SourceRuntimeError('CONTENT_NOISE', '正文噪声过多，请切换备用书源', {
      stage: 'content',
      diagnostics: {
        rawChars: contentQuality.rawChars,
        cleanedChars: contentQuality.cleanedChars,
        removedRatio: contentQuality.removedRatio
      }
    })
  }

  const protectedKeys = Array.isArray(options.protectedCacheKeys) ? options.protectedCacheKeys : []
  writeOnlineChapterCache(book, chapter, content, protectedKeys)
  const persisted = !!readOnlineChapterCache(book.id, chapter.index)
  const loaded = { ...chapter, content, contentQuality, isCached: persisted, loadStatus: 'loaded', errorMessage: '' }
  const savedBook = persisted ? (updateOnlineBookChapterCache(book, loaded) || book) : book
  if (options.autoPreload) {
    await preloadOnlineChapters(savedBook, chapter.index, {
      count: cacheSettings.preloadCount
    })
  }
  return loaded
}

export async function loadOnlineChapter(book, chapter, options = {}) {
  return runTrackedReadingStage(book, 'content', () => loadOnlineChapterInternal(book, chapter, options))
}

async function searchSource(source, keyword) {
  const raw = source.raw || {}
  const rule = normalizeRuleObject(raw.ruleSearch)
  if (!raw.searchUrl || !Object.keys(rule).length) return []

  const context = { key: keyword, keyword, page: 1, rendered: false }
  let activeSource = source
  const initialSpec = createSourceRequestSpec(activeSource, raw.searchUrl, context, activeSource.baseUrl)
  let html = await requestText(initialSpec)
  let parsed = parseSearchResponse(activeSource, rule, keyword, html)
  if (!parsed.results.length && initialSpec.method === 'POST' && !/^https?:\/\//i.test(String(raw.searchUrl || '').trim())) {
    const canonicalSource = await resolveCanonicalSearchSource(source)
    if (canonicalSource) {
      activeSource = canonicalSource
      const canonicalSpec = stripCrossOriginSensitiveFields(
        createSourceRequestSpec(activeSource, raw.searchUrl, context, activeSource.baseUrl)
      )
      html = await requestText(canonicalSpec)
      parsed = parseSearchResponse(activeSource, rule, keyword, html)
      parsed.results.diagnostics.canonicalBaseUrl = activeSource.baseUrl
    }
  }
  const hydrated = await hydrateSourceSearchResults(parsed.results, {
    maxItems: 3,
    concurrency: 2,
    timeoutMs: 4000
  })
  const results = hydrated.results
  results.diagnostics = {
    ...(parsed.results.diagnostics || {}),
    completeResultCount: hydrated.completeResultCount,
    incompleteResultCount: hydrated.incompleteResultCount,
    metadataFailureCount: hydrated.metadataFailureCount
  }
  results.metadataReport = hydrated
  return results
}

function hasUsableOnlineBookTitle(value) {
  const title = cleanText(value)
  return !!title && title !== ONLINE_BOOK_PLACEHOLDER_TITLE
}

function withHydratedSearchMetadata(item, book) {
  const normalized = { ...book, metadataStatus: 'complete', metadataOrigin: 'detail' }
  return {
    ...item,
    bookId: normalized.id,
    title: normalized.title,
    subtitle: `${normalized.author} · ${normalized.sourceName}`,
    snippet: normalized.latestChapter || normalized.kind || '在线书源结果',
    metadataStatus: 'complete',
    book: normalized
  }
}

export async function hydrateSourceSearchResults(results = [], options = {}) {
  const rows = Array.isArray(results) ? results : []
  const incomplete = []
  let invalidCount = 0
  rows.forEach((item, index) => {
    const book = item && item.book || {}
    if (!book.bookUrl) {
      invalidCount += 1
      return
    }
    if (!hasUsableOnlineBookTitle(item.title || book.title)) incomplete.push({ item, index })
  })
  const maximum = clampNumber(options.maxItems, 0, 10, 3)
  const selected = incomplete.slice(0, maximum)
  const hydratedRows = await runConcurrent(selected, clampNumber(options.concurrency, 1, 4, 2), async row => {
    try {
      const loaded = await withTimeout(
        loadOnlineBookInfoInternal(row.item.book, { bypassCache: options.bypassCache === true }),
        clampNumber(options.timeoutMs, 1000, 8000, 4000),
        row.item.sourceName
      )
      if (!hasUsableOnlineBookTitle(loaded && loaded.title)) {
        throw new SourceRuntimeError('DETAIL_METADATA_EMPTY', '详情缺少书名', { stage: 'detail' })
      }
      return { index: row.index, item: withHydratedSearchMetadata(row.item, loaded), errorCode: '' }
    } catch (error) {
      return { index: row.index, item: null, errorCode: classifySourceFailure(error, { stage: 'detail' }).errorCode }
    }
  })
  const hydratedMap = new Map(hydratedRows.map(row => [row.index, row]))
  const output = []
  rows.forEach((item, index) => {
    const book = item && item.book || {}
    if (!book.bookUrl) return
    if (hasUsableOnlineBookTitle(item.title || book.title)) {
      output.push({ ...item, metadataStatus: 'complete', book: { ...book, metadataStatus: 'complete' } })
      return
    }
    const hydrated = hydratedMap.get(index)
    if (hydrated && hydrated.item) output.push(hydrated.item)
  })
  const metadataFailureCount = invalidCount + incomplete.length - hydratedRows.filter(row => row.item).length
  return {
    results: output,
    completeResultCount: output.length,
    incompleteResultCount: incomplete.length,
    metadataFailureCount,
    invalidResultCount: invalidCount,
    attemptedDetailCount: selected.length,
    errorsByCode: hydratedRows.reduce((counts, row) => {
      if (row.errorCode) counts[row.errorCode] = Number(counts[row.errorCode] || 0) + 1
      return counts
    }, {})
  }
}

function parseSearchResponse(source, rule, keyword, html) {
  const payload = parseResponsePayload(html)
  const listRule = getFieldRule(rule, ['bookList', 'list', 'books'])
  const list = applyListRule(payload, listRule, { key: keyword, keyword, page: 1, $: payload })

  const mappedResults = list.map(item => {
    const context = { key: keyword, keyword, $: item }
    const titleRule = getFieldRule(rule, ['name', 'bookName', 'title'])
    const rawTitle = cleanText(firstValue(applyRule(item, titleRule, context)))
    const parsedFields = {
      title: rawTitle,
      author: pickText(item, rule, ['author', 'bookAuthor'], context) || '未知作者',
      kind: pickText(item, rule, ['kind', 'category', 'type'], context) || '在线书源',
      latestChapter: pickText(item, rule, ['latestChapter', 'lastChapter', 'last'], context),
      intro: pickText(item, rule, ['intro', 'description', 'desc'], context),
      coverUrl: pickUrl(item, rule, ['coverUrl', 'cover', 'image'], context, source.baseUrl)
    }
    const parsedBook = { ...parsedFields, name: rawTitle }
    const resolvedContext = { ...context, ...parsedFields, book: parsedBook }
    const explicitBookUrlRule = getFieldRule(rule, ['bookUrl', 'url', 'link'])
    const bookUrlRule = explicitBookUrlRule || deriveBookUrlRuleFromTitle(titleRule)
    const book = normalizeOnlineBookForShelf({
      sourceId: source.id,
      sourceName: source.name,
      sourceGroup: source.group,
      bookUrl: resolveUrl(firstValue(applyRule(item, bookUrlRule, resolvedContext)), source.baseUrl),
      ...parsedFields,
      metadataStatus: rawTitle ? 'complete' : 'needs_detail',
      metadataOrigin: 'search'
    }, { preserveMissingTitle: true })

    return {
      type: 'online',
      bookId: book.id,
      title: book.title,
      subtitle: `${book.author} · ${source.name}`,
      snippet: book.latestChapter || book.kind || '在线书源结果',
      sourceId: source.id,
      sourceName: source.name,
      metadataStatus: rawTitle ? 'complete' : 'needs_detail',
      book
    }
  })
  const results = mappedResults.filter(result => result.book.bookUrl)
  results.diagnostics = {
    ...buildSearchResponseDiagnostics(html, payload, listRule, list.length, results.length),
    missingTitleCount: mappedResults.filter(result => !hasUsableOnlineBookTitle(result.book.title)).length,
    missingBookUrlCount: mappedResults.filter(result => !result.book.bookUrl).length
  }
  return { results, payload, list }
}

async function resolveCanonicalSearchSource(source) {
  const baseUrl = String(source && source.baseUrl || '').trim()
  if (!/^https?:\/\//i.test(baseUrl)) return null
  const cacheKey = String(source && (source.sourceKey || source.id) || baseUrl)
  const cachedBaseUrl = canonicalSearchBaseCache.get(cacheKey)
  if (cachedBaseUrl) return { ...source, baseUrl: cachedBaseUrl }
  try {
    const response = await requestSourceResponse({
      url: baseUrl,
      method: 'GET',
      headers: { Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' },
      charset: '',
      cookie: '',
      userAgent: 'Mozilla/5.0 NovelReader/3.x',
      referer: '',
      timeoutMs: 8000,
      maxBytes: 256 * 1024,
      sourceKey: source.sourceKey || source.id
    }, { sourceKey: source.sourceKey || source.id, useBackend: false })
    const initial = new URL(baseUrl)
    const final = new URL(response.finalUrl || baseUrl)
    if (initial.origin === final.origin) return null
    final.search = ''
    final.hash = ''
    const canonicalBaseUrl = final.toString()
    canonicalSearchBaseCache.set(cacheKey, canonicalBaseUrl)
    return { ...source, baseUrl: canonicalBaseUrl }
  } catch (error) {
    return null
  }
}

function stripCrossOriginSensitiveFields(spec = {}) {
  const header = Object.fromEntries(Object.entries(spec.header || {}).filter(([name]) => {
    return !/^(?:cookie|authorization|proxy-authorization)$/i.test(String(name || '').trim())
  }))
  return { ...spec, header, cookie: '' }
}

function buildSearchResponseDiagnostics(html, payload, listRule, listCount, resultCount) {
  const text = String(html || '')
  const lower = text.toLowerCase()
  const classCounts = {}
  for (const match of text.matchAll(/\bclass=["']([^"']+)["']/gi)) {
    String(match[1] || '').split(/\s+/).filter(Boolean).slice(0, 12).forEach(name => {
      if (/^[\w-]{1,48}$/.test(name)) classCounts[name] = (classCounts[name] || 0) + 1
    })
  }
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return {
    responseLength: text.length,
    responseFingerprint: (hash >>> 0).toString(16).padStart(8, '0'),
    payloadType: Array.isArray(payload) ? 'array' : payload && typeof payload === 'object' ? 'object' : 'text',
    topLevelKeys: payload && typeof payload === 'object' && !Array.isArray(payload) ? Object.keys(payload).slice(0, 20) : [],
    classNames: Object.entries(classCounts).sort((left, right) => right[1] - left[1]).slice(0, 20).map(entry => entry[0]),
    ruleKind: String(listRule || '').trim().startsWith('$.') ? 'jsonpath' : /xpath:|^\/\//i.test(String(listRule || '').trim()) ? 'xpath' : 'css',
    listCount: Number(listCount || 0),
    resultCount: Number(resultCount || 0),
    markers: {
      captcha: /captcha|recaptcha|turnstile|验证码|人机验证/i.test(text),
      login: /请先登录|必须登录|登录后(?:才能|可)|login\s*(?:required|form)/i.test(text),
      blocked: /cloudflare|access denied|访问过于频繁|请求被拒绝|安全验证/i.test(lower),
      parked: /domain\s+(?:is\s+)?for\s+sale|buy\s+this\s+domain|域名出售|购买此域名/i.test(text)
        || ['domain-name', 'stencil-overall', 'EasyRegister', 'htmlprv_content_wrapper'].some(name => classCounts[name]),
      noResult: /无搜索结果|没有找到|搜索不到|暂无相关|no results?|not found/i.test(text)
        || !!(payload && typeof payload === 'object' && (Number(payload.totalNum) === 0 || Array.isArray(payload.data) && payload.data.length === 0))
    }
  }
}

function createEmptySearchError(diagnostics = {}) {
  const markers = diagnostics.markers || {}
  let code = 'PARSE_EMPTY'
  let message = '搜索响应已返回，但规则没有解析出有效图书'
  if (Number(diagnostics.metadataFailureCount || 0) > 0 && Number(diagnostics.completeResultCount || 0) === 0) {
    code = 'SEARCH_RESULT_INCOMPLETE'
    message = '搜索结果信息不完整，详情也未能补齐书名'
  } else if (markers.captcha) {
    code = 'CAPTCHA_REQUIRED'
    message = '搜索页面要求验证码或人机验证'
  } else if (markers.login) {
    code = 'LOGIN_REQUIRED'
    message = '搜索页面要求登录'
  } else if (markers.blocked) {
    code = 'HTTP_BLOCKED'
    message = '搜索页面返回了访问限制内容'
  } else if (markers.parked) {
    code = 'SITE_UNREACHABLE'
    message = '书源域名已停放或出售，原站点不可用'
  } else if (markers.noResult) {
    code = 'SEARCH_EMPTY'
    message = '站点返回无搜索结果'
  } else if (!diagnostics.responseLength) {
    code = 'PARSE_EMPTY'
    message = '搜索响应为空'
  }
  return new SourceRuntimeError(code, message, { stage: 'search', diagnostics })
}

function normalizeOnlineBookForShelf(book, options = {}) {
  const id = book.id || createOnlineBookId(book.sourceId, book.bookUrl)
  const title = cleanText(book.title)
  return {
    id,
    source: 'online',
    sourceId: book.sourceId,
    sourceName: book.sourceName || (getSourceConfig(book.sourceId) || {}).name || '在线书源',
    sourceGroup: book.sourceGroup || '',
    bookUrl: book.bookUrl,
    tocUrl: book.tocUrl || book.bookUrl,
    title: title || (options.preserveMissingTitle ? '' : ONLINE_BOOK_PLACEHOLDER_TITLE),
    author: cleanText(book.author) || '未知作者',
    category: cleanText(book.kind || book.category) || '在线书源',
    kind: cleanText(book.kind) || '在线书源',
    latestChapter: cleanText(book.latestChapter),
    intro: cleanText(book.intro),
    description: cleanText(book.intro) || `${book.sourceName || '在线书源'} · 在线阅读`,
    coverUrl: book.coverUrl || '',
    coverColor: '#506f89',
    accent: '#31584f',
    metadataStatus: book.metadataStatus || (title ? 'complete' : 'needs_detail'),
    metadataOrigin: book.metadataOrigin || '',
    chapters: (book.chapters || []).map((chapter, index) => {
      const content = chapter.content || ''
      const errorMessage = cleanText(chapter.errorMessage)
      const isCached = !!chapter.isCached || !!content || !!readStorage(chapterCacheKey(id, index), '')
      const loadStatus = chapter.loadStatus || (errorMessage ? 'failed' : content ? 'loaded' : isCached ? 'cached' : 'idle')
      return {
        title: chapter.title || `第 ${index + 1} 章`,
        url: chapter.url,
        index,
        isCached,
        loadStatus,
        errorMessage,
        content
      }
    }),
    addedAt: book.addedAt || Date.now(),
    updatedAt: Date.now()
  }
}

function createOnlineBookId(sourceId, bookUrl) {
  const base = `${sourceId}:${bookUrl}`
  let hash = 0
  for (let index = 0; index < base.length; index += 1) {
    hash = ((hash << 5) - hash) + base.charCodeAt(index)
    hash |= 0
  }
  return `online-${Math.abs(hash).toString(36)}`
}

function extractJsonLink(html, baseUrl) {
  const text = String(html || '')
  const direct = text.match(/https?:\/\/[^"'<> ]+\.json[^"'<> ]*/i)
  if (direct) return direct[0]

  const jsonUrlInput = text.match(/id=["']jsonurl["'][^>]*\bvalue=["']([^"']+)["']/i)
    || text.match(/\bvalue=["']([^"']+\.json(?:\?[^"']*)?)["'][^>]*id=["']jsonurl["']/i)
  if (jsonUrlInput) return resolveUrl(jsonUrlInput[1], baseUrl)

  const links = text.match(/(?:href|data-url|url|value)=["']([^"']+\.json(?:\?[^"']*)?)["']/ig) || []
  const found = links
    .map(link => (link.match(/(?:href|data-url|url|value)=["']([^"']+)["']/i) || [])[1])
    .find(Boolean)
  return found ? resolveUrl(found, baseUrl) : ''
}
