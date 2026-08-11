import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  analyzeBookSourceCompatibility,
  applyImportPreview,
  buildImportPreview,
  getSourceConfigs,
  loadOnlineChapter,
  normalizeBookSources,
  runSourceReadingFlow
} from '../common/bookSources.js'
import { parseSourceMarketItems } from '../common/sourceMarket.js'
import { classifySourceFailure, SourceRuntimeError } from '../common/sourceErrors.js'

const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const [key, ...rest] = value.replace(/^--/, '').split('=')
  return [key, rest.join('=') || 'true']
}))
const target = Math.max(1, Math.min(500, Number(args.limit || 200)))
const pages = String(args.pages || '1,28,56').split(',').map(Number).filter(Number.isFinite)
const concurrency = Math.max(1, Math.min(16, Number(args.concurrency || 8)))
const flowLimit = Math.max(0, Math.min(target, Number(args.flowLimit || 0)))
const timeoutMs = Math.max(3000, Math.min(30000, Number(args.timeoutMs || 12000)))
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const jsonOutput = path.resolve(root, args.output || 'docs/source-acceptance/yck-text-source-benchmark-2026-08-11.json')
const markdownOutput = jsonOutput.replace(/\.json$/i, '.md')
const capturedAt = new Date().toISOString()
const keywords = ['斗破苍穹', '剑来', '诡秘之主']
const storage = {}

globalThis.uni = {
  getStorageSync(key) { return storage[key] },
  setStorageSync(key, value) { storage[key] = value },
  removeStorageSync(key) { delete storage[key] }
}

function sha256(value) {
  return createHash('sha256').update(String(value || ''), 'utf8').digest('hex')
}

async function fetchText(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'NovelReader-Acceptance/3.0 (+local benchmark)' }
    })
    const text = await response.text()
    if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { code: `HTTP_${response.status}` })
    return { text, elapsedMs: Date.now() - startedAt }
  } finally {
    clearTimeout(timer)
  }
}

async function mapConcurrent(items, worker, maximum = concurrency) {
  const results = new Array(items.length)
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(maximum, items.length || 1) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index], index)
    }
  }))
  return results
}

function errorCode(error) {
  if (/JSON|书源|payload/i.test(String(error && error.message || ''))) return 'INVALID_JSON'
  return classifySourceFailure(error).errorCode
}

function detailId(url) {
  const match = String(url || '').match(/\/content\/id\/(\d+)\.html/i)
  return match ? match[1] : ''
}

function isTextSource(raw) {
  return Number(raw && raw.bookSourceType || 0) === 0
}

function isEligible(raw, analysis, source) {
  const text = JSON.stringify(raw || {})
  return analysis.status === 'ready'
    && source.enabled !== false
    && !!raw.searchUrl
    && !!raw.ruleSearch
    && !/(?:验证码|captcha|付费|VIP|loginUrl|登录后|18禁|成人|🔞|漫画|音频|听书)/i.test(text)
}

async function collectCandidates() {
  const layers = pages.map((page, index) => ({ page, layer: index === 0 ? 'recent' : index === pages.length - 1 ? 'older' : 'middle' }))
  const pageRows = await mapConcurrent(layers, async layer => {
    const url = `https://www.yckceo.com/yuedu/shuyuan/index.html?page=${layer.page}`
    const loaded = await fetchText(url)
    return parseSourceMarketItems(loaded.text, url).map(item => ({ ...item, ...layer }))
  })
  const unique = new Map()
  pageRows.flat().forEach(item => {
    const id = detailId(item.detailUrl)
    if (id && !unique.has(id)) unique.set(id, { id, layer: item.layer, page: item.page })
  })
  return [...unique.values()]
}

async function inspectCandidate(candidate) {
  const sourceUrl = `https://www.yckceo.com/yuedu/shuyuan/json/id/${candidate.id}.json`
  const startedAt = Date.now()
  try {
    const loaded = await fetchText(sourceUrl)
    const rawPayload = JSON.parse(String(loaded.text || '').replace(/^\uFEFF/, ''))
    const raw = Array.isArray(rawPayload) ? rawPayload[0] : rawPayload && rawPayload.sources ? rawPayload.sources[0] : rawPayload
    if (!raw || typeof raw !== 'object') throw new Error('INVALID_JSON')
    if (!isTextSource(raw)) {
      return { id: candidate.id, layer: candidate.layer, page: candidate.page, capturedAt, sha256: sha256(loaded.text), downloadStatus: 'non_text', errorCode: 'NON_TEXT', elapsedMs: Date.now() - startedAt }
    }
    const source = normalizeBookSources(raw, { source: 'yck-benchmark', sourceUrl })[0]
    const analysis = analyzeBookSourceCompatibility(source)
    return {
      id: candidate.id,
      layer: candidate.layer,
      page: candidate.page,
      capturedAt,
      sha256: sha256(loaded.text),
      downloadStatus: 'valid_text_json',
      errorCode: analysis.errorCode || '',
      elapsedMs: Date.now() - startedAt,
      status: analysis.status,
      sourceKey: source.sourceKey,
      format: source.formatVersion,
      capabilities: {
        search: analysis.searchable,
        detail: analysis.detailReadable,
        toc: analysis.tocReadable,
        content: analysis.contentReadable
      },
      platforms: {
        android: analysis.android_supported,
        h5: analysis.h5_supported,
        backend: analysis.backend_supported
      },
      requires: {
        cookie: analysis.requiresCookie,
        login: analysis.requiresLogin,
        webView: analysis.requiresWebView
      },
      eligible: isEligible(raw, analysis, source),
      _source: source
    }
  } catch (error) {
    return {
      id: candidate.id,
      layer: candidate.layer,
      page: candidate.page,
      capturedAt,
      sha256: '',
      downloadStatus: 'failed',
      errorCode: errorCode(error),
      elapsedMs: Date.now() - startedAt
    }
  }
}

async function runFlow(row) {
  const startedAt = Date.now()
  try {
    const flow = await runSourceReadingFlow(row._source.id, keywords, { timeoutMs, limit: 5 })
    if (flow.chapters.length < 3) throw new SourceRuntimeError('TOC_TOO_SHORT', '目录少于 3 章', { stage: 'toc' })
    const sampleIndexes = [...new Set([0, Math.floor(flow.chapters.length / 2), flow.chapters.length - 1])]
    for (const index of sampleIndexes) {
      const chapter = index === flow.chapter.index ? flow.chapter : await loadOnlineChapter(flow.book, flow.chapters[index], { maxPages: 5 })
      if (String(chapter.content || '').replace(/\s+/g, '').length < 50) {
        throw new SourceRuntimeError('CONTENT_TOO_SHORT', '正文少于 50 字符', { stage: 'content' })
      }
    }
    return { status: 'passed', keyword: flow.keyword, elapsedMs: Date.now() - startedAt, errorCode: '' }
  } catch (error) {
    const failedStage = Array.isArray(error && error.flowStages)
      ? [...error.flowStages].reverse().find(stage => stage.status === 'failed')
      : null
    const failure = classifySourceFailure(error, { stage: failedStage && failedStage.id })
    return {
      status: 'failed',
      keyword: '',
      elapsedMs: Date.now() - startedAt,
      errorCode: failedStage && failedStage.errorCode || failure.errorCode,
      failedStage: failedStage && failedStage.id || failure.stage,
      httpStatus: failedStage && failedStage.httpStatus || failure.status,
      retryable: failedStage ? failedStage.retryable === true : failure.retryable,
      diagnostics: error && error.diagnostics || undefined
    }
  }
}

function buildMarkdown(report) {
  const lines = [
    '# YCK 文字书源脱敏验收报告（2026-08-11）',
    '',
    `- 抓取时间：${report.capturedAt}`,
    `- 分层页面：${report.pages.join('、')}`,
    `- 目标样本：${report.metrics.target}；有效文字 JSON：${report.metrics.validTextJson}`,
    `- JSON 导入成功率：${report.metrics.importRatePercent}%（分母为有效文字 JSON）`,
    `- 静态状态：ready ${report.metrics.status.ready || 0} / partial ${report.metrics.status.partial || 0} / needs_login ${report.metrics.status.needs_login || 0} / blocked ${report.metrics.status.blocked || 0} / invalid ${report.metrics.status.invalid || 0}`,
    `- 静态候选：${report.metrics.staticEligible}；真实请求后合格分母：${report.metrics.runtimeEligible}；外部状态排除：${report.metrics.runtimeExcluded}`,
    `- 完整阅读实测：${report.metrics.flowPassed}/${report.metrics.runtimeEligible}；完整阅读率 ${report.metrics.flowRatePercent}%（全部静态候选共测试 ${report.metrics.flowTested} 个）`,
    `- 外部状态排除：${Object.entries(report.metrics.runtimeExclusions || {}).map(([code, count]) => `${code} ${count}`).join(' / ') || '无'}`,
    '',
    '> 报告不保存第三方正文、Cookie、Token 或完整书源 JSON；SHA-256 仅用于固定样本版本。未执行真机流程的行标记为 not_run，不能计为通过。',
    '',
    '| ID | 层次 | 页 | SHA-256（前 12 位） | 下载 | 状态 | Android | 搜/详/目/文 | 流程 | 错误码 | 耗时(ms) |',
    '|---:|---|---:|---|---|---|---|---|---|---|---:|'
  ]
  report.samples.forEach(row => {
    const caps = row.capabilities ? [row.capabilities.search, row.capabilities.detail, row.capabilities.toc, row.capabilities.content].map(value => value ? '✓' : '—').join('/') : '—/—/—/—'
    lines.push(`| ${row.id} | ${row.layer} | ${row.page} | ${(row.sha256 || '').slice(0, 12)} | ${row.downloadStatus} | ${row.status || '—'} | ${row.platforms && row.platforms.android ? '✓' : '—'} | ${caps} | ${row.flow ? row.flow.status : 'not_run'} | ${row.flow && row.flow.errorCode || row.errorCode || ''} | ${row.elapsedMs || 0} |`)
  })
  return `${lines.join('\n')}\n`
}

const candidates = await collectCandidates()
const inspected = await mapConcurrent(candidates, inspectCandidate)
const validRows = inspected.filter(row => row.downloadStatus === 'valid_text_json')
const selectedIds = new Set()
const textRows = []
pages.forEach((page, index) => {
  const layer = index === 0 ? 'recent' : index === pages.length - 1 ? 'older' : 'middle'
  const quota = Math.floor(target / pages.length) + (index < target % pages.length ? 1 : 0)
  validRows.filter(row => row.layer === layer).slice(0, quota).forEach(row => {
    selectedIds.add(row.id)
    textRows.push(row)
  })
})
validRows.forEach(row => {
  if (textRows.length >= target || selectedIds.has(row.id)) return
  selectedIds.add(row.id)
  textRows.push(row)
})
const failures = inspected.filter(row => row.downloadStatus !== 'valid_text_json')
const samples = [...textRows, ...failures].slice(0, Math.max(target, textRows.length))
const flowRows = textRows.filter(row => row.eligible).slice(0, flowLimit)
if (flowRows.length) {
  const preview = buildImportPreview(flowRows.map(row => row._source), getSourceConfigs())
  applyImportPreview(preview, { importMethod: 'benchmark' })
}
await mapConcurrent(flowRows, async row => {
  row.flow = await runFlow(row)
  return row.flow
}, 3)

const statusCounts = textRows.reduce((result, row) => {
  result[row.status] = (result[row.status] || 0) + 1
  return result
}, {})
const importable = textRows.filter(row => row.status !== 'invalid').length
const flowPassed = flowRows.filter(row => row.flow && row.flow.status === 'passed').length
const runtimeExcludedCodes = new Set([
  'SITE_UNREACHABLE',
  'HTTP_BLOCKED',
  'HTTP_NOT_FOUND',
  'HTTP_SERVER_ERROR',
  'NETWORK_ERROR',
  'TIMEOUT',
  'LOGIN_REQUIRED',
  'CAPTCHA_REQUIRED',
  'COOKIE_REQUIRED',
  'WEBVIEW_REQUIRED'
])
const runtimeEligibleRows = flowRows.filter(row => row.flow && (row.flow.status === 'passed' || !runtimeExcludedCodes.has(row.flow.errorCode)))
const flowErrorCounts = flowRows.reduce((result, row) => {
  const code = row.flow && row.flow.errorCode || 'PASSED'
  result[code] = (result[code] || 0) + 1
  return result
}, {})
const exclusionCounts = flowRows.filter(row => row.flow && runtimeExcludedCodes.has(row.flow.errorCode)).reduce((result, row) => {
  const code = row.flow.errorCode
  result[code] = (result[code] || 0) + 1
  return result
}, {})
const report = {
  schemaVersion: 2,
  capturedAt,
  repository: 'https://www.yckceo.com/yuedu/shuyuan/index.html',
  pages,
  metrics: {
    target,
    candidateCount: candidates.length,
    validTextJson: textRows.length,
    importable,
    importRatePercent: textRows.length ? Number((importable * 100 / textRows.length).toFixed(2)) : 0,
    status: statusCounts,
    staticEligible: textRows.filter(row => row.eligible).length,
    runtimeEligible: runtimeEligibleRows.length,
    runtimeExcluded: flowRows.length - runtimeEligibleRows.length,
    runtimeExclusions: exclusionCounts,
    flowErrors: flowErrorCounts,
    flowTested: flowRows.length,
    flowPassed,
    flowRatePercent: runtimeEligibleRows.length ? Number((flowPassed * 100 / runtimeEligibleRows.length).toFixed(2)) : 0
  },
  samples: samples.map(({ _source, ...row }) => row)
}

await writeFile(jsonOutput, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
await writeFile(markdownOutput, buildMarkdown(report), 'utf8')
process.stdout.write(`${JSON.stringify({ jsonOutput, markdownOutput, metrics: report.metrics })}\n`)
