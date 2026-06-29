import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pagesConfig = JSON.parse(readFileSync(new URL('../pages.json', import.meta.url), 'utf8'))
assert.ok(pagesConfig.pages.some(page => page.path === 'pages/sourceHub/sourceHub'))

const sourceHub = readFileSync(new URL('../pages/sourceHub/sourceHub.vue', import.meta.url), 'utf8')
assert.match(sourceHub, /getSourceConfig/)
assert.match(sourceHub, /buildSourceCapability/)
assert.match(sourceHub, /getSourceSession/)
assert.match(sourceHub, /buildCandidateLanes/)
assert.match(sourceHub, /openExplore/)
assert.match(sourceHub, /runSearch/)
assert.match(sourceHub, /saveManualSession/)
assert.match(sourceHub, /\/pages\/sourceExplore\/sourceExplore\?sourceId=/)
assert.match(sourceHub, /source-hub-page/)
assert.match(sourceHub, /capability-grid/)
assert.match(sourceHub, /session-panel/)

const library = readFileSync(new URL('../pages/library/library.vue', import.meta.url), 'utf8')
assert.match(library, /openSourceHub/)
assert.match(library, /\/pages\/sourceHub\/sourceHub\?sourceId=/)
assert.doesNotMatch(library, /@tap="openSourceExplore\(source\)"/)

console.log('sourceHub tests passed')
