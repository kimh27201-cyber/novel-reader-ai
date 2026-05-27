<template>
  <view class="decoder-page app-page" :style="themeVars">
    <view class="top-zone">
      <view class="shelf-filter-active">
        <text>全部</text>
      </view>
      <button class="top-search-button" @tap="goSearch">⌕</button>
      <button class="top-more-button" @tap="toggleMoreMenu">⋮</button>
    </view>

    <view class="more-menu" v-if="moreMenuVisible">
      <button class="menu-item" v-for="item in moreActions" :key="item.id" @tap="handleMoreAction(item.id)">
        <text class="menu-icon">{{ item.icon }}</text>
        <text>{{ item.label }}</text>
      </button>
    </view>

    <scroll-view class="book-list" :class="shelfLayout" scroll-y :show-scrollbar="false">
      <view class="book-row" v-for="book in books" :key="book.id" @tap="openBook(book)" @longpress="confirmDeleteBook(book)">
        <view class="cover-wrap">
          <image class="cover-image" v-if="book.coverUrl" :src="book.coverUrl" mode="aspectFill" />
          <text v-else>{{ shortTitle(book.title) }}</text>
        </view>
        <view class="book-info">
          <view class="book-title">{{ book.title }}</view>
          <view class="meta-line">
            <text class="meta-icon">☻</text>
            <text>{{ book.author || '未知作者' }}</text>
          </view>
          <view class="meta-line">
            <text class="meta-icon">◷</text>
            <text>{{ progressText(book) }}</text>
          </view>
          <view class="meta-line">
            <text class="meta-icon">◉</text>
            <text>{{ book.source === 'online' ? book.sourceName || '在线书源' : book.category || '本地书籍' }}</text>
          </view>
        </view>
        <text class="chapter-badge">{{ chapterCount(book) }}</text>
      </view>

      <view class="empty-box" v-if="!books.length">
        <view class="empty-title">还没有可解码的书</view>
        <text class="empty-desc">先导入书源或 TXT，然后从“发现”搜索一本书加入书架。</text>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { deleteShelfBook, getBooks } from '../../common/books.js'
import { getProgress } from '../../common/reader.js'
import { getSourceConfigs } from '../../common/bookSources.js'
import { getAppThemeId, getAppThemeStyle } from '../../common/appTheme.js'
import apiClient from '../../common/apiClient.js'
import { listBackendBooks } from '../../common/backendLibrary.js'
import { friendlyErrorMessage } from '../../common/uiFeedback.js'

const SHELF_LAYOUT_KEY = 'bookshelf:layout'

export default {
  data() {
    return {
      books: [],
      sources: [],
      moreMenuVisible: false,
      themeId: getAppThemeId(),
      shelfLayout: 'list',
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
    }
  },
  onShow() {
    this.themeId = getAppThemeId()
    this.shelfLayout = uni.getStorageSync(SHELF_LAYOUT_KEY) || 'list'
    this.refreshBooks()
    this.sources = getSourceConfigs()
  },
  methods: {
    async refreshBooks() {
      const localBooks = getBooks()
      this.books = localBooks
      if (!apiClient.getToken()) return
      try {
        const backendBooks = await listBackendBooks()
        this.books = [...backendBooks, ...localBooks]
      } catch (error) {
        uni.showToast({ title: friendlyErrorMessage(error, '云端书架加载失败'), icon: 'none' })
      }
    },
    shortTitle(title) {
      return String(title || '').slice(0, 4)
    },
    chapterCount(book) {
      const count = (book.chapters || []).length
      return count ? String(count) : '...'
    },
    progressText(book) {
      const chapters = book.chapters || []
      const progress = getProgress(book.id)
      const chapter = chapters[progress.chapterIndex] || chapters[0]
      if (chapter) return chapter.title || `第 ${progress.chapterIndex + 1} 章`
      return book.latestChapter || '等待目录解码'
    },
    openBook(book) {
      uni.navigateTo({
        url: `/pages/reader/reader?bookId=${book.id}`
      })
    },
    toggleMoreMenu() {
      this.moreMenuVisible = !this.moreMenuVisible
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
    confirmDeleteBook(book) {
      uni.showModal({
        title: '移出书架',
        content: `确定将《${book.title}》从书架移出吗？`,
        confirmText: '删除',
        confirmColor: '#e25f35',
        success: result => {
          if (result.confirm) this.deleteBookFromShelf(book)
        }
      })
    },
    deleteBookFromShelf(book) {
      const removed = deleteShelfBook(book)
      if (!removed) {
        uni.showToast({ title: '云端书籍暂不支持本机删除', icon: 'none' })
        return
      }
      this.books = this.books.filter(item => item.id !== book.id)
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
  box-sizing: border-box;
  width: 100%;
  max-width: 1120px;
  min-height: 100vh;
  overflow: hidden;
  padding: 86rpx 40rpx 132rpx;
  margin: 0 auto;
  background: #1f1f1f;
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
  background: #60757d;
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
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  border-radius: 0;
  background: rgba(33, 34, 33, 0.98);
  box-shadow: -24rpx 28rpx 64rpx rgba(0, 0, 0, 0.36);
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
  height: calc(100vh - 280rpx);
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
  padding-top: 4rpx;
  margin-left: 34rpx;
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
  height: 48rpx;
  padding: 0 18rpx;
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

/* Ink theme polish */
.decoder-page {
  background:
    radial-gradient(circle at 20% 0%, rgba(96, 117, 125, 0.18), transparent 30%),
    linear-gradient(180deg, #20211f 0%, #1b1c1a 100%);
}

.top-zone {
  background: linear-gradient(180deg, #667b83 0%, #586d75 100%);
  box-shadow: 0 10rpx 28rpx rgba(0, 0, 0, 0.20);
}

.tool-icon,
.book-row,
.empty-box {
  border: 1rpx solid rgba(255, 255, 255, 0.05);
  background: rgba(47, 48, 45, 0.88);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.035);
}

.tool-icon {
  border-radius: 26rpx;
}

.book-row {
  padding: 18rpx;
  border-radius: 18rpx;
}

.book-list.compact .book-row {
  min-height: 178rpx;
  margin-bottom: 18rpx;
}

.book-list.compact .cover-wrap {
  width: 126rpx;
  height: 172rpx;
}

.book-list.compact .book-title {
  font-size: 34rpx;
  line-height: 44rpx;
}

.book-list.compact .meta-line {
  margin-top: 8rpx;
  font-size: 25rpx;
  line-height: 32rpx;
}

.book-title,
.meta-line,
.empty-title {
  font-family: "KaiTi", "STKaiti", "FZKai-Z03", "PingFang SC", cursive;
}

.chapter-badge {
  background: rgba(255, 255, 255, 0.10);
}

/* Global app theme */
.decoder-page {
  color: var(--app-text);
  background: var(--app-bg);
}

.top-zone {
  background: var(--app-top);
  box-shadow: var(--app-shadow);
}

.book-row,
.empty-box {
  border-color: var(--app-border);
  background: var(--app-panel-strong);
  box-shadow: var(--app-shadow);
}

.top-search-button,
.top-more-button,
.book-title,
.empty-title {
  color: var(--app-text);
}

.meta-line,
.empty-desc {
  color: var(--app-muted);
}

.meta-icon,
.chapter-badge {
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.cover-wrap {
  background: linear-gradient(145deg, var(--app-accent) 0%, var(--app-accent-3) 100%);
}
</style>
