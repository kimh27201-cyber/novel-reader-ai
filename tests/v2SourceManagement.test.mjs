import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const libraryPage = readFileSync(new URL('../pages/library/library.vue', import.meta.url), 'utf8')
const sourceExplorePage = readFileSync(new URL('../pages/sourceExplore/sourceExplore.vue', import.meta.url), 'utf8')
const buildScript = readFileSync(new URL('../scripts/build_android_webview_apk.ps1', import.meta.url), 'utf8')

assert.match(libraryPage, /decoder-source-page/)
assert.match(libraryPage, /source-discover-top/)
assert.match(libraryPage, /source-primary-add-button/)
assert.match(libraryPage, /source-filter-sheet/)
assert.match(libraryPage, /scanSourceQr/)
assert.match(libraryPage, /getSourceExploreEntries/)
assert.match(libraryPage, /openSourceExplore/)
assert.match(libraryPage, /source-detail-action/)
assert.match(libraryPage, /class="source-area"[\s\S]*maxlength="-1"/)
assert.match(libraryPage, /class="source-detail-fixed-footer"[\s\S]*v-if="selectedSource\.importedAt"/)
assert.match(libraryPage, /class="source-delete-zone"/)
assert.match(libraryPage, /@tap="confirmRemoveSource\(selectedSource\)"/)
assert.match(libraryPage, /删除此书源/)
assert.match(libraryPage, /button,[\s\S]*\.source-delete-button[\s\S]*justify-content: center/)
assert.doesNotMatch(libraryPage, /category-grid|rank-grid|最新入库/)

assert.match(sourceExplorePage, /loadSourceExploreBooks/)
assert.match(sourceExplorePage, /openEntry/)
assert.match(sourceExplorePage, /saveOnlineBookDraft/)

assert.match(buildScript, /android-v2/)
assert.match(buildScript, /V2\.apk/)
assert.match(buildScript, /novel-reader-update\.keystore/)
assert.match(buildScript, /LegacyUpdateKeystore/)
assert.doesNotMatch(buildScript, /android-webview-v1\.apk/)

console.log('v2SourceManagement tests passed')
