import assert from 'node:assert/strict'

const {
  SHARED_BOOK_TRANSITION_DURATION,
  captureSharedBookTransition,
  clearSharedBookTransition,
  consumeSharedBookTransition,
  getSharedBookFlightStyle,
  normalizeSharedBookRect,
  peekSharedBookTransition
} = await import('../common/sharedBookTransition.js')

const viewport = { viewportWidth: 393, viewportHeight: 852 }
const rect = { left: 20, top: 140, width: 75, height: 101 }

assert.deepEqual(normalizeSharedBookRect(rect, viewport), { ...rect, viewportWidth: 393, viewportHeight: 852 })
assert.equal(normalizeSharedBookRect({ left: 0, top: 0, width: 4, height: 4 }, viewport), null)

const captured = captureSharedBookTransition(
  { id: 'wind-city', title: '风停在旧城', source: 'local' },
  { currentTarget: { getBoundingClientRect: () => rect } },
  { ...viewport, themeId: 'noirGold', now: 1000 }
)
assert.equal(captured.bookId, 'wind-city')
assert.equal(captured.themeId, 'noirGold')
assert.equal(peekSharedBookTransition('wind-city', { now: 1200 }).title, '风停在旧城')

const style = getSharedBookFlightStyle(captured)
assert.equal(style.left, '20px')
assert.equal(style['--shared-book-duration'], `${SHARED_BOOK_TRANSITION_DURATION}ms`)
assert.ok(Number(style['--shared-book-scale-x']) > 1)

assert.equal(consumeSharedBookTransition('wind-city', { now: 1300 }).bookId, 'wind-city')
assert.equal(consumeSharedBookTransition('wind-city', { now: 1301 }), null)

captureSharedBookTransition({ id: 'book-2' }, rect, { ...viewport, now: 2000 })
assert.equal(peekSharedBookTransition('wrong-book', { now: 2100 }), null)
captureSharedBookTransition({ id: 'book-3' }, rect, { ...viewport, now: 3000 })
assert.equal(peekSharedBookTransition('book-3', { now: 6000 }), null)
assert.equal(captureSharedBookTransition({ id: 'book-4' }, rect, { ...viewport, motionReduced: true }), null)
clearSharedBookTransition()

console.log('shared book transition tests passed')
