import {
  applyListRule,
  applyRule,
  cleanText,
  hasUnsupportedRule,
  normalizeSourceConfig,
  parseRequestSpec,
  parseResponsePayload,
  parseSourceJson,
  requestText,
  resolveUrl
} from './sourceEngine.js'

const USER_SOURCES_KEY = 'sources:user'
const SOURCE_SETTINGS_KEY = 'sources:settings'
const ONLINE_BOOKS_KEY = 'sources:online-books'
const ONLINE_DRAFT_KEY = 'sources:online-draft'
const chapterCacheKey = (bookId, chapterIndex) => `sources:chapter:${bookId}:${chapterIndex}`

const memoryStore = {}

const builtInSourceRaws = [
  {
    bookSourceName: '小说之家',
    bookSourceUrl: 'https://www.xszj.org',
    bookSourceGroup: '内置精选',
    searchUrl: 'https://www.xszj.org/search.html?keyword={{key}}',
    ruleSearch: {
      bookList: '.novelslist2 li||.search-list li||.result-list li',
      name: 'h3 a@text||a@text',
      author: '.s1@text||.author@text',
      kind: '.s2@text||.kind@text',
      latestChapter: '.s3 a@text||.last a@text',
      bookUrl: 'h3 a@href||a@href'
    },
    ruleBookInfo: {
      name: 'h1@text||.book-title@text',
      author: '.info@text##.*作者[:： ]*([^\\s/]+).*##$1||.author@text',
      coverUrl: '.cover img@src||img@src',
      intro: '#intro@text||.intro@text||.book-intro@text',
      tocUrl: '.list a@href'
    },
    ruleToc: {
      chapterList: '.chapterlist li a||.listmain dd a||.chapter-list a',
      chapterName: '@text||a@text',
      chapterUrl: '@href||a@href'
    },
    ruleContent: {
      content: '#content@text||.content@text||.chapter-content@text'
    }
  },
  {
    bookSourceName: '友友小说',
    bookSourceUrl: 'https://www.youyouxs.com',
    bookSourceGroup: '内置精选',
    searchUrl: 'https://www.youyouxs.com/search.html?keyword={{key}}',
    ruleSearch: {
      bookList: '.result-list li||.bookbox||.search-list li',
      name: 'h3 a@text||h4 a@text||a@text',
      author: '.author@text||.s1@text',
      kind: '.kind@text||.s2@text',
      latestChapter: '.last a@text||.s3 a@text',
      bookUrl: 'h3 a@href||h4 a@href||a@href'
    },
    ruleBookInfo: {
      name: 'h1@text||.book-name@text',
      author: '.author@text||.info@text##.*作者[:： ]*([^\\s/]+).*##$1',
      coverUrl: '.cover img@src||img@src',
      intro: '.intro@text||#intro@text',
      tocUrl: '.catalog a@href||.list a@href'
    },
    ruleToc: {
      chapterList: '.catalog-list a||.chapter-list a||.listmain dd a',
      chapterName: '@text',
      chapterUrl: '@href'
    },
    ruleContent: {
      content: '#content@text||.content@text||.read-content@text'
    }
  },
  {
    bookSourceName: '卡夜阁',
    bookSourceUrl: 'https://m.kayege.info',
    bookSourceGroup: '内置精选',
    searchUrl: 'https://m.kayege.info/search.html?keyword={{key}}',
    ruleSearch: {
      bookList: '.bookbox||.result-item||.search-list li',
      name: '.bookname a@text||h4 a@text||a@text',
      author: '.author@text||.bookilnk@text##.*作者[:： ]*([^\\s/]+).*##$1',
      kind: '.cat@text||.kind@text',
      latestChapter: '.update a@text||.last a@text',
      bookUrl: '.bookname a@href||h4 a@href||a@href'
    },
    ruleBookInfo: {
      name: 'h1@text||.bookname@text',
      author: '.author@text||.info@text##.*作者[:： ]*([^\\s/]+).*##$1',
      coverUrl: '.bookimg img@src||.cover img@src||img@src',
      intro: '.intro@text||#intro@text',
      tocUrl: '.readbtn a@href||.list a@href'
    },
    ruleToc: {
      chapterList: '.chapter li a||.listmain dd a||.chapter-list a',
      chapterName: '@text',
      chapterUrl: '@href'
    },
    ruleContent: {
      content: '#chaptercontent@text||#content@text||.content@text'
    }
  }
]

const builtInSources = builtInSourceRaws.map(raw => normalizeSourceConfig(raw, {
  group: '内置精选',
  enabled: true,
  importedAt: 0
}))

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

function normalizeRuleObject(rule) {
  if (!rule) return {}
  if (typeof rule === 'object') return rule
  try {
    return JSON.parse(rule)
  } catch (error) {
    return {}
  }
}

function getFieldRule(rule, names) {
  return names.map(name => rule[name]).find(Boolean) || ''
}

function firstValue(value) {
  if (Array.isArray(value)) return value.find(item => cleanText(item)) || ''
  return value || ''
}

function pickText(input, rule, names, context) {
  return cleanText(firstValue(applyRule(input, getFieldRule(rule, names), context)))
}

function pickUrl(input, rule, names, context, baseUrl) {
  return resolveUrl(firstValue(applyRule(input, getFieldRule(rule, names), context)), baseUrl)
}

function getUserSources() {
  return readStorage(USER_SOURCES_KEY, [])
}

function writeUserSources(sources) {
  writeStorage(USER_SOURCES_KEY, sources)
}

function getSourceSettings() {
  return readStorage(SOURCE_SETTINGS_KEY, {})
}

function writeSourceSettings(settings) {
  writeStorage(SOURCE_SETTINGS_KEY, settings)
}

export function getSourceConfigs() {
  const settings = getSourceSettings()
  return [...builtInSources, ...getUserSources()].map(source => {
    const saved = settings[source.id] || {}
    return {
      ...source,
      enabled: saved.enabled !== undefined ? saved.enabled : source.enabled,
      updatedAt: saved.updatedAt || source.updatedAt,
      lastTest: saved.lastTest || source.lastTest || ''
    }
  })
}

export function getSourceConfig(sourceId) {
  return getSourceConfigs().find(source => source.id === sourceId)
}

export function setSourceEnabled(sourceId, enabled) {
  const settings = getSourceSettings()
  settings[sourceId] = {
    ...(settings[sourceId] || {}),
    enabled: !!enabled,
    updatedAt: Date.now()
  }
  writeSourceSettings(settings)
}

export function deleteUserSource(sourceId) {
  writeUserSources(getUserSources().filter(source => source.id !== sourceId))
  const settings = getSourceSettings()
  delete settings[sourceId]
  writeSourceSettings(settings)
}

export function importSourcesFromJson(text) {
  const sources = parseSourceJson(text)
  const current = getUserSources()
  const next = [
    ...sources,
    ...current.filter(source => !sources.some(item => item.id === source.id))
  ]
  writeUserSources(next)
  return sources.length
}

export async function importSourcesFromUrl(url) {
  const spec = parseRequestSpec(url, {}, url)
  const text = await requestText(spec)
  try {
    return importSourcesFromJson(text)
  } catch (error) {
    const directJsonUrl = extractJsonLink(text, spec.url)
    if (!directJsonUrl) throw error
    const jsonText = await requestText(parseRequestSpec(directJsonUrl, {}, directJsonUrl))
    return importSourcesFromJson(jsonText)
  }
}

export function saveOnlineBookDraft(book) {
  writeStorage(ONLINE_DRAFT_KEY, book)
}

export function getOnlineBookDraft() {
  return readStorage(ONLINE_DRAFT_KEY, null)
}

export function getOnlineShelfBooks() {
  return readStorage(ONLINE_BOOKS_KEY, []).map(normalizeOnlineBookForShelf)
}

export function getOnlineBook(bookId) {
  return getOnlineShelfBooks().find(book => book.id === bookId)
}

export function addOnlineBookToShelf(book) {
  const normalized = normalizeOnlineBookForShelf(book)
  const current = getOnlineShelfBooks().filter(item => item.id !== normalized.id)
  writeStorage(ONLINE_BOOKS_KEY, [normalized, ...current])
  return normalized
}

export async function searchOnlineBooks(keyword) {
  const word = String(keyword || '').trim()
  if (!word) return []

  const sources = getSourceConfigs().filter(source => source.enabled && !hasUnsupportedRule(source.raw))
  const searches = sources.map(source => searchSource(source, word).catch(error => {
    return [{
      type: 'source-error',
      sourceId: source.id,
      title: source.name,
      subtitle: '书源不可用',
      snippet: error.message || '搜索失败'
    }]
  }))
  const groups = await Promise.all(searches)
  return groups.flat().slice(0, 80)
}

export async function loadOnlineBookInfo(book) {
  const source = getSourceConfig(book.sourceId)
  if (!source) throw new Error('书源不存在或已删除')
  const rule = normalizeRuleObject(source.raw.ruleBookInfo)
  if (!Object.keys(rule).length) return book

  const html = await requestText(parseRequestSpec(book.bookUrl, {}, source.baseUrl))
  const payload = parseResponsePayload(html)
  const context = { ...book, $: payload }
  const next = {
    ...book,
    title: pickText(payload, rule, ['name', 'bookName', 'title'], context) || book.title,
    author: pickText(payload, rule, ['author', 'bookAuthor'], context) || book.author,
    intro: pickText(payload, rule, ['intro', 'description', 'desc'], context) || book.intro,
    kind: pickText(payload, rule, ['kind', 'category', 'type'], context) || book.kind,
    latestChapter: pickText(payload, rule, ['latestChapter', 'lastChapter', 'last'], context) || book.latestChapter,
    coverUrl: pickUrl(payload, rule, ['coverUrl', 'cover', 'image'], context, source.baseUrl) || book.coverUrl,
    tocUrl: pickUrl(payload, rule, ['tocUrl', 'chapterUrl', 'catalogUrl'], context, book.bookUrl) || book.tocUrl || book.bookUrl
  }
  return normalizeOnlineBookForShelf(next)
}

export async function loadOnlineToc(book) {
  const source = getSourceConfig(book.sourceId)
  if (!source) throw new Error('书源不存在或已删除')
  const rule = normalizeRuleObject(source.raw.ruleToc)
  if (!Object.keys(rule).length) throw new Error('这个书源没有目录规则')

  const tocUrl = book.tocUrl || book.bookUrl
  const html = await requestText(parseRequestSpec(tocUrl, book, source.baseUrl))
  const payload = parseResponsePayload(html)
  const listRule = getFieldRule(rule, ['chapterList', 'list', 'toc'])
  const list = applyListRule(payload, listRule, { ...book, $: payload })
  const chapters = list.map((item, index) => {
    const context = { ...book, index, $: item }
    const title = pickText(item, rule, ['chapterName', 'name', 'title'], context) || `第 ${index + 1} 章`
    const url = pickUrl(item, rule, ['chapterUrl', 'url', 'link'], context, tocUrl)
    return {
      title,
      url,
      index,
      isCached: !!readStorage(chapterCacheKey(book.id, index), '')
    }
  }).filter(chapter => chapter.title && chapter.url)

  if (!chapters.length) throw new Error('目录解析为空，请换一个书源')
  return chapters
}

export async function loadOnlineChapter(book, chapter) {
  const cached = readStorage(chapterCacheKey(book.id, chapter.index), '')
  if (cached) return { ...chapter, content: cached, isCached: true }

  const source = getSourceConfig(book.sourceId)
  if (!source) throw new Error('书源不存在或已删除')
  const rule = normalizeRuleObject(source.raw.ruleContent)
  if (!Object.keys(rule).length) throw new Error('这个书源没有正文规则')

  const html = await requestText(parseRequestSpec(chapter.url, { ...book, ...chapter }, source.baseUrl))
  const payload = parseResponsePayload(html)
  const content = pickText(payload, rule, ['content', 'text'], { ...book, ...chapter, $: payload })
  if (!content) throw new Error('正文解析为空，请换一个书源')

  writeStorage(chapterCacheKey(book.id, chapter.index), content)
  return { ...chapter, content, isCached: true }
}

async function searchSource(source, keyword) {
  const raw = source.raw || {}
  const rule = normalizeRuleObject(raw.ruleSearch)
  if (!raw.searchUrl || !Object.keys(rule).length) return []

  const html = await requestText(parseRequestSpec(raw.searchUrl, { key: keyword, keyword, page: 1 }, source.baseUrl))
  const payload = parseResponsePayload(html)
  const listRule = getFieldRule(rule, ['bookList', 'list', 'books'])
  const list = applyListRule(payload, listRule, { key: keyword, keyword, page: 1, $: payload })

  return list.map(item => {
    const context = { key: keyword, keyword, $: item }
    const book = normalizeOnlineBookForShelf({
      sourceId: source.id,
      sourceName: source.name,
      sourceGroup: source.group,
      bookUrl: pickUrl(item, rule, ['bookUrl', 'url', 'link'], context, source.baseUrl),
      title: pickText(item, rule, ['name', 'bookName', 'title'], context),
      author: pickText(item, rule, ['author', 'bookAuthor'], context) || '未知作者',
      kind: pickText(item, rule, ['kind', 'category', 'type'], context) || '在线书源',
      latestChapter: pickText(item, rule, ['latestChapter', 'lastChapter', 'last'], context),
      intro: pickText(item, rule, ['intro', 'description', 'desc'], context),
      coverUrl: pickUrl(item, rule, ['coverUrl', 'cover', 'image'], context, source.baseUrl)
    })

    return {
      type: 'online',
      bookId: book.id,
      title: book.title,
      subtitle: `${book.author} · ${source.name}`,
      snippet: book.latestChapter || book.kind || '在线书源结果',
      book
    }
  }).filter(result => result.book.bookUrl && result.book.title)
}

function normalizeOnlineBookForShelf(book) {
  const id = book.id || createOnlineBookId(book.sourceId, book.bookUrl)
  return {
    id,
    source: 'online',
    sourceId: book.sourceId,
    sourceName: book.sourceName || (getSourceConfig(book.sourceId) || {}).name || '在线书源',
    sourceGroup: book.sourceGroup || '',
    bookUrl: book.bookUrl,
    tocUrl: book.tocUrl || book.bookUrl,
    title: cleanText(book.title) || '未命名小说',
    author: cleanText(book.author) || '未知作者',
    category: cleanText(book.kind || book.category) || '在线书源',
    kind: cleanText(book.kind) || '在线书源',
    latestChapter: cleanText(book.latestChapter),
    intro: cleanText(book.intro),
    description: cleanText(book.intro) || `${book.sourceName || '在线书源'} · 在线阅读`,
    coverUrl: book.coverUrl || '',
    coverColor: '#506f89',
    accent: '#31584f',
    chapters: (book.chapters || []).map((chapter, index) => ({
      title: chapter.title || `第 ${index + 1} 章`,
      url: chapter.url,
      index,
      isCached: !!chapter.isCached,
      content: chapter.content || ''
    })),
    addedAt: book.addedAt || Date.now(),
    updatedAt: Date.now()
  }
}

function createOnlineBookId(sourceId, bookUrl) {
  const base = `${sourceId}:${bookUrl}`
  let hash = 0
  for (let index = 0; index < base.length; index += 1) {
    hash = ((hash << 5) - hash) + base.charCodeAt(index)
    hash |= 0
  }
  return `online-${Math.abs(hash).toString(36)}`
}

function extractJsonLink(html, baseUrl) {
  const text = String(html || '')
  const direct = text.match(/https?:\/\/[^"'<> ]+\.json[^"'<> ]*/i)
  if (direct) return direct[0]

  const links = text.match(/(?:href|data-url|url)=["']([^"']+(?:json|download|shuyuan)[^"']*)["']/ig) || []
  const found = links
    .map(link => (link.match(/(?:href|data-url|url)=["']([^"']+)["']/i) || [])[1])
    .find(Boolean)
  return found ? resolveUrl(found, baseUrl) : ''
}
