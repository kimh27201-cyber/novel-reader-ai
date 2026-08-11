import assert from 'node:assert/strict'

const {
  LAYOUT_FLIP_DURATION,
  captureLayoutRects,
  computeLayoutFlip,
  createLayoutFlipController,
  normalizeLayoutRect
} = await import('../common/layoutFlip.js')

assert.equal(LAYOUT_FLIP_DURATION, 260)
assert.deepEqual(normalizeLayoutRect({ left: 10, top: 20, right: 110, bottom: 220 }), {
  left: 10,
  top: 20,
  width: 100,
  height: 200
})
assert.equal(normalizeLayoutRect({ width: 0, height: 10 }), null)

const flip = computeLayoutFlip(
  { left: 20, top: 100, width: 320, height: 200 },
  { left: 24, top: 70, width: 320, height: 140 }
)
assert.equal(flip.deltaX, -4)
assert.equal(flip.deltaY, 30)
assert.equal(flip.scaleX, 1)
assert.equal(flip.scaleY, 1.429)
assert.equal(flip.changed, true)
assert.match(flip.transform, /translate3d\(-4px, 30px, 0\)/)

function element(key, rect) {
  return {
    getAttribute(name) {
      return name === 'data-book-id' ? key : ''
    },
    getBoundingClientRect() {
      return rect
    }
  }
}

const firstElements = [
  element('book-1', { left: 0, top: 0, width: 300, height: 200 }),
  element('book-2', { left: 0, top: 220, width: 300, height: 200 })
]
const firstRects = captureLayoutRects(firstElements, { keyAttribute: 'data-book-id' })
assert.equal(firstRects.size, 2)

let cancelled = 0
let receivedKeyframes = null
let receivedOptions = null
const pending = new Promise(() => {})
const lastElement = {
  ...element('book-1', { left: 0, top: 0, width: 300, height: 140 }),
  animate(keyframes, options) {
    receivedKeyframes = keyframes
    receivedOptions = options
    return {
      finished: pending,
      cancel() {
        cancelled += 1
      }
    }
  }
}
const controller = createLayoutFlipController({ keyAttribute: 'data-book-id' })
assert.equal(controller.play([lastElement], firstRects, { duration: 300, easing: 'ease-out' }).animated, 1)
assert.match(receivedKeyframes[0].transform, /scale\(1, 1\.429\)/)
assert.equal(receivedOptions.duration, 300)
assert.equal(receivedOptions.easing, 'ease-out')
controller.cancel()
assert.equal(cancelled, 1)
assert.equal(controller.play([lastElement], firstRects, { motionReduced: true }).animated, 0)
controller.destroy()
assert.equal(controller.play([lastElement], firstRects).animated, 0)

console.log('layout FLIP tests passed')
