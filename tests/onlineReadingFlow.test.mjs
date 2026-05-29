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
  if (url.includes('/search')) {
    return {
      text: async () => `
        <ul class="result">
          <li>
            <a href="/book/flow">星轨真实书</a>
            <span class="author">真实作者</span>
            <span class="last">第二章 星门</span>
          </li>
        </ul>
      `
    }
  }
  if (url.endsWith('/book/flow')) {
    return {
      text: async () => `
        <h1 id="book-title">星轨真实书</h1>
        <span class="book-author">真实作者</span>
        <a class="catalog" href="/book/flow/catalog">目录</a>
        <div class="intro">这是用于真实阅读闭环验证的书籍详情。</div>
      `
    }
  }
  if (url.endsWith('/book/flow/catalog')) {
    return {
      text: async () => `
        <div id="catalog">
          <a href="/book/flow/chapter-1">第一章 星火</a>
          <a href="/book/flow/chapter-2">第二章 星门</a>
        </div>
      `
    }
  }
  if (url.endsWith('/book/flow/chapter-1')) {
    return {
      text: async () => `
        <article id="content">
          <p>第一段真实正文。</p>
          <p>第二段真实正文，用于确认章节缓存。</p>
        </article>
      `
    }
  }
  throw new Error(`unexpected url ${url}`)
}

const {
  getOnlineShelfBooks,
  getSourceConfigs,
  importSourcesFromAny,
  runSourceReadingFlow
} = await import('../common/bookSources.js')

const sourceJson = JSON.stringify([{
  bookSourceName: 'Flow 3.x Source',
  bookSourceUrl: 'https://flow.example.com',
  bookSourceGroup: '真实闭环',
  searchUrl: 'https://flow.example.com/search?keyword={{key}}',
  ruleSearch: {
    bookList: 'class.result@tag.li',
    name: 'tag.a@text',
    author: 'class.author@text',
    latestChapter: 'class.last@text',
    bookUrl: 'tag.a@href'
  },
  ruleBookInfo: {
    name: 'id.book-title@text',
    author: 'class.book-author@text',
    intro: 'class.intro@text',
    tocUrl: 'class.catalog@href'
  },
  ruleToc: {
    chapterList: 'id.catalog@tag.a',
    chapterName: '@text',
    chapterUrl: '@href'
  },
  ruleContent: {
    content: 'id.content@textNodes'
  }
}])

const imported = await importSourcesFromAny(sourceJson)
assert.equal(imported.imported, 1)

const source = getSourceConfigs().find(item => item.name === 'Flow 3.x Source')
const flow = await runSourceReadingFlow(source.id, '星轨', { timeoutMs: 1000 })

assert.equal(flow.sourceId, source.id)
assert.equal(flow.keyword, '星轨')
assert.deepEqual(flow.stages.map(stage => stage.id), ['search', 'bookInfo', 'toc', 'content', 'shelf'])
assert.equal(flow.stages.every(stage => stage.status === 'passed'), true)
assert.equal(flow.book.title, '星轨真实书')
assert.equal(flow.chapters.length, 2)
assert.equal(flow.chapter.title, '第一章 星火')
assert.equal(flow.chapter.loadStatus, 'loaded')
assert.match(flow.chapter.content, /第二段真实正文/)

const cachedFlow = await runSourceReadingFlow(source.id, '星轨', { timeoutMs: 1000 })
assert.equal(cachedFlow.chapter.loadStatus, 'cached')

const shelfBook = getOnlineShelfBooks().find(book => book.id === flow.book.id)
assert.equal(shelfBook.title, '星轨真实书')
assert.equal(shelfBook.chapters[0].loadStatus, 'cached')
assert.equal(shelfBook.chapters[0].isCached, true)

const library = readFileSync(new URL('../pages/library/library.vue', import.meta.url), 'utf8')
assert.match(library, /runSourceReadingFlow/)
assert.match(library, /完整阅读测试/)
assert.match(library, /sourceFlowTesting/)

console.log('onlineReadingFlow tests passed')
