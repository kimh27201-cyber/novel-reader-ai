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
  applyImportPreview,
  buildImportPreview,
  getImportLogs,
  getSourceConfigs,
  importSourcesWithStats,
  normalizeBookSources,
  resolveImportInput
} = await import('../common/bookSources.js')

const yck = {
  suduguContent: 'https://www.yckceo.com/yuedu/shuyuan/content/id/7298.html',
  suduguJson: 'https://www.yckceo.com/yuedu/shuyuan/json/id/7298.json',
  freeContent: 'https://www.yckceo.com/yuedu/shuyuan/content/id/7436.html',
  freeJson: 'https://www.yckceo.com/yuedu/shuyuan/json/id/7436.json',
  suduguziContent: 'https://www.yckceo.com/yuedu/shuyuan/content/id/7404.html',
  suduguziJson: 'https://www.yckceo.com/yuedu/shuyuan/json/id/7404.json'
}

function resetStore() {
  Object.keys(store).forEach(key => delete store[key])
}

function suduguSource() {
  return {
    bookSourceComment: 'sudugu.org css rules',
    bookSourceGroup: 'YCK',
    bookSourceName: '\u901f\u8bfb\u8c37(SUDUGU)',
    bookSourceType: 0,
    bookSourceUrl: 'https://www.sudugu.org',
    enabled: true,
    enabledCookieJar: false,
    enabledExplore: true,
    exploreUrl: '[{"title":"xuanhuan","url":"/xuanhuan/{{page}}.html"}]',
    ruleBookInfo: {
      author: '@css:div.itemtxt a[href*="/zuozhe/"]@text',
      coverUrl: '@css:div.item a img@src',
      intro: '@css:div.des.bb@html',
      name: '@css:div.itemtxt h1 a@text',
      tocUrl: '@css:h2#dir a@href'
    },
    ruleContent: {
      content: '@css:div.con@html',
      nextContentUrl: 'text.\u4e0b\u4e00\u9875@href'
    },
    ruleExplore: {
      bookList: '@css:div.item',
      name: '@css:div.itemtxt h3 a@text',
      bookUrl: '@css:div.itemtxt h3 a@href'
    },
    ruleSearch: {
      bookList: '@css:div.item',
      name: '@css:div.itemtxt h3 a@text',
      bookUrl: '@css:div.itemtxt h3 a@href'
    },
    ruleToc: {
      chapterList: '@css:div#list.dir.clear ul li a',
      chapterName: 'text',
      chapterUrl: 'href'
    },
    searchUrl: '/i/sor.aspx?key={{key}}'
  }
}

function freeSource() {
  return {
    bookSourceComment: '2026.6.21 sample',
    bookSourceGroup: 'YCK',
    bookSourceName: '\u514d\u8d39\u5c0f\u8bf4',
    bookSourceType: 0,
    bookSourceUrl: 'https://cn.zhys.tw',
    customOrder: 2,
    enabled: true,
    enabledCookieJar: true,
    enabledExplore: true,
    exploreUrl: '@js:JSON.stringify([]);',
    header: '{"User-Agent":"Mozilla/5.0"}',
    ruleBookInfo: {
      author: "a[href*='/author/']@text",
      coverUrl: 'figure img@src||img@src',
      intro: "div[itemprop='description']@text",
      name: 'h1@text'
    },
    ruleContent: {
      content: '#article-content@html',
      replaceRegex: '##ad'
    },
    ruleExplore: {
      bookList: "li[itemprop='mainEntity']",
      bookUrl: "a[itemprop='url']@href",
      name: "h2[itemprop='name']@text"
    },
    ruleSearch: {
      bookList: "li[itemprop='mainEntity']",
      bookUrl: "a[itemprop='url']@href",
      name: "h2[itemprop='name']@text"
    },
    ruleToc: {
      chapterList: "#full-catalog a[href*='/read/']",
      chapterName: 'text',
      chapterUrl: 'href'
    },
    searchUrl: '/search?q={{key}}&page={{page}}'
  }
}

function suduguziSource() {
  return {
    bookSourceGroup: 'YCK',
    bookSourceName: '\u901f\u8bfb\u8c37\u5b50',
    bookSourceType: 0,
    bookSourceUrl: 'https://www.sudugu.org/',
    customOrder: 128,
    enabled: true,
    enabledCookieJar: true,
    enabledExplore: true,
    exploreUrl: '@js:org.jsoup.Jsoup.parse(java.ajax(source.key + "fenlei"));',
    ruleBookInfo: {
      author: 'text.\u4f5c\u8005\uff1a@text',
      coverUrl: '.item@img@src',
      intro: '.des.0@html',
      name: 'h1@a@text'
    },
    ruleContent: {
      content: '.con@html',
      nextContentUrl: 'text.\u4e0b\u4e00\u9875@href'
    },
    ruleSearch: {
      author: 'text.\u4f5c\u8005\uff1a@text',
      bookList: '.item',
      bookUrl: 'a.0@href',
      coverUrl: 'img@src',
      name: 'h3@a,b@text'
    },
    ruleToc: {
      chapterList: '.dir@li',
      chapterName: 'text',
      chapterUrl: 'a@href'
    },
    searchUrl: 'i/sor.aspx?key={{key}}<,&p={{page}}>'
  }
}

function shuba69Source() {
  return {
    bookSourceName: '69\u4e66\u5427[]',
    bookSourceType: 0,
    bookSourceUrl: 'https://www.69shuba.com',
    enabledCookieJar: true,
    enabledExplore: true,
    exploreUrl: '@js:org.jsoup.Jsoup.parse(Ajax(source.key + "/novels/hot"));',
    jsLib: 'function Ajax(url){ return java.startBrowserAwait(url, "verify").body(); }',
    loginCheckJs: 'cookie.setCookie(result.url(), cookie.getCookie(result.url())); java.startBrowserAwait(result.url(), "verify");',
    ruleBookInfo: { name: '[property$=book_name]@content', author: '[property$=author]@content' },
    ruleContent: { content: '.txtnav@html\n@js:org.jsoup.Jsoup.parse(result).body().html();' },
    ruleSearch: { bookList: '<js>java.toast("blocked"); result;</js>\n.newbox > ul > li', name: 'h3@text', bookUrl: 'a.0@href' },
    ruleToc: { chapterList: '#catalog li\n@js:result.toArray().sort((a,b)=>1);', chapterName: 'a@text', chapterUrl: 'a@href' },
    searchUrl: '/modules/article/search.php,{"method":"POST","headers":{"Cookie":"{{cookie.getCookie(source.key)}}"}}'
  }
}

function assertVisibleSource(name, expectedRaw = {}) {
  const source = getSourceConfigs().find(item => item.name === name)
  assert.ok(source, `${name} should be visible in getSourceConfigs()`)
  Object.keys(expectedRaw).forEach(key => assert.equal(source.raw[key], expectedRaw[key]))
  return source
}

resetStore()
const singleJson = importSourcesWithStats(JSON.stringify(suduguSource()), {
  importMethod: 'json-text',
  originalType: 'json-object'
})
assert.equal(singleJson.imported, 1)
assert.equal(singleJson.actualWritten, 1)
assert.equal(singleJson.visible, 1)
const sudugu = assertVisibleSource('\u901f\u8bfb\u8c37(SUDUGU)', {
  bookSourceUrl: 'https://www.sudugu.org',
  searchUrl: '/i/sor.aspx?key={{key}}'
})
assert.equal(sudugu.raw.ruleSearch.bookList, '@css:div.item')
assert.equal(sudugu.raw.ruleBookInfo.name, '@css:div.itemtxt h1 a@text')
assert.equal(sudugu.raw.ruleToc.chapterList, '@css:div#list.dir.clear ul li a')
assert.equal(sudugu.raw.ruleContent.content, '@css:div.con@html')
assert.equal(singleJson.importLog.source, 'json-text')
assert.equal(singleJson.importLog.originalType, 'json-object')
assert.equal(singleJson.importLog.parsedCount, 1)
assert.equal(singleJson.importLog.successCount, 1)
assert.equal(singleJson.importLog.storageCount, 1)
assert.equal(getImportLogs()[0].id, singleJson.importLog.id)

resetStore()
const batch = importSourcesWithStats(JSON.stringify([suduguSource(), freeSource(), suduguziSource()]), {
  importMethod: 'batch-json',
  originalType: 'json-array'
})
assert.equal(batch.total, 3)
assert.equal(batch.imported, 3)
assert.equal(batch.actualWritten, 3)
assert.equal(batch.visible, 3)
assert.equal(getSourceConfigs().length, 3)
assertVisibleSource('\u514d\u8d39\u5c0f\u8bf4')
assertVisibleSource('\u901f\u8bfb\u8c37\u5b50')
assert.equal(batch.importLog.parsedCount, 3)
assert.equal(batch.importLog.successCount, 3)
assert.equal(batch.importLog.storageCount, 3)

resetStore()
let requestedUrl = ''
const resolvedUrl = await resolveImportInput(yck.suduguContent, {
  fetchText: async url => {
    requestedUrl = url
    return JSON.stringify(suduguSource())
  }
})
assert.equal(requestedUrl, yck.suduguJson)
assert.equal(resolvedUrl.sourceUrl, yck.suduguJson)
const urlPreview = buildImportPreview(normalizeBookSources(resolvedUrl.rawSources, resolvedUrl.sourceMeta), getSourceConfigs())
const urlResult = applyImportPreview(urlPreview, {
  importMethod: resolvedUrl.sourceMeta.source,
  sourceUrl: resolvedUrl.sourceUrl,
  originalType: resolvedUrl.type
})
assert.equal(urlResult.imported, 1)
assert.equal(urlResult.importLog.source, 'repository-detail')
assert.equal(urlResult.importLog.sourceUrl, yck.suduguJson)
assertVisibleSource('\u901f\u8bfb\u8c37(SUDUGU)')

resetStore()
const deepLink = `booksource://import?url=${encodeURIComponent(yck.suduguziContent)}`
let deepLinkRequestedUrl = ''
const resolvedDeepLink = await resolveImportInput(deepLink, {
  fetchText: async url => {
    deepLinkRequestedUrl = url
    return JSON.stringify(suduguziSource())
  }
})
assert.equal(deepLinkRequestedUrl, yck.suduguziJson)
const deepLinkResult = applyImportPreview(
  buildImportPreview(normalizeBookSources(resolvedDeepLink.rawSources, resolvedDeepLink.sourceMeta), getSourceConfigs()),
  { importMethod: '3x-deeplink', sourceUrl: resolvedDeepLink.sourceUrl, originalType: '3.x' }
)
assert.equal(deepLinkResult.imported, 1)
assert.equal(deepLinkResult.visible, 1)
assert.equal(deepLinkResult.importLog.originalType, '3.x')
assertVisibleSource('\u901f\u8bfb\u8c37\u5b50')

resetStore()
importSourcesWithStats(JSON.stringify(suduguSource()), { importMethod: 'json-text' })
const duplicatePreview = buildImportPreview(
  normalizeBookSources({ ...suduguSource(), bookSourceGroup: 'Updated' }, { source: 'clipboard' }),
  getSourceConfigs(),
  { duplicateStrategy: 'skip' }
)
const duplicateResult = applyImportPreview(duplicatePreview, { duplicateStrategy: 'skip', importMethod: 'clipboard' })
assert.equal(duplicateResult.imported, 0)
assert.equal(duplicateResult.updated, 0)
assert.equal(duplicateResult.skipped, 1)
assert.equal(duplicateResult.actualWritten, 0)
assert.equal(getSourceConfigs().length, 1)
assert.equal(duplicateResult.importLog.skippedCount, 1)
assert.equal(duplicateResult.importLog.storageCount, 1)

resetStore()
const missingFieldResult = applyImportPreview(
  buildImportPreview(normalizeBookSources({ bookSourceName: 'Missing Url Source' }), getSourceConfigs()),
  { importMethod: 'json-text', originalType: 'json-object' }
)
assert.equal(missingFieldResult.actualWritten, 0)
assert.equal(missingFieldResult.skipped, 1)
assert.equal(missingFieldResult.importLog.failedCount, 1)
assert.ok(missingFieldResult.importLog.failureReasons.some(reason => /Missing required fields/.test(reason)))
assert.equal(getSourceConfigs().length, 0)

resetStore()
const incompatiblePreview = buildImportPreview(normalizeBookSources(shuba69Source(), { source: 'json-url', sourceUrl: 'https://www.yckceo.com/yuedu/shuyuan/json/id/7395.json' }), getSourceConfigs())
const incompatibleResult = applyImportPreview(incompatiblePreview, { importMethod: 'json-url', sourceUrl: 'https://www.yckceo.com/yuedu/shuyuan/json/id/7395.json' })
assert.equal(incompatibleResult.actualWritten, 1)
assert.equal(incompatibleResult.skipped, 0)
assert.equal(incompatibleResult.importLog.unsupported, 1)
assert.ok(incompatibleResult.importLog.failureReasons.some(reason => /JS|WebView|Cookie|Legado runtime/.test(reason)))
assert.equal(getSourceConfigs().some(item => item.name === '69\u4e66\u5427[]' && item.enabled === false), true)

console.log('yckSourceImportAcceptance tests passed')
