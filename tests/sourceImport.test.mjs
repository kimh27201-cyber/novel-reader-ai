import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  addOnlineBookToShelf,
  batchSetSourcesEnabled,
  getSourceConfigs,
  getOnlineShelfBooks,
  importSourcesFromAny,
  importSourcesWithStats,
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

const first = importSourcesWithStats(JSON.stringify([source, incompatible]))
assert.equal(first.imported, 2)
assert.equal(first.updated, 0)
assert.equal(first.incompatible, 1)
assert.equal(first.sources.length, 2)

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

const builtIn = getSourceConfigs().find(item => !item.importedAt)
const builtInRawName = builtIn.raw.bookSourceName
updateSourceMetadata(builtIn.id, { name: '展示用内置源', group: '演示分组' })
const renamedBuiltIn = getSourceConfigs().find(item => item.id === builtIn.id)
assert.equal(renamedBuiltIn.name, '展示用内置源')
assert.equal(renamedBuiltIn.group, '演示分组')
assert.equal(renamedBuiltIn.raw.bookSourceName, builtInRawName)

const imported = getSourceConfigs().find(item => item.name === 'Stats Test Source')
updateSourceMetadata(imported.id, { name: '改名书源', group: '测试分组' })
const renamedImported = getSourceConfigs().find(item => item.id === imported.id)
assert.equal(renamedImported.name, '改名书源')
assert.equal(renamedImported.group, '测试分组')

const bulkResult = batchSetSourcesEnabled([builtIn.id, imported.id], false)
assert.equal(bulkResult.updated, 2)
assert.equal(getSourceConfigs().find(item => item.id === builtIn.id).enabled, false)
assert.equal(getSourceConfigs().find(item => item.id === imported.id).enabled, false)

const beforePreviewCount = getSourceConfigs().length
const preview = previewSourcesImport(JSON.stringify([
  source,
  { ...source, bookSourceName: 'Preview New Source', bookSourceUrl: 'https://preview.example.com' },
  incompatible
]))
assert.equal(preview.imported, 1)
assert.equal(preview.updated, 2)
assert.equal(preview.incompatible, 1)
assert.ok(preview.groups.includes('用户导入'))
assert.equal(getSourceConfigs().length, beforePreviewCount)

const cachedBook = addOnlineBookToShelf({
  sourceId: 'source-cache-test',
  sourceName: '缓存测试源',
  bookUrl: 'https://cache.example.com/book/1',
  title: '缓存测试书',
  chapters: [
    { title: '第一章', url: 'https://cache.example.com/c/1', isCached: true },
    { title: '第二章', url: 'https://cache.example.com/c/2', errorMessage: '网络请求失败' }
  ]
})
assert.equal(cachedBook.chapters[0].loadStatus, 'cached')
assert.equal(cachedBook.chapters[0].errorMessage, '')
assert.equal(cachedBook.chapters[1].loadStatus, 'failed')
assert.equal(getOnlineShelfBooks().find(book => book.id === cachedBook.id).chapters[1].errorMessage, '网络请求失败')

const library = readFileSync(new URL('../pages/library/library.vue', import.meta.url), 'utf8')
assert.match(library, /importFromClipboard/)
assert.match(library, /chooseSourceJsonFile/)
assert.match(library, /readImportFilePayload/)
assert.match(library, /normalizeImportPayload/)
assert.match(library, /\/pages\/bookshelf\/bookshelf/)
assert.match(library, /sourceFilter/)
assert.match(library, /sourceImportMode === 'repo'/)
assert.match(library, /sourceFilter === 'cloud'/)
assert.match(library, /sourceSort/)
assert.match(library, /sourceMenuVisible/)
assert.match(library, /openSourceEdit/)
assert.match(library, /saveSourceEdit/)
assert.match(library, /batchToggleVisibleSources/)
assert.match(library, /confirmRemoveSource/)
assert.match(library, /previewSourceImport/)
assert.match(library, /导入前预览/)
assert.match(library, /批量启用当前结果/)
assert.match(library, /批量停用当前结果/)
assert.match(library, /确认删除/)
assert.match(library, /分组统计/)

console.log('sourceImport tests passed')
