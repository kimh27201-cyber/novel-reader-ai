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
  applyImportPreview,
  buildImportPreview,
  getRecentImportHistory,
  getSourceConfigs,
  normalizeBookSources,
  verifyImportedSourcesVisible
} = await import('../common/bookSources.js')

const source = normalizeBookSources({
  bookSourceName: '速读谷(SUDUGU)',
  bookSourceUrl: 'https://www.sudugu.example',
  bookSourceGroup: 'YCK',
  searchUrl: 'https://www.sudugu.example/search?q={{key}}',
  ruleSearch: { bookList: '.book', name: '.name', bookUrl: 'a@href' },
  ruleBookInfo: { name: 'h1', author: '.author' },
  ruleToc: { chapterList: '.chapter', chapterName: 'a', chapterUrl: 'a@href' },
  ruleContent: { content: '.content' }
}, { source: 'json-url', sourceUrl: 'https://www.yckceo.com/yuedu/shuyuan/json/id/7298.json' })[0]

const preview = buildImportPreview([source], getSourceConfigs(), { importMethod: 'json-url' })
const result = applyImportPreview(preview, { importMethod: 'json-url' })

assert.equal(result.imported, 1)
assert.equal(result.actualWritten, 1)
assert.equal(result.visible, 1)
assert.equal(result.visibleCheck.visible, 1)
assert.equal(result.visibleCheck.items[0].visible, true)
assert.equal(getSourceConfigs().some(item => item.name === '速读谷(SUDUGU)'), true)

const manualVisibleCheck = verifyImportedSourcesVisible(result.importedSources)
assert.equal(manualVisibleCheck.visible, 1)
assert.equal(manualVisibleCheck.items[0].reason, '')

const overwritePreview = buildImportPreview([source], getSourceConfigs(), { importMethod: 'scan' })
const overwriteResult = applyImportPreview(overwritePreview, { importMethod: 'scan' })
assert.equal(overwriteResult.updated, 1)
assert.equal(overwriteResult.actualWritten, 1)

const history = getRecentImportHistory()
assert.equal(history.length, 2)
assert.equal(history[0].name, '速读谷(SUDUGU)')
assert.equal(history[0].action, 'overwritten')
assert.equal(history[0].visible, true)
assert.equal(history[0].importMethod, 'scan')
assert.equal(history[1].action, 'added')
assert.equal(history[1].compatibleLevel, 'compatible')

const unsupported = normalizeBookSources({
  bookSourceName: '动态发现源',
  bookSourceUrl: 'https://dynamic.example',
  exploreUrl: '@js:java.ajax(source.bookSourceUrl)'
}, { source: 'scan' })[0]
const unsupportedResult = applyImportPreview(buildImportPreview([unsupported], getSourceConfigs()), { importMethod: 'scan' })
assert.equal(unsupportedResult.actualWritten, 0)
assert.equal(unsupportedResult.visible, 0)
assert.equal(unsupportedResult.imported, 0)
assert.equal(unsupportedResult.skipped, 1)
assert.equal(getRecentImportHistory()[0].action, 'unsupported')
assert.equal(getRecentImportHistory()[0].visible, false)

console.log('sourceVisibleAfterImport tests passed')
