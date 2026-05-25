<template>
  <view class="decoder-page app-page" :style="themeVars">
    <view class="top-zone">
      <view class="shelf-filter-active">
        <text>全部</text>
      </view>
      <button class="top-search-button" @tap="goSearch">⌕</button>
      <button class="top-more-button" @tap="moreMenuVisible = !moreMenuVisible">⋮</button>
    </view>

    <view class="more-menu" v-if="moreMenuVisible">
      <button class="menu-item" @tap="openTool('discover')">发现书源</button>
      <button class="menu-item" @tap="openTool('import')">导入 TXT</button>
      <button class="menu-item" @tap="openTool('aiHistory')">AI 记录</button>
      <button class="menu-item" @tap="openTool('cloud')">后端与设置</button>
    </view>

    <view class="tool-grid">
      <view class="tool" v-for="tool in tools" :key="tool.id" @tap="openTool(tool.id)">
        <view class="tool-icon" :class="tool.id">
          <text>{{ tool.icon }}</text>
        </view>
        <view class="tool-copy">
          <text class="tool-name">{{ tool.name }}</text>
          <text class="tool-desc">{{ tool.desc }}</text>
        </view>
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
import { friendlyErrorMessage } from '../../common/uiFeedback.js'

export default {
  data() {
    return {
      books: [],
      sources: [],
      moreMenuVisible: false,
      themeId: getAppThemeId(),
      tools: [
        { id: 'discover', name: '发现书源', desc: '搜索并加入云端书架', icon: '⌕' },
        { id: 'import', name: '导入 TXT', desc: '本地文本目录识别', icon: 'TXT' },
        { id: 'cloud', name: '后端登录', desc: '启用 AI 与云同步', icon: '☁' },
        { id: 'aiHistory', name: 'AI 记录', desc: '总结与问答历史', icon: 'AI' },
        { id: 'help', name: '演示说明', desc: '5 分钟项目流程', icon: '?' }
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
    openTool(id) {
      if (id === 'discover') {
        this.goSearch()
        return
      }
      if (id === 'import') {
        this.goLibrary()
        return
      }
      if (id === 'aiHistory') {
        uni.navigateTo({ url: '/pages/aiHistory/aiHistory' })
        return
      }
      if (id === 'help') {
        uni.showToast({ title: '导入书源后，在发现页搜索并加入书架', icon: 'none' })
        return
      }
      this.goProfile()
    },
    goSearch() {
      uni.switchTab({ url: '/pages/search/search' })
    },
    goLibrary() {
      uni.switchTab({ url: '/pages/library/library' })
    },
    goProfile() {
      uni.switchTab({ url: '/pages/profile/profile' })
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
  right: 28rpx;
  top: 122rpx;
  width: 260rpx;
  overflow: hidden;
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  border-radius: 16rpx;
  background: rgba(42, 43, 42, 0.98);
  box-shadow: 0 22rpx 52rpx rgba(0, 0, 0, 0.34);
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  height: 72rpx;
  padding: 0 24rpx;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.06);
  color: #f2f5f4;
  font-size: 25rpx;
  text-align: left;
  background: transparent;
}

.menu-item:active {
  background: rgba(226, 95, 53, 0.16);
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18rpx;
  margin-top: 34rpx;
}

.tool {
  display: flex;
  align-items: center;
  min-height: 132rpx;
  padding: 20rpx;
  border-radius: 18rpx;
}

.tool:nth-child(5) {
  grid-column: 1 / -1;
}

.tool-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 86rpx;
  height: 86rpx;
  overflow: hidden;
  border-radius: 18rpx;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 900;
  background: linear-gradient(180deg, #505050 0%, #242424 100%);
}

.tool-icon.repo {
  color: #a9f060;
  font-size: 34rpx;
  background: linear-gradient(180deg, #222 0%, #070707 100%);
}

.tool-icon.import {
  color: #ffffff;
  font-size: 22rpx;
  background: linear-gradient(145deg, #2d79ff, #1c52d6);
}

.tool-icon.cloud {
  color: #fff2df;
  background: #050505;
}

.tool-copy {
  min-width: 0;
  flex: 1;
  margin-left: 18rpx;
}

.tool-name {
  display: block;
  overflow: hidden;
  color: #d4d4d4;
  font-family: cursive;
  font-size: 30rpx;
  font-weight: 900;
  line-height: 38rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-desc {
  display: block;
  overflow: hidden;
  margin-top: 8rpx;
  color: #a8a8a8;
  font-size: 23rpx;
  line-height: 32rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  line-height: 1;
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

/* Global app theme */
.decoder-page {
  color: var(--app-text);
  background: var(--app-bg);
}

.top-zone {
  background: var(--app-top);
  box-shadow: var(--app-shadow);
}

.tool-icon,
.book-row,
.empty-box {
  border-color: var(--app-border);
  background: var(--app-panel-strong);
  box-shadow: var(--app-shadow);
}

.top-search-button,
.top-more-button,
.book-title,
.empty-title,
.tab.active {
  color: var(--app-text);
}

.tool-name,
.tab,
.meta-line,
.empty-desc {
  color: var(--app-muted);
}

.meta-icon,
.chapter-badge,
.mini-action {
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.tool-icon.repo,
.tool-icon.import,
.tool-icon.cloud {
  color: var(--app-on-accent);
  background: linear-gradient(145deg, var(--app-accent) 0%, var(--app-accent-2) 100%);
}

.cover-wrap {
  background: linear-gradient(145deg, var(--app-accent) 0%, var(--app-accent-3) 100%);
}

.tool {
  border: 1rpx solid var(--app-border);
  background: var(--app-panel-strong);
  box-shadow: var(--app-shadow);
}

.tool-desc {
  color: var(--app-muted);
}
</style>
