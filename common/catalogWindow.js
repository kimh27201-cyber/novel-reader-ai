const DEFAULT_WINDOW_SIZE = 120
const DEFAULT_WINDOW_STEP = 60

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)))
}

export function buildCatalogMatchIndexes(chapters = [], keyword = '') {
  const query = String(keyword || '').trim().toLowerCase()
  const matches = []
  ;(Array.isArray(chapters) ? chapters : []).forEach((chapter, index) => {
    if (!query || String(chapter && chapter.title || '').toLowerCase().includes(query)) matches.push(index)
  })
  return matches
}

export function createCatalogWindow(matchIndexes = [], currentChapterIndex = 0, options = {}) {
  const size = Math.max(1, Number(options.size || DEFAULT_WINDOW_SIZE))
  const maxStart = Math.max(0, matchIndexes.length - size)
  const currentPosition = matchIndexes.indexOf(Number(currentChapterIndex || 0))
  const anchorOffset = Math.max(0, Number(options.anchorOffset == null ? 20 : options.anchorOffset))
  const start = options.centerCurrent !== false && currentPosition >= 0
    ? clamp(currentPosition - anchorOffset, 0, maxStart)
    : 0
  return { start, size, total: matchIndexes.length }
}

export function shiftCatalogWindow(matchIndexes = [], start = 0, direction = 'next', options = {}) {
  const size = Math.max(1, Number(options.size || DEFAULT_WINDOW_SIZE))
  const step = Math.max(1, Number(options.step || DEFAULT_WINDOW_STEP))
  const maxStart = Math.max(0, matchIndexes.length - size)
  const delta = direction === 'previous' ? -step : step
  return clamp(Number(start || 0) + delta, 0, maxStart)
}

export function catalogWindowStartForScroll(matchIndexes = [], scrollTop = 0, itemHeight = 1, options = {}) {
  const size = Math.max(1, Number(options.size || DEFAULT_WINDOW_SIZE))
  const preload = Math.max(0, Number(options.preload == null ? 20 : options.preload))
  const safeItemHeight = Math.max(1, Number(itemHeight || 1))
  const firstVisiblePosition = Math.max(0, Math.floor(Number(scrollTop || 0) / safeItemHeight))
  return clamp(firstVisiblePosition - preload, 0, Math.max(0, matchIndexes.length - size))
}

export function readCatalogWindow(chapters = [], matchIndexes = [], start = 0, size = DEFAULT_WINDOW_SIZE) {
  const safeChapters = Array.isArray(chapters) ? chapters : []
  const safeStart = clamp(start, 0, Math.max(0, matchIndexes.length))
  return matchIndexes
    .slice(safeStart, safeStart + Math.max(1, Number(size || DEFAULT_WINDOW_SIZE)))
    .map(index => ({ ...(safeChapters[index] || {}), index }))
}

export function getCatalogWindowMetrics(matchIndexes = [], start = 0, size = DEFAULT_WINDOW_SIZE) {
  const safeStart = clamp(start, 0, Math.max(0, matchIndexes.length))
  const visible = Math.min(Math.max(1, Number(size || DEFAULT_WINDOW_SIZE)), Math.max(0, matchIndexes.length - safeStart))
  return {
    before: safeStart,
    visible,
    after: Math.max(0, matchIndexes.length - safeStart - visible),
    total: matchIndexes.length
  }
}

export const CATALOG_WINDOW_SIZE = DEFAULT_WINDOW_SIZE
export const CATALOG_WINDOW_STEP = DEFAULT_WINDOW_STEP
