import assert from 'node:assert/strict'

const store = {}
globalThis.uni = {
  getStorageSync(key) {
    return store[key]
  },
  setStorageSync(key, value) {
    store[key] = value
  }
}

const {
  ACCEPTANCE_REPORTS_KEY,
  buildCopyableAcceptanceReport,
  clearSourceAcceptanceReports,
  getSourceAcceptanceReports,
  runSourceAcceptance,
  saveSourceAcceptanceReport
} = await import('../common/sourceAcceptance.js')

function createAdapters(overrides = {}) {
  const source = {
    id: 'source-1',
    name: 'Stable Source',
    enabled: true,
    raw: { exploreUrl: 'Category::https://example.com/list' }
  }
  const book = {
    id: 'book-1',
    sourceId: 'source-1',
    sourceName: 'Stable Source',
    title: 'Book One',
    bookUrl: 'https://example.com/book/1'
  }
  const chapters = [
    { index: 0, title: 'Chapter 1', url: 'https://example.com/book/1/1' }
  ]

  return {
    getSourceConfig: () => source,
    getSourceDiagnostics: () => ({ compatible: true, reasons: [] }),
    getSourceExploreEntries: () => ({
      available: true,
      entries: [{ id: 'entry-1', sourceId: 'source-1', title: 'Category', url: 'https://example.com/list' }],
      reason: ''
    }),
    loadSourceExploreBooks: async () => ({ books: [book], diagnostics: { requestUrl: 'https://example.com/list' } }),
    testSourceSearch: async () => ({ results: [{ type: 'online', book }] }),
    loadOnlineBookInfo: async selected => ({ ...selected, intro: 'intro' }),
    loadOnlineToc: async () => chapters,
    loadOnlineChapter: async () => ({ ...chapters[0], content: 'This is readable chapter content.' }),
    addOnlineBookToShelf: selected => ({ ...selected, chapters }),
    ...overrides
  }
}

const passed = await runSourceAcceptance('source-1', {
  adapters: createAdapters(),
  minChapterChars: 10,
  saveReport: true
})

assert.equal(passed.status, 'passed')
assert.equal(passed.score, 100)
assert.equal(passed.failureStage, '')
assert.ok(passed.stages.every(stage => stage.status === 'passed'))
assert.equal(getSourceAcceptanceReports('source-1').latest.status, 'passed')

const searchFallback = await runSourceAcceptance('source-1', {
  adapters: createAdapters({
    getSourceExploreEntries: () => ({ available: false, entries: [], reason: 'no explore' }),
    loadSourceExploreBooks: async () => { throw new Error('should not load explore') }
  }),
  minChapterChars: 10
})

assert.equal(searchFallback.status, 'passed')
assert.equal(searchFallback.stages.find(stage => stage.key === 'search_fallback').status, 'passed')

const incompatible = await runSourceAcceptance('source-1', {
  adapters: createAdapters({
    getSourceDiagnostics: () => ({ compatible: false, reasons: ['JS rule'] })
  })
})

assert.equal(incompatible.status, 'incompatible')
assert.equal(incompatible.failureStage, 'compatibility')

const chapterFailed = await runSourceAcceptance('source-1', {
  adapters: createAdapters({
    loadOnlineChapter: async () => ({ index: 0, title: 'Chapter 1', content: '' })
  }),
  minChapterChars: 10
})

assert.equal(chapterFailed.status, 'partial')
assert.equal(chapterFailed.failureStage, 'chapter')

for (let index = 0; index < 12; index += 1) {
  saveSourceAcceptanceReport({
    sourceId: 'source-history',
    sourceName: 'History',
    startedAt: index,
    endedAt: index,
    status: 'failed',
    score: index,
    stages: []
  })
}

assert.equal(store[ACCEPTANCE_REPORTS_KEY]['source-history'].history.length, 10)
assert.equal(store[ACCEPTANCE_REPORTS_KEY]['source-history'].latest.score, 11)
assert.equal(clearSourceAcceptanceReports('source-history'), true)
assert.equal(getSourceAcceptanceReports('source-history').latest, null)

const copyable = buildCopyableAcceptanceReport({
  sourceId: 'source-1',
  sourceName: 'Stable Source',
  stages: [{ key: 'chapter', detail: { content: 'x'.repeat(2000), html: '<p>secret</p>', url: 'https://example.com' } }]
})

assert.doesNotMatch(copyable, /secret/)
assert.doesNotMatch(copyable, /x{200}/)
assert.match(copyable, /contentLength/)

console.log('sourceAcceptance tests passed')
