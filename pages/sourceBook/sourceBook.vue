<template>
  <view class="source-book-page app-page secondary" :style="themeVars">
    <view class="topbar">
      <button class="back-button" @tap="goBack">‹</button>
      <view>
        <text class="eyebrow">ONLINE SOURCE</text>
        <view class="title">书源详情</view>
      </view>
    </view>

    <view class="hero-card" v-if="book">
      <view class="cover">
        <image class="cover-image" v-if="book.coverUrl" :src="book.coverUrl" mode="aspectFill" lazy-load />
        <text v-else>{{ shortTitle(book.title) }}</text>
      </view>
      <view class="hero-copy">
        <view class="book-title">{{ book.title }}</view>
        <text class="book-meta">{{ book.author }} · {{ book.sourceName }}</text>
        <text class="book-desc">{{ book.intro || book.latestChapter || '等待解析详情和目录' }}</text>
      </view>
    </view>

    <view class="status-card">
      <view class="status-title">{{ loading ? '正在解析书源' : `${chapters.length} 章已识别` }}</view>
      <text class="status-desc">{{ errorMessage || 'v1 不执行 JS、登录、Cookie 或付费绕过规则；如果目录为空，可以换一个书源。' }}</text>
    </view>

    <view class="actions" v-if="book">
      <button class="plain-action" @tap="reload">重新解析</button>
      <button class="primary-action" :disabled="!chapters.length" @tap="addAndRead">加入书架</button>
    </view>

    <view class="cache-card" v-if="book">
      <view class="cache-head">
        <view>
          <view class="cache-title">章节缓存</view>
          <text class="cache-desc">已缓存 {{ cacheStats.cachedChapters }} 章 · {{ cacheStats.totalChars }} 字</text>
        </view>
        <switch :checked="cacheSettings.offlineMode" color="#7cc1b6" @change="toggleOfflineMode" />
      </view>
      <view class="cache-grid">
        <view class="cache-field">
          <text>预加载</text>
          <view class="cache-stepper">
            <button @tap="adjustCacheSetting('preloadCount', -1)">-</button>
            <text>{{ cacheSettings.preloadCount }}</text>
            <button @tap="adjustCacheSetting('preloadCount', 1)">+</button>
          </view>
        </view>
        <view class="cache-field">
          <text>容量</text>
          <view class="cache-stepper">
            <button @tap="adjustCacheSetting('maxChapters', -10)">-</button>
            <text>{{ cacheSettings.maxChapters }}</text>
            <button @tap="adjustCacheSetting('maxChapters', 10)">+</button>
          </view>
        </view>
      </view>
      <view class="cache-actions">
        <button class="plain-action" @tap="exportCachedTxt">导出 TXT</button>
        <button class="plain-action" @tap="clearCache">清理缓存</button>
      </view>
      <text class="cache-desc">{{ cacheSettings.offlineMode ? '离线模式：只读取已缓存章节' : '在线模式：阅读时自动预加载后续章节' }}</text>
    </view>

    <scroll-view class="chapter-list" scroll-y :show-scrollbar="false" v-if="chapters.length" @scrolltolower="loadMoreChapters">
      <view
        class="chapter-item"
        v-for="chapter in visibleChapters"
        :key="chapter.index"
        @tap="addAndRead(chapter.index)"
      >
        <text class="chapter-index">{{ chapter.index + 1 }}</text>
        <text class="chapter-title">{{ chapter.title }}</text>
        <text class="chapter-state" :class="chapterStateClass(chapter)">{{ chapterStateLabel(chapter) }}</text>
      </view>
    </scroll-view>
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
    }
  },
  onLoad() {
    this.themeId = getAppThemeId()
    this.book = getOnlineBookDraft()
    if (!this.book) {
      this.errorMessage = '没有找到搜索结果，请返回重新搜索。'
      return
    }
    this.reload()
  },
  onShow() {
    this.themeId = getAppThemeId()
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
      if (!this.book || !this.chapters.length) return
      try {
        const book = this.book.type === 'backend-online'
          ? await addBackendBookWithChapters(this.book, this.chapters)
          : addOnlineBookToShelf({
              ...this.book,
              chapters: this.chapters
            })
        this.book = book
        this.refreshCacheStats()
        uni.showToast({ title: '已加入书架', icon: 'none' })
        uni.navigateTo({
          url: `/pages/reader/reader?bookId=${book.id}&chapterIndex=${Number(chapterIndex) || 0}&pageIndex=0`
        })
      } catch (error) {
        uni.showToast({ title: friendlyErrorMessage(error, '加入书架失败'), icon: 'none' })
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
  background: #60757d;
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
    linear-gradient(180deg, #20211f 0%, #1b1c1a 100%);
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
</style>
