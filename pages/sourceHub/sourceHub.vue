<template>
  <view class="source-hub-page app-page" :style="themeVars">
    <view class="hub-header">
      <button class="icon-button" aria-label="返回" @tap="goBack">‹</button>
      <view class="hub-title-copy">
        <view class="hub-title">{{ sourceName }}</view>
        <text class="hub-subtitle">{{ sourceGroup }} · {{ capabilitySummaryText }}</text>
      </view>
    </view>

    <scroll-view class="hub-scroll" scroll-y :show-scrollbar="false">
      <view class="status-panel" :class="statusClass">
        <view>
          <view class="status-title">{{ statusTitle }}</view>
          <text class="status-text">{{ statusText }}</text>
        </view>
      </view>

      <view class="action-grid">
        <button class="hub-action primary" :disabled="!capability.supportsExplore" @tap="openExplore">
          进入发现
        </button>
        <button class="hub-action" :disabled="!capability.supportsSearch" @tap="focusSearch">
          书源内搜索
        </button>
        <button class="hub-action" @tap="showSessionEditor = !showSessionEditor">
          获取/录入会话
        </button>
        <button class="hub-action" @tap="copyDiagnostics">
          复制诊断
        </button>
        <button class="hub-action" :loading="acceptanceRunning" @tap="runHubAcceptance">
          真实链路验收
        </button>
      </view>

      <view class="search-panel" v-if="capability.supportsSearch">
        <view class="panel-title">书源内搜索</view>
        <view class="search-row">
          <input
            class="field"
            v-model="keyword"
            confirm-type="search"
            placeholder="输入书名"
            @confirm="runSearch"
          />
          <button class="small-button primary" :loading="searching" @tap="runSearch">搜索</button>
        </view>
        <text class="panel-hint" v-if="searchError">{{ searchError }}</text>
        <view class="result-list" v-if="searchBooks.length">
          <view class="result-row" v-for="book in searchBooks" :key="book.bookUrl || book.title" @tap="openBook(book)">
            <view>
              <view class="result-title">{{ book.title }}</view>
              <text class="result-meta">{{ book.author || '未知作者' }}</text>
            </view>
            <text class="result-arrow">›</text>
          </view>
        </view>
      </view>

      <view class="session-panel">
        <view class="panel-title">会话状态</view>
        <view class="session-state">
          <text>{{ sessionStatusText }}</text>
          <button class="small-button" :disabled="!session" @tap="clearSession">清除</button>
        </view>
        <text class="backend-session-state">{{ backendSessionStatusText }}</text>
        <text class="panel-hint failure-text" v-if="backendSessionError">{{ backendSessionError }}</text>
        <view class="android-session-actions" v-if="capability.requiresCookie || capability.requiresWebView">
          <button class="small-button" @tap="openAndroidLogin">打开登录页</button>
          <button class="small-button primary" @tap="saveAndroidLoginSession">保存登录 Cookie</button>
        </view>
        <view class="cookie-summary-list" v-if="cookieSummaryItems.length">
          <text class="cookie-summary-item" v-for="item in cookieSummaryItems" :key="item.host">
            {{ item.host }} · {{ item.cookie }}
          </text>
        </view>
        <view v-if="showSessionEditor">
          <input class="field" v-model="sessionOrigin" placeholder="Origin，例如 https://example.com" />
          <textarea class="session-textarea" v-model="sessionCookie" placeholder="手动粘贴 Cookie / UA / Referer 授权会话"></textarea>
          <input class="field" v-model="sessionUserAgent" placeholder="User-Agent，可选" />
          <input class="field" v-model="sessionReferer" placeholder="Referer，可选" />
          <button class="small-button primary wide" @tap="saveManualSession">保存手动会话</button>
        </view>
      </view>

      <view class="acceptance-panel">
        <view class="panel-title">真实链路验收</view>
        <view class="acceptance-summary">
          <view>
            <text class="acceptance-label">最近结果</text>
            <view class="acceptance-status-row">
              <text class="acceptance-status" :class="acceptanceReport && acceptanceReport.status">
                {{ acceptanceStatusText }}
              </text>
              <text class="acceptance-score" v-if="acceptanceReport">{{ acceptanceReport.score }} 分</text>
            </view>
          </view>
          <view class="acceptance-toolbar">
            <button class="small-button primary" :loading="acceptanceRunning" @tap="runHubAcceptance">验收</button>
            <button class="small-button" :disabled="!acceptanceReport" @tap="copyAcceptanceReport">复制</button>
            <button class="small-button" :disabled="!acceptanceReport" @tap="clearAcceptanceReport">清空</button>
          </view>
        </view>
        <text class="panel-hint" v-if="!acceptanceReport">会依次检查书源兼容性、发现/搜索、详情、目录、正文和书架保存链路。</text>
        <view v-if="acceptanceReport">
          <text class="panel-hint">耗时 {{ acceptanceReport.elapsedMs }}ms · {{ acceptanceReport.startedAt }}</text>
          <text class="panel-hint failure-text" v-if="acceptanceFailureText">{{ acceptanceFailureText }}</text>
          <view class="suggestion-list" v-if="acceptanceSuggestions.length">
            <text class="suggestion-item" v-for="item in acceptanceSuggestions" :key="item">{{ item }}</text>
          </view>
          <view class="acceptance-stage-list">
            <view
              class="acceptance-stage-row"
              v-for="stage in acceptanceStageItems"
              :key="stage.key"
            >
              <view>
                <view class="stage-title">{{ stage.name }}</view>
                <text class="stage-message">{{ stage.message || stage.status }}</text>
              </view>
              <view class="stage-side">
                <text class="stage-status" :class="stage.status">{{ stage.status }}</text>
                <text class="stage-time">{{ stage.elapsedMs }}ms</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view class="capability-grid">
        <view class="capability-item" v-for="item in capabilityItems" :key="item.key" :class="{ active: item.active }">
          <text class="capability-label">{{ item.label }}</text>
          <text class="capability-value">{{ item.active ? '是' : '否' }}</text>
        </view>
      </view>

      <view class="lane-panel">
        <view class="panel-title">执行通道</view>
        <view class="lane-list">
          <text class="lane-chip" v-for="lane in candidateLanes" :key="lane">{{ lane }}</text>
        </view>
        <text class="panel-hint" v-if="capability.notes.length">{{ capability.notes.join('；') }}</text>
      </view>

      <view class="bottom-space"></view>
    </scroll-view>
  </view>
</template>

<script>
import {
  getSourceConfig,
  getSourceDiagnostics,
  saveOnlineBookDraft,
  searchSourceBooks
} from '../../common/bookSources.js'
import { getAppThemeId, getAppThemeStyle } from '../../common/appTheme.js'
import { buildSourceCapability, sourceCapabilitySummary } from '../../common/sourceCapability.js'
import {
  clearSourceSession,
  getSourceSession,
  saveManualSourceSession,
  saveSourceSession,
  sourceSessionStatus
} from '../../common/sourceSession.js'
import { buildCandidateLanes } from '../../common/sourceRouter.js'
import {
  buildCopyableAcceptanceReport,
  clearSourceAcceptanceReports,
  getSourceAcceptanceReports,
  runSourceAcceptance
} from '../../common/sourceAcceptance.js'
import { friendlyErrorMessage } from '../../common/uiFeedback.js'
import apiClient from '../../common/apiClient.js'
import { clearSourceCookies, getSourceCookieSummary, saveSourceCookie } from '../../common/sourceCookieJar.js'
import { openSourceLogin, readSourceLoginCookie } from '../../common/webViewBridge.js'

export default {
  data() {
    return {
      sourceId: '',
      source: null,
      capability: buildSourceCapability({}),
      diagnostics: null,
      session: null,
      keyword: '',
      searchBooks: [],
      searching: false,
      searchError: '',
      acceptanceReport: null,
      acceptanceRunning: false,
      backendSessionSyncing: false,
      backendSessionError: '',
      backendSessionLoaded: false,
      cookieSummaryVersion: 0,
      showSessionEditor: false,
      sessionOrigin: '',
      sessionCookie: '',
      sessionUserAgent: '',
      sessionReferer: '',
      themeId: getAppThemeId()
    }
  },
  computed: {
    themeVars() {
      return getAppThemeStyle(this.themeId)
    },
    sourceName() {
      return this.source && this.source.name || '书源中心'
    },
    sourceGroup() {
      return this.source && this.source.group || '未分组'
    },
    capabilitySummaryText() {
      return sourceCapabilitySummary(this.capability)
    },
    backendSourceId() {
      const id = this.source && this.source.backendId
      const number = Number(id)
      return Number.isFinite(number) && number > 0 ? number : null
    },
    sessionStatusText() {
      const status = sourceSessionStatus(this.session)
      if (status === 'active') return '已有可复用会话'
      if (status === 'expired') return '会话可能已过期'
      if (status === 'empty') return '已保存空会话'
      return '暂无会话'
    },
    backendSessionStatusText() {
      if (!this.backendSourceId) return '本地会话：当前书源尚未绑定后端书源'
      if (!apiClient.getToken()) return '后端会话：登录后可同步到后端'
      if (this.backendSessionSyncing) return '后端会话：同步中'
      if (this.backendSessionError) return '后端会话：同步失败，本地会话仍可使用'
      if (this.backendSessionLoaded) return '后端会话：已同步'
      return '后端会话：待同步'
    },
    sourceLoginUrl() {
      const raw = this.source && (this.source.raw || this.source) || {}
      return String(raw.loginUrl || (this.source && this.source.baseUrl) || raw.bookSourceUrl || '').trim()
    },
    cookieSummaryItems() {
      this.cookieSummaryVersion
      return getSourceCookieSummary(this.sourceId)
    },
    candidateLanes() {
      return buildCandidateLanes('explore', this.capability, this.session)
    },
    statusClass() {
      if (!this.source) return 'blocked'
      if (this.capability.requiresCookie && sourceSessionStatus(this.session) !== 'active') return 'warning'
      if (this.capability.supportsExplore || this.capability.supportsSearch) return 'ready'
      return 'blocked'
    },
    statusTitle() {
      if (!this.source) return '未找到书源'
      if (this.capability.requiresCookie && sourceSessionStatus(this.session) !== 'active') return '需要会话'
      if (this.capability.supportsExplore) return '可进入发现'
      if (this.capability.supportsSearch) return '可使用单源搜索'
      return '暂无可用入口'
    },
    statusText() {
      if (!this.source) return '请从书源管理页重新进入。'
      if (this.capability.requiresCookie && sourceSessionStatus(this.session) !== 'active') {
        return '该书源可能依赖 Cookie、登录态或 WebView。请先录入授权会话，或进入 Android 会话采集流程。'
      }
      if (this.capability.supportsExplore) return '优先从书源自己的发现/分类入口选书。搜索测试仅作为辅助工具。'
      if (this.capability.supportsSearch) return '该书源没有可直接解析的发现入口，可先使用书源内搜索。'
      return '当前规则缺少发现或搜索入口，建议检查书源配置。'
    },
    capabilityItems() {
      return [
        { key: 'search', label: '搜索', active: this.capability.supportsSearch },
        { key: 'explore', label: '发现', active: this.capability.supportsExplore },
        { key: 'detail', label: '详情', active: this.capability.supportsDetail },
        { key: 'toc', label: '目录', active: this.capability.supportsToc },
        { key: 'content', label: '正文', active: this.capability.supportsContent },
        { key: 'cookie', label: 'Cookie', active: this.capability.requiresCookie },
        { key: 'webview', label: 'WebView', active: this.capability.requiresWebView },
        { key: 'render', label: '渲染', active: this.capability.requiresRenderedHtml }
      ]
    },
    acceptanceStatusText() {
      if (!this.acceptanceReport) return '未验收'
      const statusMap = {
        passed: '通过',
        partial: '部分通过',
        failed: '失败',
        incompatible: '不兼容'
      }
      return statusMap[this.acceptanceReport.status] || this.acceptanceReport.status || '未知'
    },
    acceptanceFailureText() {
      if (!this.acceptanceReport || !this.acceptanceReport.failureReason) return ''
      const stage = this.acceptanceReport.failureStage || 'unknown'
      return `失败阶段 ${stage}：${this.acceptanceReport.failureReason}`
    },
    acceptanceStageItems() {
      return this.acceptanceReport && Array.isArray(this.acceptanceReport.stages)
        ? this.acceptanceReport.stages
        : []
    },
    acceptanceSuggestions() {
      return this.acceptanceReport && Array.isArray(this.acceptanceReport.suggestions)
        ? this.acceptanceReport.suggestions
        : []
    }
  },
  onLoad(options = {}) {
    this.sourceId = decodeURIComponent(String(options.sourceId || ''))
    this.refreshSource()
  },
  methods: {
    refreshSource() {
      this.source = getSourceConfig(this.sourceId)
      this.capability = buildSourceCapability(this.source || {})
      this.diagnostics = this.source ? getSourceDiagnostics(this.source) : null
      this.session = getSourceSession(this.sourceId)
      this.acceptanceReport = getSourceAcceptanceReports(this.sourceId).latest
      this.backendSessionLoaded = false
      this.backendSessionError = ''
      this.applySessionToEditor(this.session)
      this.loadBackendSession()
    },
    applySessionToEditor(session) {
      this.sessionOrigin = session && session.origin || ''
      this.sessionCookie = session && session.cookie || ''
      this.sessionUserAgent = session && session.userAgent || ''
      this.sessionReferer = session && session.referer || ''
    },
    mapBackendSession(session) {
      return {
        origin: session && session.origin || '',
        cookie: session && session.cookie || '',
        userAgent: session && session.user_agent || '',
        referer: session && session.referer || '',
        storageStateJson: session && session.storage_state_json || '',
        localStorageJson: session && session.local_storage_json || '',
        sessionStorageJson: session && session.session_storage_json || '',
        expiresAt: Number(session && session.expires_at || 0) || 0,
        lastVerifiedAt: Number(session && session.last_verified_at || 0) || 0,
        status: session && session.status || 'active'
      }
    },
    async loadBackendSession() {
      if (!this.backendSourceId || !apiClient.getToken()) return
      this.backendSessionSyncing = true
      this.backendSessionError = ''
      try {
        const remote = await apiClient.getSourceSession(this.backendSourceId)
        this.backendSessionLoaded = true
        if (remote && remote.exists) {
          this.session = saveSourceSession(this.sourceId, this.mapBackendSession(remote))
          this.applySessionToEditor(this.session)
        }
      } catch (error) {
        this.backendSessionError = friendlyErrorMessage(error, '后端会话同步失败')
      } finally {
        this.backendSessionSyncing = false
      }
    },
    openExplore() {
      if (!this.source || !this.capability.supportsExplore) return
      uni.navigateTo({
        url: `/pages/sourceExplore/sourceExplore?sourceId=${encodeURIComponent(this.sourceId)}`
      })
    },
    focusSearch() {
      this.showSessionEditor = false
    },
    async runSearch() {
      const word = String(this.keyword || '').trim()
      if (!word || this.searching) return
      this.searching = true
      this.searchError = ''
      this.searchBooks = []
      try {
        const result = await searchSourceBooks(this.sourceId, word, { timeoutMs: 8000, limit: 20 })
        this.searchBooks = result.results.map(item => item.book).filter(Boolean)
        if (!this.searchBooks.length) this.searchError = '没有搜索结果'
      } catch (error) {
        this.searchError = friendlyErrorMessage(error, '搜索失败')
      } finally {
        this.searching = false
      }
    },
    async runHubAcceptance() {
      if (!this.source || this.acceptanceRunning) return
      this.acceptanceRunning = true
      try {
        const keyword = String(this.keyword || this.sourceName || '').trim()
        this.acceptanceReport = await runSourceAcceptance(this.sourceId, {
          keyword,
          saveReport: true,
          timeoutMs: 8000,
          limit: 5
        })
        uni.showToast({ title: `验收${this.acceptanceStatusText}`, icon: 'none' })
      } catch (error) {
        uni.showToast({ title: friendlyErrorMessage(error, '验收失败'), icon: 'none' })
      } finally {
        this.acceptanceRunning = false
      }
    },
    copyAcceptanceReport() {
      if (!this.acceptanceReport) return
      uni.setClipboardData({
        data: buildCopyableAcceptanceReport(this.acceptanceReport),
        success: () => uni.showToast({ title: '验收报告已复制', icon: 'none' })
      })
    },
    clearAcceptanceReport() {
      clearSourceAcceptanceReports(this.sourceId)
      this.acceptanceReport = null
      uni.showToast({ title: '验收报告已清空', icon: 'none' })
    },
    async syncBackendSession(session) {
      if (!this.backendSourceId || !apiClient.getToken()) return false
      this.backendSessionSyncing = true
      this.backendSessionError = ''
      try {
        await apiClient.saveSourceSession(this.backendSourceId, session)
        this.backendSessionLoaded = true
        return true
      } catch (error) {
        this.backendSessionError = friendlyErrorMessage(error, '后端会话同步失败')
        return false
      } finally {
        this.backendSessionSyncing = false
      }
    },
    async saveManualSession() {
      if (!this.sourceId) return
      this.session = saveManualSourceSession(this.sourceId, {
        origin: this.sessionOrigin,
        cookie: this.sessionCookie,
        userAgent: this.sessionUserAgent,
        referer: this.sessionReferer
      })
      const synced = await this.syncBackendSession(this.session)
      uni.showToast({ title: synced ? '会话已保存并同步' : '会话已保存', icon: 'none' })
    },
    openAndroidLogin() {
      try {
        openSourceLogin(this.sourceLoginUrl)
        uni.showToast({ title: '请在登录页完成授权', icon: 'none' })
      } catch (error) {
        uni.showToast({ title: friendlyErrorMessage(error, '打开登录页失败'), icon: 'none' })
      }
    },
    async saveAndroidLoginSession() {
      try {
        const url = this.sourceLoginUrl
        const cookie = readSourceLoginCookie(url)
        if (!cookie) throw new Error('未读取到登录 Cookie，请先完成手动登录')
        saveSourceCookie(this.sourceId, url, cookie)
        this.cookieSummaryVersion += 1
        this.sessionOrigin = this.sessionOrigin || url
        this.sessionCookie = cookie
        this.session = saveManualSourceSession(this.sourceId, {
          origin: this.sessionOrigin,
          cookie,
          userAgent: this.sessionUserAgent,
          referer: this.sessionReferer || url
        })
        await this.syncBackendSession(this.session)
        uni.showToast({ title: '登录 Cookie 已保存', icon: 'none' })
      } catch (error) {
        uni.showToast({ title: friendlyErrorMessage(error, '保存登录状态失败'), icon: 'none' })
      }
    },
    async clearSession() {
      clearSourceSession(this.sourceId)
      clearSourceCookies(this.sourceId)
      this.session = null
      this.applySessionToEditor(null)
      if (this.backendSourceId && apiClient.getToken()) {
        try {
          await apiClient.deleteSourceSession(this.backendSourceId)
          this.backendSessionLoaded = true
          this.backendSessionError = ''
        } catch (error) {
          this.backendSessionError = friendlyErrorMessage(error, '后端会话清除失败')
        }
      }
      this.cookieSummaryVersion += 1
      uni.showToast({ title: '会话已清除', icon: 'none' })
    },
    copyDiagnostics() {
      const payload = {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        capability: this.capability,
        sessionStatus: sourceSessionStatus(this.session),
        candidateLanes: this.candidateLanes,
        diagnostics: this.diagnostics || {}
      }
      uni.setClipboardData({
        data: JSON.stringify(payload, null, 2),
        success: () => uni.showToast({ title: '诊断已复制', icon: 'none' })
      })
    },
    openBook(book) {
      if (!book || !book.bookUrl) return
      saveOnlineBookDraft(book)
      uni.navigateTo({ url: '/pages/sourceBook/sourceBook' })
    },
    goBack() {
      uni.navigateBack()
    }
  }
}
</script>

<style scoped>
.source-hub-page {
  min-height: 100vh;
  background: var(--app-bg, #0d171b);
  color: var(--app-text, #f4f6f5);
}

.hub-header {
  min-height: 128rpx;
  padding: 22rpx 28rpx 18rpx;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 20rpx;
  background: var(--app-surface, #111d23);
  border-bottom: 1rpx solid var(--app-border, #29404a);
}

.icon-button,
.small-button,
.hub-action {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
}

.icon-button {
  width: 72rpx;
  height: 72rpx;
  min-width: 72rpx;
  border: 1rpx solid var(--app-border, #29404a);
  border-radius: 8rpx;
  background: var(--app-surface-soft, #17252c);
  color: var(--app-text, #f4f6f5);
  font-size: 48rpx;
}

.icon-button::after,
.small-button::after,
.hub-action::after {
  border: 0;
}

.hub-title-copy {
  min-width: 0;
  flex: 1;
}

.hub-title {
  overflow: hidden;
  color: var(--app-text, #f4f6f5);
  font-size: 36rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hub-subtitle,
.status-text,
.panel-hint,
.backend-session-state,
.result-meta {
  color: var(--app-muted, #a9b6bb);
}

.hub-subtitle,
.status-text,
.panel-hint,
.backend-session-state {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 34rpx;
}

.hub-scroll {
  height: calc(100vh - 128rpx);
}

.status-panel,
.search-panel,
.session-panel,
.acceptance-panel,
.lane-panel,
.capability-grid {
  max-width: 1120px;
  margin: 24rpx auto 0;
  box-sizing: border-box;
}

.status-panel,
.search-panel,
.session-panel,
.acceptance-panel,
.lane-panel {
  padding: 24rpx;
  border: 1rpx solid var(--app-border, #29404a);
  border-radius: 8rpx;
  background: var(--app-surface, #111d23);
}

.status-panel.ready {
  border-color: rgba(142, 207, 194, 0.58);
}

.status-panel.warning {
  border-color: rgba(216, 177, 93, 0.72);
}

.status-panel.blocked {
  border-color: rgba(207, 78, 67, 0.58);
}

.status-title,
.panel-title,
.result-title {
  color: var(--app-text, #f4f6f5);
  font-size: 30rpx;
  font-weight: 800;
}

.action-grid,
.capability-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14rpx;
}

.action-grid {
  max-width: 1120px;
  margin: 24rpx auto 0;
}

.hub-action {
  min-height: 78rpx;
  border-radius: 8rpx;
  color: var(--app-text, #f4f6f5);
  background: var(--app-surface-soft, #17252c);
  font-size: 25rpx;
}

.hub-action.primary,
.small-button.primary {
  color: #102025;
  background: var(--app-accent, #59e1d9);
}

.hub-action[disabled],
.small-button[disabled] {
  opacity: 0.45;
}

.search-row,
.android-session-actions,
.acceptance-summary,
.acceptance-toolbar,
.session-state {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 18rpx;
}

.android-session-actions {
  flex-wrap: wrap;
}

.cookie-summary-list {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-top: 14rpx;
}

.cookie-summary-item {
  display: block;
  padding: 10rpx 12rpx;
  border-radius: 8rpx;
  color: var(--app-muted, #a9b6bb);
  font-size: 22rpx;
  background: var(--app-surface-soft, #17252c);
}

.acceptance-summary {
  justify-content: space-between;
}

.acceptance-toolbar {
  justify-content: flex-end;
  flex-wrap: wrap;
}

.acceptance-label,
.stage-message,
.stage-time,
.suggestion-item {
  color: var(--app-muted, #a9b6bb);
  font-size: 22rpx;
}

.acceptance-status-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 8rpx;
}

.acceptance-status,
.acceptance-score,
.stage-title,
.stage-status {
  color: var(--app-text, #f4f6f5);
  font-size: 27rpx;
  font-weight: 800;
}

.acceptance-status.passed,
.stage-status.passed {
  color: #8ecfc2;
}

.acceptance-status.partial {
  color: #d8b15d;
}

.acceptance-status.failed,
.acceptance-status.incompatible,
.stage-status.failed,
.stage-status.incompatible,
.failure-text {
  color: #ff8a7c;
}

.suggestion-list {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-top: 14rpx;
}

.suggestion-item {
  display: block;
  line-height: 32rpx;
}

.acceptance-stage-list {
  margin-top: 18rpx;
  border-top: 1rpx solid var(--app-border, #29404a);
}

.acceptance-stage-row {
  min-height: 78rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid var(--app-border, #29404a);
}

.stage-message,
.stage-time {
  display: block;
  margin-top: 6rpx;
}

.stage-side {
  flex-shrink: 0;
  text-align: right;
}

.field,
.session-textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1rpx solid var(--app-border, #29404a);
  border-radius: 8rpx;
  color: var(--app-text, #f4f6f5);
  background: var(--app-surface-soft, #17252c);
  font-size: 25rpx;
}

.field {
  height: 76rpx;
  padding: 0 20rpx;
}

.session-textarea {
  height: 150rpx;
  margin-top: 14rpx;
  padding: 18rpx 20rpx;
}

.small-button {
  flex-shrink: 0;
  min-width: 118rpx;
  height: 68rpx;
  border-radius: 8rpx;
  color: var(--app-text, #f4f6f5);
  background: var(--app-surface-soft, #17252c);
  font-size: 24rpx;
}

.small-button.wide {
  width: 100%;
  margin-top: 14rpx;
}

.result-list {
  margin-top: 18rpx;
  border-top: 1rpx solid var(--app-border, #29404a);
}

.result-row {
  min-height: 86rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  border-bottom: 1rpx solid var(--app-border, #29404a);
}

.result-meta {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
}

.result-arrow {
  color: var(--app-muted, #a9b6bb);
  font-size: 38rpx;
}

.session-state {
  justify-content: space-between;
  color: var(--app-muted, #a9b6bb);
  font-size: 24rpx;
}

.capability-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.capability-item {
  min-height: 84rpx;
  padding: 14rpx;
  box-sizing: border-box;
  border: 1rpx solid var(--app-border, #29404a);
  border-radius: 8rpx;
  background: var(--app-surface, #111d23);
}

.capability-item.active {
  border-color: rgba(142, 207, 194, 0.58);
}

.capability-label,
.capability-value {
  display: block;
}

.capability-label {
  color: var(--app-muted, #a9b6bb);
  font-size: 22rpx;
}

.capability-value {
  margin-top: 8rpx;
  color: var(--app-text, #f4f6f5);
  font-size: 27rpx;
  font-weight: 800;
}

.lane-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 16rpx;
}

.lane-chip {
  padding: 9rpx 14rpx;
  border-radius: 8rpx;
  color: var(--app-text, #f4f6f5);
  font-size: 22rpx;
  background: var(--app-surface-soft, #17252c);
}

.bottom-space {
  height: 120rpx;
}

@media (max-width: 760px) {
  .status-panel,
  .search-panel,
  .session-panel,
  .acceptance-panel,
  .lane-panel,
  .capability-grid,
  .action-grid {
    margin-left: 24rpx;
    margin-right: 24rpx;
  }

  .action-grid,
  .capability-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .search-row,
  .android-session-actions,
  .acceptance-summary {
    align-items: stretch;
    flex-direction: column;
  }

  .search-row .small-button,
  .android-session-actions .small-button,
  .acceptance-toolbar .small-button {
    width: 100%;
  }

  .acceptance-toolbar {
    align-items: stretch;
    justify-content: stretch;
  }
}
</style>
