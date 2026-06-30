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
        <view class="session-bridge-report" v-if="sessionBridgeReport">
          <text class="bridge-probe-line">会话 Bridge：{{ sessionBridgeStatusText }}</text>
          <text class="bridge-probe-line">缺失能力：{{ sessionBridgeMissingText }}</text>
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

      <view class="bridge-readiness-panel">
        <view class="panel-title">WebView / JS 就绪度</view>
        <view class="bridge-readiness-header">
          <view>
            <text class="acceptance-label">当前环境</text>
            <view class="bridge-status-row">
              <text class="bridge-status" :class="bridgeReadiness.status">{{ bridgeReadinessStatusText }}</text>
              <text class="lane-chip">{{ bridgeReadiness.recommendedLane }}</text>
            </view>
          </view>
          <text class="bridge-platform">{{ bridgeReadiness.platformLabel }}</text>
        </view>
        <view class="bridge-probe-actions">
          <button class="small-button primary" @tap="runBridgeProbe">检测 Bridge</button>
          <text class="panel-hint" v-if="bridgeProbeReport">{{ bridgeProbeStatusText }}</text>
        </view>
        <view class="bridge-probe-report" v-if="bridgeProbeReport">
          <text class="bridge-probe-line">检测时间：{{ bridgeProbeReport.checkedAt }}</text>
          <text class="bridge-probe-line">缺失能力：{{ bridgeProbeMissingText }}</text>
          <text class="bridge-probe-line">契约信息：{{ bridgeProbeProfileText }}</text>
        </view>
        <view class="rendered-trial-panel">
          <view class="rendered-trial-title">Rendered Fetch 试运行</view>
          <view class="rendered-trial-target" v-if="renderedTrialTarget && renderedTrialTarget.url">
            <text class="bridge-probe-line">推荐目标：{{ renderedTrialTarget.source }} · {{ renderedTrialTarget.reason }}</text>
            <button class="small-button" @tap="applyRenderedTrialTarget">应用推荐</button>
          </view>
          <input class="field" v-model="renderedTrialUrl" placeholder="WebView 渲染 URL，例如 https://example.com" />
          <input class="field compact" v-model="renderedTrialSelector" placeholder="等待选择器，可选，例如 .book-list" />
          <button class="small-button primary wide" :loading="renderedTrialRunning" @tap="runRenderedTrial">
            试运行渲染
          </button>
          <view class="rendered-trial-report" v-if="renderedTrialReport">
            <text class="rendered-trial-status" :class="renderedTrialReport.status">{{ renderedTrialStatusText }}</text>
            <text class="bridge-probe-line">{{ renderedTrialReport.message }}</text>
            <text class="bridge-probe-line" v-if="renderedTrialBridgeText">Bridge：{{ renderedTrialBridgeText }}</text>
            <text class="bridge-probe-line">耗时：{{ renderedTrialReport.elapsedMs }}ms</text>
            <text class="bridge-probe-line" v-if="renderedTrialReport.finalUrl">最终地址：{{ renderedTrialReport.finalUrl }}</text>
            <text class="bridge-probe-line" v-if="renderedTrialReport.htmlLength != null">HTML 长度：{{ renderedTrialReport.htmlLength }}</text>
          </view>
        </view>
        <view class="bridge-blocker-list" v-if="bridgeBlockerItems.length">
          <text class="bridge-blocker-item" v-for="item in bridgeBlockerItems" :key="item.code">
            {{ item.message }}
          </text>
        </view>
        <view class="bridge-diagnostic-list">
          <view class="bridge-diagnostic-item" v-for="item in bridgeDiagnosticItems" :key="item.key">
            <text class="capability-label">{{ item.label }}</text>
            <text class="capability-value">{{ item.value }}</text>
          </view>
        </view>
      </view>

      <view class="android-validation-panel">
        <view class="panel-title">Android 验证清单</view>
        <view class="android-validation-list">
          <view
            class="android-validation-item"
            v-for="item in androidValidationItems"
            :key="item.key"
            :class="item.state"
          >
            <view>
              <view class="validation-title">{{ item.title }}</view>
              <text class="validation-detail">{{ item.detail }}</text>
            </view>
            <text class="validation-state">{{ item.label }}</text>
          </view>
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
import { openSourceLogin, probeWebViewBridge, readSourceLoginCookie } from '../../common/webViewBridge.js'
import { assessSourceBridgeReadiness } from '../../common/sourceBridgeReadiness.js'
import { buildRenderedFetchTrialTarget, runRenderedFetchTrial } from '../../common/sourceRenderedFetchTrial.js'

function validationLabel(state) {
  if (state === 'ready') return '已通过'
  if (state === 'action') return '需处理'
  if (state === 'skipped') return '可跳过'
  return '待验证'
}

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
      sessionBridgeReport: null,
      sessionBridgeScope: '',
      bridgeProbeReport: null,
      renderedTrialTarget: null,
      renderedTrialUrl: '',
      renderedTrialSelector: '',
      renderedTrialReport: null,
      renderedTrialRunning: false,
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
    sessionBridgeStatusText() {
      if (!this.sessionBridgeReport) return ''
      const profile = this.sessionBridgeReport.capabilities && this.sessionBridgeReport.capabilities.profile
      const runtime = profile ? ` · ${profile.runtime || profile.platform || '未知运行时'}` : ''
      return `${this.sessionBridgeReport.status}${runtime}`
    },
    sessionBridgeMissingText() {
      if (!this.sessionBridgeReport) return ''
      return this.sessionBridgeReport.missing && this.sessionBridgeReport.missing.length
        ? this.sessionBridgeReport.missing.join(' / ')
        : '无'
    },
    runtimePlatform() {
      try {
        const info = uni.getSystemInfoSync ? uni.getSystemInfoSync() : {}
        if (typeof plus !== 'undefined' && String(info.platform || '').toLowerCase() === 'android') return 'android'
      } catch (error) {
        return 'h5'
      }
      return 'h5'
    },
    bridgeReadiness() {
      return assessSourceBridgeReadiness(this.source || {}, this.capability, {
        platform: this.runtimePlatform,
        bridge: this.bridgeProbeReport && this.bridgeProbeReport.capabilities
      })
    },
    bridgeReadinessStatusText() {
      const statusMap = {
        'h5-ready': 'H5 可执行',
        'apk-required': '需要 APK',
        'bridge-ready': 'Bridge 可用',
        'bridge-missing': 'Bridge 缺失'
      }
      return statusMap[this.bridgeReadiness.status] || '未知'
    },
    bridgeDiagnosticItems() {
      return this.bridgeReadiness.diagnostics || []
    },
    bridgeBlockerItems() {
      return this.bridgeReadiness.blockers || []
    },
    bridgeProbeStatusText() {
      if (!this.bridgeProbeReport) return ''
      return this.bridgeProbeReport.status === 'ready' ? 'Bridge 自检通过' : this.bridgeProbeReport.message
    },
    bridgeProbeMissingText() {
      if (!this.bridgeProbeReport) return ''
      return this.bridgeProbeReport.missing && this.bridgeProbeReport.missing.length
        ? this.bridgeProbeReport.missing.join(' / ')
        : '无'
    },
    bridgeProbeProfileText() {
      const profile = this.bridgeProbeReport
        && this.bridgeProbeReport.capabilities
        && this.bridgeProbeReport.capabilities.profile
      if (!profile) return '未提供'
      const version = profile.contractVersion ? `v${profile.contractVersion}` : '未知版本'
      const runtime = profile.runtime || profile.platform || '未知运行时'
      return `${version} · ${runtime}`
    },
    renderedTrialStatusText() {
      if (!this.renderedTrialReport) return ''
      const statusMap = {
        passed: '渲染通过',
        unsupported: '当前环境不支持',
        invalid: '请求无效',
        failed: '渲染失败'
      }
      return statusMap[this.renderedTrialReport.status] || '未知'
    },
    renderedTrialBridgeText() {
      const probe = this.renderedTrialReport && this.renderedTrialReport.bridgeProbe
      if (!probe) return ''
      const missing = probe.missing && probe.missing.length ? probe.missing.join(' / ') : '无缺失'
      const profile = probe.capabilities && probe.capabilities.profile
      const runtime = profile ? ` · ${profile.runtime || profile.platform || '未知运行时'}` : ''
      return `${probe.status} · ${missing}${runtime}`
    },
    androidValidationItems() {
      const needsSession = !!(this.capability.requiresCookie || this.capability.requiresWebView)
      const currentSessionStatus = sourceSessionStatus(this.session)
      const bridgeState = this.bridgeProbeReport
        ? (this.bridgeProbeReport.status === 'ready' ? 'ready' : 'action')
        : 'waiting'
      const renderedState = this.renderedTrialReport
        ? (this.renderedTrialReport.status === 'passed' ? 'ready' : 'action')
        : 'waiting'
      const loginState = !needsSession
        ? 'skipped'
        : (this.sessionBridgeScope === 'openLogin' && this.sessionBridgeReport
            ? (this.sessionBridgeReport.status === 'ready' ? 'ready' : 'action')
            : 'waiting')
      const cookieState = currentSessionStatus === 'active'
        ? 'ready'
        : (!needsSession
            ? 'skipped'
            : (this.sessionBridgeScope === 'readCookie' && this.sessionBridgeReport
                ? (this.sessionBridgeReport.status === 'ready' ? 'waiting' : 'action')
                : 'waiting'))
      const acceptanceState = this.acceptanceReport
        ? (this.acceptanceReport.status === 'passed' || this.acceptanceReport.status === 'partial' ? 'ready' : 'action')
        : 'waiting'
      return [
        {
          key: 'bridge-profile',
          title: '1. Bridge Profile',
          state: bridgeState,
          detail: this.bridgeProbeReport
            ? this.bridgeProbeStatusText
            : '先执行 Bridge 自检，确认 runtime profile 和能力清单。'
        },
        {
          key: 'rendered-fetch',
          title: '2. Rendered Fetch',
          state: renderedState,
          detail: this.renderedTrialReport
            ? `${this.renderedTrialStatusText} · ${this.renderedTrialReport.message || ''}`
            : '运行推荐目标，确认渲染 bridge gate 和 DOM 返回。'
        },
        {
          key: 'login-page',
          title: '3. 登录页',
          state: loginState,
          detail: !needsSession
            ? '当前书源未声明必须登录或 Cookie。'
            : (this.sessionBridgeScope === 'openLogin' && this.sessionBridgeReport
                ? this.sessionBridgeStatusText
                : '打开登录页前需要通过 openLogin gate。')
        },
        {
          key: 'cookie-capture',
          title: '4. Cookie',
          state: cookieState,
          detail: currentSessionStatus === 'active'
            ? this.sessionStatusText
            : (!needsSession
                ? '当前书源暂无 Cookie 采集要求。'
                : (this.sessionBridgeScope === 'readCookie' && this.sessionBridgeReport
                    ? `${this.sessionBridgeStatusText} · ${this.sessionBridgeMissingText}`
                    : '保存登录 Cookie 前需要通过 readCookie gate。'))
        },
        {
          key: 'source-acceptance',
          title: '5. 真实链路',
          state: acceptanceState,
          detail: this.acceptanceReport
            ? `${this.acceptanceStatusText} · ${this.acceptanceReport.score || 0} 分`
            : '完成书源搜索、详情、目录、正文和书架链路验收。'
        }
      ].map(item => ({
        ...item,
        label: validationLabel(item.state)
      }))
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
      this.renderedTrialTarget = buildRenderedFetchTrialTarget(this.source || {}, {
        keyword: this.keyword || this.sourceName
      })
      if (!this.renderedTrialUrl) this.applyRenderedTrialTarget()
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
        this.sessionBridgeScope = 'openLogin'
        this.sessionBridgeReport = probeWebViewBridge(['openLogin'])
        if (this.sessionBridgeReport.status !== 'ready') {
          uni.showToast({ title: this.sessionBridgeReport.message, icon: 'none' })
          return
        }
        openSourceLogin(this.sourceLoginUrl)
        uni.showToast({ title: '请在登录页完成授权', icon: 'none' })
      } catch (error) {
        uni.showToast({ title: friendlyErrorMessage(error, '打开登录页失败'), icon: 'none' })
      }
    },
    async saveAndroidLoginSession() {
      try {
        this.sessionBridgeScope = 'readCookie'
        this.sessionBridgeReport = probeWebViewBridge(['readCookie'])
        if (this.sessionBridgeReport.status !== 'ready') {
          uni.showToast({ title: this.sessionBridgeReport.message, icon: 'none' })
          return
        }
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
    runBridgeProbe() {
      this.bridgeProbeReport = probeWebViewBridge()
      uni.showToast({ title: this.bridgeProbeStatusText, icon: 'none' })
    },
    applyRenderedTrialTarget() {
      if (!this.renderedTrialTarget) return
      this.renderedTrialUrl = this.renderedTrialTarget.url || ''
      this.renderedTrialSelector = this.renderedTrialTarget.waitSelector || ''
    },
    async runRenderedTrial() {
      if (this.renderedTrialRunning) return
      this.renderedTrialRunning = true
      try {
        this.renderedTrialReport = await runRenderedFetchTrial({
          url: this.renderedTrialUrl || this.sourceLoginUrl,
          waitSelector: this.renderedTrialSelector,
          cookie: this.sessionCookie,
          userAgent: this.sessionUserAgent,
          referer: this.sessionReferer,
          timeoutMs: 8000
        })
        uni.showToast({ title: this.renderedTrialStatusText, icon: 'none' })
      } finally {
        this.renderedTrialRunning = false
      }
    },
    copyDiagnostics() {
      const payload = {
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        capability: this.capability,
        bridgeReadiness: this.bridgeReadiness,
        androidValidationItems: this.androidValidationItems,
        sessionBridgeReport: this.sessionBridgeReport,
        bridgeProbeReport: this.bridgeProbeReport,
        renderedTrialTarget: this.renderedTrialTarget,
        renderedTrialReport: this.renderedTrialReport,
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
.bridge-readiness-panel,
.android-validation-panel,
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
.bridge-readiness-panel,
.android-validation-panel,
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
.bridge-readiness-header,
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

.bridge-readiness-header {
  justify-content: space-between;
}

.bridge-status-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 8rpx;
}

.bridge-status,
.bridge-platform {
  color: var(--app-text, #f4f6f5);
  font-size: 27rpx;
  font-weight: 800;
}

.bridge-status.h5-ready,
.bridge-status.bridge-ready {
  color: #8ecfc2;
}

.bridge-status.apk-required,
.bridge-status.bridge-missing {
  color: #d8b15d;
}

.bridge-blocker-list,
.bridge-probe-report,
.session-bridge-report,
.rendered-trial-panel,
.rendered-trial-report,
.bridge-diagnostic-list {
  margin-top: 16rpx;
}

.bridge-probe-actions {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 18rpx;
}

.bridge-probe-report,
.session-bridge-report {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.bridge-probe-line {
  color: var(--app-muted, #a9b6bb);
  font-size: 23rpx;
  line-height: 32rpx;
}

.rendered-trial-panel {
  padding-top: 16rpx;
  border-top: 1rpx solid var(--app-border, #29404a);
}

.rendered-trial-title {
  color: var(--app-text, #f4f6f5);
  font-size: 25rpx;
  font-weight: 800;
}

.rendered-trial-target {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  margin-top: 12rpx;
  padding: 10rpx 12rpx;
  border-radius: 8rpx;
  background: var(--app-surface-soft, #17252c);
}

.field.compact {
  margin-top: 12rpx;
}

.rendered-trial-panel .wide {
  margin-top: 12rpx;
}

.rendered-trial-report {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.rendered-trial-status {
  color: var(--app-text, #f4f6f5);
  font-size: 26rpx;
  font-weight: 800;
}

.rendered-trial-status.passed {
  color: #8ecfc2;
}

.rendered-trial-status.unsupported,
.rendered-trial-status.invalid {
  color: #d8b15d;
}

.rendered-trial-status.failed {
  color: #ff8a7c;
}

.bridge-blocker-list {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.bridge-blocker-item {
  display: block;
  padding: 10rpx 12rpx;
  border-radius: 8rpx;
  color: #ffcf87;
  font-size: 23rpx;
  line-height: 32rpx;
  background: rgba(216, 177, 93, 0.12);
}

.bridge-diagnostic-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}

.bridge-diagnostic-item {
  min-height: 78rpx;
  padding: 12rpx;
  box-sizing: border-box;
  border: 1rpx solid var(--app-border, #29404a);
  border-radius: 8rpx;
  background: var(--app-surface-soft, #17252c);
}

.android-validation-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 18rpx;
}

.android-validation-item {
  min-height: 82rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 14rpx;
  box-sizing: border-box;
  border: 1rpx solid var(--app-border, #29404a);
  border-radius: 8rpx;
  background: var(--app-surface-soft, #17252c);
}

.android-validation-item.ready {
  border-color: rgba(142, 207, 194, 0.58);
}

.android-validation-item.action {
  border-color: rgba(207, 78, 67, 0.58);
}

.android-validation-item.skipped {
  opacity: 0.72;
}

.validation-title,
.validation-state {
  color: var(--app-text, #f4f6f5);
  font-size: 25rpx;
  font-weight: 800;
}

.validation-detail {
  display: block;
  margin-top: 6rpx;
  color: var(--app-muted, #a9b6bb);
  font-size: 22rpx;
  line-height: 32rpx;
}

.validation-state {
  flex-shrink: 0;
}

.android-validation-item.ready .validation-state {
  color: #8ecfc2;
}

.android-validation-item.action .validation-state {
  color: #ff8a7c;
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
  .bridge-readiness-panel,
  .android-validation-panel,
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
  .bridge-readiness-header,
  .bridge-probe-actions,
  .rendered-trial-target,
  .acceptance-summary {
    align-items: stretch;
    flex-direction: column;
  }

  .android-validation-item {
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

  .bridge-probe-actions .small-button {
    width: 100%;
  }

  .rendered-trial-target .small-button {
    width: 100%;
  }

  .bridge-diagnostic-list {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
}
</style>
