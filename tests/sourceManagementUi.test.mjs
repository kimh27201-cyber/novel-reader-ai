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
assert.match(libraryPage, /getRecentImportHistory/)
assert.match(libraryPage, /recent-import/)
assert.match(libraryPage, /最近导入/)
assert.match(libraryPage, /compatibleLevel/)
assert.match(libraryPage, /sourceImportRaw\(\)/)
assert.match(libraryPage, /invalidateSourceImportPreview/)
assert.match(libraryPage, /@tap="goSourceMarket\(\)"/)
assert.match(libraryPage, /typeof url === 'string'/)
assert.match(libraryPage, /Android APK 无需连接电脑后端/)
assert.match(libraryPage, /:disabled="sourceImportPreviewing \|\| sourceImporting \|\| !sourceImportRaw"/)
assert.match(libraryPage, /确认导入/)
assert.match(libraryPage, /v-if="!filterSheetVisible && !importDrawerVisible && !txtVisible && !sourceDetailVisible && !sourceEditVisible"/)
assert.match(libraryPage, /\.submit-button\[disabled\]/)
assert.match(
  libraryPage,
  /--tabbar-reserved-height:\s*140rpx/,
  'source management page should define the reserved tabbar height used by fixed controls'
)
assert.match(
  libraryPage,
  /height:\s*calc\(100vh - 266rpx - var\(--tabbar-reserved-height\) - env\(safe-area-inset-bottom\)\)/,
  'source management scroll area should leave room for the native tabbar'
)
assert.match(
  libraryPage,
  /bottom:\s*calc\(var\(--tabbar-reserved-height\) \+ 28rpx \+ env\(safe-area-inset-bottom\)\)/,
  'source add button should sit above the tabbar and safe area'
)

assert.doesNotMatch(libraryPage, /menu-popover/)
assert.doesNotMatch(libraryPage, /sourceMenuVisible/)
assert.doesNotMatch(libraryPage, /source-select-card/)
assert.doesNotMatch(libraryPage, /sourceSelectLabel/)
assert.doesNotMatch(libraryPage, /source-hero-card/)
assert.doesNotMatch(libraryPage, /source-hero-actions/)

console.log('sourceManagementUi tests passed')
