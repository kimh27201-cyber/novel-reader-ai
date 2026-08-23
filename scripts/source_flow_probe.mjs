import {
  applyImportPreview,
  buildImportPreview,
  normalizeBookSources,
  runSourceReadingFlow
} from '../common/bookSources.js'
import { classifySourceFailure } from '../common/sourceErrors.js'

const ids = process.argv.slice(2).filter(value => /^\d+$/.test(value))
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
    const flow = await runSourceReadingFlow(source.id, ['斗破苍穹', '剑来', '诡秘之主'], { timeoutMs: 10000, allowDisabled: true })
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
