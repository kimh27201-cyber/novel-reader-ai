const PREF_KEY = 'reader:prefs'
const progressKey = bookId => `reader:progress:${bookId}`

const defaultPrefs = {
  fontSize: 20,
  theme: 'eye',
  brightness: 86,
  readingMode: 'page'
}

export const themes = [
  { id: 'eye', name: '护眼夜', background: '#0b0f19', text: '#d7deea', muted: '#7d8aa5' },
  { id: 'cool', name: '冷光', background: '#071b1f', text: '#dbfff8', muted: '#82cfc8' },
  { id: 'warm', name: '暖黑', background: '#17120f', text: '#eadfd0', muted: '#a99883' },
  { id: 'paper', name: '纸感', background: '#f2ead6', text: '#2d261f', muted: '#786d61' }
]

export function getPrefs() {
  const saved = uni.getStorageSync(PREF_KEY)
  const prefs = saved ? { ...defaultPrefs, ...saved, readingMode: 'page' } : { ...defaultPrefs }
  if (!themes.some(theme => theme.id === prefs.theme)) {
    prefs.theme = defaultPrefs.theme
  }
  if (prefs.theme === 'night') prefs.theme = 'eye'
  if (prefs.theme === 'green') prefs.theme = 'cool'
  if (prefs.theme === 'rose') prefs.theme = 'warm'
  return prefs
}

export function savePrefs(prefs) {
  uni.setStorageSync(PREF_KEY, { ...defaultPrefs, ...prefs, readingMode: 'page' })
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

export function splitChapter(content, fontSize) {
  const normalized = String(content || '').trim()
  const safeFontSize = Math.max(16, Math.min(Number(fontSize) || 20, 30))
  const size = Math.max(420, Math.floor(1180 - (safeFontSize - 16) * 42))
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
