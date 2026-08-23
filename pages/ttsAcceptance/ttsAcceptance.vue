<template>
  <view class="acceptance-page app-page secondary" :style="themeVars">
    <view class="topbar reader-safe-top">
      <button class="round-button" aria-label="返回" @tap="goBack">‹</button>
      <view class="topbar-copy">
        <text class="eyebrow">REAL VOICE LAB</text>
        <view class="page-title">TTS 自动验收</view>
      </view>
      <button class="round-button" aria-label="复制验收报告" @tap="copyReport">⧉</button>
    </view>

    <scroll-view class="acceptance-scroll" scroll-y :show-scrollbar="false">
      <view class="signal-hero" :class="{ active: running, passed: report && report.passed, failed: hasFailed }">
        <view class="signal-meta">
          <text class="signal-label">{{ heroLabel }}</text>
          <text class="signal-count">{{ completedSteps }}/{{ totalSteps || 11 }}</text>
        </view>
        <view class="signal-wave" aria-hidden="true">
          <text
            v-for="(height, index) in waveBars"
            :key="index"
            :style="{ height: height + 'rpx', animationDelay: (index * 45) + 'ms' }"
          ></text>
        </view>
        <view class="hero-title">{{ heroTitle }}</view>
        <text class="hero-desc">{{ heroDescription }}</text>
        <view class="progress-track">
          <view class="progress-value" :style="{ width: progressPercent + '%' }"></view>
        </view>
      </view>

      <view class="guard-card" v-if="!debugAllowed">
        <text class="guard-mark">LOCKED</text>
        <view>
          <view class="guard-title">仅调试模式可用</view>
          <text class="guard-desc">请返回“我的”页面连续点击版本号开启调试模式。</text>
        </view>
      </view>

      <view class="guard-card login-required" v-else-if="!hasToken">
        <text class="guard-mark">LOGIN</text>
        <view class="guard-copy">
          <view class="guard-title">请先登录后端账号</view>
          <text class="guard-desc">前往“我的 → 后端服务 → 登录后端”。验收页不会自动创建账号，也不会记录登录凭据。</text>
          <button class="login-action" @tap="goProfileLogin">前往“我的”登录</button>
        </view>
      </view>

      <template v-else>
        <view class="action-row">
          <button class="primary-action" :disabled="running" @tap="runPrimaryAction">
            {{ primaryActionLabel }}
          </button>
          <button class="secondary-action" :disabled="!running" @tap="stopAcceptance">停止</button>
        </view>

        <view class="privacy-line">
          <text class="privacy-badge">SAFE LOG</text>
          <text>五种真实音色会依次播放。报告不包含正文、Token、播放票据或供应商音色 ID，真实合成总量约 2000 字。</text>
        </view>

        <view class="section-head">
          <view>
            <text class="section-kicker">LIVE PIPELINE</text>
            <view class="section-title">自动检查项目</view>
          </view>
          <text class="section-state">{{ running ? 'RUNNING' : (report ? 'COMPLETE' : 'READY') }}</text>
        </view>

        <view class="step-list">
          <view
            class="step-card"
            v-for="(step, index) in visibleSteps"
            :key="step.id"
            :class="step.status"
          >
            <view class="step-index">{{ String(index + 1).padStart(2, '0') }}</view>
            <view class="step-copy">
              <view class="step-title">{{ step.label }}</view>
              <text class="step-message">{{ step.message || stepStatusLabel(step.status) }}</text>
            </view>
            <view class="step-result">
              <text>{{ stepStatusLabel(step.status) }}</text>
              <text class="step-duration" v-if="step.durationMs">{{ step.durationMs }}ms</text>
            </view>
          </view>
        </view>

        <view class="chapter-now" v-if="segmentProgress.total">
          <view class="chapter-wave">
            <text v-for="height in miniWaveBars" :key="height" :style="{ height: height + 'rpx' }"></text>
          </view>
          <view class="chapter-copy">
            <text class="chapter-kicker">CONTINUOUS READING</text>
            <view class="chapter-title">{{ segmentProgress.chapterTitle }}</view>
            <text>片段 {{ segmentProgress.progress }}/{{ segmentProgress.total }} · 正在验证顺序、高亮映射与预取</text>
          </view>
        </view>

        <view class="metric-grid" v-if="report">
          <view class="metric-card">
            <text class="metric-value">{{ report.environment && report.environment.verifiedVoiceCount || 0 }}</text>
            <text class="metric-label">已验证音色</text>
          </view>
          <view class="metric-card">
            <text class="metric-value">{{ chapterMetric('segments') }}</text>
            <text class="metric-label">连续片段</text>
          </view>
          <view class="metric-card">
            <text class="metric-value">{{ chapterMetric('maxScheduleGapMs') }}ms</text>
            <text class="metric-label">最大调度间隔</text>
          </view>
          <view class="metric-card">
            <text class="metric-value">{{ report.metrics && report.metrics.cache && report.metrics.cache.cacheHit ? 'HIT' : '—' }}</text>
            <text class="metric-label">缓存复跑</text>
          </view>
        </view>

        <view class="manual-card" v-if="report && report.requiresManualPlayback">
          <text class="manual-mark">ACTION</text>
          <view>
            <view class="manual-title">需要一次人工播放触发</view>
            <text class="manual-desc">当前系统限制了自动播放。保持此页前台，点击“重新运行”即可继续；Android 基座通常不会触发该限制。</text>
          </view>
        </view>

        <view class="report-card" v-if="report">
          <view class="report-head">
            <view>
              <text class="section-kicker">REDACTED REPORT</text>
              <view class="report-title">{{ report.passed ? '自动验收通过' : '自动验收未通过' }}</view>
            </view>
            <text class="report-badge" :class="{ passed: report.passed }">
              {{ report.passed ? 'PASS' : 'CHECK' }}
            </text>
          </view>
          <text class="report-summary">
            通过 {{ report.summary && report.summary.passed || 0 }} 项，
            失败 {{ report.summary && report.summary.failed || 0 }} 项，
            提醒 {{ report.summary && report.summary.warnings || 0 }} 项。
          </text>
          <button class="copy-action" @tap="copyReport">复制脱敏报告</button>
        </view>
      </template>
      <view class="page-spacer"></view>
    </scroll-view>
  </view>
</template>

<script>
import apiClient from '../../common/apiClient.js'
import { getAppThemeId, getAppThemeStyle } from '../../common/appTheme.js'
import { getDebugModeState } from '../../common/debugMode.js'
import {
  createCloudReadAloudDriver,
  createReadAloudDriver
} from '../../common/readAloud.js'
import {
  createTtsAcceptanceRunner,
  sanitizeTtsAcceptanceReport
} from '../../common/ttsAcceptance.js'

const STEP_BLUEPRINTS = [
  { id: 'backend', label: '后端与迁移状态' },
  { id: 'authentication', label: '登录状态' },
  { id: 'service_status', label: '真实 TTS 服务状态' },
  { id: 'voices', label: '五种逻辑音色配置' },
  { id: 'voice_playback', label: '五音色合成与播放' },
  { id: 'verification_refresh', label: '刷新真实验证状态' },
  { id: 'cache_replay', label: '相同文本缓存复跑' },
  { id: 'controls', label: '切换、停止与过期回调' },
  { id: 'chapters', label: '三章连续听读' },
  { id: 'fallback', label: '云端失败降级' },
  { id: 'background_stop', label: '后台停止' }
]

export default {
  data() {
    return {
      themeId: getAppThemeId(),
      debugAllowed: getDebugModeState().enabled,
      hasToken: !!apiClient.getToken(),
      running: false,
      report: null,
      runner: null,
      autoStartTimer: null,
      segmentProgress: {},
      waveBars: [24, 46, 72, 38, 86, 54, 30, 68, 42, 78, 50, 28],
      miniWaveBars: [16, 32, 22, 42, 28, 18]
    }
  },
  computed: {
    themeVars() {
      return getAppThemeStyle(this.themeId)
    },
    visibleSteps() {
      const current = new Map(((this.report && this.report.steps) || []).map(step => [step.id, step]))
      return STEP_BLUEPRINTS.map(item => current.get(item.id) || {
        ...item,
        status: 'pending',
        message: '',
        durationMs: 0
      })
    },
    totalSteps() {
      return STEP_BLUEPRINTS.length
    },
    completedSteps() {
      return this.visibleSteps.filter(step => ['passed', 'failed', 'warning'].includes(step.status)).length
    },
    progressPercent() {
      return Math.round((this.completedSteps / this.totalSteps) * 100)
    },
    hasFailed() {
      return !!(this.report && this.report.summary && this.report.summary.failed)
    },
    needsBackgroundRetry() {
      const step = this.report && Array.isArray(this.report.steps)
        ? this.report.steps.find(item => item.id === 'background_stop')
        : null
      return !!(step && ['warning', 'failed'].includes(step.status))
    },
    primaryActionLabel() {
      if (this.running) return '正在自动验收'
      if (this.needsBackgroundRetry) return '仅重试后台停止'
      return this.report ? '重新运行' : '开始验收'
    },
    heroLabel() {
      if (this.running) return 'LIVE SIGNAL'
      if (this.report && this.report.passed) return 'SIGNAL VERIFIED'
      if (this.report) return 'SIGNAL NEEDS ATTENTION'
      return 'READY TO TRACE'
    },
    heroTitle() {
      if (this.running) return '正在沿着声音链路逐段检查'
      if (this.report && this.report.passed) return '五种真实声音已经完整走通'
      if (this.report) return '验收报告已生成，请查看失败项'
      return '让每一次播放都有证据'
    },
    heroDescription() {
      if (this.running && this.report && this.report.currentStep === 'background_stop') {
        return '现在请让应用进入后台，ADB 脚本会自动按 Home 并恢复。'
      }
      return '从后端状态到手机扬声器，自动验证真实合成、缓存、连续听读、降级与资源停止。'
    }
  },
  onLoad(query = {}) {
    if (!this.debugAllowed) {
      uni.showToast({ title: '请先开启调试模式', icon: 'none' })
      return
    }
    if (!this.hasToken) return
    if (this.restoreRetryableReport()) return
    if (String(query.auto || '1') !== '0') {
      this.autoStartTimer = setTimeout(() => this.runAcceptance(), 650)
    }
  },
  onShow() {
    this.themeId = getAppThemeId()
    this.debugAllowed = getDebugModeState().enabled
    this.hasToken = !!apiClient.getToken()
  },
  onHide() {
    if (this.runner && this.running) this.runner.onBackground()
  },
  onUnload() {
    if (this.autoStartTimer) clearTimeout(this.autoStartTimer)
    if (this.runner) this.runner.dispose()
  },
  methods: {
    restoreRetryableReport() {
      try {
        const raw = uni.getStorageSync('ttsAcceptance:lastReport')
        const saved = raw ? JSON.parse(raw) : null
        const backgroundStep = saved && Array.isArray(saved.steps)
          ? saved.steps.find(item => item.id === 'background_stop')
          : null
        if (!backgroundStep || !['warning', 'failed'].includes(backgroundStep.status)) return false
        this.report = sanitizeTtsAcceptanceReport(saved)
        this.runner = this.createRunner()
        return this.runner.restoreReport(this.report)
      } catch (error) {
        return false
      }
    },
    runPrimaryAction() {
      if (this.needsBackgroundRetry) return this.retryBackground()
      return this.runAcceptance()
    },
    createRunner() {
      const cloudDriver = createCloudReadAloudDriver({ apiClient })
      const systemDriver = createReadAloudDriver()
      return createTtsAcceptanceRunner({
        apiClient,
        cloudDriver,
        systemDriver,
        onUpdate: report => {
          this.report = report
          this.running = !!(this.runner && this.runner.isRunning())
        },
        onSegment: segment => {
          this.segmentProgress = segment
        }
      })
    },
    async runAcceptance() {
      if (this.running || !this.debugAllowed) return
      if (!apiClient.getToken()) {
        this.hasToken = false
        uni.showToast({ title: '请先在“我的”页面登录后端', icon: 'none' })
        return
      }
      if (this.runner) this.runner.dispose()
      this.report = null
      this.segmentProgress = {}
      this.runner = this.createRunner()
      this.running = true
      try {
        const report = await this.runner.run()
        this.report = sanitizeTtsAcceptanceReport(report)
        try {
          uni.setStorageSync('ttsAcceptance:lastReport', JSON.stringify(this.report))
        } catch (error) {}
        uni.showToast({
          title: this.report.passed ? 'TTS 自动验收通过' : '验收完成，请查看报告',
          icon: 'none'
        })
      } finally {
        this.running = false
      }
    },
    async retryBackground() {
      if (this.running || !this.runner) return
      this.running = true
      try {
        const report = await this.runner.retryBackground()
        this.report = sanitizeTtsAcceptanceReport(report)
        try {
          uni.setStorageSync('ttsAcceptance:lastReport', JSON.stringify(this.report))
        } catch (error) {}
        uni.showToast({
          title: this.report.passed ? '后台停止验收通过' : '后台停止仍需检查',
          icon: 'none'
        })
      } finally {
        this.running = false
      }
    },
    stopAcceptance() {
      if (!this.runner || !this.running) return
      this.runner.stop('manual')
      this.running = false
      uni.showToast({ title: '验收已停止', icon: 'none' })
    },
    copyReport() {
      if (!this.report) {
        uni.showToast({ title: '暂无验收报告', icon: 'none' })
        return
      }
      uni.setClipboardData({
        data: JSON.stringify(sanitizeTtsAcceptanceReport(this.report), null, 2),
        success: () => uni.showToast({ title: '脱敏报告已复制', icon: 'none' })
      })
    },
    chapterMetric(key) {
      const value = this.report && this.report.metrics && this.report.metrics.chapters
        ? this.report.metrics.chapters[key]
        : 0
      return Number(value) || 0
    },
    stepStatusLabel(status) {
      return {
        pending: '等待',
        running: '进行中',
        passed: '通过',
        failed: '失败',
        warning: '提醒'
      }[status] || status
    },
    goBack() {
      if (this.running && this.runner) this.runner.stop('navigation')
      uni.navigateBack()
    },
    goProfileLogin() {
      uni.switchTab({ url: '/pages/profile/profile' })
    }
  }
}
</script>

<style scoped>
.acceptance-page {
  min-height: 100vh;
  color: var(--app-text);
  background: var(--app-bg);
}

.topbar {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx 30rpx 18rpx;
}

.round-button {
  width: 72rpx;
  height: 72rpx;
  margin: 0;
  padding: 0;
  border: 1rpx solid var(--app-border);
  border-radius: 50%;
  color: var(--app-text);
  background: var(--app-card);
  font-size: 38rpx;
  line-height: 68rpx;
}

.topbar-copy {
  flex: 1;
  min-width: 0;
}

.eyebrow,
.section-kicker,
.chapter-kicker {
  color: var(--app-accent);
  font-size: 19rpx;
  font-weight: 800;
  letter-spacing: 3rpx;
}

.page-title {
  margin-top: 4rpx;
  font-size: 38rpx;
  font-weight: 900;
}

.acceptance-scroll {
  height: calc(100vh - 112rpx);
}

.signal-hero {
  position: relative;
  overflow: hidden;
  margin: 10rpx 28rpx 0;
  padding: 32rpx;
  border: 1rpx solid color-mix(in srgb, var(--app-accent) 34%, var(--app-border));
  border-radius: 34rpx;
  background:
    radial-gradient(circle at 86% 18%, color-mix(in srgb, var(--app-accent) 30%, transparent), transparent 38%),
    linear-gradient(145deg, color-mix(in srgb, var(--app-card) 96%, transparent), var(--app-card-soft));
}

.signal-meta,
.section-head,
.report-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.signal-label,
.signal-count,
.section-state {
  color: var(--app-text-muted);
  font-size: 19rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}

.signal-wave {
  display: flex;
  align-items: center;
  height: 96rpx;
  gap: 9rpx;
  margin: 26rpx 0;
}

.signal-wave text {
  width: 9rpx;
  border-radius: 9rpx;
  background: var(--app-accent);
  transform-origin: center;
}

.signal-hero.active .signal-wave text {
  animation: signal-pulse 920ms ease-in-out infinite alternate;
}

.signal-hero.passed .signal-wave text {
  background: #77cdb8;
}

.signal-hero.failed .signal-wave text {
  background: #e98268;
}

.hero-title {
  max-width: 580rpx;
  font-size: 40rpx;
  font-weight: 900;
  line-height: 1.25;
}

.hero-desc {
  display: block;
  margin-top: 16rpx;
  color: var(--app-text-muted);
  font-size: 24rpx;
  line-height: 1.65;
}

.progress-track {
  overflow: hidden;
  height: 6rpx;
  margin-top: 28rpx;
  border-radius: 6rpx;
  background: color-mix(in srgb, var(--app-text-muted) 18%, transparent);
}

.progress-value {
  height: 100%;
  border-radius: inherit;
  background: var(--app-accent);
  transition: width 240ms ease;
}

.action-row {
  display: flex;
  gap: 16rpx;
  padding: 24rpx 28rpx 0;
}

.primary-action,
.secondary-action,
.copy-action {
  height: 76rpx;
  margin: 0;
  border: 0;
  border-radius: 38rpx;
  font-size: 25rpx;
  font-weight: 800;
  line-height: 76rpx;
}

.primary-action {
  flex: 1;
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.secondary-action {
  width: 150rpx;
  color: var(--app-text);
  background: var(--app-card);
  border: 1rpx solid var(--app-border);
}

.privacy-line,
.guard-card,
.manual-card {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
  margin: 20rpx 28rpx 0;
  padding: 22rpx 24rpx;
  border-radius: 22rpx;
  color: var(--app-text-muted);
  background: color-mix(in srgb, var(--app-card) 88%, transparent);
  font-size: 22rpx;
  line-height: 1.55;
}

.privacy-badge,
.guard-mark,
.manual-mark {
  flex-shrink: 0;
  padding: 6rpx 10rpx;
  border-radius: 10rpx;
  color: var(--app-on-accent);
  background: var(--app-accent);
  font-size: 17rpx;
  font-weight: 900;
  letter-spacing: 1rpx;
}

.section-head {
  margin: 38rpx 30rpx 16rpx;
}

.section-title,
.report-title {
  margin-top: 6rpx;
  font-size: 31rpx;
  font-weight: 850;
}

.step-list {
  padding: 0 28rpx;
}

.step-card {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-height: 92rpx;
  margin-bottom: 12rpx;
  padding: 18rpx 20rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 22rpx;
  background: var(--app-card);
}

.step-card.running {
  border-color: color-mix(in srgb, var(--app-accent) 66%, var(--app-border));
}

.step-card.failed {
  border-color: rgba(226, 95, 53, 0.62);
}

.step-index {
  width: 44rpx;
  color: var(--app-accent);
  font-size: 20rpx;
  font-weight: 900;
  letter-spacing: 1rpx;
}

.step-copy {
  flex: 1;
  min-width: 0;
}

.step-title {
  font-size: 25rpx;
  font-weight: 750;
}

.step-message {
  display: block;
  margin-top: 5rpx;
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 21rpx;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step-result {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  color: var(--app-text-muted);
  font-size: 20rpx;
  font-weight: 800;
}

.step-card.passed .step-result {
  color: #77cdb8;
}

.step-card.failed .step-result {
  color: #ef8f74;
}

.step-card.warning .step-result {
  color: #e5bd70;
}

.step-duration {
  margin-top: 5rpx;
  font-size: 17rpx;
  font-weight: 500;
}

.chapter-now {
  display: flex;
  gap: 22rpx;
  margin: 26rpx 28rpx 0;
  padding: 24rpx;
  border-radius: 24rpx;
  background: color-mix(in srgb, var(--app-accent) 13%, var(--app-card));
}

.chapter-wave {
  display: flex;
  align-items: center;
  gap: 5rpx;
  width: 82rpx;
}

.chapter-wave text {
  width: 6rpx;
  border-radius: 6rpx;
  background: var(--app-accent);
  animation: signal-pulse 780ms ease-in-out infinite alternate;
}

.chapter-copy {
  flex: 1;
  color: var(--app-text-muted);
  font-size: 21rpx;
  line-height: 1.5;
}

.chapter-title {
  margin: 5rpx 0;
  color: var(--app-text);
  font-size: 26rpx;
  font-weight: 800;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12rpx;
  margin: 26rpx 28rpx 0;
}

.metric-card {
  min-height: 118rpx;
  padding: 22rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 22rpx;
  background: var(--app-card);
}

.metric-value {
  display: block;
  color: var(--app-accent);
  font-size: 34rpx;
  font-weight: 900;
}

.metric-label {
  display: block;
  margin-top: 8rpx;
  color: var(--app-text-muted);
  font-size: 20rpx;
}

.guard-title,
.manual-title {
  color: var(--app-text);
  font-size: 25rpx;
  font-weight: 800;
}

.guard-copy {
  min-width: 0;
  flex: 1;
}

.login-action {
  height: 64rpx;
  margin: 18rpx 0 0;
  padding: 0 24rpx;
  border: 0;
  border-radius: 32rpx;
  color: var(--app-on-accent);
  background: var(--app-accent);
  font-size: 22rpx;
  font-weight: 800;
  line-height: 64rpx;
}

.guard-desc,
.manual-desc {
  display: block;
  margin-top: 7rpx;
}

.report-card {
  margin: 26rpx 28rpx 0;
  padding: 28rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 26rpx;
  background: var(--app-card);
}

.report-badge {
  padding: 9rpx 13rpx;
  border-radius: 12rpx;
  color: #1d1511;
  background: #e5bd70;
  font-size: 18rpx;
  font-weight: 900;
  letter-spacing: 1rpx;
}

.report-badge.passed {
  color: #11201c;
  background: #77cdb8;
}

.report-summary {
  display: block;
  margin-top: 18rpx;
  color: var(--app-text-muted);
  font-size: 23rpx;
  line-height: 1.55;
}

.copy-action {
  width: 100%;
  margin-top: 22rpx;
  color: var(--app-text);
  background: var(--app-card-soft);
  border: 1rpx solid var(--app-border);
}

.page-spacer {
  height: 90rpx;
}

@keyframes signal-pulse {
  from { transform: scaleY(0.48); opacity: 0.62; }
  to { transform: scaleY(1); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .signal-wave text,
  .chapter-wave text {
    animation: none;
  }

  .progress-value {
    transition: none;
  }
}
</style>
