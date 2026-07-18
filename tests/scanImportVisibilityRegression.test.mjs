import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  applyImportPreview,
  getSourceConfigs,
  previewSourcesFromAny
} from '../common/bookSources.js'
import {
  ALL_SOURCE_GROUP,
  filterLibrarySources,
  normalizeLibrarySources
} from '../common/sourceLibrary.js'

const store = {}
globalThis.uni = {
  getStorageSync(key) {
    return store[key]
  },
  setStorageSync(key, value) {
    store[key] = value
  },
  request(options) {
    const targetUrl = String(options.data && options.data.url || '')
    assert.match(targetUrl, /\/yuedu\/shuyuan\/json\/id\/7514\.json/)
    options.success({
      statusCode: 200,
      data: {
        text: JSON.stringify([{
          bookSourceName: 'Tomato Regression Source',
          bookSourceUrl: 'https://novel.cooks.tw',
          bookSourceGroup: 'Custom Import',
          enabled: true,
          enabledExplore: true,
          exploreUrl: 'https://novel.cooks.tw/explore',
          searchUrl: 'https://novel.cooks.tw/search?q={{key}}',
          ruleSearch: { bookList: '$.items[*]', name: '$.name', bookUrl: '$.url' },
          ruleToc: { chapterList: '$.chapters[*]', chapterName: '$.title', chapterUrl: '$.url' },
          ruleContent: { content: '$.content' }
        }]),
        status_code: 200,
        final_url: targetUrl
      }
    })
  }
}

const importUrl = 'https://www.yckceo.com/yuedu/shuyuan/json/id/7514.json'
const preview = await previewSourcesFromAny(importUrl)
assert.equal(preview.imported, 1)
assert.equal(preview.updated, 0)

const firstResult = applyImportPreview(preview)
assert.equal(firstResult.imported, 1)
assert.equal(firstResult.updated, 0)

const persisted = getSourceConfigs()
assert.equal(persisted.length, 1)
assert.equal(persisted[0].name, 'Tomato Regression Source')
assert.equal(persisted[0].baseUrl, 'https://novel.cooks.tw')
assert.equal(persisted[0].enabled, true)

const visibleAfterOnShow = filterLibrarySources(normalizeLibrarySources(getSourceConfigs()), {
  keyword: '',
  sourceFilter: 'all',
  sourceGroupFilter: ALL_SOURCE_GROUP
})
assert.equal(visibleAfterOnShow.length, 1)
assert.equal(visibleAfterOnShow[0].name, 'Tomato Regression Source')

assert.equal(filterLibrarySources(visibleAfterOnShow, {
  keyword: 'tomato',
  sourceFilter: 'all',
  sourceGroupFilter: ALL_SOURCE_GROUP
}).length, 1)
assert.equal(filterLibrarySources(visibleAfterOnShow, {
  keyword: '',
  sourceFilter: 'enabled',
  sourceGroupFilter: ALL_SOURCE_GROUP
}).length, 1)
assert.equal(filterLibrarySources(visibleAfterOnShow, {
  keyword: '',
  sourceFilter: 'all',
  sourceGroupFilter: 'Custom Import'
}).length, 1)

const secondResult = applyImportPreview(await previewSourcesFromAny(importUrl))
assert.equal(secondResult.imported, 0)
assert.equal(secondResult.updated, 1)
assert.equal(getSourceConfigs().length, 1)
assert.equal(filterLibrarySources(normalizeLibrarySources(getSourceConfigs()), {
  keyword: '',
  sourceFilter: 'all',
  sourceGroupFilter: ALL_SOURCE_GROUP
}).length, getSourceConfigs().length)

const libraryPage = readFileSync(new URL('../pages/library/library.vue', import.meta.url), 'utf8')
assert.match(libraryPage, /refreshInstalledSources/)
assert.match(libraryPage, /normalizeLibrarySources/)
assert.match(libraryPage, /filterLibrarySources/)

const scanPage = readFileSync(new URL('../pages/import/scan.vue', import.meta.url), 'utf8')
assert.match(scanPage, /appliedCount/)
assert.match(scanPage, /未导入有效书源/)

console.log('scanImportVisibilityRegression tests passed')
