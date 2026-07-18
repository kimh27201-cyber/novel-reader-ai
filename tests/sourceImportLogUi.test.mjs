import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

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
  getSourceConfigs,
  importSourcesWithStats,
  normalizeBookSources
} = await import('../common/bookSources.js')
const {
  clearImportLogs,
  getImportLogs
} = await import('../common/sourceImportLog.js')

function validSource(name, url) {
  return {
    bookSourceName: name,
    bookSourceUrl: url,
    bookSourceType: 0,
    enabledExplore: true,
    searchUrl: `${url}/search?q={{key}}`,
    ruleSearch: { bookList: '.book', name: '.name', bookUrl: 'a@href' },
    ruleToc: { chapterList: '.chapter', chapterName: 'a', chapterUrl: 'a@href' },
    ruleContent: { content: '.content' }
  }
}

clearImportLogs()
const batchResult = importSourcesWithStats(JSON.stringify([
  validSource('Log Success', 'https://log-success.example'),
  {
    bookSourceName: 'Missing Url',
    ruleSearch: { bookList: '.book' }
  },
  {
    ...validSource('Partial H5', 'https://partial-h5.example'),
    exploreUrl: '@js:java.ajax(source.bookSourceUrl)',
    ruleExplore: { bookList: '.book' }
  }
]), {
  importMethod: 'json',
  originalType: 'array',
  sourceUrl: 'clipboard'
})

assert.equal(batchResult.actualWritten, 2)
assert.equal(getSourceConfigs().length, 2)

const [log] = getImportLogs()
assert.ok(log)
assert.equal(log.source, 'json')
assert.equal(log.rawType, 'array')
assert.equal(log.sourceText, 'clipboard')
assert.equal(log.total, 3)
assert.equal(log.success, 1)
assert.equal(log.failed, 1)
assert.equal(log.unsupported, 1)
assert.equal(log.items.length, 3)
assert.equal(log.items.find(item => item.name === 'Log Success').status, 'success')
assert.equal(log.items.find(item => item.name === 'Partial H5').status, 'unsupported')
assert.equal(log.items.find(item => item.name === 'Partial H5').h5Unsupported, true)
assert.equal(log.items.find(item => item.name === 'Partial H5').saved, true)
assert.equal(log.items.find(item => item.name === 'Missing Url').status, 'blocked')
assert.match(log.items.find(item => item.name === 'Missing Url').reason, /Missing required fields|bookSourceUrl/)

const duplicatePreview = buildImportPreview(
  normalizeBookSources(validSource('Log Success Again', 'https://log-success.example')),
  getSourceConfigs(),
  { duplicateStrategy: 'skip' }
)
applyImportPreview(duplicatePreview, {
  duplicateStrategy: 'skip',
  importMethod: 'clipboard',
  originalType: 'json'
})
const duplicateLog = getImportLogs()[0]
assert.equal(duplicateLog.duplicated, 1)
assert.equal(duplicateLog.items[0].status, 'duplicated')

const pagesJson = readFileSync(new URL('../pages.json', import.meta.url), 'utf8')
assert.match(pagesJson, /pages\/sources\/import-logs/)

const logPage = readFileSync(new URL('../pages/sources/import-logs.vue', import.meta.url), 'utf8')
assert.match(logPage, /getImportLogs/)
assert.match(logPage, /clearImportLogs/)
assert.match(logPage, /copyFailureReasons/)
assert.match(logPage, /部分不兼容/)

const libraryPage = readFileSync(new URL('../pages/library/library.vue', import.meta.url), 'utf8')
assert.match(libraryPage, /openImportLogs/)
assert.match(libraryPage, /部分不兼容/)
assert.match(libraryPage, /sources:changed/)

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
assert.match(readme, /书源导入日志/)
assert.match(readme, /部分不兼容书源说明/)
assert.match(readme, /不执行第三方书源中的 JS/)

console.log('sourceImportLogUi tests passed')
