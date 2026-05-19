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
        <image class="cover-image" v-if="book.coverUrl" :src="book.coverUrl" mode="aspectFill" />
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

    <scroll-view class="chapter-list" scroll-y :show-scrollbar="false" v-if="chapters.length">
      <view
        class="chapter-item"
        v-for="chapter in chapters.slice(0, 80)"
        :key="chapter.index"
        @tap="addAndRead(chapter.index)"
      >
        <text class="chapter-index">{{ chapter.index + 1 }}</text>
        <text class="chapter-title">{{ chapter.title }}</text>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import {
  addOnlineBookToShelf,
  getOnlineBookDraft,
  loadOnlineBookInfo,
  loadOnlineToc
} from '../../common/bookSources.js'
import { getAppThemeId, getAppThemeStyle } from '../../common/appTheme.js'
import {
  addBackendBookWithChapters,
  loadBackendSourceToc
} from '../../common/backendLibrary.js'
import { friendlyErrorMessage } from '../../common/uiFeedback.js'

export default {
  data() {
    return {
      book: null,
      chapters: [],
      loading: false,
      errorMessage: '',
      themeId: getAppThemeId()
    }
  },
  computed: {
    themeVars() {
      return getAppThemeStyle(this.themeId)
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
    async reload() {
      if (!this.book) return
      this.loading = true
      this.errorMessage = ''
      try {
        if (this.book.type === 'backend-online') {
          this.chapters = await loadBackendSourceToc(this.book)
          return
        }
        const info = await loadOnlineBookInfo(this.book)
        const chapters = await loadOnlineToc(info)
        this.book = {
          ...info,
          chapters
        }
        this.chapters = chapters
      } catch (error) {
        this.errorMessage = friendlyErrorMessage(error, '书源解析失败')
      } finally {
        this.loading = false
      }
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
.status-card {
  margin-top: 28rpx;
  padding: 28rpx;
  border: 1rpx solid rgba(103, 255, 242, 0.16);
  border-radius: 30rpx;
  background: var(--app-panel-strong);
  box-shadow: 0 18rpx 50rpx rgba(0, 0, 0, 0.28), inset 0 1rpx 0 rgba(255, 255, 255, 0.08);
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
