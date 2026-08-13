import assert from 'node:assert/strict'

const sourceCount = 5330
const chunkSize = 25
const chunkCount = Math.ceil(sourceCount / chunkSize)
const generation = 'stage8-memory'
const manifestKey = 'sources:user:native-manifest:v1'
const chunkPrefix = 'sources:user:native-chunk:v1'
const manifest = JSON.stringify({ version: 1, generation, chunkCount, total: sourceCount, updatedAt: 1 })
const chunks = new Map()

for (let start = 0; start < sourceCount; start += chunkSize) {
  const index = Math.floor(start / chunkSize)
  const rows = Array.from({ length: Math.min(chunkSize, sourceCount - start) }, (_, offset) => {
    const id = start + offset
    return {
      id: `native-${id}`,
      sourceKey: `native-key-${id}`,
      name: `原生书源${id}`,
      baseUrl: `https://native-${id % 100}.example`,
      enabled: true,
      raw: {
        bookSourceName: `原生书源${id}`,
        bookSourceUrl: `https://native-${id % 100}.example`,
        searchUrl: '/search?q={{key}}',
        ruleSearch: { bookList: '.item', name: '@text', bookUrl: '@href' }
      }
    }
  })
  chunks.set(`${chunkPrefix}:${generation}:${index}`, JSON.stringify(rows))
}

const batchSizes = []
let individualChunkReads = 0
globalThis.NovelReaderSourceStorage = {
  readChapter(key) {
    if (key === manifestKey) return manifest
    individualChunkReads += 1
    return chunks.get(key) || ''
  },
  readChapters(keysJson) {
    const keys = JSON.parse(keysJson)
    batchSizes.push(keys.length)
    return JSON.stringify(Object.fromEntries(keys.map(key => [key, chunks.get(key) || ''])))
  },
  writeChapter() { return true },
  removeChapter() { return true }
}

const storage = { 'sources:schema-version': 4, 'sources:settings': {} }
globalThis.uni = {
  getStorageSync(key) { return storage[key] },
  setStorageSync(key, value) { storage[key] = value },
  removeStorageSync(key) { delete storage[key] }
}

const { getSourceConfigs } = await import('../common/bookSources.js')
const sources = getSourceConfigs()

assert.equal(sources.length, sourceCount)
assert.equal(sources[4321].id, 'native-4321')
assert.equal(batchSizes.length, Math.ceil(chunkCount / 16))
assert.equal(Math.max(...batchSizes), 16)
assert.equal(individualChunkReads, 0)

delete globalThis.NovelReaderSourceStorage
delete globalThis.uni
console.log('sourceNativeBatchMemory tests passed')
