import assert from 'node:assert/strict'

const store = {}
const events = []
globalThis.uni = {
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
  getMotionPreference,
  getNavigationMotion,
  installNavigationMotion,
  isMotionReduced,
  saveMotionPreference,
  setNavigationMotion
} = await import('../common/motion.js')

assert.equal(getMotionPreference(), 'system')
assert.equal(isMotionReduced('full'), false)
assert.equal(saveMotionPreference('reduced').reduced, true)
assert.equal(getMotionPreference(), 'reduced')
assert.equal(events.at(-1).name, 'app:motion-changed')
assert.equal(saveMotionPreference('invalid').preference, 'system')

setNavigationMotion('tab', 'back')
assert.equal(getNavigationMotion().kind, 'tab')
assert.equal(getNavigationMotion().direction, 'back')
assert.equal(installNavigationMotion(), true)

console.log('motion tests passed')
