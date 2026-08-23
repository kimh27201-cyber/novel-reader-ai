const STORAGE_KEY = 'performance:metrics:v1'
const MAX_METRICS = 200
const pending = []
let flushTimer = null

function now() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
}

function safeContext(value = {}) {
  const allowed = ['route', 'stage', 'count', 'sourceCount', 'pageCount', 'memoryKb', 'status', 'mode']
  return allowed.reduce((result, key) => {
    const item = value && value[key]
    if (typeof item === 'number' && Number.isFinite(item)) result[key] = item
    else if (typeof item === 'boolean') result[key] = item
    else if (typeof item === 'string') result[key] = item.slice(0, 64)
    return result
  }, {})
}

function readMetrics() {
  try {
    const value = typeof uni !== 'undefined' && uni.getStorageSync ? uni.getStorageSync(STORAGE_KEY) : []
    return Array.isArray(value) ? value : []
  } catch (error) {
    return []
  }
}

function writeMetrics(metrics) {
  try {
    if (typeof uni !== 'undefined' && uni.setStorageSync) uni.setStorageSync(STORAGE_KEY, metrics)
  } catch (error) {}
}

export function flushPerformanceMetrics() {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (!pending.length) return readMetrics()
  const metrics = [...readMetrics(), ...pending.splice(0)].slice(-MAX_METRICS)
  writeMetrics(metrics)
  return metrics
}

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => flushPerformanceMetrics(), 1000)
  if (flushTimer && typeof flushTimer.unref === 'function') flushTimer.unref()
}

export function startPerformanceSpan(name, context = {}) {
  return {
    name: String(name || 'unknown').slice(0, 80),
    startedAt: now(),
    wallStartedAt: Date.now(),
    context: safeContext(context),
    finished: false
  }
}

export function finishPerformanceSpan(span, result = {}) {
  if (!span || span.finished) return null
  span.finished = true
  const metric = {
    name: span.name,
    startedAt: span.wallStartedAt,
    durationMs: Math.max(0, Math.round((now() - span.startedAt) * 10) / 10),
    ...span.context,
    ...safeContext(result)
  }
  pending.push(metric)
  scheduleFlush()
  return metric
}

export function recordPerformanceMetric(name, durationMs, context = {}) {
  const metric = {
    name: String(name || 'unknown').slice(0, 80),
    startedAt: Date.now(),
    durationMs: Math.max(0, Number(durationMs || 0)),
    ...safeContext(context)
  }
  pending.push(metric)
  scheduleFlush()
  return metric
}

export function samplePerformanceMemory(stage = 'unknown') {
  try {
    const bridge = globalThis.NovelReaderLaunch
    if (!bridge || typeof bridge.getMemoryInfo !== 'function') return null
    const value = bridge.getMemoryInfo()
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    const memoryKb = Number(parsed && parsed.totalPssKb || 0)
    if (!(memoryKb > 0)) return null
    return recordPerformanceMetric('memory.pss', 0, { stage, memoryKb })
  } catch (error) {
    return null
  }
}

export function getPerformanceReport() {
  const metrics = flushPerformanceMetrics()
  const byName = metrics.reduce((result, metric) => {
    const name = metric.name || 'unknown'
    if (!result[name]) result[name] = []
    result[name].push(Number(metric.durationMs || 0))
    return result
  }, {})
  const summary = Object.keys(byName).sort().map(name => {
    const values = byName[name].sort((a, b) => a - b)
    const p95Index = Math.max(0, Math.ceil(values.length * 0.95) - 1)
    return {
      name,
      count: values.length,
      averageMs: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10,
      p95Ms: values[p95Index]
    }
  })
  return { schemaVersion: 1, generatedAt: Date.now(), count: metrics.length, summary, metrics }
}

export function clearPerformanceReport() {
  pending.splice(0)
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
  try {
    if (typeof uni !== 'undefined' && uni.removeStorageSync) uni.removeStorageSync(STORAGE_KEY)
    else writeMetrics([])
  } catch (error) {}
  return getPerformanceReport()
}
