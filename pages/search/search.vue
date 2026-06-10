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
      <view class="tip-title">书源发现</view>
      <text class="tip-desc">导入带 exploreUrl 的书源后，分类、榜单和最新入库会直接请求对应书源页面。当前可搜索 {{ availableSourceCount }} 个，可发现 {{ availableExploreCount }} 个入口。</text>
      <text class="tip-desc" v-if="availableSourceNames">可用书源：{{ availableSourceNames }}</text>
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
            <view class="loading-title">{{ loadingTitle }}</view>
            <text class="loading-desc">{{ mode === 'cloud' ? '演示建议搜索“星轨图书馆”，外部源最多等待 5 秒。' : '本地搜索只查已加入书架的 TXT 和云端书籍缓存。' }}</text>
          </view>
        </view>

        <view class="discover-source-list" v-if="mode === 'cloud' && exploreEntries.length && !results.length">
          <view class="section-head">
            <view>
              <view class="section-title">分类</view>
              <text class="section-desc">来自已导入书源的发现入口。</text>
            </view>
            <text class="source-count">{{ exploreCategoryEntries.length }}</text>
          </view>
          <view class="explore-grid" v-if="exploreCategoryEntries.length">
            <button
              class="explore-entry"
              v-for="entry in exploreCategoryEntries"
              :key="entry.id"
              @tap="openExploreEntry(entry)"
            >
              {{ entry.title }}
            </button>
          </view>

          <view class="explore-heading" v-if="exploreRankEntries.length">排行榜</view>
          <view class="explore-grid" v-if="exploreRankEntries.length">
            <button
              class="explore-entry"
              v-for="entry in exploreRankEntries"
              :key="entry.id"
              @tap="openExploreEntry(entry)"
            >
              {{ entry.title }}
            </button>
          </view>

          <view class="explore-heading" v-if="latestExploreEntries.length">最新入库</view>
          <view class="explore-grid wide" v-if="latestExploreEntries.length">
            <button
              class="explore-entry"
              v-for="entry in latestExploreEntries"
              :key="entry.id"
              @tap="openExploreEntry(entry)"
            >
              {{ entry.title }}
            </button>
          </view>

          <view class="explore-heading" v-if="sourceExploreRows.length">书源入口</view>
          <view
            class="source-entry"
            v-for="source in sourceExploreRows"
            :key="source.sourceId"
            @tap="openExploreEntry(source.firstEntry)"
          >
            <view class="source-main">
              <view class="source-name">{{ source.sourceName }}</view>
              <text class="source-desc">{{ source.sourceGroup }} · {{ source.count }} 个发现入口</text>
            </view>
            <text class="result-action">进入</text>
          </view>
        </view>

        <view v-if="results.length">
          <view class="source-usage" v-if="lastSearchSourceNames.length">
            本次使用 {{ lastSearchSourceNames.join('、') }}
          </view>
          <view class="result-card" v-for="(item, index) in results" :key="buildSearchResultKey(item, index)" @tap="openResult(item)">
            <view class="result-top">
              <view class="result-type">{{ resultTypeLabel(item) }}</view>
              <text class="result-action">查看</text>
            </view>
            <view class="result-title">{{ item.title }}</view>
            <text class="result-subtitle">{{ item.subtitle }}</text>
            <text class="result-source" v-if="resultSourceName(item)">来源：{{ resultSourceName(item) }}</text>
            <text class="result-snippet">{{ item.snippet }}</text>
          </view>
        </view>

        <view class="empty-state" v-else-if="mode === 'cloud' && noAvailableSourceHint && !loading">
          <view class="empty-title">暂无可用书源</view>
          <text class="empty-desc">请先到书源页完成书源测试。发现页只使用已通过测试的书源。</text>
          <button class="starter primary" @tap="goLibrary">去书源页批量检测</button>
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
import { exploreOnlineBooks, getOnlineExploreEntries, getSourceConfigs, pickOnlineSearchSources, saveOnlineBookDraft, searchOnlineBooks, setSourceEnabled } from '../../common/bookSources.js'
import apiClient from '../../common/apiClient.js'
import { searchBackendBooks } from '../../common/backendLibrary.js'
import { buildSearchResultKey, buildSourceToggleState, demoSearchKeywords, sanitizeSearchKeyword } from '../../common/searchHelpers.js'
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
      lastSearchSourceNames: [],
      exploreEntries: [],
      activeExploreEntry: null,
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
    availableSearchSources() {
      return pickOnlineSearchSources(this.sources, 99)
    },
    availableSourceCount() {
      return this.availableSearchSources.length
    },
    availableExploreCount() {
      return this.exploreEntries.length
    },
    availableSourceNames() {
      return this.availableSearchSources.map(source => source.name).join('、')
    },
    exploreCategoryEntries() {
      return this.exploreEntries.filter(entry => entry.kind === 'category').slice(0, 12)
    },
    exploreRankEntries() {
      return this.exploreEntries.filter(entry => entry.kind === 'rank').slice(0, 9)
    },
    latestExploreEntries() {
      return this.exploreEntries.filter(entry => entry.kind === 'latest').slice(0, 6)
    },
    sourceExploreRows() {
      const rows = []
      this.exploreEntries.forEach(entry => {
        const found = rows.find(row => row.sourceId === entry.sourceId)
        if (found) {
          found.count += 1
          return
        }
        rows.push({
          sourceId: entry.sourceId,
          sourceName: entry.sourceName,
          sourceGroup: entry.sourceGroup,
          firstEntry: entry,
          count: 1
        })
      })
      return rows.slice(0, 8)
    },
    loadingTitle() {
      if (this.activeExploreEntry) return `正在打开 ${this.activeExploreEntry.title}`
      return this.mode === 'cloud' ? '正在搜索云端书源' : '正在搜索本地书架'
    },
    noAvailableSourceHint() {
      return this.availableSourceCount === 0 && this.availableExploreCount === 0 && !apiClient.getToken()
    },
    modeHint() {
      if (this.mode === 'source') return '管理外部书源'
      if (this.mode === 'local') return '只查本地书架'
      return `可搜索 ${this.availableSourceCount} · 可发现 ${this.availableExploreCount}`
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
    this.refreshExploreEntries()
  },
  methods: {
    refreshExploreEntries() {
      this.exploreEntries = getOnlineExploreEntries({ sources: this.sources })
    },
    setMode(mode) {
      this.mode = mode
      this.results = []
      this.loading = false
      this.lastSearchSourceNames = []
      this.activeExploreEntry = null
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
        this.refreshExploreEntries()
      }
      uni.showToast({ title: state.toast, icon: 'none' })
    },
    buildSearchResultKey,
    async openExploreEntry(entry) {
      if (!entry) return
      const token = Date.now()
      this.mode = 'cloud'
      this.searchToken = token
      this.results = []
      this.keyword = ''
      this.loading = true
      this.activeExploreEntry = entry
      this.lastSearchSourceNames = [`${entry.sourceName} · ${entry.title}`]
      try {
        const results = await exploreOnlineBooks(entry)
        if (this.searchToken === token) this.results = results
      } catch (error) {
        if (this.searchToken === token) {
          this.results = []
          uni.showToast({ title: friendlyErrorMessage(error, '发现入口打开失败'), icon: 'none' })
        }
      } finally {
        if (this.searchToken === token) this.loading = false
      }
    },
    async runSearch() {
      const word = sanitizeSearchKeyword(this.keyword)
      this.keyword = word
      const token = Date.now()
      this.searchToken = token
      this.results = []
      this.lastSearchSourceNames = []
      this.activeExploreEntry = null

      if (this.mode === 'source') return
      if (!word) {
        uni.showToast({ title: '请输入书名', icon: 'none' })
        return
      }

      if (this.mode === 'local') {
        this.results = searchBooks(word)
        return
      }

      if (this.noAvailableSourceHint) {
        uni.showToast({ title: '暂无可用书源，请先到书源页完成书源测试', icon: 'none' })
        return
      }

      this.lastSearchSourceNames = apiClient.getToken()
        ? ['后端演示源']
        : this.availableSearchSources.map(source => source.name)
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
    goLibrary() {
      uni.switchTab({ url: '/pages/library/library' })
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
    },
    resultSourceName(item) {
      return item.sourceName || (item.book && item.book.sourceName) || ''
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
.result-source,
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

.discover-source-list {
  margin-bottom: 22rpx;
}

.explore-heading {
  margin: 26rpx 0 14rpx;
  color: var(--app-text);
  font-size: 27rpx;
  font-weight: 900;
}

.explore-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
  margin-bottom: 14rpx;
}

.explore-grid.wide {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.explore-entry {
  min-width: 0;
  height: 62rpx;
  padding: 0 12rpx;
  overflow: hidden;
  border-radius: 999rpx;
  color: var(--app-text);
  font-size: 24rpx;
  background: var(--app-panel);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-entry {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-height: 78rpx;
  padding: 18rpx 22rpx;
  margin-bottom: 14rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 16rpx;
  background: var(--app-panel-strong);
  box-shadow: var(--app-shadow);
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

.source-usage {
  margin-bottom: 16rpx;
  color: var(--app-muted);
  font-size: 23rpx;
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

.starter.primary {
  width: 100%;
  margin-top: 24rpx;
  color: var(--app-on-accent);
  background: var(--app-accent);
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
