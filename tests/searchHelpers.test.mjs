import assert from 'node:assert/strict'
import {
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

console.log('searchHelpers tests passed')
