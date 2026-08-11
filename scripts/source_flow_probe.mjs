import {
  applyImportPreview,
  buildImportPreview,
  normalizeBookSources,
  runSourceReadingFlow
} from '../common/bookSources.js'

const ids = process.argv.slice(2).filter(value => /^\d+$/.test(value))
const store = {}
globalThis.uni = {
  getStorageSync(key) { return store[key] },
  setStorageSync(key, value) { store[key] = value },
  removeStorageSync(key) { delete store[key] }
}

for (const id of ids) {
  const url = `https://www.yckceo.com/yuedu/shuyuan/json/id/${id}.json`
  const raw = await fetch(url).then(response => response.json())
  const source = normalizeBookSources(raw, { source: 'probe', sourceUrl: url })[0]
  applyImportPreview(buildImportPreview([source], []), { importMethod: 'probe' })
  try {
    const flow = await runSourceReadingFlow(source.id, ['斗破苍穹', '剑来', '诡秘之主'], { timeoutMs: 10000 })
    process.stdout.write(`${JSON.stringify({ id, name: source.name, status: 'passed', keyword: flow.keyword, chapters: flow.chapters.length, contentLength: String(flow.chapter.content || '').length })}\n`)
  } catch (error) {
    process.stdout.write(`${JSON.stringify({
      id,
      name: source.name,
      status: 'failed',
      message: String(error && error.message || '').replace(/https?:\/\/\S+/g, '<url>').slice(0, 240),
      stages: Array.isArray(error && error.flowStages) ? error.flowStages.map(stage => ({ id: stage.id, status: stage.status, message: String(stage.message || '').replace(/https?:\/\/\S+/g, '<url>').slice(0, 120) })) : []
    })}\n`)
  }
}
