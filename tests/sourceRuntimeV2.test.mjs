import assert from 'node:assert/strict'

const store = {}
globalThis.uni = {
  getStorageSync: key => store[key],
  setStorageSync: (key, value) => { store[key] = value }
}

const {
  buildSourceCandidatePool,
  getSourceConfig,
  getSourceConfigs,
  importSourcesFromAny,
  persistSourceConfigs,
  writeSourceRuntimeStageResult
} = await import('../common/bookSources.js')

const sourceJson = {
  bookSourceName: 'Runtime V2 Source',
  bookSourceUrl: 'https://runtime-v2.example.com',
  searchUrl: 'https://runtime-v2.example.com/search?q={{key}}',
  ruleSearch: { bookList: '$.items[*]', name: '$.name', bookUrl: '$.url' },
  ruleToc: { chapterList: '$.chapters[*]', chapterName: '$.title', chapterUrl: '$.url' },
  ruleContent: { content: '$.content' }
}
await importSourcesFromAny(JSON.stringify([sourceJson]))
let source = getSourceConfigs()[0]

let pool = buildSourceCandidatePool([source])
assert.equal(pool.untested.length, 1, '未手测但静态合格的文字源必须进入候选池')

const firstFailure = writeSourceRuntimeStageResult(source.id, 'search', { status: 'failed', errorCode: 'NETWORK_ERROR' })
assert.equal(firstFailure.status, 'cooldown')
assert.ok(firstFailure.cooldownUntil - firstFailure.checkedAt >= 29 * 60 * 1000)
pool = buildSourceCandidatePool(getSourceConfigs())
assert.equal(pool.cooling.length, 1)

const secondFailure = writeSourceRuntimeStageResult(source.id, 'search', { status: 'failed', errorCode: 'NETWORK_ERROR' })
assert.ok(secondFailure.cooldownUntil - secondFailure.checkedAt >= 119 * 60 * 1000)
const thirdFailure = writeSourceRuntimeStageResult(source.id, 'search', { status: 'failed', errorCode: 'NETWORK_ERROR' })
assert.ok(thirdFailure.cooldownUntil - thirdFailure.checkedAt >= 11 * 60 * 60 * 1000)

writeSourceRuntimeStageResult(source.id, 'search', { status: 'failed', errorCode: 'LOGIN_REQUIRED' })
assert.equal(getSourceConfig(source.id).runtimeV2.search.status, 'blocked')

const changed = getSourceConfigs().map(item => item.id === source.id
  ? { ...item, raw: { ...item.raw, searchUrl: 'https://runtime-v2.example.com/v2/search?q={{key}}' } }
  : item)
persistSourceConfigs(changed)
source = getSourceConfig(source.id)
assert.equal(source.runtimeV2.search.status, 'untested', '配置哈希变化后旧失败状态必须失效')
assert.equal(buildSourceCandidatePool([source]).untested.length, 1)

console.log('sourceRuntimeV2 tests passed')
