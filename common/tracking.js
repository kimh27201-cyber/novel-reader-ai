const TRACKED_BOOKS_KEY = 'tracking:books'

export const platformCatalog = [
  {
    name: '番茄小说',
    homeUrl: 'https://fanqienovel.com/',
    mobileUrl: 'https://fanqienovel.com/',
    aliases: ['fanqienovel', 'fqnovel'],
    search: keyword => `https://fanqienovel.com/search?keyword=${encodeURIComponent(keyword)}`,
    mobileSearch: keyword => `https://fanqienovel.com/search?keyword=${encodeURIComponent(keyword)}`
  },
  {
    name: '书旗小说',
    homeUrl: 'https://www.shuqi.com/',
    mobileUrl: 'https://m.shuqi.com/',
    aliases: ['shuqi'],
    search: keyword => `https://www.shuqi.com/search?keyword=${encodeURIComponent(keyword)}`,
    mobileSearch: keyword => `https://m.shuqi.com/search?keyword=${encodeURIComponent(keyword)}`
  },
  {
    name: '起点中文网',
    homeUrl: 'https://www.qidian.com/',
    mobileUrl: 'https://m.qidian.com/',
    aliases: ['qidian'],
    search: keyword => `https://www.qidian.com/search?kw=${encodeURIComponent(keyword)}`,
    mobileSearch: keyword => `https://m.qidian.com/search?kw=${encodeURIComponent(keyword)}`
  },
  {
    name: '晋江文学城',
    homeUrl: 'https://www.jjwxc.net/',
    mobileUrl: 'https://m.jjwxc.net/',
    aliases: ['jjwxc'],
    search: keyword => `https://www.jjwxc.net/search.php?kw=${encodeURIComponent(keyword)}`,
    mobileSearch: keyword => `https://m.jjwxc.net/search.php?kw=${encodeURIComponent(keyword)}`
  },
  {
    name: '七猫小说',
    homeUrl: 'https://www.qimao.com/',
    mobileUrl: 'https://www.qimao.com/',
    aliases: ['qimao'],
    search: keyword => `https://www.qimao.com/search/index?keyword=${encodeURIComponent(keyword)}`,
    mobileSearch: keyword => `https://www.qimao.com/search/index?keyword=${encodeURIComponent(keyword)}`
  },
  {
    name: '纵横中文网',
    homeUrl: 'https://www.zongheng.com/',
    mobileUrl: 'https://m.zongheng.com/',
    aliases: ['zongheng'],
    search: keyword => `https://www.zongheng.com/search?keyword=${encodeURIComponent(keyword)}`,
    mobileSearch: keyword => `https://m.zongheng.com/search?keyword=${encodeURIComponent(keyword)}`
  },
  {
    name: '刺猬猫',
    homeUrl: 'https://www.ciweimao.com/',
    mobileUrl: 'https://www.ciweimao.com/',
    aliases: ['ciweimao'],
    search: keyword => `https://www.ciweimao.com/search?keyword=${encodeURIComponent(keyword)}`,
    mobileSearch: keyword => `https://www.ciweimao.com/search?keyword=${encodeURIComponent(keyword)}`
  },
  {
    name: '飞卢小说',
    homeUrl: 'https://b.faloo.com/',
    mobileUrl: 'https://m.faloo.com/',
    aliases: ['faloo'],
    search: keyword => `https://b.faloo.com/search.html?k=${encodeURIComponent(keyword)}`,
    mobileSearch: keyword => `https://m.faloo.com/search.html?k=${encodeURIComponent(keyword)}`
  },
  {
    name: '掌阅',
    homeUrl: 'https://www.ireader.com/',
    mobileUrl: 'https://m.ireader.com/',
    aliases: ['ireader', 'zhangyue'],
    search: keyword => `https://www.ireader.com/index.php?ca=search.index&keyword=${encodeURIComponent(keyword)}`,
    mobileSearch: keyword => `https://m.ireader.com/index.php?ca=search.index&keyword=${encodeURIComponent(keyword)}`
  },
  {
    name: 'QQ阅读',
    homeUrl: 'https://book.qq.com/',
    mobileUrl: 'https://m.yuewen.com/',
    aliases: ['book.qq.com', 'yuewen'],
    search: keyword => `https://book.qq.com/search?kw=${encodeURIComponent(keyword)}`,
    mobileSearch: keyword => `https://m.yuewen.com/search?kw=${encodeURIComponent(keyword)}`
  },
  {
    name: '微信读书',
    homeUrl: 'https://weread.qq.com/',
    mobileUrl: 'https://weread.qq.com/',
    aliases: ['weread'],
    search: keyword => `https://weread.qq.com/web/search/books?keyword=${encodeURIComponent(keyword)}`,
    mobileSearch: keyword => `https://weread.qq.com/web/search/books?keyword=${encodeURIComponent(keyword)}`
  },
  {
    name: '咪咕阅读',
    homeUrl: 'https://www.cmread.com/',
    mobileUrl: 'https://m.cmread.com/',
    aliases: ['cmread', 'migu'],
    search: keyword => `https://www.cmread.com/search?keyword=${encodeURIComponent(keyword)}`,
    mobileSearch: keyword => `https://m.cmread.com/search?keyword=${encodeURIComponent(keyword)}`
  },
  {
    name: '其他',
    homeUrl: '',
    aliases: [],
    search: null
  }
]

export const trackingPlatforms = platformCatalog.map(platform => platform.name)
export const trackingCategories = ['都市', '恋爱', '玄幻', '科幻', '悬疑', '历史', '武侠', '游戏', '轻小说', '其他']
export const trackingStatuses = ['在追', '养肥', '已完结', '暂停', '弃书']

function readTrackedBooks() {
  try {
    return uni.getStorageSync(TRACKED_BOOKS_KEY) || []
  } catch (error) {
    return []
  }
}

function writeTrackedBooks(books) {
  uni.setStorageSync(TRACKED_BOOKS_KEY, books)
}

function createTrackingId() {
  return `track-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function clean(value) {
  return String(value || '').trim()
}

function trimTrailingSlash(url) {
  return clean(url).replace(/\/+$/, '')
}

function getPlatformByName(name) {
  return platformCatalog.find(platform => platform.name === name) || platformCatalog[platformCatalog.length - 1]
}

function isLikelyHomeUrl(url, platform) {
  if (!url || !platform || !platform.homeUrl) return false
  const current = trimTrailingSlash(url).toLowerCase()
  const homes = [platform.homeUrl, platform.mobileUrl].filter(Boolean).map(item => trimTrailingSlash(item).toLowerCase())
  return homes.includes(current)
}

export function detectPlatform(url) {
  const text = clean(url).toLowerCase()
  const platform = platformCatalog.find(item => item.aliases.some(alias => text.includes(alias)))
  return platform ? platform.name : ''
}

export function buildTrackingQuery(book) {
  return clean(book && book.title)
}

export function buildTrackingTarget(book) {
  if (!book) {
    throw new Error('没有找到这本追书记录')
  }

  const url = clean(book.url)
  const platformName = clean(book.platform) || detectPlatform(url) || '其他'
  const platform = getPlatformByName(platformName)
  const query = buildTrackingQuery(book)

  if (url && !isLikelyHomeUrl(url, platform)) {
    return {
      url,
      mode: query ? 'direct' : 'link',
      label: query ? '打开你保存的具体链接' : '打开保存链接'
    }
  }

  if ((platform.mobileSearch || platform.search) && query) {
    return {
      url: (platform.mobileSearch || platform.search)(query),
      mode: 'search',
      label: '用移动端搜索这本书'
    }
  }

  if (url) {
    return {
      url,
      mode: 'home',
      label: '打开平台入口'
    }
  }

  if (platform.mobileUrl || platform.homeUrl) {
    return {
      url: platform.mobileUrl || platform.homeUrl,
      mode: 'home',
      label: '打开移动端平台入口'
    }
  }

  throw new Error('请填写正版阅读链接，或选择一个内置平台')
}

export function normalizeTrackedBook(payload) {
  const now = Date.now()
  const url = clean(payload.url)
  const platform = clean(payload.platform) || detectPlatform(url) || '其他'
  return {
    id: payload.id || createTrackingId(),
    title: clean(payload.title),
    author: clean(payload.author) || '未知作者',
    platform,
    category: clean(payload.category) || '其他',
    status: clean(payload.status) || '在追',
    lastChapter: clean(payload.lastChapter) || '未开始',
    url,
    note: clean(payload.note),
    createdAt: payload.createdAt || now,
    updatedAt: now,
    openedAt: payload.openedAt || 0
  }
}

export function getTrackedBooks() {
  return readTrackedBooks().sort((a, b) => {
    return (b.openedAt || b.updatedAt || 0) - (a.openedAt || a.updatedAt || 0)
  })
}

export function getTrackedBook(bookId) {
  return readTrackedBooks().find(book => book.id === bookId)
}

export function exportTrackedBooks() {
  return JSON.stringify({
    app: '解码阅读',
    type: 'tracked-books',
    version: 1,
    exportedAt: Date.now(),
    books: readTrackedBooks()
  }, null, 2)
}

export function importTrackedBooksFromBackup(text) {
  let parsed
  try {
    parsed = JSON.parse(clean(text))
  } catch (error) {
    throw new Error('备份内容不是有效 JSON')
  }

  const source = Array.isArray(parsed) ? parsed : parsed.books
  if (!Array.isArray(source)) {
    throw new Error('备份里没有追书列表')
  }

  const current = readTrackedBooks()
  const normalized = source
    .map(item => normalizeTrackedBook(item || {}))
    .filter(book => book.title)

  const merged = [...normalized, ...current.filter(book => !normalized.some(item => item.id === book.id))]
  writeTrackedBooks(merged)
  return normalized.length
}

export function saveTrackedBook(payload) {
  const book = normalizeTrackedBook(payload)
  if (!book.title) {
    throw new Error('请填写书名')
  }
  buildTrackingTarget(book)

  const next = readTrackedBooks().filter(item => item.id !== book.id)
  writeTrackedBooks([book, ...next])
  return book
}

export function updateTrackedBook(bookId, updates) {
  const current = getTrackedBook(bookId)
  if (!current) {
    throw new Error('没有找到这本追书记录')
  }
  return saveTrackedBook({
    ...current,
    ...updates,
    id: current.id,
    createdAt: current.createdAt
  })
}

export function deleteTrackedBook(bookId) {
  writeTrackedBooks(readTrackedBooks().filter(book => book.id !== bookId))
}

export function markTrackedBookOpened(bookId) {
  const current = getTrackedBook(bookId)
  if (!current) return null
  const next = {
    ...current,
    openedAt: Date.now(),
    updatedAt: Date.now()
  }
  const books = readTrackedBooks().filter(book => book.id !== bookId)
  writeTrackedBooks([next, ...books])
  return next
}

export function searchTrackedBooks(keyword) {
  const word = clean(keyword).toLowerCase()
  if (!word) return []
  return getTrackedBooks()
    .filter(book => {
      return [book.title, book.author, book.platform, book.category, book.status, book.lastChapter, book.note]
        .join(' ')
        .toLowerCase()
        .includes(word)
    })
    .map(book => {
      const target = buildTrackingTarget(book)
      return {
        type: 'tracking',
        bookId: book.id,
        title: book.title,
        subtitle: `正版入口 · ${book.platform}`,
        snippet: target.label,
        targetUrl: target.url
      }
    })
}

export function openTrackedBook(book) {
  const target = buildTrackingTarget(book)

  markTrackedBookOpened(book.id)

  if (typeof plus !== 'undefined' && plus.runtime && plus.runtime.openURL) {
    plus.runtime.openURL(target.url)
    return 'opened'
  }

  uni.setClipboardData({
    data: target.url
  })
  return 'copied'
}
