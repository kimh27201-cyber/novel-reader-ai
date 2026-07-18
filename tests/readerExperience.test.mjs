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
  splitChapter,
  splitParagraphs,
  toggleBookmark
} = await import('../common/reader.js')

const prefs = getPrefs()
assert.equal(prefs.readingMode, 'page')
assert.equal(prefs.lineHeight, 1.86)
assert.equal(prefs.paragraphSpacing, 0.8)
assert.equal(prefs.textIndent, 2)
assert.equal(prefs.contentWidth, 88)
assert.equal(prefs.pageTurnMode, 'slide')
assert.equal(prefs.showProgress, false)
assert.equal(prefs.showChapterInfo, false)
assert.equal(prefs.immersiveMode, false)
assert.equal(prefs.autoSyncProgress, true)
assert.equal(getBrightnessOverlayOpacity(100), 0)
assert.equal(getBrightnessOverlayOpacity(86), 0)
assert.ok(getBrightnessOverlayOpacity(52) > 0)
assert.ok(getBrightnessOverlayOpacity(40) <= 0.42)
assert.deepEqual(splitParagraphs('第一段\n\n第二段\n第三段'), ['第一段', '第二段', '第三段'])
assert.deepEqual(splitParagraphs(''), [''])
assert.ok(splitChapter('一'.repeat(520), prefs.fontSize, prefs).length <= 2)

savePrefs({ fontSize: 99, lineHeight: 4, paragraphSpacing: -1, textIndent: 8, contentWidth: 20, brightness: 5 })
const normalized = getPrefs()
assert.equal(normalized.fontSize, 20)
assert.equal(normalized.lineHeight, 1.86)
assert.equal(normalized.paragraphSpacing, 0)
assert.equal(normalized.textIndent, 4)
assert.equal(normalized.contentWidth, 72)
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
assert.match(reader, /reader-progress-mark/)
assert.match(reader, /reader-progress-rail-fill/)
assert.match(reader, /paragraphStyle/)
assert.match(reader, /textIndent/)
assert.match(reader, /appAccent\(\)/)
assert.match(reader, /:activeColor="appAccent"/)
assert.match(reader, /:color="appAccent"/)
assert.doesNotMatch(reader, /activeColor="#/)
assert.doesNotMatch(reader, /color="#7cc1b6"/)
assert.match(reader, /--app-card-radius/)
assert.match(reader, /--app-control-radius/)
assert.doesNotMatch(reader, /class="page-head"/)
assert.doesNotMatch(reader, /class="chapter-meta"/)
assert.doesNotMatch(reader, /class="chapter-title"/)
assert.doesNotMatch(reader, /class="page-foot"/)
assert.doesNotMatch(reader, /\.page-head/)
assert.doesNotMatch(reader, /\.chapter-meta/)
assert.doesNotMatch(reader, /\.chapter-title/)
assert.doesNotMatch(reader, /\.page-foot/)
assert.match(reader, /text-only-reader/)
assert.match(reader, /pageTurnKey/)
assert.match(reader, /playPageTurn/)
assert.match(reader, /clearPageTurnAnimation/)
assert.match(reader, /pageTurnToken/)
assert.match(reader, /pageTurnAnimating/)
assert.match(reader, /page-turn-slide/)
assert.match(reader, /page-turn-cover/)
assert.match(reader, /reader-page-slide-forward/)
assert.match(reader, /reader-page-cover-forward/)
assert.match(reader, /changeTextIndent/)
assert.match(reader, /toggleReadAloud/)
assert.match(reader, /safe-area-inset-top/)
assert.match(reader, /reader-safe-top/)
assert.doesNotMatch(reader, /v-if="controlsVisible"/)
assert.doesNotMatch(reader, /controlsVisible \|\| !prefs\.immersiveMode/)
assert.match(reader, /reader-chrome-visible/)
assert.match(reader, /pointer-events: none/)
assert.match(reader, /Chrome floats above the text/)
assert.match(reader, /touch-hit/)
assert.match(reader, /min-width: 88rpx/)
assert.match(reader, /formatChapterLoadError/)
assert.match(reader, /章节正文解析为空/)
assert.match(reader, /loadStatus: 'failed'/)
assert.match(reader, /errorMessage: this\.chapterLoadError/)
assert.match(reader, /章节解码失败/)
assert.match(reader, /sourceLabel/)
assert.match(reader, /chapterState/)
assert.match(reader, /\{\{ sourceLabel \}\} · \{\{ chapterLoadError \}\}/)
assert.match(reader, /已缓存/)
assert.match(reader, /待解码/)
assert.match(reader, /重新解码本章/)

console.log('readerExperience tests passed')
