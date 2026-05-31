import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  getSourceConfig,
  getSourceDiagnostics,
  getSourceConfigs,
  batchTestSources,
  importSourcesWithStats,
  pickOnlineSearchSources,
  searchOnlineBooks,
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

const compatibleSourceTwo = {
  ...compatibleSource,
  bookSourceName: 'Diagnostic Compatible Two',
  bookSourceUrl: 'https://diagnostic-two.example.com',
  searchUrl: 'https://diagnostic-two.example.com/search?q={{key}}'
}

const headerSource = {
  ...compatibleSource,
  bookSourceName: 'Diagnostic Header 3x',
  bookSourceUrl: 'https://header-source.example.com',
  searchUrl: 'https://header-source.example.com/search?q={{key}}',
  enabledCookieJar: true,
  header: JSON.stringify({
    'User-Agent': 'NovelReader Test UA',
    Referer: '{{baseUrl}}/'
  })
}

const incompatibleSource = {
  bookSourceName: 'Diagnostic Unsupported',
  bookSourceUrl: 'https://unsupported.example.com',
  bookSourceGroup: 'Imported',
  searchUrl: 'https://unsupported.example.com/search',
  enabledCookieJar: true,
  header: JSON.stringify({ Cookie: 'sid=required' }),
  loginUrl: 'https://unsupported.example.com/login',
  ruleSearch: '<js>java.ajax()</js>'
}

importSourcesWithStats(JSON.stringify([compatibleSource, compatibleSourceTwo, headerSource, incompatibleSource]))

const sources = pickOnlineSearchSources(Object.values(store['sources:user']))
assert.equal(sources.length, 0)

const unsupported = Object.values(store['sources:user']).find(source => source.name === 'Diagnostic Unsupported')
const diagnostics = getSourceDiagnostics(unsupported)
assert.equal(diagnostics.compatible, false)
assert.equal(diagnostics.searchable, false)
assert.equal(diagnostics.networkStatus, 'incompatible')
assert.deepEqual(diagnostics.ruleSummary.search, false)
assert.ok(diagnostics.reasons.some(reason => reason.includes('JS')))
assert.ok(diagnostics.reasons.some(reason => reason.includes('Cookie')))
assert.ok(diagnostics.reasons.some(reason => reason.includes('登录')))

await assert.rejects(
  () => testSourceSearch(unsupported.id, '星轨图书馆'),
  /不兼容/
)

const compatible = Object.values(store['sources:user']).find(source => source.name === 'Diagnostic Compatible')
const compatibleTwo = Object.values(store['sources:user']).find(source => source.name === 'Diagnostic Compatible Two')
const header3x = Object.values(store['sources:user']).find(source => source.name === 'Diagnostic Header 3x')

const headerDiagnostics = getSourceDiagnostics(header3x)
assert.equal(headerDiagnostics.compatible, true)
assert.deepEqual(headerDiagnostics.reasons, [])

globalThis.fetch = async () => {
  throw new Error('network down')
}

await assert.rejects(
  () => testSourceSearch(compatible.id, '星轨图书馆'),
  /network down/
)
const failed = getSourceDiagnostics(getSourceConfig(compatible.id))
assert.equal(failed.compatible, true)
assert.equal(failed.searchable, false)
assert.equal(failed.networkStatus, 'failed')
assert.equal(failed.statusTitle, '网络测试失败')
assert.match(failed.statusDesc, /发现页会跳过它/)
assert.equal(getSourceConfig(compatible.id).lastTest.status, 'failed')
assert.equal(pickOnlineSearchSources(getSourceConfigs()).some(source => source.id === compatible.id), false)

globalThis.fetch = async () => ({
  text: async () => JSON.stringify({
    items: [
      { name: '星轨图书馆', author: '示例作者', url: '/book/1' }
    ]
  })
})

const result = await testSourceSearch(compatible.id, '星轨图书馆')
assert.equal(result.count, 1)
assert.equal(result.results[0].title, '星轨图书馆')
const passed = getSourceDiagnostics(getSourceConfig(compatible.id))
assert.equal(passed.searchable, true)
assert.equal(passed.networkStatus, 'passed')
assert.equal(passed.statusTitle, '已通过网络测试')
assert.match(passed.statusDesc, /发现页会使用它/)
assert.equal(passed.ruleSummary.search, true)
assert.equal(passed.ruleSummary.toc, true)
assert.equal(passed.ruleSummary.content, true)
assert.equal(getSourceConfig(compatible.id).lastTest.status, 'passed')
assert.equal(pickOnlineSearchSources(getSourceConfigs()).some(source => source.id === compatible.id), true)

let headerRequest = null
globalThis.fetch = async (url, options = {}) => {
  headerRequest = { url: String(url), headers: options.headers || {} }
  return {
    text: async () => JSON.stringify({
      items: [
        { name: 'Header 3x Book', author: 'Header Author', url: '/book/header' }
      ]
    })
  }
}

const headerResult = await testSourceSearch(header3x.id, 'Header 3x')
assert.equal(headerResult.count, 1)
assert.equal(headerRequest.headers['User-Agent'], 'NovelReader Test UA')
assert.equal(headerRequest.headers.Referer, 'https://header-source.example.com/')

let batchRequests = []
globalThis.fetch = async url => {
  batchRequests.push(String(url))
  if (String(url).includes('diagnostic-two')) {
    throw new Error('batch network down')
  }
  return {
    text: async () => JSON.stringify({
      items: [
        { name: '星轨图书馆', author: '示例作者', url: '/book/1' }
      ]
    })
  }
}

const progress = []
const batchResult = await batchTestSources({
  keyword: '星轨图书馆',
  sourceIds: [compatible.id, compatibleTwo.id, unsupported.id],
  onProgress: item => progress.push(item)
})
assert.equal(batchResult.total, 3)
assert.equal(batchResult.tested, 2)
assert.equal(batchResult.passed, 1)
assert.equal(batchResult.failed, 1)
assert.equal(batchResult.skipped, 1)
assert.equal(batchResult.results.find(item => item.sourceId === compatible.id).status, 'passed')
assert.equal(batchResult.results.find(item => item.sourceId === compatibleTwo.id).status, 'failed')
assert.equal(batchResult.results.find(item => item.sourceId === unsupported.id).status, 'skipped')
assert.equal(progress.length, 3)
assert.equal(getSourceConfig(compatibleTwo.id).lastTest.status, 'failed')
assert.equal(pickOnlineSearchSources(getSourceConfigs()).some(source => source.id === compatibleTwo.id), false)

batchRequests = []
const onlineResults = await searchOnlineBooks('星轨图书馆', { limit: 5, timeoutMs: 1000 })
assert.equal(onlineResults.length, 2)
assert.ok(batchRequests.every(url => !url.includes('diagnostic-two')))
assert.ok(batchRequests.some(url => url.includes('header-source')))

const library = readFileSync(new URL('../pages/library/library.vue', import.meta.url), 'utf8')
assert.match(library, /openSourceDetail/)
assert.match(library, /sourceDiagnostics/)
assert.match(library, /runSourceTest/)
assert.match(library, /runBatchSourceTest/)
assert.match(library, /testSourceKeyword/)
assert.match(library, /批量检测/)
assert.match(library, /测试全部启用源/)
assert.match(library, /测试当前分组/)
assert.match(library, /正在测试/)
assert.match(library, /发现页只使用已通过测试的书源/)
assert.match(library, /规则兼容，待网络测试/)
assert.match(library, /网络是否可用以单源测试为准/)
assert.match(library, /规则本身仍兼容/)
assert.match(library, /已通过网络测试/)
assert.match(library, /发现页会跳过它/)
assert.match(library, /规则状态/)
assert.match(library, /搜索/)
assert.match(library, /目录/)
assert.match(library, /正文/)
assert.match(library, /发现页会使用已通过测试的书源/)

console.log('sourceDiagnostics tests passed')
