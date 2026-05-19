<template>
  <view class="discover-page app-page" :style="themeVars">
    <view class="top-zone">
      <view>
        <text class="eyebrow">DISCOVER</text>
        <view class="title">发现阅读</view>
      </view>
      <text class="top-note">{{ modeHint }}</text>
    </view>

    <view class="search-panel">
      <view class="search-pill">
        <text class="search-icon">⌕</text>
        <input
          class="search-input"
          v-model="keyword"
          :placeholder="searchPlaceholder"
          confirm-type="search"
          @confirm="runSearch"
        />
      </view>
      <button class="search-button" @tap="runSearch">搜索</button>
    </view>

    <view class="mode-row">
      <button class="mode" :class="{ active: mode === 'cloud' }" @tap="setMode('cloud')">云端</button>
      <button class="mode" :class="{ active: mode === 'source' }" @tap="setMode('source')">书源</button>
      <button class="mode" :class="{ active: mode === 'local' }" @tap="setMode('local')">本地</button>
    </view>

    <view class="tip-card" v-if="mode === 'cloud'">
      <view class="tip-title">优先搜索后端演示源</view>
      <text class="tip-desc">登录后走 FastAPI 后端书源；未登录时只搜索最多 3 个启用外部源，避免长时间等待。</text>
    </view>

    <scroll-view class="content" scroll-y :show-scrollbar="false">
      <view v-if="mode === 'source'">
        <view class="section-head">
          <view>
            <view class="section-title">书源管理</view>
            <text class="section-desc">点击按钮启用或停用书源，不会自动跳转搜索。</text>
          </view>
          <text class="source-count">{{ enabledSourceCount }}/{{ sources.length }} 已启用</text>
        </view>

        <view class="source-card" v-for="source in filteredSources" :key="source.id">
          <view class="source-main">
            <view class="source-name">{{ source.name }}</view>
            <text class="source-desc">{{ source.group }} · {{ source.compatibility }}</text>
          </view>
          <button class="source-action" :class="{ active: source.enabled }" @tap.stop="toggleSource(source)">
            {{ source.enabled ? '停用' : '启用' }}
          </button>
        </view>
      </view>

      <view v-else>
        <view class="loading-card" v-if="loading">
          <view class="loading-dot"></view>
          <view>
            <view class="loading-title">{{ mode === 'cloud' ? '正在搜索云端书源' : '正在搜索本地书架' }}</view>
            <text class="loading-desc">{{ mode === 'cloud' ? '演示建议搜索“星轨图书馆”，外部源最多等待 5 秒。' : '本地搜索只查已加入书架的 TXT 和云端书籍缓存。' }}</text>
          </view>
        </view>

        <view v-if="results.length">
          <view class="result-card" v-for="item in results" :key="`${item.type}-${item.bookId}-${item.title}`" @tap="openResult(item)">
            <view class="result-top">
              <view class="result-type">{{ resultTypeLabel(item) }}</view>
              <text class="result-action">查看</text>
            </view>
            <view class="result-title">{{ item.title }}</view>
            <text class="result-subtitle">{{ item.subtitle }}</text>
            <text class="result-snippet">{{ item.snippet }}</text>
          </view>
        </view>

        <view class="empty-state" v-else-if="!loading">
          <view class="empty-title">{{ mode === 'cloud' ? '搜索一本云端小说' : '搜索本地书架' }}</view>
          <text class="empty-desc">{{ mode === 'cloud' ? '输入书名开始搜索，演示流程推荐使用“星轨图书馆”。' : '本地模式只查已经导入或加入书架的书籍。' }}</text>
          <view class="starter-grid" v-if="mode === 'cloud'">
            <button class="starter" v-for="entry in starterKeywords" :key="entry" @tap="useStarter(entry)">
              {{ entry }}
            </button>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { searchBooks } from '../../common/books.js'
import { getSourceConfigs, saveOnlineBookDraft, searchOnlineBooks, setSourceEnabled } from '../../common/bookSources.js'
import apiClient from '../../common/apiClient.js'
import { searchBackendBooks } from '../../common/backendLibrary.js'
import { buildSourceToggleState, demoSearchKeywords, sanitizeSearchKeyword } from '../../common/searchHelpers.js'
import { getAppThemeId, getAppThemeStyle } from '../../common/appTheme.js'
import { friendlyErrorMessage } from '../../common/uiFeedback.js'

export default {
  data() {
    return {
      mode: 'cloud',
      keyword: '',
      results: [],
      sources: [],
      loading: false,
      searchToken: 0,
      themeId: getAppThemeId(),
      starterKeywords: demoSearchKeywords
    }
  },
  computed: {
    themeVars() {
      return getAppThemeStyle(this.themeId)
    },
    filteredSources() {
      const word = sanitizeSearchKeyword(this.keyword).toLowerCase()
      if (!word) return this.sources
      return this.sources.filter(source => {
        return [source.name, source.group, source.compatibility].join(' ').toLowerCase().includes(word)
      })
    },
    enabledSourceCount() {
      return this.sources.filter(source => source.enabled).length
    },
    modeHint() {
      if (this.mode === 'source') return '管理外部书源'
      if (this.mode === 'local') return '只查本地书架'
      return '后端云端优先'
    },
    searchPlaceholder() {
      if (this.mode === 'source') return '筛选书源名称'
      if (this.mode === 'local') return '搜索本地书名'
      return '搜索书名，例如：星轨图书馆'
    }
  },
  onShow() {
    this.themeId = getAppThemeId()
    this.sources = getSourceConfigs()
  },
  methods: {
    setMode(mode) {
      this.mode = mode
      this.results = []
      this.loading = false
      if (mode === 'local' && this.keyword) this.runSearch()
    },
    useStarter(keyword) {
      this.keyword = sanitizeSearchKeyword(keyword)
      this.mode = 'cloud'
      this.runSearch()
    },
    toggleSource(source) {
      const state = buildSourceToggleState(source)
      if (state.sourceId) {
        setSourceEnabled(state.sourceId, state.nextEnabled)
        this.sources = getSourceConfigs()
      }
      uni.showToast({ title: state.toast, icon: 'none' })
    },
    async runSearch() {
      const word = sanitizeSearchKeyword(this.keyword)
      this.keyword = word
      const token = Date.now()
      this.searchToken = token
      this.results = []

      if (this.mode === 'source') return
      if (!word) {
        uni.showToast({ title: '请输入书名', icon: 'none' })
        return
      }

      if (this.mode === 'local') {
        this.results = searchBooks(word)
        return
      }

      this.loading = true
      try {
        const results = apiClient.getToken()
          ? await searchBackendBooks(word)
          : await searchOnlineBooks(word)
        if (this.searchToken === token) this.results = results
      } catch (error) {
        if (this.searchToken === token) {
          this.results = []
          uni.showToast({ title: friendlyErrorMessage(error, '搜索失败'), icon: 'none' })
        }
      } finally {
        if (this.searchToken === token) this.loading = false
      }
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
      uni.navigateTo({
        url: `/pages/reader/reader?bookId=${item.bookId}&chapterIndex=${item.chapterIndex || 0}&pageIndex=0`
      })
    },
    resultTypeLabel(item) {
      if (item.type === 'backend-online') return '云端'
      if (item.type === 'online') return '外部'
      if (item.type === 'source-error') return '失败'
      return item.type === 'book' ? '本地书籍' : '本地章节'
    }
  }
}
</script>

<style>
.discover-page {
  box-sizing: border-box;
  width: 100%;
  max-width: 1120px;
  min-height: 100vh;
  padding: 76rpx 36rpx 132rpx;
  margin: 0 auto;
  color: var(--app-text);
  background: var(--app-bg);
}

button::after {
  border: 0;
}

button {
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.top-zone {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24rpx;
}

.eyebrow {
  color: var(--app-accent-3);
  font-size: 22rpx;
  font-weight: 900;
}

.title {
  margin-top: 8rpx;
  color: var(--app-text);
  font-family: "KaiTi", "STKaiti", "FZKai-Z03", "PingFang SC", cursive;
  font-size: 48rpx;
  font-weight: 900;
}

.top-note {
  flex-shrink: 0;
  color: var(--app-muted);
  font-size: 24rpx;
}

.search-panel {
  display: grid;
  grid-template-columns: 1fr 132rpx;
  gap: 14rpx;
  margin-top: 34rpx;
}

.search-pill {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 76rpx;
  padding: 0 28rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 18rpx;
  background: var(--app-input);
  box-shadow: var(--app-shadow);
}

.search-icon {
  margin-right: 12rpx;
  color: var(--app-accent);
  font-size: 30rpx;
}

.search-input {
  flex: 1;
  height: 76rpx;
  color: var(--app-text);
  font-size: 28rpx;
}

.search-button {
  height: 76rpx;
  border-radius: 18rpx;
  color: var(--app-on-accent);
  font-size: 26rpx;
  font-weight: 800;
  background: var(--app-accent-3);
  box-shadow: 0 14rpx 28rpx rgba(226, 106, 79, 0.22);
}

.mode-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: 26rpx;
}

.mode {
  height: 64rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 18rpx;
  color: var(--app-muted);
  font-size: 25rpx;
  background: var(--app-panel);
}

.mode.active {
  color: var(--app-on-accent);
  border-color: var(--app-accent);
  background: linear-gradient(135deg, var(--app-accent) 0%, var(--app-accent-2) 100%);
}

.tip-card,
.source-card,
.result-card,
.empty-state,
.loading-card {
  border: 1rpx solid var(--app-border);
  border-radius: 16rpx;
  background: var(--app-panel-strong);
  box-shadow: var(--app-shadow);
}

.tip-card {
  padding: 24rpx 26rpx;
  margin-top: 22rpx;
}

.tip-title,
.section-title,
.result-title,
.empty-title,
.loading-title,
.source-name {
  color: var(--app-text);
  font-weight: 900;
}

.tip-title,
.section-title {
  font-size: 29rpx;
}

.tip-desc,
.section-desc,
.source-desc,
.result-subtitle,
.result-snippet,
.empty-desc,
.loading-desc {
  display: block;
  margin-top: 8rpx;
  color: var(--app-muted);
  font-size: 23rpx;
  line-height: 34rpx;
}

.content {
  height: calc(100vh - 420rpx);
  margin-top: 22rpx;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 18rpx;
}

.source-count {
  flex-shrink: 0;
  color: var(--app-accent-3);
  font-size: 23rpx;
  font-weight: 900;
}

.source-card {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-height: 88rpx;
  padding: 20rpx 22rpx;
  margin-bottom: 16rpx;
}

.source-main {
  min-width: 0;
  flex: 1;
}

.source-name,
.result-title {
  overflow: hidden;
  font-size: 30rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-action {
  flex-shrink: 0;
  width: 94rpx;
  height: 52rpx;
  border-radius: 14rpx;
  color: var(--app-muted);
  font-size: 23rpx;
  background: var(--app-panel);
}

.source-action.active {
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.loading-card {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 26rpx;
  margin-bottom: 18rpx;
}

.loading-dot {
  flex-shrink: 0;
  width: 18rpx;
  height: 18rpx;
  border-radius: 999rpx;
  background: var(--app-accent-3);
  animation: pulse 1.1s ease-in-out infinite;
}

.result-card {
  padding: 22rpx 24rpx;
  margin-bottom: 18rpx;
}

.result-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.result-type,
.result-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36rpx;
  padding: 0 14rpx;
  border-radius: 999rpx;
  font-size: 21rpx;
}

.result-type {
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.result-action {
  color: var(--app-accent-3);
  background: var(--app-panel);
}

.empty-state {
  padding: 38rpx 28rpx;
  text-align: center;
}

.empty-title {
  font-size: 31rpx;
}

.starter-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: 26rpx;
}

.starter {
  height: 58rpx;
  border-radius: 16rpx;
  color: var(--app-text);
  font-size: 23rpx;
  background: var(--app-panel);
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.35;
    transform: scale(0.85);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
