<template>
  <view class="source-explore-page app-page" :style="themeVars">
    <view class="explore-header">
      <button class="icon-button" aria-label="返回" @tap="goBack">‹</button>
      <view class="header-copy">
        <view class="header-title">{{ sourceName || '书源发现' }}</view>
        <text class="header-meta">{{ available ? '已启用 · 选择入口开始浏览' : '发现页不可用' }}</text>
      </view>
    </view>

    <scroll-view
      class="explore-scroll"
      scroll-y
      :show-scrollbar="false"
      @scrolltolower="loadMoreBooks"
    >
      <view class="fallback-search-panel status-panel" v-if="!available && canSearchFallback">
        <view class="fallback-heading">
          <view>
            <view class="status-title">发现入口暂不可解析</view>
            <text class="status-text">{{ errorMessage }}</text>
          </view>
          <button class="debug-button" @tap="copyFallbackDiagnostics">复制诊断</button>
        </view>
        <view class="fallback-search-row">
          <input
            class="fallback-search-input"
            v-model="fallbackKeyword"
            confirm-type="search"
            placeholder="输入书名搜索该书源"
            placeholder-class="search-placeholder"
            @confirm="runFallbackSearch"
          />
          <button class="fallback-search-button" :disabled="fallbackLoading" @tap="runFallbackSearch">搜索</button>
        </view>
        <view class="diagnostic-strip fallback-diagnostic" v-if="fallbackElapsedMs || fallbackDiagnostics">
          <text v-if="fallbackElapsedMs">{{ fallbackElapsedMs }}ms</text>
          <text class="diagnostic-url">{{ fallbackDiagnostics && fallbackDiagnostics.keyword || '单书源搜索兜底' }}</text>
        </view>
        <view class="status-panel error fallback-error" v-if="fallbackError">
          <view class="status-title">搜索失败</view>
          <text class="status-text">{{ fallbackError }}</text>
        </view>
        <view class="book-list fallback-book-list" v-if="fallbackBooks.length">
          <view class="book-row" v-for="book in fallbackBooks" :key="bookKey(book)" @tap="openBook(book)">
            <image
              class="book-cover"
              v-if="bookCover(book)"
              :src="bookCover(book)"
              mode="aspectFill"
              lazy-load
            />
            <view class="text-cover" v-else>{{ coverText(book.title) }}</view>
            <view class="book-copy">
              <view class="book-title">{{ book.title }}</view>
              <text class="book-author">{{ book.author || '作者未知' }}</text>
              <text class="book-latest" v-if="book.latestChapter">{{ book.latestChapter }}</text>
              <text class="book-intro" v-if="book.intro">{{ book.intro }}</text>
              <text class="book-source">{{ sourceName }} · 搜索兜底</text>
            </view>
            <text class="row-arrow">›</text>
          </view>
        </view>
        <view class="loading-row" v-if="fallbackLoading">
          <view class="loading-dot"></view>
          <text>正在搜索该书源</text>
        </view>
      </view>

      <view class="status-panel error" v-else-if="errorMessage && !available">
        <view class="status-title">无法打开发现页</view>
        <text class="status-text">{{ errorMessage }}</text>
      </view>

      <view class="entry-section" v-if="available">
        <view class="section-heading">
          <view>
            <view class="section-title">书源入口</view>
            <text class="section-desc">入口由当前书源提供</text>
          </view>
          <text class="entry-count">{{ entryCount }}</text>
        </view>

        <view class="entry-group" v-for="group in groups" :key="group.name">
          <view class="group-title" v-if="groups.length > 1 || group.name !== '发现入口'">{{ group.name }}</view>
          <view class="entry-grid">
            <button
              class="entry-button"
              v-for="entry in group.entries"
              :key="entry.id"
              :class="{ active: activeEntry && activeEntry.id === entry.id }"
              @tap="openEntry(entry)"
            >
              {{ entry.title }}
            </button>
          </view>
        </view>
      </view>

      <view class="result-section" v-if="activeEntry">
        <view class="section-heading result-heading">
          <view>
            <view class="section-title">{{ activeEntry.title }}</view>
            <text class="section-desc">{{ books.length ? `已加载 ${books.length} 本` : '正在读取书籍列表' }}</text>
          </view>
          <button class="icon-button refresh" aria-label="重新加载" :disabled="loading" @tap="reloadEntry">↻</button>
        </view>

        <view class="diagnostic-strip" v-if="lastRequestUrl || lastElapsedMs">
          <text>第 {{ page }} 页</text>
          <text v-if="lastElapsedMs">{{ lastElapsedMs }}ms</text>
          <text v-if="lastRequestUrl" class="diagnostic-url">{{ lastRequestUrl }}</text>
          <button class="debug-button" @tap="copyDebugInfo">复制调试</button>
        </view>

        <view class="status-panel error" v-if="errorMessage && available">
          <view class="status-title">加载失败</view>
          <text class="status-text">{{ errorMessage }}</text>
          <button class="retry-button" @tap="reloadEntry">重试</button>
        </view>

        <view class="book-list" v-if="books.length">
          <view class="book-row" v-for="book in books" :key="bookKey(book)" @tap="openBook(book)">
            <image
              class="book-cover"
              v-if="bookCover(book)"
              :src="bookCover(book)"
              mode="aspectFill"
              lazy-load
            />
            <view class="text-cover" v-else>{{ coverText(book.title) }}</view>
            <view class="book-copy">
              <view class="book-title">{{ book.title }}</view>
              <text class="book-author">{{ book.author || '作者未知' }}</text>
              <text class="book-latest" v-if="book.latestChapter">{{ book.latestChapter }}</text>
              <text class="book-intro" v-if="book.intro">{{ book.intro }}</text>
              <text class="book-source">{{ sourceName }} · {{ activeEntry.title }}</text>
            </view>
            <text class="row-arrow">›</text>
          </view>
        </view>

        <view class="status-panel" v-else-if="!loading && !errorMessage">
          <view class="status-title">当前入口暂无书籍</view>
          <text class="status-text">{{ emptyReasonText }}</text>
        </view>

        <view class="loading-row" v-if="loading">
          <view class="loading-dot"></view>
          <text>{{ books.length ? '正在加载更多' : '正在加载书籍' }}</text>
        </view>
        <view class="end-row" v-else-if="books.length && !hasMore">已加载当前入口内容</view>
      </view>

      <view class="initial-state" v-else-if="available">
        <view class="initial-title">选择一个入口</view>
        <text>只会加载你选择的分类，不会一次请求全部入口。</text>
      </view>
      <view class="bottom-space"></view>
    </scroll-view>
  </view>
</template>

<script>
import {
  getSourceExploreEntries,
  loadSourceExploreBooks,
  searchSourceBooks,
  saveOnlineBookDraft
} from '../../common/bookSources.js'
import { getAppThemeId, getAppThemeStyle } from '../../common/appTheme.js'
import { friendlyErrorMessage } from '../../common/uiFeedback.js'

export default {
  data() {
    return {
      sourceId: '',
      sourceName: '',
      available: false,
      groups: [],
      activeEntry: null,
      books: [],
      page: 1,
      hasMore: false,
      loading: false,
      errorMessage: '',
      reasonCode: '',
      canSearchFallback: false,
      fallbackKeyword: '',
      fallbackBooks: [],
      fallbackLoading: false,
      fallbackError: '',
      fallbackDiagnostics: null,
      fallbackElapsedMs: 0,
      lastRequestUrl: '',
      lastElapsedMs: 0,
      lastDiagnostics: null,
      themeId: getAppThemeId()
    }
  },
  computed: {
    themeVars() {
      return getAppThemeStyle(this.themeId)
    },
    entryCount() {
      return this.groups.reduce((count, group) => count + group.entries.length, 0)
    },
    emptyReasonText() {
      const diagnostics = this.lastDiagnostics || {}
      if (diagnostics.failedStage === 'empty_result' && diagnostics.errorMessage) return diagnostics.errorMessage
      return '分类页请求成功，但没有解析出图书。可能原因：分类规则与搜索规则不同、目标页面结构变化、需要 Cookie / Referer / User-Agent，或该书源依赖 JS / WebView。'
    }
  },
  onLoad(options = {}) {
    this.sourceId = decodeURIComponent(String(options.sourceId || ''))
    this.loadSourceEntries()
  },
  methods: {
    loadSourceEntries() {
      const result = getSourceExploreEntries(this.sourceId)
      this.sourceName = result.sourceName
      this.available = result.available
      this.groups = result.groups
      this.errorMessage = result.reason
      this.reasonCode = result.reasonCode || ''
      this.canSearchFallback = !!result.canSearchFallback
    },
    openEntry(entry) {
      if (!entry || this.loading) return
      this.activeEntry = entry
      this.books = []
      this.page = 1
      this.hasMore = true
      this.errorMessage = ''
      this.lastRequestUrl = ''
      this.lastElapsedMs = 0
      this.lastDiagnostics = null
      this.loadMoreBooks()
    },
    reloadEntry() {
      if (!this.activeEntry || this.loading) return
      const entry = this.activeEntry
      this.activeEntry = null
      this.openEntry(entry)
    },
    async loadMoreBooks() {
      if (!this.activeEntry || this.loading || !this.hasMore) return
      this.loading = true
      this.errorMessage = ''
      const currentPage = this.page
      const startedAt = Date.now()
      try {
        const result = await loadSourceExploreBooks(this.sourceId, this.activeEntry, { page: currentPage })
        this.lastDiagnostics = result.diagnostics || null
        this.lastRequestUrl = result.diagnostics && result.diagnostics.requestUrl || ''
        this.lastElapsedMs = Date.now() - startedAt
        const known = new Set(this.books.map(book => this.bookKey(book)))
        const additions = result.books.filter(book => !known.has(this.bookKey(book)))
        this.books = [...this.books, ...additions]
        this.hasMore = result.hasMore && additions.length > 0
        if (this.hasMore) this.page = currentPage + 1
      } catch (error) {
        this.hasMore = false
        this.lastDiagnostics = error && error.diagnostics || null
        this.lastRequestUrl = error && error.diagnostics && error.diagnostics.requestUrl || ''
        this.lastElapsedMs = Date.now() - startedAt
        this.errorMessage = friendlyErrorMessage(error, '发现入口加载失败')
      } finally {
        this.loading = false
      }
    },
    copyDebugInfo() {
      const payload = {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        entryTitle: this.activeEntry && this.activeEntry.title || '',
        page: this.page,
        lastRequestUrl: this.lastRequestUrl,
        lastElapsedMs: this.lastElapsedMs,
        diagnostics: this.lastDiagnostics || {}
      }
      uni.setClipboardData({
        data: JSON.stringify(payload, null, 2),
        success: () => uni.showToast({ title: '调试信息已复制', icon: 'none' })
      })
    },
    async runFallbackSearch() {
      const keyword = String(this.fallbackKeyword || '').trim()
      if (!keyword || this.fallbackLoading) return
      this.fallbackLoading = true
      this.fallbackError = ''
      this.fallbackBooks = []
      this.fallbackDiagnostics = { keyword, reasonCode: this.reasonCode }
      const startedAt = Date.now()
      try {
        const result = await searchSourceBooks(this.sourceId, keyword, { timeoutMs: 8000, failOnEmpty: true })
        this.fallbackElapsedMs = Date.now() - startedAt
        this.fallbackDiagnostics = {
          keyword: result.keyword,
          count: result.count,
          sourceId: result.sourceId,
          reasonCode: this.reasonCode
        }
        this.fallbackBooks = result.results.map(item => item.book).filter(book => book && book.bookUrl)
      } catch (error) {
        this.fallbackElapsedMs = Date.now() - startedAt
        this.fallbackError = friendlyErrorMessage(error, '单书源搜索失败')
      } finally {
        this.fallbackLoading = false
      }
    },
    copyFallbackDiagnostics() {
      const payload = {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        available: this.available,
        reasonCode: this.reasonCode,
        reason: this.errorMessage,
        canSearchFallback: this.canSearchFallback,
        keyword: this.fallbackKeyword,
        elapsedMs: this.fallbackElapsedMs,
        error: this.fallbackError,
        diagnostics: this.fallbackDiagnostics || {}
      }
      uni.setClipboardData({
        data: JSON.stringify(payload, null, 2),
        success: () => uni.showToast({ title: '诊断信息已复制', icon: 'none' })
      })
    },
    openBook(book) {
      if (!book || !book.bookUrl) return
      saveOnlineBookDraft(book)
      uni.navigateTo({ url: '/pages/sourceBook/sourceBook' })
    },
    bookKey(book) {
      return String(book && (book.id || `${book.sourceId || this.sourceId}:${book.bookUrl || book.title}`))
    },
    bookCover(book) {
      return book && (book.coverUrl || book.cover || '')
    },
    coverText(title) {
      return String(title || '书').trim().slice(0, 2)
    },
    goBack() {
      uni.navigateBack()
    }
  }
}
</script>

<style scoped>
.source-explore-page {
  min-height: 100vh;
  background: var(--app-bg, #0d171b);
  color: var(--app-text, #f4f6f5);
}

.explore-header {
  height: 128rpx;
  padding: 22rpx 28rpx 18rpx;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 20rpx;
  background: var(--app-surface, #111d23);
  border-bottom: 1rpx solid var(--app-border, #29404a);
}

.icon-button {
  width: 72rpx;
  height: 72rpx;
  min-width: 72rpx;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid var(--app-border, #29404a);
  border-radius: 8rpx;
  background: var(--app-surface-soft, #17252c);
  color: var(--app-text, #f4f6f5);
  font-size: 48rpx;
  line-height: 1;
}

.icon-button::after,
.entry-button::after,
.retry-button::after,
.debug-button::after {
  border: 0;
}

.header-copy,
.book-copy {
  min-width: 0;
  flex: 1;
}

.header-title {
  font-size: 36rpx;
  font-weight: 700;
}

.header-meta,
.section-desc,
.status-text,
.book-author,
.book-latest,
.book-intro,
.book-source,
.initial-state,
.end-row {
  color: var(--app-muted, #a9b6bb);
}

.header-meta,
.section-desc {
  display: block;
  margin-top: 6rpx;
  font-size: 23rpx;
}

.explore-scroll {
  height: calc(100vh - 128rpx);
}

.entry-section,
.result-section {
  padding: 30rpx 28rpx 0;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 22rpx;
}

.section-title,
.status-title {
  font-size: 30rpx;
  font-weight: 700;
}

.entry-count {
  min-width: 52rpx;
  text-align: center;
  color: var(--app-accent, #59e1d9);
  font-size: 24rpx;
}

.entry-group + .entry-group {
  margin-top: 24rpx;
}

.group-title {
  margin-bottom: 12rpx;
  color: var(--app-muted, #a9b6bb);
  font-size: 24rpx;
}

.entry-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
}

.entry-button {
  min-width: 0;
  min-height: 74rpx;
  padding: 14rpx 10rpx;
  border: 1rpx solid var(--app-border, #35515c);
  border-radius: 8rpx;
  background: var(--app-surface-soft, #17252c);
  color: var(--app-text, #f4f6f5);
  font-size: 25rpx;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.entry-button.active {
  border-color: var(--app-accent, #59e1d9);
  color: var(--app-accent, #59e1d9);
}

.result-heading {
  margin-top: 12rpx;
}

.icon-button.refresh {
  width: 64rpx;
  height: 64rpx;
  min-width: 64rpx;
  font-size: 34rpx;
}

.diagnostic-strip {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-height: 62rpx;
  margin: -8rpx 0 18rpx;
  padding: 10rpx 12rpx;
  border: 1rpx solid var(--app-border, #29404a);
  border-radius: 8rpx;
  background: var(--app-surface, #111d23);
  color: var(--app-muted, #a9b6bb);
  font-size: 21rpx;
}

.diagnostic-url {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.debug-button {
  flex-shrink: 0;
  min-width: 110rpx;
  height: 46rpx;
  margin: 0;
  padding: 0 14rpx;
  border-radius: 8rpx;
  color: var(--app-accent, #59e1d9);
  background: var(--app-surface-soft, #17252c);
  font-size: 21rpx;
}

.fallback-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.fallback-search-row {
  margin-top: 26rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.fallback-search-input {
  min-width: 0;
  flex: 1;
  height: 74rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
  border: 1rpx solid var(--app-border, #29404a);
  border-radius: 8rpx;
  background: var(--app-surface-soft, #17252c);
  color: var(--app-text, #f4f6f5);
  font-size: 25rpx;
}

.search-placeholder {
  color: var(--app-muted, #a9b6bb);
}

.fallback-search-button {
  width: 136rpx;
  height: 74rpx;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 8rpx;
  background: var(--app-accent, #59e1d9);
  color: #102025;
  font-size: 25rpx;
  font-weight: 700;
}

.fallback-search-button::after {
  border: 0;
}

.fallback-diagnostic {
  margin: 18rpx 0 0;
}

.fallback-error {
  margin: 20rpx 0 0;
}

.fallback-book-list {
  margin-top: 24rpx;
}

.book-list {
  border-top: 1rpx solid var(--app-border, #29404a);
}

.book-row {
  min-height: 190rpx;
  padding: 22rpx 0;
  display: flex;
  align-items: center;
  gap: 20rpx;
  border-bottom: 1rpx solid var(--app-border, #29404a);
}

.book-cover,
.text-cover {
  width: 112rpx;
  height: 156rpx;
  min-width: 112rpx;
  border-radius: 6rpx;
  background: #28404a;
}

.text-cover {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12rpx;
  box-sizing: border-box;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 700;
  text-align: center;
}

.book-title {
  font-size: 29rpx;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.book-author,
.book-latest,
.book-intro,
.book-source {
  display: block;
  margin-top: 7rpx;
  font-size: 22rpx;
  line-height: 1.4;
}

.book-intro {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.book-source {
  color: var(--app-accent, #59e1d9);
}

.row-arrow {
  width: 28rpx;
  min-width: 28rpx;
  color: var(--app-muted, #a9b6bb);
  font-size: 38rpx;
  text-align: right;
}

.status-panel,
.initial-state {
  margin: 28rpx;
  padding: 28rpx;
  border: 1rpx solid var(--app-border, #29404a);
  border-radius: 8rpx;
  background: var(--app-surface, #111d23);
}

.result-section .status-panel {
  margin: 0;
}

.status-panel.error {
  border-color: #8a4e4e;
}

.status-text,
.initial-state text {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.6;
}

.retry-button {
  margin: 22rpx 0 0;
  width: 150rpx;
  min-height: 64rpx;
  border: 0;
  border-radius: 8rpx;
  background: var(--app-accent, #59e1d9);
  color: #102025;
  font-size: 24rpx;
}

.initial-state {
  text-align: center;
}

.initial-title {
  font-size: 30rpx;
  font-weight: 700;
}

.loading-row,
.end-row {
  min-height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14rpx;
  font-size: 23rpx;
}

.loading-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: var(--app-accent, #59e1d9);
}

.bottom-space {
  height: 150rpx;
}

@media screen and (min-width: 900px) {
  .entry-section,
  .result-section,
  .initial-state,
  .status-panel {
    max-width: 1120px;
    margin-left: auto;
    margin-right: auto;
  }

  .entry-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
</style>
