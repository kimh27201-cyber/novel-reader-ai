export const DEFAULT_RUNTIME_EXCLUSION_CODES = new Set([
  'SITE_UNREACHABLE',
  'HTTP_BLOCKED',
  'HTTP_NOT_FOUND',
  'HTTP_SERVER_ERROR',
  'NETWORK_ERROR',
  'TIMEOUT',
  'LOGIN_REQUIRED',
  'CAPTCHA_REQUIRED',
  'COOKIE_REQUIRED',
  'WEBVIEW_REQUIRED',
  'CONFIG_CHANGED'
])

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function stableHash(value) {
  const text = stableStringify(value)
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `manifest-v1-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function manifestIdentity(entries = [], options = {}) {
  return {
    entries: entries.map((entry, index) => ({
      index,
      block: Number(entry.block == null ? Math.floor(index / Number(options.blockSize || 20)) : entry.block),
      id: String(entry.id || ''),
      layer: String(entry.layer || ''),
      page: Number(entry.page || 0),
      sourceKey: String(entry.sourceKey || ''),
      sha256: String(entry.sha256 || ''),
      configHash: String(entry.configHash || '')
    })),
    keywords: (options.keywords || ['斗破苍穹', '剑来', '诡秘之主']).map(String),
    timeoutMs: Number(options.timeoutMs || 12000),
    maxPerHost: Number(options.maxPerHost || 2)
  }
}

export function createLockedAcceptanceManifest(candidates = [], options = {}) {
  const target = Math.max(1, Math.min(500, Number(options.target || 200)))
  const blockSize = Math.max(1, Math.min(100, Number(options.blockSize || 20)))
  const entries = (Array.isArray(candidates) ? candidates : []).slice(0, target).map((row, index) => ({
    index,
    block: Math.floor(index / blockSize),
    id: String(row.id || ''),
    layer: String(row.layer || ''),
    page: Number(row.page || 0),
    sourceKey: String(row.sourceKey || ''),
    sha256: String(row.sha256 || ''),
    configHash: String(row.configHash || '')
  }))
  if (entries.some(entry => !entry.id || !entry.sourceKey || !entry.sha256 || !entry.configHash)) {
    throw new Error('固定清单包含缺失的 ID、sourceKey、SHA-256 或 configHash')
  }
  const identity = manifestIdentity(entries, { ...options, blockSize })
  const manifestHash = stableHash(identity)
  return {
    schemaVersion: 4,
    cohortId: String(options.cohortId || `stage12-${manifestHash.slice(-8)}`).slice(0, 80),
    createdAt: String(options.createdAt || new Date().toISOString()),
    manifestHash,
    locked: true,
    target: entries.length,
    blockSize,
    keywords: identity.keywords,
    timeoutMs: identity.timeoutMs,
    maxPerHost: identity.maxPerHost,
    entries
  }
}

export function verifyLockedAcceptanceManifest(manifest = {}) {
  const entries = Array.isArray(manifest.entries) ? manifest.entries : []
  if (!manifest.locked || !entries.length) return { valid: false, errorCode: 'MANIFEST_EMPTY', expectedHash: '', actualHash: '' }
  const identity = manifestIdentity(entries, manifest)
  const actualHash = stableHash(identity)
  return {
    valid: actualHash === manifest.manifestHash,
    errorCode: actualHash === manifest.manifestHash ? '' : 'MANIFEST_HASH_MISMATCH',
    expectedHash: String(manifest.manifestHash || ''),
    actualHash
  }
}

function sourceHost(row) {
  try {
    const source = row && (row._source || row.source || row)
    return new URL(String(source.baseUrl || (source.raw && source.raw.bookSourceUrl) || '')).hostname.toLowerCase()
  } catch (error) {
    return String(row && (row.sourceKey || row.id) || '')
  }
}

export function buildCurrentAcceptanceCohort(rows = [], options = {}) {
  const target = Math.max(1, Number(options.target || 200))
  const maxPerHost = Math.max(1, Number(options.maxPerHost || 2))
  const blockSize = Math.max(1, Number(options.blockSize || 20))
  const layers = ['recent', 'middle', 'older']
  const queues = new Map(layers.map(layer => [layer, []]))
  ;(Array.isArray(rows) ? rows : []).forEach(row => {
    const layer = layers.includes(row && row.layer) ? row.layer : 'middle'
    queues.get(layer).push(row)
  })
  const selected = []
  const hostCounts = new Map()
  let progressed = true
  while (selected.length < target && progressed) {
    progressed = false
    for (const layer of layers) {
      const queue = queues.get(layer)
      while (queue.length) {
        const row = queue.shift()
        const host = sourceHost(row)
        if (Number(hostCounts.get(host) || 0) >= maxPerHost) continue
        hostCounts.set(host, Number(hostCounts.get(host) || 0) + 1)
        selected.push(row)
        progressed = true
        break
      }
      if (selected.length >= target) break
    }
  }
  return {
    rows: selected,
    blocks: Array.from({ length: Math.ceil(selected.length / blockSize) }, (_, index) => selected
      .slice(index * blockSize, (index + 1) * blockSize)
      .map(row => ({ id: row.id, sourceKey: row.sourceKey || '', sha256: row.sha256 || '' }))),
    hostCount: hostCounts.size,
    maxPerHost,
    blockSize
  }
}

export function summarizeAcceptanceWindow(samples = [], options = {}) {
  const exclusions = options.exclusionCodes || DEFAULT_RUNTIME_EXCLUSION_CODES
  const tested = (Array.isArray(samples) ? samples : []).filter(row => row && row.flow)
  const runtimeEligible = tested.filter(row => row.flow.status === 'passed' || !exclusions.has(row.flow.errorCode))
  const passed = runtimeEligible.filter(row => row.flow.status === 'passed')
  const metadataFailures = tested.filter(row => ['SEARCH_RESULT_INCOMPLETE', 'DETAIL_METADATA_EMPTY'].includes(row.flow.errorCode)).length
  return {
    flowTested: tested.length,
    runtimeEligible: runtimeEligible.length,
    runtimeExcluded: tested.length - runtimeEligible.length,
    flowPassed: passed.length,
    flowRatePercent: runtimeEligible.length ? Number((passed.length * 100 / runtimeEligible.length).toFixed(2)) : 0,
    metadataFailures,
    passedSourceIds: passed.map(row => String(row.id))
  }
}

export function combineAcceptanceWindows(windows = [], options = {}) {
  const minimumDenominator = Math.max(1, Number(options.minimumDenominator || 20))
  const minimumRate = Math.max(0, Number(options.minimumRate || 80))
  const minimumSeparationMs = Math.max(0, Number(options.minimumSeparationMs == null ? 24 * 60 * 60 * 1000 : options.minimumSeparationMs))
  const ordered = (Array.isArray(windows) ? windows : []).slice().sort((left, right) => Date.parse(left.capturedAt || 0) - Date.parse(right.capturedAt || 0))
  const summaries = ordered.map(window => ({
    windowId: window.windowId || '',
    capturedAt: window.capturedAt || '',
    ...summarizeAcceptanceWindow(window.samples || [])
  }))
  const separationMs = summaries.length >= 2
    ? Date.parse(summaries[summaries.length - 1].capturedAt) - Date.parse(summaries[0].capturedAt)
    : 0
  const stablePassed = summaries.length
    ? summaries.map(item => new Set(item.passedSourceIds)).reduce((intersection, current) => new Set([...intersection].filter(id => current.has(id))))
    : new Set()
  return {
    windows: summaries,
    separationMs,
    stablePassedSourceIds: [...stablePassed],
    gatePassed: summaries.length >= 2
      && separationMs >= minimumSeparationMs
      && summaries.every(item => item.runtimeEligible >= minimumDenominator && item.flowRatePercent >= minimumRate)
  }
}

export function validateAcceptanceWindowPair(windowA = {}, windowB = {}, options = {}) {
  const minimumSeparationMs = Math.max(0, Number(options.minimumSeparationMs == null ? 24 * 60 * 60 * 1000 : options.minimumSeparationMs))
  const errors = []
  const manifestA = windowA.manifest || windowA.lockedManifest || {}
  const manifestB = windowB.manifest || windowB.lockedManifest || {}
  const verifiedA = verifyLockedAcceptanceManifest(manifestA)
  const verifiedB = verifyLockedAcceptanceManifest(manifestB)
  if (!verifiedA.valid || !verifiedB.valid) errors.push('MANIFEST_INVALID')
  if (manifestA.manifestHash !== manifestB.manifestHash) errors.push('MANIFEST_HASH_MISMATCH')
  if (String(windowA.cohortId || manifestA.cohortId || '') !== String(windowB.cohortId || manifestB.cohortId || '')) errors.push('COHORT_ID_MISMATCH')
  if (!windowSamplesMatchManifest(windowA, manifestA)) errors.push('WINDOW_A_SAMPLE_MISMATCH')
  if (!windowSamplesMatchManifest(windowB, manifestB)) errors.push('WINDOW_B_SAMPLE_MISMATCH')
  if (String(windowB.referenceWindowId || '') !== String(windowA.windowId || '')) errors.push('REFERENCE_WINDOW_MISMATCH')
  const separationMs = Date.parse(windowB.capturedAt || 0) - Date.parse(windowA.completedAt || windowA.capturedAt || 0)
  if (!Number.isFinite(separationMs) || separationMs < minimumSeparationMs) errors.push('WINDOW_SEPARATION_TOO_SHORT')
  const combined = combineAcceptanceWindows([windowA, windowB], options)
  return {
    ...combined,
    separationMs,
    cohortId: String(windowA.cohortId || manifestA.cohortId || ''),
    manifestHash: String(manifestA.manifestHash || ''),
    errors: [...new Set(errors)],
    gatePassed: errors.length === 0 && combined.gatePassed
  }
}

function windowSamplesMatchManifest(window = {}, manifest = {}) {
  const samples = Array.isArray(window.samples) ? window.samples : []
  const entries = Array.isArray(manifest.entries) ? manifest.entries : []
  if (samples.length !== entries.length) return false
  return entries.every((entry, index) => {
    const sample = samples[index] || {}
    const expectedHash = String(sample.expectedConfigHash || sample.configHash || '')
    return String(sample.id || '') === String(entry.id || '')
      && String(sample.sourceKey || '') === String(entry.sourceKey || '')
      && expectedHash === String(entry.configHash || '')
  })
}

export function buildStableSourceSeeds(gateReport = {}, windows = []) {
  if (!gateReport || gateReport.gatePassed !== true) return []
  const rowsById = new Map()
  ;(Array.isArray(windows) ? windows : []).forEach(window => {
    ;(window.samples || []).forEach(row => {
      if (!row || !row.flow || row.flow.status !== 'passed' || row.configStatus === 'changed') return
      const id = String(row.id || '')
      if (!id) return
      if (!rowsById.has(id)) rowsById.set(id, [])
      rowsById.get(id).push(row)
    })
  })
  const requiredWindows = Math.max(2, Number((gateReport.windows || []).length || 2))
  return [...rowsById.values()].filter(rows => rows.length >= requiredWindows).map(rows => {
    const first = rows[0]
    const latencies = rows.map(row => Number(row.flow && row.flow.elapsedMs || row.elapsedMs || 0)).sort((a, b) => a - b)
    const middle = Math.floor(latencies.length / 2)
    const medianLatencyMs = latencies.length % 2 ? latencies[middle] : Math.round((latencies[middle - 1] + latencies[middle]) / 2)
    return {
      sourceKey: String(first.sourceKey || ''),
      configHash: String(first.actualConfigHash || first.configHash || ''),
      passedWindowIds: rows.map(row => String(row.windowId || '')).filter(Boolean),
      lastAcceptedAt: Math.max(...rows.map(row => Date.parse(row.capturedAt || 0) || 0)),
      medianLatencyMs
    }
  }).filter(seed => seed.sourceKey && seed.configHash).sort((a, b) => a.sourceKey.localeCompare(b.sourceKey))
}

export default {
  buildCurrentAcceptanceCohort,
  createLockedAcceptanceManifest,
  verifyLockedAcceptanceManifest,
  summarizeAcceptanceWindow,
  combineAcceptanceWindows,
  validateAcceptanceWindowPair,
  buildStableSourceSeeds
}
