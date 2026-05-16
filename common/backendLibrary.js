import apiClient from './apiClient.js'

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
  return {
    title: text(book.title, '未命名'),
    author: text(book.author, '未知作者'),
    cover_url: book.coverUrl || book.cover_url || '',
    description: book.description || book.intro || book.latestChapter || '',
    book_url: book.bookUrl || book.book_url || '',
    toc_url: book.tocUrl || book.toc_url || book.bookUrl || book.book_url || '',
    source_id: book.sourceId || book.source_id || null
  }
}

export function toBackendChapterPayload(chapter) {
  return {
    chapter_index: Number(chapter.chapterIndex ?? chapter.index ?? chapter.chapter_index ?? 0),
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

export async function listBackendBooks(client = apiClient) {
  ensureBackendToken(client)
  const books = await client.listBooks()
  const mapped = await Promise.all((books || []).map(async book => {
    const chapters = await client.listChapters(book.id).catch(() => [])
    return mapBackendBook(book, chapters)
  }))
  return mapped
}

export async function loadBackendBook(bookId, client = apiClient) {
  ensureBackendToken(client)
  const id = backendBookId(bookId)
  const [book, chapters] = await Promise.all([
    client.getBook(id),
    client.listChapters(id).catch(() => [])
  ])
  return mapBackendBook(book, chapters)
}

export async function loadBackendReadingHistory(bookId, client = apiClient) {
  ensureBackendToken(client)
  const id = backendBookId(bookId)
  return client.getReadingHistory(id).catch(() => null)
}

export async function saveBackendReadingHistory(payload, client = apiClient) {
  ensureBackendToken(client)
  return client.saveReadingHistory(toReadingHistoryPayload(payload))
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
      snippet: error.message || '搜索失败'
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
  ensureBackendToken(client)
  const result = await client.loadSourceContent(book.sourceId, {
    chapterUrl: chapter.url
  })
  return result.content || ''
}

export async function addBackendBookWithChapters(book, chapters, client = apiClient) {
  ensureBackendToken(client)
  const createdBook = await client.createBook(toBackendBookPayload(book))
  const createdChapters = []
  for (const chapter of chapters) {
    createdChapters.push(await client.createChapter(createdBook.id, toBackendChapterPayload(chapter)))
  }
  return mapBackendBook(createdBook, createdChapters)
}
