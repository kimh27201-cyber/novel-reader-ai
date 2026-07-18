<template>
  <view class="tab-page-shell" :class="themeClass" :style="themeVars">
  <view class="decoder-page app-page tab-page-content" :class="[themeClass, pageMotionClass]" @tap="closeSwipeBook">
    <view class="top-zone">
      <view class="shelf-heading">
        <text class="shelf-eyebrow">解码阅读</text>
        <view class="shelf-filter-active">
          <text>书架</text>
          <text class="shelf-count" v-if="books.length">{{ books.length }} 本</text>
          <text class="shelf-layout-state" v-if="books.length">{{ shelfLayout === 'compact' ? '紧凑' : '列表' }}</text>
        </view>
      </view>
      <view class="top-actions">
        <button class="top-search-button" aria-label="搜索书籍" @tap="goSearch">⌕</button>
        <button class="top-more-button" aria-label="书架更多操作" @tap="toggleMoreMenu">⋮</button>
      </view>
    </view>

    <view class="more-menu" v-if="moreMenuVisible">
      <button class="menu-item" v-for="item in moreActions" :key="item.id" @tap="handleMoreAction(item.id)">
        <text class="menu-icon">{{ item.icon }}</text>
        <text>{{ item.label }}</text>
      </button>
    </view>
    <view class="more-menu-mask" v-if="moreMenuVisible" @tap="closeMoreMenu"></view>

    <scroll-view
      class="book-list"
      :class="shelfLayout"
      scroll-y
      :show-scrollbar="false"
      :refresher-enabled="true"
      :refresher-triggered="shelfRefreshing"
      :refresher-default-style="refresherStyle"
      @refresherrefresh="refreshShelfFromGesture"
      @scrolltolower="loadMoreBooks"
    >
      <view
        class="shelf-swipe-row"
        v-for="(book, index) in visibleBooks"
        :key="book.id"
        :class="{ open: swipeBookId === book.id && swipeOffset > 0 }"
        :style="{ '--shelf-enter-delay': `${Math.min(index, 10) * 60}ms` }"
        @tap.stop="handleBookTap(book)"
        @touchstart="onBookSwipeStart(book, $event)"
        @touchmove="onBookSwipeMove(book, $event)"
        @touchend="onBookSwipeEnd(book, $event)"
        @touchcancel="onBookSwipeEnd(book, $event)"
      >
        <button class="shelf-swipe-delete" @touchstart.stop @tap.stop="confirmSwipeDelete(book)">删除</button>
        <view
          class="book-row"
          :class="{ swiping: swipeBookId === book.id && swipeAxis === 'horizontal' }"
          :style="getBookSwipeStyle(book)"
          :aria-label="`打开《${book.title}》`"
          @longpress.stop="openBookActions(book)"
        >
        <view class="cover-wrap">
          <image class="cover-image" v-if="book.coverUrl" :src="book.coverUrl" mode="aspectFill" lazy-load />
          <view class="cover-fallback" v-else>
            <text class="cover-fallback-title">{{ shortTitle(book.title) }}</text>
            <text class="cover-fallback-kind">{{ book.source === 'online' ? '在线' : '本地' }}</text>
          </view>
          <view class="cover-spine"></view>
        </view>
        <view class="book-info">
          <view class="book-title">{{ book.title }}</view>
          <view class="reading-line">
            <text class="reading-label">读至</text>
            <text class="reading-chapter">{{ progressText(book) }}</text>
          </view>
          <view class="meta-line">
            <text>{{ book.author || '未知作者' }}</text>
            <text class="meta-separator">·</text>
            <text>{{ book.source === 'online' ? book.sourceName || '在线书源' : book.category || '本地书籍' }}</text>
          </view>
        </view>
        <view class="chapter-badge">
          <text class="chapter-count">{{ chapterCount(book) }}</text>
          <text class="chapter-unit">章</text>
        </view>
        </view>
      </view>

      <view class="empty-box" v-if="!books.length">
        <view class="empty-bookmark">书</view>
        <view class="empty-title">还没有可解码的书</view>
        <text class="empty-desc">先导入书源或 TXT，然后从“发现”搜索一本书加入书架。</text>
        <button class="empty-primary-action" @tap="goSearch">前往发现</button>
        <text class="empty-helper">已导入的 TXT 和在线书籍会出现在这里</text>
      </view>
    </scroll-view>

    <view class="book-action-mask app-motion-overlay" v-if="bookActionsVisible" @tap="closeBookActions"></view>
    <view class="book-action-sheet app-motion-sheet" v-if="bookActionsVisible && selectedBook">
      <view class="sheet-handle"></view>
      <button class="sheet-close" aria-label="关闭书籍操作" @tap="closeBookActions">×</button>
      <view class="sheet-book-summary">
        <view class="sheet-cover">
          <image class="sheet-cover-image" v-if="selectedBook.coverUrl" :src="selectedBook.coverUrl" mode="aspectFill" lazy-load />
          <view class="cover-fallback" v-else>
            <text class="cover-fallback-title">{{ shortTitle(selectedBook.title) }}</text>
            <text class="cover-fallback-kind">{{ selectedBook.source === 'online' ? '在线' : '本地' }}</text>
          </view>
        </view>
        <view class="sheet-book-info">
          <view class="sheet-title">{{ selectedBook.title }}</view>
          <text class="sheet-desc">{{ selectedBook.author || '未知作者' }} · {{ selectedBook.category || selectedBook.sourceName || '书架书籍' }}</text>
          <view class="sheet-meta">
            <text>读至：{{ progressText(selectedBook) }}</text>
            <text>共 {{ chapterCount(selectedBook) }} 章</text>
          </view>
        </view>
      </view>
      <view class="sheet-actions">
        <button class="sheet-action primary" @tap="runBookAction('read')">继续阅读</button>
        <button class="sheet-action" @tap="runBookAction('toc')">查看目录</button>
        <button class="sheet-action" @tap="runBookAction('info')">书籍信息</button>
        <button class="sheet-action" @tap="runBookAction('copy')">复制书名</button>
        <button class="sheet-action danger" @tap="runBookAction('delete')">移出书架</button>
      </view>
    </view>

    <view class="delete-confirm-mask app-motion-overlay" v-if="deleteConfirmVisible" @tap="closeDeleteConfirm"></view>
    <view class="delete-confirm-sheet app-motion-dialog" v-if="deleteConfirmVisible && pendingDeleteBook">
      <view class="sheet-handle"></view>
      <text class="delete-confirm-kicker">REMOVE FROM SHELF</text>
      <view class="delete-confirm-title">移出《{{ pendingDeleteBook.title }}》？</view>
      <text class="delete-confirm-copy">本地阅读进度会保留在设备中；之后重新加入时可以继续阅读。</text>
      <view class="delete-confirm-actions">
        <button class="delete-confirm-cancel" @tap="closeDeleteConfirm">保留书籍</button>
        <button class="delete-confirm-submit" @tap="confirmDeleteNow">移出书架</button>
      </view>
    </view>
  </view>
  <GlassTabBar active-path="pages/bookshelf/bookshelf" />
  </view>
</template>

<script>
import { deleteShelfBook, getBooks, mergeShelfBooks } from '../../common/books.js'
import { getProgress } from '../../common/reader.js'
import { getSourceConfigs } from '../../common/bookSources.js'
import { getAppThemeId, getAppThemeStyle } from '../../common/appTheme.js'
import apiClient from '../../common/apiClient.js'
import { listBackendBooks } from '../../common/backendLibrary.js'
import { friendlyErrorMessage } from '../../common/uiFeedback.js'
import { markTabFresh, shouldRefreshTab } from '../../common/tabFreshness.js'
import { getNavigationMotion } from '../../common/motion.js'
import { markTabRouteShown } from '../../common/tabNavigation.js'
import { ensureNativeTabBarHidden } from '../../common/tabShell.js'
import GlassTabBar from '../../custom-tab-bar/index.vue'

const SHELF_LAYOUT_KEY = 'bookshelf:layout'
const BOOK_BATCH_SIZE = 40
const SWIPE_DELETE_WIDTH = 152
const SWIPE_OPEN_THRESHOLD = Math.round(SWIPE_DELETE_WIDTH * 0.4)
const SHELF_REFRESH_MIN_MS = 300
const SHELF_REFRESH_TIMEOUT_MS = 10000

function waitFor(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)))
}

function withTimeout(promise, timeoutMs = SHELF_REFRESH_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('书架刷新超时，请检查后端连接')), timeoutMs)
    Promise.resolve(promise).then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      error => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

function booksMatch(current, next) {
  if (current.length !== next.length) return false
  return current.every((book, index) => {
    const candidate = next[index] || {}
    return book.id === candidate.id && book.updatedAt === candidate.updatedAt && book.title === candidate.title
  })
}

export default {
  components: { GlassTabBar },
  data() {
    return {
      books: [],
      visibleBookCount: BOOK_BATCH_SIZE,
      sources: [],
      moreMenuVisible: false,
      bookActionsVisible: false,
      selectedBook: null,
      deleteConfirmVisible: false,
      pendingDeleteBook: null,
      swipeBookId: '',
      swipeOffset: 0,
      swipeStartX: 0,
      swipeStartY: 0,
      swipeBaseOffset: 0,
      swipeAxis: '',
      ignoreBookTapUntil: 0,
      shelfRefreshing: false,
      booksRefreshing: false,
      booksRefreshPromise: null,
      themeId: getAppThemeId(),
      shelfLayout: 'list',
      pageMotionKind: '',
      pageMotionDirection: 'forward',
      moreActions: [
        { id: 'refresh', label: '更新书架', icon: '↻' },
        { id: 'sync', label: '同步云端', icon: '☁' },
        { id: 'stats', label: '书架统计', icon: 'ⓘ' },
        { id: 'sort', label: '最近优先', icon: '⇅' },
        { id: 'layout', label: '切换布局', icon: '▤' },
        { id: 'export', label: '导出书单', icon: '⇩' },
        { id: 'cache', label: '缓存状态', icon: '◷' }
      ]
    }
  },
  computed: {
    themeVars() {
      return getAppThemeStyle(this.themeId)
    },
    themeClass() {
      return `theme-${this.themeId}`
    },
    pageMotionClass() {
      return this.pageMotionKind === 'tab'
        ? `app-tab-enter app-tab-enter-${this.pageMotionDirection === 'back' ? 'back' : 'forward'}`
        : ''
    },
    visibleBooks() {
      return this.books.slice(0, this.visibleBookCount)
    },
    refresherStyle() {
      return ['candy', 'sakura'].includes(this.themeId) ? 'black' : 'white'
    }
  },
  onShow() {
    markTabRouteShown('pages/bookshelf/bookshelf')
    ensureNativeTabBarHidden()
    this.closeSwipeBook()
    this.themeId = getAppThemeId()
    const motion = getNavigationMotion()
    this.pageMotionKind = motion.kind
    this.pageMotionDirection = motion.direction
    this.shelfLayout = uni.getStorageSync(SHELF_LAYOUT_KEY) || 'list'
    this.sources = getSourceConfigs()
    if (shouldRefreshTab('bookshelf')) this.refreshBooks({ initial: !this.books.length })
  },
  onHide() {
    this.shelfRefreshing = false
  },
  onBackPress() {
    if (this.swipeBookId) {
      this.closeSwipeBook()
      return true
    }
    if (this.bookActionsVisible) {
      this.closeBookActions()
      return true
    }
    if (this.deleteConfirmVisible) {
      this.closeDeleteConfirm()
      return true
    }
    if (this.moreMenuVisible) {
      this.closeMoreMenu()
      return true
    }
    return false
  },
  methods: {
    async refreshBooks(options = {}) {
      if (this.booksRefreshPromise) return this.booksRefreshPromise
      this.booksRefreshing = true
      const refreshTask = (async () => {
        const localBooks = getBooks()
        let nextBooks = localBooks
        try {
          if (apiClient.getToken()) {
            const backendBooks = await withTimeout(listBackendBooks())
            nextBooks = mergeShelfBooks(backendBooks, localBooks)
          }
        } catch (error) {
          if (options.gesture || !this.books.length || options.initial) {
            uni.showToast({ title: friendlyErrorMessage(error, '云端书架加载失败'), icon: 'none' })
          }
        }
        if (!booksMatch(this.books, nextBooks)) {
          const shouldReset = options.initial || !this.books.length
          this.books = nextBooks
          if (shouldReset) this.resetVisibleBooks()
          else this.visibleBookCount = Math.min(nextBooks.length, Math.max(this.visibleBookCount, BOOK_BATCH_SIZE))
        }
        return nextBooks
      })()
      this.booksRefreshPromise = refreshTask
      try {
        return await refreshTask
      } finally {
        if (this.booksRefreshPromise === refreshTask) this.booksRefreshPromise = null
        this.booksRefreshing = false
        markTabFresh('bookshelf')
      }
    },
    async refreshShelfFromGesture() {
      if (this.shelfRefreshing) return
      const startedAt = Date.now()
      this.shelfRefreshing = true
      await new Promise(resolve => this.$nextTick(resolve))
      await waitFor(16)
      try {
        await this.refreshBooks({ gesture: true })
      } finally {
        const remaining = SHELF_REFRESH_MIN_MS - (Date.now() - startedAt)
        if (remaining > 0) await waitFor(remaining)
        this.shelfRefreshing = false
        await new Promise(resolve => this.$nextTick(resolve))
      }
    },
    resetVisibleBooks() {
      this.visibleBookCount = BOOK_BATCH_SIZE
    },
    loadMoreBooks() {
      if (this.visibleBookCount >= this.books.length) return
      this.visibleBookCount = Math.min(this.books.length, this.visibleBookCount + BOOK_BATCH_SIZE)
    },
    shortTitle(title) {
      return String(title || '').slice(0, 4)
    },
    getTouchPoint(event) {
      const source = event && (event.touches && event.touches[0] || event.changedTouches && event.changedTouches[0])
      return source || { clientX: 0, clientY: 0 }
    },
    getBookSwipeStyle(book) {
      const offset = this.swipeBookId === book.id ? this.swipeOffset : 0
      return { transform: `translate3d(-${offset}rpx, 0, 0)` }
    },
    onBookSwipeStart(book, event) {
      const touch = this.getTouchPoint(event)
      if (this.bookActionsVisible) return
      if (this.swipeBookId && this.swipeBookId !== book.id) this.closeSwipeBook()
      if (this.swipeBookId === book.id && this.swipeOffset > 0) {
        this.closeSwipeBook()
        this.ignoreBookTapUntil = Date.now() + 360
      }
      this.swipeBookId = book.id
      this.swipeStartX = Number(touch.clientX) || 0
      this.swipeStartY = Number(touch.clientY) || 0
      this.swipeBaseOffset = this.swipeOffset
      this.swipeAxis = ''
    },
    onBookSwipeMove(book, event) {
      if (this.swipeBookId !== book.id) return
      const touch = this.getTouchPoint(event)
      const deltaX = (Number(touch.clientX) || 0) - this.swipeStartX
      const deltaY = (Number(touch.clientY) || 0) - this.swipeStartY
      if (!this.swipeAxis && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 8) {
        this.swipeAxis = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical'
      }
      if (this.swipeAxis !== 'horizontal') return
      if (event && typeof event.preventDefault === 'function') event.preventDefault()
      this.swipeOffset = Math.max(0, Math.min(SWIPE_DELETE_WIDTH, this.swipeBaseOffset - deltaX * 2))
    },
    onBookSwipeEnd(book, event) {
      if (this.swipeBookId !== book.id) return
      const touch = this.getTouchPoint(event)
      const moved = Math.abs((Number(touch.clientX) || 0) - this.swipeStartX)
      const isHorizontal = this.swipeAxis === 'horizontal'
      if (isHorizontal) {
        this.swipeOffset = this.swipeOffset >= SWIPE_OPEN_THRESHOLD ? SWIPE_DELETE_WIDTH : 0
        this.ignoreBookTapUntil = Date.now() + 360
      }
      if (!this.swipeOffset) this.swipeBookId = ''
      this.swipeAxis = ''
      if (!isHorizontal && moved < 8 && this.swipeBookId === book.id && !this.swipeOffset) this.swipeBookId = ''
    },
    closeSwipeBook() {
      this.swipeBookId = ''
      this.swipeOffset = 0
      this.swipeAxis = ''
    },
    handleBookTap(book) {
      if (Date.now() < this.ignoreBookTapUntil) return
      if (this.swipeBookId && this.swipeOffset) {
        this.closeSwipeBook()
        return
      }
      this.openBook(book)
    },
    confirmSwipeDelete(book) {
      this.closeSwipeBook()
      this.confirmDeleteSelectedBook(book)
    },
    chapterCount(book) {
      const count = (book.chapters || []).length
      return count ? String(count) : String(book.chapterCount || '...')
    },
    progressText(book) {
      const chapters = book.chapters || []
      const progress = getProgress(book.id)
      const chapter = chapters[progress.chapterIndex] || chapters[0]
      if (chapter) return chapter.title || `第 ${progress.chapterIndex + 1} 章`
      if (book.firstChapterTitle) return book.firstChapterTitle
      return book.latestChapter || '等待目录解码'
    },
    openBook(book) {
      if (this.bookActionsVisible || Date.now() < this.ignoreBookTapUntil) return
      uni.navigateTo({
        url: `/pages/reader/reader?bookId=${book.id}`
      })
    },
    openBookActions(book) {
      this.moreMenuVisible = false
      this.selectedBook = book
      this.bookActionsVisible = true
    },
    closeBookActions() {
      this.bookActionsVisible = false
      this.selectedBook = null
    },
    closeDeleteConfirm() {
      this.deleteConfirmVisible = false
      this.pendingDeleteBook = null
    },
    runBookAction(action) {
      const book = this.selectedBook
      if (!book) return
      if (action === 'read') {
        this.closeBookActions()
        this.openBook(book)
        return
      }
      if (action === 'toc') {
        this.showBookToc(book)
        return
      }
      if (action === 'info') {
        this.showBookInfo(book)
        return
      }
      if (action === 'copy') {
        this.copyBookTitle(book)
        return
      }
      if (action === 'delete') {
        this.confirmDeleteSelectedBook(book)
      }
    },
    showBookToc(book) {
      const chapters = (book.chapters || []).slice(0, 12)
      uni.showModal({
        title: '查看目录',
        content: chapters.length ? chapters.map((chapter, index) => `${index + 1}. ${chapter.title}`).join('\n') : '当前书籍还没有目录。',
        showCancel: false,
        confirmText: '知道了'
      })
    },
    showBookInfo(book) {
      uni.showModal({
        title: '书籍信息',
        content: `书名：${book.title}\n作者：${book.author || '未知作者'}\n来源：${book.sourceName || book.category || book.source || '书架'}\n章节：${chapterCount(book)}\n进度：${progressText(book)}`,
        showCancel: false,
        confirmText: '知道了'
      })
    },
    copyBookTitle(book) {
      uni.setClipboardData({
        data: book.title || '',
        success: () => uni.showToast({ title: '书名已复制', icon: 'none' })
      })
    },
    toggleMoreMenu() {
      this.moreMenuVisible = !this.moreMenuVisible
    },
    closeMoreMenu() {
      this.moreMenuVisible = false
    },
    async handleMoreAction(id) {
      this.moreMenuVisible = false
      if (id === 'refresh') {
        await this.refreshBooks()
        uni.showToast({ title: '书架已更新', icon: 'none' })
        return
      }
      if (id === 'sync') {
        if (!apiClient.getToken()) {
          uni.showToast({ title: '登录后可同步云端书架', icon: 'none' })
          return
        }
        await this.refreshBooks()
        uni.showToast({ title: '云端书架已同步', icon: 'none' })
        return
      }
      if (id === 'stats') {
        this.showShelfStats()
        return
      }
      if (id === 'sort') {
        this.sortBooksByRecent()
        return
      }
      if (id === 'layout') {
        this.toggleShelfLayout()
        return
      }
      if (id === 'export') {
        this.exportShelfList()
        return
      }
      if (id === 'cache') {
        this.showCacheState()
      }
    },
    showShelfStats() {
      const onlineCount = this.books.filter(book => book.source === 'online').length
      const localCount = this.books.filter(book => book.source === 'local').length
      const backendCount = this.books.filter(book => book.source === 'backend').length
      uni.showToast({
        title: `共 ${this.books.length} 本：在线 ${onlineCount} / TXT ${localCount} / 云端 ${backendCount}`,
        icon: 'none'
      })
    },
    sortBooksByRecent() {
      this.books = [...this.books].sort((left, right) => {
        const leftTime = left.updatedAt || left.addedAt || left.importedAt || 0
        const rightTime = right.updatedAt || right.addedAt || right.importedAt || 0
        return rightTime - leftTime
      })
      uni.showToast({ title: '已按最近加入排序', icon: 'none' })
    },
    toggleShelfLayout() {
      this.shelfLayout = this.shelfLayout === 'compact' ? 'list' : 'compact'
      uni.setStorageSync(SHELF_LAYOUT_KEY, this.shelfLayout)
      uni.showToast({ title: this.shelfLayout === 'compact' ? '紧凑布局' : '列表布局', icon: 'none' })
    },
    exportShelfList() {
      if (!this.books.length) {
        uni.showToast({ title: '书架为空', icon: 'none' })
        return
      }
      const data = this.books
        .map((book, index) => `${index + 1}. ${book.title} - ${book.author || '未知作者'} [${book.sourceName || book.category || book.source}]`)
        .join('\n')
      uni.setClipboardData({
        data,
        success: () => uni.showToast({ title: '书单已复制', icon: 'none' })
      })
    },
    showCacheState() {
      const cachedChapters = this.books.reduce((total, book) => {
        return total + (book.chapters || []).filter(chapter => chapter.content || chapter.isCached).length
      }, 0)
      uni.showToast({ title: `已缓存 ${cachedChapters} 个章节`, icon: 'none' })
    },
    confirmDeleteSelectedBook(book = this.selectedBook) {
      if (!book) return
      this.bookActionsVisible = false
      this.pendingDeleteBook = book
      this.deleteConfirmVisible = true
    },
    confirmDeleteNow() {
      const book = this.pendingDeleteBook
      this.closeDeleteConfirm()
      if (book) this.deleteSelectedBook(book)
    },
    deleteSelectedBook(book = this.selectedBook) {
      const removed = deleteShelfBook(book)
      if (!removed) {
        const message = book && book.source === 'backend'
          ? '云端书籍需在云端书架中删除'
          : book && book.source === 'online'
            ? '在线书籍未找到，无法按现有规则删除'
            : '当前书籍类型不支持本机删除'
        uni.showToast({ title: message, icon: 'none' })
        return
      }
      this.books = this.books.filter(item => item.id !== book.id)
      this.closeBookActions()
      this.closeDeleteConfirm()
      uni.showToast({ title: '已从书架移出', icon: 'none' })
    },
    goSearch() {
      uni.switchTab({ url: '/pages/search/search' })
    }
  }
}
</script>

<style>
.decoder-page {
  --tabbar-reserved-height: 140rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 1120px;
  height: 100vh;
  overflow-x: hidden;
  padding: 86rpx 40rpx 0;
  padding-bottom: calc(var(--tabbar-reserved-height) + env(safe-area-inset-bottom));
  margin: 0 auto;
  color: var(--app-text);
  background: var(--app-bg);
}

button::after {
  border: 0;
}

.top-zone {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 116rpx;
  margin: -86rpx -40rpx 34rpx;
  padding: 86rpx 38rpx 0;
  background: var(--app-top);
}

.shelf-filter-active {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 88rpx;
  height: 86rpx;
  color: rgba(255, 255, 255, 0.84);
  font-size: 27rpx;
  font-weight: 800;
}

.shelf-filter-active::after {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 74rpx;
  height: 5rpx;
  border-radius: 999rpx;
  background: var(--app-accent-3);
  content: "";
}

.top-search-button,
.top-more-button {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 78rpx;
  height: 86rpx;
  padding: 0;
  color: rgba(255, 255, 255, 0.90);
  font-size: 54rpx;
  line-height: 1;
  background: transparent;
}

.top-search-button {
  margin-left: auto;
}

.top-more-button {
  margin-left: 12rpx;
  font-size: 58rpx;
}

.more-menu {
  position: absolute;
  z-index: 10;
  right: 0;
  top: 116rpx;
  width: 430rpx;
  overflow: hidden;
  border: 1rpx solid var(--app-border);
  border-radius: 18rpx;
  background: var(--app-panel-strong);
  box-shadow: var(--app-floating-shadow);
}

.more-menu-mask {
  position: fixed;
  z-index: 9;
  inset: 0;
  background: transparent;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  height: 96rpx;
  padding: 0 30rpx;
  border-bottom: 0;
  color: #f2f5f4;
  font-family: "KaiTi", "STKaiti", "FZKai-Z03", "PingFang SC", cursive;
  font-size: 29rpx;
  text-align: left;
  background: transparent;
}

.menu-item:active {
  background: rgba(226, 95, 53, 0.16);
}

.menu-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 58rpx;
  margin-right: 22rpx;
  color: rgba(255, 255, 255, 0.88);
  font-family: initial;
  font-size: 42rpx;
}

.book-list {
  flex: 1;
  min-height: 0;
  margin-top: 28rpx;
}

.book-row {
  position: relative;
  display: flex;
  align-items: flex-start;
  min-height: 236rpx;
  margin-bottom: 28rpx;
}

.book-row:active {
  transform: scale(0.992);
  opacity: 0.86;
}

.cover-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 166rpx;
  height: 226rpx;
  overflow: hidden;
  border-radius: 10rpx;
  color: #f7f7f7;
  font-size: 32rpx;
  font-weight: 900;
  text-align: center;
  background: linear-gradient(145deg, #48545c, #24282d);
}

.cover-image {
  width: 100%;
  height: 100%;
}

.book-info {
  min-width: 0;
  flex: 1;
  max-width: calc(100% - 238rpx);
  padding-top: 4rpx;
  margin-left: 34rpx;
  padding-right: 126rpx;
  box-sizing: border-box;
}

.book-title {
  overflow: hidden;
  color: #f2f2f2;
  font-family: cursive;
  font-size: 42rpx;
  line-height: 56rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-line {
  display: flex;
  align-items: center;
  min-width: 0;
  margin-top: 12rpx;
  color: #bebebe;
  font-family: cursive;
  font-size: 29rpx;
  line-height: 38rpx;
}

.meta-line text:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-icon {
  flex-shrink: 0;
  width: 42rpx;
  margin-right: 12rpx;
  color: #a8a8a8;
  font-family: initial;
}

.chapter-badge {
  position: absolute;
  right: 28rpx;
  top: 34rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72rpx;
  max-width: 116rpx;
  height: 48rpx;
  padding: 0 18rpx;
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 999rpx;
  color: #f4f4f4;
  font-family: cursive;
  font-size: 28rpx;
  line-height: 1;
  text-align: center;
  background: rgba(255, 255, 255, 0.12);
}

.empty-box {
  padding: 58rpx 28rpx;
  border-radius: 22rpx;
  text-align: center;
  background: #2b2b2b;
}

.empty-title {
  color: #ffffff;
  font-family: cursive;
  font-size: 36rpx;
}

.empty-desc {
  display: block;
  margin-top: 16rpx;
  color: #a8a8a8;
  font-size: 26rpx;
  line-height: 38rpx;
}

.book-action-mask {
  position: fixed;
  z-index: 20;
  left: 0;
  right: 0;
  top: 0;
  bottom: calc(var(--tabbar-reserved-height) + env(safe-area-inset-bottom));
  background: rgba(0, 0, 0, 0.42);
}

.book-action-sheet {
  position: fixed;
  z-index: 21;
  left: 0;
  right: 0;
  bottom: calc(var(--tabbar-reserved-height) + env(safe-area-inset-bottom));
  box-sizing: border-box;
  max-width: 1120px;
  max-height: calc(100vh - var(--tabbar-reserved-height) - env(safe-area-inset-bottom) - 48rpx);
  margin: 0 auto;
  padding: 32rpx 36rpx 36rpx;
  overflow-y: auto;
  border-radius: 34rpx 34rpx 0 0;
  text-align: center;
  background: rgba(33, 34, 33, 0.98);
  box-shadow: 0 -28rpx 72rpx rgba(0, 0, 0, 0.38);
}

.sheet-cover {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 178rpx;
  height: 236rpx;
  margin: 0 auto;
  overflow: hidden;
  border-radius: 14rpx;
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 900;
  background: linear-gradient(145deg, var(--app-accent) 0%, var(--app-accent-3) 100%);
}

.sheet-cover-image {
  width: 100%;
  height: 100%;
}

.sheet-title {
  overflow: hidden;
  margin-top: 22rpx;
  color: #ffffff;
  font-family: "KaiTi", "STKaiti", "FZKai-Z03", "PingFang SC", cursive;
  font-size: 38rpx;
  font-weight: 900;
  line-height: 48rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-desc,
.sheet-meta {
  margin-top: 10rpx;
  color: #b8b8b8;
  font-size: 25rpx;
  line-height: 36rpx;
}

.sheet-meta {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  margin-top: 16rpx;
}

.sheet-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14rpx;
  margin-top: 28rpx;
}

.sheet-action {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 78rpx;
  padding: 0 18rpx;
  border-radius: 12rpx;
  color: #f2f2f2;
  font-size: 26rpx;
  line-height: 1;
  background: rgba(255, 255, 255, 0.08);
}

.sheet-action.primary {
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.sheet-action.danger {
  color: #ffffff;
  background: rgba(226, 95, 53, 0.82);
}

.sheet-action:active {
  transform: scale(0.98);
  opacity: 0.86;
}

/* Bookshelf hierarchy: the spine is the page signature; all other surfaces stay quiet. */
.decoder-page {
  --shelf-ui-font: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
  color: var(--app-text);
  background: var(--app-bg);
}

.top-zone {
  min-height: 132rpx;
  margin-bottom: 20rpx;
  padding-right: 32rpx;
  padding-left: 32rpx;
  background: var(--app-top);
  box-shadow: 0 1rpx 0 var(--app-border);
}

.shelf-heading {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-self: stretch;
}

.shelf-eyebrow {
  color: var(--app-muted);
  font-family: var(--shelf-ui-font);
  font-size: 20rpx;
  font-weight: 600;
  letter-spacing: 3rpx;
  line-height: 28rpx;
}

.shelf-filter-active {
  justify-content: flex-start;
  width: auto;
  min-width: 0;
  height: 56rpx;
  color: var(--app-text);
  font-family: var(--shelf-ui-font);
  font-size: 40rpx;
  font-weight: 750;
  letter-spacing: 1rpx;
}

.shelf-filter-active::after {
  left: 2rpx;
  bottom: -4rpx;
  width: 44rpx;
  height: 4rpx;
  background: var(--app-accent-3);
}

.shelf-count {
  margin-left: 16rpx;
  color: var(--app-muted);
  font-size: 22rpx;
  font-weight: 500;
  letter-spacing: 0;
}

.shelf-layout-state {
  margin-left: 10rpx;
  padding: 4rpx 10rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 999rpx;
  color: var(--app-muted);
  font-size: 18rpx;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 24rpx;
  background: var(--app-input);
}

.top-actions {
  display: flex;
  align-items: center;
  align-self: flex-end;
  height: 86rpx;
}

.top-search-button,
.top-more-button {
  width: 76rpx;
  height: 76rpx;
  border-radius: 16rpx;
  color: var(--app-text);
  font-size: 52rpx;
  font-family: var(--shelf-ui-font);
}

.top-search-button {
  margin-left: 0;
}

.top-more-button {
  margin-left: 8rpx;
  font-size: 56rpx;
}

.top-search-button:active,
.top-more-button:active,
.book-row:active,
.sheet-action:active {
  opacity: 0.82;
  transform: scale(0.98);
}

.top-search-button:focus-visible,
.top-more-button:focus-visible,
.menu-item:focus-visible,
.sheet-action:focus-visible {
  outline: 3rpx solid var(--app-accent);
  outline-offset: -3rpx;
}

.more-menu {
  right: 24rpx;
  top: 142rpx;
  width: 392rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 18rpx;
  background: var(--app-panel-strong);
  box-shadow: var(--app-floating-shadow);
}

.menu-item {
  height: 88rpx;
  padding: 0 26rpx;
  color: var(--app-text);
  font-family: var(--shelf-ui-font);
  font-size: 27rpx;
}

.menu-item:active {
  background: var(--app-input);
}

.menu-icon {
  width: 48rpx;
  margin-right: 16rpx;
  color: var(--app-accent);
  font-size: 34rpx;
}

.book-list {
  flex: 1;
  min-height: 0;
  margin-top: 0;
}

.shelf-swipe-row {
  position: relative;
  isolation: isolate;
  margin-bottom: 20rpx;
  overflow: hidden;
  border-radius: 18rpx;
}

.shelf-swipe-delete {
  position: absolute;
  z-index: -1;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 152rpx;
  min-height: 100%;
  padding: 0;
  color: var(--app-on-accent);
  font-family: var(--shelf-ui-font);
  font-size: 25rpx;
  font-weight: 720;
  background: #DC2626;
  opacity: 0;
  pointer-events: none;
  transform: translate3d(100%, 0, 0);
  transition: opacity 140ms ease, transform 180ms ease;
}

.shelf-swipe-row.open .shelf-swipe-delete {
  opacity: 1;
  pointer-events: auto;
  transform: translate3d(0, 0, 0);
}

.shelf-swipe-delete::after {
  border: 0;
}

.book-row {
  z-index: 2;
  width: 100%;
  min-height: 242rpx;
  margin-bottom: 0;
  padding: 18rpx 110rpx 18rpx 18rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 18rpx;
  background: var(--app-panel);
  box-shadow: var(--app-shadow);
  transition: transform 180ms ease-out, opacity 180ms ease-out, border-color 180ms ease-out;
}

.book-row.swiping {
  transition: none;
}

.cover-wrap {
  position: relative;
  width: 144rpx;
  height: 206rpx;
  border-radius: 10rpx;
  color: var(--app-on-accent);
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 28rpx;
  background: linear-gradient(145deg, var(--app-accent) 0%, var(--app-accent-3) 100%);
}

.cover-image {
  position: relative;
  z-index: 1;
}

.cover-fallback {
  position: absolute;
  z-index: 1;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16rpx 12rpx;
  background:
    linear-gradient(90deg, transparent 0 18%, var(--app-border) 18% 19%, transparent 19% 100%),
    linear-gradient(145deg, var(--app-accent) 0%, var(--app-accent-3) 100%);
}

.cover-fallback-title {
  display: -webkit-box;
  overflow: hidden;
  color: var(--app-on-accent);
  font-size: 27rpx;
  font-weight: 800;
  line-height: 36rpx;
  text-align: center;
  word-break: break-all;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.cover-fallback-kind {
  margin-top: 12rpx;
  padding: 2rpx 9rpx;
  border: 1rpx solid currentColor;
  border-radius: 999rpx;
  color: var(--app-on-accent);
  font-size: 16rpx;
  font-weight: 650;
  line-height: 22rpx;
}

.cover-spine {
  position: absolute;
  z-index: 2;
  left: 0;
  top: 16rpx;
  bottom: 16rpx;
  width: 5rpx;
  border-radius: 0 999rpx 999rpx 0;
  background: var(--app-accent-3);
  box-shadow: 0 0 12rpx var(--app-border);
}

.book-info {
  max-width: none;
  padding-top: 8rpx;
  padding-right: 0;
  margin-left: 24rpx;
}

.book-title,
.empty-title,
.sheet-title {
  color: var(--app-text);
  font-family: var(--shelf-ui-font);
}

.book-title {
  display: -webkit-box;
  max-height: 96rpx;
  font-size: 36rpx;
  font-weight: 720;
  line-height: 48rpx;
  text-overflow: initial;
  white-space: normal;
  word-break: break-word;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.reading-line {
  display: flex;
  align-items: baseline;
  min-width: 0;
  margin-top: 16rpx;
  color: var(--app-text);
  font-family: var(--shelf-ui-font);
  font-size: 27rpx;
  line-height: 38rpx;
}

.reading-label {
  flex-shrink: 0;
  margin-right: 12rpx;
  color: var(--app-accent-3);
  font-size: 22rpx;
  font-weight: 650;
}

.reading-chapter {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-line {
  gap: 12rpx;
  margin-top: 16rpx;
  color: var(--app-muted);
  font-family: var(--shelf-ui-font);
  font-size: 23rpx;
  line-height: 32rpx;
}

.meta-line text:not(.meta-separator) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-separator {
  flex-shrink: 0;
  color: var(--app-accent);
}

.chapter-badge {
  right: 24rpx;
  top: auto;
  bottom: 30rpx;
  min-width: 0;
  max-width: 72rpx;
  height: auto;
  padding: 0;
  border-radius: 8rpx;
  color: var(--app-muted);
  font-family: var(--shelf-ui-font);
  font-size: 20rpx;
  line-height: 28rpx;
  background: transparent;
}

.chapter-count {
  display: block;
  color: var(--app-accent);
  font-size: 34rpx;
  font-weight: 700;
  line-height: 36rpx;
}

.chapter-unit {
  display: block;
  margin-top: 3rpx;
  letter-spacing: 2rpx;
}

.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 390rpx;
  padding: 54rpx 44rpx;
  border: 1rpx dashed var(--app-border);
  border-radius: 18rpx;
  background: var(--app-panel);
  box-shadow: none;
}

.empty-bookmark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76rpx;
  height: 94rpx;
  margin-bottom: 28rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 6rpx 6rpx 18rpx 6rpx;
  color: var(--app-accent-3);
  font-family: "KaiTi", "STKaiti", serif;
  font-size: 34rpx;
  box-shadow: inset 0 0 0 8rpx var(--app-input);
}

.empty-title {
  font-size: 34rpx;
  font-weight: 700;
}

.empty-desc {
  max-width: 520rpx;
  margin-top: 18rpx;
  color: var(--app-muted);
  font-family: var(--shelf-ui-font);
  font-size: 25rpx;
  line-height: 40rpx;
}

.empty-primary-action {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 230rpx;
  height: 76rpx;
  margin-top: 28rpx;
  padding: 0 28rpx;
  border-radius: 13rpx;
  color: var(--app-on-accent);
  font-family: var(--shelf-ui-font);
  font-size: 25rpx;
  font-weight: 700;
  background: var(--app-accent);
}

.empty-helper {
  margin-top: 16rpx;
  color: var(--app-muted);
  font-family: var(--shelf-ui-font);
  font-size: 20rpx;
  line-height: 30rpx;
}

.book-action-sheet {
  position: fixed;
  padding: 20rpx 32rpx 34rpx;
  border: 1rpx solid var(--app-border);
  border-bottom: 0;
  border-radius: 28rpx 28rpx 0 0;
  text-align: left;
  background: var(--app-panel-strong);
  box-shadow: var(--app-floating-shadow);
}

.sheet-close {
  position: absolute;
  right: 24rpx;
  top: 18rpx;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  padding: 0;
  border: 1rpx solid var(--app-border);
  border-radius: 13rpx;
  color: var(--app-muted);
  font-family: var(--shelf-ui-font);
  font-size: 38rpx;
  line-height: 1;
  background: var(--app-input);
}

.sheet-handle {
  width: 54rpx;
  height: 6rpx;
  margin: 0 auto 24rpx;
  border-radius: 999rpx;
  background: var(--app-border);
}

.sheet-book-summary {
  display: flex;
  align-items: center;
  min-width: 0;
}

.sheet-cover {
  position: relative;
  flex-shrink: 0;
  width: 104rpx;
  height: 148rpx;
  margin: 0;
  border-radius: 9rpx;
  font-size: 23rpx;
}

.sheet-book-info {
  min-width: 0;
  flex: 1;
  margin-left: 22rpx;
}

.sheet-title {
  display: -webkit-box;
  max-height: 92rpx;
  margin-top: 0;
  padding-right: 54rpx;
  overflow: hidden;
  font-size: 34rpx;
  font-weight: 720;
  line-height: 46rpx;
  text-overflow: initial;
  white-space: normal;
  word-break: break-word;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.sheet-desc,
.sheet-meta {
  color: var(--app-muted);
  font-family: var(--shelf-ui-font);
  font-size: 23rpx;
  line-height: 34rpx;
}

.sheet-desc {
  display: block;
  margin-top: 8rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-meta {
  gap: 2rpx;
  margin-top: 10rpx;
}

.sheet-actions {
  margin-top: 28rpx;
  gap: 12rpx;
}

.sheet-action {
  height: 80rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 12rpx;
  color: var(--app-text);
  font-family: var(--shelf-ui-font);
  font-size: 25rpx;
  background: var(--app-input);
  transition: transform 180ms ease-out, opacity 180ms ease-out;
}

.sheet-action.primary {
  grid-column: 1 / -1;
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.sheet-action.danger {
  border-color: transparent;
  color: #ffffff;
  background: #DC2626;
}

.book-list.compact .shelf-swipe-row {
  margin-bottom: 14rpx;
  border-radius: 14rpx;
}

.book-list.compact .book-row {
  min-height: 178rpx;
  margin-bottom: 0;
  padding: 14rpx 82rpx 14rpx 14rpx;
  border-radius: 14rpx;
}

.book-list.compact .cover-wrap {
  width: 104rpx;
  height: 150rpx;
  border-radius: 8rpx;
}

.book-list.compact .cover-spine {
  top: 12rpx;
  bottom: 12rpx;
  width: 4rpx;
}

.book-list.compact .cover-fallback-title {
  font-size: 22rpx;
  line-height: 30rpx;
}

.book-list.compact .cover-fallback-kind {
  display: none;
}

.book-list.compact .book-info {
  padding-top: 2rpx;
  margin-left: 18rpx;
}

.book-list.compact .book-title {
  display: block;
  max-height: 42rpx;
  overflow: hidden;
  font-size: 30rpx;
  line-height: 42rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-list.compact .reading-line {
  margin-top: 10rpx;
  font-size: 23rpx;
  line-height: 32rpx;
}

.book-list.compact .reading-label {
  margin-right: 8rpx;
  font-size: 19rpx;
}

.book-list.compact .meta-line {
  margin-top: 8rpx;
  font-size: 20rpx;
  line-height: 28rpx;
}

.book-list.compact .chapter-badge {
  right: 18rpx;
  bottom: 22rpx;
}

.book-list.compact .chapter-count {
  font-size: 28rpx;
  line-height: 30rpx;
}

.book-list.compact .chapter-unit {
  font-size: 17rpx;
}

@media (max-width: 380px) {
  .decoder-page {
    padding-right: 28rpx;
    padding-left: 28rpx;
  }

  .top-zone {
    margin-right: -28rpx;
    margin-left: -28rpx;
  }

  .book-row {
    padding-right: 88rpx;
  }

  .cover-wrap {
    width: 128rpx;
    height: 188rpx;
  }

  .book-info {
    margin-left: 18rpx;
  }
}

@media (prefers-reduced-motion: reduce) {
  .book-row,
  .sheet-action {
    transition: none;
  }
}

/* V2 shelf pass: movement and destructive actions are explicit, not modal. */
.shelf-swipe-row {
  animation: shelf-row-enter 420ms var(--app-motion-smooth) both;
  animation-delay: var(--shelf-enter-delay, 0ms);
  will-change: transform, opacity;
}

.book-row {
  border-width: var(--app-card-border-width, 1rpx);
  border-radius: var(--app-card-radius, 16rpx);
  box-shadow: var(--app-card-outline), var(--app-shadow);
}

.book-row:active {
  border-color: var(--app-accent);
}

.shelf-swipe-delete {
  width: 152rpx;
  background: #b93832;
}

.delete-confirm-mask {
  position: fixed;
  z-index: var(--app-z-overlay, 300);
  inset: 0;
  background: rgba(4, 6, 10, 0.58);
}

.delete-confirm-sheet {
  position: fixed;
  z-index: var(--app-z-modal, 400);
  top: 50%;
  right: 28rpx;
  left: 28rpx;
  padding: 30rpx 32rpx 34rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 30rpx;
  color: var(--app-text);
  background: var(--app-panel-strong);
  box-shadow: var(--app-floating-shadow);
  animation: delete-dialog-enter var(--app-motion-duration-normal) var(--app-motion-smooth) both;
}

.delete-confirm-kicker {
  display: block;
  color: var(--app-accent-3);
  font-family: var(--app-utility-font);
  font-size: 19rpx;
  font-weight: 700;
  letter-spacing: 1.8rpx;
}

.delete-confirm-title {
  margin-top: 14rpx;
  font-family: var(--app-display-font);
  font-size: 38rpx;
  font-weight: 720;
  line-height: 52rpx;
}

.delete-confirm-copy {
  display: block;
  margin-top: 14rpx;
  color: var(--app-muted);
  font-size: 24rpx;
  line-height: 38rpx;
}

.delete-confirm-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 30rpx;
}

.delete-confirm-actions button {
  flex: 1;
  min-height: var(--app-touch-target-min, 88rpx);
  font-size: 26rpx;
  font-weight: 700;
}

.delete-confirm-cancel {
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-control-radius, 12rpx);
  color: var(--app-text);
  background: var(--app-input);
}

.delete-confirm-submit {
  border-radius: var(--app-control-radius, 12rpx);
  color: #fff;
  background: #b93832;
}

.theme-candy.decoder-page .delete-confirm-sheet,
.theme-candy.decoder-page .delete-confirm-cancel,
.theme-candy.decoder-page .delete-confirm-submit {
  border: 2rpx solid rgba(52, 42, 50, 0.78);
}

.theme-cyber.decoder-page .delete-confirm-sheet,
.theme-cyber.decoder-page .delete-confirm-cancel,
.theme-cyber.decoder-page .delete-confirm-submit {
  border-radius: var(--app-control-radius, 10rpx);
}

.theme-noirGold.decoder-page .delete-confirm-sheet {
  box-shadow: inset 0 0 0 8rpx rgba(213, 175, 98, 0.025), var(--app-floating-shadow);
}

.book-action-mask,
.delete-confirm-mask {
  animation: shelf-overlay-in 200ms ease both;
}

.book-action-sheet {
  animation: shelf-sheet-enter var(--app-motion-duration-normal) var(--app-motion-spring) both;
}

@keyframes shelf-row-enter {
  from { opacity: 0; transform: translate3d(0, 22rpx, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes delete-dialog-enter {
  from { opacity: 0; transform: translate3d(0, calc(-50% + 12rpx), 0) scale(0.96); }
  to { opacity: 1; transform: translate3d(0, -50%, 0) scale(1); }
}

@keyframes shelf-overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes shelf-sheet-enter {
  from { opacity: 0; transform: translate3d(0, 100%, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}
</style>
