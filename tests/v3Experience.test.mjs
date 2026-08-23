import assert from 'node:assert/strict'

const {
  V3_THEME_IDS,
  buildReaderRitualUrl,
  getReaderEntryClass,
  getShelfEnterDelay,
  getThemeExperience,
  normalizeThemeExperienceId,
  stableBookPhase
} = await import('../common/v3Experience.js')

assert.deepEqual(V3_THEME_IDS, ['xuanye', 'candy', 'sakura', 'cyber', 'noirGold'])
assert.equal(normalizeThemeExperienceId('missing'), 'xuanye')
assert.equal(getThemeExperience('missing').id, 'xuanye')
assert.equal(getThemeExperience('candy').ritualKind, 'sticker')
assert.equal(getThemeExperience('cyber').readerTransition, 'scan')
assert.ok(V3_THEME_IDS.every(id => getThemeExperience(id).staggerMs <= 55))
assert.ok(V3_THEME_IDS.every(id => getThemeExperience(id).ritualDurationMs <= 560))
assert.ok(V3_THEME_IDS.every(id => getThemeExperience(id).layoutFlipMs >= 220 && getThemeExperience(id).layoutFlipMs <= 300))

assert.equal(getShelfEnterDelay(9, 40, 'candy'), 0)
assert.equal(getShelfEnterDelay(9, 20, 'candy'), 350)
assert.equal(getShelfEnterDelay(2, 20, 'xuanye'), 60)

assert.equal(stableBookPhase('book-1', 5000), stableBookPhase('book-1', 5000))
assert.ok(stableBookPhase('book-1', 5000) <= 0)
assert.match(buildReaderRitualUrl('a b/中文', 'sakura'), /bookId=a%20b%2F%E4%B8%AD%E6%96%87/)
assert.match(buildReaderRitualUrl('book', 'missing'), /themeId=xuanye/)
assert.match(buildReaderRitualUrl('book', 'candy', { sharedCover: true }), /shared=cover$/)
assert.equal(getReaderEntryClass('noirGold', 'ritual'), 'reader-entry-book')
assert.equal(getReaderEntryClass('candy', ''), '')

console.log('v3Experience tests passed')
