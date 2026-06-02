import assert from 'node:assert/strict'

const store = {}
globalThis.uni = {
  getStorageSync(key) {
    return store[key]
  },
  setStorageSync(key, value) {
    const serialized = JSON.stringify(value)
    if (key === 'books:imported' && serialized.length > 5000) {
      throw new Error('storage quota exceeded for shelf index')
    }
    store[key] = value
  },
  removeStorageSync(key) {
    delete store[key]
  }
}

const {
  deleteShelfBook,
  getBook,
  importBookFromText,
  importBookFromTextAsync,
  loadLocalChapterContent
} = await import('../common/books.js')

const firstChapter = 'A'.repeat(9000)
const secondChapter = 'B'.repeat(7000)
const book = importBookFromText({
  title: 'Large TXT',
  author: 'Local Author',
  text: `Chapter 1\n${firstChapter}\nChapter 2\n${secondChapter}`
})

const shelfIndex = JSON.stringify(store['books:imported'])
assert.ok(shelfIndex.length < 5000)
assert.equal(shelfIndex.includes(firstChapter.slice(0, 200)), false)

const loaded = getBook(book.id)
assert.equal(loaded.chapters.length, 2)
assert.equal(loaded.chapters[0].content, '')
assert.equal(loaded.chapters[0].wordCount, firstChapter.length)
assert.equal(loadLocalChapterContent(loaded, loaded.chapters[0]), firstChapter)
assert.equal(loadLocalChapterContent(loaded, loaded.chapters[1]), secondChapter)

const chapterKeys = Object.keys(store).filter(key => key.startsWith(`books:local-chapter:${book.id}:`))
assert.ok(chapterKeys.length >= 2)

assert.equal(deleteShelfBook(book), true)
assert.equal(Object.keys(store).some(key => key.startsWith(`books:local-chapter:${book.id}:`)), false)

const largeStore = {}
const largeKeys = []
const asyncBook = await importBookFromTextAsync({
  title: 'Huge TXT',
  author: 'Async Author',
  text: `Chapter 1\n${firstChapter}\nChapter 2\n${secondChapter}`
}, {
  chapterStorage: {
    name: 'test-large-store',
    async writeChapter(key, content) {
      largeStore[key] = content
      largeKeys.push(key)
    },
    async readChapter(key) {
      return largeStore[key] || ''
    },
    async removeChapter(key) {
      delete largeStore[key]
    }
  }
})

const asyncIndex = JSON.stringify(store['books:imported'])
assert.ok(asyncIndex.length < 5000)
assert.equal(asyncIndex.includes(firstChapter.slice(0, 200)), false)
assert.equal(asyncBook.chapters[0].contentStorage, 'test-large-store')
assert.ok(largeKeys.some(key => key.endsWith(':catalog')))
assert.equal(store['books:imported'][0].chapterCount, 2)
assert.deepEqual(store['books:imported'][0].chapters, [])
assert.equal(await import('../common/books.js').then(mod => mod.loadLocalChapterContentAsync(asyncBook, asyncBook.chapters[0], {
  chapterStorage: {
    async readChapter(key) {
      return largeStore[key] || ''
    }
  }
})), firstChapter)

console.log('txtImport tests passed')
