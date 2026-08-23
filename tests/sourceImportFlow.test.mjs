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
  analyzeBookSourceCompatibility,
  applyImportPreview,
  buildImportPreview,
  detectImportInputType,
  getSourceConfigs,
  importSourcesFromAny,
  normalizeBookSources,
  previewSourcesImport,
  resolveImportInput
} = await import('../common/bookSources.js')

const baseSource = {
  bookSourceName: 'Flow Source',
  bookSourceUrl: 'https://flow.example.com',
  bookSourceGroup: 'Flow Group',
  bookSourceComment: 'plain css/json source',
  customOrder: 9,
  searchUrl: 'https://flow.example.com/search?q={{key}}',
  ruleSearch: { bookList: '$.items[*]', name: '$.name', bookUrl: '$.url' },
  ruleBookInfo: { name: '$.name', author: '$.author' },
  ruleToc: { chapterList: '$.chapters[*]', chapterName: '$.title', chapterUrl: '$.url' },
  ruleContent: { content: '$.content' }
}

const jsSource = {
  ...baseSource,
  bookSourceName: 'JS Source',
  bookSourceUrl: 'https://js.example.com',
  ruleSearch: '<js>java.ajax(source.searchUrl)</js>'
}

const safeJsSource = {
  ...baseSource,
  bookSourceName: 'Safe JS Source',
  bookSourceUrl: 'https://safe-js.example.com',
  searchUrl: '<js>resolveUrl(key, baseUrl)</js>',
  ruleSearch: { bookList: '$.items[*]', name: '$.name', bookUrl: '$.url' }
}

assert.equal(detectImportInputType(JSON.stringify(baseSource)).type, 'json')
assert.equal(detectImportInputType('yuedu://booksource/import?url=https%3A%2F%2Fcdn.example.com%2Fsources.json').type, 'import-link')
assert.equal(detectImportInputType('https://www.yck2026.top/yuedu/shuyuan/index.html').type, 'repository-list')
assert.equal(detectImportInputType('https://www.yck2026.top/yuedu/shuyuan/content/id/7163.html').type, 'repository-detail')
assert.equal(detectImportInputType('https://cdn.example.com/sources.json').type, 'json-url')
assert.equal(detectImportInputType('not a source').type, 'unknown')

const normalizedSingle = normalizeBookSources(baseSource, { source: 'clipboard' })
assert.equal(normalizedSingle.length, 1)
assert.equal(normalizedSingle[0].name, 'Flow Source')
assert.equal(normalizedSingle[0].sourceMeta.source, 'clipboard')

const firstPreview = buildImportPreview(normalizedSingle, getSourceConfigs())
assert.equal(firstPreview.total, 1)
assert.equal(firstPreview.imported, 1)
assert.equal(firstPreview.updated, 0)
assert.equal(firstPreview.skipped, 0)
assert.equal(firstPreview.failed, 0)
assert.equal(firstPreview.incompatible, 0)
assert.equal(firstPreview.sources[0].action, 'import')
assert.equal(firstPreview.sources[0].name, 'Flow Source')
assert.equal(firstPreview.sources[0].group, 'Flow Group')
assert.equal(firstPreview.sources[0].format, '3.x')
assert.equal(firstPreview.sources[0].source, 'clipboard')
assert.equal(firstPreview.sources[0].weight, 9)
assert.equal(firstPreview.sources[0].comment, 'plain css/json source')
assert.equal(firstPreview.sources[0].compatible, true)

const appliedFirst = applyImportPreview(firstPreview)
assert.equal(appliedFirst.imported, 1)
assert.equal(appliedFirst.updated, 0)
assert.equal(appliedFirst.skipped, 0)
assert.equal(getSourceConfigs().length, 1)

const duplicatePreview = buildImportPreview(
  normalizeBookSources({ ...baseSource, bookSourceGroup: 'Updated Group' }, { source: 'paste' }),
  getSourceConfigs()
)
assert.equal(duplicatePreview.total, 1)
assert.equal(duplicatePreview.imported, 0)
assert.equal(duplicatePreview.updated, 1)
assert.equal(duplicatePreview.sources[0].action, 'overwrite')

const skippedDuplicate = applyImportPreview(duplicatePreview, { duplicateStrategy: 'skip' })
assert.equal(skippedDuplicate.imported, 0)
assert.equal(skippedDuplicate.updated, 0)
assert.equal(skippedDuplicate.skipped, 1)
assert.equal(getSourceConfigs()[0].group, 'Flow Group')

const overwrittenDuplicate = applyImportPreview(duplicatePreview, { duplicateStrategy: 'overwrite' })
assert.equal(overwrittenDuplicate.updated, 1)
assert.equal(getSourceConfigs()[0].group, 'Updated Group')

const mixedPreview = previewSourcesImport(JSON.stringify([baseSource, jsSource]))
assert.equal(mixedPreview.total, 2)
assert.equal(mixedPreview.incompatible, 1)
const jsPreview = mixedPreview.sources.find(item => item.name === 'JS Source')
assert.equal(jsPreview.compatible, false)
assert.ok(jsPreview.reasons.some(reason => /JS|java\.ajax/.test(reason)))

const beforeIncompatibleImportCount = getSourceConfigs().length
const incompatibleOnlyPreview = buildImportPreview(normalizeBookSources(jsSource, { source: 'paste' }), getSourceConfigs())
const incompatibleOnlyResult = applyImportPreview(incompatibleOnlyPreview)
assert.equal(incompatibleOnlyResult.imported, 1)
assert.equal(incompatibleOnlyResult.updated, 0)
assert.equal(incompatibleOnlyResult.skipped, 0)
assert.equal(getSourceConfigs().length, beforeIncompatibleImportCount + 1)
assert.equal(getSourceConfigs().some(source => source.name === 'JS Source' && source.enabled === false), true)

const safeJsPreview = previewSourcesImport(JSON.stringify([safeJsSource]))
assert.equal(safeJsPreview.incompatible, 0)
assert.equal(safeJsPreview.sources[0].compatible, true)

const compatibility = analyzeBookSourceCompatibility(normalizedSingle[0])
assert.deepEqual(compatibility.rules, {
  search: true,
  bookInfo: true,
  toc: true,
  content: true
})
assert.equal(compatibility.features.jsRule, false)
assert.equal(compatibility.requiresCookie, false)
assert.equal(compatibility.requiresLogin, false)
assert.equal(compatibility.requiresWebView, false)

let requestedUrl = ''
const resolved = await resolveImportInput('yuedu://booksource/import?url=https%3A%2F%2Fcdn.example.com%2Fsources.json', {
  fetchText: async url => {
    requestedUrl = url
    return JSON.stringify([{ ...baseSource, bookSourceName: 'URL Flow Source', bookSourceUrl: 'https://url-flow.example.com' }])
  }
})
assert.equal(resolved.type, 'json-url')
assert.equal(requestedUrl, 'https://cdn.example.com/sources.json')
assert.equal(normalizeBookSources(resolved.rawSources, resolved.sourceMeta)[0].name, 'URL Flow Source')

const market = await resolveImportInput('https://www.yck2026.top/yuedu/shuyuan/index.html')
assert.equal(market.type, 'repository-list')
assert.equal(market.action, 'navigate')

const importedAny = await importSourcesFromAny(JSON.stringify([{ ...baseSource, bookSourceUrl: 'https://any-flow.example.com' }]))
assert.equal(importedAny.imported, 1)
assert.equal(importedAny.failed, 0)
assert.equal(importedAny.sources[0].action, 'import')

console.log('sourceImportFlow tests passed')
