import {
  addOnlineBookToShelf,
  getSourceConfig,
  getSourceDiagnostics,
  getSourceExploreEntries,
  loadOnlineBookInfo,
  loadOnlineChapter,
  loadOnlineToc,
  loadSourceExploreBooks,
  testSourceSearch
} from './bookSources.js'
import { friendlyErrorMessage } from './uiFeedback.js'

export const ACCEPTANCE_REPORTS_KEY = 'novel_reader_source_acceptance_reports'

const HISTORY_LIMIT = 10
const STAGE_WEIGHTS = {
  source_meta: 5,
  compatibility: 10,
  explore_parse: 10,
  explore_fetch: 10,
  explore_books: 15,
  search_fallback: 10,
  book_info: 10,
  toc: 10,
  chapter: 15,
  bookshelf: 3,
  continue_read: 2
}

const memoryStore = {}

function readStorage(key, fallback) {
  try {
    if (typeof uni !== 'undefined' && uni.getStorageSync) {
      const value = uni.getStorageSync(key)
      return value === '' || value == null ? fallback : value
    }
  } catch (error) {
    return fallback
  }
  return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : fallback
}

function writeStorage(key, value) {
  try {
    if (typeof uni !== 'undefined' && uni.setStorageSync) {
      uni.setStorageSync(key, value)
      return
    }
  } catch (error) {
    // fall through to memory
  }
  memoryStore[key] = value
}

function defaultAdapters() {
  return {
    addOnlineBookToShelf,
    getSourceConfig,
    getSourceDiagnostics,
    getSourceExploreEntries,
    loadOnlineBookInfo,
    loadOnlineChapter,
    loadOnlineToc,
    loadSourceExploreBooks,
    testSourceSearch
  }
}

function nowIso() {
  return new Date().toISOString()
}

function createStage(key, name, status, startedAt, message = '', detail = {}) {
  return {
    key,
    name,
    status,
    elapsedMs: Math.max(0, Date.now() - startedAt),
    message,
    detail: sanitizeDetail(detail)
  }
}

function sanitizeDetail(detail = {}) {
  if (!detail || typeof detail !== 'object') return {}
  return Object.keys(detail).reduce((result, key) => {
    const value = detail[key]
    if (/^(content|html|text|body)$/i.test(key)) {
      result[`${key}Length`] = String(value || '').length
      return result
    }
    if (typeof value === 'string') {
      result[key] = value.length > 360 ? `${value.slice(0, 360)}...` : value
      return result
    }
    if (Array.isArray(value)) {
      result[key] = value.slice(0, 8).map(item => sanitizeDetail(item))
      return result
    }
    result[key] = value && typeof value === 'object' ? sanitizeDetail(value) : value
    return result
  }, {})
}

function scoreStages(stages) {
  return stages.reduce((score, stage) => {
    if (stage.status !== 'passed') return score
    return score + Number(STAGE_WEIGHTS[stage.key] || 0)
  }, 0)
}

function reportStatus(stages, failureStage) {
  const compatibility = stages.find(stage => stage.key === 'compatibility')
  if (compatibility && compatibility.status === 'incompatible') return 'incompatible'
  if (failureStage) return scoreStages(stages) >= 60 ? 'partial' : 'failed'
  return 'passed'
}

async function runMeasuredStage(stages, key, name, action) {
  const startedAt = Date.now()
  try {
    const result = await action()
    stages.push(createStage(key, name, 'passed', startedAt, result && result.message || 'passed', result && result.detail || {}))
    return result && Object.prototype.hasOwnProperty.call(result, 'value') ? result.value : result
  } catch (error) {
    stages.push(createStage(key, name, 'failed', startedAt, friendlyErrorMessage(error, `${name} failed`), error && error.diagnostics || {}))
    throw error
  }
}

function firstOnlineBook(searchResult) {
  const results = Array.isArray(searchResult && searchResult.results) ? searchResult.results : []
  const item = results.find(result => result && result.type === 'online' && result.book)
  return item && item.book || null
}

export async function runSourceAcceptance(sourceId, options = {}) {
  const adapters = { ...defaultAdapters(), ...(options.adapters || {}) }
  const startedMs = Date.now()
  const report = {
    sourceId,
    sourceName: '',
    startedAt: nowIso(),
    endedAt: '',
    elapsedMs: 0,
    status: 'failed',
    score: 0,
    stages: [],
    firstUsableBook: null,
    failureStage: '',
    failureReason: '',
    suggestions: []
  }

  const fail = (stage, reason) => {
    report.failureStage = stage
    report.failureReason = reason
    report.suggestions = acceptanceSuggestions(stage)
  }

  let source
  let selectedBook = null
  try {
    source = await runMeasuredStage(report.stages, 'source_meta', 'Source metadata', async () => {
      const found = adapters.getSourceConfig(sourceId)
      if (!found) throw new Error('Source not found')
      report.sourceName = found.name || sourceId
      return { value: found, message: found.enabled ? 'source exists and enabled' : 'source exists but disabled' }
    })

    await runMeasuredStage(report.stages, 'compatibility', 'Compatibility', async () => {
      const diagnostics = adapters.getSourceDiagnostics(source)
      if (!diagnostics.compatible) {
        const error = new Error((diagnostics.reasons || []).join(' / ') || 'incompatible source')
        error.acceptanceStatus = 'incompatible'
        throw error
      }
      return { message: 'current H5 rule engine can try this source' }
    })
  } catch (error) {
    const failed = report.stages[report.stages.length - 1]
    if (error && error.acceptanceStatus === 'incompatible' && failed) failed.status = 'incompatible'
    fail(failed && failed.key || 'source_meta', friendlyErrorMessage(error, 'source unavailable'))
    return finishAcceptanceReport(report, startedMs, options.saveReport)
  }

  try {
    const explore = await runMeasuredStage(report.stages, 'explore_parse', 'Explore entries', async () => {
      const result = adapters.getSourceExploreEntries(source)
      if (!result.available || !Array.isArray(result.entries) || !result.entries.length) {
        return { value: null, message: result.reason || 'no explore entry', detail: { available: false } }
      }
      return { value: result, message: `parsed ${result.entries.length} entries`, detail: { count: result.entries.length } }
    })

    if (explore) {
      const entry = explore.entries[0]
      const loaded = await runMeasuredStage(report.stages, 'explore_fetch', 'Explore request', async () => {
        const value = await adapters.loadSourceExploreBooks(source.id, entry, {
          page: 1,
          timeoutMs: options.timeoutMs
        })
        return {
          value,
          message: 'explore request succeeded',
          detail: value.diagnostics || {}
        }
      })
      selectedBook = await runMeasuredStage(report.stages, 'explore_books', 'Explore books', async () => {
        const book = (loaded.books || []).find(item => item && item.bookUrl)
        if (!book) throw new Error('explore page returned no parsable books')
        return { value: book, message: `parsed ${loaded.books.length} books`, detail: { count: loaded.books.length } }
      })
      report.firstUsableBook = {
        title: selectedBook.title,
        author: selectedBook.author || '',
        bookUrl: selectedBook.bookUrl
      }
    }
  } catch (error) {
    fail((report.stages.find(stage => stage.status === 'failed') || {}).key || 'explore_books', friendlyErrorMessage(error, 'explore failed'))
  }

  try {
    if (!selectedBook) {
      selectedBook = await runMeasuredStage(report.stages, 'search_fallback', 'Search fallback', async () => {
        const search = await adapters.testSourceSearch(source.id, options.keyword || '星轨图书馆', {
          timeoutMs: options.timeoutMs,
          limit: options.limit || 5,
          failOnEmpty: true
        })
        const book = firstOnlineBook(search)
        if (!book) throw new Error('search returned no readable online book')
        return { value: book, message: `search returned ${search.count || search.results.length} results` }
      })
    } else {
      report.stages.push(createStage('search_fallback', 'Search fallback', 'passed', Date.now(), 'not needed; explore already returned a book'))
    }

    const info = await runMeasuredStage(report.stages, 'book_info', 'Book info', async () => {
      const value = await adapters.loadOnlineBookInfo(selectedBook, options)
      if (!value || !value.title) throw new Error('book info missing title')
      return { value, message: value.title, detail: { title: value.title, bookUrl: value.bookUrl } }
    })

    const chapters = await runMeasuredStage(report.stages, 'toc', 'TOC', async () => {
      const value = await adapters.loadOnlineToc(info, options)
      if (!Array.isArray(value) || !value.length) throw new Error('TOC is empty')
      return { value, message: `parsed ${value.length} chapters`, detail: { count: value.length } }
    })

    const loadedChapter = await runMeasuredStage(report.stages, 'chapter', 'Chapter content', async () => {
      const chapter = chapters[Math.max(0, Math.min(Number(options.chapterIndex || 0), chapters.length - 1))]
      const value = await adapters.loadOnlineChapter(info, chapter, options)
      const contentLength = String(value && value.content || '').trim().length
      if (contentLength < Number(options.minChapterChars || 20)) throw new Error('chapter content is empty or too short')
      return { value, message: `loaded ${contentLength} chars`, detail: { title: value.title, content: value.content } }
    })

    const shelfBook = await runMeasuredStage(report.stages, 'bookshelf', 'Bookshelf', async () => {
      const value = adapters.addOnlineBookToShelf({
        ...info,
        chapters: chapters.map(chapter => chapter.index === loadedChapter.index ? loadedChapter : chapter)
      })
      return { value, message: 'saved to shelf', detail: { bookId: value.id } }
    })

    await runMeasuredStage(report.stages, 'continue_read', 'Continue read', async () => {
      if (!shelfBook || !Array.isArray(shelfBook.chapters) || !shelfBook.chapters.length) {
        throw new Error('shelf book missing chapters')
      }
      return { message: 'shelf book can reopen chapter list' }
    })
  } catch (error) {
    const failed = report.stages.find(stage => stage.status === 'failed')
    fail(failed && failed.key || 'search_fallback', friendlyErrorMessage(error, 'reading chain failed'))
  }

  return finishAcceptanceReport(report, startedMs, options.saveReport)
}

function finishAcceptanceReport(report, startedMs, shouldSave) {
  report.endedAt = nowIso()
  report.elapsedMs = Date.now() - startedMs
  report.score = Math.min(100, scoreStages(report.stages))
  report.status = reportStatus(report.stages, report.failureStage)
  if (shouldSave) saveSourceAcceptanceReport(report)
  return report
}

export function saveSourceAcceptanceReport(report) {
  const store = readStorage(ACCEPTANCE_REPORTS_KEY, {})
  const sourceId = report.sourceId || 'unknown'
  const current = store[sourceId] || { latest: null, history: [] }
  const history = [report, ...(current.history || [])].slice(0, HISTORY_LIMIT)
  store[sourceId] = {
    latest: report,
    history
  }
  writeStorage(ACCEPTANCE_REPORTS_KEY, store)
  return store[sourceId]
}

export function getSourceAcceptanceReports(sourceId = '') {
  const store = readStorage(ACCEPTANCE_REPORTS_KEY, {})
  if (sourceId) return store[sourceId] || { latest: null, history: [] }
  return store
}

export function clearSourceAcceptanceReports(sourceId = '') {
  if (!sourceId) {
    writeStorage(ACCEPTANCE_REPORTS_KEY, {})
    return true
  }
  const store = readStorage(ACCEPTANCE_REPORTS_KEY, {})
  const existed = !!store[sourceId]
  delete store[sourceId]
  writeStorage(ACCEPTANCE_REPORTS_KEY, store)
  return existed
}

export function buildCopyableAcceptanceReport(report) {
  return JSON.stringify(sanitizeDetail(report), null, 2)
}

function acceptanceSuggestions(stage) {
  const suggestions = {
    compatibility: ['Do not execute third-party JS or WebView-only rules.', 'Use search with a compatible source instead.'],
    explore_parse: ['Check whether exploreUrl still exists.', 'Use source search if the source has no category entry.'],
    explore_fetch: ['Check proxy, charset, User-Agent, Cookie and Referer settings.'],
    explore_books: ['Check ruleExplore first.', 'If ruleExplore is empty, confirm whether ruleSearch can parse category pages.'],
    search_fallback: ['Check searchUrl and ruleSearch.', 'Run single-source search test.'],
    book_info: ['Check detail URL and ruleBookInfo.'],
    toc: ['Check ruleToc and catalog URL.'],
    chapter: ['Check ruleContent, anti-crawler settings and response body.'],
    bookshelf: ['Check local storage capacity and shelf data format.'],
    continue_read: ['Check shelf persistence and navigation parameters.']
  }
  return suggestions[stage] || ['Check the failed stage details and retry after adjusting the source rule.']
}
