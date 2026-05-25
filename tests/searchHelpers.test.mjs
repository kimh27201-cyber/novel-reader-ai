import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildSearchResultKey,
  buildSourceToggleState,
  demoSearchKeywords,
  sanitizeSearchKeyword
} from '../common/searchHelpers.js'

assert.equal(sanitizeSearchKeyword('  › 笔趣阁  '), '笔趣阁')
assert.ok(demoSearchKeywords.includes('星轨图书馆'))

assert.deepEqual(buildSourceToggleState({ id: 'source-1', name: '笔趣阁', enabled: false }), {
  sourceId: 'source-1',
  nextEnabled: true,
  toast: '已启用笔趣阁'
})

assert.deepEqual(buildSourceToggleState({ id: 'source-1', name: '笔趣阁', enabled: true }), {
  sourceId: 'source-1',
  nextEnabled: false,
  toast: '已停用笔趣阁'
})

const duplicateBackendResults = [
  { type: 'backend-online', title: '风停在旧城', sourceName: '本地演示书源' },
  { type: 'backend-online', title: '风停在旧城', sourceName: '本地演示书源' },
  { type: 'backend-online', title: '星轨图书馆', sourceName: '本地演示书源' }
]
const resultKeys = duplicateBackendResults.map((item, index) => buildSearchResultKey(item, index))
assert.equal(new Set(resultKeys).size, duplicateBackendResults.length)
assert.deepEqual(resultKeys, [
  'backend-online-0-风停在旧城',
  'backend-online-1-风停在旧城',
  'backend-online-2-星轨图书馆'
])

const searchPage = readFileSync(new URL('../pages/search/search.vue', import.meta.url), 'utf8')
assert.match(searchPage, /availableSourceCount/)
assert.match(searchPage, /暂无可用书源/)
assert.match(searchPage, /请先到书源页完成书源测试/)
assert.match(searchPage, /goLibrary/)
assert.match(searchPage, /本次使用/)
assert.match(searchPage, /可用书源/)
assert.match(searchPage, /sourceName/)
assert.match(searchPage, /buildSearchResultKey\(item, index\)/)

console.log('searchHelpers tests passed')
