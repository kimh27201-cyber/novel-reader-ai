import { deleteOnlineBookFromShelf, getOnlineBook, getOnlineShelfBooks } from './bookSources.js'

const IMPORTED_BOOKS_KEY = 'books:imported'
const HIDDEN_BUILTIN_BOOKS_KEY = 'books:hidden-builtin'
const LOCAL_CHAPTER_KEY_PREFIX = 'books:local-chapter'
const LOCAL_CHAPTER_SEGMENT_SIZE = 180000
const memoryStore = {}

export const builtInBooks = [
  {
    id: 'wind-city',
    source: 'builtin',
    title: '风停在旧城',
    author: '示例作者',
    category: '都市幻想',
    coverColor: '#7aa095',
    accent: '#314d48',
    description: '一个关于旧城、信件与失落时间的离线示例故事。',
    chapters: [
      {
        title: '第一章 雨后的街灯',
        content: `雨停以后，旧城的街灯一盏接一盏亮了起来。
林澈推开书店的木门，门铃发出很轻的一声响。柜台后没有人，只有一封被压在玻璃镇纸下的信，信封上写着他的名字。
他已经三年没有回到这里。旧城似乎没有变，窄巷、青石、潮湿的墙面，以及傍晚从河面吹来的风，都像一页被夹在书里的旧照片。`
      },
      {
        title: '第二章 钟楼的影子',
        content: `钟楼在旧城中央，指针停在九点十二分。
小时候，林澈总觉得这座钟楼比所有房子都老。它看见过太多人离开，也看见过太多人回来，但它自己从不解释什么。
楼梯上有灰尘，也有新的脚印。林澈沿着旋转楼梯向上走，越往上，风越清朗。`
      },
      {
        title: '第三章 没有寄出的夏天',
        content: `码头已经废弃，木板被雨水泡得发黑。
林澈在那里找到一只铁盒。盒子里没有宝物，只有一叠没有寄出的明信片。每一张都写给他，每一张都停在同一个开头：林澈，你走以后。
原来有些告别并不发生在离开的那天，而是发生在很久以后。`
      }
    ]
  },
  {
    id: 'star-trace',
    source: 'builtin',
    title: '星轨图书馆',
    author: '示例作者',
    category: '轻科幻',
    coverColor: '#6e7f9f',
    accent: '#273553',
    description: '漂浮在近地轨道上的图书馆，保存着人类忘记的梦。',
    chapters: [
      {
        title: '第一章 失重借阅证',
        content: `凌晨四点，星轨图书馆经过城市上空。
安禾第一次看见它时，以为那只是一颗移动得过慢的星星。直到手机里弹出一张借阅证，证件照的位置是一片透明的夜空。
请在三分钟内抬头。
她照做了。下一秒，城市的噪声像被合上一样远去，整个人轻轻离地。`
      },
      {
        title: '第二章 梦的索引',
        content: `图书馆里没有管理员，只有无数悬浮的书页。
每一页都记录着一个被遗忘的梦。有人梦见海底有一座车站，有人梦见母亲年轻时的背影，还有人梦见一场从未发生的告白。
安禾在索引台输入自己的名字。片刻后，一页纸飞到她面前。`
      }
    ]
  }
]

const coverColors = ['#7aa095', '#6e7f9f', '#9b7f78', '#728b75', '#8b789b', '#9a8a62']

function readImportedBooks() {
  return readStorage(IMPORTED_BOOKS_KEY, [])
}

function saveImportedBooks(books) {
  writeStorage(IMPORTED_BOOKS_KEY, books)
}

function readHiddenBuiltinBookIds() {
  try {
    return uni.getStorageSync(HIDDEN_BUILTIN_BOOKS_KEY) || []
  } catch (error) {
    return []
  }
}

function saveHiddenBuiltinBookIds(bookIds) {
  writeStorage(HIDDEN_BUILTIN_BOOKS_KEY, bookIds)
}

function readStorage(key, fallback) {
  try {
    if (typeof uni !== 'undefined' && uni.getStorageSync) {
      const value = uni.getStorageSync(key)
      return value === '' || value == null ? fallback : value
    }
  } catch (error) {
    return fallback
  }
  return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : fallback
}

function writeStorage(key, value) {
  if (typeof uni !== 'undefined' && uni.setStorageSync) {
    uni.setStorageSync(key, value)
    return
  }
  memoryStore[key] = value
}

function removeStorage(key) {
  try {
    if (typeof uni !== 'undefined' && uni.removeStorageSync) {
      uni.removeStorageSync(key)
      return
    }
  } catch (error) {
    // keep memory cleanup below as a fallback for tests and non-uni runtimes
  }
  delete memoryStore[key]
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u3000/g, ' ')
    .replace(/[ \t]{3,}/g, '  ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function inferTitle(text) {
  const firstLine = normalizeText(text).split('\n').find(line => line.trim())
  return firstLine ? firstLine.trim().slice(0, 24) : '本地导入小说'
}

function createBookId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function localChapterKey(bookId, chapterIndex, segmentIndex = 0) {
  return `${LOCAL_CHAPTER_KEY_PREFIX}:${bookId}:${chapterIndex}:${segmentIndex}`
}

function removeLocalChapterStorage(book) {
  ;(book.chapters || []).forEach(chapter => {
    ;(chapter.contentKeys || []).forEach(key => removeStorage(key))
    if (chapter.contentKey) removeStorage(chapter.contentKey)
  })
}

function persistLocalChapter(bookId, chapter, index, storedKeys) {
  const content = normalizeText(chapter.content)
  const keys = []
  const segmentCount = Math.max(1, Math.ceil(content.length / LOCAL_CHAPTER_SEGMENT_SIZE))

  for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
    const key = localChapterKey(bookId, index, segmentIndex)
    const start = segmentIndex * LOCAL_CHAPTER_SEGMENT_SIZE
    const segment = content.slice(start, start + LOCAL_CHAPTER_SEGMENT_SIZE)
    writeStorage(key, segment)
    keys.push(key)
    storedKeys.push(key)
  }

  return {
    title: chapter.title || `第 ${index + 1} 章`,
    index,
    content: '',
    contentKey: keys.length === 1 ? keys[0] : '',
    contentKeys: keys,
    wordCount: content.replace(/\s/g, '').length,
    preview: content.replace(/\s+/g, ' ').slice(0, 80),
    isCached: true
  }
}

export function parseTxtChapters(text) {
  const normalized = normalizeText(text)
  if (!normalized) return []

  const lines = normalized.split('\n')
  const chapterPattern = /^\s*(正文\s*)?(第\s*[零〇一二三四五六七八九十百千万\d]+\s*[章节回卷集部].*|卷\s*[零〇一二三四五六七八九十百千万\d]+.*|Chapter\s+\d+.*)\s*$/i
  const chapters = []
  let current = null

  lines.forEach(line => {
    const trimmed = line.trim()
    if (trimmed && chapterPattern.test(trimmed)) {
      if (current) chapters.push(current)
      current = {
        title: trimmed.slice(0, 60),
        content: ''
      }
      return
    }

    if (!current) {
      current = {
        title: '正文',
        content: ''
      }
    }
    current.content += `${line}\n`
  })

  if (current) chapters.push(current)

  const parsed = chapters
    .map((chapter, index) => ({
      title: chapter.title || `第 ${index + 1} 章`,
      content: normalizeText(chapter.content) || chapter.title
    }))
    .filter(chapter => chapter.content)

  if (parsed.length > 1 && parsed[0].title === '正文' && parsed[0].content.length < 80) {
    return parsed.slice(1)
  }

  return parsed
}

export function importBookFromText({ title, author, text }) {
  const normalized = normalizeText(text)
  if (!normalized || normalized.length < 20) {
    throw new Error('请选择完整的 TXT 小说文件')
  }

  const imported = readImportedBooks()
  const rawChapters = parseTxtChapters(normalized)
  const bookTitle = String(title || '').trim() || inferTitle(normalized)
  const bookId = createBookId()
  const storedKeys = []
  const chapters = rawChapters.map((chapter, index) => persistLocalChapter(bookId, chapter, index, storedKeys))
  const book = {
    id: bookId,
    source: 'local',
    title: bookTitle,
    author: String(author || '').trim() || '本地导入',
    category: '本地 TXT',
    coverColor: coverColors[imported.length % coverColors.length],
    accent: '#31584f',
    description: `本地导入 · ${chapters.length} 章 · 纯本地阅读`,
    chapters,
    importedAt: Date.now()
  }

  try {
    saveImportedBooks([book, ...imported])
    return book
  } catch (error) {
    storedKeys.forEach(key => removeStorage(key))
    throw new Error('本地存储空间不足，TXT 加入书架失败。请清理缓存后重试。')
  }
}

export function deleteImportedBook(bookId) {
  const imported = readImportedBooks()
  const book = imported.find(item => item.id === bookId)
  if (book) removeLocalChapterStorage(book)
  saveImportedBooks(imported.filter(item => item.id !== bookId))
}

export function loadLocalChapterContent(bookOrId, chapter) {
  if (chapter && chapter.content) return chapter.content

  const keys = chapter && Array.isArray(chapter.contentKeys) && chapter.contentKeys.length
    ? chapter.contentKeys
    : chapter && chapter.contentKey
      ? [chapter.contentKey]
      : []

  const content = keys.map(key => readStorage(key, '')).join('')
  if (content) return content

  const bookId = typeof bookOrId === 'object' ? bookOrId.id : bookOrId
  const index = chapter && chapter.index !== undefined ? Number(chapter.index) : -1
  if (bookId && index >= 0) {
    const fallback = readStorage(localChapterKey(bookId, index, 0), '')
    if (fallback) return fallback
  }

  throw new Error('本地章节正文不存在，请重新导入 TXT 文件')
}

export function deleteShelfBook(bookOrId) {
  const book = typeof bookOrId === 'object'
    ? bookOrId
    : getBooks().find(item => item.id === bookOrId)
  if (!book || !book.id) return false

  if (book.source === 'local') {
    deleteImportedBook(book.id)
    return true
  }

  if (book.source === 'online') {
    return deleteOnlineBookFromShelf(book.id)
  }

  if (book.source === 'builtin') {
    const hidden = new Set(readHiddenBuiltinBookIds())
    hidden.add(book.id)
    saveHiddenBuiltinBookIds(Array.from(hidden))
    return true
  }

  return false
}

export function getImportedBooks() {
  return readImportedBooks()
}

function shelfBookKey(book) {
  const title = normalizeText(book && book.title).toLowerCase()
  if (!title) return String(book && book.id || '')
  const author = normalizeText(book && book.author).toLowerCase()
  return `${title}::${author}`
}

export function mergeShelfBooks(...groups) {
  const seen = new Set()
  return groups.flat().filter(book => {
    if (!book) return false
    const key = shelfBookKey(book)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function getBooks() {
  const hiddenBuiltinIds = new Set(readHiddenBuiltinBookIds())
  const visibleBuiltIns = builtInBooks.filter(book => !hiddenBuiltinIds.has(book.id))
  return [...getOnlineShelfBooks(), ...readImportedBooks(), ...visibleBuiltIns]
}

export function getBook(bookId) {
  return getOnlineBook(bookId) || getBooks().find(book => book.id === bookId) || getBooks()[0]
}

export function searchBooks(keyword) {
  const word = String(keyword || '').trim().toLowerCase()
  if (!word) return []

  const results = []
  getBooks().forEach(book => {
    const bookHit = [book.title, book.author, book.category, book.description]
      .join(' ')
      .toLowerCase()
      .includes(word)

    if (bookHit) {
      results.push({
        type: 'book',
        bookId: book.id,
        title: book.title,
        subtitle: `${book.author} · ${book.category}`,
        snippet: book.description
      })
    }

    ;(book.chapters || []).forEach((chapter, chapterIndex) => {
      const haystack = `${chapter.title} ${chapter.content}`.toLowerCase()
      if (haystack.includes(word)) {
        const raw = chapter.content.replace(/\s+/g, ' ')
        const lowerRaw = raw.toLowerCase()
        const index = Math.max(0, lowerRaw.indexOf(word))
        const snippet = raw.slice(Math.max(0, index - 24), index + word.length + 48)
        results.push({
          type: 'chapter',
          bookId: book.id,
          chapterIndex,
          title: chapter.title,
          subtitle: book.title,
          snippet: snippet || raw.slice(0, 72)
        })
      }
    })
  })

  return results.slice(0, 80)
}
