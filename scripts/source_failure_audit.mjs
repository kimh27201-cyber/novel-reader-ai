import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const reportPath = path.resolve(root, process.argv[2] || 'docs/source-acceptance/yck-text-source-benchmark-2026-08-11.json')
const outputPath = path.resolve(root, process.argv[3] || 'docs/source-acceptance/yck-source-failure-audit-2026-08-11.json')
const report = JSON.parse(await readFile(reportPath, 'utf8'))
const rows = report.samples.filter(row => row.eligible && row.flow && row.flow.status === 'failed')

function collectMatches(text, pattern) {
  return [...String(text || '').matchAll(pattern)].map(match => match[1]).filter(Boolean)
}

function requestShape(searchUrl) {
  const text = String(searchUrl || '')
  return {
    post: /[,{]\s*["']?method["']?\s*:\s*["']?POST/i.test(text),
    options: /,\s*\{[\s\S]*\}\s*$/.test(text),
    js: /@js:|<js>/i.test(text),
    pageVariable: /\{\{\s*page\s*\}\}/i.test(text),
    keyVariable: /\{\{\s*(?:key|keyword)\s*\}\}/i.test(text)
  }
}

async function inspect(row) {
  const url = `https://www.yckceo.com/yuedu/shuyuan/json/id/${row.id}.json`
  const startedAt = Date.now()
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'NovelReader-Audit/3.1' } })
    if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { code: `HTTP_${response.status}` })
    const payload = await response.json()
    const raw = Array.isArray(payload) ? payload[0] : payload && Array.isArray(payload.sources) ? payload.sources[0] : payload
    const text = JSON.stringify(raw || {})
    const hostApis = [...new Set(collectMatches(text, /\b(java\.[A-Za-z_$][\w$]*|cookie\.[A-Za-z_$][\w$]*|startBrowserAwait)\b/g))].sort()
    const searchUrl = raw && raw.searchUrl
    return {
      id: row.id,
      previousErrorCode: row.flow.errorCode,
      fetched: true,
      elapsedMs: Date.now() - startedAt,
      request: requestShape(searchUrl),
      hostApis,
      enabledCookieJar: !!(raw && raw.enabledCookieJar),
      hasHeader: !!(raw && (raw.header || raw.headers || raw.httpHeader)),
      hasLogin: !!(raw && (raw.loginUrl || raw.loginUi || raw.loginCheck)),
      hasExplore: !!(raw && (raw.exploreUrl || raw.ruleExplore))
    }
  } catch (error) {
    return {
      id: row.id,
      previousErrorCode: row.flow.errorCode,
      fetched: false,
      elapsedMs: Date.now() - startedAt,
      fetchErrorCode: String(error && error.code || error && error.name || 'NETWORK_ERROR').slice(0, 80)
    }
  }
}

const results = new Array(rows.length)
let cursor = 0
await Promise.all(Array.from({ length: Math.min(8, rows.length || 1) }, async () => {
  while (cursor < rows.length) {
    const index = cursor
    cursor += 1
    results[index] = await inspect(rows[index])
  }
}))

const counts = {
  previousErrors: {},
  hostApis: {},
  requestShapes: {},
  cookieSources: 0,
  headerSources: 0,
  fetchFailures: 0
}
for (const row of results) {
  counts.previousErrors[row.previousErrorCode] = (counts.previousErrors[row.previousErrorCode] || 0) + 1
  if (!row.fetched) counts.fetchFailures += 1
  if (row.enabledCookieJar) counts.cookieSources += 1
  if (row.hasHeader) counts.headerSources += 1
  for (const api of row.hostApis || []) counts.hostApis[api] = (counts.hostApis[api] || 0) + 1
  for (const [name, enabled] of Object.entries(row.request || {})) {
    if (enabled) counts.requestShapes[name] = (counts.requestShapes[name] || 0) + 1
  }
}

const audit = {
  schemaVersion: 1,
  capturedAt: new Date().toISOString(),
  sourceReport: path.relative(root, reportPath).replace(/\\/g, '/'),
  sampleCount: results.length,
  counts,
  samples: results
}
await writeFile(outputPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8')
process.stdout.write(`${JSON.stringify({ outputPath, sampleCount: results.length, counts }, null, 2)}\n`)
