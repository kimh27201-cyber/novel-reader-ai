import assert from 'node:assert/strict'

const store = {}
globalThis.uni = {
  getStorageSync(key) {
    return store[key]
  },
  setStorageSync(key, value) {
    store[key] = value
  }
}

const {
  getOnlineSearchSettings,
  getSourceConfigs,
  getSourceQualityStats,
  importSourcesFromAny,
  pickOnlineSearchSources,
  saveOnlineSearchSettings,
  searchOnlineBooks
} = await import('../common/bookSources.js')

saveOnlineSearchSettings({ concurrency: 8, timeoutMs: 12000, resultLimit: 60 })
assert.deepEqual(getOnlineSearchSettings(), {
  concurrency: 8,
  timeoutMs: 12000,
  resultLimit: 60,
  sourceLimit: 10
})

saveOnlineSearchSettings({ concurrency: 99, timeoutMs: 100, resultLimit: 999, sourceLimit: 99 })
assert.deepEqual(getOnlineSearchSettings(), {
  concurrency: 10,
  timeoutMs: 3000,
  resultLimit: 120,
  sourceLimit: 10
})

const sourceList = Array.from({ length: 4 }, (_, index) => ({
  bookSourceName: `Search Source ${index + 1}`,
  bookSourceUrl: `https://source${index + 1}.example.com`,
  bookSourceGroup: 'Multi Search',
  searchUrl: `https://source${index + 1}.example.com/search?keyword={{key}}`,
  ruleSearch: {
    bookList: '$.items[*]',
    name: '$.name',
    author: '$.author',
    bookUrl: '$.url',
    latestChapter: '$.latest'
  },
  ruleToc: { chapterList: '$.chapters[*]', chapterName: '$.title', chapterUrl: '$.url' },
  ruleContent: { content: '$.content' }
}))

await importSourcesFromAny(JSON.stringify(sourceList))
const importedSources = getSourceConfigs()
store['sources:settings'] = importedSources.reduce((result, source) => {
  result[source.id] = {
    lastTest: {
      status: 'passed',
      testedAt: Date.now(),
      keyword: 'same',
      count: 1,
      message: ''
    }
  }
  return result
}, {})
const picked = pickOnlineSearchSources(undefined, 10)
assert.equal(picked.length, 4)

let active = 0
let maxActive = 0
const requested = []
globalThis.uni.request = options => {
  const url = String(options.data && options.data.url || '')
  requested.push(url)
  active += 1
  maxActive = Math.max(maxActive, active)
  const sourceMatch = url.match(/source(\d+)/)
  const sourceIndex = sourceMatch ? Number(sourceMatch[1]) : 0
  const delay = sourceIndex === 1 ? 30 : sourceIndex === 2 ? 10 : 1
  setTimeout(() => {
    active -= 1
    options.success({
      statusCode: 200,
      data: {
        text: JSON.stringify({
          items: [
            {
              name: sourceIndex <= 2 ? 'Same Book' : `Unique Book ${sourceIndex}`,
              author: 'Same Author',
              latest: `Chapter ${sourceIndex}`,
              url: `/book/${sourceIndex}`
            }
          ]
        }),
        status_code: 200,
        final_url: url
      }
    })
  }, delay)
}

const progress = []
const results = await searchOnlineBooks('same', {
  sourceLimit: 4,
  concurrency: 2,
  timeoutMs: 1000,
  resultLimit: 20,
  onProgress: item => progress.push(item)
})

assert.equal(maxActive, 2)
assert.equal(requested.length, 4)
assert.equal(progress.length, 4)
assert.deepEqual(progress.map(item => item.done), [1, 2, 3, 4])
assert.equal(progress[0].total, 4)
assert.ok(progress.every(item => typeof item.elapsedMs === 'number'))
assert.equal(results.length, 3, 'same title and author should be deduplicated')
assert.deepEqual(results.map(item => item.title), ['Same Book', 'Unique Book 3', 'Unique Book 4'])
assert.equal(results[0].duplicateCount, 2)
assert.ok(results.every(item => typeof item.sourceQualityScore === 'number'))

const quality = getSourceQualityStats()
assert.equal(Object.keys(quality).length, 4)
assert.ok(Object.values(quality).every(item => item.searchCount === 1))
assert.ok(Object.values(quality).every(item => item.successCount === 1))
assert.ok(Object.values(quality).every(item => item.qualityScore >= 50))

const searchPage = await import('node:fs').then(fs => fs.readFileSync(new URL('../pages/search/search.vue', import.meta.url), 'utf8'))
assert.match(searchPage, /searchSettings/)
assert.match(searchPage, /searchProgressText/)
assert.match(searchPage, /sourceQualityScore/)
assert.match(searchPage, /saveOnlineSearchSettings/)

console.log('multiSourceSearch tests passed')
