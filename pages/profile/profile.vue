<template>
  <view class="tab-page-shell" :class="themeClass" :style="themeVars">
  <view class="profile-page app-page tab-page-content" :class="[themeClass, pageMotionClass]">
    <view class="top-zone">
      <view>
        <text class="eyebrow">ME</text>
        <view class="title">我的</view>
      </view>
      <button class="help-button" @tap="showHelp">?</button>
    </view>

    <view class="backend-card">
      <view class="backend-head" @tap="backendExpanded = !backendExpanded">
        <view>
          <view class="backend-title">阅读服务</view>
          <text class="backend-desc">{{ backendStatusDesc }}</text>
        </view>
        <view class="backend-head-right">
          <text class="backend-status" :class="{ online: backend.user, loading: backend.loading }">{{ backend.user ? '已连接' : '未连接' }}</text>
          <text class="backend-expand-arrow">{{ backendExpanded ? '▴' : '▾' }}</text>
        </view>
      </view>

      <view class="backend-detail" v-if="backendExpanded">
        <input class="backend-input" v-model="backend.baseUrl" placeholder="后端地址" />
        <view class="backend-tip" :class="{ warning: !backendAddressTip.mobileReady }">
          <text>{{ backendAddressTip.message }}</text>
        </view>
        <view class="backend-grid">
          <input class="backend-input" v-model="backend.username" placeholder="用户名" />
          <input class="backend-input" v-model="backend.password" password placeholder="密码" />
        </view>
        <text class="backend-error app-motion-feedback" v-if="backend.error">{{ backend.error }}</text>
        <text class="backend-health app-motion-feedback" v-if="backend.health">{{ backend.health }}</text>
        <view class="backend-hint" v-if="!backend.user && debugModeEnabled">
          <view class="hint-title">FastAPI 未启动时</view>
          <text class="hint-command" v-for="line in backendStartCommands" :key="line">{{ line }}</text>
        </view>
        <view class="backend-actions">
          <button class="backend-button" @tap="saveBackendBaseUrl">保存地址</button>
          <button class="backend-button" :loading="backend.loading" @tap="checkBackendHealth">检查连接</button>
          <button class="backend-button primary" :loading="backend.loading" @tap="loginBackend">登录后端</button>
          <button class="backend-button" :loading="backend.loading" @tap="refreshBackendMe">刷新状态</button>
          <button class="backend-button" @tap="copyBackendDiagnostics">复制诊断</button>
          <button class="backend-button" v-if="debugModeEnabled" @tap="openSwagger">打开 Swagger</button>
          <button class="backend-button ghost" @tap="logoutBackend">退出</button>
        </view>
      </view>
    </view>

    <view class="development-card" v-if="debugModeEnabled && devPanelVisible">
      <view class="development-head">
        <view>
          <text class="eyebrow">DEBUG MODE</text>
          <view class="development-title">开发与验收</view>
          <text class="development-desc">调试模式已开启。这里保留打包、自检和录屏准备工具。</text>
        </view>
        <button class="debug-off-button" @tap="disableDebugMode">关闭</button>
      </view>

      <view class="dev-panel demo-card">
        <view class="demo-head">
          <view>
            <view class="demo-title">一键演示准备</view>
            <text class="demo-desc">{{ demoMode.backendMessage }}</text>
          </view>
          <button class="demo-button primary" @tap="applyDemoMode">预填</button>
        </view>
        <view class="demo-actions">
          <button class="demo-button" @tap="copyDemoCommands">复制启动命令</button>
          <button class="demo-button" @tap="goLibrary">去书源页</button>
        </view>
        <view class="demo-step" v-for="item in demoModeChecklist" :key="item.id">
          <text class="demo-state" :class="item.state">{{ item.label }}</text>
          <view class="demo-copy">
            <view class="demo-step-title">{{ item.title }}</view>
            <text class="demo-step-detail">{{ item.detail }}</text>
          </view>
        </view>
        <view class="offline-zone">
          <view class="offline-head">
            <view class="offline-title">本地阅读兜底</view>
            <text class="offline-mode">{{ offlineDemoStatus.mode === 'online' ? '在线增强' : '本地可读' }}</text>
          </view>
          <text class="offline-summary">{{ offlineDemoStatus.summary }}</text>
          <view class="demo-step" v-for="item in offlineDemoStatus.items" :key="item.id">
            <text class="demo-state" :class="item.state">{{ item.label }}</text>
            <view class="demo-copy">
              <view class="demo-step-title">{{ item.title }}</view>
              <text class="demo-step-detail">{{ item.detail }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="dev-panel apk-card">
        <view class="apk-head">
          <view>
            <view class="apk-title">APK 展示准备</view>
            <text class="apk-desc">{{ androidReadiness.summary }}</text>
          </view>
          <text class="apk-badge" :class="{ ready: androidReadiness.canRecordDemo }">
            {{ androidReadiness.readyCount }}/3
          </text>
        </view>
        <view class="apk-check" v-for="item in androidReadiness.items" :key="item.id">
          <text class="apk-state" :class="item.state">{{ item.label }}</text>
          <view class="apk-copy">
            <view class="apk-check-title">{{ item.title }}</view>
            <text class="apk-check-detail">{{ item.detail }}</text>
          </view>
        </view>
      </view>

      <view class="dev-panel tts-acceptance-card" @tap="openTtsAcceptance">
        <view class="tts-acceptance-copy">
          <text class="eyebrow">REAL VOICE LAB</text>
          <view class="tts-acceptance-title">TTS 自动验收</view>
          <text class="tts-acceptance-desc">验证五种真实音色、缓存、三章连续播放、故障降级与后台停止。</text>
        </view>
        <view class="tts-acceptance-button">开始</view>
      </view>

      <view class="dev-panel validation-card">
        <view class="validation-head">
          <view>
            <view class="validation-title">真机验收</view>
            <text class="validation-desc">
              {{ deviceValidationSummary.complete ? '真机主链路已验收完成。' : `还剩 ${deviceValidationSummary.remaining} 项未验收。` }}
            </text>
          </view>
          <text class="validation-badge" :class="{ ready: deviceValidationSummary.complete }">
            {{ deviceValidationSummary.passed }}/{{ deviceValidationSummary.total }}
          </text>
        </view>
        <view class="validation-actions">
          <button class="validation-button" @tap="resetDeviceValidation">重置验收</button>
        </view>
        <view
          class="validation-row"
          v-for="item in deviceValidationItems"
          :key="item.id"
          :class="{ checked: deviceValidationState[item.id] }"
          @tap="toggleDeviceValidation(item.id)"
        >
          <text class="validation-check">{{ deviceValidationState[item.id] ? '通过' : '未验' }}</text>
          <view class="validation-copy">
            <view class="validation-item-title">{{ item.title }}</view>
            <text class="validation-item-desc">{{ item.desc }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="settings-list">
      <text class="section-label settings-section-first">常用</text>
      <view class="setting-group">
        <view class="setting-item" v-for="item in mainItems" :key="item.id" @tap="openItem(item.id)">
          <text class="setting-icon">{{ item.icon }}</text>
          <view class="setting-copy">
            <view class="setting-title">{{ item.id === 'web' ? '阅读服务' : item.title }}</view>
            <text class="setting-desc">{{ item.id === 'web' ? '登录后可使用 AI 总结与问答' : item.desc }}</text>
          </view>
          <view class="setting-extra" v-if="item.id === 'theme'">{{ activeThemeName }}</view>
          <view class="setting-extra" v-if="item.id === 'web'">{{ backend.user ? '已连接' : '未启动' }}</view>
        </view>
      </view>

      <text class="section-label">设置</text>

      <view class="setting-group">
        <view class="setting-item" @tap="exportBackup">
          <text class="setting-icon">▰</text>
          <view class="setting-copy">
            <view class="setting-title">备份与恢复</view>
            <text class="setting-desc">复制追书记录，旧版数据可在书源页恢复</text>
          </view>
        </view>
        <view class="setting-item" @tap="openThemePanel">
          <text class="setting-icon">▣</text>
          <view class="setting-copy">
            <view class="setting-title">主题设置</view>
            <text class="setting-desc">与界面/颜色相关的一些设置</text>
          </view>
        </view>
        <view class="setting-item" @tap="cycleMotionPreference">
          <text class="setting-icon">◌</text>
          <view class="setting-copy">
            <view class="setting-title">动效效果</view>
            <text class="setting-desc">控制转场、弹层与阅读翻页的动态效果</text>
          </view>
          <view class="setting-extra">{{ motionPreferenceLabel }}</view>
        </view>
        <view class="setting-item" aria-label="设备性能自动适配状态">
          <text class="setting-icon">▦</text>
          <view class="setting-copy">
            <view class="setting-title">性能适配</view>
            <text class="setting-desc">按设备能力自动精简装饰动效，阅读功能保持完整</text>
          </view>
          <view class="setting-extra">{{ performanceProfileLabel }}</view>
        </view>
        <view class="setting-item" @tap="toggleTimeAwareness">
          <text class="setting-icon">◒</text>
          <view class="setting-copy">
            <view class="setting-title">时间氛围</view>
            <text class="setting-desc">按清晨、白天、傍晚和深夜轻微调整环境光与书封节奏</text>
          </view>
          <view class="setting-extra">{{ timeAwarenessLabel }}</view>
        </view>
        <view class="setting-item" @tap="showBoundary">
          <text class="setting-icon">⌾</text>
          <view class="setting-copy">
            <view class="setting-title">其它设置</view>
            <text class="setting-desc">书源解码边界、缓存和兼容说明</text>
          </view>
        </view>
        <view class="setting-item about-item" @tap="onVersionTap">
          <text class="setting-icon">i</text>
          <view class="setting-copy">
            <view class="setting-title">关于</view>
            <text class="setting-desc">{{ debugModeEnabled ? (devPanelVisible ? '调试面板已展开 · 点击隐藏' : '调试模式已开启 · 点击展开面板') : '' }}</text>
          </view>
          <view class="setting-extra">V1</view>
        </view>
      </view>
    </view>
  </view>

    <!-- Keep the theme studio outside the transformed page so fixed actions stay viewport-bound. -->
    <view class="theme-panel-mask app-motion-overlay" v-if="themeVisible" @tap="closeThemePanel"></view>
    <view class="theme-panel app-floating-panel app-motion-sheet profile-theme-panel-enter" :class="themeClass" v-if="themeVisible">
      <view class="panel-head">
        <view>
          <view class="panel-kicker">PERSONAL STYLE</view>
          <view class="panel-title">选择你的阅读气质</view>
          <text class="panel-desc">轻触预览，确认后才会保存</text>
        </view>
        <button class="close-button" aria-label="关闭主题选择" @tap="closeThemePanel">×</button>
      </view>
      <scroll-view class="theme-grid" scroll-y :show-scrollbar="false">
        <view class="theme-grid-inner">
          <view
            class="theme-card"
            v-for="theme in themes"
            :key="theme.id"
            :class="{ active: pendingThemeId === theme.id, saved: savedThemeId === theme.id, 'app-motion-feedback': pendingThemeId === theme.id && pendingThemeId !== savedThemeId }"
            @tap="previewTheme(theme.id)"
          >
            <view class="theme-preview" :class="`theme-${theme.id}`" :style="theme.vars">
              <view class="theme-preview-pattern"></view>
              <view class="theme-preview-seal"></view>
              <view class="theme-preview-top">
                <text>{{ theme.preview.kicker }}</text>
                <text class="theme-preview-dot">●</text>
              </view>
              <view class="theme-preview-book">
                <view class="theme-preview-spine"></view>
                <view>
                  <text class="theme-preview-title">{{ theme.preview.sample }}</text>
                  <text class="theme-preview-motif">{{ theme.preview.motif }}</text>
                </view>
                <text class="theme-preview-arrow">›</text>
              </view>
            </view>
            <view class="theme-card-copy">
              <view class="theme-name-line">
                <view class="theme-name">{{ theme.name }}</view>
                <text class="theme-saved-badge" v-if="savedThemeId === theme.id" aria-label="当前主题">✓</text>
              </view>
              <text class="theme-category">{{ theme.category }}</text>
              <text class="theme-desc">{{ theme.desc }}</text>
            </view>
            <view class="theme-swatch">
              <text
                class="swatch-dot"
                v-for="color in theme.swatch"
                :key="color"
                :style="{ background: color }"
              ></text>
            </view>
          </view>
        </view>
      </scroll-view>
      <view class="theme-panel-actions">
        <button class="theme-cancel-button" @tap="closeThemePanel">取消</button>
        <button class="theme-apply-button" @tap="applyTheme">应用 {{ pendingThemeName }}</button>
      </view>
    </view>
  <GlassTabBar active-path="pages/profile/profile" />
  </view>
</template>

<script>
import { exportTrackedBooks } from '../../common/tracking.js'
import {
  appThemes,
  cancelAppThemeMorph,
  getAppThemeId,
  getAppThemeRuntimeStyle,
  morphAppTheme
} from '../../common/appTheme.js'
import GlassTabBar from '../../custom-tab-bar/index.vue'
import { getMotionPreference, getNavigationMotion, saveMotionPreference } from '../../common/motion.js'
import {
  getCurrentTimeAwareness,
  getTimeAwarenessEnabled,
  refreshTimeAwareness,
  saveTimeAwarenessEnabled
} from '../../common/timeAwareness.js'
import { markTabRouteShown } from '../../common/tabNavigation.js'
import { ensureNativeTabBarHidden } from '../../common/tabShell.js'
import apiClient from '../../common/apiClient.js'
import { analyzeBackendBaseUrl, buildBackendStartCommands } from '../../common/backendConnection.js'
import { getAndroidDemoReadiness } from '../../common/androidReadiness.js'
import { builtInBooks } from '../../common/books.js'
import {
  DEVICE_VALIDATION_ITEMS,
  getDeviceValidationState,
  getDeviceValidationSummary,
  resetDeviceValidationState,
  toggleDeviceValidationItem
} from '../../common/deviceValidation.js'
import { buildDemoModeChecklist, buildDemoModePreset, buildOfflineDemoStatus } from '../../common/demoMode.js'
import {
  getDebugModeState,
  setDebugModeEnabled,
  tapDebugModeVersion
} from '../../common/debugMode.js'
import { friendlyErrorMessage } from '../../common/uiFeedback.js'
import { getCurrentPerformanceProfile, refreshPerformanceProfile } from '../../common/performanceProfile.js'

export default {
  components: { GlassTabBar },
  data() {
    return {
      themeId: getAppThemeId(),
      savedThemeId: getAppThemeId(),
      pendingThemeId: getAppThemeId(),
      themes: appThemes,
      themeVisible: false,
      pageMotionKind: '',
      pageMotionDirection: 'forward',
      themePreviewFrame: null,
      themePreviewFrameType: '',
      themePreviewToken: 0,
      motionPreference: getMotionPreference(),
      performanceProfile: getCurrentPerformanceProfile(),
      timeAwarenessEnabled: getTimeAwarenessEnabled(),
      timeAwarenessState: getCurrentTimeAwareness(),
      backend: {
        baseUrl: '',
        username: 'student',
        password: 'secret123',
        user: null,
        loading: false,
        health: '',
        error: ''
      },
      backendExpanded: false,
      devPanelVisible: false,
      deviceValidationItems: DEVICE_VALIDATION_ITEMS,
      deviceValidationState: getDeviceValidationState(),
      debugModeState: getDebugModeState(),
      mainItems: [
        { id: 'source', icon: '源', title: '书源管理', desc: '导入、检测和管理外部书源' },
        { id: 'aiHistory', icon: 'AI', title: 'AI 记录', desc: '查看后端保存的总结和问答历史' },
        { id: 'theme', icon: '♜', title: '主题模式', desc: '选择主题模式' },
        { id: 'web', icon: '◎', title: '后端服务', desc: '账号和 AI 增强能力连接状态' }
      ]
    }
  },
  computed: {
    debugModeEnabled() {
      return this.debugModeState.enabled
    },
    themeVars() {
      return getAppThemeRuntimeStyle(this.themeId)
    },
    themeClass() {
      return `theme-${this.themeId}`
    },
    pageMotionClass() {
      return this.pageMotionKind === 'tab'
        ? `app-tab-enter app-tab-enter-${this.pageMotionDirection === 'back' ? 'back' : 'forward'}`
        : ''
    },
    activeThemeName() {
      return (this.themes.find(theme => theme.id === this.themeId) || this.themes[0]).name
    },
    pendingThemeName() {
      return (this.themes.find(theme => theme.id === this.pendingThemeId) || this.themes[0]).name
    },
    themeAccent() {
      return getAppThemeRuntimeStyle(this.themeId)['--app-accent']
    },
    motionPreferenceLabel() {
      return {
        system: '跟随系统',
        reduced: '减少动效',
        full: '完整动效'
      }[this.motionPreference] || '跟随系统'
    },
    performanceProfileLabel() {
      return `${(this.performanceProfile && this.performanceProfile.label) || '自动'}档`
    },
    timeAwarenessLabel() {
      return this.timeAwarenessEnabled
        ? (this.timeAwarenessState.label || '跟随时间')
        : '已关闭'
    },
    backendStatusDesc() {
      return this.backend.user
        ? `已登录：${this.backend.user.username}`
        : '连接 FastAPI 后端，启用 AI 总结和问答'
    },
    backendAddressTip() {
      return analyzeBackendBaseUrl(this.backend.baseUrl)
    },
    backendStartCommands() {
      return buildBackendStartCommands(this.backendAddressTip.mobileReady ? this.backendAddressTip.host : '电脑局域网 IP')
    },
    androidReadiness() {
      return getAndroidDemoReadiness({
        backendBaseUrl: this.backend.baseUrl,
        backendUser: this.backend.user,
        backendHealth: this.backend.health
      })
    },
    demoMode() {
      return buildDemoModePreset(this.backend.baseUrl)
    },
    demoModeChecklist() {
      return buildDemoModeChecklist({
        backendReady: this.backendAddressTip.mobileReady,
        healthReady: !!this.backend.health,
        loggedIn: !!this.backend.user
      })
    },
    offlineDemoStatus() {
      return buildOfflineDemoStatus({
        builtInBookCount: builtInBooks.length,
        hasTxtSample: true,
        backendReady: this.backendAddressTip.mobileReady && !!this.backend.health,
        loggedIn: !!this.backend.user
      })
    },
    deviceValidationSummary() {
      return getDeviceValidationSummary(this.deviceValidationState)
    }
  },
  onShow() {
    markTabRouteShown('pages/profile/profile')
    ensureNativeTabBarHidden()
    const savedThemeId = getAppThemeId()
    this.savedThemeId = savedThemeId
    this.pendingThemeId = savedThemeId
    this.themeId = savedThemeId
    const motion = getNavigationMotion()
    this.pageMotionKind = motion.kind
    this.pageMotionDirection = motion.direction
    this.motionPreference = getMotionPreference()
    this.performanceProfile = getCurrentPerformanceProfile()
    this.timeAwarenessEnabled = getTimeAwarenessEnabled()
    this.timeAwarenessState = refreshTimeAwareness()
    this.debugModeState = getDebugModeState()
    this.loadBackendState()
  },
  onUnload() {
    this.clearThemePreview()
    cancelAppThemeMorph()
  },
  onBackPress() {
    if (this.themeVisible) {
      this.closeThemePanel()
      return true
    }
    return false
  },
  methods: {
    cycleMotionPreference() {
      const preferences = ['system', 'reduced', 'full']
      const index = preferences.indexOf(this.motionPreference)
      const next = preferences[(index + 1) % preferences.length]
      const state = saveMotionPreference(next)
      this.motionPreference = state.preference
      this.performanceProfile = refreshPerformanceProfile({ motionReduced: state.reduced })
      uni.showToast({ title: `动效：${this.motionPreferenceLabel}`, icon: 'none' })
    },
    toggleTimeAwareness() {
      const state = saveTimeAwarenessEnabled(!this.timeAwarenessEnabled)
      this.timeAwarenessEnabled = state.enabled
      this.timeAwarenessState = state
      uni.showToast({ title: `时间氛围：${this.timeAwarenessLabel}`, icon: 'none' })
    },
    loadBackendState() {
      this.backend.baseUrl = apiClient.getBaseUrl()
      if (apiClient.getToken()) {
        this.refreshBackendMe({ silent: true })
      } else {
        this.backend.user = null
      }
    },
    async loginBackend() {
      this.backend.loading = true
      this.backend.error = ''
      this.backend.health = ''
      try {
        this.backend.baseUrl = apiClient.setBaseUrl(this.backend.baseUrl)
        await apiClient.login(this.backend.username.trim(), this.backend.password)
        await this.refreshBackendMe({ silent: true, throwOnError: true })
        uni.showToast({ title: '后端登录成功', icon: 'none' })
      } catch (error) {
        this.backend.user = null
        this.backend.error = friendlyErrorMessage(error, '登录失败')
        uni.showToast({ title: this.backend.error, icon: 'none' })
      } finally {
        this.backend.loading = false
      }
    },
    async refreshBackendMe(options = {}) {
      this.backend.loading = true
      this.backend.error = ''
      this.backend.health = ''
      try {
        this.backend.baseUrl = apiClient.setBaseUrl(this.backend.baseUrl)
        this.backend.user = await apiClient.getMe()
        if (!options.silent) {
          uni.showToast({ title: '后端状态正常', icon: 'none' })
        }
      } catch (error) {
        this.backend.user = null
        this.backend.error = friendlyErrorMessage(error, '后端未连接')
        if (options.throwOnError) throw error
        if (!options.silent) {
          uni.showToast({ title: this.backend.error, icon: 'none' })
        }
      } finally {
        this.backend.loading = false
      }
    },
    saveBackendBaseUrl() {
      this.backend.baseUrl = apiClient.setBaseUrl(this.backend.baseUrl)
      const message = this.backendAddressTip.mobileReady ? '后端地址已保存，可用于真机联调' : '后端地址已保存，真机请改用局域网 IP'
      uni.showToast({ title: message, icon: 'none' })
    },
    async checkBackendHealth() {
      this.backend.loading = true
      this.backend.error = ''
      this.backend.health = ''
      try {
        this.backend.baseUrl = apiClient.setBaseUrl(this.backend.baseUrl)
        const result = await apiClient.healthCheck()
        this.backend.health = `连接检查通过：${result.status || 'ok'}`
        uni.showToast({ title: '连接检查通过', icon: 'none' })
      } catch (error) {
        this.backend.health = ''
        this.backend.error = friendlyErrorMessage(error, '连接检查失败')
        uni.showToast({ title: this.backend.error, icon: 'none' })
      } finally {
        this.backend.loading = false
      }
    },
    logoutBackend() {
      apiClient.clearToken()
      this.backend.user = null
      this.backend.error = ''
      this.backend.health = ''
      uni.showToast({ title: '已退出后端登录', icon: 'none' })
    },
    copyBackendDiagnostics() {
      const diagnostics = apiClient.getDiagnostics ? apiClient.getDiagnostics() : []
      const payload = diagnostics.length
        ? JSON.stringify(diagnostics, null, 2)
        : '暂无诊断信息。请先点“检查连接”或“登录后端”后再复制。'
      uni.setClipboardData({
        data: payload,
        success: () => uni.showToast({ title: '诊断日志已复制', icon: 'none' })
      })
    },
    openItem(id) {
      if (id === 'source') {
        this.goLibrary()
        return
      }
      if (id === 'theme') {
        this.openThemePanel()
        return
      }
      if (id === 'aiHistory') {
        uni.navigateTo({ url: '/pages/aiHistory/aiHistory' })
        return
      }
      if (id === 'web') this.refreshBackendMe()
    },
    goLibrary() {
      uni.switchTab({ url: '/pages/library/library' })
    },
    openTtsAcceptance() {
      uni.navigateTo({ url: '/pages/ttsAcceptance/ttsAcceptance?auto=1' })
    },
    toggleDeviceValidation(itemId) {
      this.deviceValidationState = toggleDeviceValidationItem(itemId)
    },
    resetDeviceValidation() {
      this.deviceValidationState = resetDeviceValidationState()
      uni.showToast({ title: '验收清单已重置', icon: 'none' })
    },
    onVersionTap() {
      if (this.debugModeEnabled) {
        this.devPanelVisible = !this.devPanelVisible
        uni.showToast({ title: this.devPanelVisible ? '调试面板已展开' : '调试面板已隐藏', icon: 'none' })
        return
      }
      const state = tapDebugModeVersion()
      this.debugModeState = state
      if (state.enabled) {
        this.devPanelVisible = true
        uni.showToast({ title: '调试模式已开启', icon: 'none' })
        return
      }
      uni.showToast({ title: `再点 ${state.remaining} 次开启调试模式`, icon: 'none' })
    },
    disableDebugMode() {
      this.debugModeState = setDebugModeEnabled(false)
      uni.showToast({ title: '调试模式已关闭', icon: 'none' })
    },
    openSwagger() {
      const url = `${apiClient.getBaseUrl()}/docs`
      if (typeof window !== 'undefined' && window.open) {
        window.open(url, '_blank')
        return
      }
      uni.setClipboardData({
        data: url,
        success: () => uni.showToast({ title: 'Swagger 地址已复制', icon: 'none' })
      })
    },
    applyDemoMode() {
      const preset = buildDemoModePreset(this.backend.baseUrl)
      this.backend.username = preset.username
      this.backend.password = preset.password
      this.backend.baseUrl = apiClient.setBaseUrl(preset.baseUrl)
      this.backend.error = ''
      uni.showToast({
        title: preset.backendReady ? '演示账号已预填' : '已预填账号，真机请改局域网 IP',
        icon: 'none'
      })
    },
    copyDemoCommands() {
      uni.setClipboardData({
        data: this.backendStartCommands.join('\n'),
        success: () => uni.showToast({ title: '后端启动命令已复制', icon: 'none' })
      })
    },
    openThemePanel() {
      this.clearThemePreview()
      const savedThemeId = getAppThemeId()
      this.savedThemeId = savedThemeId
      this.pendingThemeId = savedThemeId
      this.themeId = savedThemeId
      this.themeVisible = true
    },
    previewTheme(themeId) {
      if (!this.themes.some(theme => theme.id === themeId)) return
      this.pendingThemeId = themeId
      this.clearThemePreview()
      if (themeId === this.themeId) return
      const token = ++this.themePreviewToken
      const runPreview = () => {
        if (token !== this.themePreviewToken) return
        this.themePreviewFrame = null
        this.themePreviewFrameType = ''
        morphAppTheme(themeId, {
          persist: false,
          preview: true,
          commit: nextThemeId => this.commitThemeState(nextThemeId)
        })
      }
      if (typeof requestAnimationFrame === 'function') {
        this.themePreviewFrameType = 'animation-frame'
        this.themePreviewFrame = requestAnimationFrame(runPreview)
      } else {
        this.themePreviewFrameType = 'timeout'
        this.themePreviewFrame = setTimeout(runPreview, 0)
      }
    },
    clearThemePreview() {
      if (this.themePreviewFrame !== null) {
        if (this.themePreviewFrameType === 'animation-frame' && typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(this.themePreviewFrame)
        } else {
          clearTimeout(this.themePreviewFrame)
        }
        this.themePreviewFrame = null
        this.themePreviewFrameType = ''
      }
      this.themePreviewToken += 1
    },
    commitThemeState(themeId, closePanel = false) {
      this.themeId = themeId
      this.pendingThemeId = themeId
      if (closePanel) this.themeVisible = false
      return new Promise(resolve => this.$nextTick(resolve))
    },
    closeThemePanel() {
      this.clearThemePreview()
      this.pendingThemeId = this.savedThemeId
      if (this.themeId === this.savedThemeId) {
        this.themeVisible = false
        return
      }
      morphAppTheme(this.savedThemeId, {
        persist: false,
        preview: true,
        duration: 200,
        commit: nextThemeId => this.commitThemeState(nextThemeId, true)
      })
    },
    applyTheme() {
      this.clearThemePreview()
      const nextThemeId = morphAppTheme(this.pendingThemeId, {
        persist: true,
        animate: false,
        commit: committedThemeId => this.commitThemeState(committedThemeId, true)
      })
      this.savedThemeId = nextThemeId
      this.pendingThemeId = nextThemeId
      uni.showToast({ title: `已应用${this.pendingThemeName}`, icon: 'none' })
    },
    exportBackup() {
      uni.setClipboardData({
        data: exportTrackedBooks(),
        success: () => uni.showToast({ title: '备份已复制', icon: 'none' })
      })
    },
    showHelp() {
      uni.showToast({ title: '这是一个书源与文本解码器', icon: 'none' })
    },
    showBoundary() {
      uni.showToast({ title: '不执行 JS、登录、Cookie 或付费绕过规则', icon: 'none' })
    }
  }
}
</script>

<style>
.profile-page {
  box-sizing: border-box;
  width: 100%;
  max-width: 1120px;
  min-height: 100vh;
  margin: 0 auto;
  padding: 86rpx 40rpx 132rpx;
  color: var(--app-text);
  background: var(--app-bg);
}

button::after {
  border: 0;
}

.top-zone {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 116rpx;
  margin: -86rpx -40rpx 34rpx;
  padding: 86rpx 40rpx 28rpx;
  background: var(--app-top);
}

.eyebrow {
  color: rgba(255, 255, 255, 0.74);
  font-size: 22rpx;
  font-weight: 800;
}

.title {
  margin-top: 8rpx;
  color: #ffffff;
  font-family: cursive;
  font-size: 52rpx;
  line-height: 62rpx;
}

.help-button,
.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 78rpx;
  height: 78rpx;
  padding: 0;
  border: 6rpx solid #ffffff;
  border-radius: 999rpx;
  color: #ffffff;
  font-size: 44rpx;
  line-height: 1;
  background: transparent;
}

.backend-card {
  padding: 28rpx;
  margin-bottom: 28rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.06);
  border-radius: 22rpx;
  background: rgba(47, 48, 45, 0.94);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.04);
}

.backend-head {
  cursor: pointer;
}

.backend-head-right {
  display: flex;
  align-items: center;
  gap: 14rpx;
  flex-shrink: 0;
}

.backend-expand-arrow {
  color: var(--app-muted);
  font-size: 26rpx;
  line-height: 1;
}

.backend-detail {
  margin-top: 18rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.06);
}

.development-card {
  padding: 26rpx;
  margin-bottom: 28rpx;
  border: 1rpx solid rgba(226, 106, 79, 0.18);
  border-radius: 22rpx;
  background: rgba(38, 39, 37, 0.96);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.04);
}

.development-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 18rpx;
}

.development-title {
  margin-top: 8rpx;
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 900;
}

.development-desc {
  display: block;
  margin-top: 8rpx;
  color: #a9aaa4;
  font-size: 23rpx;
  line-height: 34rpx;
}

.debug-off-button {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-width: 112rpx;
  height: 62rpx;
  padding: 0 20rpx;
  border-radius: 16rpx;
  color: #ffffff;
  font-size: 23rpx;
  line-height: 1;
  background: rgba(216, 90, 58, 0.78);
}

.dev-panel {
  margin-bottom: 18rpx;
}

.dev-panel:last-child {
  margin-bottom: 0;
}

.apk-card {
  padding: 26rpx;
  margin-bottom: 28rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.06);
  border-radius: 22rpx;
  background: rgba(47, 48, 45, 0.94);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.04);
}

.validation-card {
  padding: 26rpx;
  margin-bottom: 28rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.06);
  border-radius: 22rpx;
  background: rgba(47, 48, 45, 0.94);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.04);
}

.validation-head,
.validation-row {
  display: flex;
  align-items: center;
}

.validation-head {
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 14rpx;
}

.validation-title {
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 900;
}

.validation-desc,
.validation-item-desc {
  display: block;
  margin-top: 8rpx;
  color: #a9aaa4;
  font-size: 23rpx;
  line-height: 34rpx;
}

.validation-badge {
  flex-shrink: 0;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  color: #ffcf9a;
  font-size: 22rpx;
  font-weight: 900;
  background: rgba(216, 90, 58, 0.10);
}

.validation-badge.ready {
  color: #ffffff;
  background: rgba(112, 173, 159, 0.78);
}

.validation-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10rpx;
}

.validation-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 160rpx;
  height: 58rpx;
  padding: 0 22rpx;
  border-radius: 16rpx;
  color: #f4f0e8;
  font-size: 23rpx;
  line-height: 1;
  background: rgba(255, 255, 255, 0.08);
}

.validation-row {
  gap: 16rpx;
  padding: 14rpx 0;
  border-top: 1rpx solid rgba(255, 255, 255, 0.06);
}

.validation-check {
  flex-shrink: 0;
  width: 92rpx;
  padding: 8rpx 0;
  border-radius: 999rpx;
  color: #ffcf9a;
  font-size: 21rpx;
  font-weight: 900;
  text-align: center;
  background: rgba(216, 90, 58, 0.10);
}

.validation-row.checked .validation-check {
  color: #0f1a18;
  background: rgba(143, 201, 189, 0.88);
}

.validation-copy {
  min-width: 0;
  flex: 1;
}

.validation-item-title {
  color: #ffffff;
  font-size: 27rpx;
  font-weight: 900;
}

.demo-card {
  padding: 26rpx;
  margin-bottom: 28rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.06);
  border-radius: 22rpx;
  background: rgba(47, 48, 45, 0.94);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.04);
}

.demo-head,
.demo-step {
  display: flex;
  align-items: center;
}

.demo-head {
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 14rpx;
}

.demo-title {
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 900;
}

.demo-desc,
.demo-step-detail {
  display: block;
  margin-top: 8rpx;
  color: #a9aaa4;
  font-size: 23rpx;
  line-height: 34rpx;
}

.demo-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.demo-button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 62rpx;
  border-radius: 16rpx;
  color: #f4f0e8;
  font-size: 23rpx;
  line-height: 1;
  background: rgba(255, 255, 255, 0.08);
}

.demo-button.primary {
  flex-shrink: 0;
  width: 112rpx;
  color: #ffffff;
  background: #d85a3a;
}

.demo-step {
  gap: 16rpx;
  padding: 14rpx 0;
  border-top: 1rpx solid rgba(255, 255, 255, 0.06);
}

.demo-state {
  flex-shrink: 0;
  width: 92rpx;
  padding: 8rpx 0;
  border-radius: 999rpx;
  color: #ffcf9a;
  font-size: 21rpx;
  font-weight: 900;
  text-align: center;
  background: rgba(216, 90, 58, 0.10);
}

.demo-state.ready {
  color: #0f1a18;
  background: rgba(143, 201, 189, 0.88);
}

.demo-state.manual {
  color: #ffffff;
  background: rgba(96, 117, 125, 0.74);
}

.demo-copy {
  min-width: 0;
  flex: 1;
}

.demo-step-title {
  color: #ffffff;
  font-size: 27rpx;
  font-weight: 900;
}

.offline-zone {
  padding-top: 14rpx;
  margin-top: 10rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.06);
}

.offline-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.offline-title {
  color: #ffffff;
  font-size: 29rpx;
  font-weight: 900;
}

.offline-mode {
  flex-shrink: 0;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  color: #0f1a18;
  font-size: 21rpx;
  font-weight: 900;
  background: rgba(143, 201, 189, 0.88);
}

.offline-summary {
  display: block;
  margin: 8rpx 0 4rpx;
  color: #a9aaa4;
  font-size: 23rpx;
  line-height: 34rpx;
}

.apk-head,
.apk-check {
  display: flex;
  align-items: center;
}

.apk-head {
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 16rpx;
}

.apk-title {
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 900;
}

.apk-desc,
.apk-check-detail {
  display: block;
  margin-top: 8rpx;
  color: #a9aaa4;
  font-size: 23rpx;
  line-height: 34rpx;
}

.apk-badge {
  flex-shrink: 0;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  color: #ffcf9a;
  font-size: 22rpx;
  font-weight: 900;
  background: rgba(216, 90, 58, 0.10);
}

.apk-badge.ready {
  color: #ffffff;
  background: rgba(112, 173, 159, 0.78);
}

.apk-check {
  gap: 16rpx;
  padding: 16rpx 0;
  border-top: 1rpx solid rgba(255, 255, 255, 0.06);
}

.apk-state {
  flex-shrink: 0;
  width: 92rpx;
  padding: 8rpx 0;
  border-radius: 999rpx;
  color: #ffcf9a;
  font-size: 21rpx;
  font-weight: 900;
  text-align: center;
  background: rgba(216, 90, 58, 0.10);
}

.apk-state.ready {
  color: #0f1a18;
  background: rgba(143, 201, 189, 0.88);
}

.apk-state.manual {
  color: #ffffff;
  background: rgba(96, 117, 125, 0.74);
}

.apk-copy {
  min-width: 0;
  flex: 1;
}

.apk-check-title {
  color: #ffffff;
  font-size: 27rpx;
  font-weight: 900;
}

.backend-head,
.backend-grid {
  display: flex;
  align-items: center;
}

.backend-head {
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 20rpx;
}

.backend-title {
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 900;
}

.backend-desc,
.backend-error,
.backend-health,
.backend-tip {
  display: block;
  margin-top: 8rpx;
  color: #a9aaa4;
  font-size: 23rpx;
  line-height: 34rpx;
}

.backend-error {
  color: #ff9d86;
}

.backend-health {
  color: #9ee2b4;
}

.backend-tip {
  padding: 12rpx 16rpx;
  margin: 12rpx 0 0;
  border-radius: 14rpx;
  background: rgba(255, 255, 255, 0.06);
}

.backend-tip.warning {
  color: #ffcf9a;
  background: rgba(216, 90, 58, 0.10);
}

.backend-hint {
  margin-top: 18rpx;
  padding: 18rpx 20rpx;
  border-radius: 16rpx;
  background: rgba(216, 90, 58, 0.08);
}

.hint-title {
  color: #d85a3a;
  font-size: 24rpx;
  font-weight: 900;
}

.hint-command {
  display: block;
  margin-top: 8rpx;
  overflow: hidden;
  color: #7d6b5d;
  font-size: 21rpx;
  line-height: 30rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.backend-status {
  flex-shrink: 0;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  color: #a9aaa4;
  font-size: 20rpx;
  font-weight: 900;
  background: rgba(255, 255, 255, 0.06);
}

.backend-status.online {
  color: #ffffff;
  background: rgba(216, 90, 58, 0.72);
}

.backend-grid {
  gap: 14rpx;
  margin-top: 14rpx;
}

.backend-grid .backend-input {
  flex: 1;
}

.backend-input {
  height: 70rpx;
  padding: 0 20rpx;
  border-radius: 16rpx;
  color: #ffffff;
  font-size: 24rpx;
  background: rgba(255, 255, 255, 0.08);
}

.backend-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: 20rpx;
}

.backend-button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 62rpx;
  border-radius: 16rpx;
  color: #f4f0e8;
  font-size: 23rpx;
  line-height: 1;
  background: rgba(255, 255, 255, 0.08);
}

.backend-button.primary {
  color: #ffffff;
  background: #d85a3a;
}

.backend-button.ghost {
  color: #a9aaa4;
  background: rgba(255, 255, 255, 0.04);
}

.setting-item {
  display: flex;
  align-items: center;
  min-height: 132rpx;
  padding: 12rpx 0;
}

.setting-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 92rpx;
  color: #d44b2f;
  font-size: 42rpx;
}

.setting-copy {
  min-width: 0;
  flex: 1;
  margin-left: 12rpx;
}

.setting-title {
  color: #ffffff;
  font-family: cursive;
  font-size: 38rpx;
  line-height: 48rpx;
}

.setting-desc {
  display: block;
  margin-top: 10rpx;
  color: #a8a8a8;
  font-family: cursive;
  font-size: 27rpx;
  line-height: 38rpx;
}

.setting-extra {
  flex-shrink: 0;
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  color: #ffffff;
  font-family: cursive;
  font-size: 26rpx;
  background: #303030;
}

.section-label {
  display: block;
  margin: 28rpx 0 10rpx;
  color: #d44b2f;
  font-family: cursive;
  font-size: 26rpx;
}

.theme-panel {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: 124rpx;
  z-index: 20;
  padding: 28rpx;
  border-radius: 26rpx;
  background: #252525;
  box-shadow: 0 -20rpx 60rpx rgba(0, 0, 0, 0.36);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.panel-title {
  color: #ffffff;
  font-family: cursive;
  font-size: 38rpx;
}

.theme-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 20rpx;
  margin-top: 12rpx;
  border-radius: 18rpx;
  background: #303030;
}

.theme-row.active {
  background: #3a2a25;
}

.theme-name {
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 900;
}

.theme-desc {
  display: block;
  margin-top: 6rpx;
  color: #a8a8a8;
  font-size: 22rpx;
}

.theme-dot {
  color: #d44b2f;
}

/* Ink theme polish */
.profile-page {
  background:
    radial-gradient(circle at 20% 0%, rgba(96, 117, 125, 0.18), transparent 30%),
    linear-gradient(180deg, var(--app-stage) 0%, var(--app-bg) 100%);
}

.top-zone {
  background: linear-gradient(180deg, #667b83 0%, #586d75 100%);
  box-shadow: 0 10rpx 28rpx rgba(0, 0, 0, 0.20);
}

.title,
.setting-title,
.panel-title {
  font-family: "KaiTi", "STKaiti", "FZKai-Z03", "PingFang SC", cursive;
}

.setting-item,
.theme-panel,
.theme-row {
  border: 1rpx solid rgba(255, 255, 255, 0.05);
  background: rgba(47, 48, 45, 0.92);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.035);
}

.setting-icon,
.section-label,
.theme-dot {
  color: #d85a3a;
}

.setting-desc,
.theme-desc {
  color: #a9aaa4;
}

.theme-swatch {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-shrink: 0;
}

.swatch-dot {
  display: block;
  width: 24rpx;
  height: 24rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.64);
  border-radius: 999rpx;
}

/* Global app theme */
.profile-page {
  color: var(--app-text);
  background: var(--app-bg);
}

.top-zone {
  background: var(--app-top);
  box-shadow: var(--app-shadow);
}

.title,
.backend-title,
.setting-title,
.panel-title,
.theme-name {
  color: var(--app-text);
}

.eyebrow,
.setting-icon,
.section-label,
.theme-dot {
  color: var(--app-accent-3);
}

.backend-card,
.demo-card,
.apk-card,
.validation-card,
.backend-hint,
.setting-item,
.theme-panel,
.theme-row {
  border-color: var(--app-border);
  background: var(--app-panel-strong);
  box-shadow: var(--app-shadow);
}

.backend-desc,
.demo-desc,
.demo-step-detail,
.offline-summary,
.apk-desc,
.apk-check-detail,
.validation-desc,
.validation-item-desc,
.hint-command,
.backend-tip,
.setting-desc,
.theme-desc {
  color: var(--app-muted);
}

.backend-input {
  color: var(--app-text);
  background: var(--app-input);
}

.backend-button,
.setting-extra {
  color: var(--app-text);
  background: var(--app-panel);
}

.backend-button.primary,
.demo-button.primary,
.backend-status.online {
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.backend-button.ghost,
.backend-status {
  color: var(--app-muted);
  background: var(--app-panel);
}

.apk-title,
.demo-title,
.offline-title,
.validation-title,
.validation-item-title,
.demo-step-title,
.apk-check-title {
  color: var(--app-text);
}

.offline-zone,
.demo-step,
.apk-check,
.validation-row {
  border-top-color: var(--app-border);
}

.validation-button {
  color: var(--app-text);
  background: var(--app-panel);
}

.offline-mode {
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.demo-button {
  color: var(--app-text);
  background: var(--app-panel);
}

.apk-badge.ready,
.validation-badge.ready,
.demo-state.ready,
.apk-state.ready {
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.validation-row.checked .validation-check {
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.demo-state.manual,
.apk-state.manual {
  color: var(--app-text);
  background: var(--app-panel);
}

.backend-tip.warning {
  color: #ffcf9a;
  background: rgba(216, 90, 58, 0.10);
}

.theme-row.active {
  border-color: var(--app-accent);
  background: var(--app-panel);
}

.help-button,
.close-button {
  color: var(--app-text);
  border-color: var(--app-text);
}

/* Personal theme studio: each card previews its own tokens while the page previews the pending choice. */
.theme-panel-mask {
  position: fixed;
  z-index: 18;
  inset: 0;
  background: rgba(0, 0, 0, 0.52);
}

.theme-panel {
  z-index: 20;
  bottom: calc(154rpx + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: calc(100vh - 210rpx - env(safe-area-inset-bottom));
  max-height: 1240rpx;
  padding: 28rpx 28rpx 24rpx;
  overflow: hidden;
  border-radius: var(--app-card-radius, 24rpx) var(--app-card-radius, 24rpx) 0 0;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.panel-head {
  flex-shrink: 0;
  margin-bottom: 22rpx;
  padding-right: 4rpx;
}

.panel-kicker {
  color: var(--app-accent-3);
  font-size: 18rpx;
  font-weight: 750;
  letter-spacing: 4rpx;
  line-height: 28rpx;
}

.panel-title {
  margin-top: 4rpx;
  font-family: var(--app-heading-font);
  font-size: 34rpx;
  font-weight: 780;
  line-height: 46rpx;
}

.panel-desc {
  display: block;
  margin-top: 5rpx;
  color: var(--app-muted);
  font-size: 21rpx;
  line-height: 30rpx;
}

.theme-panel .close-button {
  flex-shrink: 0;
  width: 72rpx;
  height: 72rpx;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-control-radius, 14rpx);
  color: var(--app-muted);
  background: var(--app-input);
}

.theme-grid {
  flex: 1 1 0;
  min-height: 0;
  height: 0;
  max-height: none;
  overflow: hidden;
  overscroll-behavior: contain;
}

.theme-grid-inner {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  padding: 2rpx 2rpx 18rpx;
}

.theme-card {
  position: relative;
  min-width: 0;
  padding: 12rpx;
  overflow: hidden;
  border: 2rpx solid var(--app-border);
  border-radius: var(--app-card-radius, 18rpx);
  background: var(--app-panel);
  box-shadow: none;
  transition: transform var(--app-motion-fast), border-color var(--app-motion-fast), background var(--app-motion-fast);
}

.theme-card:active {
  transform: scale(0.98);
}

.theme-card.active {
  border-color: var(--app-accent);
  background: var(--app-surface);
  box-shadow: inset 0 0 0 1rpx var(--app-accent);
}

.theme-preview {
  position: relative;
  height: 154rpx;
  padding: 14rpx;
  overflow: hidden;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-card-radius, 14rpx);
  color: var(--app-text);
  background: var(--app-bg);
}

.theme-preview-pattern {
  position: absolute;
  z-index: 0;
  inset: 0;
  opacity: 0.34;
  background-image: var(--app-pattern);
  background-size: 64rpx 64rpx;
}

.theme-preview-top,
.theme-preview-book {
  position: relative;
  z-index: 1;
}

.theme-preview-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--app-muted);
  font-size: 14rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
  line-height: 22rpx;
}

.theme-preview-dot {
  color: var(--app-accent-3);
  font-size: 12rpx;
}

.theme-preview-book {
  display: flex;
  align-items: center;
  min-height: 82rpx;
  margin-top: 12rpx;
  padding: 10rpx 12rpx 10rpx 18rpx;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-control-radius, 10rpx);
  background: var(--app-panel-strong);
  box-shadow: none;
}

.theme-preview-spine {
  position: absolute;
  left: 0;
  top: 12rpx;
  bottom: 12rpx;
  width: 4rpx;
  background: var(--app-accent-3);
}

.theme-preview-title,
.theme-preview-motif {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theme-preview-title {
  color: var(--app-text);
  font-family: var(--app-heading-font);
  font-size: 18rpx;
  font-weight: 800;
  line-height: 26rpx;
}

.theme-preview-motif {
  margin-top: 2rpx;
  color: var(--app-muted);
  font-size: 13rpx;
  line-height: 20rpx;
}

.theme-preview-arrow {
  margin-left: auto;
  color: var(--app-accent);
  font-size: 34rpx;
}

.theme-card-copy {
  padding: 14rpx 4rpx 0;
}

.theme-name-line {
  display: flex;
  align-items: center;
  min-width: 0;
}

.theme-name {
  min-width: 0;
  overflow: hidden;
  font-family: var(--app-heading-font);
  font-size: 25rpx;
  font-weight: 780;
  line-height: 34rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theme-saved-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28rpx;
  height: 28rpx;
  flex-shrink: 0;
  margin-left: 8rpx;
  padding: 0;
  border-radius: 50%;
  color: var(--app-on-accent);
  font-size: 14rpx;
  line-height: 20rpx;
  background: var(--app-accent);
}

.theme-category {
  display: block;
  margin-top: 3rpx;
  color: var(--app-accent-3);
  font-size: 17rpx;
  font-weight: 700;
  line-height: 25rpx;
}

.theme-desc {
  display: -webkit-box;
  height: 56rpx;
  margin-top: 5rpx;
  overflow: hidden;
  font-size: 18rpx;
  line-height: 28rpx;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.theme-swatch {
  gap: 7rpx;
  padding: 12rpx 4rpx 3rpx;
}

.swatch-dot {
  width: 20rpx;
  height: 20rpx;
  border-color: var(--app-border);
}

.theme-panel-actions {
  position: relative;
  z-index: 2;
  display: grid;
  flex-shrink: 0;
  grid-template-columns: 0.72fr 1.28fr;
  gap: 14rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid var(--app-border);
  background: var(--app-panel-strong);
}

.theme-cancel-button,
.theme-apply-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 82rpx;
  border-radius: var(--app-control-radius, 14rpx);
  font-size: 24rpx;
  font-weight: 720;
}

.theme-cancel-button {
  color: var(--app-text);
  background: var(--app-input);
}

.theme-apply-button {
  color: var(--app-on-accent);
  background: var(--app-accent);
  box-shadow: none;
}

.backend-card,
.demo-card,
.apk-card,
.validation-card,
.setting-item {
  border-radius: var(--app-card-radius, 18rpx);
}

@media (max-width: 380px) {
  .theme-panel {
    padding-right: 20rpx;
    padding-left: 20rpx;
  }

  .theme-grid-inner {
    gap: 12rpx;
  }

  .theme-preview {
    height: 144rpx;
  }
}

@media (prefers-reduced-motion: reduce) {
  .theme-card {
    transition: none;
  }
}

/* V2 profile pass: organise control surfaces, let the chosen theme be the hero. */
.settings-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.section-label.settings-section-first {
  margin-top: 0;
}

.section-label {
  display: block;
  margin-top: var(--app-space-xl, 48rpx);
  margin-bottom: var(--app-space-sm, 16rpx);
  color: var(--app-accent-3);
  font-family: var(--app-utility-font);
  font-size: 19rpx;
  font-weight: 750;
  letter-spacing: 1.8rpx;
  line-height: 30rpx;
}

.backend-card,
.setting-item {
  border-width: var(--app-card-border-width, 1rpx);
  box-shadow: var(--app-card-outline), var(--app-shadow);
}

.backend-head {
  padding-bottom: 18rpx;
  border-bottom: 1rpx solid var(--app-border);
}

.backend-status {
  font-family: var(--app-utility-font);
  letter-spacing: 1rpx;
}

.backend-actions {
  gap: 12rpx;
}

.backend-button {
  min-height: var(--app-touch-target-min, 88rpx);
  border-radius: var(--app-control-radius, 12rpx);
}

.setting-item {
  position: relative;
  min-height: 112rpx;
  margin-bottom: 12rpx;
  border-radius: var(--app-control-radius, 12rpx);
  background: var(--app-panel);
}

.setting-item::after {
  position: absolute;
  right: 22rpx;
  width: 10rpx;
  height: 10rpx;
  border-top: 2rpx solid var(--app-muted);
  border-right: 2rpx solid var(--app-muted);
  content: '';
  transform: rotate(45deg);
}

.setting-item:active {
  border-color: var(--app-accent);
  background: color-mix(in srgb, var(--app-panel) 78%, var(--app-accent));
}

.setting-extra {
  margin-right: 30rpx;
  font-family: var(--app-utility-font);
  font-size: 19rpx;
  letter-spacing: .6rpx;
}

.theme-panel {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  animation: profile-theme-sheet-in var(--app-motion-duration-slow) var(--app-motion-spring) both;
}

.theme-preview {
  height: 174rpx;
  border-radius: 12rpx;
  box-shadow: inset 0 0 0 5rpx rgba(255, 255, 255, 0.025);
}

.theme-preview::after {
  position: absolute;
  z-index: 3;
  left: 50%;
  bottom: 8rpx;
  width: 42rpx;
  height: 4rpx;
  border-radius: 4rpx;
  background: color-mix(in srgb, var(--app-text) 32%, transparent);
  content: '';
  transform: translateX(-50%);
}

.theme-card {
  animation: profile-theme-card-in 320ms var(--app-motion-smooth) both;
}

.theme-card:nth-child(2) { animation-delay: 45ms; }
.theme-card:nth-child(3) { animation-delay: 90ms; }
.theme-card:nth-child(4) { animation-delay: 135ms; }
.theme-card:nth-child(5) { animation-delay: 180ms; }

.theme-card.active {
  transform: translate3d(0, -4rpx, 0);
}

.theme-card.active .theme-preview {
  border-color: var(--app-accent);
}

.theme-candy.profile-page .backend-card,
.theme-candy.profile-page .setting-item,
.theme-candy.profile-page .theme-card {
  border: 2rpx solid rgba(52, 42, 50, 0.78);
}

.theme-cyber.profile-page .backend-card,
.theme-cyber.profile-page .setting-item,
.theme-cyber.profile-page .theme-card {
  border-radius: var(--profile-surface-radius, 20rpx);
}

.tts-acceptance-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  background:
    radial-gradient(circle at 84% 12%, color-mix(in srgb, var(--app-accent) 24%, transparent), transparent 42%),
    color-mix(in srgb, var(--app-card) 94%, transparent);
}

.tts-acceptance-copy {
  min-width: 0;
  flex: 1;
}

.tts-acceptance-title {
  margin-top: 8rpx;
  color: var(--app-text);
  font-size: 32rpx;
  font-weight: 800;
}

.tts-acceptance-desc {
  display: block;
  margin-top: 10rpx;
  color: var(--app-text-muted);
  font-size: 23rpx;
  line-height: 1.55;
}

.tts-acceptance-button {
  flex-shrink: 0;
  min-width: 112rpx;
  height: 68rpx;
  margin: 0;
  padding: 0 26rpx;
  border: 0;
  border-radius: 34rpx;
  color: var(--app-on-accent);
  background: var(--app-accent);
  font-size: 24rpx;
  font-weight: 800;
  line-height: 68rpx;
}

.theme-cyber.profile-page .theme-panel {
  border-radius: var(--profile-panel-radius, 26rpx);
}

.theme-cyber.profile-page .theme-preview {
  border-radius: calc(var(--profile-surface-radius, 20rpx) - 8rpx);
}

.theme-noirGold.profile-page .backend-card,
.theme-noirGold.profile-page .setting-item,
.theme-noirGold.profile-page .theme-card {
  box-shadow: inset 0 0 0 6rpx rgba(213, 175, 98, 0.022), var(--app-shadow);
}

/* Profile control pass: every theme uses rounded, touchable surfaces instead of square modules. */
.profile-page,
.theme-panel {
  --profile-surface-radius: 28rpx;
  --profile-control-radius: 18rpx;
  --profile-panel-radius: 32rpx;
}

.theme-xuanye.profile-page {
  --profile-surface-radius: 26rpx;
  --profile-control-radius: 16rpx;
  --profile-panel-radius: 30rpx;
}

.theme-candy.profile-page {
  --profile-surface-radius: 24rpx;
  --profile-control-radius: 18rpx;
  --profile-panel-radius: 30rpx;
}

.theme-sakura.profile-page {
  --profile-surface-radius: 30rpx;
  --profile-control-radius: 20rpx;
  --profile-panel-radius: 34rpx;
}

.theme-cyber.profile-page {
  --profile-surface-radius: 20rpx;
  --profile-control-radius: 14rpx;
  --profile-panel-radius: 26rpx;
}

.theme-noirGold.profile-page {
  --profile-surface-radius: 24rpx;
  --profile-control-radius: 16rpx;
  --profile-panel-radius: 30rpx;
}

.profile-page .backend-card,
.profile-page .development-card,
.profile-page .demo-card,
.profile-page .apk-card,
.profile-page .validation-card,
.profile-page .setting-item,
.profile-page .theme-card,
.theme-panel .theme-card {
  overflow: hidden;
  border-radius: var(--profile-surface-radius);
}

.tab-page-shell > .theme-panel {
  right: 24rpx;
  bottom: calc(154rpx + env(safe-area-inset-bottom));
  left: 24rpx;
  border-radius: var(--profile-panel-radius);
  box-shadow: 0 24rpx 72rpx rgba(20, 19, 25, 0.26), var(--app-shadow);
}

.profile-page .theme-preview {
  border-radius: calc(var(--profile-surface-radius) - 8rpx);
}

.profile-page .theme-preview-book,
.profile-page .backend-input,
.profile-page .backend-tip,
.profile-page .backend-hint,
.profile-page .backend-button,
.profile-page .demo-button,
.profile-page .validation-button,
.theme-panel .theme-cancel-button,
.theme-panel .theme-apply-button {
  border-radius: var(--profile-control-radius);
}

.profile-page .help-button,
.profile-page .close-button {
  border-radius: 50%;
}

.profile-page .setting-item {
  padding-right: 42rpx;
}

.profile-page .setting-icon {
  width: 76rpx;
  height: 76rpx;
  margin-left: 18rpx;
  border-radius: calc(var(--profile-control-radius) - 4rpx);
  background: color-mix(in srgb, var(--app-accent) 12%, var(--app-panel));
}

.theme-xuanye.profile-page .setting-icon,
.theme-cyber.profile-page .setting-icon {
  box-shadow: inset 0 0 0 1rpx color-mix(in srgb, var(--app-accent) 38%, transparent);
}

.theme-cyber.profile-page .theme-apply-button,
.theme-cyber.profile-page .backend-button.primary {
  border-radius: var(--profile-control-radius, 14rpx);
}

.theme-candy.profile-page .setting-icon {
  border: 2rpx solid rgba(52, 42, 50, 0.76);
  box-shadow: 3rpx 3rpx 0 rgba(85, 199, 232, 0.36);
}

.theme-sakura.profile-page .setting-icon {
  background: linear-gradient(135deg, rgba(233, 122, 174, 0.18), rgba(165, 139, 231, 0.16));
}

.theme-noirGold.profile-page .setting-icon {
  border: 1rpx solid rgba(213, 175, 98, 0.38);
  background: rgba(213, 175, 98, 0.08);
}

.theme-candy.theme-panel .theme-card {
  border: 2rpx solid rgba(52, 42, 50, 0.78);
}

.theme-cyber.theme-panel .theme-card {
  border-radius: var(--profile-surface-radius, 20rpx);
}

.theme-noirGold.theme-panel .theme-card {
  box-shadow: inset 0 0 0 6rpx rgba(213, 175, 98, 0.022), var(--app-shadow);
}

.theme-panel-mask {
  animation: profile-overlay-in 200ms ease both;
}

@keyframes profile-theme-sheet-in {
  from { opacity: 0; transform: translate3d(-50%, 48rpx, 0); }
  to { opacity: 1; transform: translate3d(-50%, 0, 0); }
}

@keyframes profile-overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes profile-theme-card-in {
  from { opacity: 0; transform: translate3d(0, 18rpx, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

/* Reading passport: related controls share one bound volume instead of one card each. */
.profile-page .backend-card {
  position: relative;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-card-radius);
  background: var(--app-panel);
  box-shadow: none;
}

.profile-page .backend-card::before {
  position: absolute;
  top: var(--app-space-md);
  bottom: var(--app-space-md);
  left: 0;
  width: 5rpx;
  background: var(--app-accent);
  content: "";
}

.profile-page .settings-list {
  gap: 0;
}

.profile-page .setting-group {
  overflow: hidden;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-card-radius);
  background: var(--app-panel);
  box-shadow: none;
}

.profile-page .setting-item {
  min-height: 112rpx;
  padding: var(--app-space-sm) var(--app-space-xl) var(--app-space-sm) var(--app-space-sm);
  margin: 0;
  overflow: visible;
  border: 0;
  border-bottom: 1rpx solid var(--app-border);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.profile-page .setting-item:last-child {
  border-bottom: 0;
}

.profile-page .setting-item:active {
  border-color: var(--app-border);
  background: var(--app-input);
  transform: none;
}

.profile-page .setting-icon {
  width: 64rpx;
  height: 64rpx;
  margin-left: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  font-family: var(--app-utility-font);
  font-size: var(--app-font-size-md, 28rpx);
}

.profile-page .setting-copy {
  margin-left: var(--app-space-sm, 16rpx);
}

.profile-page .setting-title {
  font-family: var(--app-display-font);
  font-size: var(--app-font-size-md, 28rpx);
  font-weight: 700;
  line-height: 38rpx;
}

.profile-page .setting-desc {
  margin-top: 6rpx;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: var(--app-font-size-sm, 24rpx);
  line-height: 34rpx;
}

.profile-page .setting-extra {
  padding: 0;
  border-radius: 0;
  color: var(--app-muted);
  background: transparent;
}

.profile-page .tts-acceptance-card {
  position: relative;
  overflow: hidden;
  border: 1rpx solid var(--app-border);
  background: var(--app-panel);
  box-shadow: none;
}

.profile-page .tts-acceptance-card::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 5rpx;
  background: var(--app-accent-3);
  content: "";
}

.theme-candy.profile-page .setting-group {
  border: 2rpx solid var(--app-border);
  border-radius:
    var(--app-card-radius)
    calc(var(--app-card-radius) + var(--app-space-sm))
    calc(var(--app-card-radius) - var(--app-space-xs))
    calc(var(--app-card-radius) + var(--app-space-xs));
  box-shadow: 5rpx 6rpx 0 color-mix(in srgb, var(--app-accent-2) 20%, transparent);
}

.theme-candy.profile-page .setting-icon {
  border: 0;
  box-shadow: none;
}

.theme-sakura.profile-page .backend-card::before {
  width: 7rpx;
  border-radius: 0 7rpx 7rpx 0;
  background: var(--app-accent-3);
}

.theme-cyber.profile-page .setting-group {
  border-left: 5rpx solid var(--app-accent);
}

.theme-noirGold.profile-page .setting-group {
  border-color: color-mix(in srgb, var(--app-accent) 38%, var(--app-border));
  box-shadow: inset 0 0 0 6rpx color-mix(in srgb, var(--app-accent) 3%, transparent);
}

@media (prefers-reduced-motion: reduce) {
  .profile-page .setting-item {
    transition: none;
  }
}
</style>
