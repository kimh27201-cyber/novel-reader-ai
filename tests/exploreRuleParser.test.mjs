import assert from 'node:assert/strict'
import {
  getSourceConfigs,
  getSourceExploreEntries,
  hasExploreCapability,
  importSourcesWithStats,
  loadSourceExploreBooks
} from '../common/bookSources.js'

const store = {}
globalThis.uni = {
  getStorageSync(key) { return store[key] },
  setStorageSync(key, value) { store[key] = value },
  request(options) {
    options.success({
      statusCode: 200,
      data: {
        text: JSON.stringify({ items: [{ name: '发现书', url: '/book/1' }] }),
        status_code: 200,
        final_url: options.data.url,
        headers: { 'content-type': 'application/json; charset=utf-8' }
      }
    })
  }
}

importSourcesWithStats(JSON.stringify([
  {
    bookSourceName: 'Only Entry', bookSourceUrl: 'https://entry.test', exploreUrl: '分类::/list?page={{page}}'
  },
  {
    bookSourceName: 'Search Fallback', bookSourceUrl: 'https://fallback.test', exploreUrl: '分类::/list?page={{page}}',
    ruleSearch: { bookList: '$.items[*]', name: '$.name', bookUrl: '$.url' }
  }
]))

const onlyEntry = getSourceConfigs().find(item => item.name === 'Only Entry')
assert.equal(hasExploreCapability(onlyEntry).available, false)
assert.match(hasExploreCapability(onlyEntry).reason, /缺少发现页解析规则/)
assert.equal(getSourceExploreEntries(onlyEntry.id).available, false)

const fallback = getSourceConfigs().find(item => item.name === 'Search Fallback')
assert.equal(hasExploreCapability(fallback).available, true)
assert.equal(hasExploreCapability(fallback).usedRule, 'ruleSearch')
const entry = getSourceExploreEntries(fallback.id).entries[0]
const loaded = await loadSourceExploreBooks(fallback.id, entry, { page: 2, timeoutMs: 1000 })
assert.equal(loaded.books.length, 1)
assert.equal(loaded.diagnostics.requestUrl, 'https://fallback.test/list?page=2')
assert.equal(loaded.diagnostics.httpStatus, 200)
assert.equal(loaded.diagnostics.usedRule, 'ruleSearch')
assert.equal(loaded.diagnostics.parsedCount, 1)
assert.equal(loaded.diagnostics.failedStage, '')
assert.equal(loaded.diagnostics.viaProxy, true)

console.log('exploreRuleParser tests passed')
