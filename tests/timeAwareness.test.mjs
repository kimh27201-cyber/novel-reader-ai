import assert from 'node:assert/strict'

const store = {}
const events = []
const attributes = {}
const styles = {}
const listeners = new Map()
const documentRef = {
  visibilityState: 'visible',
  documentElement: {
    setAttribute(name, value) {
      attributes[name] = value
    },
    style: {
      setProperty(name, value) {
        styles[name] = value
      }
    }
  },
  addEventListener(name, handler) {
    listeners.set(name, handler)
  },
  removeEventListener(name) {
    listeners.delete(name)
  }
}
const uniApi = {
  getStorageSync(key) {
    return store[key]
  },
  setStorageSync(key, value) {
    store[key] = value
  },
  $emit(name, payload) {
    events.push({ name, payload })
  }
}

const {
  TIME_AWARENESS_STORAGE_KEY,
  TIME_SLOT_IDS,
  applyTimeAwareness,
  getTimeAwarenessEnabled,
  getTimeExperience,
  getTimeSlot,
  installTimeAwareness,
  millisecondsUntilNextTimeSlot,
  saveTimeAwarenessEnabled,
  uninstallTimeAwareness
} = await import('../common/timeAwareness.js')

assert.deepEqual(TIME_SLOT_IDS, ['morning', 'day', 'evening', 'night'])
assert.equal(getTimeSlot(new Date('2026-07-31T05:00:00')), 'morning')
assert.equal(getTimeSlot(new Date('2026-07-31T08:59:59')), 'morning')
assert.equal(getTimeSlot(new Date('2026-07-31T09:00:00')), 'day')
assert.equal(getTimeSlot(new Date('2026-07-31T16:59:59')), 'day')
assert.equal(getTimeSlot(new Date('2026-07-31T17:00:00')), 'evening')
assert.equal(getTimeSlot(new Date('2026-07-31T20:00:00')), 'night')
assert.equal(getTimeSlot(new Date('2026-07-31T02:00:00')), 'night')
assert.equal(getTimeExperience(new Date('2026-07-31T22:00:00')).motionScale, 1.2)
assert.equal(millisecondsUntilNextTimeSlot(new Date('2026-07-31T08:30:00')), 30 * 60 * 1000)
assert.equal(millisecondsUntilNextTimeSlot(new Date('2026-07-31T21:30:00')), 7.5 * 60 * 60 * 1000)

assert.equal(getTimeAwarenessEnabled(uniApi), true)
const morning = applyTimeAwareness({ now: new Date('2026-07-31T06:30:00'), documentRef, uniApi })
assert.equal(morning.slot, 'morning')
assert.equal(attributes['data-time-awareness'], 'on')
assert.equal(attributes['data-time-slot'], 'morning')
assert.equal(styles['--app-time-breathe-offset'], '-400ms')
assert.equal(events.at(-1).name, 'app:time-changed')

const disabled = saveTimeAwarenessEnabled(false, { now: new Date('2026-07-31T22:00:00'), documentRef, uniApi })
assert.equal(store[TIME_AWARENESS_STORAGE_KEY], false)
assert.equal(disabled.enabled, false)
assert.equal(disabled.slot, 'day')
assert.equal(attributes['data-time-awareness'], 'off')

let scheduledDelay = 0
const installed = installTimeAwareness({
  now: () => new Date('2026-07-31T18:00:00'),
  documentRef,
  uniApi,
  enabled: true,
  setTimer(handler, delay) {
    scheduledDelay = delay
    return { handler }
  },
  clearTimer() {}
})
assert.equal(installed.slot, 'evening')
assert.equal(scheduledDelay, 2 * 60 * 60 * 1000 + 250)
assert.equal(listeners.has('visibilitychange'), true)
assert.equal(uninstallTimeAwareness(), true)
assert.equal(listeners.has('visibilitychange'), false)

console.log('timeAwareness tests passed')
