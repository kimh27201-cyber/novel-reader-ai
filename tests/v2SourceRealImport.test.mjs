import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  detectSourceImportPayload,
  extractImportLinkUrl,
  parseSourceJson
} from '../common/sourceEngine.js'
import {
  getSourceConfigs,
  importSourcesFromAny,
  previewSourcesImport
} from '../common/bookSources.js'

const store = {}
globalThis.uni = {
  getStorageSync(key) {
    return store[key]
  },
  setStorageSync(key, value) {
    store[key] = value
  }
}

const legado3Source = {
  bookSourceName: '真实 3.x 书源',
  bookSourceUrl: 'https://real-source.example.com',
  bookSourceGroup: '扫码导入',
  bookSourceType: 0,
  enabledCookieJar: false,
  exploreUrl: '玄幻::/xuanhuan',
  searchUrl: 'https://real-source.example.com/search?q={{key}}',
  ruleSearch: {
    bookList: '$.items[*]',
    name: '$.name',
    bookUrl: '$.url'
  },
  ruleBookInfo: {
    name: '$.name'
  },
  ruleToc: {
    chapterList: '$.chapters[*]',
    chapterName: '$.title',
    chapterUrl: '$.url'
  },
  ruleContent: {
    content: '$.content'
  }
}

assert.deepEqual(getSourceConfigs(), [])

const directJson = JSON.stringify({ sources: [legado3Source] })
const parsed = parseSourceJson(directJson)
assert.equal(parsed[0].formatVersion, '3.x')
assert.equal(previewSourcesImport(directJson).imported, 1)

const importResult = await importSourcesFromAny(directJson)
assert.equal(importResult.imported, 1)
assert.equal(getSourceConfigs().length, 1)
assert.equal(getSourceConfigs()[0].name, '真实 3.x 书源')

const encodedUrl = encodeURIComponent('https://cdn.example.com/sources.json')
assert.equal(
  extractImportLinkUrl(`legado://import/source?src=${encodedUrl}`),
  'https://cdn.example.com/sources.json'
)
assert.equal(
  detectSourceImportPayload(`yuedu://booksource/import?url=${encodedUrl}`).type,
  'import-link'
)

const libraryPage = readFileSync(new URL('../pages/library/library.vue', import.meta.url), 'utf8')
const scanPage = readFileSync(new URL('../pages/import/scan.vue', import.meta.url), 'utf8')
assert.match(libraryPage, /source-hero-card/)
assert.match(libraryPage, /themeVars/)
assert.match(libraryPage, /\/pages\/import\/scan/)
assert.match(scanPage, /target\.type !== 'market'/)
assert.match(scanPage, /\/pages\/sourceMarket\/sourceMarket\?url=/)
assert.doesNotMatch(libraryPage, /target\.type === 'detail' \|\| target\.type === 'json'/)
assert.doesNotMatch(libraryPage, /后端演示源|importBackendDemo|importBackendDemoSource/)
assert.doesNotMatch(libraryPage, /visibleBackendSources|backendSources|backendLoading|sourceFilter === 'cloud'/)

console.log('v2SourceRealImport tests passed')
