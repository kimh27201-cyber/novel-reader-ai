const DEFAULT_FLIP_DURATION = 260

function finiteNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function rounded(value) {
  const result = Math.round(value * 1000) / 1000
  return Object.is(result, -0) ? 0 : result
}

export function normalizeLayoutRect(input) {
  if (!input) return null
  const left = finiteNumber(input.left)
  const top = finiteNumber(input.top)
  const width = finiteNumber(input.width, finiteNumber(input.right) - left)
  const height = finiteNumber(input.height, finiteNumber(input.bottom) - top)
  if (width <= 0 || height <= 0) return null
  return { left, top, width, height }
}

export function computeLayoutFlip(firstInput, lastInput) {
  const first = normalizeLayoutRect(firstInput)
  const last = normalizeLayoutRect(lastInput)
  if (!first || !last) return null
  const deltaX = rounded(first.left - last.left)
  const deltaY = rounded(first.top - last.top)
  const scaleX = rounded(first.width / last.width)
  const scaleY = rounded(first.height / last.height)
  const changed = Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5 || Math.abs(scaleX - 1) > 0.005 || Math.abs(scaleY - 1) > 0.005
  return {
    deltaX,
    deltaY,
    scaleX,
    scaleY,
    changed,
    transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scaleX}, ${scaleY})`
  }
}

export function captureLayoutRects(elements, options = {}) {
  const attribute = options.keyAttribute || 'data-flip-key'
  const rects = new Map()
  Array.from(elements || []).forEach((element, index) => {
    if (!element || typeof element.getBoundingClientRect !== 'function') return
    const key = typeof element.getAttribute === 'function' ? element.getAttribute(attribute) : String(index)
    const rect = normalizeLayoutRect(element.getBoundingClientRect())
    if (key && rect) rects.set(String(key), rect)
  })
  return rects
}

export function createLayoutFlipController(options = {}) {
  const keyAttribute = options.keyAttribute || 'data-flip-key'
  const animations = new Set()
  let destroyed = false

  function cancel() {
    animations.forEach(animation => {
      try {
        animation.cancel()
      } catch (error) {}
    })
    animations.clear()
  }

  function capture(elements) {
    return captureLayoutRects(elements, { keyAttribute })
  }

  function play(elements, firstRects, state = {}) {
    cancel()
    if (destroyed || state.motionReduced || !(firstRects instanceof Map)) return { animated: 0 }
    const duration = Math.max(160, Math.min(360, finiteNumber(state.duration, DEFAULT_FLIP_DURATION)))
    const easing = String(state.easing || 'cubic-bezier(0.2, 0, 0, 1)')
    let animated = 0
    Array.from(elements || []).forEach((element, index) => {
      if (!element || typeof element.animate !== 'function' || typeof element.getBoundingClientRect !== 'function') return
      const key = typeof element.getAttribute === 'function' ? element.getAttribute(keyAttribute) : String(index)
      const first = firstRects.get(String(key || ''))
      const flip = computeLayoutFlip(first, element.getBoundingClientRect())
      if (!flip || !flip.changed) return
      const animation = element.animate([
        { transformOrigin: 'left top', transform: flip.transform },
        { transformOrigin: 'left top', transform: 'translate3d(0, 0, 0) scale(1, 1)' }
      ], {
        duration,
        easing,
        fill: 'both'
      })
      try {
        animation.id = `layout-flip:${String(key || index)}`
      } catch (error) {}
      animations.add(animation)
      animated += 1
      if (animation.finished && typeof animation.finished.then === 'function') {
        animation.finished.then(() => {
          animations.delete(animation)
          try {
            animation.cancel()
          } catch (error) {}
        }).catch(() => {
          animations.delete(animation)
        })
      }
    })
    return { animated, duration, easing }
  }

  function destroy() {
    cancel()
    destroyed = true
  }

  return { capture, play, cancel, destroy }
}

export const LAYOUT_FLIP_DURATION = DEFAULT_FLIP_DURATION
