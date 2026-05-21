import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  getSourceDiagnostics,
  importSourcesWithStats,
  pickOnlineSearchSources,
  testSourceSearch
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

const compatibleSource = {
  bookSourceName: 'Diagnostic Compatible',
  bookSourceUrl: 'https://diagnostic.example.com',
  searchUrl: 'https://diagnostic.example.com/search?q={{key}}',
  ruleSearch: {
    bookList: '$.items[*]',
    name: '$.name',
    author: '$.author',
    bookUrl: '$.url'
  },
  ruleToc: { chapterList: '$.chapters[*]', chapterName: '$.title', chapterUrl: '$.url' },
  ruleContent: { content: '$.content' }
}

const incompatibleSource = {
  bookSourceName: 'Diagnostic Unsupported',
  bookSourceUrl: 'https://unsupported.example.com',
  bookSourceGroup: 'Imported',
  searchUrl: 'https://unsupported.example.com/search',
  enabledCookieJar: true,
  loginUrl: 'https://unsupported.example.com/login',
  ruleSearch: '<js>java.ajax()</js>'
}

importSourcesWithStats(JSON.stringify([compatibleSource, incompatibleSource]))

const sources = pickOnlineSearchSources(Object.values(store['sources:user']))
assert.equal(sources.length, 1)
assert.equal(sources[0].name, 'Diagnostic Compatible')

const unsupported = Object.values(store['sources:user']).find(source => source.name === 'Diagnostic Unsupported')
const diagnostics = getSourceDiagnostics(unsupported)
assert.equal(diagnostics.compatible, false)
assert.deepEqual(diagnostics.ruleSummary.search, false)
assert.ok(diagnostics.reasons.some(reason => reason.includes('JS')))
assert.ok(diagnostics.reasons.some(reason => reason.includes('Cookie')))
assert.ok(diagnostics.reasons.some(reason => reason.includes('登录')))

await assert.rejects(
  () => testSourceSearch(unsupported.id, '星轨图书馆'),
  /不兼容/
)

globalThis.fetch = async () => ({
  text: async () => JSON.stringify({
    items: [
      { name: '星轨图书馆', author: '示例作者', url: '/book/1' }
    ]
  })
})

const compatible = Object.values(store['sources:user']).find(source => source.name === 'Diagnostic Compatible')
const result = await testSourceSearch(compatible.id, '星轨图书馆')
assert.equal(result.count, 1)
assert.equal(result.results[0].title, '星轨图书馆')

const library = readFileSync(new URL('../pages/library/library.vue', import.meta.url), 'utf8')
assert.match(library, /openSourceDetail/)
assert.match(library, /sourceDiagnostics/)
assert.match(library, /runSourceTest/)
assert.match(library, /testSourceKeyword/)
assert.match(library, /规则兼容，待网络测试/)
assert.match(library, /网络是否可用以单源测试为准/)
assert.match(library, /规则本身仍兼容/)

console.log('sourceDiagnostics tests passed')
