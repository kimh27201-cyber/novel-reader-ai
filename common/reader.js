const PREF_KEY = 'reader:prefs'
const progressKey = bookId => `reader:progress:${bookId}`
const bookmarkKey = bookId => `reader:bookmarks:${bookId}`

const defaultPrefs = {
  fontSize: 20,
  lineHeight: 1.86,
  paragraphSpacing: 0.8,
  textIndent: 2,
  contentWidth: 82,
  theme: 'eye',
  brightness: 86,
  pageTurnMode: 'slide',
  showProgress: true,
  showChapterInfo: true,
  immersiveMode: false,
  autoSyncProgress: true,
  readingMode: 'page'
}

export const themes = [
  { id: 'eye', name: '护眼夜', background: '#10181a', text: '#dfe8e4', muted: '#8fb1aa' },
  { id: 'cool', name: '清岚', background: '#e9f5f2', text: '#183433', muted: '#6b8c86' },
  { id: 'warm', name: '暖纸', background: '#f7ecd8', text: '#33291f', muted: '#8c765e' },
  { id: 'paper', name: '纸感', background: '#fbf5e8', text: '#2d261f', muted: '#786d61' },
  { id: 'mint', name: '薄荷', background: '#e6f6ea', text: '#193628', muted: '#628a71' }
]

function clampNumber(value, min, max, fallback) {
  const next = Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.max(min, Math.min(max, next))
}

function normalizePrefs(raw) {
  const prefs = { ...defaultPrefs, ...(raw || {}), readingMode: 'page' }
  prefs.fontSize = Math.round(clampNumber(prefs.fontSize, 16, 20, defaultPrefs.fontSize))
  prefs.lineHeight = Number(clampNumber(prefs.lineHeight, 1.45, 1.86, defaultPrefs.lineHeight).toFixed(2))
  prefs.paragraphSpacing = Number(clampNumber(prefs.paragraphSpacing, 0, 2.2, defaultPrefs.paragraphSpacing).toFixed(2))
  prefs.textIndent = Number(clampNumber(prefs.textIndent, 0, 4, defaultPrefs.textIndent).toFixed(1))
  prefs.contentWidth = Math.round(clampNumber(prefs.contentWidth, 62, 96, defaultPrefs.contentWidth))
  prefs.brightness = Math.round(clampNumber(prefs.brightness, 40, 100, defaultPrefs.brightness))
  if (!['slide', 'cover', 'none'].includes(prefs.pageTurnMode)) prefs.pageTurnMode = defaultPrefs.pageTurnMode
  prefs.showProgress = prefs.showProgress !== false
  prefs.showChapterInfo = prefs.showChapterInfo !== false
  prefs.immersiveMode = prefs.immersiveMode === true
  prefs.autoSyncProgress = prefs.autoSyncProgress !== false
  if (!themes.some(theme => theme.id === prefs.theme)) {
    prefs.theme = defaultPrefs.theme
  }
  if (prefs.theme === 'night') prefs.theme = 'eye'
  if (prefs.theme === 'green') prefs.theme = 'cool'
  if (prefs.theme === 'rose') prefs.theme = 'warm'
  return prefs
}

export function getPrefs() {
  return normalizePrefs(uni.getStorageSync(PREF_KEY))
}

export function savePrefs(prefs) {
  const normalized = normalizePrefs(prefs)
  uni.setStorageSync(PREF_KEY, normalized)
  return normalized
}

export function getTheme(themeId) {
  return themes.find(theme => theme.id === themeId) || themes[0]
}

export function getProgress(bookId) {
  return uni.getStorageSync(progressKey(bookId)) || {
    chapterIndex: 0,
    pageIndex: 0,
    scrollTop: 0,
    updatedAt: Date.now()
  }
}

export function saveProgress(bookId, progress) {
  uni.setStorageSync(progressKey(bookId), {
    chapterIndex: progress.chapterIndex || 0,
    pageIndex: progress.pageIndex || 0,
    scrollTop: progress.scrollTop || 0,
    updatedAt: Date.now()
  })
}

export function getBookmarks(bookId) {
  const saved = uni.getStorageSync(bookmarkKey(bookId))
  return Array.isArray(saved) ? saved : []
}

export function toggleBookmark(bookId, bookmark) {
  const chapterIndex = Number(bookmark && bookmark.chapterIndex) || 0
  const pageIndex = Number(bookmark && bookmark.pageIndex) || 0
  const bookmarks = getBookmarks(bookId)
  const existingIndex = bookmarks.findIndex(item => item.chapterIndex === chapterIndex && item.pageIndex === pageIndex)

  if (existingIndex >= 0) {
    bookmarks.splice(existingIndex, 1)
    uni.setStorageSync(bookmarkKey(bookId), bookmarks)
    return { active: false, bookmarks }
  }

  const next = {
    id: `${chapterIndex}:${pageIndex}:${Date.now()}`,
    chapterIndex,
    pageIndex,
    chapterTitle: String((bookmark && bookmark.chapterTitle) || `第 ${chapterIndex + 1} 章`),
    excerpt: String((bookmark && bookmark.excerpt) || '').slice(0, 80),
    createdAt: Date.now()
  }
  const updated = [next, ...bookmarks].slice(0, 80)
  uni.setStorageSync(bookmarkKey(bookId), updated)
  return { active: true, bookmark: next, bookmarks: updated }
}

export function getBrightnessOverlayOpacity(brightness) {
  const value = clampNumber(brightness, 40, 100, defaultPrefs.brightness)
  if (value >= 82) return 0
  return Number(Math.min(0.42, (82 - value) / 100).toFixed(3))
}

export function splitParagraphs(content) {
  const text = String(content || '').trim()
  if (!text) return ['']
  return text
    .split(/\n+/)
    .map(item => item.trim())
    .filter(Boolean)
}

export function splitChapter(content, fontSize, prefs = {}) {
  const normalized = String(content || '').trim()
  const safeFontSize = Math.max(16, Math.min(Number(fontSize) || 20, 20))
  const widthFactor = Math.max(0.68, Math.min(1, (Number(prefs.contentWidth) || defaultPrefs.contentWidth) / 82))
  const lineFactor = Math.max(0.75, Math.min(1.12, defaultPrefs.lineHeight / (Number(prefs.lineHeight) || defaultPrefs.lineHeight)))
  const size = Math.max(110, Math.floor((280 - (safeFontSize - 16) * 32) * widthFactor * lineFactor))
  const pages = []
  let start = 0

  while (start < normalized.length) {
    let end = Math.min(normalized.length, start + size)
    const paragraphBreak = normalized.lastIndexOf('\n', end)
    if (paragraphBreak > start + size * 0.55) {
      end = paragraphBreak
    }
    pages.push(normalized.slice(start, end).trim())
    start = end
  }

  return pages.length ? pages : ['']
}
