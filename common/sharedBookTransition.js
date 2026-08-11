const SHARED_BOOK_TRANSITION_TTL_MS = 2200
const SHARED_BOOK_TRANSITION_DURATION_MS = 360

let pendingTransition = null

function finiteNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function resolveViewport(options = {}) {
  const windowRef = options.windowRef || (typeof window !== 'undefined' ? window : null)
  return {
    width: Math.max(1, finiteNumber(options.viewportWidth, windowRef && windowRef.innerWidth) || 393),
    height: Math.max(1, finiteNumber(options.viewportHeight, windowRef && windowRef.innerHeight) || 852)
  }
}

function resolveRect(input) {
  if (!input) return null
  const candidate = input.currentTarget || input.target || input
  if (candidate && typeof candidate.getBoundingClientRect === 'function') {
    try {
      return candidate.getBoundingClientRect()
    } catch (error) {
      return null
    }
  }
  return candidate && typeof candidate === 'object' ? candidate : null
}

export function normalizeSharedBookRect(input, options = {}) {
  const rect = resolveRect(input)
  if (!rect) return null
  const viewport = resolveViewport(options)
  const left = finiteNumber(rect.left)
  const top = finiteNumber(rect.top)
  const width = finiteNumber(rect.width, finiteNumber(rect.right) - left)
  const height = finiteNumber(rect.height, finiteNumber(rect.bottom) - top)
  if (width < 16 || height < 24 || width > viewport.width * 1.5 || height > viewport.height * 1.5) return null
  if (left > viewport.width || top > viewport.height || left + width < 0 || top + height < 0) return null
  return {
    left,
    top,
    width,
    height,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height
  }
}

export function clearSharedBookTransition() {
  pendingTransition = null
}

export function captureSharedBookTransition(book, input, options = {}) {
  clearSharedBookTransition()
  if (!book || options.motionReduced) return null
  const rect = normalizeSharedBookRect(input, options)
  if (!rect) return null
  const now = finiteNumber(typeof options.now === 'function' ? options.now() : options.now, Date.now())
  pendingTransition = {
    bookId: String(book.id || ''),
    title: String(book.title || ''),
    coverUrl: typeof book.coverUrl === 'string' ? book.coverUrl : '',
    sourceKind: String(book.sourceKind || book.sourceName || book.category || (book.source === 'online' ? '在线' : '本地')),
    themeId: String(options.themeId || 'xuanye'),
    rect,
    createdAt: now
  }
  return pendingTransition
}

export function peekSharedBookTransition(bookId, options = {}) {
  if (!pendingTransition) return null
  const now = finiteNumber(typeof options.now === 'function' ? options.now() : options.now, Date.now())
  const maxAgeMs = Math.max(200, finiteNumber(options.maxAgeMs, SHARED_BOOK_TRANSITION_TTL_MS))
  if (now - pendingTransition.createdAt > maxAgeMs || String(bookId || '') !== pendingTransition.bookId) {
    clearSharedBookTransition()
    return null
  }
  return pendingTransition
}

export function consumeSharedBookTransition(bookId, options = {}) {
  if (options.motionReduced) {
    clearSharedBookTransition()
    return null
  }
  const transition = peekSharedBookTransition(bookId, options)
  pendingTransition = null
  return transition
}

export function getSharedBookFlightStyle(transition, options = {}) {
  if (!transition || !transition.rect) return {}
  const rect = transition.rect
  const viewportWidth = Math.max(1, finiteNumber(options.viewportWidth, rect.viewportWidth || 393))
  const targetWidth = Math.min(132, Math.max(96, viewportWidth * 0.31))
  const targetHeight = targetWidth * (rect.height / rect.width)
  const targetLeft = (viewportWidth - targetWidth) / 2
  const targetTop = Math.max(12, Math.min(24, finiteNumber(options.targetTop, 16)))
  const durationMs = Math.max(160, finiteNumber(options.durationMs, SHARED_BOOK_TRANSITION_DURATION_MS))
  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    '--shared-book-x': `${targetLeft - rect.left}px`,
    '--shared-book-y': `${targetTop - rect.top}px`,
    '--shared-book-scale-x': String(targetWidth / rect.width),
    '--shared-book-scale-y': String(targetHeight / rect.height),
    '--shared-book-duration': `${durationMs}ms`
  }
}

export const SHARED_BOOK_TRANSITION_TTL = SHARED_BOOK_TRANSITION_TTL_MS
export const SHARED_BOOK_TRANSITION_DURATION = SHARED_BOOK_TRANSITION_DURATION_MS
