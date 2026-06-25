import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const store = {}
globalThis.uni = {
  getStorageSync(key) {
    return store[key]
  },
  setStorageSync(key, value) {
    store[key] = value
  }
}

globalThis.fetch = async rawUrl => {
  const url = String(rawUrl)
  if (url.includes('timeout.example.com')) {
    throw new Error('Timeout Source响应超时')
  }
  if (url.includes('/search')) {
    return {
      text: async () => JSON.stringify({
        items: [{
          name: url.includes('broken') ? 'Broken Book' : 'Health Book',
          author: 'Health Author',
          latest: 'Chapter 2',
          url: url.includes('broken') ? '/broken/book' : '/book/health'
        }]
      })
    }
  }
  if (url.endsWith('/book/health')) {
    return {
      text: async () => JSON.stringify({
        name: 'Health Book',
        author: 'Health Author',
        intro: 'A healthy source',
        tocUrl: '/book/health/catalog'
      })
    }
  }
  if (url.endsWith('/book/health/catalog')) {
    return {
      text: async () => JSON.stringify({
        chapters: [
          { title: 'Chapter 1', url: '/book/health/1' },
          { title: 'Chapter 2', url: '/book/health/2' }
        ]
      })
    }
  }
  if (url.endsWith('/book/health/1')) {
    return {
      text: async () => JSON.stringify({
        content: 'Health content paragraph one.\nHealth content paragraph two.'
      })
    }
  }
  if (url.endsWith('/broken/book')) {
    throw new Error('detail unavailable')
  }
  throw new Error(`unexpected url ${url}`)
}

const {
  batchCheckSourceHealth,
  getSourceConfig,
  getSourceConfigs,
  getSourceDiagnostics,
  importSourcesFromAny,
  runSourceHealthCheck
} = await import('../common/bookSources.js')

const sourceJson = JSON.stringify([
  {
    bookSourceName: 'Healthy Source',
    bookSourceUrl: 'https://health.example.com',
    bookSourceGroup: 'Health',
    searchUrl: 'https://health.example.com/search?keyword={{key}}',
    ruleSearch: {
      bookList: '$.items[*]',
      name: '$.name',
      author: '$.author',
      latestChapter: '$.latest',
      bookUrl: '$.url'
    },
    ruleBookInfo: {
      name: '$.name',
      author: '$.author',
      intro: '$.intro',
      tocUrl: '$.tocUrl'
    },
    ruleToc: {
      chapterList: '$.chapters[*]',
      chapterName: '$.title',
      chapterUrl: '$.url'
    },
    ruleContent: {
      content: '$.content'
    }
  },
  {
    bookSourceName: 'Broken Source',
    bookSourceUrl: 'https://broken.example.com',
    bookSourceGroup: 'Health',
    searchUrl: 'https://broken.example.com/search?keyword={{key}}',
    ruleSearch: {
      bookList: '$.items[*]',
      name: '$.name',
      author: '$.author',
      latestChapter: '$.latest',
      bookUrl: '$.url'
    },
    ruleBookInfo: {
      name: '$.name'
    },
    ruleToc: {
      chapterList: '$.chapters[*]',
      chapterName: '$.title',
      chapterUrl: '$.url'
    },
    ruleContent: {
      content: '$.content'
    }
  },
  {
    bookSourceName: 'Timeout Source',
    bookSourceUrl: 'https://timeout.example.com',
    bookSourceGroup: 'Health',
    searchUrl: 'https://timeout.example.com/search?keyword={{key}}',
    ruleSearch: {
      bookList: '$.items[*]',
      name: '$.name',
      author: '$.author',
      latestChapter: '$.latest',
      bookUrl: '$.url'
    },
    ruleBookInfo: {
      name: '$.name'
    },
    ruleToc: {
      chapterList: '$.chapters[*]',
      chapterName: '$.title',
      chapterUrl: '$.url'
    },
    ruleContent: {
      content: '$.content'
    }
  }
])

await importSourcesFromAny(sourceJson)
const healthy = getSourceConfigs().find(item => item.name === 'Healthy Source')
const broken = getSourceConfigs().find(item => item.name === 'Broken Source')
const timeout = getSourceConfigs().find(item => item.name === 'Timeout Source')

const health = await runSourceHealthCheck(healthy.id, 'health', { timeoutMs: 1000 })
assert.equal(health.sourceId, healthy.id)
assert.equal(health.status, 'passed')
assert.equal(health.score, 90)
assert.deepEqual(health.stages.map(stage => stage.id), ['search', 'bookInfo', 'toc', 'content'])
assert.ok(health.stages.every(stage => stage.status === 'passed'))
assert.ok(health.stages.every(stage => typeof stage.elapsedMs === 'number'))

const healthyDiagnostics = getSourceDiagnostics(getSourceConfig(healthy.id))
assert.equal(healthyDiagnostics.health.status, 'passed')
assert.equal(healthyDiagnostics.health.score, 90)
assert.equal(healthyDiagnostics.health.stageCount, 4)

const failedHealth = await runSourceHealthCheck(broken.id, 'broken', { timeoutMs: 1000 })
assert.equal(failedHealth.status, 'failed')
assert.ok(failedHealth.score < 60)
assert.ok(failedHealth.failedStage)
assert.ok(failedHealth.stages.some(stage => stage.status === 'failed'))

const timeoutHealth = await runSourceHealthCheck(timeout.id, 'timeout', { timeoutMs: 1000 })
assert.equal(timeoutHealth.status, 'failed')
assert.equal(timeoutHealth.failedStage, 'search')
assert.match(timeoutHealth.message, /目标站点响应超时/)
assert.match(timeoutHealth.stages.find(stage => stage.id === 'search').message, /目标站点响应超时/)

const batchProgress = []
const batch = await batchCheckSourceHealth({
  keyword: 'health',
  sourceIds: [healthy.id, broken.id],
  timeoutMs: 1000,
  onProgress: item => batchProgress.push(item)
})
assert.equal(batch.total, 2)
assert.equal(batch.passed, 1)
assert.equal(batch.failed, 1)
assert.equal(batch.results.length, 2)
assert.equal(batchProgress.length, 2)
assert.equal(batch.results[0].score >= batch.results[1].score, true)

const library = readFileSync(new URL('../pages/library/library.vue', import.meta.url), 'utf8')
assert.match(library, /batchCheckSourceHealth/)
assert.match(library, /sourceHealthScore/)
assert.match(library, /健康/)
assert.match(library, /全链路/)

assert.match(library, /sourceHealthFailureText/)
assert.match(library, /失败阶段/)

console.log('sourceHealth tests passed')
