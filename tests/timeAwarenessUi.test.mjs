import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../App.vue', import.meta.url), 'utf8')
const cover = readFileSync(new URL('../components/composite/DBookCover.vue', import.meta.url), 'utf8')
const profile = readFileSync(new URL('../pages/profile/profile.vue', import.meta.url), 'utf8')

assert.match(app, /installTimeAwareness\(\)/)
assert.match(app, /refreshTimeAwareness\(\)/)
assert.match(app, /data-time-awareness='on'/)
assert.match(app, /--app-time-ambient/)
assert.match(cover, /--app-time-breathe-offset/)
assert.match(profile, />时间氛围</)
assert.match(profile, /toggleTimeAwareness/)
assert.match(profile, /saveTimeAwarenessEnabled/)

console.log('time awareness UI integration tests passed')
