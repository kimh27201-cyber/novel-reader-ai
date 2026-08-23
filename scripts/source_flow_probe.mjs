import {
  applyImportPreview,
  buildImportPreview,
  loadOnlineBookInfo,
  loadOnlineChapter,
  loadOnlineToc,
  normalizeBookSources,
  runSourceReadingFlow,
  searchSourceBooks
} from '../common/bookSources.js'
import { classifySourceFailure } from '../common/sourceErrors.js'
import { installNodeLegacyRequestBodyEncoder } from './node_legacy_charset.mjs'

installNodeLegacyRequestBodyEncoder()

const ids = process.argv.slice(2).filter(value => /^\d+$/.test(value))
const traceStages = process.argv.includes('--trace')
const store = {}
globalThis.uni = {
  getStorageSync(key) { return store[key] },
  setStorageSync(key, value) { store[key] = value },
  removeStorageSync(key) { delete store[key] }
}

async function fetchSourceJson(id) {
  const url = `https://www.yckceo.com/yuedu/shuyuan/json/id/${id}.json`
  let lastError
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'NovelReader-Probe/3.1' } })
      if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status })
      return { url, raw: await response.json() }
    } catch (error) {
      lastError = error
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)))
    }
  }
  throw lastError
}

function safeUrl(value) {
  try {
    const parsed = new URL(String(value || ''))
    return `${parsed.origin}${parsed.pathname}`
  } catch (error) {
    return ''
  }
}

function jsonShape(value, depth = 0) {
  if (depth >= 4) return Array.isArray(value) ? `array(${value.length})` : typeof value
  if (Array.isArray(value)) return { type: 'array', length: value.length, item: value.length ? jsonShape(value[0], depth + 1) : null }
  if (!value || typeof value !== 'object') return typeof value
  return Object.fromEntries(Object.keys(value).slice(0, 20).map(key => [key, jsonShape(value[key], depth + 1)]))
}

function htmlShape(text, pageUrl) {
  const classNames = [...String(text || '').matchAll(/\bclass=["']([^"']+)["']/gi)]
    .flatMap(match => match[1].split(/\s+/))
    .filter(Boolean)
  const anchors = [...String(text || '').matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
  let pageOrigin = ''
  try { pageOrigin = new URL(pageUrl).origin } catch (error) {}
  const sameOriginLinks = anchors.filter(match => {
    const href = String(match[1] || '').match(/\bhref=["']([^"']+)["']/i)
    if (!href) return false
    try { return new URL(href[1], pageUrl).origin === pageOrigin } catch (error) { return false }
  })
  const chapterLabels = anchors.filter(match => /^(?:第.{1,30}[章回卷集部篇]|(?:chapter|chap\.?)\s*\d+|\d{1,6}[\s、.．_-])/i.test(String(match[2] || '').replace(/<[^>]+>/g, '').trim()))
  return {
    type: 'html',
    length: String(text || '').length,
    classNames: [...new Set(classNames)].slice(0, 30),
    anchorCount: anchors.length,
    sameOriginLinkCount: sameOriginLinks.length,
    chapterLabelCount: chapterLabels.length
  }
}

async function traceSourceFlow(id, source) {
  const keywords = ['斗破苍穹', '剑来', '诡秘之主']
  let first = null
  for (const keyword of keywords) {
    const search = await searchSourceBooks(source.id, keyword, { timeoutMs: 10000, allowDisabled: true })
    first = search.results.find(item => item && item.type === 'online' && item.book)
    if (first) break
  }
  if (!first) throw new Error('搜索结果为空')
  process.stdout.write(`${JSON.stringify({ id, trace: 'search', title: first.title, bookUrl: safeUrl(first.book.bookUrl), metadataOrigin: first.metadataOrigin || '' })}\n`)
  const info = await loadOnlineBookInfo(first.book)
  process.stdout.write(`${JSON.stringify({ id, trace: 'bookInfo', title: info.title, bookUrl: safeUrl(info.bookUrl), tocUrl: safeUrl(info.tocUrl), kindLength: String(info.kind || '').length })}\n`)
  if (/^https?:\/\//i.test(String(info.tocUrl || ''))) {
    try {
      const response = await fetch(info.tocUrl, { headers: { 'User-Agent': 'NovelReader-Probe/3.1' } })
      const text = await response.text()
      let shape = htmlShape(text, info.tocUrl)
      try { shape = jsonShape(JSON.parse(text)) } catch (error) {}
      process.stdout.write(`${JSON.stringify({ id, trace: 'tocResponse', status: response.status, shape })}\n`)
    } catch (error) {
      process.stdout.write(`${JSON.stringify({ id, trace: 'tocResponse', errorCode: String(error && error.code || error && error.name || 'NETWORK_ERROR') })}\n`)
    }
  }
  const chapters = await loadOnlineToc(info)
  process.stdout.write(`${JSON.stringify({ id, trace: 'toc', count: chapters.length, firstUrl: safeUrl(chapters[0] && chapters[0].url), metadataOrigin: chapters[0] && chapters[0].metadataOrigin || '' })}\n`)
  const chapter = await loadOnlineChapter(info, chapters[0])
  process.stdout.write(`${JSON.stringify({ id, trace: 'content', length: String(chapter.content || '').length })}\n`)
}

for (const id of ids) {
  let loaded
  try {
    loaded = await fetchSourceJson(id)
  } catch (error) {
    const failure = classifySourceFailure(error)
    process.stdout.write(`${JSON.stringify({ id, status: 'fetch_failed', errorCode: failure.errorCode, retryable: failure.retryable })}\n`)
    continue
  }
  const { url, raw } = loaded
  const source = normalizeBookSources(raw, { source: 'probe', sourceUrl: url })[0]
  applyImportPreview(buildImportPreview([source], []), { importMethod: 'probe' })
  try {
    if (traceStages) {
      await traceSourceFlow(id, source)
      continue
    }
    const flow = await runSourceReadingFlow(source.id, ['斗破苍穹', '剑来', '诡秘之主'], {
      timeoutMs: 10000,
      allowDisabled: true,
      minimumChapters: 3,
      bookCandidateLimit: 3
    })
    process.stdout.write(`${JSON.stringify({ id, name: source.name, status: 'passed', keyword: flow.keyword, chapters: flow.chapters.length, contentLength: String(flow.chapter.content || '').length })}\n`)
  } catch (error) {
    const failedStage = Array.isArray(error && error.flowStages)
      ? [...error.flowStages].reverse().find(stage => stage.status === 'failed')
      : null
    const failure = classifySourceFailure(error, { stage: failedStage && failedStage.id })
    process.stdout.write(`${JSON.stringify({
      id,
      name: source.name,
      status: 'failed',
      errorCode: failedStage && failedStage.errorCode || failure.errorCode,
      failedStage: failedStage && failedStage.id || failure.stage,
      httpStatus: failedStage && failedStage.httpStatus || failure.status,
      retryable: failedStage ? failedStage.retryable === true : failure.retryable,
      diagnostics: error && error.diagnostics || undefined,
      message: String(error && error.message || '').replace(/https?:\/\/\S+/g, '<url>').slice(0, 240),
      stages: Array.isArray(error && error.flowStages) ? error.flowStages.map(stage => ({ id: stage.id, status: stage.status, errorCode: stage.errorCode || '', httpStatus: stage.httpStatus || 0, message: String(stage.message || '').replace(/https?:\/\/\S+/g, '<url>').slice(0, 120) })) : []
    })}\n`)
  }
}
