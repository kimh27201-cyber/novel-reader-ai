import assert from 'node:assert/strict'

const body = { style: { overflow: 'auto' } }
globalThis.document = { body }

const {
  acquireOverlayScrollLock,
  getOverlayScrollLockCount,
  releaseOverlayScrollLock
} = await import('../common/overlayScrollLock.js')

assert.equal(acquireOverlayScrollLock(), true)
assert.equal(acquireOverlayScrollLock(), true)
assert.equal(getOverlayScrollLockCount(), 2)
assert.equal(body.style.overflow, 'hidden')

assert.equal(releaseOverlayScrollLock(), true)
assert.equal(getOverlayScrollLockCount(), 1)
assert.equal(body.style.overflow, 'hidden')

assert.equal(releaseOverlayScrollLock(), true)
assert.equal(getOverlayScrollLockCount(), 0)
assert.equal(body.style.overflow, 'auto')
assert.equal(releaseOverlayScrollLock(), false)

delete globalThis.document
assert.equal(acquireOverlayScrollLock(), false)

console.log('overlay scroll lock tests passed')
