import {
  applyImportPreview,
  buildImportPreview,
  getSourceStorageCapabilities,
  getStoredSourceConfigs,
  normalizeBookSources,
  persistSourceConfigs
} from './bookSources.js'
import {
  fetchSourceMarketBatch,
  fetchSourceMarketPageWithFallback
} from './sourceMarket.js'

const CHECKPOINT_KEY = 'sources:yck-bulk-import:v1'
const memoryStore = {}

function readStorage(key, fallback) {
  try {
    if (typeof uni !== 'undefined' && uni.getStorageSync) {
      const value = uni.getStorageSync(key)
      return value === '' || value == null ? fallback : value
    }
  } catch (error) {}
  return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : fallback
}

function writeStorage(key, value) {
  try {
    if (typeof uni !== 'undefined' && uni.setStorageSync) {
      uni.setStorageSync(key, value)
      return
    }
  } catch (error) {}
  memoryStore[key] = value
}

function hashText(value) {
  let hash = 2166136261
  const text = String(value || '')
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function buildScope(options = {}) {
  const filters = ['keyword', 'uid', 'order1', 'order2', 'ver', 'faxian', 'sousuo', 'tu', 'shengyin']
    .reduce((result, name) => {
      if (options[name] != null && String(options[name]).trim()) result[name] = String(options[name]).trim()
      return result
    }, {})
  return {
    provider: options.provider || 'yckceo',
    filters,
    key: hashText(JSON.stringify({ provider: options.provider || 'yckceo', filters }))
  }
}

function emptyStats() {
  return {
    pages: 0,
    catalogItems: 0,
    downloaded: 0,
    missing: 0,
    imported: 0,
    updated: 0,
    skipped: 0,
    invalid: 0,
    ready: 0,
    partial: 0,
    needsLogin: 0,
    blocked: 0
  }
}

function normalizeCheckpoint(value) {
  const checkpoint = value && typeof value === 'object' ? value : {}
  return {
    version: 1,
    scopeKey: String(checkpoint.scopeKey || ''),
    provider: String(checkpoint.provider || ''),
    status: String(checkpoint.status || ''),
    nextPage: Math.max(1, Number(checkpoint.nextPage || 1)),
    totalPages: Math.max(0, Number(checkpoint.totalPages || 0)),
    total: Math.max(0, Number(checkpoint.total || 0)),
    stats: { ...emptyStats(), ...(checkpoint.stats || {}) },
    errorCode: String(checkpoint.errorCode || ''),
    message: String(checkpoint.message || ''),
    updatedAt: Number(checkpoint.updatedAt || 0)
  }
}

export function getYckBulkImportCheckpoint(options = {}) {
  const checkpoint = normalizeCheckpoint(readStorage(CHECKPOINT_KEY, null))
  if (!checkpoint.scopeKey) return null
  const scope = buildScope(options)
  return checkpoint.scopeKey === scope.key ? checkpoint : null
}

export function clearYckBulkImportCheckpoint() {
  writeStorage(CHECKPOINT_KEY, '')
}

function saveCheckpoint(scope, state) {
  const checkpoint = normalizeCheckpoint({
    ...state,
    scopeKey: scope.key,
    provider: scope.provider,
    updatedAt: Date.now()
  })
  writeStorage(CHECKPOINT_KEY, checkpoint)
  return checkpoint
}

async function withRetry(operation, retries = 2) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation(attempt)
    } catch (error) {
      lastError = error
      if (attempt >= retries) break
      await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)))
    }
  }
  throw lastError
}

function mergeStats(stats, preview, result, batch, catalogCount) {
  return {
    ...stats,
    pages: stats.pages + 1,
    catalogItems: stats.catalogItems + catalogCount,
    downloaded: stats.downloaded + preview.total,
    missing: stats.missing + Number(batch.missing || 0),
    imported: stats.imported + result.imported,
    updated: stats.updated + result.updated,
    skipped: stats.skipped + result.skipped,
    invalid: stats.invalid + preview.sources.filter(source => source.status === 'invalid').length,
    ready: stats.ready + preview.sources.filter(source => source.status === 'ready').length,
    partial: stats.partial + preview.sources.filter(source => source.status === 'partial').length,
    needsLogin: stats.needsLogin + preview.sources.filter(source => source.status === 'needs_login').length,
    blocked: stats.blocked + preview.sources.filter(source => source.status === 'blocked').length
  }
}

function emit(options, payload) {
  if (typeof options.onProgress === 'function') options.onProgress(payload)
}

export async function runYckBulkImport(options = {}) {
  const scope = buildScope(options)
  const saved = options.resume === false ? null : getYckBulkImportCheckpoint(options)
  const resumable = saved && ['running', 'cancelled', 'failed'].includes(saved.status) ? saved : null
  const startPage = resumable
    ? resumable.nextPage
    : Math.max(1, Number(options.page || 1))
  const firstPage = await withRetry(() => fetchSourceMarketPageWithFallback({
    ...scope.filters,
    provider: scope.provider,
    page: startPage
  }), Number(options.retryCount == null ? 2 : options.retryCount))
  const storage = getSourceStorageCapabilities()
  if (!storage.native && firstPage.total > storage.recommendedBulkLimit && options.allowLargeWebStorage !== true) {
    const error = new Error(`当前平台仅建议批量保存 ${storage.recommendedBulkLimit} 个书源；全量 ${firstPage.total} 个请在 Android APK 中执行`)
    error.code = 'BULK_STORAGE_UNAVAILABLE'
    throw error
  }

  const totalPages = Math.min(1000, Number(options.maxPages || firstPage.totalPages || 1))
  const commitEveryPages = Math.max(1, Math.min(20, Number(options.commitEveryPages || 5)))
  let currentSources = getStoredSourceConfigs()
  let stats = resumable ? resumable.stats : emptyStats()
  let processedSinceCommit = 0
  let nextPage = startPage

  const commit = status => {
    persistSourceConfigs(currentSources)
    processedSinceCommit = 0
    return saveCheckpoint(scope, {
      status,
      nextPage,
      totalPages,
      total: firstPage.total,
      stats,
      message: '',
      errorCode: ''
    })
  }

  saveCheckpoint(scope, { status: 'running', nextPage, totalPages, total: firstPage.total, stats })
  emit(options, { stage: 'catalog', page: startPage, totalPages, total: firstPage.total, stats, storage })

  try {
    for (let page = startPage; page <= totalPages; page += 1) {
      if (options.signal && options.signal.cancelled) {
        nextPage = page
        const checkpoint = commit('cancelled')
        return { status: 'cancelled', total: firstPage.total, totalPages, nextPage, stats, installed: currentSources.length, checkpoint }
      }
      const marketPage = page === startPage
        ? firstPage
        : await withRetry(() => fetchSourceMarketPageWithFallback({ ...scope.filters, provider: scope.provider, page }), Number(options.retryCount == null ? 2 : options.retryCount))
      if (!marketPage.items.length) {
        nextPage = page + 1
        break
      }
      emit(options, { stage: 'download', page, totalPages, total: firstPage.total, stats, catalogCount: marketPage.items.length })
      const batch = await withRetry(
        () => fetchSourceMarketBatch(marketPage.items, { provider: marketPage.provider || scope.provider }),
        Number(options.retryCount == null ? 2 : options.retryCount)
      )
      const normalized = normalizeBookSources(batch.sources, { source: 'yck-bulk', sourceUrl: batch.url })
      const preview = buildImportPreview(normalized, currentSources, {
        duplicateStrategy: options.duplicateStrategy || 'overwrite',
        enableReadyOnly: true
      })
      const result = applyImportPreview(preview, {
        duplicateStrategy: options.duplicateStrategy || 'overwrite',
        deferPersistence: true,
        currentSources,
        importMethod: 'yck-bulk',
        sourceUrl: batch.url
      })
      currentSources = result.nextSources
      stats = mergeStats(stats, preview, result, batch, marketPage.items.length)
      nextPage = page + 1
      processedSinceCommit += 1
      if (processedSinceCommit >= commitEveryPages || page === totalPages) commit(page === totalPages ? 'completed' : 'running')
      emit(options, { stage: 'import', page, totalPages, total: firstPage.total, stats, installed: currentSources.length })
    }
    const checkpoint = processedSinceCommit ? commit('completed') : saveCheckpoint(scope, {
      status: 'completed', nextPage, totalPages, total: firstPage.total, stats
    })
    return { status: 'completed', total: firstPage.total, totalPages, nextPage, stats, installed: currentSources.length, checkpoint }
  } catch (error) {
    if (processedSinceCommit) persistSourceConfigs(currentSources)
    const checkpoint = saveCheckpoint(scope, {
      status: 'failed', nextPage, totalPages, total: firstPage.total, stats,
      errorCode: String(error && error.code || 'BULK_IMPORT_FAILED'),
      message: String(error && error.message || '批量导入失败').slice(0, 300)
    })
    error.bulkImport = { status: 'failed', total: firstPage.total, totalPages, nextPage, stats, installed: currentSources.length, checkpoint }
    throw error
  }
}

export default {
  runYckBulkImport,
  getYckBulkImportCheckpoint,
  clearYckBulkImportCheckpoint
}
