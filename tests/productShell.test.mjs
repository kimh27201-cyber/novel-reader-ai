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
assert.match(profile, /开发与验收/)
assert.match(profile, /onVersionTap/)
assert.match(profile, /连续点击版本号/)
assert.doesNotMatch(profile, /<view class="demo-card">/)
assert.doesNotMatch(profile, /<view class="apk-card">/)
assert.doesNotMatch(profile, /<view class="validation-card">/)

const library = readFileSync(new URL('../pages/library/library.vue', import.meta.url), 'utf8')
assert.match(library, /<view class="title">书源<\/view>/)
assert.match(library, /添加书源/)
assert.match(library, /管理工具/)
assert.match(library, /toolsExpanded/)
assert.match(library, /source-status-label/)
assert.doesNotMatch(library, /<view class="bulk-actions">/)
assert.doesNotMatch(library, /<view class="batch-panel">/)

const bookshelf = readFileSync(new URL('../pages/bookshelf/bookshelf.vue', import.meta.url), 'utf8')
assert.match(bookshelf, /shelf-filter-active/)
assert.match(bookshelf, /top-search-button/)
assert.match(bookshelf, /top-more-button/)
assert.match(bookshelf, /moreMenuVisible/)
assert.match(bookshelf, /more-menu-mask/)
assert.match(bookshelf, /@tap="closeMoreMenu"/)
assert.match(bookshelf, /@longpress="openBookActions\(book\)"/)
assert.match(bookshelf, /book-action-sheet/)
assert.match(bookshelf, /书籍信息/)
assert.match(bookshelf, /继续阅读/)
assert.match(bookshelf, /查看目录/)
assert.match(bookshelf, /复制书名/)
assert.match(bookshelf, /移出书架/)
assert.match(bookshelf, /deleteSelectedBook/)
assert.match(bookshelf, /更新书架/)
assert.match(bookshelf, /书架统计/)
assert.match(bookshelf, /切换布局/)
assert.match(bookshelf, /导出书单/)
assert.match(bookshelf, /同步云端/)
assert.doesNotMatch(bookshelf, /<view class="tool-grid">/)
assert.doesNotMatch(bookshelf, /发现书源/)
assert.doesNotMatch(bookshelf, /导入 TXT/)
assert.doesNotMatch(bookshelf, /AI 记录/)
assert.doesNotMatch(bookshelf, /后端与设置/)
assert.doesNotMatch(bookshelf, /goRecent/)
assert.doesNotMatch(bookshelf, /top-icon star/)

console.log('productShell tests passed')
