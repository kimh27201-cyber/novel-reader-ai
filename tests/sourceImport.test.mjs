import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  addOnlineBookToShelf,
  batchSetSourcesEnabled,
  getOnlineShelfBooks,
  getSourceConfigs,
  importSourcesFromAny,
  importSourcesWithStats,
  previewSourcesFromAny,
  previewSourcesImport,
  updateSourceMetadata
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

const source = {
  bookSourceName: 'Stats Test Source',
  bookSourceUrl: 'https://stats.example.com',
  bookSourceGroup: 'User Import',
  searchUrl: 'https://stats.example.com/search?q={{key}}',
  ruleSearch: { bookList: '$.items[*]', name: '$.name', bookUrl: '$.url' },
  ruleToc: { chapterList: '$.chapters[*]', chapterName: '$.title', chapterUrl: '$.url' },
  ruleContent: { content: '$.content' }
}
const incompatible = {
  bookSourceName: 'Unsupported Source',
  bookSourceUrl: 'https://bad.example.com',
  searchUrl: 'https://bad.example.com/search',
  ruleSearch: '<js>java.ajax()</js>'
}

assert.deepEqual(getSourceConfigs(), [])

const first = importSourcesWithStats(JSON.stringify([source, incompatible]))
assert.equal(first.imported, 1)
assert.equal(first.updated, 0)
assert.equal(first.skipped, 1)
assert.equal(first.incompatible, 1)
assert.equal(first.sources.length, 2)
assert.equal(getSourceConfigs().some(item => item.name === 'Unsupported Source'), false)

const second = importSourcesWithStats(JSON.stringify([source]))
assert.equal(second.imported, 0)
assert.equal(second.updated, 1)
assert.equal(getSourceConfigs().filter(item => item.name === 'Stats Test Source').length, 1)

const anyJson = await importSourcesFromAny(JSON.stringify({ sources: [source] }))
assert.equal(anyJson.updated, 1)

globalThis.fetch = async url => ({
  text: async () => url.includes('repo')
    ? '<a href="/sources/stats.json">download</a>'
    : JSON.stringify([source])
})

const anyUrl = await importSourcesFromAny('https://www.yck2026.top/repo/page.html')
assert.equal(anyUrl.updated, 1)

const requestedUrls = []
globalThis.fetch = async url => {
  requestedUrls.push(String(url))
  return {
    text: async () => String(url).includes('/json/id/7274.json')
      ? JSON.stringify([{ ...source, bookSourceUrl: 'https://yck-detail.example.com' }])
      : `
        <a href="/yuedu/shuyuan/index.html">wrong source list</a>
        <input id="jsonurl" value="https://www.yck2026.top/yuedu/shuyuan/json/id/7274.json">
        <pre class="layui-code" id="jsonpre">{ "bookSourceName": "Inline Fallback", "bookSourceUrl": "inline" }</pre>
      `
  }
}

const yckDetail = await importSourcesFromAny('https://www.yck2026.top/yuedu/shuyuan/content/id/7274.html')
assert.equal(yckDetail.imported, 1)
assert.ok(requestedUrls.some(url => url.includes('/json/id/7274.json')))
assert.ok(!requestedUrls.some(url => url.endsWith('/yuedu/shuyuan/index.html')))

const beforeNetworkPreviewCount = getSourceConfigs().length
const proxyRequests = []
globalThis.uni.request = options => {
  proxyRequests.push(options)
  const targetUrl = String(options.data && options.data.url || '')
  options.success({
    statusCode: 200,
    data: {
      text: targetUrl.includes('/repo/page.html')
        ? '<input id="jsonurl" value="https://cdn.example.com/bookSources.json">'
        : JSON.stringify([{ ...source, bookSourceName: 'Network Preview Source', bookSourceUrl: 'https://network-preview.example.com' }]),
      status_code: 200,
      final_url: targetUrl
    }
  })
}
const networkPreview = await previewSourcesFromAny('https://www.yck2026.top/repo/page.html')
assert.equal(networkPreview.imported, 1)
assert.equal(networkPreview.updated, 0)
assert.equal(networkPreview.sources[0].name, 'Network Preview Source')
assert.equal(networkPreview.sourceUrl, 'https://cdn.example.com/bookSources.json')
assert.equal(getSourceConfigs().length, beforeNetworkPreviewCount)
assert.ok(proxyRequests.length >= 2)
assert.ok(proxyRequests.every(call => call.url === 'http://127.0.0.1:8000/api/proxy/fetch'))
delete globalThis.uni.request

const imported = getSourceConfigs().find(item => item.name === 'Stats Test Source')
updateSourceMetadata(imported.id, { name: 'Renamed Source', group: 'Real Import Group' })
const renamedImported = getSourceConfigs().find(item => item.id === imported.id)
assert.equal(renamedImported.name, 'Renamed Source')
assert.equal(renamedImported.group, 'Real Import Group')

const bulkResult = batchSetSourcesEnabled([imported.id], false)
assert.equal(bulkResult.updated, 1)
assert.equal(getSourceConfigs().find(item => item.id === imported.id).enabled, false)

const beforePreviewCount = getSourceConfigs().length
const preview = previewSourcesImport(JSON.stringify([
  source,
  { ...source, bookSourceName: 'Preview New Source', bookSourceUrl: 'https://preview.example.com' },
  incompatible
]))
assert.equal(preview.imported, 1)
assert.equal(preview.updated, 1)
assert.equal(preview.incompatible, 1)
assert.ok(preview.groups.includes('User Import'))
assert.equal(getSourceConfigs().length, beforePreviewCount)

const cachedBook = addOnlineBookToShelf({
  sourceId: 'source-cache-test',
  sourceName: 'Cache Test Source',
  bookUrl: 'https://cache.example.com/book/1',
  title: 'Cache Test Book',
  chapters: [
    { title: 'Chapter 1', url: 'https://cache.example.com/c/1', isCached: true },
    { title: 'Chapter 2', url: 'https://cache.example.com/c/2', errorMessage: 'network failed' }
  ]
})
assert.equal(cachedBook.chapters[0].loadStatus, 'cached')
assert.equal(cachedBook.chapters[0].errorMessage, '')
assert.equal(cachedBook.chapters[1].loadStatus, 'failed')
assert.equal(getOnlineShelfBooks().find(book => book.id === cachedBook.id).chapters[1].errorMessage, 'network failed')

const library = readFileSync(new URL('../pages/library/library.vue', import.meta.url), 'utf8')
assert.match(library, /importFromClipboard/)
assert.match(library, /chooseSourceJsonFile/)
assert.match(library, /readImportFilePayload/)
assert.match(library, /normalizeImportPayload/)
assert.match(library, /\/pages\/bookshelf\/bookshelf/)
assert.match(library, /sourceFilter/)
assert.match(library, /sourceImportMode === 'repo'/)
assert.match(library, /sourceSort/)
assert.match(library, /filterSheetVisible/)
assert.match(library, /openSourceEdit/)
assert.match(library, /saveSourceEdit/)
assert.match(library, /batchToggleVisibleSources/)
assert.match(library, /confirmRemoveSource/)
assert.match(library, /previewSourcesFromAny/)
assert.match(library, /sourceImportPreviewing/)
assert.match(library, /previewSourceImport/)
assert.match(library, /source-primary-add-button/)
assert.doesNotMatch(library, /importBackendDemo|后端演示源|sourceFilter === 'cloud'|visibleBackendSources/)

console.log('sourceImport tests passed')
