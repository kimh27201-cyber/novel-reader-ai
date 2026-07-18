<template>
  <view class="source-book-page app-page secondary" :style="themeVars">
    <view class="topbar">
      <button class="back-button" @tap="goBack">‹</button>
      <view class="topbar-copy">
        <text class="eyebrow">CATALOGUE / SOURCE</text>
        <view class="title">书籍详情</view>
      </view>
      <text class="topbar-state" :class="{ active: chapters.length }">{{ loading ? '解析中' : chapters.length ? '可阅读' : '待解析' }}</text>
    </view>

    <view class="detail-empty" v-if="!book">
      <view class="empty-seal">?</view>
      <view class="empty-title">没有可展示的书籍</view>
      <text class="empty-desc">搜索结果可能已经失效，请返回发现页重新选择一本书。</text>
      <button class="empty-action" @tap="goBack">返回发现页</button>
    </view>

    <template v-else>
      <view class="hero-card">
        <view class="ticket-rail">
          <text>SOURCE TICKET</text>
          <text>{{ sourceTicket }}</text>
        </view>
        <view class="cover-shell">
          <view class="cover">
            <image class="cover-image" v-if="book.coverUrl" :src="book.coverUrl" mode="aspectFill" lazy-load />
            <text v-else>{{ shortTitle(book.title) }}</text>
            <view class="cover-spine"></view>
          </view>
          <text class="shelf-stamp" v-if="addedToShelf">已藏</text>
        </view>
        <view class="hero-copy">
          <view class="book-title">{{ book.title }}</view>
          <view class="book-byline">
            <text>{{ book.author || '作者待补充' }}</text>
            <text class="byline-dot">·</text>
            <text>{{ book.sourceName || '未知书源' }}</text>
          </view>
          <text class="book-desc" :class="{ expanded: introExpanded }">{{ book.intro || book.latestChapter || '书源暂未提供简介，可先解析目录查看章节。' }}</text>
          <button class="intro-toggle" v-if="hasLongIntro" @tap="introExpanded = !introExpanded">
            {{ introExpanded ? '收起简介' : '展开简介' }}
          </button>
          <view class="hero-tags">
            <text>{{ book.type === 'backend-online' ? '云端书源' : '在线书源' }}</text>
            <text>{{ chapters.length ? `${chapters.length} 章` : '目录待解析' }}</text>
          </view>
        </view>
      </view>

      <view class="metric-strip">
        <view class="metric-cell">
          <text class="metric-value">{{ chapters.length || '—' }}</text>
          <text class="metric-label">识别章节</text>
        </view>
        <view class="metric-cell">
          <text class="metric-value">{{ cacheStats.cachedChapters || '—' }}</text>
          <text class="metric-label">已缓存</text>
        </view>
        <view class="metric-cell">
          <text class="metric-value compact">{{ formattedCacheChars }}</text>
          <text class="metric-label">缓存字数</text>
        </view>
      </view>

      <view class="status-card" :class="{ loading, failed: errorMessage }">
        <view class="status-orbit" :class="{ active: loading }"><text>{{ loading ? '···' : errorMessage ? '!' : chapters.length ? '✓' : '·' }}</text></view>
        <view class="status-copy">
          <view class="status-title">{{ loading ? '正在解析书源目录' : errorMessage ? '目录解析中断' : `${chapters.length} 章已识别` }}</view>
          <text class="status-desc">{{ errorMessage || (chapters.length ? '目录已经就绪，可以选择任意章节开始阅读。' : '目录暂时为空，可重新解析或返回更换书源。') }}</text>
        </view>
        <button class="status-retry" v-if="errorMessage" @tap="reload">重试</button>
        <view class="status-track" v-if="loading"><view class="status-progress"></view></view>
      </view>

      <view class="cache-card">
        <view class="cache-head" @tap="cacheExpanded = !cacheExpanded">
          <view class="cache-head-main">
            <view class="cache-icon">↓</view>
            <view>
              <view class="cache-title">离线与缓存</view>
              <text class="cache-desc">{{ cacheSettings.offlineMode ? '仅使用已缓存章节' : `阅读时预加载后续 ${cacheSettings.preloadCount} 章` }}</text>
            </view>
          </view>
          <text class="cache-chevron">{{ cacheExpanded ? '收起' : '设置' }}</text>
        </view>
        <view class="cache-body" v-if="cacheExpanded">
          <view class="offline-row">
            <view>
              <view class="offline-title">离线模式</view>
              <text class="cache-desc">开启后不再请求未缓存章节</text>
            </view>
            <switch :checked="cacheSettings.offlineMode" :color="themeVars['--app-accent']" @change="toggleOfflineMode" />
          </view>
          <view class="cache-grid">
            <view class="cache-field">
              <text>预加载章节</text>
              <view class="cache-stepper">
                <button @tap.stop="adjustCacheSetting('preloadCount', -1)">−</button>
                <text>{{ cacheSettings.preloadCount }}</text>
                <button @tap.stop="adjustCacheSetting('preloadCount', 1)">+</button>
              </view>
            </view>
            <view class="cache-field">
              <text>最大缓存章节</text>
              <view class="cache-stepper">
                <button @tap.stop="adjustCacheSetting('maxChapters', -10)">−</button>
                <text>{{ cacheSettings.maxChapters }}</text>
                <button @tap.stop="adjustCacheSetting('maxChapters', 10)">+</button>
              </view>
            </view>
          </view>
          <view class="cache-actions">
            <button class="plain-action" @tap="exportCachedTxt">导出 TXT</button>
            <button class="plain-action danger" @tap="clearCache">清理缓存</button>
          </view>
        </view>
      </view>

      <view class="catalog-head">
        <view>
          <text class="catalog-kicker">CHAPTER TRACK</text>
          <view class="catalog-title">目录</view>
        </view>
        <text class="catalog-count">{{ chapters.length ? `显示 ${visibleChapters.length}/${chapters.length}` : '等待目录' }}</text>
      </view>

      <scroll-view class="chapter-list" scroll-y :show-scrollbar="false" v-if="chapters.length" @scrolltolower="loadMoreChapters">
        <view
          class="chapter-item"
          v-for="chapter in visibleChapters"
          :key="chapter.index"
          @tap="addAndRead(chapter.index)"
        >
          <view class="chapter-marker"><text>{{ String(chapter.index + 1).padStart(2, '0') }}</text></view>
          <view class="chapter-copy">
            <text class="chapter-title">{{ chapter.title }}</text>
            <text class="chapter-hint">点击从本章开始阅读</text>
          </view>
          <text class="chapter-state" :class="chapterStateClass(chapter)">{{ chapterStateLabel(chapter) }}</text>
        </view>
      </scroll-view>

      <view class="catalog-empty" v-else-if="!loading">
        <text>目录还没有准备好</text>
        <button @tap="reload">重新解析目录</button>
      </view>

      <view class="action-dock">
        <button class="dock-secondary" :disabled="loading" @tap="reload">{{ loading ? '解析中' : '重新解析' }}</button>
        <button class="dock-primary" :disabled="!chapters.length || actionBusy" @tap="addAndRead">
          {{ actionBusy ? '正在打开' : addedToShelf ? '继续阅读' : '加入书架并阅读' }}
        </button>
      </view>
    </template>
  </view>
</template>

<script>
import {
  addOnlineBookToShelf,
  clearOnlineChapterCache,
  exportOnlineBookTxt,
  getChapterCacheSettings,
  getOnlineChapterCacheStats,
  getOnlineBookDraft,
  getOnlineShelfBooks,
  loadOnlineBookInfo,
  loadOnlineToc,
  saveChapterCacheSettings
} from '../../common/bookSources.js'
import { getAppThemeId, getAppThemeStyle } from '../../common/appTheme.js'
import {
  addBackendBookWithChapters,
  loadBackendSourceToc
} from '../../common/backendLibrary.js'
import { friendlyErrorMessage } from '../../common/uiFeedback.js'

const CHAPTER_BATCH_SIZE = 80

export default {
  data() {
    return {
      book: null,
      chapters: [],
      visibleChapterCount: CHAPTER_BATCH_SIZE,
      loading: false,
      actionBusy: false,
      addedToShelf: false,
      introExpanded: false,
      cacheExpanded: false,
      errorMessage: '',
      cacheSettings: getChapterCacheSettings(),
      cacheStats: { books: 0, cachedChapters: 0, totalChars: 0 },
      themeId: getAppThemeId()
    }
  },
  computed: {
    themeVars() {
      return getAppThemeStyle(this.themeId)
    },
    visibleChapters() {
      return this.chapters.slice(0, this.visibleChapterCount)
    },
    sourceTicket() {
      const value = String((this.book && (this.book.sourceId || this.book.id)) || 'SOURCE')
      return value.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase() || 'SOURCE'
    },
    hasLongIntro() {
      return String((this.book && (this.book.intro || this.book.latestChapter)) || '').length > 72
    },
    formattedCacheChars() {
      const total = Number(this.cacheStats.totalChars || 0)
      if (!total) return '—'
      if (total >= 10000) return `${(total / 10000).toFixed(1)}万`
      return String(total)
    }
  },
  onLoad() {
    this.themeId = getAppThemeId()
    this.book = getOnlineBookDraft()
    if (!this.book) {
      this.errorMessage = '没有找到搜索结果，请返回重新搜索。'
      return
    }
    this.updateShelfState()
    this.reload()
  },
  onShow() {
    this.themeId = getAppThemeId()
    this.updateShelfState()
  },
  methods: {
    shortTitle(title) {
      return String(title || '').slice(0, 4)
    },
    chapterStateLabel(chapter) {
      if (chapter.errorMessage || chapter.loadStatus === 'failed') return '解析失败'
      if (chapter.isCached || chapter.loadStatus === 'cached' || chapter.loadStatus === 'loaded') return '已缓存'
      return '待解码'
    },
    chapterStateClass(chapter) {
      if (chapter.errorMessage || chapter.loadStatus === 'failed') return 'failed'
      if (chapter.isCached || chapter.loadStatus === 'cached' || chapter.loadStatus === 'loaded') return 'cached'
      return 'pending'
    },
    updateShelfState() {
      if (!this.book || this.book.type === 'backend-online') return
      this.addedToShelf = getOnlineShelfBooks().some(item => item.id === this.book.id)
    },
    refreshCacheStats() {
      this.cacheSettings = getChapterCacheSettings()
      this.cacheStats = this.book ? getOnlineChapterCacheStats(this.book.id) : { books: 0, cachedChapters: 0, totalChars: 0 }
    },
    adjustCacheSetting(field, delta) {
      const next = {
        ...this.cacheSettings,
        [field]: Number(this.cacheSettings[field] || 0) + delta
      }
      this.cacheSettings = saveChapterCacheSettings(next)
      this.refreshCacheStats()
    },
    toggleOfflineMode(event) {
      this.cacheSettings = saveChapterCacheSettings({
        ...this.cacheSettings,
        offlineMode: !!(event && event.detail && event.detail.value)
      })
      this.refreshCacheStats()
    },
    exportCachedTxt() {
      try {
        const result = exportOnlineBookTxt(this.book.id)
        uni.setClipboardData({
          data: result.text,
          success: () => uni.showToast({ title: 'TXT 已复制', icon: 'none' })
        })
      } catch (error) {
        uni.showToast({ title: friendlyErrorMessage(error, '导出 TXT 失败'), icon: 'none' })
      }
    },
    clearCache() {
      const result = clearOnlineChapterCache(this.book.id)
      this.chapters = this.chapters.map(chapter => ({
        ...chapter,
        content: '',
        isCached: false,
        loadStatus: chapter.errorMessage ? 'failed' : 'idle'
      }))
      this.refreshCacheStats()
      uni.showToast({ title: `已清理 ${result.removed} 章缓存`, icon: 'none' })
    },
    async reload() {
      if (!this.book) return
      this.loading = true
      this.errorMessage = ''
      try {
        if (this.book.type === 'backend-online') {
          this.chapters = await loadBackendSourceToc(this.book)
          this.resetVisibleChapters()
          return
        }
        const info = await loadOnlineBookInfo(this.book)
        const chapters = await loadOnlineToc(info)
        this.book = {
          ...info,
          chapters
        }
        this.chapters = chapters
        this.resetVisibleChapters()
        this.refreshCacheStats()
      } catch (error) {
        this.errorMessage = friendlyErrorMessage(error, '书源解析失败')
      } finally {
        this.loading = false
      }
    },
    resetVisibleChapters() {
      this.visibleChapterCount = CHAPTER_BATCH_SIZE
    },
    loadMoreChapters() {
      if (this.visibleChapterCount >= this.chapters.length) return
      this.visibleChapterCount = Math.min(this.chapters.length, this.visibleChapterCount + CHAPTER_BATCH_SIZE)
    },
    async addAndRead(chapterIndex = 0) {
      if (!this.book || !this.chapters.length || this.actionBusy) return
      const wasOnShelf = this.addedToShelf
      this.actionBusy = true
      try {
        const book = this.book.type === 'backend-online'
          ? await addBackendBookWithChapters(this.book, this.chapters)
          : addOnlineBookToShelf({
              ...this.book,
              chapters: this.chapters
            })
        this.book = book
        this.addedToShelf = true
        this.refreshCacheStats()
        uni.showToast({ title: wasOnShelf ? '已在书架，继续阅读' : '已加入书架', icon: 'none' })
        uni.navigateTo({
          url: `/pages/reader/reader?bookId=${book.id}&chapterIndex=${Number(chapterIndex) || 0}&pageIndex=0`
        })
      } catch (error) {
        uni.showToast({ title: friendlyErrorMessage(error, '加入书架失败'), icon: 'none' })
      } finally {
        this.actionBusy = false
      }
    },
    goBack() {
      uni.navigateBack()
    }
  }
}
</script>

<style>
.source-book-page {
  box-sizing: border-box;
  width: 100%;
  max-width: 1120px;
  min-height: 100vh;
  padding: 58rpx 32rpx 120rpx;
  margin: 0 auto;
  background: var(--app-bg);
}

.topbar,
.hero-card,
.actions,
.chapter-item {
  display: flex;
  align-items: center;
}

.topbar {
  gap: 22rpx;
}

.back-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  padding: 0;
  border-radius: 999rpx;
  color: var(--app-accent);
  font-size: 48rpx;
  line-height: 1;
  background: var(--app-panel);
}

button::after {
  border: 0;
}

.eyebrow {
  color: var(--app-accent);
  font-size: 22rpx;
  font-weight: 800;
}

.title {
  margin-top: 6rpx;
  color: var(--app-text);
  font-size: 48rpx;
  font-weight: 900;
}

.hero-card,
.status-card,
.cache-card {
  margin-top: 28rpx;
  padding: 28rpx;
  border: 1rpx solid rgba(103, 255, 242, 0.16);
  border-radius: 30rpx;
  background: var(--app-panel-strong);
  box-shadow: 0 18rpx 50rpx rgba(0, 0, 0, 0.28), inset 0 1rpx 0 rgba(255, 255, 255, 0.08);
}

.cache-head,
.cache-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.cache-title {
  color: var(--app-text);
  font-size: 28rpx;
  font-weight: 850;
}

.cache-desc {
  display: block;
  margin-top: 8rpx;
  color: var(--app-muted);
  font-size: 23rpx;
  line-height: 34rpx;
}

.cache-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 20rpx;
}

.cache-field {
  padding: 16rpx;
  border-radius: 18rpx;
  background: var(--app-input);
}

.cache-field text {
  color: var(--app-muted);
  font-size: 22rpx;
}

.cache-stepper {
  display: grid;
  grid-template-columns: 52rpx minmax(0, 1fr) 52rpx;
  gap: 8rpx;
  align-items: center;
  margin-top: 12rpx;
}

.cache-stepper button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48rpx;
  padding: 0;
  border-radius: 999rpx;
  color: var(--app-text);
  background: var(--app-panel);
}

.cache-stepper text {
  color: var(--app-text);
  font-size: 24rpx;
  font-weight: 800;
  text-align: center;
}

.cache-actions {
  justify-content: flex-start;
  margin-top: 18rpx;
}

.cover {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  flex-shrink: 0;
  width: 164rpx;
  height: 224rpx;
  overflow: hidden;
  padding: 18rpx 12rpx;
  border-radius: 18rpx 14rpx 14rpx 18rpx;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 900;
  text-align: center;
  background: linear-gradient(155deg, #09142d 0%, var(--app-accent-2) 46%, var(--app-accent-3) 100%);
  box-shadow: inset 12rpx 0 0 rgba(255, 255, 255, 0.12), 18rpx 22rpx 34rpx rgba(0, 0, 0, 0.36);
}

.cover-image {
  width: 100%;
  height: 100%;
  border-radius: 14rpx;
}

.hero-copy {
  min-width: 0;
  flex: 1;
  margin-left: 28rpx;
}

.book-title,
.status-title {
  color: var(--app-text);
  font-size: 36rpx;
  font-weight: 900;
  line-height: 46rpx;
}

.book-meta,
.book-desc,
.status-desc {
  display: block;
  margin-top: 10rpx;
  color: var(--app-muted);
  font-size: 24rpx;
  line-height: 36rpx;
}

.book-desc {
  max-height: 108rpx;
  overflow: hidden;
}

.actions {
  gap: 14rpx;
  margin-top: 22rpx;
}

.plain-action,
.primary-action {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 82rpx;
  padding: 0;
  border-radius: 18rpx;
  font-size: 26rpx;
  line-height: 1;
}

.plain-action {
  color: var(--app-accent);
  background: var(--app-panel);
}

.primary-action {
  color: #061019;
  background: linear-gradient(135deg, var(--app-accent) 0%, var(--app-accent-2) 50%, var(--app-accent-3) 100%);
}

.primary-action[disabled] {
  color: #6f7f9f;
  background: rgba(25, 34, 56, 0.72);
}

.chapter-list {
  height: 46vh;
  margin-top: 22rpx;
}

.chapter-item {
  min-height: 78rpx;
  padding: 0 20rpx;
  margin-bottom: 10rpx;
  border-radius: 18rpx;
  color: var(--app-text);
  background: var(--app-panel);
}

.chapter-index {
  flex-shrink: 0;
  width: 62rpx;
  color: var(--app-accent);
  font-size: 24rpx;
  font-weight: 900;
}

.chapter-title {
  overflow: hidden;
  flex: 1;
  font-size: 26rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chapter-state {
  flex-shrink: 0;
  min-width: 92rpx;
  padding: 8rpx 12rpx;
  border-radius: 999rpx;
  color: var(--app-muted);
  font-size: 21rpx;
  text-align: center;
  background: var(--app-input);
}

.chapter-state.cached {
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.chapter-state.failed {
  color: var(--app-on-accent);
  background: var(--app-accent-3);
}

/* Decoder mode override */
.source-book-page {
  background: #1f1f1f;
}

.topbar {
  min-height: 116rpx;
  margin: -58rpx -32rpx 28rpx;
  padding: 58rpx 32rpx 24rpx;
  background: var(--app-top);
}

.eyebrow {
  color: rgba(255, 255, 255, 0.7);
}

.title,
.book-title,
.status-title,
.chapter-title {
  color: #ffffff;
  font-family: cursive;
}

.back-button {
  color: #ffffff;
  background: transparent;
}

.hero-card,
.status-card,
.chapter-item,
.plain-action {
  border: 0;
  background: #2d2d2d;
  box-shadow: none;
}

.book-meta,
.book-desc,
.status-desc {
  color: #ababab;
}

.primary-action {
  color: #ffffff;
  background: #d44b2f;
}

.chapter-index {
  color: #d44b2f;
}

.source-book-page {
  background:
    radial-gradient(circle at 20% 0%, rgba(96, 117, 125, 0.18), transparent 30%),
    linear-gradient(180deg, var(--app-stage) 0%, var(--app-bg) 100%);
}

.topbar {
  background: linear-gradient(180deg, #667b83 0%, #586d75 100%);
}

.hero-card,
.status-card,
.chapter-item,
.plain-action {
  background: rgba(47, 48, 45, 0.92);
}

.primary-action {
  background: #d85a3a;
}

/* Global app theme */
.source-book-page {
  color: var(--app-text);
  background: var(--app-bg);
}

.topbar {
  background: var(--app-top);
  box-shadow: var(--app-shadow);
}

.eyebrow,
.chapter-index {
  color: var(--app-accent-3);
}

.title,
.book-title,
.status-title,
.chapter-title {
  color: var(--app-text);
}

.back-button,
.hero-card,
.status-card,
.chapter-item,
.plain-action {
  border: 1rpx solid var(--app-border);
  background: var(--app-panel-strong);
  box-shadow: var(--app-shadow);
}

.book-meta,
.book-desc,
.status-desc {
  color: var(--app-muted);
}

.primary-action {
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.primary-action[disabled] {
  color: var(--app-muted);
  background: var(--app-panel);
}

.cover {
  background: linear-gradient(155deg, var(--app-accent) 0%, var(--app-accent-2) 50%, var(--app-accent-3) 100%);
}

/* Stage 3: a theme-aware digital bookplate, without changing source or reading flows. */
.source-book-page {
  position: relative;
  box-sizing: border-box;
  min-height: 100vh;
  padding: 0 28rpx calc(196rpx + env(safe-area-inset-bottom));
  overflow-x: hidden;
  color: var(--app-text);
  background: var(--app-stage) !important;
}

.topbar {
  position: sticky;
  z-index: 20;
  top: 0;
  min-height: 126rpx;
  padding: calc(42rpx + env(safe-area-inset-top)) 28rpx 22rpx;
  margin: 0 -28rpx;
  gap: 20rpx;
  border-bottom: 1rpx solid var(--app-border);
  background: var(--app-top);
  box-shadow: var(--app-shadow);
}

.topbar-copy {
  flex: 1;
  min-width: 0;
}

.back-button {
  flex-shrink: 0;
  width: 88rpx;
  height: 88rpx;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-control-radius);
  color: var(--app-text);
  font-family: sans-serif;
  font-size: 48rpx;
  background: var(--app-input);
  box-shadow: none;
}

.eyebrow {
  color: var(--app-accent);
  font-size: 18rpx;
  font-weight: 900;
  letter-spacing: 3rpx;
}

.title {
  margin-top: 4rpx;
  color: var(--app-text);
  font-family: var(--app-heading-font);
  font-size: 38rpx;
  font-weight: 900;
  line-height: 46rpx;
}

.topbar-state {
  flex-shrink: 0;
  padding: 10rpx 16rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 999rpx;
  color: var(--app-muted);
  font-size: 20rpx;
  font-weight: 800;
  background: var(--app-input);
}

.topbar-state.active {
  color: var(--app-on-accent);
  border-color: var(--app-accent);
  background: var(--app-accent);
}

.hero-card,
.status-card,
.cache-card,
.metric-strip,
.detail-empty,
.catalog-empty {
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-card-radius);
  background: var(--app-panel-strong);
  box-shadow: var(--app-shadow);
}

.hero-card {
  position: relative;
  align-items: flex-start;
  gap: 26rpx;
  padding: 66rpx 26rpx 28rpx;
  margin-top: 24rpx;
  overflow: hidden;
}

.ticket-rail {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 42rpx;
  padding: 0 24rpx;
  border-bottom: 1rpx dashed var(--app-border);
  color: var(--app-accent);
  font-size: 16rpx;
  font-weight: 900;
  letter-spacing: 2rpx;
  background: var(--app-input);
}

.cover-shell {
  position: relative;
  flex-shrink: 0;
}

.cover {
  position: relative;
  align-items: center;
  width: 168rpx;
  height: 232rpx;
  padding: 18rpx;
  overflow: hidden;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-control-radius);
  color: var(--app-on-accent);
  font-family: var(--app-heading-font);
  font-size: 28rpx;
  line-height: 38rpx;
  background: linear-gradient(145deg, var(--app-accent-2), var(--app-accent));
  box-shadow: var(--app-glow), var(--app-shadow);
}

.cover-image {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: inherit;
}

.cover-spine {
  position: absolute;
  z-index: 2;
  top: 0;
  bottom: 0;
  left: 13rpx;
  width: 2rpx;
  background: rgba(255, 255, 255, 0.36);
}

.shelf-stamp {
  position: absolute;
  right: -14rpx;
  bottom: -12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  border: 4rpx double var(--app-accent);
  border-radius: 50%;
  color: var(--app-accent);
  font-size: 19rpx;
  font-weight: 900;
  background: var(--app-panel-strong);
  transform: rotate(-9deg);
}

.hero-copy {
  flex: 1;
  min-width: 0;
  margin-left: 0;
}

.book-title {
  display: -webkit-box;
  overflow: hidden;
  color: var(--app-text);
  font-family: var(--app-heading-font);
  font-size: 38rpx;
  font-weight: 900;
  line-height: 48rpx;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.book-byline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8rpx;
  margin-top: 12rpx;
  color: var(--app-muted);
  font-size: 22rpx;
  line-height: 32rpx;
}

.byline-dot {
  color: var(--app-accent);
}

.book-desc {
  display: -webkit-box;
  max-height: none;
  margin-top: 16rpx;
  overflow: hidden;
  color: var(--app-muted);
  font-size: 23rpx;
  line-height: 35rpx;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.book-desc.expanded {
  display: block;
  overflow: visible;
}

.intro-toggle {
  min-width: 120rpx;
  min-height: 60rpx;
  padding: 0;
  margin: 6rpx 0 0;
  color: var(--app-accent);
  font-size: 21rpx;
  text-align: left;
  background: transparent;
}

.hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 14rpx;
}

.hero-tags text {
  padding: 8rpx 13rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 999rpx;
  color: var(--app-accent);
  font-size: 18rpx;
  font-weight: 800;
  background: var(--app-input);
}

.metric-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 18rpx;
  overflow: hidden;
}

.metric-cell {
  min-width: 0;
  padding: 22rpx 10rpx;
  text-align: center;
}

.metric-cell + .metric-cell {
  border-left: 1rpx solid var(--app-border);
}

.metric-value,
.metric-label {
  display: block;
}

.metric-value {
  overflow: hidden;
  color: var(--app-text);
  font-family: var(--app-heading-font);
  font-size: 32rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-value.compact {
  color: var(--app-accent);
  font-size: 27rpx;
}

.metric-label {
  margin-top: 4rpx;
  color: var(--app-muted);
  font-size: 19rpx;
}

.status-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 20rpx;
  min-height: 132rpx;
  padding: 24rpx;
  margin-top: 18rpx;
  overflow: hidden;
}

.status-card.failed {
  border-color: var(--app-accent-3);
}

.status-orbit {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 74rpx;
  height: 74rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 50%;
  color: var(--app-accent);
  font-size: 26rpx;
  font-weight: 900;
  background: var(--app-input);
  box-shadow: var(--app-glow);
}

.status-orbit.active {
  animation: detailPulse 1.2s ease-in-out infinite;
}

.status-copy {
  flex: 1;
  min-width: 0;
}

.status-title {
  color: var(--app-text);
  font-family: var(--app-heading-font);
  font-size: 27rpx;
  line-height: 36rpx;
}

.status-desc {
  margin-top: 5rpx;
  color: var(--app-muted);
  font-size: 21rpx;
  line-height: 31rpx;
}

.status-retry {
  flex-shrink: 0;
  min-width: 106rpx;
  min-height: 72rpx;
  padding: 0 18rpx;
  border-radius: var(--app-control-radius);
  color: var(--app-on-accent);
  font-size: 22rpx;
  background: var(--app-accent);
}

.status-track {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 6rpx;
  overflow: hidden;
  background: var(--app-input);
}

.status-progress {
  width: 38%;
  height: 100%;
  background: linear-gradient(90deg, transparent, var(--app-accent), transparent);
  animation: detailLoading 1.4s ease-in-out infinite;
}

.cache-card {
  padding: 0;
  margin-top: 18rpx;
  overflow: hidden;
}

.cache-head {
  min-height: 110rpx;
  padding: 20rpx 22rpx;
}

.cache-head-main {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-width: 0;
}

.cache-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 62rpx;
  height: 62rpx;
  border-radius: var(--app-control-radius);
  color: var(--app-accent);
  font-size: 28rpx;
  font-weight: 900;
  background: var(--app-input);
}

.cache-title,
.offline-title {
  color: var(--app-text);
  font-family: var(--app-heading-font);
  font-size: 25rpx;
  font-weight: 900;
}

.cache-desc {
  margin-top: 4rpx;
  color: var(--app-muted);
  font-size: 20rpx;
  line-height: 29rpx;
}

.cache-chevron {
  flex-shrink: 0;
  color: var(--app-accent);
  font-size: 21rpx;
  font-weight: 800;
}

.cache-body {
  padding: 0 22rpx 22rpx;
  border-top: 1rpx solid var(--app-border);
}

.offline-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 20rpx 0;
}

.cache-grid {
  gap: 12rpx;
  margin-top: 0;
}

.cache-field {
  padding: 16rpx;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-control-radius);
  background: var(--app-input);
}

.cache-stepper {
  grid-template-columns: 64rpx minmax(0, 1fr) 64rpx;
  margin-top: 12rpx;
}

.cache-stepper button {
  min-height: 64rpx;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-control-radius);
  color: var(--app-text);
  background: var(--app-panel);
}

.cache-actions {
  gap: 12rpx;
  margin-top: 18rpx;
}

.plain-action {
  min-height: 76rpx;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-control-radius);
  color: var(--app-accent);
  background: var(--app-panel);
}

.plain-action.danger {
  color: var(--app-accent-3);
}

.catalog-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
  margin: 30rpx 4rpx 16rpx;
}

.catalog-kicker {
  color: var(--app-accent);
  font-size: 17rpx;
  font-weight: 900;
  letter-spacing: 3rpx;
}

.catalog-title {
  margin-top: 4rpx;
  color: var(--app-text);
  font-family: var(--app-heading-font);
  font-size: 34rpx;
  font-weight: 900;
}

.catalog-count {
  color: var(--app-muted);
  font-size: 20rpx;
}

.chapter-list {
  height: 44vh;
  min-height: 440rpx;
  margin-top: 0;
}

.chapter-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-height: 104rpx;
  padding: 14rpx 18rpx;
  margin-bottom: 12rpx;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-card-radius);
  background: var(--app-panel-strong);
  box-shadow: var(--app-shadow);
}

.chapter-marker {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 60rpx;
  height: 60rpx;
  border-radius: var(--app-control-radius);
  color: var(--app-accent);
  font-family: var(--app-heading-font);
  font-size: 20rpx;
  font-weight: 900;
  background: var(--app-input);
}

.chapter-copy {
  flex: 1;
  min-width: 0;
}

.chapter-title,
.chapter-hint {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chapter-title {
  color: var(--app-text);
  font-family: var(--app-heading-font);
  font-size: 25rpx;
  font-weight: 800;
}

.chapter-hint {
  margin-top: 5rpx;
  color: var(--app-muted);
  font-size: 18rpx;
}

.chapter-state {
  min-width: 88rpx;
  padding: 8rpx 10rpx;
  border: 1rpx solid var(--app-border);
  color: var(--app-muted);
  background: var(--app-input);
}

.chapter-state.cached {
  color: var(--app-on-accent);
  border-color: var(--app-accent);
  background: var(--app-accent);
}

.chapter-state.failed {
  color: var(--app-on-accent);
  border-color: var(--app-accent-3);
  background: var(--app-accent-3);
}

.catalog-empty,
.detail-empty {
  padding: 48rpx 28rpx;
  text-align: center;
}

.catalog-empty text {
  display: block;
  color: var(--app-muted);
  font-size: 23rpx;
}

.catalog-empty button,
.empty-action {
  min-height: 88rpx;
  margin-top: 22rpx;
  border-radius: var(--app-control-radius);
  color: var(--app-on-accent);
  font-size: 24rpx;
  background: var(--app-accent);
}

.detail-empty {
  margin-top: 36rpx;
}

.empty-seal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 94rpx;
  height: 94rpx;
  margin: 0 auto 22rpx;
  border: 2rpx dashed var(--app-accent);
  border-radius: 50%;
  color: var(--app-accent);
  font-size: 38rpx;
  font-weight: 900;
}

.empty-title {
  color: var(--app-text);
  font-family: var(--app-heading-font);
  font-size: 31rpx;
  font-weight: 900;
}

.empty-desc {
  display: block;
  max-width: 500rpx;
  margin: 12rpx auto 0;
  color: var(--app-muted);
  font-size: 22rpx;
  line-height: 34rpx;
}

.action-dock {
  position: fixed;
  z-index: 60;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  grid-template-columns: 0.76fr 1.6fr;
  gap: 14rpx;
  box-sizing: border-box;
  width: 100%;
  max-width: 1120px;
  padding: 18rpx 28rpx calc(18rpx + env(safe-area-inset-bottom));
  margin: 0 auto;
  border-top: 1rpx solid var(--app-border);
  background: var(--app-panel-strong);
  box-shadow: var(--app-floating-shadow);
}

.dock-secondary,
.dock-primary {
  min-height: 92rpx;
  padding: 0 18rpx;
  border-radius: var(--app-control-radius);
  font-size: 25rpx;
  font-weight: 900;
}

.dock-secondary {
  border: 1rpx solid var(--app-border);
  color: var(--app-text);
  background: var(--app-input);
}

.dock-primary {
  color: var(--app-on-accent);
  background: linear-gradient(135deg, var(--app-accent), var(--app-accent-2));
  box-shadow: var(--app-glow);
}

.dock-primary[disabled],
.dock-secondary[disabled] {
  color: var(--app-muted) !important;
  border-color: var(--app-border) !important;
  background: var(--app-panel) !important;
  box-shadow: none !important;
  opacity: 0.58;
}

@keyframes detailPulse {
  0%, 100% { transform: scale(0.92); opacity: 0.62; }
  50% { transform: scale(1); opacity: 1; }
}

@keyframes detailLoading {
  from { transform: translateX(-120%); }
  to { transform: translateX(320%); }
}

@media (max-width: 380px) {
  .source-book-page {
    padding-right: 24rpx;
    padding-left: 24rpx;
  }

  .topbar {
    margin-right: -24rpx;
    margin-left: -24rpx;
  }

  .hero-card {
    gap: 20rpx;
    padding-right: 20rpx;
    padding-left: 20rpx;
  }

  .cover {
    width: 150rpx;
    height: 214rpx;
  }

  .book-title {
    font-size: 34rpx;
    line-height: 43rpx;
  }

  .chapter-state {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .status-orbit.active,
  .status-progress {
    animation: none;
  }
}
</style>
