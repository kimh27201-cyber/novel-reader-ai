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

export const SOURCE_MARKET_PROVIDERS = {
  yckceo: {
    label: '源仓库',
    baseUrl: 'https://www.yckceo.com/yuedu/shuyuan/index.html'
  },
  yck2026: {
    label: '备用仓库',
    baseUrl: 'https://www.yck2026.top/yuedu/shuyuan/index.html'
  }
}

export function createSourceMarketUrl(options = {}) {
  const provider = SOURCE_MARKET_PROVIDERS[options.provider] || SOURCE_MARKET_PROVIDERS.yckceo
  const params = []
  const keyword = String(options.keyword || '').trim()
  if (keyword) params.push(`key=${encodeURIComponent(keyword)}`)
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
  return {
    jsonUrl: sourceUrl,
    source,
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
