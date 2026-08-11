import assert from 'node:assert/strict'

const events = []
globalThis.uni = {
  $emit(name, payload) {
    events.push({ name, payload })
  }
}

const {
  PERFORMANCE_TIERS,
  applyPerformanceProfile,
  detectPerformanceCapabilities,
  getCurrentPerformanceProfile,
  getPerformanceProfile
} = await import('../common/performanceProfile.js')

assert.deepEqual(PERFORMANCE_TIERS, ['full', 'balanced', 'lite'])
assert.equal(getPerformanceProfile({ hardwareConcurrency: 8, deviceMemory: 8 }).tier, 'full')
assert.equal(getPerformanceProfile({ hardwareConcurrency: 4, deviceMemory: 8 }).tier, 'balanced')
assert.equal(getPerformanceProfile({ hardwareConcurrency: 8, deviceMemory: 4 }).tier, 'balanced')
assert.equal(getPerformanceProfile({ hardwareConcurrency: 2, deviceMemory: 8 }).tier, 'lite')
assert.equal(getPerformanceProfile({ hardwareConcurrency: 8, deviceMemory: 2 }).tier, 'lite')
assert.equal(getPerformanceProfile({ benchmarkLevel: 10 }).tier, 'lite')
assert.equal(getPerformanceProfile({ benchmarkLevel: 20 }).tier, 'balanced')
assert.equal(getPerformanceProfile({ benchmarkLevel: 30 }).tier, 'full')
assert.equal(getPerformanceProfile({ hardwareConcurrency: 8, deviceMemory: 8, motionReduced: true }).tier, 'lite')
assert.equal(getPerformanceProfile({ platform: 'android', navigatorRef: {} }).tier, 'balanced')
assert.equal(getPerformanceProfile({ hardwareConcurrency: 0, navigatorRef: { hardwareConcurrency: 2 } }).tier, 'full')
assert.equal(getPerformanceProfile({ hardwareConcurrency: 4 }).features.parallax, false)
assert.equal(getPerformanceProfile({ hardwareConcurrency: 4 }).features.layoutFlip, true)
assert.equal(getPerformanceProfile({ hardwareConcurrency: 2 }).features.stagger, false)

assert.deepEqual(detectPerformanceCapabilities({ deviceMemory: 2048, hardwareConcurrency: 4 }), {
  hardwareConcurrency: 4,
  deviceMemory: 2,
  benchmarkLevel: 0,
  isAndroid: false
})

const attributes = {}
const styles = {}
const rootElement = {
  setAttribute(name, value) {
    attributes[name] = value
  },
  style: {
    setProperty(name, value) {
      styles[name] = value
    }
  }
}
const applied = applyPerformanceProfile({ hardwareConcurrency: 4, deviceMemory: 8, rootElement })
assert.equal(applied.tier, 'balanced')
assert.equal(attributes['data-app-performance'], 'balanced')
assert.equal(styles['--app-performance-stagger-limit'], '12')
assert.equal(events.at(-1).name, 'app:performance-changed')
assert.equal(getCurrentPerformanceProfile().tier, 'balanced')

console.log('performance profile tests passed')
