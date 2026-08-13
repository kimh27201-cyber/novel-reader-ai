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
  exploreOnlineBooks,
  getOnlineExploreEntries,
  getSourceExploreEntries,
  getSourceConfigs,
  importSourcesFromAny,
  loadSourceExploreBooks,
  parseSourceExploreUrl,
  searchSourceBooks,
  setSourceEnabled
} = await import('../common/bookSources.js')

const sourceJson = JSON.stringify([{
  bookSourceName: 'Explore Source',
  bookSourceUrl: 'https://explore.example.com',
  bookSourceGroup: 'Explore Group',
  exploreUrl: [
    'Latest::https://explore.example.com/latest',
    'Rank::https://explore.example.com/rank',
    'Fantasy::https://explore.example.com/category/fantasy'
  ].join('\\n'),
  ruleExplore: {
    bookList: '$.items[*]',
    name: '$.name',
    author: '$.author',
    latestChapter: '$.latest',
    bookUrl: '$.url',
    kind: '$.kind'
  },
  ruleToc: { chapterList: '$.chapters[*]', chapterName: '$.title', chapterUrl: '$.url' },
  ruleContent: { content: '$.content' }
}])

await importSourcesFromAny(sourceJson)

await importSourcesFromAny(JSON.stringify([{
  bookSourceName: 'Other Explore Source',
  bookSourceUrl: 'https://other.example.com',
  exploreUrl: 'Other::https://other.example.com/list',
  ruleExplore: {
    bookList: '$.items[*]',
    name: '$.name',
    bookUrl: '$.url'
  }
}, {
  bookSourceName: 'Unsafe Explore Source',
  bookSourceUrl: 'https://unsafe.example.com',
  exploreUrl: 'Script::javascript:alert(1)'
}, {
  bookSourceName: 'Explore With Login Elsewhere',
  bookSourceUrl: 'https://partial.example.com',
  loginUrl: 'https://partial.example.com/login',
  exploreUrl: 'Public::/public?page={{page}}',
  ruleExplore: {
    bookList: '$.items[*]',
    name: '$.name',
    bookUrl: '$.url'
  }
}]))

const source = getSourceConfigs().find(item => item.name === 'Explore Source')
const entries = getOnlineExploreEntries({ sources: [source] })

assert.equal(entries.length, 3)
assert.deepEqual(entries.map(entry => entry.title), ['Latest', 'Rank', 'Fantasy'])
assert.deepEqual(entries.map(entry => entry.kind), ['latest', 'rank', 'category'])
assert.equal(entries[0].sourceId, source.id)
assert.equal(entries[0].sourceName, 'Explore Source')

const parsedEntries = parseSourceExploreUrl(source)
assert.equal(parsedEntries.length, 3)
assert.equal(parsedEntries[0].url, 'https://explore.example.com/latest')

const sourceEntries = getSourceExploreEntries(source.id)
assert.equal(sourceEntries.available, true)
assert.equal(sourceEntries.entries.length, 3)
assert.ok(sourceEntries.entries.every(entry => entry.sourceId === source.id))
assert.deepEqual(sourceEntries.groups.map(group => group.name), ['发现入口'])

const unsafeSource = getSourceConfigs().find(item => item.name === 'Unsafe Explore Source')
const unsafeEntries = getSourceExploreEntries(unsafeSource.id)
assert.equal(unsafeEntries.available, false)
assert.equal(unsafeEntries.entries.length, 0)
assert.match(unsafeEntries.reason, /未提供可浏览分类/)

setSourceEnabled(source.id, false)
const disabledEntries = getSourceExploreEntries(source.id)
assert.equal(disabledEntries.available, false)
assert.match(disabledEntries.reason, /先启用/)
setSourceEnabled(source.id, true)

const templated = parseSourceExploreUrl({
  id: 'templated-source',
  name: 'Templated Source',
  baseUrl: 'https://template.example.com',
  raw: {
    exploreUrl: '分页::/list?page={{page}}'
  }
})
assert.equal(templated[0].url, 'https://template.example.com/list?page={{page}}')
assert.equal(templated[0].paginated, true)

const jsonEntries = parseSourceExploreUrl({
  id: 'json-explore-source',
  name: 'JSON Explore Source',
  baseUrl: 'https://json.example.com',
  raw: {
    exploreUrl: JSON.stringify([
      { group: '榜单', title: '热榜', url: '/hot?page={{page}}' },
      { group: '分类', title: '完结', url: '/finished' }
    ])
  }
})
assert.equal(jsonEntries.length, 2)
assert.equal(jsonEntries[0].group, '榜单')
assert.equal(jsonEntries[0].title, '热榜')

const mixedFormatEntries = parseSourceExploreUrl({
  id: 'mixed-format-source',
  name: 'Mixed Format Source',
  baseUrl: 'https://mixed.example.com/root/',
  raw: {
    exploreUrl: [
      'Comma,/comma',
      'Pipe|relative/pipe',
      'Arrow=>/arrow',
      'Group::Title::/group::note'
    ].join('\n')
  }
})
assert.equal(mixedFormatEntries.length, 4)
assert.deepEqual(mixedFormatEntries.map(entry => entry.title), ['Comma', 'Pipe', 'Arrow', 'Title'])
assert.equal(mixedFormatEntries[0].url, 'https://mixed.example.com/comma')
assert.equal(mixedFormatEntries[1].url, 'https://mixed.example.com/root/relative/pipe')
assert.equal(mixedFormatEntries[2].url, 'https://mixed.example.com/arrow')
assert.equal(mixedFormatEntries[3].group, 'Group')
assert.equal(mixedFormatEntries[3].url, 'https://mixed.example.com/group')

const groupedJsonEntries = parseSourceExploreUrl({
  id: 'grouped-json-source',
  name: 'Grouped JSON Source',
  baseUrl: 'https://grouped.example.com',
  raw: {
    exploreUrl: JSON.stringify({
      Category: [
        { title: 'Fantasy', url: '/fantasy' },
        { name: 'Urban', url: 'urban' }
      ],
      Rank: [
        { title: 'Hot', url: '/rank/hot' }
      ]
    })
  }
})
assert.equal(groupedJsonEntries.length, 3)
assert.deepEqual(groupedJsonEntries.map(entry => entry.group), ['Category', 'Category', 'Rank'])
assert.equal(groupedJsonEntries[1].url, 'https://grouped.example.com/urban')

const unsafeProtocolEntries = parseSourceExploreUrl({
  id: 'unsafe-protocol-source',
  name: 'Unsafe Protocol Source',
  baseUrl: 'https://unsafe-protocol.example.com',
  raw: {
    exploreUrl: [
      'JS::javascript:alert(1)',
      'Data::data:text/html,abc',
      'File::file:///etc/passwd'
    ].join('\n')
  }
})
assert.equal(unsafeProtocolEntries.length, 0)

const paginationEntries = parseSourceExploreUrl({
  id: 'pagination-source',
  name: 'Pagination Source',
  baseUrl: 'https://page.example.com',
  raw: {
    exploreUrl: [
      'Mustache::/list?page={{page}}',
      'Next::/list?page={{page+1}}',
      'Brace::/list/{page}/',
      'Dollar::/list/$page/',
      'Percent::/list/%page%/'
    ].join('\n')
  }
})
assert.equal(paginationEntries.length, 5)
assert.ok(paginationEntries.every(entry => entry.paginated))

const complexSource = {
  id: 'complex-template-source',
  name: 'Complex Template Source',
  baseUrl: 'https://complex.example.com',
  enabled: true,
  raw: {
    exploreUrl: "分类::/list/index{{page > 1 ? `_${page}` : ''}}.html",
    ruleExplore: { bookList: '$.items[*]', name: '$.name', bookUrl: '$.url' }
  }
}
const complexEntries = getSourceExploreEntries(complexSource)
assert.equal(complexEntries.available, false)
assert.equal(complexEntries.reasonCode, 'complex_explore_rule')
assert.match(complexEntries.reason, /复杂.*模板/)

let requestedUrl = ''
await importSourcesFromAny(JSON.stringify([{
  bookSourceName: 'Search Fallback Source',
  bookSourceUrl: 'https://fallback.example.com',
  exploreUrl: 'WebView::https://fallback.example.com/webview',
  searchUrl: 'https://fallback.example.com/search?keyword={{key}}',
  ruleSearch: {
    bookList: '$.items[*]',
    name: '$.name',
    author: '$.author',
    bookUrl: '$.url'
  },
  ruleBookInfo: { name: '$.name' },
  ruleToc: { chapterList: '$.chapters[*]', chapterName: '$.title', chapterUrl: '$.url' },
  ruleContent: { content: '$.content' }
}]))
const fallbackSource = getSourceConfigs().find(item => item.name === 'Search Fallback Source')
const fallbackExplore = getSourceExploreEntries(fallbackSource.id)
assert.equal(fallbackExplore.available, false)
assert.equal(fallbackExplore.reasonCode, 'complex_explore_rule')

globalThis.uni.request = options => {
  requestedUrl = String(options.data && options.data.url || '')
  options.success({
    statusCode: 200,
    data: {
      text: JSON.stringify({
        items: [
          {
            name: 'Fallback Book',
            author: 'Fallback Author',
            url: '/book/fallback'
          }
        ]
      }),
      status_code: 200,
      final_url: requestedUrl
    }
  })
}
const fallbackSearch = await searchSourceBooks(fallbackSource.id, 'fallback', { timeoutMs: 1000 })
assert.equal(requestedUrl, 'https://fallback.example.com/search?keyword=fallback')
assert.equal(fallbackSearch.count, 1)
assert.equal(fallbackSearch.results[0].book.title, 'Fallback Book')
assert.equal(store['sources:settings'][fallbackSource.id].runtimeV2.search.status, 'passed')
assert.equal(store['sources:settings'][fallbackSource.id].runtimeV2.search.resultCount, 1)

globalThis.uni.request = options => {
  requestedUrl = String(options.data && options.data.url || '')
  options.success({
    statusCode: 200,
    data: {
      text: JSON.stringify({
      items: [
        {
          name: 'Explore Book',
          author: 'Explore Author',
          latest: 'Chapter 20',
          url: '/book/explore',
          kind: 'Fantasy'
        }
      ]
      }),
      status_code: 200,
      final_url: requestedUrl
    }
  })
}

const books = await exploreOnlineBooks(entries[2], { timeoutMs: 1000 })
assert.equal(requestedUrl, 'https://explore.example.com/category/fantasy')
assert.equal(books.length, 1)
assert.equal(books[0].type, 'online')
assert.equal(books[0].title, 'Explore Book')
assert.equal(books[0].sourceName, 'Explore Source')
assert.equal(books[0].book.bookUrl, 'https://explore.example.com/book/explore')
assert.equal(books[0].book.kind, 'Fantasy')
assert.equal(getSourceConfigs().find(item => item.id === source.id).exploreTest.status, 'passed')

const loaded = await loadSourceExploreBooks(source.id, parsedEntries[2], { page: 1, timeoutMs: 1000 })
assert.equal(loaded.sourceId, source.id)
assert.equal(loaded.entryTitle, 'Fantasy')
assert.equal(loaded.page, 1)
assert.equal(loaded.hasMore, false)
assert.equal(loaded.books.length, 1)
assert.equal(loaded.books[0].origin, 'explore')

globalThis.uni.request = options => {
  options.fail({ errMsg: 'Unable to resolve host "explore.example.com": No address associated with hostname' })
}
await assert.rejects(
  exploreOnlineBooks(entries[2], { timeoutMs: 1000 }),
  error => error && error.code === 'SITE_UNREACHABLE'
)
const failedExploreSource = getSourceConfigs().find(item => item.id === source.id)
assert.equal(failedExploreSource.exploreTest.status, 'failed')
assert.equal(failedExploreSource.exploreTest.errorCode, 'SITE_UNREACHABLE')
assert.equal(getOnlineExploreEntries({ sources: [failedExploreSource] }).length, 0)

globalThis.uni.request = options => {
  requestedUrl = String(options.data && options.data.url || '')
  options.success({
    statusCode: 200,
    data: {
      text: JSON.stringify({ items: [{ name: 'Explore Book', url: '/book/explore' }] }),
      status_code: 200,
      final_url: requestedUrl
    }
  })
}
await exploreOnlineBooks(entries[2], { timeoutMs: 1000 })
const recoveredExploreSource = getSourceConfigs().find(item => item.id === source.id)
assert.equal(recoveredExploreSource.exploreTest.status, 'passed')
assert.equal(getOnlineExploreEntries({ sources: [recoveredExploreSource] }).length, 3)

const paginationSourceJson = JSON.stringify([{
  bookSourceName: 'Pagination Live Source',
  bookSourceUrl: 'https://pagelive.example.com',
  exploreUrl: 'Next::/list?page={{page+1}}',
  ruleExplore: {
    bookList: '$.items[*]',
    name: '$.name',
    bookUrl: '$.url'
  }
}])
await importSourcesFromAny(paginationSourceJson)
const paginationSource = getSourceConfigs().find(item => item.name === 'Pagination Live Source')
const livePaginationEntry = parseSourceExploreUrl(paginationSource)[0]
const paginatedLoaded = await loadSourceExploreBooks(paginationSource.id, livePaginationEntry, { page: 2, timeoutMs: 1000 })
assert.equal(requestedUrl, 'https://pagelive.example.com/list?page=3')
assert.equal(paginatedLoaded.diagnostics.requestUrl, 'https://pagelive.example.com/list?page=3')

globalThis.uni.request = options => {
  requestedUrl = String(options.data && options.data.url || '')
  options.success({
    statusCode: 200,
    data: {
      text: JSON.stringify({ items: [] }),
      status_code: 200,
      final_url: requestedUrl
    }
  })
}
const emptyLoaded = await loadSourceExploreBooks(source.id, parsedEntries[2], { page: 1, timeoutMs: 1000 })
assert.equal(emptyLoaded.books.length, 0)
assert.equal(emptyLoaded.diagnostics.failedStage, 'empty_result')
assert.match(emptyLoaded.diagnostics.errorMessage, /分类|规则|Cookie|User-Agent|WebView/)

globalThis.uni.request = options => {
  requestedUrl = String(options.data && options.data.url || '')
  options.success({
    statusCode: 200,
    data: {
      text: JSON.stringify({
        items: [
          {
            name: 'Explore Book',
            author: 'Explore Author',
            latest: 'Chapter 20',
            url: '/book/explore',
            kind: 'Fantasy'
          }
        ]
      }),
      status_code: 200,
      final_url: requestedUrl
    }
  })
}

const partialSource = getSourceConfigs().find(item => item.name === 'Explore With Login Elsewhere')
const partialExplore = getSourceExploreEntries(partialSource.id)
assert.equal(partialExplore.available, false)
assert.equal(partialExplore.reasonCode, 'source_disabled')

const searchPage = readFileSync(new URL('../pages/search/search.vue', import.meta.url), 'utf8')
assert.match(searchPage, /getOnlineExploreEntries/)
assert.match(searchPage, /openExploreCatalogEntry/)
assert.match(searchPage, /buildExploreCatalog/)
assert.match(searchPage, /exploreEntries/)
assert.match(searchPage, /openExploreEntry/)
assert.match(searchPage, /discover-source-list/)
assert.match(searchPage, /explore-entry/)

const sourceExplorePage = readFileSync(new URL('../pages/sourceExplore/sourceExplore.vue', import.meta.url), 'utf8')
assert.match(sourceExplorePage, /getSourceExploreEntries/)
assert.match(sourceExplorePage, /loadSourceExploreBooks/)
assert.match(sourceExplorePage, /sourceId/)
assert.match(sourceExplorePage, /loadMoreBooks/)
assert.match(sourceExplorePage, /saveOnlineBookDraft/)
assert.match(sourceExplorePage, /\/pages\/sourceBook\/sourceBook/)
assert.match(sourceExplorePage, /lazy-load/)
assert.match(sourceExplorePage, /lastRequestUrl/)
assert.match(sourceExplorePage, /lastElapsedMs/)
assert.match(sourceExplorePage, /copyDebugInfo/)
assert.match(sourceExplorePage, /emptyReasonText/)
assert.match(sourceExplorePage, /searchSourceBooks/)
assert.match(sourceExplorePage, /fallback-search-panel/)
assert.match(sourceExplorePage, /fallbackKeyword/)
assert.match(sourceExplorePage, /runFallbackSearch/)
assert.match(sourceExplorePage, /copyFallbackDiagnostics/)
assert.doesNotMatch(sourceExplorePage, /玄幻|都市|历史|网游/)

const pagesConfig = JSON.parse(readFileSync(new URL('../pages.json', import.meta.url), 'utf8'))
assert.ok(pagesConfig.pages.some(page => page.path === 'pages/sourceExplore/sourceExplore'))
assert.ok(pagesConfig.pages.some(page => page.path === 'pages/sourceHub/sourceHub'))

const libraryPage = readFileSync(new URL('../pages/library/library.vue', import.meta.url), 'utf8')
assert.match(libraryPage, /@tap="openSourceHub\(source\)"/)
assert.match(libraryPage, /@tap\.stop="openSourceDetail\(source\.raw\)"/)
assert.match(libraryPage, /\/pages\/sourceHub\/sourceHub\?sourceId=/)
assert.doesNotMatch(libraryPage, /categoryButtons|rankButtons|latestButtons|decorateExploreButtons/)

console.log('sourceExplore tests passed')
