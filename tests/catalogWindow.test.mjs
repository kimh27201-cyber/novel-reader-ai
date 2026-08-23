import assert from 'node:assert/strict'
import {
  buildCatalogMatchIndexes,
  catalogWindowStartForScroll,
  CATALOG_WINDOW_SIZE,
  createCatalogWindow,
  getCatalogWindowMetrics,
  readCatalogWindow,
  shiftCatalogWindow
} from '../common/catalogWindow.js'

const chapters = Array.from({ length: 1642 }, (_, index) => ({ title: `第${index + 1}章`, content: '' }))
const indexes = buildCatalogMatchIndexes(chapters)
const initial = createCatalogWindow(indexes, 821, { size: CATALOG_WINDOW_SIZE, anchorOffset: 20 })
assert.equal(initial.start, 801)
assert.equal(readCatalogWindow(chapters, indexes, initial.start, CATALOG_WINDOW_SIZE).length, 120)
assert.equal(readCatalogWindow(chapters, indexes, initial.start, CATALOG_WINDOW_SIZE)[20].index, 821)

const nextStart = shiftCatalogWindow(indexes, initial.start, 'next', { size: CATALOG_WINDOW_SIZE })
assert.equal(nextStart, 861)
assert.equal(readCatalogWindow(chapters, indexes, nextStart, CATALOG_WINDOW_SIZE).length, 120)
const previousStart = shiftCatalogWindow(indexes, nextStart, 'previous', { size: CATALOG_WINDOW_SIZE })
assert.equal(previousStart, initial.start)

const metrics = getCatalogWindowMetrics(indexes, initial.start, CATALOG_WINDOW_SIZE)
assert.deepEqual(metrics, { before: 801, visible: 120, after: 721, total: 1642 })
assert.equal(catalogWindowStartForScroll(indexes, 900 * 49, 49, { size: 120, preload: 20 }), 880)
assert.equal(catalogWindowStartForScroll(indexes, 10 * 49, 49, { size: 120, preload: 20 }), 0)

const searchIndexes = buildCatalogMatchIndexes(chapters, '第100章')
assert.deepEqual(searchIndexes, [99])
assert.equal(readCatalogWindow(chapters, searchIndexes, 0, CATALOG_WINDOW_SIZE)[0].title, '第100章')

console.log('catalogWindow tests passed')
