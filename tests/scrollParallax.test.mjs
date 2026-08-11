import assert from 'node:assert/strict'

const {
  SCROLL_PARALLAX_MAX_SCROLL,
  createScrollParallaxController,
  getScrollParallaxFrame
} = await import('../common/scrollParallax.js')

assert.equal(SCROLL_PARALLAX_MAX_SCROLL, 180)
assert.deepEqual(getScrollParallaxFrame(0), {
  progress: 0,
  ambientY: 0,
  horizonY: 0,
  markerY: 0,
  depthOpacity: 0.28
})
assert.deepEqual(getScrollParallaxFrame(90), {
  progress: 0.5,
  ambientY: -4.5,
  horizonY: -9,
  markerY: 6.3,
  depthOpacity: 0.44
})
assert.deepEqual(getScrollParallaxFrame(999), {
  progress: 1,
  ambientY: -9,
  horizonY: -18,
  markerY: 12.6,
  depthOpacity: 0.6
})
assert.deepEqual(getScrollParallaxFrame(90, { motionReduced: true }), getScrollParallaxFrame(0))

let queuedFrame = null
let cancelledFrame = null
const frames = []
const controller = createScrollParallaxController(frame => frames.push(frame), {
  requestFrame(callback) {
    queuedFrame = callback
    return 7
  },
  cancelFrame(frameId) {
    cancelledFrame = frameId
  }
})

assert.equal(controller.update(45), true)
assert.equal(controller.update(90), true)
assert.equal(frames.length, 0)
queuedFrame()
assert.equal(frames.at(-1).progress, 0.5)

controller.update(120)
controller.reset()
assert.equal(cancelledFrame, 7)
assert.deepEqual(frames.at(-1), getScrollParallaxFrame(0))
assert.equal(controller.update(90, { motionReduced: true }), false)
assert.deepEqual(frames.at(-1), getScrollParallaxFrame(0))
controller.destroy()
assert.equal(controller.update(90), false)

console.log('scroll parallax tests passed')
