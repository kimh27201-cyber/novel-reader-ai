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
assert.match(complexEntries.reason, /复杂.*模板/)

let requestedUrl = ''
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

const loaded = await loadSourceExploreBooks(source.id, parsedEntries[2], { page: 1, timeoutMs: 1000 })
assert.equal(loaded.sourceId, source.id)
assert.equal(loaded.entryTitle, 'Fantasy')
assert.equal(loaded.page, 1)
assert.equal(loaded.hasMore, false)
assert.equal(loaded.books.length, 1)
assert.equal(loaded.books[0].origin, 'explore')

const partialSource = getSourceConfigs().find(item => item.name === 'Explore With Login Elsewhere')
const partialExplore = getSourceExploreEntries(partialSource.id)
assert.equal(partialExplore.available, true)
const partialLoaded = await loadSourceExploreBooks(partialSource.id, partialExplore.entries[0], { page: 1, timeoutMs: 1000 })
assert.equal(partialLoaded.books.length, 1)

const searchPage = readFileSync(new URL('../pages/search/search.vue', import.meta.url), 'utf8')
assert.match(searchPage, /getOnlineExploreEntries/)
assert.match(searchPage, /exploreOnlineBooks/)
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
assert.doesNotMatch(sourceExplorePage, /玄幻|都市|历史|网游/)

const pagesConfig = JSON.parse(readFileSync(new URL('../pages.json', import.meta.url), 'utf8'))
assert.ok(pagesConfig.pages.some(page => page.path === 'pages/sourceExplore/sourceExplore'))

const libraryPage = readFileSync(new URL('../pages/library/library.vue', import.meta.url), 'utf8')
assert.match(libraryPage, /@tap="openSourceExplore\(source\)"/)
assert.match(libraryPage, /@tap\.stop="openSourceDetail\(source\.raw\)"/)
assert.match(libraryPage, /\/pages\/sourceExplore\/sourceExplore\?sourceId=/)
assert.doesNotMatch(libraryPage, /categoryButtons|rankButtons|latestButtons|decorateExploreButtons/)

console.log('sourceExplore tests passed')
