import {
  cleanText,
  decodeHtml,
  extractImportLinkUrl,
  extractRepositorySourceUrl,
  normalizeSourceConfig,
  parseRequestSpec,
  parseSourceJson,
  requestText,
  resolveUrl
} from './sourceEngine.js'
import { analyzeBookSourceCompatibility } from './bookSources.js'

export const DEFAULT_SOURCE_MARKET_MANIFEST = [
  {
    providerId: 'yckceo',
    name: '源仓库',
    baseUrl: 'https://www.yckceo.com/yuedu/shuyuan/index.html',
    enabled: true,
    priority: 10,
    updatedAt: '2026-05-28'
  },
  {
    providerId: 'yck2026',
    name: '备用仓库',
    baseUrl: 'https://www.yck2026.top/yuedu/shuyuan/index.html',
    enabled: true,
    priority: 20,
    updatedAt: '2026-05-28'
  }
]

export const RECOMMENDED_SOURCE_CANDIDATES = [
  {
    providerId: 'yckceo',
    name: '速读谷',
    detailUrl: 'https://www.yckceo.com/yuedu/shuyuan/content/id/7163.html',
    baseUrl: 'https://www.sudugu.org/',
    testKeyword: '斗破苍穹',
    verifiedAt: '2026-05-29'
  }
]

export function normalizeSourceMarketManifest(manifest = DEFAULT_SOURCE_MARKET_MANIFEST) {
  const list = Array.isArray(manifest) ? manifest : DEFAULT_SOURCE_MARKET_MANIFEST
  return list
    .map(item => ({
      providerId: String(item.providerId || '').trim(),
      name: cleanText(item.name || item.label || item.providerId),
      baseUrl: String(item.baseUrl || '').trim(),
      enabled: item.enabled !== false,
      priority: Number(item.priority || 100),
      updatedAt: String(item.updatedAt || '')
    }))
    .filter(item => item.providerId && item.name && item.baseUrl && item.enabled)
    .sort((left, right) => left.priority - right.priority)
}

export function getSourceMarketProviders(manifest = DEFAULT_SOURCE_MARKET_MANIFEST) {
  return normalizeSourceMarketManifest(manifest).reduce((result, item) => {
    result[item.providerId] = {
      label: item.name,
      baseUrl: item.baseUrl,
      priority: item.priority,
      updatedAt: item.updatedAt
    }
    return result
  }, {})
}

export const SOURCE_MARKET_PROVIDERS = getSourceMarketProviders()

export function createSourceMarketUrl(options = {}) {
  const provider = SOURCE_MARKET_PROVIDERS[options.provider] || SOURCE_MARKET_PROVIDERS.yckceo
  const params = []
  const keyword = String(options.keyword || '').trim()
  if (keyword) params.push(`key=${encodeURIComponent(keyword)}`)
  const page = Math.max(1, Number(options.page || 1))
  if (page > 1) params.push(`page=${page}`)
  return params.length ? `${provider.baseUrl}?${params.join('&')}` : provider.baseUrl
}

export function parseSourceMarketItems(html, baseUrl = SOURCE_MARKET_PROVIDERS.yckceo.baseUrl) {
  const text = String(html || '')
  const matches = [...text.matchAll(/<a\b[^>]*href=["']([^"']*\/(?:yuedu\/)?shuyuan\/content\/id\/\d+\.html[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  return matches.map((match, index) => {
    const next = matches[index + 1] ? matches[index + 1].index : text.length
    const context = cleanText(text.slice(match.index, Math.min(next, match.index + 900)))
    const rawTitle = cleanText(decodeHtml(match[2]))
    const baseUrlMatch = rawTitle.match(/https?:\/\/[^\s"'<>]+/i)
    const baseSourceUrl = baseUrlMatch ? baseUrlMatch[0].replace(/[，。,.]$/, '') : ''
    const title = cleanText(baseSourceUrl ? rawTitle.replace(baseSourceUrl, '') : rawTitle)
    const downloadMatch = context.match(/下载[:：]?\s*(\d+)/)
    const userMatch = context.match(/用户[:：]?\s*([^\s下载]+)/)
    const tags = ['3.X', '2.X', '发', '搜', '图', '声']
      .filter(tag => context.includes(tag))
    const timeMatch = context.match(/(\d{2}\/\d{2}(?:\s+\d{2}:\d{2})?|\d+\s*(?:分钟|小时|天)前|昨天|今天)/)
    const group = context.split(/[·\n]/)
      .map(item => cleanText(item))
      .find(item => item && !item.includes(rawTitle) && !item.includes('用户') && !item.includes('下载') && !tags.includes(item)) || ''

    return {
      id: createMarketItemId(resolveUrl(match[1], baseUrl)),
      title: title || rawTitle || '未命名书源',
      baseUrl: baseSourceUrl,
      detailUrl: resolveUrl(match[1], baseUrl),
      provider: detectProvider(baseUrl),
      group,
      tags,
      user: userMatch ? userMatch[1] : '',
      downloads: downloadMatch ? Number(downloadMatch[1]) : 0,
      updatedLabel: timeMatch ? timeMatch[1] : ''
    }
  }).filter(item => item.detailUrl)
}

export async function fetchSourceMarketItems(options = {}) {
  const url = options.url || createSourceMarketUrl(options)
  const text = await requestText(parseRequestSpec(url, {}, url))
  return parseSourceMarketItems(text, url)
}

export async function fetchSourceMarketPages(options = {}) {
  const startPage = Math.max(1, Number(options.page || 1))
  const pageCount = Math.max(1, Math.min(10, Number(options.pageCount || 1)))
  const pages = await Promise.all(Array.from({ length: pageCount }, (_, index) => {
    const page = startPage + index
    return fetchSourceMarketItems({ ...options, page, url: '' })
  }))
  const seen = new Set()
  return pages.flat().filter(item => {
    if (seen.has(item.detailUrl)) return false
    seen.add(item.detailUrl)
    return true
  })
}

export async function fetchSourceMarketItemsWithFallback(options = {}) {
  if (options.url) {
    const items = await fetchSourceMarketItems(options)
    return {
      items,
      provider: detectProvider(options.url),
      url: options.url,
      fallback: false,
      errors: []
    }
  }

  const providers = Object.keys(SOURCE_MARKET_PROVIDERS)
  const preferred = SOURCE_MARKET_PROVIDERS[options.provider] ? options.provider : providers[0]
  const queue = [preferred, ...providers.filter(provider => provider !== preferred)]
  const errors = []
  let emptyResult = null

  for (const provider of queue) {
    const url = createSourceMarketUrl({ ...options, provider })
    try {
      const items = await fetchSourceMarketItems({ ...options, provider, url })
      const result = {
        items,
        provider,
        url,
        fallback: provider !== preferred,
        errors
      }
      if (items.length) return result
      if (!emptyResult) emptyResult = result
    } catch (error) {
      errors.push({
        provider,
        message: error && error.message ? error.message : String(error || 'unknown error')
      })
    }
  }

  if (emptyResult) return { ...emptyResult, errors }
  const message = errors.map(item => `${item.provider}: ${item.message}`).join('；')
  throw new Error(message || '无法访问源仓库')
}

export function resolveMarketScanTarget(payload) {
  const rawInput = String(payload || '').trim()
  const raw = extractImportLinkUrl(rawInput) || rawInput
  if (/^https?:\/\/.+\/yuedu\/shuyuan\/json\/id\/\d+\.json(?:[?#].*)?$/i.test(raw)) {
    return { type: 'json', url: raw }
  }
  if (/^https?:\/\/.+\/yuedu\/shuyuan\/content\/id\/\d+\.html(?:[?#].*)?$/i.test(raw)) {
    return { type: 'detail', url: raw }
  }
  if (/^https?:\/\/.+\/yuedu\/shuyuan\/index\.html(?:[?#].*)?$/i.test(raw) || /yck(?:ceo|2026)\.(?:com|top)\/yuedu\/shuyuan/i.test(raw)) {
    return { type: 'market', url: raw }
  }
  return { type: 'unknown', url: raw }
}

export async function fetchMarketSourcePreview(url) {
  const target = resolveMarketScanTarget(url)
  const sourceUrl = target.type === 'json' ? target.url : await resolveDetailJsonUrl(target.url || url)
  const jsonText = await requestText(parseRequestSpec(sourceUrl, {}, sourceUrl))
  const sources = parseSourceJson(jsonText)
  const source = sources[0] || normalizeSourceConfig({})
  const analysis = analyzeBookSourceCompatibility(source)
  return {
    jsonUrl: sourceUrl,
    source: { ...source, ...analysis },
    sources,
    imported: sources.length,
    incompatible: sources.filter(item => item.compatibility && item.compatibility.includes('不兼容')).length
  }
}

async function resolveDetailJsonUrl(url) {
  const pageText = await requestText(parseRequestSpec(url, {}, url))
  const jsonUrl = extractRepositorySourceUrl(pageText, url)
  if (!jsonUrl) throw new Error('没有识别到书源 JSON 地址')
  return jsonUrl
}

function createMarketItemId(value) {
  let hash = 0
  const text = String(value || '')
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index)
    hash |= 0
  }
  return `market-${Math.abs(hash).toString(36)}`
}

function detectProvider(url) {
  if (/yck2026/i.test(String(url || ''))) return 'yck2026'
  return 'yckceo'
}
