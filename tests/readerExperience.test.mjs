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
  getBookmarks,
  getPrefs,
  savePrefs,
  toggleBookmark
} = await import('../common/reader.js')

const prefs = getPrefs()
assert.equal(prefs.readingMode, 'page')
assert.equal(prefs.lineHeight, 1.86)
assert.equal(prefs.paragraphSpacing, 0.8)
assert.equal(prefs.contentWidth, 82)
assert.equal(prefs.pageTurnMode, 'slide')
assert.equal(prefs.showProgress, true)
assert.equal(prefs.showChapterInfo, true)
assert.equal(prefs.immersiveMode, false)
assert.equal(prefs.autoSyncProgress, true)

savePrefs({ fontSize: 99, lineHeight: 4, paragraphSpacing: -1, contentWidth: 20, brightness: 5 })
const normalized = getPrefs()
assert.equal(normalized.fontSize, 30)
assert.equal(normalized.lineHeight, 2.4)
assert.equal(normalized.paragraphSpacing, 0)
assert.equal(normalized.contentWidth, 62)
assert.equal(normalized.brightness, 40)

const created = toggleBookmark('book-1', {
  chapterIndex: 2,
  pageIndex: 1,
  chapterTitle: '第三章'
})
assert.equal(created.active, true)
assert.equal(getBookmarks('book-1').length, 1)

const removed = toggleBookmark('book-1', {
  chapterIndex: 2,
  pageIndex: 1,
  chapterTitle: '第三章'
})
assert.equal(removed.active, false)
assert.equal(getBookmarks('book-1').length, 0)

const reader = readFileSync(new URL('../pages/reader/reader.vue', import.meta.url), 'utf8')
assert.match(reader, /quick-actions/)
assert.match(reader, /catalog-tabs/)
assert.match(reader, /bookmark-list/)
assert.match(reader, /interface-tabs/)
assert.match(reader, /reader-setting-list/)
assert.match(reader, /toggleReadAloud/)

console.log('readerExperience tests passed')
