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
  getSourceConfigs,
  importSourcesFromAny
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

const source = getSourceConfigs().find(item => item.name === 'Explore Source')
const entries = getOnlineExploreEntries()

assert.equal(entries.length, 3)
assert.deepEqual(entries.map(entry => entry.title), ['Latest', 'Rank', 'Fantasy'])
assert.deepEqual(entries.map(entry => entry.kind), ['latest', 'rank', 'category'])
assert.equal(entries[0].sourceId, source.id)
assert.equal(entries[0].sourceName, 'Explore Source')

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

const searchPage = readFileSync(new URL('../pages/search/search.vue', import.meta.url), 'utf8')
assert.match(searchPage, /getOnlineExploreEntries/)
assert.match(searchPage, /exploreOnlineBooks/)
assert.match(searchPage, /exploreEntries/)
assert.match(searchPage, /openExploreEntry/)
assert.match(searchPage, /discover-source-list/)
assert.match(searchPage, /explore-entry/)

console.log('sourceExplore tests passed')
