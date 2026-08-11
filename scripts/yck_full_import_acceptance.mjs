import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const [key, ...rest] = value.replace(/^--/, '').split('=')
  return [key, rest.join('=') || 'true']
}))
const output = resolve(args.output || 'docs/source-acceptance/yck-full-import-stage3-2026-08-11.json')
const maxPages = args.maxPages ? Number(args.maxPages) : 0
const storage = {}
const nativeFiles = new Map()

globalThis.uni = {
  getStorageSync(key) { return storage[key] },
  setStorageSync(key, value) { storage[key] = value },
  removeStorageSync(key) { delete storage[key] }
}
globalThis.NovelReaderSourceStorage = {
  writeChapter(key, content) { nativeFiles.set(String(key), String(content)); return true },
  readChapter(key) { return nativeFiles.get(String(key)) || '' },
  removeChapter(key) { nativeFiles.delete(String(key)); return true }
}

const { analyzeBookSourceCompatibility, getSourceConfigs } = await import('../common/bookSources.js')
const { runYckBulkImport } = await import('../common/sourceBulkImport.js')

const pageProgress = []
const startedAt = Date.now()
const result = await runYckBulkImport({
  provider: 'yckceo',
  maxPages: maxPages || undefined,
  commitEveryPages: 5,
  retryCount: 2,
  onProgress(progress) {
    if (progress.stage !== 'import') return
    const row = {
      page: progress.page,
      totalPages: progress.totalPages,
      catalogItems: progress.stats.catalogItems,
      downloaded: progress.stats.downloaded,
      missing: progress.stats.missing,
      imported: progress.stats.imported,
      updated: progress.stats.updated
    }
    pageProgress.push(row)
    console.log(JSON.stringify(row))
  }
})

const sources = getSourceConfigs()
const status = {}
const sourceTypes = {}
let enabled = 0
let identityValid = 0
sources.forEach(source => {
  const analysis = analyzeBookSourceCompatibility(source)
  status[analysis.status] = (status[analysis.status] || 0) + 1
  const type = String(Number(source.raw && source.raw.bookSourceType || 0))
  sourceTypes[type] = (sourceTypes[type] || 0) + 1
  if (source.enabled) enabled += 1
  if (source.name && source.baseUrl && source.sourceKey) identityValid += 1
})
const uniqueKeys = new Set(sources.map(source => source.sourceKey).filter(Boolean))
const manifest = JSON.parse(nativeFiles.get('sources:user:native-manifest:v1') || '{}')
const storedBytes = [...nativeFiles.values()].reduce((total, value) => total + Buffer.byteLength(value), 0)
const report = {
  schemaVersion: 1,
  capturedAt: new Date().toISOString(),
  repository: 'https://www.yckceo.com/yuedu/shuyuan/index.html',
  elapsedMs: Date.now() - startedAt,
  result: {
    status: result.status,
    advertisedTotal: result.total,
    totalPages: result.totalPages,
    processedPages: result.stats.pages,
    catalogItems: result.stats.catalogItems,
    downloaded: result.stats.downloaded,
    missing: result.stats.missing,
    imported: result.stats.imported,
    updated: result.stats.updated,
    skipped: result.stats.skipped,
    invalid: result.stats.invalid,
    installed: sources.length,
    identityValid,
    uniqueSourceKeys: uniqueKeys.size,
    duplicateSourceKeys: Math.max(0, sources.length - uniqueKeys.size),
    enabled,
    disabled: sources.length - enabled,
    status,
    sourceTypes,
    sourceKeySha256: createHash('sha256').update([...uniqueKeys].sort().join('\n')).digest('hex'),
    nativeChunkCount: Number(manifest.chunkCount || 0),
    nativeStoredBytes: storedBytes
  },
  pages: pageProgress,
  privacy: {
    storesRawSourceJson: false,
    storesContent: false,
    storesCookieOrToken: false
  }
}

await mkdir(dirname(output), { recursive: true })
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(`report=${output}`)
console.log(JSON.stringify(report.result, null, 2))
