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
  DEBUG_TAP_THRESHOLD,
  getDebugModeState,
  resetDebugModeTapState,
  setDebugModeEnabled,
  tapDebugModeVersion
} = await import('../common/debugMode.js')

assert.equal(DEBUG_TAP_THRESHOLD, 7)
assert.equal(getDebugModeState().enabled, false)

for (let index = 1; index < DEBUG_TAP_THRESHOLD; index += 1) {
  const state = tapDebugModeVersion()
  assert.equal(state.enabled, false)
  assert.equal(state.remaining, DEBUG_TAP_THRESHOLD - index)
}

const enabled = tapDebugModeVersion()
assert.equal(enabled.enabled, true)
assert.equal(enabled.remaining, 0)
assert.equal(getDebugModeState().enabled, true)

setDebugModeEnabled(false)
assert.equal(getDebugModeState().enabled, false)
resetDebugModeTapState()
assert.equal(getDebugModeState().tapCount, 0)

const pages = JSON.parse(readFileSync(new URL('../pages.json', import.meta.url), 'utf8'))
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
const tabLabels = pages.tabBar.list.map(item => item.text)
assert.deepEqual(tabLabels, ['', '', '', ''])
assert.equal(pages.pages.find(item => item.path === 'pages/library/library').style.navigationBarTitleText, '书源')
assert.deepEqual(
  pages.tabBar.list.map(item => item.pagePath),
  ['pages/bookshelf/bookshelf', 'pages/library/library', 'pages/search/search', 'pages/profile/profile']
)
assert.ok(pages.tabBar.list.every(item => item.iconPath && item.selectedIconPath))
assert.ok(pages.tabBar.list.every(item => item.iconPath.startsWith('static/tabbar/')))
assert.ok(pages.tabBar.list.every(item => item.selectedIconPath.endsWith('-active.png')))
assert.equal(pages.tabBar.selectedColor, '#e25f35')

const profile = readFileSync(new URL('../pages/profile/profile.vue', import.meta.url), 'utf8')
assert.match(profile, /debugModeEnabled/)
assert.match(profile, /onVersionTap/)
assert.doesNotMatch(profile, /<view class="demo-card">/)
assert.doesNotMatch(profile, /<view class="apk-card">/)
assert.doesNotMatch(profile, /<view class="validation-card">/)

const library = readFileSync(new URL('../pages/library/library.vue', import.meta.url), 'utf8')
assert.match(library, /decoder-source-page/)
assert.match(library, /source-discover-top/)
assert.match(library, /source-hero-card/)
assert.match(library, /source-import-scan/)
assert.match(library, /scanSourceQr/)
assert.match(library, /importSourcesFromAny/)
assert.match(library, /getSourceExploreEntries/)
assert.match(library, /openSourceExplore/)
assert.match(library, /source-detail-action/)
assert.doesNotMatch(library, /category-grid|rank-grid/)
assert.match(library, /toolsExpanded/)
assert.match(library, /source-status-label/)
assert.match(library, /sourceRuleSummary/)
assert.match(library, /batchToggleVisibleSources/)
assert.doesNotMatch(library, /importBackendDemo|后端演示源|云端演示源|visibleBackendSources|backendSources/)

const search = readFileSync(new URL('../pages/search/search.vue', import.meta.url), 'utf8')
assert.match(search, /lastSearchSourceNames/)
assert.match(search, /getOnlineExploreEntries/)
assert.match(search, /searchOnlineBooks/)

const sourceBookPage = readFileSync(new URL('../pages/sourceBook/sourceBook.vue', import.meta.url), 'utf8')
assert.match(sourceBookPage, /chapter-state/)
assert.match(sourceBookPage, /addAndRead/)
assert.match(sourceBookPage, /addOnlineBookToShelf/)

const bookshelf = readFileSync(new URL('../pages/bookshelf/bookshelf.vue', import.meta.url), 'utf8')
assert.match(bookshelf, /shelf-filter-active/)
assert.match(bookshelf, /top-search-button/)
assert.match(bookshelf, /top-more-button/)
assert.match(bookshelf, /moreMenuVisible/)
assert.match(bookshelf, /more-menu-mask/)
assert.match(bookshelf, /@tap="closeMoreMenu"/)
assert.match(bookshelf, /if \(!apiClient\.getToken\(\)\) \{\s*this\.books = localBooks\s*return\s*\}/)
assert.doesNotMatch(bookshelf, /this\.books = localBooks\s*if \(!apiClient\.getToken\(\)\)/)
assert.match(bookshelf, /@longpress="openBookActions\(book\)"/)
assert.match(bookshelf, /book-action-sheet/)
assert.match(bookshelf, /deleteSelectedBook/)
assert.doesNotMatch(bookshelf, /<view class="tool-grid">/)
assert.doesNotMatch(bookshelf, /goRecent/)
assert.doesNotMatch(bookshelf, /top-icon star/)

assert.match(readme, /adb reverse tcp:8000 tcp:8000/)
assert.match(readme, /http:\/\/127\.0\.0\.1:8000/)

console.log('productShell tests passed')
