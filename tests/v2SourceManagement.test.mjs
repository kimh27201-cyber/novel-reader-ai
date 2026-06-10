import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const libraryPage = readFileSync(new URL('../pages/library/library.vue', import.meta.url), 'utf8')
const buildScript = readFileSync(new URL('../scripts/build_android_webview_apk.ps1', import.meta.url), 'utf8')

assert.match(libraryPage, /decoder-source-page/)
assert.match(libraryPage, /source-discover-top/)
assert.match(libraryPage, /source-select-card/)
assert.match(libraryPage, /category-grid/)
assert.match(libraryPage, /rank-grid/)
assert.match(libraryPage, /source-import-scan/)
assert.match(libraryPage, /scanSourceQr/)
assert.match(libraryPage, /getOnlineExploreEntries/)
assert.match(libraryPage, /exploreOnlineBooks/)
assert.match(libraryPage, /openExploreEntry/)
assert.match(libraryPage, /saveOnlineBookDraft/)
assert.match(libraryPage, /最新入库/)

assert.match(buildScript, /android-v2/)
assert.match(buildScript, /V2\.apk/)
assert.match(buildScript, /novel-reader-update\.keystore/)
assert.match(buildScript, /LegacyUpdateKeystore/)
assert.doesNotMatch(buildScript, /android-webview-v1\.apk/)

console.log('v2SourceManagement tests passed')
