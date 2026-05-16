<template>
  <view class="decoder-page" :style="themeVars">
    <view class="top-zone">
      <view class="search-pill" @tap="goSearch">
        <text class="search-icon">⌕</text>
        <text class="search-text">解码一本书</text>
      </view>
      <button class="top-icon" @tap="goRecent">◷</button>
      <button class="top-icon star" @tap="goLibrary">★</button>
      <button class="top-icon" @tap="goSearch">⌘</button>
      <button class="top-icon" @tap="goProfile">⚙</button>
    </view>

    <view class="tool-grid">
      <view class="tool" v-for="tool in tools" :key="tool.id" @tap="openTool(tool.id)">
        <view class="tool-icon" :class="tool.id">
          <text>{{ tool.icon }}</text>
        </view>
        <text class="tool-name">{{ tool.name }}</text>
      </view>
    </view>

    <view class="shelf-head">
      <view class="tab-line">
        <text class="tab active">全部</text>
        <text class="tab">在线</text>
        <text class="tab">TXT</text>
      </view>
      <button class="mini-action" @tap="goSearch">搜索</button>
    </view>

    <scroll-view class="book-list" scroll-y :show-scrollbar="false">
      <view class="book-row" v-for="book in books" :key="book.id" @tap="openBook(book)">
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
import { getBooks } from '../../common/books.js'
import { getProgress } from '../../common/reader.js'
import { getSourceConfigs } from '../../common/bookSources.js'
import { getAppThemeId, getAppThemeStyle } from '../../common/appTheme.js'
import apiClient from '../../common/apiClient.js'
import { listBackendBooks } from '../../common/backendLibrary.js'

export default {
  data() {
    return {
      books: [],
      sources: [],
      themeId: getAppThemeId(),
      tools: [
        { id: 'rules', name: '规则订阅', icon: '阅' },
        { id: 'help', name: '使用说明', icon: '读' },
        { id: 'repo', name: '源仓库', icon: 'M' },
        { id: 'import', name: '导入', icon: '↓' },
        { id: 'cloud', name: 'Meow云', icon: '☁' }
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
        uni.showToast({ title: error.message || '云端书架加载失败', icon: 'none' })
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
    openTool(id) {
      if (id === 'repo' || id === 'rules' || id === 'import') {
        this.goLibrary()
        return
      }
      if (id === 'help') {
        uni.showToast({ title: '导入书源后，在发现页搜索并加入书架', icon: 'none' })
        return
      }
      uni.showToast({ title: '云同步稍后接入', icon: 'none' })
    },
    goSearch() {
      uni.switchTab({ url: '/pages/search/search' })
    },
    goLibrary() {
      uni.switchTab({ url: '/pages/library/library' })
    },
    goProfile() {
      uni.switchTab({ url: '/pages/profile/profile' })
    },
    goRecent() {
      uni.showToast({ title: `${this.books.length} 本书 · ${this.sources.filter(item => item.enabled).length} 个启用源`, icon: 'none' })
    }
  }
}
</script>

<style>
.decoder-page {
  min-height: 100vh;
  overflow: hidden;
  padding: 86rpx 40rpx 132rpx;
  background: #1f1f1f;
}

button::after {
  border: 0;
}

.top-zone {
  display: grid;
  grid-template-columns: 1fr 78rpx 78rpx 78rpx 78rpx;
  align-items: center;
  gap: 24rpx;
  min-height: 116rpx;
  margin: -86rpx -40rpx 34rpx;
  padding: 86rpx 40rpx 28rpx;
  background: #60757d;
}

.search-pill {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 74rpx;
  padding: 0 28rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.10);
}

.search-icon,
.search-text {
  color: rgba(255, 255, 255, 0.72);
  font-size: 32rpx;
}

.search-text {
  margin-left: 12rpx;
  font-family: cursive;
}

.top-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 78rpx;
  height: 78rpx;
  padding: 0;
  color: #ffffff;
  font-size: 54rpx;
  line-height: 1;
  background: transparent;
}

.top-icon.star {
  color: #ffffff;
  font-size: 62rpx;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  row-gap: 74rpx;
  margin-top: 42rpx;
}

.tool {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tool-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 124rpx;
  height: 124rpx;
  overflow: hidden;
  border-radius: 28rpx;
  color: #ffffff;
  font-size: 48rpx;
  font-weight: 900;
  background: linear-gradient(180deg, #505050 0%, #242424 100%);
}

.tool-icon.repo {
  color: #a9f060;
  font-size: 76rpx;
  background: linear-gradient(180deg, #222 0%, #070707 100%);
}

.tool-icon.import {
  color: #ffffff;
  font-size: 72rpx;
  background: linear-gradient(145deg, #2d79ff, #1c52d6);
}

.tool-icon.cloud {
  color: #fff2df;
  background: #050505;
}

.tool-name {
  margin-top: 28rpx;
  color: #d4d4d4;
  font-family: cursive;
  font-size: 32rpx;
  line-height: 38rpx;
}

.shelf-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 76rpx;
}

.tab-line {
  display: flex;
  align-items: center;
  gap: 42rpx;
}

.tab {
  color: #bcbcbc;
  font-family: cursive;
  font-size: 30rpx;
}

.tab.active {
  color: #ffffff;
}

.mini-action {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 56rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  color: #ffffff;
  font-size: 24rpx;
  background: #3a3a3a;
}

.book-list {
  height: calc(100vh - 560rpx);
  margin-top: 28rpx;
}

.book-row {
  position: relative;
  display: flex;
  align-items: flex-start;
  min-height: 236rpx;
  margin-bottom: 28rpx;
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
  min-width: 72rpx;
  height: 48rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  color: #f4f4f4;
  font-family: cursive;
  font-size: 28rpx;
  line-height: 48rpx;
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

.search-pill {
  background: rgba(255, 255, 255, 0.13);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.08);
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

.tool-name,
.tab,
.book-title,
.meta-line,
.empty-title {
  font-family: "KaiTi", "STKaiti", "FZKai-Z03", "PingFang SC", cursive;
}

.chapter-badge,
.mini-action {
  background: rgba(255, 255, 255, 0.10);
}

.tab.active {
  color: #f4f0e8;
}
</style>
