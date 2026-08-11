const DEFAULT_THEME_ID = 'xuanye'

const THEME_EXPERIENCES = Object.freeze({
  xuanye: Object.freeze({
    id: 'xuanye',
    motionKind: 'precise',
    ease: 'cubic-bezier(0.2, 0, 0, 1)',
    staggerMs: 30,
    ritualKind: 'terminal',
    ritualDurationMs: 460,
    readerTransition: 'scan',
    readerEntryMs: 180,
    layoutFlipMs: 240,
    breatheDurationMs: 5200,
    breatheScale: 1.008
  }),
  candy: Object.freeze({
    id: 'candy',
    motionKind: 'playful',
    ease: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    staggerMs: 55,
    ritualKind: 'sticker',
    ritualDurationMs: 540,
    readerTransition: 'page',
    readerEntryMs: 220,
    layoutFlipMs: 300,
    breatheDurationMs: 5600,
    breatheScale: 1.012
  }),
  sakura: Object.freeze({
    id: 'sakura',
    motionKind: 'gentle',
    ease: 'cubic-bezier(0.22, 0.76, 0.32, 1)',
    staggerMs: 50,
    ritualKind: 'petal',
    ritualDurationMs: 560,
    readerTransition: 'fade',
    readerEntryMs: 220,
    layoutFlipMs: 280,
    breatheDurationMs: 5800,
    breatheScale: 1.007
  }),
  cyber: Object.freeze({
    id: 'cyber',
    motionKind: 'mechanical',
    ease: 'cubic-bezier(0.16, 0.84, 0.28, 1)',
    staggerMs: 30,
    ritualKind: 'grid',
    ritualDurationMs: 430,
    readerTransition: 'scan',
    readerEntryMs: 170,
    layoutFlipMs: 220,
    breatheDurationMs: 5000,
    breatheScale: 1.006
  }),
  noirGold: Object.freeze({
    id: 'noirGold',
    motionKind: 'weighty',
    ease: 'cubic-bezier(0.26, 0.68, 0.34, 1)',
    staggerMs: 50,
    ritualKind: 'hardcover',
    ritualDurationMs: 560,
    readerTransition: 'book',
    readerEntryMs: 220,
    layoutFlipMs: 300,
    breatheDurationMs: 6000,
    breatheScale: 1.006
  })
})

export const V3_THEME_IDS = Object.freeze(Object.keys(THEME_EXPERIENCES))

export function normalizeThemeExperienceId(themeId) {
  return Object.prototype.hasOwnProperty.call(THEME_EXPERIENCES, themeId)
    ? themeId
    : DEFAULT_THEME_ID
}

export function getThemeExperience(themeId = DEFAULT_THEME_ID) {
  return THEME_EXPERIENCES[normalizeThemeExperienceId(themeId)]
}

export function stableBookPhase(bookId, durationMs = 5200) {
  const source = String(bookId || 'book')
  let hash = 0
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0
  }
  const duration = Math.max(1, Number(durationMs) || 5200)
  return -(Math.abs(hash) % duration)
}

export function getShelfEnterDelay(index, total, themeId = DEFAULT_THEME_ID) {
  if (Number(total) > 20) return 0
  const experience = getThemeExperience(themeId)
  return Math.min(Math.max(0, Number(index) || 0) * experience.staggerMs, 350)
}

export function buildReaderRitualUrl(bookId, themeId = DEFAULT_THEME_ID, options = {}) {
  const normalizedThemeId = normalizeThemeExperienceId(themeId)
  const sharedEntry = options.sharedCover ? '&shared=cover' : ''
  return `/pages/reader/reader?bookId=${encodeURIComponent(String(bookId || ''))}&entry=ritual&themeId=${encodeURIComponent(normalizedThemeId)}${sharedEntry}`
}

export function getReaderEntryClass(themeId = DEFAULT_THEME_ID, entry = '') {
  if (entry !== 'ritual') return ''
  return `reader-entry-${getThemeExperience(themeId).readerTransition}`
}
