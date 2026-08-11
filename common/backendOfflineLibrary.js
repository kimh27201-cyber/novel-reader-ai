const ACTIVE_ACCOUNT_KEY = 'novelReaderBackendActiveAccount'
const MANIFEST_PREFIX = 'backend:offline:manifest:v1:'
const CONTENT_PREFIX = 'backend:offline:content:v1:'
const DB_NAME = 'novel-reader-backend-offline'
const DB_VERSION = 1
const STORE_NAME = 'chapters'
const AUTO_CACHE_LIMIT = 120
const DELETED_CACHE_GRACE_MS = 7 * 24 * 60 * 60 * 1000

const memoryStore = {}
const memoryContent = {}
let writeChain = Promise.resolve()

function getUni() {
  return typeof uni !== 'undefined' ? uni : null
}

function readStorage(key, fallback) {
  try {
    const api = getUni()
    if (api && api.getStorageSync) {
      const value = api.getStorageSync(key)
      return value === '' || value == null ? fallback : value
    }
  } catch (error) {}
  return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : fallback
}

function writeStorage(key, value) {
  try {
    const api = getUni()
    if (api && api.setStorageSync) {
      api.setStorageSync(key, value)
      return
    }
  } catch (error) {}
  memoryStore[key] = value
}

function removeStorage(key) {
  try {
    const api = getUni()
    if (api && api.removeStorageSync) {
      api.removeStorageSync(key)
      return
    }
  } catch (error) {}
  delete memoryStore[key]
}

function stableHash(value) {
  let hash = 2166136261
  const text = String(value || '')
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '').toLowerCase()
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function getOfflineAccountScope({ baseUrl, userId }) {
  const accountId = Number(userId)
  if (!Number.isFinite(accountId) || accountId <= 0) return ''
  return `${stableHash(normalizeBaseUrl(baseUrl))}:${accountId}`
}

export function setActiveBackendAccount(user, client) {
  const accountId = Number(user && user.id)
  const baseUrl = client && typeof client.getBaseUrl === 'function' ? client.getBaseUrl() : ''
  const scope = getOfflineAccountScope({ baseUrl, userId: accountId })
  if (!scope) return null
  const identity = {
    scope,
    accountId,
    username: String(user && user.username || ''),
    baseUrl: normalizeBaseUrl(baseUrl),
    activatedAt: Date.now()
  }
  writeStorage(ACTIVE_ACCOUNT_KEY, identity)
  return identity
}

export function getActiveBackendAccount() {
  const value = readStorage(ACTIVE_ACCOUNT_KEY, null)
  return value && value.scope && value.accountId ? value : null
}

export function hideActiveBackendAccount() {
  removeStorage(ACTIVE_ACCOUNT_KEY)
}

function manifestKey(scope) {
  return `${MANIFEST_PREFIX}${scope}`
}

function emptyManifest(identity) {
  return {
    version: 1,
    scope: identity.scope,
    accountId: identity.accountId,
    baseUrl: identity.baseUrl,
    updatedAt: 0,
    lastSyncAt: 0,
      cursor: 0,
      books: [],
      pendingProgress: [],
      pendingDeletes: [],
      deletedContent: []
  }
}

function normalizeManifest(value, identity) {
  if (!value || typeof value !== 'object' || value.version !== 1 || value.scope !== identity.scope) {
    return emptyManifest(identity)
  }
  return {
    ...emptyManifest(identity),
      ...value,
      books: Array.isArray(value.books) ? value.books : [],
      pendingProgress: Array.isArray(value.pendingProgress) ? value.pendingProgress : [],
      pendingDeletes: Array.isArray(value.pendingDeletes) ? value.pendingDeletes : [],
      deletedContent: Array.isArray(value.deletedContent) ? value.deletedContent : []
  }
}

export function readBackendOfflineManifest(identity = getActiveBackendAccount()) {
  if (!identity || !identity.scope) return null
  return normalizeManifest(readStorage(manifestKey(identity.scope), null), identity)
}

function persistManifest(manifest) {
  const next = { ...manifest, updatedAt: Date.now() }
  writeStorage(manifestKey(next.scope), next)
  return next
}

function enqueueWrite(action) {
  const task = writeChain.then(action, action)
  writeChain = task.catch(() => {})
  return task
}

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('离线章节数据库打开失败'))
  })
}

async function runDb(mode, operation) {
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    let request
    try {
      request = operation(store)
    } catch (error) {
      db.close()
      reject(error)
      return
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('离线章节数据库操作失败'))
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => db.close()
  })
}

function nativeBridge() {
  const bridge = typeof globalThis !== 'undefined' && globalThis.NovelReaderLocalStorage
  return bridge && typeof bridge.writeChapter === 'function' && typeof bridge.readChapter === 'function'
    ? bridge
    : null
}

async function writeContent(key, content) {
  const bridge = nativeBridge()
  if (bridge) {
    if (!bridge.writeChapter(key, String(content || ''))) throw new Error('本机离线章节写入失败')
    return 'native-file'
  }
  if (typeof indexedDB !== 'undefined') {
    await runDb('readwrite', store => store.put({ key, content: String(content || ''), updatedAt: Date.now() }))
    return 'indexeddb'
  }
  memoryContent[key] = String(content || '')
  return 'memory'
}

async function readContent(key) {
  const bridge = nativeBridge()
  if (bridge) return String(bridge.readChapter(key) || '')
  if (typeof indexedDB !== 'undefined') {
    const row = await runDb('readonly', store => store.get(key))
    return String(row && row.content || '')
  }
  return String(memoryContent[key] || '')
}

async function removeContent(key) {
  const bridge = nativeBridge()
  if (bridge && typeof bridge.removeChapter === 'function') return bridge.removeChapter(key)
  if (typeof indexedDB !== 'undefined') {
    await runDb('readwrite', store => store.delete(key))
    return true
  }
  delete memoryContent[key]
  return true
}

function chapterIdentity(chapter) {
  return String(chapter && (chapter.id || chapter.backendId || chapter.chapterIndex || chapter.index))
}

function chapterContentKey(scope, book, chapter) {
  return `${CONTENT_PREFIX}${scope}:${book.backendId || book.id}:${chapterIdentity(chapter)}`
}

function stripBookContent(book, previousBook, contentRefs) {
  const previousChapters = previousBook && Array.isArray(previousBook.chapters) ? previousBook.chapters : []
  const chapters = (book.chapters || []).map((chapter, index) => {
    const previous = previousChapters.find(item => chapterIdentity(item) === chapterIdentity(chapter)) || {}
    const content = String(chapter.content || '')
    const contentKey = previous.contentKey || chapterContentKey(contentRefs.scope, book, chapter)
    const pinned = !!(chapter.offlinePinned || previous.offlinePinned)
    if (content) contentRefs.items.push({ key: contentKey, content, chapter })
    return {
      ...chapter,
      content: '',
      contentKey,
      contentStorage: content ? 'pending' : previous.contentStorage || chapter.contentStorage || '',
      localCached: !!(content || previous.localCached || chapter.localCached),
      offlinePinned: pinned,
      cacheAccessAt: Number(previous.cacheAccessAt || chapter.cacheAccessAt || (content ? Date.now() : 0))
    }
  })
  return {
    ...book,
    source: 'backend',
    offlineMirror: true,
    cachedAt: Date.now(),
    chapters
  }
}

async function enforceAutoCacheLimit(manifest, limit = AUTO_CACHE_LIMIT) {
  const cached = []
  manifest.books.forEach(book => {
    ;(book.chapters || []).forEach(chapter => {
      if (chapter.localCached && !chapter.offlinePinned) cached.push({ book, chapter })
    })
  })
  cached.sort((left, right) => Number(right.chapter.cacheAccessAt || 0) - Number(left.chapter.cacheAccessAt || 0))
  const expired = cached.slice(Math.max(0, limit))
  for (const item of expired) {
    await removeContent(item.chapter.contentKey).catch(() => {})
    item.chapter.localCached = false
    item.chapter.contentStorage = ''
  }
}

function quarantineBookContent(manifest, books) {
  const existing = new Set(manifest.deletedContent.map(item => item.key))
  ;(books || []).forEach(book => {
    ;(book.chapters || []).forEach(chapter => {
      if (!chapter.contentKey || existing.has(chapter.contentKey)) return
      manifest.deletedContent.push({
        key: chapter.contentKey,
        deleteAfter: Date.now() + DELETED_CACHE_GRACE_MS
      })
      existing.add(chapter.contentKey)
    })
  })
}

async function purgeExpiredDeletedContent(manifest) {
  const now = Date.now()
  const keep = []
  for (const item of manifest.deletedContent) {
    if (Number(item.deleteAfter || 0) > now) {
      keep.push(item)
      continue
    }
    await removeContent(item.key).catch(() => {})
  }
  manifest.deletedContent = keep
}

export async function cacheBackendBooks(books, options = {}) {
  const identity = options.identity || getActiveBackendAccount()
  if (!identity) return []
  return enqueueWrite(async () => {
    const manifest = readBackendOfflineManifest(identity) || emptyManifest(identity)
    const previous = manifest.books
    const contentRefs = { scope: identity.scope, items: [] }
    const pendingDeleteKeys = new Set(manifest.pendingDeletes.flatMap(item => [item.bookId, item.bookSyncId].filter(Boolean)))
    const nextBooks = (books || []).filter(book => {
      return !pendingDeleteKeys.has(book.id) && !pendingDeleteKeys.has(book.syncId)
    }).map(book => {
      const previousBook = previous.find(item => item.id === book.id || (book.syncId && item.syncId === book.syncId))
      return stripBookContent(book, previousBook, contentRefs)
    })
    const nextIds = new Set(nextBooks.map(book => book.syncId || book.id))
    quarantineBookContent(manifest, previous.filter(book => !nextIds.has(book.syncId || book.id)))
    for (const item of contentRefs.items) {
      const storage = await writeContent(item.key, item.content)
      nextBooks.forEach(book => {
        const chapter = (book.chapters || []).find(candidate => candidate.contentKey === item.key)
        if (chapter) chapter.contentStorage = storage
      })
    }
    manifest.books = nextBooks
    manifest.lastSyncAt = Number(options.syncedAt || Date.now())
    await purgeExpiredDeletedContent(manifest)
    await enforceAutoCacheLimit(manifest, options.autoCacheLimit || AUTO_CACHE_LIMIT)
    persistManifest(manifest)
    return clone(nextBooks)
  })
}

export function getCachedBackendBooks(identity = getActiveBackendAccount()) {
  const manifest = readBackendOfflineManifest(identity)
  return manifest ? clone(manifest.books) : []
}

export function getCachedBackendBook(bookId, identity = getActiveBackendAccount()) {
  return getCachedBackendBooks(identity).find(book => String(book.id) === String(bookId)) || null
}

export async function cacheBackendChapter(book, chapter, content, options = {}) {
  const identity = options.identity || getActiveBackendAccount()
  if (!identity || !book || !chapter || !String(content || '').trim()) return false
  return enqueueWrite(async () => {
    const manifest = readBackendOfflineManifest(identity) || emptyManifest(identity)
    let storedBook = manifest.books.find(item => item.id === book.id)
    if (!storedBook) {
      const refs = { scope: identity.scope, items: [] }
      storedBook = stripBookContent(book, null, refs)
      manifest.books.push(storedBook)
    }
    let storedChapter = (storedBook.chapters || []).find(item => chapterIdentity(item) === chapterIdentity(chapter))
    if (!storedChapter) {
      storedChapter = { ...chapter, content: '' }
      storedBook.chapters = [...(storedBook.chapters || []), storedChapter]
    }
    const key = storedChapter.contentKey || chapterContentKey(identity.scope, storedBook, storedChapter)
    storedChapter.contentStorage = await writeContent(key, content)
    storedChapter.contentKey = key
    storedChapter.localCached = true
    storedChapter.isCached = true
    storedChapter.offlinePinned = !!(options.pinned || storedChapter.offlinePinned)
    storedChapter.cacheAccessAt = Date.now()
    storedBook.cachedAt = Date.now()
    await enforceAutoCacheLimit(manifest, options.autoCacheLimit || AUTO_CACHE_LIMIT)
    persistManifest(manifest)
    return true
  })
}

export async function loadCachedBackendChapter(book, chapter, identity = getActiveBackendAccount()) {
  if (!identity) throw new Error('当前账号没有可用的离线书架')
  const manifest = readBackendOfflineManifest(identity)
  const storedBook = manifest && manifest.books.find(item => item.id === book.id)
  const storedChapter = storedBook && (storedBook.chapters || []).find(item => chapterIdentity(item) === chapterIdentity(chapter))
  if (!storedChapter || !storedChapter.localCached || !storedChapter.contentKey) {
    const error = new Error('该章节尚未下载，请联网后重试或先下载离线内容')
    error.code = 'OFFLINE_CHAPTER_MISSING'
    throw error
  }
  const content = await readContent(storedChapter.contentKey)
  if (!content) {
    const error = new Error('该章节的离线文件已丢失，请联网后重新下载')
    error.code = 'OFFLINE_CHAPTER_MISSING'
    throw error
  }
  storedChapter.cacheAccessAt = Date.now()
  persistManifest(manifest)
  return content
}

function mutationId(bookId) {
  return `progress-${Date.now().toString(36)}-${stableHash(`${bookId}:${Math.random()}`)}`.slice(0, 64)
}

function historySyncId(scope, bookSyncId) {
  return `${stableHash(`${scope}:${bookSyncId}`)}${stableHash(`${bookSyncId}:${scope}`)}`
}

export function queueBackendReadingProgress(payload, identity = getActiveBackendAccount()) {
  if (!identity || !payload || !payload.book) return null
  const manifest = readBackendOfflineManifest(identity) || emptyManifest(identity)
  const book = payload.book
  const item = {
    mutationId: mutationId(book.id),
    bookId: book.id,
    backendBookId: book.backendId,
    bookSyncId: book.syncId || '',
    historySyncId: historySyncId(identity.scope, book.syncId || book.id),
    baseVersion: Number(payload.historyVersion || 0),
    chapterId: payload.chapter && payload.chapter.backendId || null,
    chapterIndex: Number(payload.chapterIndex || 0),
    pageIndex: Number(payload.pageIndex || 0),
    progressPercent: Number(payload.progressPercent || 0),
    updatedAt: new Date().toISOString()
  }
  manifest.pendingProgress = manifest.pendingProgress.filter(existing => existing.bookId !== item.bookId)
  manifest.pendingProgress.push(item)
  persistManifest(manifest)
  return item
}

export function queueBackendBookDelete(book, identity = getActiveBackendAccount()) {
  if (!identity || !book || !book.id) return null
  const manifest = readBackendOfflineManifest(identity) || emptyManifest(identity)
  const storedBook = manifest.books.find(item => item.id === book.id || (book.syncId && item.syncId === book.syncId))
  const target = storedBook || book
  const existing = manifest.pendingDeletes.find(item => item.bookId === target.id)
  if (existing) return existing
  const item = {
    mutationId: mutationId(`delete:${target.id}`),
    bookId: target.id,
    backendBookId: target.backendId,
    bookSyncId: target.syncId || '',
    baseVersion: Number(target.version || 0),
    deletedAt: new Date().toISOString()
  }
  quarantineBookContent(manifest, manifest.books.filter(candidate => candidate.id === target.id))
  manifest.books = manifest.books.filter(candidate => candidate.id !== target.id)
  manifest.pendingProgress = manifest.pendingProgress.filter(progress => progress.bookId !== target.id)
  manifest.pendingDeletes.push(item)
  persistManifest(manifest)
  return item
}

function writePulledProgress(manifest, payload) {
  const book = manifest.books.find(item => item.syncId === payload.book_sync_id)
  if (!book) return
  const key = `reader:progress:${book.id}`
  const existing = readStorage(key, {}) || {}
  const remoteTime = Date.parse(payload.updated_at || '') || 0
  const localTime = Number(existing.updatedAt || 0)
  if (localTime > remoteTime) return
  writeStorage(key, {
    ...existing,
    chapterIndex: Number(payload.chapter_index || 0),
    pageIndex: Number(payload.page_index || 0),
    updatedAt: remoteTime || Date.now()
  })
}

function applyPulledChanges(manifest, changes) {
  ;(changes || []).forEach(change => {
    if (change.entity_type === 'book') {
      if (change.operation === 'delete') {
        quarantineBookContent(manifest, manifest.books.filter(book => book.syncId === change.sync_id))
        manifest.books = manifest.books.filter(book => book.syncId !== change.sync_id)
        return
      }
      const book = manifest.books.find(item => item.syncId === change.sync_id)
      if (book) {
        Object.assign(book, {
          title: change.payload.title || book.title,
          author: change.payload.author || book.author,
          coverUrl: change.payload.cover_url || '',
          description: change.payload.description || '',
          bookUrl: change.payload.book_url || '',
          tocUrl: change.payload.toc_url || '',
          version: change.version,
          updatedAt: change.payload.updated_at || book.updatedAt
        })
      }
    }
    if (change.entity_type === 'reading_history' && change.operation === 'upsert') {
      writePulledProgress(manifest, change.payload || {})
    }
  })
}

export async function flushBackendOfflineProgress(client, identity = getActiveBackendAccount()) {
  if (!identity || !client) return { pushed: 0, pulled: 0 }
  const manifest = readBackendOfflineManifest(identity) || emptyManifest(identity)
  let pushed = 0
  if (manifest.pendingDeletes.length) {
    const syncable = manifest.pendingDeletes.filter(item => item.bookSyncId)
    const direct = manifest.pendingDeletes.filter(item => !item.bookSyncId && item.backendBookId)
    const completed = new Set()
    if (syncable.length) {
      const response = await client.syncPush({
        deviceId: `offline-${identity.scope}`.slice(0, 100),
        mutations: syncable.map(item => ({
          mutation_id: item.mutationId,
          entity_type: 'book',
          sync_id: item.bookSyncId,
          base_version: item.baseVersion,
          operation: 'delete',
          payload: { updated_at: item.deletedAt }
        }))
      })
      ;(response.results || []).forEach(result => {
        const item = manifest.pendingDeletes.find(candidate => candidate.mutationId === result.mutation_id)
        if (!item) return
        if (result.status === 'applied') {
          completed.add(item.mutationId)
        } else if (result.status === 'conflict') {
          item.baseVersion = Number(result.version || item.baseVersion)
          item.mutationId = mutationId(`delete:${item.bookId}`)
        }
      })
    }
    for (const item of direct) {
      try {
        await client.deleteBook(item.backendBookId)
        completed.add(item.mutationId)
      } catch (error) {
        if (Number(error && error.statusCode) === 404) completed.add(item.mutationId)
        else throw error
      }
    }
    manifest.pendingDeletes = manifest.pendingDeletes.filter(item => !completed.has(item.mutationId))
    pushed += completed.size
  }
  if (manifest.pendingProgress.length) {
    const syncable = manifest.pendingProgress.filter(item => item.bookSyncId)
    const direct = manifest.pendingProgress.filter(item => !item.bookSyncId)
    const completed = new Set()
    if (syncable.length) {
      const response = await client.syncPush({
        deviceId: `offline-${identity.scope}`.slice(0, 100),
        mutations: syncable.map(item => ({
          mutation_id: item.mutationId,
          entity_type: 'reading_history',
          sync_id: item.historySyncId,
          base_version: item.baseVersion,
          operation: 'upsert',
          payload: {
            book_sync_id: item.bookSyncId,
            chapter_index: item.chapterIndex,
            page_index: item.pageIndex,
            progress_percent: item.progressPercent,
            updated_at: item.updatedAt
          }
        }))
      })
      ;(response.results || []).forEach(result => {
        if (result.status === 'applied' || result.status === 'conflict') completed.add(result.mutation_id)
      })
    }
    for (const item of direct) {
      await client.saveReadingHistory({
        book_id: item.backendBookId,
        chapter_id: item.chapterId,
        chapter_index: item.chapterIndex,
        page_index: item.pageIndex,
        progress_percent: item.progressPercent
      })
      completed.add(item.mutationId)
    }
    manifest.pendingProgress = manifest.pendingProgress.filter(item => !completed.has(item.mutationId))
    pushed += completed.size
  }

  let pulled = 0
  for (;;) {
    const response = await client.syncPull({
      deviceId: `offline-${identity.scope}`.slice(0, 100),
      cursor: Number(manifest.cursor || 0),
      limit: 200
    })
    applyPulledChanges(manifest, response.changes || [])
    pulled += (response.changes || []).length
    manifest.cursor = Number(response.next_cursor || manifest.cursor || 0)
    if (!response.has_more) break
  }
  manifest.lastSyncAt = Date.now()
  await purgeExpiredDeletedContent(manifest)
  persistManifest(manifest)
  return { pushed, pulled }
}

export async function clearCurrentAccountOfflineData(identity = getActiveBackendAccount()) {
  if (!identity) return { books: 0, chapters: 0 }
  const manifest = readBackendOfflineManifest(identity) || emptyManifest(identity)
  const keys = []
  manifest.books.forEach(book => {
    ;(book.chapters || []).forEach(chapter => {
      if (chapter.contentKey) keys.push(chapter.contentKey)
    })
  })
  manifest.deletedContent.forEach(item => {
    if (item.key) keys.push(item.key)
  })
  for (const key of keys) await removeContent(key).catch(() => {})
  removeStorage(manifestKey(identity.scope))
  return { books: manifest.books.length, chapters: keys.length }
}

export function getBackendOfflineStats(identity = getActiveBackendAccount()) {
  const manifest = readBackendOfflineManifest(identity)
  if (!manifest) return { books: 0, cachedChapters: 0, pinnedChapters: 0, pendingProgress: 0, pendingDeletes: 0, lastSyncAt: 0 }
  let cachedChapters = 0
  let pinnedChapters = 0
  manifest.books.forEach(book => {
    ;(book.chapters || []).forEach(chapter => {
      if (chapter.localCached) cachedChapters += 1
      if (chapter.offlinePinned) pinnedChapters += 1
    })
  })
  return {
    books: manifest.books.length,
    cachedChapters,
    pinnedChapters,
    pendingProgress: manifest.pendingProgress.length,
    pendingDeletes: manifest.pendingDeletes.length,
    lastSyncAt: manifest.lastSyncAt
  }
}
