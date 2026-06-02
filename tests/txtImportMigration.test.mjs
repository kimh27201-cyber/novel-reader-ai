import assert from 'node:assert/strict'

const legacyBook = {
  id: 'local-legacy',
  source: 'local',
  title: 'Legacy TXT',
  author: 'Local',
  category: '本地 TXT',
  chapters: [{
    title: '第一章',
    content: '旧版本正文'
  }]
}

const legacyStore = {
  'books:imported': [legacyBook]
}
const nativeStore = {
  'kv:books:imported': '[]'
}

globalThis.uni = {
  getStorageSync(key) {
    return legacyStore[key]
  },
  setStorageSync(key, value) {
    legacyStore[key] = value
  },
  removeStorageSync(key) {
    delete legacyStore[key]
  }
}

globalThis.NovelReaderLocalStorage = {
  writeChapter(key, content) {
    nativeStore[key] = content
    return true
  },
  readChapter(key) {
    return nativeStore[key] || ''
  },
  removeChapter(key) {
    delete nativeStore[key]
    return true
  }
}

const { getImportedBooks } = await import('../common/books.js?migration')

const imported = getImportedBooks()
assert.deepEqual(imported.map(book => book.id), ['local-legacy'])
assert.deepEqual(JSON.parse(nativeStore['kv:books:imported']).map(book => book.id), ['local-legacy'])

console.log('txtImportMigration tests passed')
