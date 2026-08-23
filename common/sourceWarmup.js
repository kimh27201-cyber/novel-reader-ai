import {
  buildSourceCandidatePool,
  getOnlineSearchSettings,
  getSourceConfigs,
  searchSourceBooks,
  selectDiverseSourceCandidates,
  writeSourceRuntimeStageResult
} from './bookSources.js'

const STATE_KEY = 'sources:warmup-state:v1'
const KEYWORDS = ['斗破苍穹', '剑来', '诡秘之主']

let foreground = false
let busy = false
let running = null
let cancelToken = null
let sessionAttempted = new Set()
let resumeTimer = null

function readState() {
  try {
    const value = typeof uni !== 'undefined' && uni.getStorageSync ? uni.getStorageSync(STATE_KEY) : null
    return value && typeof value === 'object' ? value : {}
  } catch (error) {
    return {}
  }
}

function writeState(value) {
  try {
    if (typeof uni !== 'undefined' && uni.setStorageSync) uni.setStorageSync(STATE_KEY, value)
  } catch (error) {
    // 预热状态失败不应影响正常搜索和阅读。
  }
}

function getNetworkType() {
  return new Promise(resolve => {
    if (typeof uni === 'undefined' || !uni.getNetworkType) return resolve('unknown')
    uni.getNetworkType({ success: result => resolve(result.networkType || 'unknown'), fail: () => resolve('unknown') })
  })
}

export function setSourceWarmupForeground(value) {
  foreground = !!value
  if (!foreground) pauseSourceWarmup()
}

export function setSourceWarmupBusy(value) {
  busy = !!value
  if (resumeTimer) clearTimeout(resumeTimer)
  resumeTimer = null
  if (busy) pauseSourceWarmup()
  else if (foreground) resumeTimer = setTimeout(() => {
    resumeTimer = null
    startSourceWarmup().catch(() => {})
  }, 2000)
}

export function pauseSourceWarmup() {
  if (resumeTimer) clearTimeout(resumeTimer)
  resumeTimer = null
  if (cancelToken) cancelToken.cancelled = true
}

export function getSourceWarmupState() {
  return { ...readState(), foreground, busy, running: !!running, sessionAttempted: sessionAttempted.size }
}

export function resetSourceWarmupSession() {
  sessionAttempted = new Set()
}

export async function startSourceWarmup(options = {}) {
  if (running) return running
  const settings = getOnlineSearchSettings()
  if (!settings.autoWarmup || !foreground || busy) return { skipped: true, reason: 'inactive' }
  if (await getNetworkType() !== 'wifi') return { skipped: true, reason: 'not_wifi' }

  cancelToken = { cancelled: false }
  running = (async () => {
    const maxSources = Math.min(20, Math.max(1, Number(options.maxSources || 20)))
    const remaining = maxSources - sessionAttempted.size
    if (remaining <= 0) return { skipped: true, reason: 'session_limit' }
    const pool = buildSourceCandidatePool(getSourceConfigs(), { excludeSourceIds: Array.from(sessionAttempted) })
    const candidates = selectDiverseSourceCandidates(
      [...pool.untested, ...pool.retryable].map(item => item.source),
      remaining,
      2
    )
    if (!candidates.length) return { skipped: true, reason: 'no_candidates' }

    const stored = readState()
    const keywordIndex = Number(stored.keywordIndex || 0) % KEYWORDS.length
    const emptyCounts = stored.emptyCounts && typeof stored.emptyCounts === 'object' ? { ...stored.emptyCounts } : {}
    const report = { attempted: 0, succeeded: 0, empty: 0, failed: 0, attemptedSourceIds: [] }
    let nextIndex = 0
    await Promise.all(Array.from({ length: Math.min(2, candidates.length) }, async () => {
      while (nextIndex < candidates.length && !cancelToken.cancelled && foreground && !busy) {
        const index = nextIndex
        nextIndex += 1
        const source = candidates[index]
        const raw = source.raw || source
        const keyword = String(raw.checkKeyWord || raw.checkKeyword || KEYWORDS[(keywordIndex + index) % KEYWORDS.length]).trim()
        report.attempted += 1
        report.attemptedSourceIds.push(source.id)
        try {
          const result = await searchSourceBooks(source.id, keyword, {
            timeoutMs: 6000, limit: 1, failOnEmpty: false
          })
          if (result.count > 0) {
            report.succeeded += 1
            delete emptyCounts[source.id]
          } else {
            report.empty += 1
            emptyCounts[source.id] = Number(emptyCounts[source.id] || 0) + 1
            if (emptyCounts[source.id] >= 3) {
              writeSourceRuntimeStageResult(source.id, 'search', { status: 'failed', errorCode: 'SEARCH_EMPTY' })
              delete emptyCounts[source.id]
            }
          }
        } catch (error) {
          report.failed += 1
          delete emptyCounts[source.id]
        }
      }
    }))
    report.attemptedSourceIds.forEach(id => sessionAttempted.add(id))
    writeState({
      keywordIndex: (keywordIndex + 1) % KEYWORDS.length,
      checkedAt: Date.now(),
      attempted: Number(stored.attempted || 0) + report.attempted,
      succeeded: Number(stored.succeeded || 0) + report.succeeded,
      failed: Number(stored.failed || 0) + report.failed,
      emptyCounts,
      lastSourceIds: report.attemptedSourceIds.slice(-20)
    })
    return report
  })().finally(() => {
    running = null
    cancelToken = null
  })
  return running
}
