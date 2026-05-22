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
  getBrightnessOverlayOpacity,
  getBookmarks,
  getPrefs,
  savePrefs,
  splitParagraphs,
  toggleBookmark
} = await import('../common/reader.js')

const prefs = getPrefs()
assert.equal(prefs.readingMode, 'page')
assert.equal(prefs.lineHeight, 1.86)
assert.equal(prefs.paragraphSpacing, 0.8)
assert.equal(prefs.textIndent, 2)
assert.equal(prefs.contentWidth, 82)
assert.equal(prefs.pageTurnMode, 'slide')
assert.equal(prefs.showProgress, true)
assert.equal(prefs.showChapterInfo, true)
assert.equal(prefs.immersiveMode, false)
assert.equal(prefs.autoSyncProgress, true)
assert.equal(getBrightnessOverlayOpacity(100), 0)
assert.equal(getBrightnessOverlayOpacity(86), 0)
assert.ok(getBrightnessOverlayOpacity(52) > 0)
assert.ok(getBrightnessOverlayOpacity(40) <= 0.42)
assert.deepEqual(splitParagraphs('第一段\n\n第二段\n第三段'), ['第一段', '第二段', '第三段'])
assert.deepEqual(splitParagraphs(''), [''])

savePrefs({ fontSize: 99, lineHeight: 4, paragraphSpacing: -1, textIndent: 8, contentWidth: 20, brightness: 5 })
const normalized = getPrefs()
assert.equal(normalized.fontSize, 30)
assert.equal(normalized.lineHeight, 2.4)
assert.equal(normalized.paragraphSpacing, 0)
assert.equal(normalized.textIndent, 4)
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
assert.match(reader, /reader-paragraph/)
assert.match(reader, /paragraphStyle/)
assert.match(reader, /textIndent/)
assert.match(reader, /changeTextIndent/)
assert.match(reader, /toggleReadAloud/)
assert.match(reader, /safe-area-inset-top/)
assert.match(reader, /reader-safe-top/)

console.log('readerExperience tests passed')
