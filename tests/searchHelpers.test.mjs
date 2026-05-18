import assert from 'node:assert/strict'
import {
  buildSourceSelectState,
  demoSearchKeywords,
  sanitizeSearchKeyword
} from '../common/searchHelpers.js'

assert.equal(sanitizeSearchKeyword('  › 笔趣阁  '), '笔趣阁')
assert.ok(demoSearchKeywords.includes('星轨图书馆'))

assert.deepEqual(buildSourceSelectState({ id: 'source-1', name: '笔趣阁' }, '笔趣阁'), {
  sourceId: 'source-1',
  keyword: '笔趣阁',
  shouldSearch: false,
  toast: '已启用笔趣阁，请输入书名搜索'
})

assert.deepEqual(buildSourceSelectState({ id: 'source-1', name: '笔趣阁' }, '星轨图书馆'), {
  sourceId: 'source-1',
  keyword: '星轨图书馆',
  shouldSearch: true,
  toast: '已启用笔趣阁，开始搜索：星轨图书馆'
})

console.log('searchHelpers tests passed')
