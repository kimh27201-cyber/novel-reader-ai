import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../App.vue', import.meta.url), 'utf8')
const shelf = readFileSync(new URL('../pages/bookshelf/bookshelf.vue', import.meta.url), 'utf8')
const profile = readFileSync(new URL('../pages/profile/profile.vue', import.meta.url), 'utf8')

assert.match(app, /applyPerformanceProfile\(\{ motionReduced: motionState\.reduced \}\)/)
assert.match(app, /refreshPerformanceProfile\(\{ motionReduced: isMotionReduced\(\) \}\)/)
assert.match(shelf, /performanceProfile\.features\.breathe/)
assert.match(shelf, /performanceProfile\.features\.parallax/)
assert.match(shelf, /performanceProfile\.features\.layoutFlip/)
assert.match(shelf, /performanceProfile\.features\.stagger/)
assert.match(shelf, /performanceProfile\.staggerLimit/)
assert.match(shelf, /\$on\('app:performance-changed'/)
assert.match(shelf, /\$off\('app:performance-changed'/)
assert.match(profile, /性能适配/)
assert.match(profile, /performanceProfileLabel/)
assert.match(profile, /refreshPerformanceProfile\(\{ motionReduced: state\.reduced \}\)/)

console.log('performance profile UI integration tests passed')
