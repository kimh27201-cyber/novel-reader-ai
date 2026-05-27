import assert from 'node:assert/strict'

const store = {}
globalThis.uni = {
  getStorageSync(key) {
    return store[key]
  },
  setStorageSync(key, value) {
    store[key] = value
  },
  removeStorageSync(key) {
    delete store[key]
  }
}

const {
  deleteShelfBook,
  getBooks,
  importBookFromText,
  mergeShelfBooks
} = await import('../common/books.js')
const {
  addOnlineBookToShelf,
  getOnlineShelfBooks
} = await import('../common/bookSources.js')

const txtBook = importBookFromText({
  title: '本地测试书',
  author: '作者',
  text: '第一章 开始\n这是一段足够长的本地测试小说正文，用来保证导入逻辑会接受它。\n第二章 继续\n继续阅读。'
})
assert.ok(getBooks().some(book => book.id === txtBook.id))
assert.equal(deleteShelfBook(txtBook), true)
assert.equal(getBooks().some(book => book.id === txtBook.id), false)

const onlineBook = addOnlineBookToShelf({
  sourceId: 'source-a',
  sourceName: '测试源',
  bookUrl: 'https://example.com/book/1',
  title: '在线测试书',
  author: '作者'
})
assert.ok(getOnlineShelfBooks().some(book => book.id === onlineBook.id))
assert.equal(deleteShelfBook(onlineBook), true)
assert.equal(getOnlineShelfBooks().some(book => book.id === onlineBook.id), false)

const builtin = getBooks().find(book => book.source === 'builtin')
assert.ok(builtin)
assert.equal(deleteShelfBook(builtin), true)
assert.equal(getBooks().some(book => book.id === builtin.id), false)

assert.equal(deleteShelfBook({ id: 'backend:1', source: 'backend' }), false)

const merged = mergeShelfBooks([{
  id: 'backend:7',
  source: 'backend',
  title: '星轨图书馆',
  author: '示例作者'
}], [{
  id: 'star-trace',
  source: 'builtin',
  title: '星轨图书馆',
  author: '示例作者'
}, {
  id: 'wind-city',
  source: 'builtin',
  title: '风停在旧城',
  author: '示例作者'
}])
assert.deepEqual(merged.map(book => book.id), ['backend:7', 'wind-city'])

console.log('shelfDeletion tests passed')
