<template>
  <view class="detail-page" :style="themeVars">
    <view class="topbar">
      <button class="back-button" @tap="goBack">‹</button>
      <view>
        <text class="eyebrow">TRACK NOTE</text>
        <view class="title">追书详情</view>
      </view>
    </view>

    <view class="hero-card" v-if="book">
      <view class="book-cover">
        <text>{{ shortTitle(book.title) }}</text>
      </view>
      <view class="hero-copy">
        <view class="book-title">{{ book.title }}</view>
        <text class="book-meta">正版入口 · {{ book.platform }}</text>
        <view class="tag-row">
          <text class="tag">{{ book.platform }}</text>
          <text class="tag status">平台搜索</text>
        </view>
      </view>
    </view>

    <view class="info-grid" v-if="book">
      <view class="info-card">
        <text class="info-label">最近打开</text>
        <view class="info-value">{{ formatTime(book.openedAt) }}</view>
      </view>
      <view class="info-card">
        <text class="info-label">记录方式</text>
        <view class="info-value">书名 + 平台</view>
      </view>
    </view>

    <view class="link-card" v-if="book">
      <view class="note-title">正版入口</view>
      <text class="link-text">{{ targetUrl }}</text>
    </view>

    <view class="actions" v-if="book">
      <button class="primary-action" @tap="openOfficial">继续看</button>
      <button class="plain-action" @tap="copyLink">复制链接</button>
    </view>

    <view class="empty" v-else>
      <view class="empty-title">没有找到追书记录</view>
      <text class="empty-desc">这条记录可能已被删除。</text>
    </view>
  </view>
</template>

<script>
import { buildTrackingTarget, getTrackedBook, openTrackedBook } from '../../common/tracking.js'
import { getAppThemeId, getAppThemeStyle } from '../../common/appTheme.js'

export default {
  data() {
    return {
      bookId: '',
      book: null,
      targetUrl: '',
      themeId: getAppThemeId()
    }
  },
  computed: {
    themeVars() {
      return getAppThemeStyle(this.themeId)
    }
  },
  onLoad(query) {
    this.bookId = query.bookId || ''
    this.themeId = getAppThemeId()
    this.loadBook()
  },
  methods: {
    loadBook() {
      this.book = getTrackedBook(this.bookId)
      if (!this.book) return
      try {
        this.targetUrl = buildTrackingTarget(this.book).url
      } catch (error) {
        this.targetUrl = this.book.url || ''
      }
    },
    shortTitle(title) {
      return String(title || '').slice(0, 4)
    },
    formatTime(value) {
      if (!value) return '暂未打开'
      const date = new Date(value)
      const month = `${date.getMonth() + 1}`.padStart(2, '0')
      const day = `${date.getDate()}`.padStart(2, '0')
      const hour = `${date.getHours()}`.padStart(2, '0')
      const minute = `${date.getMinutes()}`.padStart(2, '0')
      return `${month}-${day} ${hour}:${minute}`
    },
    goBack() {
      uni.navigateBack()
    },
    openOfficial() {
      try {
        const result = openTrackedBook(this.book)
        this.loadBook()
        if (result === 'copied') {
          uni.showToast({ title: '预览模式已复制链接', icon: 'none' })
        }
      } catch (error) {
        uni.showToast({ title: error.message || '无法打开链接', icon: 'none' })
      }
    },
    copyLink() {
      if (!this.targetUrl) {
        uni.showToast({ title: '暂无可复制链接', icon: 'none' })
        return
      }
      uni.setClipboardData({
        data: this.targetUrl,
        success: () => {
          uni.showToast({ title: '链接已复制', icon: 'none' })
        }
      })
    }
  }
}
</script>

<style>
.detail-page {
  min-height: 100vh;
  padding: 58rpx 32rpx 120rpx;
  background: linear-gradient(180deg, #f7f0e2 0%, #ece7d7 45%, #dfe9e3 100%);
}

.topbar,
.hero-card,
.tag-row,
.actions {
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
  color: #26332f;
  font-size: 48rpx;
  line-height: 68rpx;
  background: rgba(255, 255, 255, 0.86);
}

button::after {
  border: 0;
}

.eyebrow {
  color: #748178;
  font-size: 22rpx;
  font-weight: 800;
}

.title {
  margin-top: 6rpx;
  color: #1f251f;
  font-size: 48rpx;
  font-weight: 900;
}

.hero-card,
.note-card,
.link-card,
.empty {
  margin-top: 28rpx;
  padding: 28rpx;
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 18rpx 42rpx rgba(48, 58, 48, 0.08);
}

.hero-card {
  gap: 24rpx;
}

.book-cover {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  flex-shrink: 0;
  width: 150rpx;
  height: 210rpx;
  padding: 18rpx 12rpx;
  border-radius: 16rpx;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 900;
  line-height: 38rpx;
  text-align: center;
  background: linear-gradient(155deg, #5d756d 0%, #9a8a62 100%);
  box-shadow: inset 10rpx 0 0 rgba(255, 255, 255, 0.12), 0 16rpx 26rpx rgba(34, 31, 27, 0.16);
}

.hero-copy {
  min-width: 0;
  flex: 1;
}

.book-title {
  color: #1f251f;
  font-size: 40rpx;
  font-weight: 900;
  line-height: 50rpx;
}

.book-meta {
  display: block;
  margin-top: 8rpx;
  color: #747a71;
  font-size: 24rpx;
}

.tag-row {
  gap: 10rpx;
  margin-top: 18rpx;
  flex-wrap: wrap;
}

.tag {
  height: 42rpx;
  padding: 0 14rpx;
  border-radius: 999rpx;
  color: #31584f;
  font-size: 21rpx;
  line-height: 42rpx;
  background: #e7f0eb;
}

.tag.status {
  color: #8a6a40;
  background: #f1eadc;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
  margin-top: 18rpx;
}

.info-card {
  padding: 22rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.72);
}

.info-label {
  color: #748178;
  font-size: 22rpx;
}

.info-value {
  margin-top: 8rpx;
  color: #26332f;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 38rpx;
}

.note-title {
  color: #26332f;
  font-size: 28rpx;
  font-weight: 900;
}

.note-text,
.link-text,
.empty-desc {
  display: block;
  margin-top: 12rpx;
  color: #737d76;
  font-size: 25rpx;
  line-height: 38rpx;
  word-break: break-all;
}

.actions {
  gap: 16rpx;
  margin-top: 22rpx;
}

.primary-action,
.plain-action {
  flex: 1;
  height: 86rpx;
  padding: 0;
  border-radius: 20rpx;
  font-size: 28rpx;
}

.primary-action {
  color: #ffffff;
  background: #31584f;
}

.plain-action {
  color: #31584f;
  background: rgba(255, 255, 255, 0.78);
}

.empty {
  text-align: center;
}

.empty-title {
  color: #26332f;
  font-size: 32rpx;
  font-weight: 900;
}

/* Neon theme override */
.detail-page {
  background:
    linear-gradient(132deg, rgba(57, 215, 255, 0.10), transparent 34%),
    linear-gradient(226deg, rgba(157, 108, 255, 0.16), transparent 38%),
    linear-gradient(180deg, #050712 0%, #090d1c 50%, #061119 100%);
}

.eyebrow {
  color: #67fff2;
  text-shadow: 0 0 18rpx rgba(103, 255, 242, 0.32);
}

.title,
.book-title,
.note-title,
.info-value,
.empty-title {
  color: #f4f9ff;
}

.book-meta,
.info-label,
.note-text,
.link-text,
.empty-desc {
  color: #8ba0c2;
}

.back-button,
.hero-card,
.note-card,
.link-card,
.empty,
.info-card,
.plain-action,
.primary-action {
  border: 1rpx solid rgba(103, 255, 242, 0.16);
  background: rgba(15, 23, 44, 0.76);
  box-shadow: 0 18rpx 50rpx rgba(0, 0, 0, 0.28), inset 0 1rpx 0 rgba(255, 255, 255, 0.08);
}

.back-button {
  color: #67fff2;
  line-height: 1;
}

.book-cover {
  background: linear-gradient(155deg, #111b3f 0%, #226dff 44%, #9d55ff 100%);
  box-shadow: inset 10rpx 0 0 rgba(255, 255, 255, 0.12), 0 0 34rpx rgba(57, 215, 255, 0.24);
}

.tag {
  color: #67fff2;
  background: rgba(103, 255, 242, 0.12);
}

.tag.status {
  color: #ff72f6;
  background: rgba(255, 114, 246, 0.12);
}

.primary-action {
  color: #061019;
  background: linear-gradient(135deg, #67fff2 0%, #39d7ff 50%, #9d6cff 100%);
  box-shadow: 0 0 30rpx rgba(57, 215, 255, 0.26);
}

.plain-action {
  color: #67fff2;
}

.detail-page {
  background: var(--app-bg);
}

.eyebrow,
.back-button,
.plain-action {
  color: var(--app-accent);
}

.title,
.book-title,
.note-title,
.info-value,
.empty-title {
  color: var(--app-text);
}

.book-meta,
.info-label,
.note-text,
.link-text,
.empty-desc {
  color: var(--app-muted);
}

.back-button,
.hero-card,
.note-card,
.link-card,
.empty,
.info-card,
.plain-action {
  background: var(--app-panel);
}

.book-cover {
  background: linear-gradient(155deg, #09142d 0%, var(--app-accent-2) 46%, var(--app-accent-3) 100%);
}

.primary-action {
  background: linear-gradient(135deg, var(--app-accent) 0%, var(--app-accent-2) 50%, var(--app-accent-3) 100%);
}
</style>
