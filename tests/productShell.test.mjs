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
assert.match(profile, /theme-grid-inner/)
assert.match(profile, /previewTheme\(theme\.id\)/)
assert.match(profile, /applyTheme\(\)/)
assert.match(profile, /closeThemePanel\(\)/)
assert.match(profile, /applyAppThemeChrome/)
assert.match(profile, /pendingThemeId/)
assert.match(profile, /previewAppTheme/)
assert.match(profile, /themePreviewTimer/)
assert.match(profile, /themePreviewTimer = setTimeout/)
assert.match(profile, /\}, 120\)/)
assert.match(profile, /themeClass\(\)/)
assert.match(profile, /theme-preview-seal/)
assert.match(profile, /`theme-\$\{theme\.id\}`/)
assert.doesNotMatch(profile, /<view class="demo-card">/)
assert.doesNotMatch(profile, /<view class="apk-card">/)
assert.doesNotMatch(profile, /<view class="validation-card">/)

const library = readFileSync(new URL('../pages/library/library.vue', import.meta.url), 'utf8')
assert.match(library, /decoder-source-page/)
assert.match(library, /source-discover-top/)
assert.match(library, /source-filter-sheet/)
assert.match(library, /source-primary-add-button/)
assert.match(library, /scanSourceQr/)
assert.match(library, /importSourcesFromAny/)
assert.match(library, /getSourceExploreEntries/)
assert.match(library, /openSourceHub/)
assert.match(library, /source-detail-action/)
assert.match(library, /runSourceAcceptance/)
assert.match(library, /sourceAcceptanceReport/)
assert.doesNotMatch(library, /category-grid|rank-grid/)
assert.match(library, /toolsExpanded/)
assert.match(library, /source-status-label/)
assert.match(library, /sourceRuleSummary/)
assert.match(library, /batchToggleVisibleSources/)
assert.doesNotMatch(library, /importBackendDemo|后端演示源|云端演示源|visibleBackendSources|backendSources/)

assert.match(library, /drawer-mask app-motion-overlay/)
assert.match(library, /source-import-feedback app-motion-feedback/)
assert.match(library, /app-floating-panel app-motion-sheet/)

const search = readFileSync(new URL('../pages/search/search.vue', import.meta.url), 'utf8')
assert.match(search, /lastSearchSourceNames/)
assert.match(search, /getOnlineExploreEntries/)
assert.match(search, /searchOnlineBooks/)
assert.match(search, /SEARCH_HISTORY_KEY/)
assert.match(search, /history-strip/)
assert.match(search, /search-error-state/)
assert.match(search, /no-result-state/)
assert.match(search, /result-cover-fallback/)
assert.match(search, /searchProgressPercent/)
assert.match(search, /hasSearched/)
assert.match(search, /rememberSearch/)
assert.match(search, /themeClass\(\)/)

const sourceBookPage = readFileSync(new URL('../pages/sourceBook/sourceBook.vue', import.meta.url), 'utf8')
assert.match(sourceBookPage, /chapter-state/)
assert.match(sourceBookPage, /addAndRead/)
assert.match(sourceBookPage, /addOnlineBookToShelf/)
assert.match(sourceBookPage, /ticket-rail/)
assert.match(sourceBookPage, /metric-strip/)
assert.match(sourceBookPage, /status-progress/)
assert.match(sourceBookPage, /catalog-empty/)
assert.match(sourceBookPage, /action-dock/)
assert.match(sourceBookPage, /addedToShelf/)
assert.match(sourceBookPage, /getOnlineShelfBooks/)
assert.match(sourceBookPage, /加入书架并阅读/)

const sourceHubPage = readFileSync(new URL('../pages/sourceHub/sourceHub.vue', import.meta.url), 'utf8')
assert.match(sourceHubPage, /source-hub-page/)
assert.match(sourceHubPage, /buildSourceCapability/)
assert.match(sourceHubPage, /buildCandidateLanes/)

const bookshelf = readFileSync(new URL('../pages/bookshelf/bookshelf.vue', import.meta.url), 'utf8')
assert.match(bookshelf, /shelf-filter-active/)
assert.match(bookshelf, /top-search-button/)
assert.match(bookshelf, /top-more-button/)
assert.match(bookshelf, /moreMenuVisible/)
assert.match(bookshelf, /more-menu-mask/)
assert.match(bookshelf, /@tap="closeMoreMenu"/)
assert.match(bookshelf, /booksRefreshing/)
assert.match(bookshelf, /booksMatch/)
assert.match(bookshelf, /@longpress\.stop="openBookActions\(book\)"/)
assert.match(bookshelf, /book-action-sheet/)
assert.match(bookshelf, /cover-fallback/)
assert.match(bookshelf, /empty-primary-action/)
assert.match(bookshelf, /sheet-close/)
assert.match(bookshelf, /onBackPress\(\)/)
assert.match(bookshelf, /if \(this\.bookActionsVisible\) \{\s*this\.closeBookActions\(\)\s*return true/)
assert.match(bookshelf, /if \(this\.moreMenuVisible\) \{\s*this\.closeMoreMenu\(\)\s*return true/)
assert.match(bookshelf, /book-list\.compact \.book-row/)
assert.match(bookshelf, /-webkit-line-clamp:\s*2/)
assert.match(bookshelf, /--tabbar-reserved-height:\s*140rpx/)
assert.match(
  bookshelf,
  /bottom:\s*calc\(var\(--tabbar-reserved-height\) \+ env\(safe-area-inset-bottom\)\)/,
  'book action sheet should open above the native tabbar'
)
assert.match(bookshelf, /deleteSelectedBook/)
assert.match(bookshelf, /shelf-swipe-row/)
assert.match(bookshelf, /shelf-swipe-delete/)
assert.match(bookshelf, /onBookSwipeStart/)
assert.match(bookshelf, /onBookSwipeMove/)
assert.match(bookshelf, /onBookSwipeEnd/)
assert.match(bookshelf, /SWIPE_DELETE_WIDTH/)
assert.match(bookshelf, /ignoreBookTapUntil/)
assert.match(bookshelf, /themeClass\(\)/)
assert.doesNotMatch(bookshelf, /<view class="tool-grid">/)
assert.doesNotMatch(bookshelf, /goRecent/)
assert.doesNotMatch(bookshelf, /top-icon star/)
assert.match(bookshelf, /book-action-sheet app-motion-sheet/)
assert.match(bookshelf, /delete-confirm-sheet app-motion-dialog/)
assert.match(bookshelf, /delete-dialog-enter/)

assert.match(readme, /adb reverse tcp:8000 tcp:8000/)
assert.match(readme, /http:\/\/127\.0\.0\.1:8000/)

const customTabbar = readFileSync(new URL('../custom-tab-bar/index.vue', import.meta.url), 'utf8')
assert.match(customTabbar, /glass-tabbar-indicator/)
assert.match(customTabbar, /translate3d\(/)
assert.match(customTabbar, /env\(safe-area-inset-bottom\)/)
assert.match(customTabbar, /backdrop-filter/)
assert.match(customTabbar, /prefers-reduced-motion/)
assert.match(customTabbar, /app:theme-changed/)
assert.match(customTabbar, /app:theme-preview/)
assert.match(customTabbar, /tabNavigating/)
assert.match(customTabbar, /beginTabNavigation/)
assert.match(customTabbar, /releaseTabNavigation/)
assert.match(customTabbar, /routeIndex/)
assert.match(customTabbar, /visualIndex/)
assert.match(customTabbar, /pendingTargetIndex/)
assert.match(customTabbar, /scheduleTabCommit/)
assert.match(customTabbar, /commitTabNavigation/)
assert.match(customTabbar, /getTabCommitDelay/)
assert.doesNotMatch(customTabbar, /transition:[^;]*filter/)
assert.match(customTabbar, /will-change: transform/)
assert.match(customTabbar, /themeClass\(\)/)
assert.match(customTabbar, /<image\s+class="glass-tabbar-icon"/)
assert.match(customTabbar, /selectedIconPath/)
assert.match(customTabbar, /onTabSwipeStart/)
assert.match(customTabbar, /tabSwipeOffset/)
assert.match(customTabbar, /setNavigationMotion\('tab'/)
assert.match(customTabbar, /lensScaleX/)
assert.match(customTabbar, /lensPrismIntensity/)
assert.match(customTabbar, /tabSwipeVelocity/)
assert.match(customTabbar, /isQuickFlick/)
assert.match(customTabbar, /lens-dragging-left/)
assert.match(customTabbar, /lens-dragging-right/)
assert.match(customTabbar, /--tab-highlight-x/)
assert.match(profile, /GlassTabBar/)
assert.match(search, /GlassTabBar/)
assert.match(library, /GlassTabBar/)
assert.match(bookshelf, /GlassTabBar/)
assert.match(bookshelf, /refresher-triggered="shelfRefreshing"/)
assert.match(bookshelf, /refreshShelfFromGesture/)
assert.match(bookshelf, /booksRefreshPromise/)
assert.match(bookshelf, /SHELF_REFRESH_MIN_MS = 300/)
assert.match(bookshelf, /SHELF_REFRESH_TIMEOUT_MS = 10000/)
assert.match(bookshelf, /await new Promise\(resolve => this\.\$nextTick\(resolve\)\)/)
assert.match(bookshelf, /this\.shelfRefreshing = false/)
assert.match(search, /refresher-triggered="discoverRefreshing"/)
assert.match(search, /refreshDiscoverFromGesture/)

for (const tabPage of [bookshelf, library, search, profile]) {
  assert.match(tabPage, /class="tab-page-shell"/)
  assert.match(tabPage, /tab-page-content/)
  assert.match(tabPage, /pageMotionDirection/)
}

const reader = readFileSync(new URL('../pages/reader/reader.vue', import.meta.url), 'utf8')
assert.match(reader, /themeClass\(\)/)
assert.match(reader, /:class="themeClass"/)

const app = readFileSync(new URL('../App.vue', import.meta.url), 'utf8')
assert.match(app, /app-motion-feedback/)
assert.match(app, /theme-xuanye-feedback/)
assert.match(app, /theme-candy-feedback/)
assert.match(app, /theme-sakura-feedback/)
assert.match(app, /theme-cyber-feedback/)
assert.match(app, /theme-noir-gold-feedback/)
assert.match(app, /source-import-feedback\.loading/)
assert.match(app, /app-tab-page-enter/)
assert.match(app, /animation: app-tab-page-enter 180ms/)
assert.match(app, /app-tab-enter-forward/)
assert.match(app, /app-tab-enter-back/)
assert.match(app, /animation: app-tab-page-enter-reduced 80ms/)
assert.doesNotMatch(app, /ensureNativeTabBarHidden/)
assert.match(bookshelf, /ensureNativeTabBarHidden\(\)/)
assert.match(library, /ensureNativeTabBarHidden\(\)/)
assert.match(search, /ensureNativeTabBarHidden\(\)/)
assert.match(profile, /ensureNativeTabBarHidden\(\)/)
assert.match(bookshelf, /shouldRefreshTab\('bookshelf'\)/)
assert.match(library, /shouldRefreshTab\('library'\)/)
assert.match(search, /shouldRefreshTab\('search'\)/)
assert.match(profile, /backend\.loading/)

console.log('productShell tests passed')
