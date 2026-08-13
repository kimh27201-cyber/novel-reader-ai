<template>
  <view class="tab-page-shell" :class="themeClass" :style="themeVars">
  <view class="discover-page app-page tab-page-content" :class="[themeClass, pageMotionClass]">
    <view class="top-zone">
      <view>
        <text class="eyebrow">DISCOVER</text>
        <view class="title">发现阅读</view>
      </view>
      <text class="top-note">{{ modeHint }}</text>
    </view>

    <view class="search-panel">
      <view class="search-status">
        <view class="search-status-main">
          <text class="status-pulse"></text>
          <text>{{ modeLabel }}检索通道</text>
        </view>
        <text>{{ keyword ? `${keyword.length} 字线索` : '等待输入' }}</text>
      </view>
      <view class="search-pill">
        <view class="search-icon" aria-hidden="true"></view>
        <input
          class="search-input"
          v-model="keyword"
          :focus="searchFocused"
          :placeholder="searchPlaceholder"
          confirm-type="search"
          @blur="searchFocused = false"
          @confirm="runSearch"
        />
      </view>
      <button class="search-button" @tap="runSearch">开始检索</button>
    </view>

    <view class="mode-row">
      <button class="mode" :class="{ active: mode === 'cloud' }" @tap="setMode('cloud')">联网</button>
      <button class="mode" :class="{ active: mode === 'source' }" @tap="setMode('source')">书源</button>
      <button class="mode" :class="{ active: mode === 'local' }" @tap="setMode('local')">本地</button>
    </view>

    <view class="tip-card" v-if="mode === 'cloud'">
      <view class="tip-title">书源发现</view>
      <text class="tip-desc">手机本地书源优先搜索，登录后端时只合并补充结果。已验证 {{ sourcePoolStats.verified }}，待检测 {{ sourcePoolStats.untested }}，冷却中 {{ sourcePoolStats.cooling }}，受限 {{ sourcePoolStats.blocked }}。</text>
      <text class="tip-desc" v-if="availableSourceNames">可用书源：{{ availableSourceNames }}</text>
      <view class="search-settings-toggle" @tap="searchSettingsExpanded = !searchSettingsExpanded">
        <text class="setting-label">高级搜索</text>
        <text class="setting-toggle-arrow">{{ searchSettingsExpanded ? '▴' : '▾' }}</text>
      </view>
      <view class="search-settings" v-if="searchSettingsExpanded">
        <view class="setting-cell">
          <text class="setting-label">同时搜索</text>
          <view class="stepper">
            <button class="stepper-button" @tap="adjustSearchSetting('concurrency', -1)">−</button>
            <text class="stepper-value">{{ searchSettings.concurrency }}</text>
            <button class="stepper-button" @tap="adjustSearchSetting('concurrency', 1)">＋</button>
          </view>
        </view>
        <view class="setting-cell">
          <text class="setting-label">等待时间</text>
          <view class="stepper">
            <button class="stepper-button" @tap="adjustSearchSetting('timeoutMs', -1000)">−</button>
            <text class="stepper-value">{{ Math.round(searchSettings.timeoutMs / 1000) }}s</text>
            <button class="stepper-button" @tap="adjustSearchSetting('timeoutMs', 1000)">＋</button>
          </view>
        </view>
        <view class="setting-cell">
          <text class="setting-label">检查数量</text>
          <view class="stepper">
            <button class="stepper-button" @tap="adjustSearchSetting('sourceLimit', -10)">−</button>
            <text class="stepper-value">{{ searchSettings.sourceLimit }}</text>
            <button class="stepper-button" @tap="adjustSearchSetting('sourceLimit', 10)">＋</button>
          </view>
        </view>
        <view class="setting-cell">
          <text class="setting-label">Wi-Fi 智能检测</text>
          <switch :checked="searchSettings.autoWarmup" color="#e26a4f" @change="toggleSearchSetting('autoWarmup', $event)" />
        </view>
        <view class="setting-cell">
          <text class="setting-label">合并后端结果</text>
          <switch :checked="searchSettings.mergeBackend" color="#e26a4f" @change="toggleSearchSetting('mergeBackend', $event)" />
        </view>
      </view>
    </view>

    <view class="history-strip" v-if="mode !== 'source' && searchHistory.length && !loading">
      <view class="history-head">
        <view>
          <text class="history-kicker">RECENT CLUES</text>
          <text class="history-title">最近搜索</text>
        </view>
        <button class="history-clear" @tap="clearSearchHistory">清空</button>
      </view>
      <scroll-view class="history-scroll" scroll-x :show-scrollbar="false">
        <view class="history-list">
          <button class="history-chip" v-for="entry in searchHistory" :key="entry" @tap="useHistory(entry)">
            <text>{{ entry }}</text>
            <text class="history-arrow">↗</text>
          </button>
        </view>
      </scroll-view>
    </view>

    <scroll-view
      class="content"
      scroll-y
      :show-scrollbar="false"
      :refresher-enabled="true"
      :refresher-triggered="discoverRefreshing"
      :refresher-default-style="refresherStyle"
      @refresherrefresh="refreshDiscoverFromGesture"
    >
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
          <view class="loading-copy">
            <view class="loading-title">{{ loadingTitle }}</view>
            <text class="loading-desc">{{ searchProgressText || (mode === 'cloud' ? '正在搜索可用书源。' : '正在查找已加入书架的本地书籍与缓存。') }}</text>
            <view class="loading-track">
              <view class="loading-progress" :style="{ width: `${searchProgressPercent}%` }"></view>
            </view>
          </view>
        </view>

        <DSkeleton class="search-skeleton-list" v-if="loading" variant="search" :rows="3" aria-label="正在加载搜索结果" />

        <view class="search-error-state" v-if="searchError && !loading">
          <view class="state-mark error">!</view>
          <view class="state-copy">
            <view class="empty-title">这条线索暂时中断</view>
            <text class="empty-desc">{{ searchError }}</text>
          </view>
          <button class="state-action" @tap="retrySearch">{{ retryActionLabel }}</button>
        </view>

        <view class="source-usage" v-if="lastSearchReport && lastSearchReport.local && !loading">
          已探测 {{ lastSearchReport.local.attempted }} 个来源：有结果 {{ lastSearchReport.local.succeeded }}，空结果 {{ lastSearchReport.local.empty }}，失败 {{ lastSearchReport.local.failed }}；后端补充 {{ lastSearchReport.backend.count }} 条。
        </view>

        <view class="discover-source-list" v-if="mode === 'cloud' && exploreEntries.length && !results.length && !hasSearched">
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

        <view v-if="results.length && !searchError">
          <view class="source-usage" v-if="lastSearchSourceNames.length">
            本次使用 {{ lastSearchSourceNames.join('、') }}
          </view>
          <view class="result-card" v-for="(item, index) in results" :key="buildSearchResultKey(item, index)" :style="{ '--result-enter-delay': `${Math.min(index, 8) * 45}ms` }" @tap="openResult(item)">
            <view class="result-cover-shell">
              <image class="result-cover" v-if="resultCoverUrl(item)" :src="resultCoverUrl(item)" mode="aspectFill" lazy-load />
              <view class="result-cover-fallback" v-else>
                <text>{{ resultShortTitle(item) }}</text>
              </view>
              <view class="result-spine"></view>
            </view>
            <view class="result-copy">
              <view class="result-top">
                <view class="result-title">{{ item.title }}</view>
                <text class="result-action">›</text>
              </view>
              <view class="result-meta-row">
                <view class="result-type">{{ resultTypeLabel(item) }}</view>
                <text class="result-source" v-if="resultSourceName(item)">{{ resultSourceName(item) }}</text>
                <text class="result-quality" v-if="item.sourceQualityScore != null">质量 {{ item.sourceQualityScore }}</text>
              </view>
              <text class="result-subtitle">{{ item.subtitle }}</text>
              <text class="result-source result-duplicate" v-if="item.duplicateCount > 1">已合并 {{ item.duplicateCount }} 个重复结果</text>
              <text class="result-snippet">{{ item.snippet }}</text>
            </view>
          </view>
        </view>

        <view class="empty-state" v-else-if="mode === 'cloud' && noAvailableSourceHint && !loading">
          <view class="empty-title">暂无可用书源</view>
          <text class="empty-desc">当前没有静态规则合格的文字书源，可继续导入来源或检查是否误停用了全部书源。</text>
          <button class="starter primary" @tap="goLibrary">查看书源设置</button>
        </view>

        <DEmptyState
          class="empty-state no-result-state"
          v-else-if="hasSearched && !loading && !searchError"
          scene="search"
          :theme-id="themeId"
          :title="`没有找到“${lastSearchKeyword}”`"
          :description="mode === 'cloud' ? '换一个更短的书名，或切换书源后再试。' : '本地书架中没有匹配项，可以先导入 TXT 或加入一本书。'"
          :action-text="lastSearchReport && lastSearchReport.local && lastSearchReport.local.hasMore ? '继续检测下一批' : '换个关键词'"
          @action="continueSearch"
        />

        <view class="empty-state" v-else-if="!loading && !searchError">
          <view class="state-mark">书</view>
          <view class="empty-title">{{ mode === 'cloud' ? '从一个书名开始发现' : '搜索本地书架' }}</view>
          <text class="empty-desc">{{ mode === 'cloud' ? '输入完整书名或从推荐线索开始，应用会自动探测手机中的本地书源。' : '本地模式只查已经导入或加入书架的书籍。' }}</text>
          <view class="starter-grid" v-if="mode === 'cloud' && !searchHistory.length">
            <button class="starter" v-for="entry in starterKeywords" :key="entry" @tap="useStarter(entry)">
              {{ entry }}
            </button>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
  <GlassTabBar active-path="pages/search/search" />
  </view>
</template>

<script>
import { searchBooks } from '../../common/books.js'
import { buildExploreCatalog, buildSourceCandidatePool, getOnlineExploreEntries, getOnlineSearchSettings, getSourceConfigs, openExploreCatalogEntry, saveOnlineBookDraft, saveOnlineSearchSettings, setSourceEnabled } from '../../common/bookSources.js'
import { mergeUnifiedSearchResults, searchUnifiedBooks } from '../../common/sourceSearchRuntime.js'
import { setSourceWarmupBusy } from '../../common/sourceWarmup.js'
import { buildSearchResultKey, buildSourceToggleState, demoSearchKeywords, sanitizeSearchKeyword } from '../../common/searchHelpers.js'
import { getAppThemeId, getAppThemeStyle } from '../../common/appTheme.js'
import GlassTabBar from '../../custom-tab-bar/index.vue'
import DEmptyState from '../../components/composite/DEmptyState.vue'
import DSkeleton from '../../components/feedback/DSkeleton.vue'
import { friendlyErrorMessage } from '../../common/uiFeedback.js'
import { markTabDirty, markTabFresh, shouldRefreshTab } from '../../common/tabFreshness.js'
import { getNavigationMotion } from '../../common/motion.js'
import { markTabRouteShown } from '../../common/tabNavigation.js'
import { ensureNativeTabBarHidden } from '../../common/tabShell.js'

const SEARCH_HISTORY_KEY = 'search:history'

function getStoredSearchHistory() {
  try {
    const saved = uni.getStorageSync(SEARCH_HISTORY_KEY)
    return Array.isArray(saved) ? saved.filter(Boolean).slice(0, 8) : []
  } catch (error) {
    return []
  }
}

export default {
  components: { GlassTabBar, DEmptyState, DSkeleton },
  data() {
    return {
      mode: 'cloud',
      keyword: '',
      results: [],
      sources: [],
      loading: false,
      hasSearched: false,
      lastSearchKeyword: '',
      searchError: '',
      searchFocused: false,
      searchHistory: getStoredSearchHistory(),
      searchToken: 0,
      lastSearchSourceNames: [],
      searchProgress: { done: 0, total: 0, message: '' },
      searchSettings: getOnlineSearchSettings(),
      searchSettingsExpanded: false,
      exploreEntries: [],
      exploreCatalog: [],
      sourcePoolStats: { total: 0, verified: 0, untested: 0, retryable: 0, cooling: 0, blocked: 0, available: 0 },
      sourceCandidates: [],
      lastSearchReport: null,
      searchedSourceIds: [],
      activeExploreEntry: null,
      discoverRefreshing: false,
      themeId: getAppThemeId(),
      pageMotionKind: '',
      pageMotionDirection: 'forward',
      starterKeywords: demoSearchKeywords
    }
  },
  computed: {
    themeVars() {
      return getAppThemeStyle(this.themeId)
    },
    themeClass() {
      return `theme-${this.themeId}`
    },
    pageMotionClass() {
      return this.pageMotionKind === 'tab'
        ? `app-tab-enter app-tab-enter-${this.pageMotionDirection === 'back' ? 'back' : 'forward'}`
        : ''
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
      return this.sourceCandidates.slice(0, Math.max(8, Number(this.searchSettings.sourceLimit || 20)))
    },
    availableSourceCount() {
      return this.sourcePoolStats.available
    },
    availableExploreCount() {
      return this.exploreEntries.length
    },
    availableExploreSourceCount() {
      return new Set(this.exploreEntries.map(entry => entry.sourceId).filter(Boolean)).size
    },
    availableSourceNames() {
      const names = this.availableSearchSources.slice(0, 8).map(source => source.name).join('、')
      return this.availableSourceCount > 8 ? `${names} 等` : names
    },
    exploreCategoryEntries() {
      return this.exploreCatalog.filter(entry => entry.kind === 'category').slice(0, 12)
    },
    exploreRankEntries() {
      return this.exploreCatalog.filter(entry => entry.kind === 'rank').slice(0, 9)
    },
    latestExploreEntries() {
      return this.exploreCatalog.filter(entry => entry.kind === 'latest').slice(0, 6)
    },
    sourceExploreRows() {
      const rows = []
      const rowMap = new Map()
      this.exploreEntries.forEach(entry => {
        const found = rowMap.get(entry.sourceId)
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
        rowMap.set(entry.sourceId, rows[rows.length - 1])
      })
      return rows.slice(0, 8)
    },
    loadingTitle() {
      if (this.activeExploreEntry) return `正在打开 ${this.activeExploreEntry.title}`
      return this.mode === 'cloud' ? '正在探测联网书源' : '正在搜索本地书架'
    },
    searchProgressText() {
      if (!this.loading || this.mode !== 'cloud' || !this.searchProgress.total) return ''
      const base = `已完成 ${this.searchProgress.done}/${this.searchProgress.total}`
      if (!this.searchProgress.message) return base
      return `${base} · ${this.searchProgress.message}`
    },
    searchProgressPercent() {
      if (!this.searchProgress.total) return this.loading ? 36 : 0
      return Math.max(8, Math.min(100, Math.round((this.searchProgress.done / this.searchProgress.total) * 100)))
    },
    noAvailableSourceHint() {
      return this.sourcePoolStats.available === 0 && this.availableExploreCount === 0
    },
    modeHint() {
      if (this.mode === 'source') return '管理外部书源'
      if (this.mode === 'local') return '只查本地书架'
      return `可搜索 ${this.availableSourceCount} · 发现源 ${this.availableExploreSourceCount}`
    },
    retryActionLabel() {
      return this.activeExploreEntry ? '重试当前入口' : '查看其他可用入口'
    },
    modeLabel() {
      if (this.mode === 'source') return '书源'
      if (this.mode === 'local') return '本地'
      return '联网'
    },
    searchPlaceholder() {
      if (this.mode === 'source') return '筛选书源名称'
      if (this.mode === 'local') return '搜索本地书名'
      return '搜索书名，例如：星轨图书馆'
    },
    refresherStyle() {
      return ['candy', 'sakura'].includes(this.themeId) ? 'black' : 'white'
    }
  },
  onLoad() {
    if (uni.$on) uni.$on('sources:changed', this.handleSourcesChanged)
  },
  onShow() {
    markTabRouteShown('pages/search/search')
    ensureNativeTabBarHidden()
    this.themeId = getAppThemeId()
    const motion = getNavigationMotion()
    this.pageMotionKind = motion.kind
    this.pageMotionDirection = motion.direction
    if (shouldRefreshTab('search')) this.refreshDiscoverShell()
  },
  onUnload() {
    if (uni.$off) uni.$off('sources:changed', this.handleSourcesChanged)
  },
  methods: {
    refreshSourcePool() {
      const pool = buildSourceCandidatePool(this.sources)
      this.sourceCandidates = pool.candidates
      this.sourcePoolStats = { ...pool.counts, available: pool.candidates.length }
    },
    refreshExploreEntries(options = {}) {
      if (!options.skipPool) this.refreshSourcePool()
      this.exploreEntries = getOnlineExploreEntries({ sources: this.sources })
      this.exploreCatalog = buildExploreCatalog(this.sources, this.exploreEntries)
      markTabFresh('search')
    },
    refreshDiscoverShell() {
      this.searchSettings = getOnlineSearchSettings()
      this.sources = getSourceConfigs()
      this.refreshSourcePool()
      this.$nextTick(() => {
        setTimeout(() => this.refreshExploreEntries({ skipPool: true }), 300)
      })
    },
    handleSourcesChanged() {
      markTabDirty('search')
    },
    async refreshDiscoverFromGesture() {
      if (this.discoverRefreshing) return
      this.discoverRefreshing = true
      try {
        this.searchSettings = getOnlineSearchSettings()
        this.sources = getSourceConfigs()
        this.refreshExploreEntries()
        if (this.loading) return
        if (this.activeExploreEntry) {
          await this.openExploreEntry(this.activeExploreEntry)
          return
        }
        if (this.lastSearchKeyword) {
          this.keyword = this.lastSearchKeyword
          await this.runSearch()
        }
      } finally {
        this.discoverRefreshing = false
      }
    },
    adjustSearchSetting(field, delta) {
      const current = Number(this.searchSettings[field] || 0)
      this.searchSettings = saveOnlineSearchSettings({
        ...this.searchSettings,
        [field]: current + delta
      })
    },
    toggleSearchSetting(field, event) {
      this.searchSettings = saveOnlineSearchSettings({
        ...this.searchSettings,
        [field]: !!(event && event.detail && event.detail.value)
      })
    },
    setMode(mode) {
      this.mode = mode
      this.results = []
      this.loading = false
      this.hasSearched = false
      this.searchError = ''
      this.lastSearchSourceNames = []
      this.activeExploreEntry = null
      if (mode === 'local' && this.keyword) this.runSearch()
    },
    useStarter(keyword) {
      this.keyword = sanitizeSearchKeyword(keyword)
      this.mode = 'cloud'
      this.runSearch()
    },
    useHistory(keyword) {
      this.keyword = sanitizeSearchKeyword(keyword)
      this.runSearch()
    },
    rememberSearch(keyword) {
      const word = sanitizeSearchKeyword(keyword)
      if (!word) return
      this.searchHistory = [word, ...this.searchHistory.filter(item => item !== word)].slice(0, 8)
      try {
        uni.setStorageSync(SEARCH_HISTORY_KEY, this.searchHistory)
      } catch (error) {}
    },
    clearSearchHistory() {
      this.searchHistory = []
      try {
        uni.removeStorageSync(SEARCH_HISTORY_KEY)
      } catch (error) {}
      uni.showToast({ title: '搜索记录已清空', icon: 'none' })
    },
    focusSearchInput() {
      this.searchFocused = false
      this.$nextTick(() => {
        this.searchFocused = true
      })
    },
    retrySearch() {
      const entry = this.activeExploreEntry
      this.searchError = ''
      if (entry) {
        this.openExploreEntry(entry)
        return
      }
      if (!sanitizeSearchKeyword(this.keyword)) {
        this.results = []
        this.hasSearched = false
        this.refreshDiscoverShell()
        return
      }
      this.runSearch()
    },
    continueSearch() {
      if (this.lastSearchReport && this.lastSearchReport.local && this.lastSearchReport.local.hasMore) {
        this.runSearch({ continue: true })
        return
      }
      this.focusSearchInput()
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
      this.hasSearched = true
      this.searchError = ''
      this.lastSearchKeyword = entry.title
      this.activeExploreEntry = entry
      this.lastSearchSourceNames = [`${entry.sourceName} · ${entry.title}`]
      try {
        setSourceWarmupBusy(true)
        const catalogEntry = entry.providers ? entry : { ...entry, key: entry.id, providers: [entry] }
        const report = await openExploreCatalogEntry(catalogEntry)
        if (this.searchToken === token) {
          this.results = report.results
          this.lastSearchSourceNames = [`${report.provider.sourceName} · ${entry.title}`]
        }
      } catch (error) {
        if (this.searchToken === token) {
          this.results = []
          this.searchError = friendlyErrorMessage(error, '发现入口打开失败')
          this.sources = getSourceConfigs()
          this.refreshExploreEntries()
          if (!this.exploreEntries.some(item => item.sourceId === entry.sourceId)) {
            this.activeExploreEntry = null
          }
          uni.showToast({ title: this.searchError, icon: 'none' })
        }
      } finally {
        if (this.searchToken === token) this.loading = false
        setSourceWarmupBusy(false)
      }
    },
    async runSearch(options = {}) {
      const word = sanitizeSearchKeyword(this.keyword)
      this.keyword = word
      const token = Date.now()
      const continuing = options && options.continue === true && word === this.lastSearchKeyword
      const previousResults = continuing ? this.results.slice() : []
      if (!continuing) this.searchedSourceIds = []
      this.searchToken = token
      this.results = previousResults
      this.hasSearched = false
      this.searchError = ''
      this.lastSearchSourceNames = []
      this.searchProgress = { done: 0, total: 0, message: '' }
      this.activeExploreEntry = null

      if (this.mode === 'source') return
      if (!word) {
        uni.showToast({ title: '请输入书名', icon: 'none' })
        return
      }

      this.hasSearched = true
      this.lastSearchKeyword = word
      this.rememberSearch(word)

      if (this.mode === 'local') {
        this.results = searchBooks(word)
        return
      }

      this.lastSearchSourceNames = this.availableSearchSources.slice(0, this.searchSettings.sourceLimit).map(source => source.name)
      this.loading = true
      setSourceWarmupBusy(true)
      try {
        const report = await searchUnifiedBooks(word, {
          ...this.searchSettings,
          excludeSourceIds: this.searchedSourceIds,
          onResults: results => {
            if (this.searchToken === token) this.results = mergeUnifiedSearchResults(previousResults, results)
          },
          onProgress: progress => {
            if (this.searchToken !== token) return
            this.searchProgress = {
              done: progress.done,
              total: progress.total,
              message: `${progress.sourceName} ${progress.status === 'success' ? `返回 ${progress.count}` : progress.status === 'empty' ? '无结果' : '失败'}`
            }
          }
        })
        if (this.searchToken === token) {
          this.results = mergeUnifiedSearchResults(previousResults, report.results)
          this.lastSearchReport = report
          this.searchedSourceIds = [...this.searchedSourceIds, ...report.local.attemptedSourceIds]
          this.sources = getSourceConfigs()
          this.refreshExploreEntries()
        }
      } catch (error) {
        if (this.searchToken === token) {
          this.results = []
          this.searchError = friendlyErrorMessage(error, '搜索失败')
          uni.showToast({ title: this.searchError, icon: 'none' })
        }
      } finally {
        if (this.searchToken === token) this.loading = false
        setSourceWarmupBusy(false)
      }
    },
    goLibrary() {
      uni.switchTab({ url: '/pages/library/library' })
    },
    openResult(item) {
      if (item.type === 'online' || item.type === 'backend-online') {
        const alternates = [
          ...(Array.isArray(item.alternateSources) ? item.alternateSources : []),
          ...(Array.isArray(item.alternateRoutes) ? item.alternateRoutes.map(route => route.candidate).filter(Boolean) : [])
        ]
        const selected = item.type === 'backend-online' ? item : item.book
        saveOnlineBookDraft({ ...selected, alternateSources: alternates })
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
    },
    resultCoverUrl(item) {
      return item.coverUrl || (item.book && item.book.coverUrl) || ''
    },
    resultShortTitle(item) {
      return String(item.title || '书').replace(/[《》\s]/g, '').slice(0, 4) || '书'
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

.search-settings-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
  padding: 14rpx 18rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 12rpx;
  background: var(--app-input);
}

.setting-toggle-arrow {
  flex-shrink: 0;
  color: var(--app-muted);
  font-size: 22rpx;
}

.search-settings {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 14rpx;
}

.setting-cell {
  min-width: 0;
  padding: 14rpx;
  border-radius: 14rpx;
  background: var(--app-input);
}

.setting-label,
.stepper-value {
  display: block;
  text-align: center;
}

.setting-label {
  color: var(--app-muted);
  font-size: 21rpx;
  line-height: 28rpx;
}

.stepper {
  display: grid;
  grid-template-columns: 44rpx 1fr 44rpx;
  align-items: center;
  gap: 6rpx;
  margin-top: 10rpx;
}

.stepper-button {
  height: 44rpx;
  border-radius: 999rpx;
  color: var(--app-on-accent);
  font-size: 24rpx;
  background: var(--app-accent);
}

.stepper-value {
  overflow: hidden;
  color: var(--app-text);
  font-size: 23rpx;
  font-weight: 900;
  line-height: 44rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.result-cover {
  width: 96rpx;
  height: 128rpx;
  border-radius: 8rpx;
  margin-bottom: 12rpx;
  background: var(--app-panel);
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

/* Stage 2: discovery console. Keep the original search and navigation flow intact. */
.discover-page {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow-x: hidden;
  padding-bottom: calc(126rpx + env(safe-area-inset-bottom));
  background: var(--app-stage) !important;
  box-shadow: inset 0 0 0 100vmax var(--app-stage);
}

.top-zone,
.search-panel,
.mode-row,
.tip-card,
.history-strip {
  flex-shrink: 0;
}

.title,
.section-title,
.empty-title,
.result-title {
  font-family: var(--app-heading-font);
}

.search-panel {
  grid-template-columns: minmax(0, 1fr) 132rpx;
  gap: 12rpx;
  padding: 16rpx;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-card-radius);
  background: var(--app-surface);
  box-shadow: var(--app-shadow);
}

.search-status {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 30rpx;
  padding: 0 4rpx;
  color: var(--app-muted);
  font-size: 20rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
}

.search-status-main {
  display: flex;
  align-items: center;
  gap: 10rpx;
  color: var(--app-accent);
}

.status-pulse {
  width: 11rpx;
  height: 11rpx;
  border-radius: 999rpx;
  background: var(--app-accent);
  box-shadow: 0 0 18rpx var(--app-accent);
  animation: pulse 1.6s ease-in-out infinite;
}

.search-pill {
  height: 88rpx;
  border-radius: var(--app-control-radius);
  box-shadow: none;
}

.search-input {
  height: 86rpx;
}

.search-button {
  height: 88rpx;
  border-radius: var(--app-control-radius);
  background: linear-gradient(135deg, var(--app-accent), var(--app-accent-2));
  box-shadow: var(--app-glow);
}

.mode,
.tip-card,
.source-card,
.source-entry,
.result-card,
.empty-state,
.loading-card,
.search-error-state {
  border-radius: var(--app-card-radius);
}

.mode {
  min-height: 88rpx;
  border-radius: var(--app-control-radius);
  transition: transform var(--app-motion-fast), background var(--app-motion-fast);
}

.mode.active {
  box-shadow: var(--app-glow);
}

.tip-card {
  padding: 20rpx 22rpx;
  margin-top: 18rpx;
}

.content {
  flex: 1;
  min-height: 0;
  height: auto;
  margin-top: 18rpx;
}

.history-strip {
  padding: 18rpx 20rpx 16rpx;
  margin-top: 18rpx;
  overflow: hidden;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-card-radius);
  background: var(--app-surface);
  box-shadow: var(--app-shadow);
}

.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.history-kicker,
.history-title {
  display: block;
}

.history-kicker {
  color: var(--app-accent);
  font-size: 17rpx;
  font-weight: 900;
  letter-spacing: 2rpx;
}

.history-title {
  margin-top: 3rpx;
  color: var(--app-text);
  font-size: 24rpx;
  font-weight: 900;
}

.history-clear {
  min-width: 88rpx;
  min-height: 88rpx;
  color: var(--app-muted);
  font-size: 22rpx;
  background: transparent;
}

.history-scroll {
  width: 100%;
  white-space: nowrap;
}

.history-list {
  display: inline-flex;
  gap: 12rpx;
  padding-right: 20rpx;
}

.history-chip {
  display: inline-flex;
  align-items: center;
  gap: 14rpx;
  min-height: 88rpx;
  padding: 0 20rpx;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-control-radius);
  color: var(--app-text);
  font-size: 23rpx;
  background: var(--app-panel);
}

.history-arrow {
  color: var(--app-accent);
  font-weight: 900;
}

.loading-card {
  align-items: flex-start;
  min-height: 150rpx;
  padding: 28rpx;
}

.loading-dot {
  margin-top: 10rpx;
  background: var(--app-accent);
}

.loading-copy {
  flex: 1;
  min-width: 0;
}

.loading-track {
  height: 8rpx;
  margin-top: 22rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: var(--app-input);
}

.loading-progress {
  height: 100%;
  min-width: 8%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--app-accent), var(--app-accent-2));
  box-shadow: 0 0 18rpx var(--app-accent);
  transition: width var(--app-motion-fast);
}

.search-error-state {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20rpx;
  padding: 30rpx 28rpx;
  margin-bottom: 18rpx;
  border: 1rpx solid var(--app-border);
  background: var(--app-panel-strong);
  box-shadow: var(--app-shadow);
}

.state-copy {
  flex: 1;
  min-width: 0;
}

.state-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 84rpx;
  height: 84rpx;
  margin: 0 auto 20rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 50%;
  color: var(--app-accent);
  font-family: var(--app-heading-font);
  font-size: 34rpx;
  font-weight: 900;
  background: var(--app-input);
  box-shadow: var(--app-glow);
}

.search-error-state .state-mark {
  flex-shrink: 0;
  margin: 0;
}

.state-mark.error {
  color: var(--app-accent-3);
}

.state-action {
  min-width: 190rpx;
  min-height: 80rpx;
  padding: 0 24rpx;
  border-radius: var(--app-control-radius);
  color: var(--app-on-accent);
  font-size: 24rpx;
  font-weight: 800;
  background: var(--app-accent);
}

.search-error-state .state-action {
  width: 100%;
}

.result-card {
  display: flex;
  gap: 22rpx;
  min-height: 194rpx;
  padding: 22rpx;
  border-left: 5rpx solid var(--app-accent);
  transition: transform var(--app-motion-fast), box-shadow var(--app-motion-fast);
}

.result-card:active {
  transform: scale(0.988);
}

.result-cover-shell {
  position: relative;
  flex-shrink: 0;
  width: 112rpx;
  height: 158rpx;
  overflow: hidden;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-control-radius);
  background: linear-gradient(145deg, var(--app-accent-2), var(--app-accent));
  box-shadow: var(--app-glow);
}

.result-cover {
  width: 100%;
  height: 100%;
  margin: 0;
  border-radius: inherit;
}

.result-cover-fallback {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16rpx;
  color: var(--app-on-accent);
  font-family: var(--app-heading-font);
  font-size: 26rpx;
  font-weight: 900;
  line-height: 34rpx;
  text-align: center;
  word-break: break-all;
}

.result-spine {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 10rpx;
  width: 2rpx;
  background: rgba(255, 255, 255, 0.36);
}

.result-copy {
  flex: 1;
  min-width: 0;
}

.result-top {
  align-items: flex-start;
  gap: 12rpx;
  margin-bottom: 8rpx;
}

.result-title {
  display: -webkit-box;
  flex: 1;
  overflow: hidden;
  font-size: 29rpx;
  line-height: 38rpx;
  white-space: normal;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.result-action {
  flex-shrink: 0;
  min-width: 42rpx;
  height: 42rpx;
  padding: 0 10rpx;
  color: var(--app-accent);
  font-size: 30rpx;
  font-weight: 900;
  background: var(--app-input);
}

.result-meta-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-bottom: 4rpx;
}

.result-type {
  height: 38rpx;
  background: var(--app-accent);
}

.result-quality {
  color: var(--app-accent);
  font-size: 20rpx;
  font-weight: 800;
}

.result-source,
.result-subtitle,
.result-snippet {
  margin-top: 5rpx;
}

.result-meta-row .result-source {
  max-width: 210rpx;
  margin: 0;
  overflow: hidden;
  font-size: 20rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-duplicate {
  color: var(--app-accent);
  font-size: 20rpx;
  font-weight: 800;
}

.result-snippet {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.empty-state {
  padding: 48rpx 30rpx;
}

.no-result-state .empty-desc {
  max-width: 520rpx;
  margin: 12rpx auto 0;
}

.no-result-state .state-action {
  margin-top: 26rpx;
}

.starter,
.source-action,
.explore-entry {
  min-height: 88rpx;
  border-radius: var(--app-control-radius);
}

@media (max-width: 380px) {
  .discover-page {
    padding-left: 28rpx;
    padding-right: 28rpx;
  }

  .search-panel {
    grid-template-columns: minmax(0, 1fr) 116rpx;
  }

  .search-button {
    font-size: 24rpx;
  }

  .tip-desc {
    line-height: 31rpx;
  }

  .result-card {
    gap: 18rpx;
  }

  .result-cover-shell {
    width: 102rpx;
    height: 148rpx;
  }

  .starter-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .status-pulse,
  .loading-dot {
    animation: none;
  }

  .mode,
  .result-card,
  .loading-progress {
    transition: none;
  }
}

/* V2 discover pass: a compact retrieval console, not a generic result-card wall. */
.search-panel {
  border-width: var(--app-card-border-width, 1rpx);
  border-radius: var(--app-card-radius, 16rpx);
  box-shadow: var(--app-card-outline), var(--app-shadow);
}

.search-icon {
  position: relative;
  flex: 0 0 32rpx;
  width: 32rpx;
  height: 32rpx;
  margin-left: 4rpx;
  border: 3rpx solid var(--app-accent);
  border-radius: 50%;
}

.search-icon::after {
  position: absolute;
  right: -9rpx;
  bottom: -6rpx;
  width: 13rpx;
  height: 3rpx;
  border-radius: 3rpx;
  background: var(--app-accent);
  content: '';
  transform: rotate(45deg);
  transform-origin: left center;
}

.search-pill:focus-within .search-icon {
  animation: discovery-search-orbit 720ms var(--app-motion-smooth) both;
}

.search-button {
  min-height: var(--app-touch-target-min, 88rpx);
  border-radius: var(--app-control-radius, 12rpx);
  font-family: var(--app-utility-font);
  font-size: 23rpx;
  font-weight: 750;
  letter-spacing: 1rpx;
}

.mode-row {
  border-bottom: 1rpx solid var(--app-border);
}

.mode {
  min-height: 78rpx;
  font-family: var(--app-utility-font);
  font-size: 22rpx;
  letter-spacing: 1rpx;
}

.mode.active {
  box-shadow: inset 0 -3rpx 0 var(--app-accent);
}

.tip-card {
  border-width: var(--app-card-border-width, 1rpx);
  border-radius: var(--app-card-radius, 16rpx);
  box-shadow: var(--app-card-outline), none;
}

.history-chip {
  border-radius: var(--app-control-radius, 12rpx);
  font-family: var(--app-utility-font);
}

.search-skeleton-list {
  margin-top: 20rpx;
  border-top: 1rpx solid var(--app-border);
}

.search-skeleton-row {
  display: flex;
  gap: 20rpx;
  min-height: 172rpx;
  padding: 22rpx 0;
  border-bottom: 1rpx solid var(--app-border);
}

.search-skeleton-cover,
.search-skeleton-line {
  overflow: hidden;
  position: relative;
  background: var(--app-input);
}

.search-skeleton-cover::after,
.search-skeleton-line::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 26%, rgba(255, 255, 255, 0.14) 45%, transparent 64%);
  content: '';
  animation: discovery-skeleton 1.2s linear infinite;
}

.search-skeleton-cover {
  flex: 0 0 104rpx;
  height: 148rpx;
  border-radius: var(--app-cover-radius, 10rpx);
}

.search-skeleton-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  gap: 16rpx;
}

.search-skeleton-line { width: 92%; height: 18rpx; border-radius: 2rpx; }
.search-skeleton-line.strong { width: 68%; height: 26rpx; }
.search-skeleton-line.short { width: 48%; }

.result-card {
  position: relative;
  margin: 0;
  padding: 24rpx 0;
  border: 0;
  border-bottom: 1rpx solid var(--app-border);
  border-radius: 12rpx;
  background: transparent;
  box-shadow: none;
  animation: discovery-result-enter 340ms var(--app-motion-smooth) both;
  animation-delay: var(--result-enter-delay, 0ms);
}

.result-card:active {
  padding-right: 10rpx;
  padding-left: 10rpx;
  background: color-mix(in srgb, var(--app-panel) 70%, var(--app-accent));
}

.result-cover-shell {
  border-radius: var(--app-cover-radius, 10rpx);
}

.result-copy {
  padding-right: 8rpx;
}

.result-title {
  font-family: var(--app-display-font);
  font-size: 32rpx;
}

.result-type,
.result-source,
.result-quality {
  font-family: var(--app-utility-font);
  letter-spacing: .5rpx;
}

.theme-candy.discover-page .search-panel,
.theme-candy.discover-page .tip-card {
  border: 2rpx solid rgba(52, 42, 50, 0.78);
}

.theme-candy.discover-page .result-card:nth-child(odd) { transform: rotate(-0.25deg); }
.theme-candy.discover-page .result-card:nth-child(even) { transform: rotate(0.2deg); }

.theme-cyber.discover-page .search-panel,
.theme-cyber.discover-page .tip-card,
.theme-cyber.discover-page .search-skeleton-cover,
.theme-cyber.discover-page .search-skeleton-line {
  border-radius: var(--app-card-radius, 8rpx);
}

.theme-cyber.discover-page .result-card {
  border-bottom-color: rgba(52, 214, 255, 0.26);
}

.theme-noirGold.discover-page .result-card {
  border-bottom-color: rgba(213, 175, 98, 0.26);
}

@keyframes discovery-search-orbit {
  0% { transform: rotate(-45deg) scale(.86); }
  72% { transform: rotate(18deg) scale(1.08); }
  100% { transform: rotate(0) scale(1); }
}

@keyframes discovery-skeleton {
  from { transform: translateX(-120%); }
  to { transform: translateX(120%); }
}

@keyframes discovery-result-enter {
  from { opacity: 0; transform: translate3d(0, 16rpx, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}
</style>
