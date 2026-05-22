<template>
  <view class="profile-page app-page" :style="themeVars">
    <view class="top-zone">
      <view>
        <text class="eyebrow">ME</text>
        <view class="title">我的</view>
      </view>
      <button class="help-button" @tap="showHelp">?</button>
    </view>

    <view class="backend-card">
      <view class="backend-head">
        <view>
          <view class="backend-title">后端连接</view>
          <text class="backend-desc">{{ backendStatusDesc }}</text>
        </view>
        <text class="backend-status" :class="{ online: backend.user }">{{ backend.user ? 'ONLINE' : 'OFFLINE' }}</text>
      </view>

      <input class="backend-input" v-model="backend.baseUrl" placeholder="后端地址" />
      <view class="backend-tip" :class="{ warning: !backendAddressTip.mobileReady }">
        <text>{{ backendAddressTip.message }}</text>
      </view>
      <view class="backend-grid">
        <input class="backend-input" v-model="backend.username" placeholder="用户名" />
        <input class="backend-input" v-model="backend.password" password placeholder="密码" />
      </view>
      <text class="backend-error" v-if="backend.error">{{ backend.error }}</text>
      <text class="backend-health" v-if="backend.health">{{ backend.health }}</text>
      <view class="backend-hint" v-if="!backend.user">
        <view class="hint-title">FastAPI 未启动时</view>
        <text class="hint-command" v-for="line in backendStartCommands" :key="line">{{ line }}</text>
      </view>
      <view class="backend-actions">
        <button class="backend-button" @tap="saveBackendBaseUrl">保存地址</button>
        <button class="backend-button" :loading="backend.loading" @tap="checkBackendHealth">自检后端</button>
        <button class="backend-button primary" :loading="backend.loading" @tap="loginBackend">登录后端</button>
        <button class="backend-button" :loading="backend.loading" @tap="refreshBackendMe">刷新状态</button>
        <button class="backend-button" @tap="openSwagger">打开 Swagger</button>
        <button class="backend-button ghost" @tap="logoutBackend">退出</button>
      </view>
    </view>

    <view class="apk-card">
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

    <view class="settings-list">
      <view class="setting-item" v-for="item in mainItems" :key="item.id" @tap="openItem(item.id)">
        <text class="setting-icon">{{ item.icon }}</text>
        <view class="setting-copy">
          <view class="setting-title">{{ item.title }}</view>
          <text class="setting-desc">{{ item.desc }}</text>
        </view>
        <view class="setting-extra" v-if="item.id === 'theme'">{{ activeThemeName }}</view>
        <view class="setting-extra" v-if="item.id === 'web'">{{ backend.user ? '已连接' : '未启动' }}</view>
      </view>

      <text class="section-label">设置</text>

      <view class="setting-item" @tap="exportBackup">
        <text class="setting-icon">▰</text>
        <view class="setting-copy">
          <view class="setting-title">备份与恢复</view>
          <text class="setting-desc">复制追书记录，旧版数据可在导入页恢复</text>
        </view>
      </view>
      <view class="setting-item" @tap="openThemePanel">
        <text class="setting-icon">▣</text>
        <view class="setting-copy">
          <view class="setting-title">主题设置</view>
          <text class="setting-desc">与界面/颜色相关的一些设置</text>
        </view>
      </view>
      <view class="setting-item" @tap="showBoundary">
        <text class="setting-icon">⌾</text>
        <view class="setting-copy">
          <view class="setting-title">其它设置</view>
          <text class="setting-desc">书源解码边界、缓存和兼容说明</text>
        </view>
      </view>
    </view>

    <view class="theme-panel app-floating-panel" v-if="themeVisible">
      <view class="panel-head">
        <view class="panel-title">主题模式</view>
        <button class="close-button" @tap="themeVisible = false">×</button>
      </view>
      <view class="theme-row" v-for="theme in themes" :key="theme.id" :class="{ active: themeId === theme.id }" @tap="chooseTheme(theme.id)">
        <view>
          <view class="theme-name">{{ theme.name }}</view>
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
  </view>
</template>

<script>
import { exportTrackedBooks } from '../../common/tracking.js'
import { appThemes, getAppThemeId, getAppThemeStyle, saveAppTheme } from '../../common/appTheme.js'
import apiClient from '../../common/apiClient.js'
import { analyzeBackendBaseUrl, buildBackendStartCommands } from '../../common/backendConnection.js'
import { getAndroidDemoReadiness } from '../../common/androidReadiness.js'
import { friendlyErrorMessage } from '../../common/uiFeedback.js'

export default {
  data() {
    return {
      themeId: getAppThemeId(),
      themes: appThemes,
      themeVisible: false,
      backend: {
        baseUrl: '',
        username: 'student',
        password: 'secret123',
        user: null,
        loading: false,
        health: '',
        error: ''
      },
      mainItems: [
        { id: 'source', icon: '源', title: '书源与导入', desc: '导入演示源、管理外部源和 TXT' },
        { id: 'aiHistory', icon: 'AI', title: 'AI 记录', desc: '查看后端保存的总结和问答历史' },
        { id: 'theme', icon: '♜', title: '主题模式', desc: '选择主题模式' },
        { id: 'web', icon: '◎', title: '后端服务提示', desc: 'Swagger 和 FastAPI 本地联调状态' }
      ]
    }
  },
  computed: {
    themeVars() {
      return getAppThemeStyle(this.themeId)
    },
    activeThemeName() {
      return (this.themes.find(theme => theme.id === this.themeId) || this.themes[0]).name
    },
    themeAccent() {
      return getAppThemeStyle(this.themeId)['--app-accent']
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
    }
  },
  onShow() {
    this.themeId = getAppThemeId()
    this.loadBackendState()
  },
  methods: {
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
        await this.refreshBackendMe({ silent: true })
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
        this.backend.health = `健康检查通过：${result.status || 'ok'}`
        uni.showToast({ title: '后端健康检查通过', icon: 'none' })
      } catch (error) {
        this.backend.health = ''
        this.backend.error = friendlyErrorMessage(error, '后端健康检查失败')
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
    openItem(id) {
      if (id === 'source') {
        uni.switchTab({ url: '/pages/library/library' })
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
    openThemePanel() {
      this.themeVisible = true
    },
    chooseTheme(themeId) {
      this.themeId = saveAppTheme(themeId)
      this.themeVisible = false
      uni.showToast({ title: '主题已切换', icon: 'none' })
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
  background: #1f1f1f;
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
  background: #60757d;
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

.apk-card {
  padding: 26rpx;
  margin-bottom: 28rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.06);
  border-radius: 22rpx;
  background: rgba(47, 48, 45, 0.94);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.04);
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
    linear-gradient(180deg, #20211f 0%, #1b1c1a 100%);
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
.apk-card,
.backend-hint,
.setting-item,
.theme-panel,
.theme-row {
  border-color: var(--app-border);
  background: var(--app-panel-strong);
  box-shadow: var(--app-shadow);
}

.backend-desc,
.apk-desc,
.apk-check-detail,
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
.apk-check-title {
  color: var(--app-text);
}

.apk-check {
  border-top-color: var(--app-border);
}

.apk-badge.ready,
.apk-state.ready {
  color: var(--app-on-accent);
  background: var(--app-accent);
}

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
</style>
