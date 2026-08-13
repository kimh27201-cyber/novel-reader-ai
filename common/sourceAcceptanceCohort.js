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
  'WEBVIEW_REQUIRED'
])

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

export default { buildCurrentAcceptanceCohort, summarizeAcceptanceWindow, combineAcceptanceWindows }
