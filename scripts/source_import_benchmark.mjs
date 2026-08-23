import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  analyzeBookSourceCompatibility,
  assessReadableContentQuality,
  applyImportPreview,
  buildImportPreview,
  getSourceConfigs,
  hashSourceRuntimeConfig,
  loadOnlineChapter,
  normalizeBookSources,
  recordSourceAcceptanceWindow,
  runSourceReadingFlow
} from '../common/bookSources.js'
import {
  buildCurrentAcceptanceCohort,
  createLockedAcceptanceManifest,
  summarizeAcceptanceWindow,
  verifyLockedAcceptanceManifest
} from '../common/sourceAcceptanceCohort.js'
import { parseSourceMarketItems } from '../common/sourceMarket.js'
import { classifySourceFailure, SourceRuntimeError } from '../common/sourceErrors.js'

const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const [key, ...rest] = value.replace(/^--/, '').split('=')
  return [key, rest.join('=') || 'true']
}))
const HELP_TEXT = `YCK 书源验收工具

用法：
  node scripts/source_import_benchmark.mjs [options]

主要参数：
  --cohort=current|fixed        样本类型，默认 fixed
  --limit=200                   锁定样本数量
  --flowLimit=200               执行完整阅读流程的数量
  --pages=1-57                  YCK 分页范围
  --concurrency=3               配置抓取并发
  --catalogConcurrency=8        YCK 目录页抓取并发
  --inspectionConcurrency=8     YCK 配置检查并发
  --flowConcurrency=3           第三方站点完整阅读并发
  --timeoutMs=12000             单请求超时
  --windowId=<id>               当前窗口 ID
  --manifestOutput=<path>       窗口 A 固定清单输出
  --manifest=<path>             窗口 B 固定清单输入
  --referenceWindowId=<id>      窗口 B 引用的窗口 A ID
  --output=<path>               脱敏 JSON 报告输出
  --checkpoint=<path>           本地可恢复检查点
  --resume[=<path>]             从检查点恢复已完成流程
  --requestRetries=2            网络请求额外重试次数（最大 2）
  --heartbeatMs=300000          进度心跳间隔
  --dryRun                      只校验并显示解析后的参数，不联网、不写文件
  --help                        显示帮助
`

if (args.help === 'true') {
  process.stdout.write(HELP_TEXT)
  process.exit(0)
}
const target = Math.max(1, Math.min(500, Number(args.limit || 200)))
function parsePages(value) {
  const output = []
  String(value || '').split(',').forEach(part => {
    const range = part.trim().match(/^(\d+)\s*-\s*(\d+)$/)
    if (range) {
      const start = Number(range[1])
      const end = Number(range[2])
      const step = start <= end ? 1 : -1
      for (let page = start; page !== end + step; page += step) output.push(page)
      return
    }
    const page = Number(part)
    if (Number.isFinite(page)) output.push(page)
  })
  return [...new Set(output.filter(page => page > 0 && page <= 500))]
}
const pages = parsePages(args.pages || '1,28,56')
const concurrency = Math.max(1, Math.min(16, Number(args.concurrency || 8)))
const catalogConcurrency = Math.max(1, Math.min(12, Number(args.catalogConcurrency || Math.max(8, concurrency))))
const inspectionConcurrency = Math.max(1, Math.min(12, Number(args.inspectionConcurrency || Math.max(8, concurrency))))
const flowConcurrency = Math.max(1, Math.min(4, Number(args.flowConcurrency || 3)))
const flowLimit = Math.max(0, Math.min(target, Number(args.flowLimit || 0)))
const timeoutMs = Math.max(3000, Math.min(30000, Number(args.timeoutMs || 12000)))
const requestRetries = Math.max(0, Math.min(2, Number(args.requestRetries || 2)))
const heartbeatMs = Math.max(1000, Number(args.heartbeatMs || 5 * 60 * 1000))
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const jsonOutput = path.resolve(root, args.output || 'docs/source-acceptance/yck-text-source-benchmark-2026-08-11.json')
const markdownOutput = jsonOutput.replace(/\.json$/i, '.md')
const manifestInput = args.manifest ? path.resolve(root, args.manifest) : ''
const manifestOutput = args.manifestOutput ? path.resolve(root, args.manifestOutput) : ''
const capturedAt = new Date().toISOString()
const cohortKind = args.cohort === 'current' ? 'currentCohort' : 'fixed200'
const windowId = String(args.windowId || `${cohortKind}-${capturedAt.slice(0, 13)}`).slice(0, 80)
const checkpointInput = args.resume && args.resume !== 'true'
  ? path.resolve(root, args.resume)
  : args.checkpoint
    ? path.resolve(root, args.checkpoint)
    : path.resolve(root, 'artifacts', 'stage13', `${windowId}.checkpoint.json`)
const checkpointEnabled = !!args.checkpoint || !!args.resume
const keywords = ['斗破苍穹', '剑来', '诡秘之主']
const storage = {}
const marketPageFailures = []

if (args.dryRun === 'true') {
  process.stdout.write(`${JSON.stringify({
    dryRun: true,
    target,
    pages,
    concurrency,
    catalogConcurrency,
    inspectionConcurrency,
    flowConcurrency,
    flowLimit,
    timeoutMs,
    requestRetries,
    windowId,
    cohortKind,
    jsonOutput,
    manifestInput,
    manifestOutput,
    checkpoint: checkpointEnabled ? checkpointInput : ''
  }, null, 2)}\n`)
  process.exit(0)
}

globalThis.uni = {
  getStorageSync(key) { return storage[key] },
  setStorageSync(key, value) { storage[key] = value },
  removeStorageSync(key) { delete storage[key] }
}

function sha256(value) {
  return createHash('sha256').update(String(value || ''), 'utf8').digest('hex')
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchText(url, options = {}) {
  const startedAt = Date.now()
  let lastError = null
  const retries = Math.max(0, Math.min(2, Number(options.retries == null ? requestRetries : options.retries)))
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'NovelReader-Acceptance/3.0 (+local benchmark)' }
      })
      const text = await response.text()
      if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { code: `HTTP_${response.status}` })
      return { text, elapsedMs: Date.now() - startedAt }
    } catch (error) {
      lastError = error
      if (attempt >= retries) break
      await wait(1000 * (2 ** attempt))
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError
}

async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.tmp`
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await replaceAtomicFile(tempPath, filePath)
}

async function writeTextAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.tmp`
  await writeFile(tempPath, value, 'utf8')
  await replaceAtomicFile(tempPath, filePath)
}

async function replaceAtomicFile(tempPath, filePath) {
  let lastError = null
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rename(tempPath, filePath)
      return
    } catch (error) {
      lastError = error
      if (!['EPERM', 'EACCES', 'EEXIST'].includes(String(error && error.code || ''))) throw error
      try {
        await copyFile(tempPath, filePath)
        await unlink(tempPath).catch(() => {})
        return
      } catch (copyError) {
        lastError = copyError
        await wait(100 * (attempt + 1))
      }
    }
  }
  throw lastError
}

async function readCheckpoint() {
  if (!args.resume) return null
  try {
    const checkpoint = JSON.parse(await readFile(checkpointInput, 'utf8'))
    if (String(checkpoint.windowId || '') !== windowId) throw new Error('CHECKPOINT_WINDOW_MISMATCH')
    return checkpoint
  } catch (error) {
    if (error && error.code === 'ENOENT') return null
    throw error
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
    && !!raw.searchUrl
    && !!raw.ruleSearch
    && !/(?:验证码|captcha|付费|VIP|loginUrl|登录后|18禁|成人|🔞|漫画|音频|听书)/i.test(text)
}

function detectRuleFamily(raw = {}) {
  const rules = JSON.stringify({
    search: raw.ruleSearch || {},
    detail: raw.ruleBookInfo || {},
    toc: raw.ruleToc || {},
    content: raw.ruleContent || {}
  })
  if (/(?:<js>|@js:)/i.test(rules)) return 'safe_js'
  if (/(?:xpath:|\/\/)/i.test(rules)) return 'xpath'
  if (/(?:\$\.|@json:)/i.test(rules)) return 'jsonpath'
  return 'css'
}

async function collectCandidates() {
  const layers = pages.map((page, index) => ({ page, layer: index === 0 ? 'recent' : index === pages.length - 1 ? 'older' : 'middle' }))
  const pageRows = await mapConcurrent(layers, async layer => {
    const url = `https://www.yckceo.com/yuedu/shuyuan/index.html?page=${layer.page}`
    try {
      const loaded = await fetchText(url, { retries: 1 })
      return parseSourceMarketItems(loaded.text, url).map(item => ({ ...item, ...layer }))
    } catch (error) {
      marketPageFailures.push({ page: layer.page, layer: layer.layer, errorCode: errorCode(error) })
      return []
    }
  }, catalogConcurrency)
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
      configHash: hashSourceRuntimeConfig(source),
      actualConfigHash: hashSourceRuntimeConfig(source),
      configStatus: 'matched',
      ruleFamily: detectRuleFamily(raw),
      responseFingerprint: sha256(`config:${loaded.text}`).slice(0, 24),
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
    const flow = await runSourceReadingFlow(row._source.id, keywords, { timeoutMs, limit: 5, allowDisabled: true })
    if (!String(flow.book && flow.book.title || '').trim() || String(flow.book.title).trim() === '未命名小说') {
      throw new SourceRuntimeError('DETAIL_METADATA_EMPTY', '详情缺少书名', { stage: 'detail' })
    }
    if (flow.chapters.length < 3) throw new SourceRuntimeError('TOC_TOO_SHORT', '目录少于 3 章', { stage: 'toc' })
    const sampleIndexes = [...new Set([0, Math.floor(flow.chapters.length / 2), flow.chapters.length - 1])]
    const contentQuality = []
    for (const index of sampleIndexes) {
      const chapter = index === flow.chapter.index ? flow.chapter : await loadOnlineChapter(flow.book, flow.chapters[index], { maxPages: 5 })
      const quality = assessReadableContentQuality(chapter.content || '')
      contentQuality.push({ index, cleanedChars: quality.cleanedChars, status: quality.status, removedRatio: quality.removedRatio })
      if (!quality.qualifiesForAcceptance) {
        throw new SourceRuntimeError('CONTENT_TOO_SHORT', '正文少于 50 字符', { stage: 'content' })
      }
    }
    return {
      status: 'passed', keyword: flow.keyword, elapsedMs: Date.now() - startedAt, errorCode: '',
      metadata: { titlePresent: true, authorPresent: !!String(flow.book.author || '').trim() },
      contentQuality
    }
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

let lockedManifest = null
if (manifestInput) {
  if (!args.referenceWindowId && !args.resume) throw new Error('窗口 B 必须通过 --referenceWindowId 指向窗口 A；同窗口断点恢复需同时提供 --resume')
  lockedManifest = JSON.parse(await readFile(manifestInput, 'utf8'))
  const verification = verifyLockedAcceptanceManifest(lockedManifest)
  if (!verification.valid) throw new Error(`固定清单校验失败：${verification.errorCode}`)
}
const restoredCheckpoint = await readCheckpoint()
const candidates = lockedManifest
  ? lockedManifest.entries.map(entry => ({ id: entry.id, layer: entry.layer, page: entry.page, _manifest: entry }))
  : await collectCandidates()
const inspected = await mapConcurrent(candidates, inspectCandidate, inspectionConcurrency)
if (lockedManifest) {
  inspected.forEach((row, index) => {
    const expected = lockedManifest.entries[index]
    row.expectedConfigHash = expected.configHash
    row.actualConfigHash = row.configHash || ''
    row.configStatus = row.sha256 === expected.sha256 && row.actualConfigHash === expected.configHash ? 'matched' : 'changed'
    row.windowId = windowId
    if (row.configStatus === 'changed') {
      row.errorCode = 'CONFIG_CHANGED'
      row.eligible = false
      row.flow = {
        status: 'failed',
        keyword: '',
        elapsedMs: row.elapsedMs || 0,
        errorCode: 'CONFIG_CHANGED',
        failedStage: 'manifest',
        retryable: false
      }
    }
  })
}
const validRows = inspected.filter(row => row.downloadStatus === 'valid_text_json')
const selectedIds = new Set()
let textRows = []
let cohortManifest = null
if (lockedManifest) {
  textRows = inspected
} else if (cohortKind === 'currentCohort') {
  cohortManifest = buildCurrentAcceptanceCohort(validRows.filter(row => row.eligible), {
    target,
    maxPerHost: Number(args.maxPerHost || 2),
    blockSize: Number(args.blockSize || 20)
  })
  textRows = cohortManifest.rows
} else {
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
}
if (!lockedManifest && cohortKind === 'currentCohort') {
  textRows.forEach(row => {
    row.expectedConfigHash = row.configHash
    row.actualConfigHash = row.configHash
    row.configStatus = 'matched'
    row.windowId = windowId
  })
  lockedManifest = createLockedAcceptanceManifest(textRows, {
    target,
    blockSize: Number(args.blockSize || 20),
    maxPerHost: Number(args.maxPerHost || 2),
    timeoutMs,
    keywords,
    cohortId: args.cohortId,
    createdAt: capturedAt
  })
  if (manifestOutput) await writeJsonAtomic(manifestOutput, lockedManifest)
}
if (restoredCheckpoint && String(restoredCheckpoint.manifestHash || '') !== String(lockedManifest && lockedManifest.manifestHash || '')) {
  throw new Error('CHECKPOINT_MANIFEST_MISMATCH')
}
const failures = inspected.filter(row => row.downloadStatus !== 'valid_text_json')
const samples = lockedManifest ? textRows.slice() : [...textRows, ...failures].slice(0, Math.max(target, textRows.length))
const flowRows = textRows.filter(row => row.eligible && row.configStatus !== 'changed' && row._source).slice(0, flowLimit)
if (flowRows.length) {
  const preview = buildImportPreview(flowRows.map(row => row._source), getSourceConfigs())
  applyImportPreview(preview, { importMethod: 'benchmark' })
}
const restoredFlows = new Map((restoredCheckpoint && restoredCheckpoint.completed || []).map(item => [String(item.id), item]))
flowRows.forEach(row => {
  const restored = restoredFlows.get(String(row.id))
  if (!restored) return
  if (String(restored.sourceKey || '') !== String(row.sourceKey || '') || String(restored.configHash || '') !== String(row.configHash || '')) return
  row.flow = restored.flow
  row.responseFingerprint = restored.responseFingerprint || row.responseFingerprint
})
const pendingFlowRows = flowRows.filter(row => !row.flow)
const completedFlows = new Map(flowRows.filter(row => row.flow).map(row => [String(row.id), {
  id: String(row.id),
  sourceKey: String(row.sourceKey || ''),
  configHash: String(row.configHash || ''),
  flow: row.flow,
  responseFingerprint: String(row.responseFingerprint || ''),
  completedAt: String(restoredFlows.get(String(row.id)) && restoredFlows.get(String(row.id)).completedAt || capturedAt)
}]))
let lastHeartbeatAt = 0
let checkpointWriteQueue = Promise.resolve()

async function persistCheckpoint(status = 'running') {
  if (!checkpointEnabled) return
  const snapshot = {
    schemaVersion: 1,
    status,
    windowId,
    cohortId: lockedManifest && lockedManifest.cohortId || '',
    manifestHash: lockedManifest && lockedManifest.manifestHash || '',
    target: flowRows.length,
    completedCount: completedFlows.size,
    lastHeartbeatAt: new Date().toISOString(),
    completed: [...completedFlows.values()]
  }
  checkpointWriteQueue = checkpointWriteQueue.then(() => writeJsonAtomic(checkpointInput, snapshot))
  await checkpointWriteQueue
}

await persistCheckpoint('running')
await mapConcurrent(pendingFlowRows, async row => {
  row.flow = await runFlow(row)
  row.responseFingerprint = sha256(JSON.stringify({
    status: row.flow.status,
    errorCode: row.flow.errorCode,
    failedStage: row.flow.failedStage || '',
    httpStatus: row.flow.httpStatus || 0,
    contentLengths: (row.flow.contentQuality || []).map(item => item.cleanedChars)
  })).slice(0, 24)
  recordSourceAcceptanceWindow(row._source.id, {
    windowId,
    status: row.flow.status,
    errorCode: row.flow.errorCode,
    checkedAt: Date.now()
  })
  completedFlows.set(String(row.id), {
    id: String(row.id),
    sourceKey: String(row.sourceKey || ''),
    configHash: String(row.configHash || ''),
    flow: row.flow,
    responseFingerprint: row.responseFingerprint,
    completedAt: new Date().toISOString()
  })
  await persistCheckpoint('running')
  if (Date.now() - lastHeartbeatAt >= heartbeatMs) {
    lastHeartbeatAt = Date.now()
    process.stderr.write(`${JSON.stringify({ type: 'heartbeat', windowId, completed: completedFlows.size, total: flowRows.length, at: new Date(lastHeartbeatAt).toISOString() })}\n`)
  }
  return row.flow
}, flowConcurrency)

const statusCounts = textRows.reduce((result, row) => {
  if (!row.status) return result
  result[row.status] = (result[row.status] || 0) + 1
  return result
}, {})
const importable = textRows.filter(row => row.downloadStatus === 'valid_text_json' && row.status !== 'invalid').length
const evaluatedRows = textRows.filter(row => row.flow)
const flowPassed = evaluatedRows.filter(row => row.flow && row.flow.status === 'passed').length
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
  'WEBVIEW_REQUIRED',
  'CONFIG_CHANGED'
])
const runtimeEligibleRows = evaluatedRows.filter(row => row.flow && (row.flow.status === 'passed' || !runtimeExcludedCodes.has(row.flow.errorCode)))
const windowSummary = summarizeAcceptanceWindow(evaluatedRows)
const flowErrorCounts = evaluatedRows.reduce((result, row) => {
  const code = row.flow && row.flow.errorCode || 'PASSED'
  result[code] = (result[code] || 0) + 1
  return result
}, {})
const exclusionCounts = evaluatedRows.filter(row => row.flow && runtimeExcludedCodes.has(row.flow.errorCode)).reduce((result, row) => {
  const code = row.flow.errorCode
  result[code] = (result[code] || 0) + 1
  return result
}, {})
const report = {
  schemaVersion: 4,
  capturedAt,
  completedAt: new Date().toISOString(),
  windowId,
  cohortId: lockedManifest && lockedManifest.cohortId || '',
  referenceWindowId: String(args.referenceWindowId || ''),
  manifestHash: lockedManifest && lockedManifest.manifestHash || '',
  manifest: lockedManifest,
  cohortKind,
  repository: 'https://www.yckceo.com/yuedu/shuyuan/index.html',
  pages,
  marketPageFailures,
  fixed200: cohortKind === 'fixed200' ? {
    locked: true,
    sampleCount: textRows.length,
    sampleIds: textRows.map(row => row.id)
  } : null,
  currentCohort: cohortKind === 'currentCohort' ? {
    locked: true,
    sampleCount: textRows.length,
    hostCount: cohortManifest ? cohortManifest.hostCount : null,
    maxPerHost: lockedManifest && lockedManifest.maxPerHost,
    blockSize: lockedManifest && lockedManifest.blockSize,
    blocks: cohortManifest ? cohortManifest.blocks : lockedManifest.entries.reduce((blocks, entry) => {
      if (!blocks[entry.block]) blocks[entry.block] = []
      blocks[entry.block].push({ id: entry.id, sourceKey: entry.sourceKey, sha256: entry.sha256, configHash: entry.configHash })
      return blocks
    }, [])
  } : null,
  metrics: {
    target,
    candidateCount: candidates.length,
    validTextJson: textRows.filter(row => row.downloadStatus === 'valid_text_json').length,
    importable,
    importRatePercent: textRows.length ? Number((importable * 100 / textRows.length).toFixed(2)) : 0,
    status: statusCounts,
    staticEligible: textRows.filter(row => row.eligible).length,
    runtimeEligible: runtimeEligibleRows.length,
    runtimeExcluded: evaluatedRows.length - runtimeEligibleRows.length,
    runtimeExclusions: exclusionCounts,
    flowErrors: flowErrorCounts,
    flowTested: evaluatedRows.length,
    flowPassed,
    flowRatePercent: runtimeEligibleRows.length ? Number((flowPassed * 100 / runtimeEligibleRows.length).toFixed(2)) : 0,
    metadataFailures: windowSummary.metadataFailures,
    contentQuality: {
      passedSamples: evaluatedRows.reduce((total, row) => total + Number(row.flow && row.flow.contentQuality && row.flow.contentQuality.length || 0), 0),
      noiseFailures: evaluatedRows.filter(row => row.flow && row.flow.errorCode === 'CONTENT_NOISE').length,
      shortFailures: evaluatedRows.filter(row => row.flow && row.flow.errorCode === 'CONTENT_TOO_SHORT').length
    },
    gate: {
      minimumDenominator: 20,
      minimumRatePercent: 80,
      denominatorPassed: runtimeEligibleRows.length >= 20,
      ratePassed: runtimeEligibleRows.length >= 20 && Number((flowPassed * 100 / runtimeEligibleRows.length).toFixed(2)) >= 80
    }
  },
  samples: samples.map(({ _source, ...row }) => row)
}

await writeJsonAtomic(jsonOutput, report)
await writeTextAtomic(markdownOutput, buildMarkdown(report))
await persistCheckpoint('completed')
process.stdout.write(`${JSON.stringify({ jsonOutput, markdownOutput, metrics: report.metrics })}\n`)
