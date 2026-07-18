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
  buildYckContentUrl,
  buildYckJsonUrl,
  detectImportInputType,
  detectYckCeoUrl,
  extractYckSourceId,
  resolveImportInput,
  resolveYckCeoUrl
} = await import('../common/bookSources.js')

const contentUrl = 'https://www.yckceo.com/yuedu/shuyuan/content/id/7298.html'
const jsonUrl = 'https://www.yckceo.com/yuedu/shuyuan/json/id/7298.json'
const listUrl = 'https://www.yckceo.com/yuedu/shuyuan/index.html'
const deepLink = `yuedu://booksource/import?src=${encodeURIComponent(jsonUrl)}`
const booksourceLink = `booksource://import?url=${encodeURIComponent(contentUrl)}`

assert.deepEqual(detectYckCeoUrl(listUrl), {
  isYck: true,
  kind: 'list',
  id: '',
  url: listUrl
})
assert.deepEqual(detectYckCeoUrl(contentUrl), {
  isYck: true,
  kind: 'content',
  id: '7298',
  url: contentUrl
})
assert.deepEqual(detectYckCeoUrl(jsonUrl), {
  isYck: true,
  kind: 'json',
  id: '7298',
  url: jsonUrl
})
assert.equal(extractYckSourceId(contentUrl), '7298')
assert.equal(extractYckSourceId(jsonUrl), '7298')
assert.equal(buildYckJsonUrl('7298'), jsonUrl)
assert.equal(buildYckContentUrl('7298'), contentUrl)
assert.equal(resolveYckCeoUrl(contentUrl).url, jsonUrl)
assert.equal(resolveYckCeoUrl(jsonUrl).url, jsonUrl)
assert.equal(resolveYckCeoUrl(listUrl).action, 'navigate')

assert.equal(detectImportInputType(contentUrl).type, 'repository-detail')
assert.equal(detectImportInputType(jsonUrl).type, 'json-url')
assert.equal(detectImportInputType(deepLink).value, jsonUrl)
assert.equal(detectImportInputType(booksourceLink).value, jsonUrl)

let requestedUrl = ''
const resolved = await resolveImportInput(contentUrl, {
  fetchText: async url => {
    requestedUrl = url
    return JSON.stringify({
      bookSourceName: '速读谷(SUDUGU)',
      bookSourceUrl: 'https://www.sudugu.example',
      searchUrl: 'https://www.sudugu.example/search?q={{key}}',
      ruleSearch: { bookList: '.book', name: '.name', bookUrl: 'a@href' },
      ruleBookInfo: { name: 'h1', author: '.author' },
      ruleToc: { chapterList: '.chapter', chapterName: 'a', chapterUrl: 'a@href' },
      ruleContent: { content: '.content' }
    })
  }
})
assert.equal(requestedUrl, jsonUrl)
assert.equal(resolved.sourceUrl, jsonUrl)
assert.equal(resolved.sourceMeta.source, 'repository-detail')

const listResolved = await resolveImportInput(listUrl)
assert.equal(listResolved.action, 'navigate')
assert.equal(listResolved.type, 'repository-list')

console.log('yckImportFlow tests passed')
