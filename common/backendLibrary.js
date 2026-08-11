import apiClient from './apiClient.js'
import { friendlyErrorMessage } from './uiFeedback.js'
import {
  cacheBackendBooks,
  cacheBackendChapter,
  flushBackendOfflineProgress,
  getActiveBackendAccount,
  getCachedBackendBook,
  getCachedBackendBooks,
  loadCachedBackendChapter,
  queueBackendBookDelete,
  queueBackendReadingProgress,
  setActiveBackendAccount
} from './backendOfflineLibrary.js'

const BACKEND_BOOK_PREFIX = 'backend:'
const BACKEND_CHAPTER_PREFIX = 'backend-chapter:'
const BACKEND_SOURCE_PREFIX = 'backend-source:'

function text(value, fallback = '') {
  const normalized = String(value || '').trim()
  return normalized || fallback
}

function numberId(value) {
  const id = Number(value)
  return Number.isFinite(id) ? id : null
}

function sourceUrl(value) {
  return text(value).replace(/\/+$/, '')
}

export function toBackendBookId(id) {
  return `${BACKEND_BOOK_PREFIX}${id}`
}

export function toBackendChapterId(id) {
  return `${BACKEND_CHAPTER_PREFIX}${id}`
}

export function isBackendBookId(bookId) {
  return String(bookId || '').startsWith(BACKEND_BOOK_PREFIX)
}

export function backendBookId(input) {
  if (input && typeof input === 'object' && input.backendId) return numberId(input.backendId)
  if (typeof input === 'number') return input
  const raw = String(input || '')
  return raw.startsWith(BACKEND_BOOK_PREFIX) ? numberId(raw.slice(BACKEND_BOOK_PREFIX.length)) : null
}

export function backendChapterId(input) {
  if (input && typeof input === 'object' && input.backendId) return numberId(input.backendId)
  if (typeof input === 'number') return input
  const raw = String(input || '')
  return raw.startsWith(BACKEND_CHAPTER_PREFIX) ? numberId(raw.slice(BACKEND_CHAPTER_PREFIX.length)) : null
}

export function ensureBackendToken(client = apiClient) {
  if (!client.getToken()) {
    throw new Error('请先登录后端')
  }
}

export function mapBackendChapter(chapter) {
  return {
    id: toBackendChapterId(chapter.id),
    backendId: chapter.id,
    chapterIndex: chapter.chapter_index,
    title: chapter.title,
    url: chapter.url || '',
    content: chapter.content || '',
    isCached: !!chapter.is_cached
  }
}

export function mapBackendBook(book, chapters = []) {
  return {
    id: toBackendBookId(book.id),
    backendId: book.id,
    syncId: book.sync_id || book.syncId || '',
    version: Number(book.version || 0),
    source: 'backend',
    sourceId: book.source_id,
    title: book.title,
    author: book.author,
    category: '云端书架',
    sourceName: 'FastAPI 后端',
    coverUrl: book.cover_url || '',
    bookUrl: book.book_url || '',
    tocUrl: book.toc_url || '',
    description: book.description || '',
    updatedAt: book.updated_at || book.updatedAt || '',
    chapters: chapters
      .map(mapBackendChapter)
      .sort((left, right) => left.chapterIndex - right.chapterIndex)
  }
}

export function mapBackendSource(source) {
  return {
    id: `${BACKEND_SOURCE_PREFIX}${source.id}`,
    backendId: source.id,
    name: source.name,
    baseUrl: source.base_url,
    group: source.group,
    enabled: !!source.enabled,
    compatibility: source.compatibility,
    source: 'backend'
  }
}

export function mapSourceBookResult(book) {
  const title = text(book.title, '未命名')
  const author = text(book.author, '未知作者')
  const sourceName = text(book.source_name, '后端书源')
  return {
    type: 'backend-online',
    title,
    author,
    bookUrl: book.book_url || '',
    sourceId: book.source_id,
    sourceName,
    latestChapter: book.latest_chapter || '',
    intro: book.intro || '',
    coverUrl: book.cover_url || '',
    subtitle: `${author} · ${sourceName}`,
    snippet: book.intro || book.latest_chapter || book.kind || ''
  }
}

export function mapBackendTocChapter(chapter) {
  return {
    index: chapter.index,
    title: chapter.title,
    url: chapter.url,
    content: '',
    isCached: false
  }
}

export function toBackendBookPayload(book) {
  const sourceId = numberId(book.sourceId || book.source_id)
  return {
    title: text(book.title, '未命名'),
    author: text(book.author, '未知作者'),
    cover_url: book.coverUrl || book.cover_url || '',
    description: book.description || book.intro || book.latestChapter || '',
    book_url: book.bookUrl || book.book_url || '',
    toc_url: book.tocUrl || book.toc_url || book.bookUrl || book.book_url || '',
    source_id: sourceId
  }
}

export function toBackendChapterPayload(chapter) {
  const chapterIndex = chapter.chapterIndex !== undefined
    ? chapter.chapterIndex
    : chapter.index !== undefined
      ? chapter.index
      : chapter.chapter_index !== undefined
        ? chapter.chapter_index
        : 0
  return {
    chapter_index: Number(chapterIndex),
    title: text(chapter.title, '未命名章节'),
    url: chapter.url || '',
    content: chapter.content || '',
    is_cached: !!(chapter.isCached || chapter.is_cached || chapter.content)
  }
}

export function toReadingHistoryPayload({ book, chapter = null, chapterIndex = 0, pageIndex = 0, progressPercent = 0 }) {
  return {
    book_id: backendBookId(book),
    chapter_id: chapter ? backendChapterId(chapter) : null,
    chapter_index: Number(chapterIndex) || 0,
    page_index: Number(pageIndex) || 0,
    progress_percent: Number(progressPercent) || 0
  }
}

async function listAllBackendChapters(bookId, client) {
  const limit = 200
  const chapters = []
  for (let offset = 0; ; offset += limit) {
    const page = await client.listChapters(bookId, { limit, offset })
    const items = Array.isArray(page) ? page : []
    chapters.push(...items)
    if (items.length < limit) return chapters
  }
}

export async function listBackendBooks(client = apiClient, options = {}) {
  if (!options || typeof options !== 'object') options = {}
  const cached = getCachedBackendBooks()
  if (options.cacheMode === 'only') return cached
  if (options.cacheMode === 'prefer' && cached.length) return cached
  try {
    ensureBackendToken(client)
    const identity = typeof client.getMe === 'function'
      ? setActiveBackendAccount(await client.getMe(), client)
      : getActiveBackendAccount()
    let mapped
    if (typeof client.getOfflineSnapshot === 'function') {
      const books = []
      for (let offset = 0; ; offset += 20) {
        const page = await client.getOfflineSnapshot({
          book_offset: offset,
          book_limit: 20,
          include_cached_content: true
        })
        ;(page.books || []).forEach(item => {
          books.push(mapBackendBook(item.book || item, item.chapters || []))
        })
        if (!page.has_more) break
      }
      mapped = books
    } else {
      const response = await client.listBooks()
      const books = Array.isArray(response)
        ? response
        : Array.isArray(response && response.books)
          ? response.books
          : []
      mapped = await Promise.all(books.map(async book => {
        const chapters = await listAllBackendChapters(book.id, client).catch(() => [])
        return mapBackendBook(book, chapters)
      }))
    }
    await cacheBackendBooks(mapped, { identity, syncedAt: Date.now() })
    return mapped
  } catch (error) {
    const fallback = getCachedBackendBooks()
    if (fallback.length) {
      Object.defineProperty(fallback, 'offlineFallback', {
        value: true,
        enumerable: false,
        configurable: true
      })
      return fallback
    }
    throw error
  }
}

export async function loadBackendBook(bookId, client = apiClient, options = {}) {
  if (!options || typeof options !== 'object') options = {}
  const cached = getCachedBackendBook(bookId)
  if (options.cacheMode === 'only') {
    if (cached) return cached
    throw new Error('这本云端书籍尚未同步到本机')
  }
  if (options.cacheMode === 'prefer' && cached) return cached
  try {
    ensureBackendToken(client)
    const identity = typeof client.getMe === 'function'
      ? setActiveBackendAccount(await client.getMe(), client)
      : getActiveBackendAccount()
    const id = backendBookId(bookId)
    const [book, chapters] = await Promise.all([
      client.getBook(id),
      listAllBackendChapters(id, client).catch(() => [])
    ])
    const mapped = mapBackendBook(book, chapters)
    const allCached = getCachedBackendBooks(identity).filter(item => item.id !== mapped.id)
    await cacheBackendBooks([mapped, ...allCached], { identity, syncedAt: Date.now() })
    return mapped
  } catch (error) {
    const fallback = getCachedBackendBook(bookId)
    if (fallback) return fallback
    throw error
  }
}

export async function loadBackendReadingHistory(bookId, client = apiClient) {
  try {
    ensureBackendToken(client)
    const id = backendBookId(bookId)
    return await client.getReadingHistory(id)
  } catch (error) {
    return null
  }
}

export async function saveBackendReadingHistory(payload, client = apiClient) {
  const queued = queueBackendReadingProgress(payload)
  if (!queued) return null
  if (!client.getToken()) return { queued: true }
  try {
    const result = await flushBackendOfflineProgress(client)
    return { queued: false, ...result }
  } catch (error) {
    return { queued: true, error }
  }
}

export function deleteBackendBook(book, client = apiClient) {
  const queued = queueBackendBookDelete(book)
  if (!queued) throw new Error('当前云端书籍尚未建立离线镜像，请先刷新书架')
  if (client.getToken()) flushBackendOfflineProgress(client).catch(() => {})
  return { deleted: true, queued: true, mutationId: queued.mutationId }
}

export async function listBackendSources(client = apiClient) {
  ensureBackendToken(client)
  const sources = await client.listSources()
  return (sources || []).map(mapBackendSource)
}

export async function importBackendDemoSource(client = apiClient) {
  ensureBackendToken(client)
  const result = await client.importDemoSource()
  return {
    importedCount: result.imported_count || 0,
    sources: (result.sources || []).map(mapBackendSource)
  }
}

export async function importBackendSources(content, client = apiClient) {
  ensureBackendToken(client)
  const result = await client.importSources(content)
  return {
    importedCount: result.imported_count || 0,
    sources: (result.sources || []).map(mapBackendSource)
  }
}

export async function syncBackendSourceFromLocal(source, client = apiClient) {
  ensureBackendToken(client)
  const raw = source && (source.raw || source)
  if (!raw || typeof raw !== 'object') return null
  const result = await importBackendSources(JSON.stringify(raw), client)
  const name = text(source.name || raw.bookSourceName || raw.sourceName)
  const baseUrl = sourceUrl(source.baseUrl || raw.bookSourceUrl || raw.sourceUrl || raw.baseUrl)
  return result.sources.find(item => item.name === name && sourceUrl(item.baseUrl) === baseUrl) || result.sources[0] || null
}

export async function deleteBackendSourceMatchingLocal(source, client = apiClient) {
  ensureBackendToken(client)
  if (!source) return { deleted: false, id: null }
  if (source.backendId && typeof client.deleteSource === 'function') {
    return client.deleteSource(source.backendId)
  }
  const name = text(source.name || (source.raw && source.raw.bookSourceName))
  const baseUrl = sourceUrl(source.baseUrl || (source.raw && source.raw.bookSourceUrl))
  if (!name || !baseUrl || typeof client.listSources !== 'function' || typeof client.deleteSource !== 'function') {
    return { deleted: false, id: null }
  }
  const sources = await client.listSources()
  const matched = (sources || []).find(item => {
    return text(item.name) === name && sourceUrl(item.base_url || item.baseUrl) === baseUrl
  })
  if (!matched) return { deleted: false, id: null }
  return client.deleteSource(matched.id || matched.backendId)
}

export async function searchBackendBooks(keyword, client = apiClient) {
  ensureBackendToken(client)
  const sources = await client.listSources()
  const enabled = (sources || []).filter(source => source.enabled)
  const groups = await Promise.all(enabled.map(source => {
    return client.searchSource(source.id, { keyword, page: 1 }).then(result => {
      return (result.books || []).map(mapSourceBookResult)
    }).catch(error => [{
      type: 'source-error',
      sourceId: source.id,
      title: source.name,
      subtitle: '后端书源不可用',
      snippet: friendlyErrorMessage(error, '搜索失败')
    }])
  }))
  return groups.flat().slice(0, 80)
}

export async function loadBackendSourceToc(book, client = apiClient) {
  ensureBackendToken(client)
  const result = await client.loadSourceToc(book.sourceId, {
    bookUrl: book.bookUrl,
    tocUrl: book.tocUrl || book.bookUrl
  })
  return (result.chapters || []).map(mapBackendTocChapter)
}

export async function loadBackendSourceContent(book, chapter, client = apiClient) {
  let onlineError = null
  if (!client.getToken()) return loadCachedBackendChapter(book, chapter)
  let resolvedChapter = chapter
  let chapterUrl = text(
    chapter && (chapter.url || chapter.chapterUrl || chapter.chapter_url)
  )

  if (!chapterUrl) {
    const bookId = backendBookId(book)
    const requestedIndex = Number(
      chapter && (
        chapter.chapterIndex !== undefined
          ? chapter.chapterIndex
          : chapter.index !== undefined
            ? chapter.index
            : chapter.chapter_index
      )
    )
    const backendChapters = bookId && typeof client.listChapters === 'function'
      ? await listAllBackendChapters(bookId, client)
      : []
    const matched = (backendChapters || []).find(item => {
      const itemId = numberId(item.id)
      const requestedId = backendChapterId(chapter)
      if (requestedId && itemId === requestedId) return true
      return Number.isFinite(requestedIndex) && Number(item.chapter_index) === requestedIndex
    })
    if (matched) {
      resolvedChapter = mapBackendChapter(matched)
      chapterUrl = text(resolvedChapter.url)
      if (chapter && typeof chapter === 'object') Object.assign(chapter, resolvedChapter)
      if (resolvedChapter.content) return resolvedChapter.content
    }
  }

  if (!chapterUrl) {
    throw new Error('章节地址缺失，已尝试从后端恢复但未找到对应章节')
  }
  try {
    const result = await client.loadSourceContent(book.sourceId, {
      chapterUrl
    })
    const content = result.content || ''
    if (content) await cacheBackendChapter(book, resolvedChapter, content)
    const chapterId = backendChapterId(resolvedChapter)
    if (content && chapterId && typeof client.updateChapterContent === 'function') {
      await client.updateChapterContent(chapterId, content).catch(() => {})
    }
    return content
  } catch (error) {
    onlineError = error
  }
  try {
    return await loadCachedBackendChapter(book, resolvedChapter)
  } catch (cacheError) {
    if (cacheError && cacheError.code === 'OFFLINE_CHAPTER_MISSING') throw cacheError
    throw onlineError || cacheError
  }
}

const pausedDownloads = new Set()

export function pauseBackendBookDownload(bookId) {
  pausedDownloads.add(String(bookId))
}

export async function downloadBackendBook(bookId, options = {}, client = apiClient) {
  const concurrency = Math.max(1, Math.min(2, Number(options.concurrency || 2)))
  const book = typeof bookId === 'object' ? bookId : await loadBackendBook(bookId, client)
  const key = String(book.id)
  pausedDownloads.delete(key)
  const chapters = (book.chapters || []).slice()
  let cursor = 0
  let completed = 0
  const failures = []
  async function worker() {
    while (cursor < chapters.length && !pausedDownloads.has(key)) {
      const chapter = chapters[cursor++]
      try {
        let content = ''
        try {
          if (options.resume !== false) content = await loadCachedBackendChapter(book, chapter)
        } catch (error) {}
        if (!content) content = chapter.content || await loadBackendSourceContent(book, chapter, client)
        if (content) await cacheBackendChapter(book, chapter, content, { pinned: true })
        completed += 1
        if (typeof options.onProgress === 'function') options.onProgress({ completed, total: chapters.length, chapter })
      } catch (error) {
        failures.push({ chapterIndex: chapter.chapterIndex, message: friendlyErrorMessage(error, '章节下载失败') })
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  return { completed, total: chapters.length, paused: pausedDownloads.has(key), failures }
}

export async function preloadBackendChapters(book, chapterIndex, options = {}, client = apiClient) {
  const count = Math.max(0, Math.min(2, Number(options.count === undefined ? 2 : options.count)))
  const targets = (book.chapters || []).slice(Number(chapterIndex) + 1, Number(chapterIndex) + 1 + count)
  for (const chapter of targets) {
    try {
      await loadCachedBackendChapter(book, chapter)
    } catch (error) {
      try {
        const content = chapter.content || await loadBackendSourceContent(book, chapter, client)
        if (content) await cacheBackendChapter(book, chapter, content)
      } catch (preloadError) {}
    }
  }
}

let offlineSyncPromise = null
let lastOfflineSyncAt = 0

export async function syncOfflineLibrary(options = {}, client = apiClient) {
  const reason = options.reason || 'manual'
  if (reason === 'app-show' && Date.now() - lastOfflineSyncAt < 30000) {
    return { reason, skipped: true, books: getCachedBackendBooks(), progress: { pushed: 0, pulled: 0 } }
  }
  if (offlineSyncPromise) return offlineSyncPromise
  offlineSyncPromise = (async () => {
    ensureBackendToken(client)
    const me = await client.getMe()
    const identity = setActiveBackendAccount(me, client)
    const progress = await flushBackendOfflineProgress(client, identity).catch(() => ({ pushed: 0, pulled: 0 }))
    const books = await listBackendBooks(client, { cacheMode: 'refresh' })
    lastOfflineSyncAt = Date.now()
    return { reason, books, progress, identity }
  })()
  try {
    return await offlineSyncPromise
  } finally {
    offlineSyncPromise = null
  }
}

export async function addBackendBookWithChapters(book, chapters, client = apiClient) {
  ensureBackendToken(client)
  const sourceChapters = [...(chapters || [])]
  const normalizedChapters = sourceChapters.filter(chapter => {
    return !!(chapter && (chapter.content || chapter.isCached || chapter.is_cached))
  })
  if (book.sourceId && !normalizedChapters.length && sourceChapters.length) {
    const result = await client.loadSourceContent(book.sourceId, {
      chapterUrl: sourceChapters[0].url
    })
    normalizedChapters.push({
      ...sourceChapters[0],
      content: result.content || '',
      isCached: !!result.content
    })
  }
  const createdBook = await client.createBook(toBackendBookPayload(book))
  const createdChapters = []
  for (const chapter of normalizedChapters) {
    createdChapters.push(await client.createChapter(createdBook.id, toBackendChapterPayload(chapter)))
  }
  return mapBackendBook(createdBook, createdChapters)
}
