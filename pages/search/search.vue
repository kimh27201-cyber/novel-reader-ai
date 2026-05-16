<template>
  <view class="discover-page">
    <view class="top-zone">
      <view class="search-pill">
        <text class="search-icon">⌕</text>
        <input
          class="search-input"
          v-model="keyword"
          placeholder="筛选发现源 / 搜索书名"
          confirm-type="search"
          @confirm="runSearch"
        />
      </view>
      <button class="filter-button" @tap="toggleMode">⌘</button>
    </view>

    <view class="mode-row">
      <button class="mode" :class="{ active: mode === 'online' }" @tap="setMode('online')">在线解码</button>
      <button class="mode" :class="{ active: mode === 'source' }" @tap="setMode('source')">发现源</button>
      <button class="mode" :class="{ active: mode === 'local' }" @tap="setMode('local')">本地</button>
    </view>

    <view class="loading-line" v-if="loading">正在让启用书源解码...</view>

    <scroll-view class="content" scroll-y :show-scrollbar="false">
      <view v-if="mode === 'source'">
        <view class="source-card" v-for="source in filteredSources" :key="source.id">
          <view class="source-name">{{ source.name }}</view>
          <text class="source-desc">{{ source.group }} · {{ source.enabled ? '已启用' : '已停用' }} · {{ source.compatibility }}</text>
          <text class="source-arrow">›</text>
        </view>
      </view>

      <view v-else-if="results.length">
        <view class="result-card" v-for="item in results" :key="`${item.type}-${item.bookId}-${item.title}`" @tap="openResult(item)">
          <view class="result-type">{{ resultTypeLabel(item) }}</view>
          <view class="result-title">{{ item.title }}</view>
          <text class="result-subtitle">{{ item.subtitle }}</text>
          <text class="result-snippet">{{ item.snippet }}</text>
        </view>
      </view>

      <view class="source-list" v-else>
        <view class="source-entry" v-for="entry in starterSources" :key="entry" @tap="useStarter(entry)">
          <text>{{ entry }}</text>
          <text class="source-arrow">›</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { searchBooks } from '../../common/books.js'
import { getSourceConfigs, saveOnlineBookDraft, searchOnlineBooks } from '../../common/bookSources.js'
import { getTrackedBook, openTrackedBook, searchTrackedBooks } from '../../common/tracking.js'
import apiClient from '../../common/apiClient.js'
import { searchBackendBooks } from '../../common/backendLibrary.js'

export default {
  data() {
    return {
      mode: 'source',
      keyword: '',
      results: [],
      sources: [],
      loading: false,
      searchToken: 0,
      starterSources: ['笔趣阁', '第一版主', 'QQ阅读器柳树', '爱去小说', '八叉书库', '书山聚合', '木里阅读公益版', '乐乐', '订阅源', '晋江文学', 'UAA小说', '365小说网']
    }
  },
  computed: {
    filteredSources() {
      const word = String(this.keyword || '').trim().toLowerCase()
      if (!word) return this.sources
      return this.sources.filter(source => {
        return [source.name, source.group, source.compatibility].join(' ').toLowerCase().includes(word)
      })
    }
  },
  onShow() {
    this.sources = getSourceConfigs()
  },
  methods: {
    setMode(mode) {
      this.mode = mode
      this.results = []
      if (mode !== 'source' && this.keyword) this.runSearch()
    },
    toggleMode() {
      this.setMode(this.mode === 'source' ? 'online' : 'source')
    },
    useStarter(keyword) {
      this.keyword = keyword.replace(/^[^\u4e00-\u9fa5A-Za-z0-9]+/, '')
      this.setMode('online')
    },
    async runSearch() {
      const word = String(this.keyword || '').trim()
      const token = Date.now()
      this.searchToken = token
      if (!word) {
        this.results = []
        return
      }

      if (this.mode === 'online') {
        this.loading = true
        try {
          const results = apiClient.getToken()
            ? await searchBackendBooks(word)
            : await searchOnlineBooks(word)
          if (this.searchToken === token) this.results = results
        } catch (error) {
          if (this.searchToken === token) {
            this.results = []
            uni.showToast({ title: error.message || '解码失败', icon: 'none' })
          }
        } finally {
          if (this.searchToken === token) this.loading = false
        }
        return
      }

      this.results = this.mode === 'local' ? searchBooks(word) : searchTrackedBooks(word)
    },
    openResult(item) {
      if (item.type === 'online' || item.type === 'backend-online') {
        saveOnlineBookDraft(item.type === 'backend-online' ? item : item.book)
        uni.navigateTo({ url: '/pages/sourceBook/sourceBook' })
        return
      }
      if (item.type === 'source-error') {
        uni.showToast({ title: item.snippet || '书源不可用', icon: 'none' })
        return
      }
      if (item.type === 'tracking') {
        const book = getTrackedBook(item.bookId)
        try {
          const result = openTrackedBook(book)
          if (result === 'copied') uni.showToast({ title: '预览模式已复制链接', icon: 'none' })
        } catch (error) {
          uni.showToast({ title: error.message || '无法打开链接', icon: 'none' })
        }
        return
      }
      uni.navigateTo({
        url: `/pages/reader/reader?bookId=${item.bookId}&chapterIndex=${item.chapterIndex || 0}&pageIndex=0`
      })
    },
    resultTypeLabel(item) {
      if (item.type === 'backend-online') return '云端'
      if (item.type === 'online') return '解码'
      if (item.type === 'source-error') return '失败'
      if (item.type === 'tracking') return '链接'
      return item.type === 'book' ? '书籍' : '章节'
    }
  }
}
</script>

<style>
.discover-page {
  min-height: 100vh;
  padding: 86rpx 40rpx 132rpx;
  background: #1f1f1f;
}

button::after {
  border: 0;
}

.top-zone {
  display: grid;
  grid-template-columns: 1fr 78rpx;
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

.search-icon {
  margin-right: 12rpx;
  color: rgba(255, 255, 255, 0.72);
  font-size: 32rpx;
}

.search-input {
  flex: 1;
  height: 74rpx;
  color: #ffffff;
  font-family: cursive;
  font-size: 30rpx;
}

.filter-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 78rpx;
  height: 78rpx;
  padding: 0;
  color: #ffffff;
  font-size: 54rpx;
  background: transparent;
}

.mode-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-bottom: 28rpx;
}

.mode {
  height: 62rpx;
  padding: 0;
  border-radius: 999rpx;
  color: #cfcfcf;
  font-size: 25rpx;
  background: #2c2c2c;
}

.mode.active {
  color: #ffffff;
  background: #d44b2f;
}

.loading-line {
  margin-bottom: 18rpx;
  color: #bbbbbb;
  font-size: 24rpx;
}

.content {
  height: calc(100vh - 300rpx);
}

.source-card,
.source-entry,
.result-card {
  position: relative;
  min-height: 86rpx;
  padding: 22rpx 78rpx 22rpx 28rpx;
  margin-bottom: 24rpx;
  border-radius: 14rpx;
  background: #2d2d2d;
}

.source-entry {
  display: flex;
  align-items: center;
  color: #f2f2f2;
  font-family: cursive;
  font-size: 33rpx;
}

.source-name,
.result-title {
  overflow: hidden;
  color: #ffffff;
  font-family: cursive;
  font-size: 32rpx;
  line-height: 42rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-desc,
.result-subtitle,
.result-snippet {
  display: block;
  margin-top: 8rpx;
  color: #ababab;
  font-size: 23rpx;
  line-height: 34rpx;
}

.source-arrow {
  position: absolute;
  right: 34rpx;
  top: 50%;
  color: #c8c8c8;
  font-size: 64rpx;
  line-height: 1;
  transform: translateY(-50%);
}

.result-type {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 74rpx;
  height: 36rpx;
  padding: 0 14rpx;
  margin-bottom: 12rpx;
  border-radius: 999rpx;
  color: #ffffff;
  font-size: 21rpx;
  background: #d44b2f;
}

/* Ink theme polish */
.discover-page {
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

.mode,
.source-card,
.source-entry,
.result-card {
  border: 1rpx solid rgba(255, 255, 255, 0.05);
  background: rgba(47, 48, 45, 0.92);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.035);
}

.mode.active,
.result-type {
  background: #d85a3a;
}

.source-name,
.source-entry,
.result-title,
.search-input {
  font-family: "KaiTi", "STKaiti", "FZKai-Z03", "PingFang SC", cursive;
}

.source-desc,
.result-subtitle,
.result-snippet {
  color: #a9aaa4;
}
</style>
