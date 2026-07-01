import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const store = {}
globalThis.uni = {
  getStorageSync(key) {
    return store[key]
  },
  setStorageSync(key, value) {
    store[key] = value
  },
  removeStorageSync(key) {
    delete store[key]
  }
}

const {
  DEVICE_VALIDATION_ITEMS,
  getDeviceValidationState,
  getDeviceValidationSummary,
  resetDeviceValidationState,
  toggleDeviceValidationItem
} = await import('../common/deviceValidation.js')

assert.equal(DEVICE_VALIDATION_ITEMS.length, 11)
assert.deepEqual(
  DEVICE_VALIDATION_ITEMS.map(item => item.id),
  [
    'app-launch',
    'backend-url',
    'backend-health',
    'backend-login',
    'import-page',
    'local-import',
    'batch-test',
    'search-flow',
    'reader-controls',
    'ai-actions',
    'ai-history'
  ]
)

const initialState = getDeviceValidationState()
assert.equal(Object.keys(initialState).length, 0)
assert.deepEqual(getDeviceValidationSummary(initialState), {
  total: 11,
  passed: 0,
  remaining: 11,
  complete: false
})

const firstToggle = toggleDeviceValidationItem('backend-health')
assert.equal(firstToggle['backend-health'], true)
assert.equal(getDeviceValidationSummary(firstToggle).passed, 1)

const secondToggle = toggleDeviceValidationItem('backend-health')
assert.equal(secondToggle['backend-health'], undefined)
assert.equal(getDeviceValidationSummary(secondToggle).passed, 0)

toggleDeviceValidationItem('app-launch')
toggleDeviceValidationItem('reader-controls')
assert.equal(getDeviceValidationSummary(getDeviceValidationState()).passed, 2)

const reset = resetDeviceValidationState()
assert.deepEqual(reset, {})
assert.equal(getDeviceValidationSummary(getDeviceValidationState()).remaining, 11)

const profile = readFileSync(new URL('../pages/profile/profile.vue', import.meta.url), 'utf8')
assert.match(profile, /真机验收/)
assert.match(profile, /deviceValidationSummary/)
assert.match(profile, /toggleDeviceValidation/)
assert.match(profile, /resetDeviceValidation/)

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
assert.match(readme, /真机验收清单/)

const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
assert.match(ci, /find tests -maxdepth 1 -name "\*\.test\.mjs"/)

console.log('deviceValidation tests passed')
