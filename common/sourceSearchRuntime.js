import apiClient from './apiClient.js'
import { searchBackendBooks } from './backendLibrary.js'
import { runAdaptiveSourceSearch } from './bookSources.js'

function resultIdentity(item) {
  const book = item && item.book || {}
  const title = String(item && item.title || book.title || '').trim().toLowerCase()
  const author = String(item && item.author || book.author || '').trim().toLowerCase()
  return `${title}::${author}`
}

export function mergeUnifiedSearchResults(localResults = [], backendResults = [], limit = 80) {
  const output = []
  const seen = new Map()
  const append = (item, route) => {
    if (!item || item.type === 'source-error') return
    const key = resultIdentity(item)
    if (!key || key === '::') return
    if (!seen.has(key)) {
      const normalized = { ...item, route, alternateRoutes: [] }
      seen.set(key, normalized)
      output.push(normalized)
      return
    }
    const current = seen.get(key)
    current.alternateRoutes.push({
      route,
      sourceId: item.sourceId || (item.book && item.book.sourceId) || '',
      sourceName: item.sourceName || (item.book && item.book.sourceName) || '',
      candidate: item
    })
  }
  localResults.forEach(item => append(item, 'local-source'))
  backendResults.forEach(item => append(item, 'backend'))
  return output.slice(0, limit)
}

function withBackendTimeout(promise, timeoutMs = 8000) {
  let timer
  return Promise.race([
    Promise.resolve(promise).finally(() => timer && clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('后端搜索超时，已继续使用手机本地结果')), timeoutMs)
    })
  ])
}

export async function searchUnifiedBooks(keyword, options = {}) {
  let latestLocal = []
  let backendResults = []
  let backendError = ''
  const mergeBackend = options.mergeBackend !== false && !!apiClient.getToken()
  const emitResults = (localReport = null) => {
    const results = mergeUnifiedSearchResults(latestLocal, backendResults, options.resultLimit || 80)
    if (typeof options.onResults === 'function') {
      options.onResults(results, { local: localReport, backendCount: backendResults.length, backendError })
    }
    return results
  }

  const localPromise = runAdaptiveSourceSearch(keyword, {
    ...options,
    onResults(results, report) {
      latestLocal = results
      emitResults(report)
    }
  })
  const backendPromise = mergeBackend
    ? withBackendTimeout(searchBackendBooks(keyword), Number(options.backendTimeoutMs || 8000))
      .then(results => {
        backendResults = (results || []).filter(item => item && item.type !== 'source-error')
        emitResults(null)
      })
      .catch(error => {
        backendError = error && error.message || '后端搜索失败'
      })
    : Promise.resolve()

  const [localReport] = await Promise.all([localPromise, backendPromise])
  latestLocal = localReport.results
  const results = emitResults(localReport)
  return {
    keyword: String(keyword || '').trim(),
    results,
    local: localReport,
    backend: {
      enabled: mergeBackend,
      count: backendResults.length,
      error: backendError
    }
  }
}
