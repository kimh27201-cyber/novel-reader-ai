import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  getSourceConfigs,
  importSourcesFromAny,
  importSourcesWithStats
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

const library = readFileSync(new URL('../pages/library/library.vue', import.meta.url), 'utf8')
assert.match(library, /importFromClipboard/)
assert.match(library, /chooseSourceJsonFile/)
assert.match(library, /sourceFilter/)
assert.match(library, /sourceImportMode === 'repo'/)
assert.match(library, /sourceFilter === 'cloud'/)
assert.match(library, /sourceSort/)
assert.match(library, /sourceMenuVisible/)

console.log('sourceImport tests passed')
