import assert from 'node:assert/strict'

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

function sourceConfig(id) {
  const common = {
    bookSourceName: `测试源-${id}`,
    bookSourceUrl: `https://source-${id}.example`,
    searchUrl: `/search?q={{key}}`,
    ruleSearch: { bookList: '.book', name: 'a@text', bookUrl: 'a@href' },
    ruleBookInfo: { name: 'h1@text', tocUrl: '.toc@href' },
    ruleToc: { chapterList: '.chapter', chapterName: 'a@text', chapterUrl: 'a@href' },
    ruleContent: { content: '#content@text' }
  }
  if (String(id).endsWith('2')) return { ...common, loginUrl: '/login' }
  if (String(id).endsWith('3')) return { ...common, bookSourceType: 1 }
  return common
}

function marketHtml(ids, page, total = 101) {
  return `${ids.map(id => `
    <div class="ylist">
      <h2><a href="/yuedu/shuyuan/content/id/${id}.html">测试源-${id} https://source-${id}.example</a></h2>
      <span>3.X 发 搜 用户: test 下载:1</span>
    </div>`).join('')}
    <div>共有 ${total} 条数据</div>
    <a href="/yuedu/shuyuan/index.html?page=2">2</a>
    <span>${page}</span>`
}

globalThis.fetch = async url => {
  const target = new URL(String(url))
  if (target.pathname.endsWith('/index.html')) {
    const keyword = target.searchParams.get('keys') || ''
    const page = Number(target.searchParams.get('page') || 1)
    const prefix = keyword === 'cancel' ? '91' : keyword === 'web' ? '92' : '90'
    const ids = page === 1 ? [`${prefix}01`, `${prefix}02`] : [`${prefix}03`]
    return { ok: true, status: 200, url: target.toString(), headers: new Headers(), text: async () => marketHtml(ids, page, keyword === 'web' ? 501 : 101) }
  }
  if (target.pathname.endsWith('/jsons')) {
    const ids = String(target.searchParams.get('id') || '').split('-').filter(Boolean)
    return { ok: true, status: 200, url: target.toString(), headers: new Headers(), text: async () => JSON.stringify(ids.map(sourceConfig)) }
  }
  throw new Error(`unexpected request: ${target}`)
}

const {
  getSourceConfigs,
  getSourceStorageCapabilities
} = await import('../common/bookSources.js')
const {
  getYckBulkImportCheckpoint,
  runYckBulkImport
} = await import('../common/sourceBulkImport.js')

const completed = await runYckBulkImport({ provider: 'yckceo', maxPages: 2, commitEveryPages: 1 })
assert.equal(completed.status, 'completed')
assert.equal(completed.stats.pages, 2)
assert.equal(completed.stats.downloaded, 3)
assert.equal(completed.stats.imported, 3)
assert.equal(completed.stats.missing, 0)
assert.equal(completed.installed, 3)
assert.equal(getSourceStorageCapabilities().mode, 'native-chunks')
assert.ok(nativeFiles.has('sources:user:native-manifest:v1'))
assert.equal(storage['sources:user'], undefined)

const installed = getSourceConfigs()
assert.equal(installed.length, 3)
assert.equal(installed.find(source => source.name === '测试源-9001').enabled, true)
assert.equal(installed.find(source => source.name === '测试源-9002').enabled, false)
assert.equal(installed.find(source => source.name === '测试源-9003').enabled, false)
assert.equal(getYckBulkImportCheckpoint({ provider: 'yckceo' }).status, 'completed')

const signal = { cancelled: false }
const cancelled = await runYckBulkImport({
  provider: 'yckceo',
  keyword: 'cancel',
  maxPages: 2,
  commitEveryPages: 1,
  signal,
  onProgress(progress) {
    if (progress.stage === 'import' && progress.page === 1) signal.cancelled = true
  }
})
assert.equal(cancelled.status, 'cancelled')
assert.equal(cancelled.nextPage, 2)
assert.equal(cancelled.stats.pages, 1)

const resumed = await runYckBulkImport({ provider: 'yckceo', keyword: 'cancel', maxPages: 2, commitEveryPages: 1 })
assert.equal(resumed.status, 'completed')
assert.equal(resumed.stats.pages, 2)
assert.equal(resumed.stats.downloaded, 3)
assert.equal(getYckBulkImportCheckpoint({ provider: 'yckceo', keyword: 'cancel' }).status, 'completed')

delete globalThis.NovelReaderSourceStorage
assert.equal(getSourceStorageCapabilities().native, false)
await assert.rejects(
  () => runYckBulkImport({ provider: 'yckceo', keyword: 'web', maxPages: 1 }),
  error => error && error.code === 'BULK_STORAGE_UNAVAILABLE'
)

delete globalThis.fetch
delete globalThis.uni
console.log('sourceBulkImport tests passed')
