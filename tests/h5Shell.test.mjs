import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const reader = readFileSync(new URL('../pages/reader/reader.vue', import.meta.url), 'utf8')
const profile = readFileSync(new URL('../pages/profile/profile.vue', import.meta.url), 'utf8')

assert.match(reader, /class="reader-embed"/)
assert.match(reader, /\.reader-embed\s*\{[\s\S]*position:\s*relative;/)
assert.match(reader, /\.top-chrome\s*\{[\s\S]*position:\s*absolute;/)
assert.match(reader, /\.bottom-chrome,[\s\S]*\.settings-panel[\s\S]*\{[\s\S]*position:\s*absolute;/)
assert.doesNotMatch(reader, /\.top-chrome\s*\{[\s\S]*position:\s*fixed;/)

assert.match(profile, /openSwagger/)
assert.match(profile, /FastAPI 未启动/)
assert.doesNotMatch(profile, /<switch v-if="item\.id === 'web'"/)

console.log('h5Shell tests passed')
