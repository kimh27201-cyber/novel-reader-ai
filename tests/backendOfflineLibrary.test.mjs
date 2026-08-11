import assert from 'node:assert/strict'

const store = {}
globalThis.uni = {
  getStorageSync(key) {
    return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : ''
  },
  setStorageSync(key, value) {
    store[key] = value
  },
  removeStorageSync(key) {
    delete store[key]
  }
}

const {
  cacheBackendBooks,
  clearCurrentAccountOfflineData,
  flushBackendOfflineProgress,
  getActiveBackendAccount,
  getBackendOfflineStats,
  getCachedBackendBook,
  getCachedBackendBooks,
  hideActiveBackendAccount,
  loadCachedBackendChapter,
  queueBackendBookDelete,
  queueBackendReadingProgress,
  readBackendOfflineManifest,
  setActiveBackendAccount
} = await import('../common/backendOfflineLibrary.js')

const clientIdentity = { getBaseUrl: () => 'http://127.0.0.1:8765/' }
const firstIdentity = setActiveBackendAccount({ id: 7, username: 'reader' }, clientIdentity)

const book = {
  id: 'backend:42',
  backendId: 42,
  syncId: 'book-sync-42',
  source: 'backend',
  title: '离线测试书',
  author: '测试作者',
  chapters: [
    { id: 'backend-chapter:1', backendId: 1, chapterIndex: 0, title: '第一章', url: 'https://example/1', content: '第一章正文' },
    { id: 'backend-chapter:2', backendId: 2, chapterIndex: 1, title: '第二章', url: 'https://example/2', content: '' }
  ]
}

await cacheBackendBooks([book], { identity: firstIdentity })
assert.equal(getCachedBackendBooks().length, 1)
assert.equal(getCachedBackendBook('backend:42').chapters[0].content, '')
assert.equal(await loadCachedBackendChapter(book, book.chapters[0]), '第一章正文')
await assert.rejects(() => loadCachedBackendChapter(book, book.chapters[1]), /尚未下载/)

hideActiveBackendAccount()
assert.equal(getActiveBackendAccount(), null)
assert.deepEqual(getCachedBackendBooks(), [])

setActiveBackendAccount({ id: 8, username: 'other' }, clientIdentity)
assert.deepEqual(getCachedBackendBooks(), [])

setActiveBackendAccount({ id: 7, username: 'reader' }, clientIdentity)
assert.equal(getCachedBackendBooks().length, 1)

queueBackendReadingProgress({
  book,
  chapter: book.chapters[0],
  chapterIndex: 0,
  pageIndex: 3,
  progressPercent: 25
})
queueBackendReadingProgress({
  book,
  chapter: book.chapters[1],
  chapterIndex: 1,
  pageIndex: 2,
  progressPercent: 60
})
assert.equal(getBackendOfflineStats().pendingProgress, 1)

let pushedMutations = []
const syncResult = await flushBackendOfflineProgress({
  syncPush: async payload => {
    pushedMutations = payload.mutations
    return {
      results: payload.mutations.map(item => ({ mutation_id: item.mutation_id, status: 'applied' }))
    }
  },
  syncPull: async () => ({ changes: [], next_cursor: 4, has_more: false })
})

assert.equal(pushedMutations.length, 1)
assert.equal(pushedMutations[0].payload.chapter_index, 1)
assert.equal(syncResult.pushed, 1)
assert.equal(getBackendOfflineStats().pendingProgress, 0)

await flushBackendOfflineProgress({
  syncPull: async () => ({
    changes: [{ entity_type: 'book', operation: 'delete', sync_id: book.syncId }],
    next_cursor: 5,
    has_more: false
  })
})
assert.equal(getCachedBackendBooks().length, 0)
assert.equal(readBackendOfflineManifest().deletedContent.length, 2)

await cacheBackendBooks([book], { identity: firstIdentity })

const deleteMutation = queueBackendBookDelete(book)
assert.ok(deleteMutation.mutationId)
assert.equal(getCachedBackendBooks().length, 0)
assert.equal(getBackendOfflineStats().pendingDeletes, 1)
let pushedDelete = null
await flushBackendOfflineProgress({
  syncPush: async payload => {
    pushedDelete = payload.mutations[0]
    return { results: [{ mutation_id: pushedDelete.mutation_id, status: 'applied', version: 2 }] }
  },
  syncPull: async () => ({ changes: [], next_cursor: 6, has_more: false })
})
assert.equal(pushedDelete.entity_type, 'book')
assert.equal(pushedDelete.operation, 'delete')
assert.equal(getBackendOfflineStats().pendingDeletes, 0)

await cacheBackendBooks([book], { identity: firstIdentity })

const cleared = await clearCurrentAccountOfflineData()
assert.equal(cleared.books, 1)
assert.equal(getCachedBackendBooks().length, 0)

console.log('backendOfflineLibrary tests passed')
