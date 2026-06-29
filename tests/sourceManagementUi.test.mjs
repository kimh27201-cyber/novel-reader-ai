import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const libraryPage = readFileSync(new URL('../pages/library/library.vue', import.meta.url), 'utf8')

assert.match(libraryPage, /source-filter-sheet/)
assert.match(libraryPage, /filterSheetVisible/)
assert.match(libraryPage, /sort-radio-list/)
assert.match(libraryPage, /enabled-filter-switch/)
assert.match(libraryPage, /source-primary-add-button/)
assert.match(libraryPage, /openFilterSheet/)
assert.match(libraryPage, /closeFilterSheet/)
assert.match(libraryPage, /acceptance-card/)
assert.match(libraryPage, /runSelectedSourceAcceptance/)
assert.match(libraryPage, /copySelectedAcceptanceReport/)

assert.doesNotMatch(libraryPage, /menu-popover/)
assert.doesNotMatch(libraryPage, /sourceMenuVisible/)
assert.doesNotMatch(libraryPage, /source-select-card/)
assert.doesNotMatch(libraryPage, /sourceSelectLabel/)
assert.doesNotMatch(libraryPage, /source-hero-card/)
assert.doesNotMatch(libraryPage, /source-hero-actions/)

console.log('sourceManagementUi tests passed')
