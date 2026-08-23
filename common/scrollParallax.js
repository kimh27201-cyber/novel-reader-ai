const DEFAULT_MAX_SCROLL = 180

function finiteNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function rounded(value) {
  const result = Math.round(value * 100) / 100
  return Object.is(result, -0) ? 0 : result
}

function staticFrame() {
  return {
    progress: 0,
    ambientY: 0,
    horizonY: 0,
    markerY: 0,
    depthOpacity: 0.28
  }
}

export function getScrollParallaxFrame(scrollTop, options = {}) {
  if (options.motionReduced || options.active === false) return staticFrame()
  const maxScroll = Math.max(1, finiteNumber(options.maxScroll, DEFAULT_MAX_SCROLL))
  const distance = Math.min(maxScroll, Math.max(0, finiteNumber(scrollTop)))
  const progress = distance / maxScroll
  return {
    progress: rounded(progress),
    ambientY: rounded(-distance * 0.05),
    horizonY: rounded(-distance * 0.1),
    markerY: rounded(distance * 0.07),
    depthOpacity: rounded(0.28 + progress * 0.32)
  }
}

export function createScrollParallaxController(onFrame, options = {}) {
  const windowRef = options.windowRef || (typeof window !== 'undefined' ? window : null)
  const requestFrame = options.requestFrame || (
    windowRef && typeof windowRef.requestAnimationFrame === 'function'
      ? windowRef.requestAnimationFrame.bind(windowRef)
      : callback => setTimeout(callback, 16)
  )
  const cancelFrame = options.cancelFrame || (
    windowRef && typeof windowRef.cancelAnimationFrame === 'function'
      ? windowRef.cancelAnimationFrame.bind(windowRef)
      : frameId => clearTimeout(frameId)
  )
  const emit = typeof onFrame === 'function' ? onFrame : () => {}
  let pendingFrame = null
  let latestScrollTop = 0
  let latestState = {}
  let destroyed = false

  function cancelPending() {
    if (pendingFrame !== null) cancelFrame(pendingFrame)
    pendingFrame = null
  }

  function reset() {
    cancelPending()
    if (!destroyed) emit(staticFrame())
  }

  function update(scrollTop, state = {}) {
    if (destroyed) return false
    latestScrollTop = finiteNumber(scrollTop)
    latestState = state || {}
    if (latestState.motionReduced || latestState.active === false) {
      reset()
      return false
    }
    if (pendingFrame !== null) return true
    pendingFrame = requestFrame(() => {
      pendingFrame = null
      if (destroyed) return
      emit(getScrollParallaxFrame(latestScrollTop, latestState))
    })
    return true
  }

  function destroy() {
    cancelPending()
    destroyed = true
  }

  return { update, reset, destroy }
}

export const SCROLL_PARALLAX_MAX_SCROLL = DEFAULT_MAX_SCROLL
