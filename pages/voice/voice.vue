<template>
  <view class="voice-page app-page secondary" :class="themeClass" :style="themeVars">
    <view class="voice-topbar reader-safe-top">
      <button class="round-button" aria-label="返回阅读器" @tap="goBack">‹</button>
      <view class="topbar-copy">
        <text class="eyebrow">VOICE LIBRARY</text>
        <view class="page-title">谁来为你读</view>
      </view>
      <button class="round-button refresh" :loading="refreshing" aria-label="刷新声音列表" @tap="refreshAllVoices">↻</button>
    </view>

    <scroll-view class="voice-scroll" scroll-y :show-scrollbar="false">
      <view
        class="current-stage"
        :class="{ previewing: activeVoicePreviewing }"
        :style="voiceVisualStyle(activeVoice, 0)"
      >
        <view class="stage-atmosphere" aria-hidden="true">
          <view class="stage-core">
            <text
              v-for="bar in voiceVisualBars(activeVoice, 0)"
              :key="'stage-' + bar.key"
              :style="{ height: bar.height + 'rpx' }"
            ></text>
          </view>
        </view>
        <view class="stage-copy">
          <view class="stage-label-row">
            <text class="stage-kicker">CURRENT VOICE</text>
            <text class="stage-provider">{{ activeVoiceProviderLabel }}</text>
          </view>
          <view class="stage-name">{{ activeVoice.name }}</view>
          <text class="stage-desc">{{ activeVoiceDescription }}</text>
          <view class="stage-status-row">
            <text class="stage-status-dot"></text>
            <text>{{ activeVoicePreviewing ? '正在试听这一段声音' : '已设为当前听读声音' }}</text>
          </view>
        </view>
        <button
          class="stage-preview"
          :class="{ active: activeVoicePreviewing }"
          :aria-label="activeVoicePreviewing ? '停止试听当前声音' : '试听当前声音'"
          @tap="previewActiveVoice"
        >
          <text class="stage-preview-icon">{{ activeVoicePreviewing ? '■' : '▶' }}</text>
          <text>{{ activeVoicePreviewing ? '停止' : '试听' }}</text>
        </button>
      </view>

      <view class="section-head">
        <view>
          <text class="section-kicker cloud">AI 角色声场</text>
          <view class="section-title">五种拟真旁白</view>
        </view>
        <text class="section-count">{{ paddedCloudVoiceCount }} / 05</text>
      </view>

      <view class="cloud-disclosure">
        <text class="cloud-disclosure-badge">AI</text>
        <text>AI 合成音，不是真人录音；试听时仅发送当前短片段。</text>
      </view>

      <view class="cloud-stage-grid skeleton-grid" v-if="cloudLoading">
        <view class="cloud-poster skeleton-poster" v-for="index in 5" :key="'skeleton-' + index">
          <view class="skeleton-line short"></view>
          <view class="skeleton-medallion"></view>
          <view class="skeleton-line"></view>
          <view class="skeleton-line small"></view>
        </view>
      </view>

      <view class="status-card cloud-unavailable compact-status" v-else-if="cloudMessage">
        <view>
          <view class="status-title">{{ cloudStatusTitle }}</view>
          <text class="status-desc">{{ cloudMessage }}</text>
        </view>
        <button class="retry-button" v-if="hasLoginToken" @tap="loadCloudVoices">重试</button>
      </view>

      <view class="cloud-stage-grid" v-else>
        <view
          class="cloud-poster"
          v-for="(voice, index) in cloudVoices"
          :key="'volcengine:' + voice.id"
          :class="{
            wide: isWideCloudVoice(voice),
            selected: selectedProvider === 'volcengine' && selectedId === voice.id,
            previewing: previewVoiceKey === cloudVoiceKey(voice)
          }"
          :style="voiceVisualStyle(voice, index)"
        >
          <view class="poster-head">
            <text class="poster-index">{{ voiceOrdinal(index) }}</text>
            <text class="poster-state" v-if="previewVoiceKey === cloudVoiceKey(voice)">播放中</text>
            <text class="poster-state selected" v-else-if="selectedProvider === 'volcengine' && selectedId === voice.id">正在使用</text>
            <text class="poster-state" v-else>{{ voiceRoleName(voice, index) }}</text>
          </view>
          <view class="poster-portrait" aria-hidden="true">
            <view class="poster-glyph">{{ voiceRoleGlyph(voice, index) }}</view>
            <view class="poster-wave">
              <text
                v-for="bar in voiceVisualBars(voice, index)"
                :key="'poster-' + bar.key"
                :style="{ height: bar.height + 'rpx' }"
              ></text>
            </view>
          </view>
          <view class="poster-name">{{ voice.name }}</view>
          <text class="poster-note">{{ voiceRoleNote(voice, index) }}</text>
          <view class="poster-actions">
            <button
              class="poster-action preview"
              :aria-label="`试听${voice.name}`"
              @tap="previewCloudVoice(voice)"
            >
              {{ previewVoiceKey === cloudVoiceKey(voice) ? '停止试听' : '试听' }}
            </button>
            <button
              class="poster-action select"
              :disabled="selectedProvider === 'volcengine' && selectedId === voice.id"
              :aria-label="`选择${voice.name}`"
              @tap="selectCloudVoice(voice)"
            >
              {{ selectedProvider === 'volcengine' && selectedId === voice.id ? '已选择' : '使用' }}
            </button>
          </view>
        </view>
      </view>

      <view class="secondary-section device-section">
        <button
          class="section-toggle"
          :aria-label="deviceExpanded ? '收起设备系统声音' : '展开设备系统声音'"
          @tap="deviceExpanded = !deviceExpanded"
        >
          <view>
            <text class="section-kicker">设备系统声音</text>
            <view class="section-title compact-title">当前可用的中文音色</view>
          </view>
          <view class="toggle-meta">
            <text>{{ voices.length }} 种</text>
            <text class="toggle-arrow">{{ deviceExpanded ? '−' : '+' }}</text>
          </view>
        </button>

        <view class="device-panel" v-if="deviceExpanded">
          <view class="status-card compact-status" v-if="loading">
            <view class="status-orbit"></view>
            <view>
              <view class="status-title">正在读取系统声音</view>
              <text class="status-desc">部分浏览器需要稍候片刻才能返回音色列表。</text>
            </view>
          </view>

          <view class="status-card error compact-status" v-else-if="errorMessage">
            <view>
              <view class="status-title">无法读取额外声音</view>
              <text class="status-desc">{{ errorMessage }}</text>
            </view>
            <button class="retry-button" @tap="loadVoices">重试</button>
          </view>

          <view class="device-list" v-else>
            <view
              class="device-row"
              v-for="(voice, index) in voices"
              :key="voice.provider + ':' + voice.id"
              :class="{
                selected: selectedProvider === 'system' && selectedId === voice.id,
                previewing: previewVoiceKey === voiceKey(voice)
              }"
            >
              <view class="device-wave" aria-hidden="true">
                <text
                  v-for="bar in signatureBars(index)"
                  :key="'device-' + bar.key"
                  :style="{ height: bar.height + 'rpx' }"
                ></text>
              </view>
              <view class="device-copy">
                <view class="device-name-row">
                  <view class="device-name">{{ voice.name }}</view>
                  <text class="device-current" v-if="selectedProvider === 'system' && selectedId === voice.id">正在使用</text>
                </view>
                <text class="device-meta">{{ qualityLabel(voice) }} · {{ sourceLabel(voice) }} · {{ formatLanguage(voice.lang) }}</text>
              </view>
              <view class="device-actions">
                <button
                  class="device-action preview"
                  :aria-label="`试听${voice.name}`"
                  @tap="previewVoice(voice)"
                >{{ previewVoiceKey === voiceKey(voice) ? '■' : '▶' }}</button>
                <button
                  class="device-action select"
                  :disabled="selectedProvider === 'system' && selectedId === voice.id"
                  :aria-label="`选择${voice.name}`"
                  @tap="selectVoice(voice)"
                >{{ selectedProvider === 'system' && selectedId === voice.id ? '已用' : '使用' }}</button>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view class="section-head device-head">
        <view>
          <text class="section-kicker">离线角色效果</text>
          <view class="section-title">本地效果器预设</view>
        </view>
        <text class="section-count">{{ roleVoices.length }} PRESETS</text>
      </view>

      <scroll-view class="role-strip" scroll-x :show-scrollbar="false">
        <view class="role-row">
          <view
            class="role-card"
            v-for="role in roleVoices"
            :key="role.id"
            :class="{
              selected: selectedProvider === 'preset' && selectedId === role.id,
              previewing: previewVoiceKey === roleKey(role)
            }"
            :style="voiceVisualStyle(role, 0)"
          >
            <view class="role-card-top">
              <view class="role-glyph">{{ role.glyph }}</view>
              <text class="role-state" v-if="previewVoiceKey === roleKey(role)">播放中</text>
              <text class="role-state" v-else-if="selectedProvider === 'preset' && selectedId === role.id">正在使用</text>
            </view>
            <view class="role-name-row">
              <view class="role-name">{{ role.name }}</view>
            </view>
            <text class="role-desc">{{ role.desc }}</text>
            <text class="role-params">音调 {{ role.pitch }} · 节奏 {{ role.rateScale }}x</text>
            <view class="role-actions">
              <button class="role-action preview" @tap.stop="previewRole(role)">
                {{ previewVoiceKey === roleKey(role) ? '停止' : '试听' }}
              </button>
              <button
                class="role-action select"
                :disabled="selectedProvider === 'preset' && selectedId === role.id"
                @tap.stop="selectRole(role)"
              >
                {{ selectedProvider === 'preset' && selectedId === role.id ? '已选择' : '选择' }}
              </button>
            </view>
          </view>
        </view>
      </scroll-view>

      <view class="privacy-note">
        <text class="privacy-mark">LOCAL</text>
        <view>
          <view>离线声音始终可用</view>
          <text>未登录、未授权或云端服务异常时，仍可选择设备系统声音和离线角色效果。Android 已排除明确要求联网的音色。</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import {
  createCloudReadAloudDriver,
  createReadAloudDriver,
  READ_ALOUD_ROLE_PRESETS,
  resolveReadAloudVoiceProfile,
  SYSTEM_DEFAULT_VOICE
} from '../../common/readAloud.js'
import apiClient from '../../common/apiClient.js'
import { getPrefs, savePrefs } from '../../common/reader.js'
import { getAppThemeId, getAppThemeStyle } from '../../common/appTheme.js'
import { isMotionReduced, setNavigationMotion } from '../../common/motion.js'

const PREVIEW_TEXT = '你好，我是解码阅读。接下来将用这个声音，为你朗读喜欢的故事。'

const VOICE_ROLE_VISUALS = Object.freeze({
  loli: {
    role: '萝莉',
    glyph: '萝',
    note: '轻快 · 甜暖',
    color: '#FF7EA8',
    soft: '#FFD4E2',
    wash: 'rgba(255, 126, 168, 0.16)',
    bars: [28, 54, 72, 42, 82, 58, 34]
  },
  uncle: {
    role: '大叔',
    glyph: '叔',
    note: '沉稳 · 低醇',
    color: '#B87949',
    soft: '#E7C3A6',
    wash: 'rgba(184, 121, 73, 0.16)',
    bars: [62, 36, 74, 48, 68, 42, 58]
  },
  youth: {
    role: '青年',
    glyph: '青',
    note: '清朗 · 松弛',
    color: '#4B87F7',
    soft: '#BBD2FF',
    wash: 'rgba(75, 135, 247, 0.16)',
    bars: [36, 68, 44, 78, 52, 72, 40]
  },
  shota: {
    role: '正太',
    glyph: '少',
    note: '明亮 · 灵动',
    color: '#42C4B7',
    soft: '#B8ECE7',
    wash: 'rgba(66, 196, 183, 0.16)',
    bars: [34, 76, 48, 86, 58, 70, 30]
  },
  recital: {
    role: '朗诵',
    glyph: '诵',
    note: '舒缓 · 有致',
    color: '#8D72D9',
    soft: '#D5C9F3',
    wash: 'rgba(141, 114, 217, 0.16)',
    bars: [44, 58, 72, 84, 72, 58, 44]
  }
})

const DEFAULT_VOICE_VISUAL = Object.freeze({
  role: '音色',
  glyph: '声',
  note: '自然 · 清晰',
  color: '#72809B',
  soft: '#CDD3DE',
  wash: 'rgba(114, 128, 155, 0.14)',
  bars: [38, 56, 72, 48, 68, 52, 34]
})

export default {
  data() {
    const prefs = getPrefs()
    return {
      prefs,
      themeId: getAppThemeId(),
      motionReduced: isMotionReduced(),
      loggedIn: !!apiClient.getToken(),
      cloudVoices: [],
      cloudLoading: false,
      cloudMessage: '',
      cloudState: '',
      cloudStatus: null,
      cloudAvailable: false,
      voices: [{ ...SYSTEM_DEFAULT_VOICE }],
      selectedProvider: prefs.ttsVoiceProvider,
      selectedId: prefs.ttsVoiceId,
      loading: false,
      errorMessage: '',
      previewVoiceKey: '',
      previewToken: 0,
      driver: null,
      cloudDriver: null,
      loadToken: 0,
      cloudLoadToken: 0,
      deviceExpanded: prefs.ttsVoiceProvider === 'system',
      roleVoices: READ_ALOUD_ROLE_PRESETS.map(role => ({ ...role }))
    }
  },
  computed: {
    themeClass() {
      return 'theme-' + this.themeId
    },
    refreshing() {
      return this.loading || this.cloudLoading
    },
    hasLoginToken() {
      return this.loggedIn
    },
    cloudStatusTitle() {
      const titles = {
        login_required: '登录后使用拟真音色',
        wrong_service: '连接到了错误服务',
        backend_offline: '后端服务未启动',
        disabled: '拟真语音已关闭',
        not_configured: '拟真语音尚未配置',
        not_verified: '拟真音色尚未验证',
        quota_exhausted: '今日拟真语音额度已用完',
        no_voices: '尚未配置拟真音色',
        connection_error: '拟真语音暂不可用'
      }
      return titles[this.cloudState] || (this.hasLoginToken ? '拟真语音暂不可用' : '登录后使用拟真音色')
    },
    paddedCloudVoiceCount() {
      return String(this.cloudVoices.length).padStart(2, '0')
    },
    activeVoice() {
      const provider = this.selectedProvider || 'system'
      const collection = provider === 'volcengine'
        ? this.cloudVoices
        : provider === 'preset'
          ? this.roleVoices
          : this.voices
      const matched = collection.find(voice => String(voice.id || '') === String(this.selectedId || ''))
      if (matched) return { ...matched, provider }
      return {
        ...(provider === 'system' ? SYSTEM_DEFAULT_VOICE : {}),
        id: this.selectedId || '',
        name: this.prefs.ttsVoiceName || SYSTEM_DEFAULT_VOICE.name,
        provider
      }
    },
    activeVoiceProviderLabel() {
      if (this.selectedProvider === 'volcengine') return 'AI 拟真旁白'
      if (this.selectedProvider === 'preset') return '离线角色效果'
      return '设备系统声音'
    },
    activeVoiceDescription() {
      const visual = this.resolveVoiceVisual(this.activeVoice, 0)
      if (this.selectedProvider === 'volcengine') return `${visual.note}，由云端神经语音生成`
      if (this.selectedProvider === 'preset') return `${visual.note}，使用设备声音的本地节奏处理`
      return `${visual.note}，由当前设备语音服务提供`
    },
    activeVoicePreviewing() {
      return this.previewVoiceKey === this.selectionKey(this.activeVoice)
    },
    themeVars() {
      return {
        ...getAppThemeStyle(this.themeId),
        '--voice-motion': this.motionReduced ? '0ms' : '220ms',
        '--voice-playing': '#FF6F52'
      }
    }
  },
  onLoad() {
    this.refreshAllVoices()
  },
  onShow() {
    this.themeId = getAppThemeId()
    this.motionReduced = isMotionReduced()
    const wasLoggedIn = this.loggedIn
    this.loggedIn = !!apiClient.getToken()
    this.prefs = getPrefs()
    this.selectedProvider = this.prefs.ttsVoiceProvider
    this.selectedId = this.prefs.ttsVoiceId
    if (!wasLoggedIn && this.loggedIn) this.loadCloudVoices()
  },
  onHide() {
    this.stopPreview()
  },
  onUnload() {
    this.disposeDriver()
  },
  methods: {
    adaptColorForTheme(hexColor, themeId) {
      if (!hexColor || hexColor.length < 7) return hexColor
      const darkThemes = ['xuanye', 'cyber', 'noirGold']
      const r = parseInt(hexColor.slice(1, 3), 16)
      const g = parseInt(hexColor.slice(3, 5), 16)
      const b = parseInt(hexColor.slice(5, 7), 16)
      if (darkThemes.includes(themeId)) {
        const boost = (c) => Math.min(255, Math.round(c * 1.2 + 16))
        const sat = (c) => Math.min(255, Math.round(c * 1.1))
        return '#' + [boost(r), sat(g), sat(b)].map(v => v.toString(16).padStart(2, '0')).join('')
      }
      return hexColor
    },
    adaptWashForTheme(hexColor, themeId, alpha) {
      if (!hexColor || hexColor.length < 7) return 'rgba(255, 126, 168, 0.16)'
      const darkThemes = ['xuanye', 'cyber', 'noirGold']
      const lightThemes = ['candy', 'sakura']
      const r = parseInt(hexColor.slice(1, 3), 16)
      const g = parseInt(hexColor.slice(3, 5), 16)
      const b = parseInt(hexColor.slice(5, 7), 16)
      if (darkThemes.includes(themeId)) {
        return `rgba(${r}, ${g}, ${b}, ${Math.min(0.24, alpha + 0.08)})`
      }
      if (lightThemes.includes(themeId)) {
        return `rgba(${r}, ${g}, ${b}, ${alpha})`
      }
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    },
    resolveVoiceVisual(voice, index = 0) {
      const id = String((voice && voice.id) || '').trim().toLowerCase()
      const source = VOICE_ROLE_VISUALS[id] || VOICE_ROLE_VISUALS[['loli', 'uncle', 'youth', 'shota', 'recital'][index]] || DEFAULT_VOICE_VISUAL
      return {
        ...source,
        color: this.adaptColorForTheme(source.color, this.themeId),
        soft: this.adaptColorForTheme(source.soft, this.themeId),
        wash: this.adaptWashForTheme(source.color, this.themeId, 0.16)
      }
    },
    voiceVisualStyle(voice, index = 0) {
      const visual = this.resolveVoiceVisual(voice, index)
      return {
        '--voice-role': visual.color,
        '--voice-role-soft': visual.soft,
        '--voice-role-wash': visual.wash,
        '--voice-sequence': `${index * 45}ms`
      }
    },
    voiceVisualBars(voice, index = 0) {
      return this.resolveVoiceVisual(voice, index).bars.map((height, barIndex) => ({
        key: `${String((voice && voice.id) || 'neutral')}-${barIndex}`,
        height
      }))
    },
    voiceRoleName(voice, index = 0) {
      return this.resolveVoiceVisual(voice, index).role
    },
    voiceRoleGlyph(voice, index = 0) {
      return this.resolveVoiceVisual(voice, index).glyph
    },
    voiceRoleNote(voice, index = 0) {
      return this.resolveVoiceVisual(voice, index).note
    },
    voiceOrdinal(index) {
      return String(index + 1).padStart(2, '0')
    },
    isWideCloudVoice(voice) {
      return String((voice && voice.id) || '').toLowerCase() === 'recital'
    },
    selectionKey(voice) {
      const provider = String((voice && voice.provider) || this.selectedProvider || 'system')
      if (provider === 'volcengine') return this.cloudVoiceKey(voice)
      if (provider === 'preset') return this.roleKey(voice)
      return this.voiceKey(voice)
    },
    previewActiveVoice() {
      if (this.selectedProvider === 'volcengine') return this.previewCloudVoice(this.activeVoice)
      if (this.selectedProvider === 'preset') return this.previewRole(this.activeVoice)
      return this.previewVoice(this.activeVoice)
    },
    refreshAllVoices() {
      this.loadVoices()
      this.loadCloudVoices()
    },
    ensureDriver() {
      if (!this.driver) this.driver = createReadAloudDriver()
      return this.driver
    },
    ensureCloudDriver() {
      if (!this.cloudDriver) this.cloudDriver = createCloudReadAloudDriver({ apiClient })
      return this.cloudDriver
    },
    async loadCloudVoices() {
      const token = ++this.cloudLoadToken
      this.cloudLoading = true
      this.cloudMessage = ''
      this.cloudState = ''
      this.cloudStatus = null
      this.cloudAvailable = false
      if (!this.hasLoginToken) {
        this.cloudVoices = []
        this.cloudState = 'login_required'
        this.cloudMessage = '请先在“我的”页面登录。未登录不影响设备声音和离线角色效果。'
        this.cloudLoading = false
        return
      }
      try {
        const status = await apiClient.getTtsStatus()
        if (token !== this.cloudLoadToken) return
        this.cloudStatus = status
        if (!status.enabled) {
          this.cloudVoices = []
          this.cloudState = 'disabled'
          this.cloudMessage = '后端已关闭云端拟真语音；设备声音和离线角色效果仍可使用。'
          return
        }
        if (!status.configured) {
          this.cloudVoices = []
          this.cloudState = 'not_configured'
          this.cloudMessage = '后端尚未读取到完整的火山引擎凭据，请检查本机配置后重启后端。'
          return
        }
        if (Number(status.verified_voice_count || 0) <= 0) {
          this.cloudVoices = []
          this.cloudState = 'not_verified'
          this.cloudMessage = '音色已经配置，但还没有完成真实合成验证。离线声音仍可正常使用。'
          return
        }
        const quota = status.quota || {}
        const quotaEmpty = [
          quota.user_daily_remaining,
          quota.global_daily_remaining,
          quota.global_monthly_remaining
        ].some(value => value !== undefined && value !== null && Number(value) <= 0)
        if (quotaEmpty) {
          this.cloudVoices = []
          this.cloudState = 'quota_exhausted'
          this.cloudMessage = '当前免费额度或本机费用保护额度已用完，不会继续请求云端合成。'
          return
        }
        const catalog = await apiClient.listTtsVoices()
        if (token !== this.cloudLoadToken) return
        const configuredVoices = Array.isArray(catalog.voices) ? catalog.voices : []
        const availableVoices = configuredVoices.filter(voice => voice && voice.available !== false)
        this.cloudAvailable = availableVoices.length > 0
        this.cloudVoices = availableVoices.map(voice => ({
          ...voice,
          id: String(voice.id || voice.voice_id || '').trim(),
          name: String(voice.name || voice.display_name || voice.id || voice.voice_id || 'AI 拟真音色'),
          lang: voice.lang || 'zh-CN',
          provider: 'volcengine',
          networkRequired: true
        })).filter(voice => voice.id)
        if (!this.cloudAvailable || !this.cloudVoices.length) {
          this.cloudState = configuredVoices.length ? 'not_verified' : 'no_voices'
          this.cloudMessage = configuredVoices.length
            ? '后端已返回音色，但当前没有通过真实验证的可用音色。'
            : '后端当前没有配置任何拟真音色；离线声音仍可正常使用。'
        }
        this.reconcileCloudVoice(true)
      } catch (error) {
        if (token !== this.cloudLoadToken) return
        this.cloudVoices = []
        const detail = this.cloudErrorMessage(error)
        this.cloudState = detail.state
        this.cloudMessage = detail.message
      } finally {
        if (token === this.cloudLoadToken) this.cloudLoading = false
      }
    },
    cloudErrorMessage(error) {
      const status = Number(error && error.statusCode)
      const code = String(error && error.data && error.data.error && error.data.error.code || '')
      if (code === 'unexpected_backend_response') {
        return {
          state: 'wrong_service',
          message: '当前端口返回的不是解码阅读后端。HBuilderX 基座联调请使用 8765 端口。'
        }
      }
      if (status === 401) {
        this.loggedIn = false
        return {
          state: 'login_required',
          message: '登录状态已失效，请重新登录。设备声音和离线角色效果仍可使用。'
        }
      }
      if (status === 429) {
        return {
          state: 'quota_exhausted',
          message: '今日拟真语音额度已用完，不会继续产生新的云端请求。'
        }
      }
      if (status === 0) {
        return {
          state: 'backend_offline',
          message: '请启动本机 8765 后端，并确认 ADB reverse tcp:8765 tcp:8765。'
        }
      }
      return {
        state: 'connection_error',
        message: '后端暂时无法提供拟真语音，请查看连接诊断后重试；离线声音仍可使用。'
      }
    },
    async loadVoices() {
      const token = ++this.loadToken
      this.stopPreview()
      this.loading = true
      this.errorMessage = ''
      try {
        const driver = this.ensureDriver()
        if (!driver.available) {
          throw new Error('当前设备未安装或未启用中文语音服务。')
        }
        const listed = typeof driver.listVoices === 'function'
          ? await driver.listVoices()
          : [{ ...SYSTEM_DEFAULT_VOICE }]
        if (token !== this.loadToken) return
        this.voices = Array.isArray(listed) && listed.length
          ? listed
          : [{ ...SYSTEM_DEFAULT_VOICE }]
        this.reconcileSavedVoice()
      } catch (error) {
        if (token !== this.loadToken) return
        this.voices = [{ ...SYSTEM_DEFAULT_VOICE }]
        this.errorMessage = String((error && error.message) || '请检查系统中文语音服务后重试。')
      } finally {
        if (token === this.loadToken) this.loading = false
      }
    },
    reconcileSavedVoice() {
      this.prefs = getPrefs()
      if (this.prefs.ttsVoiceProvider === 'volcengine') {
        this.selectedProvider = 'volcengine'
        this.selectedId = this.prefs.ttsVoiceId
        return
      }
      if (this.prefs.ttsVoiceProvider === 'preset') {
        const matchedRole = this.roleVoices.some(role => role.id === this.prefs.ttsVoiceId)
        if (matchedRole) {
          this.selectedProvider = 'preset'
          this.selectedId = this.prefs.ttsVoiceId
          return
        }
      }
      const matched = this.voices.some(voice => voice.id === this.prefs.ttsVoiceId)
      if (matched) {
        this.selectedProvider = 'system'
        this.selectedId = this.prefs.ttsVoiceId
        return
      }
      const hadSavedVoice = !!this.prefs.ttsVoiceId
      this.prefs = savePrefs({
        ...this.prefs,
        ttsVoiceProvider: 'system',
        ttsVoiceId: '',
        ttsVoiceName: SYSTEM_DEFAULT_VOICE.name
      })
      this.selectedProvider = 'system'
      this.selectedId = ''
      if (hadSavedVoice) {
        uni.showToast({ title: '原声音不可用，已恢复系统默认', icon: 'none' })
      }
    },
    reconcileCloudVoice(authoritative = false) {
      this.prefs = getPrefs()
      if (this.prefs.ttsVoiceProvider !== 'volcengine') return
      const matched = this.cloudVoices.some(voice => voice.id === this.prefs.ttsVoiceId)
      if (matched) {
        this.selectedProvider = 'volcengine'
        this.selectedId = this.prefs.ttsVoiceId
        return
      }
      if (!authoritative || !this.cloudAvailable) return
      this.prefs = savePrefs({
        ...this.prefs,
        ttsVoiceProvider: 'system',
        ttsVoiceId: '',
        ttsVoiceName: SYSTEM_DEFAULT_VOICE.name
      })
      this.selectedProvider = 'system'
      this.selectedId = ''
      uni.showToast({ title: '原拟真音色已下架，已恢复系统默认', icon: 'none' })
    },
    requestCloudConsent() {
      const prefs = getPrefs()
      if (prefs.ttsCloudConsent) return Promise.resolve(true)
      return new Promise(resolve => {
        uni.showModal({
          title: '启用 AI 拟真音色',
          content: '听读时会将当前短片段发送至云端生成语音，不会上传整本书。断网或服务不可用时可切换到设备声音。',
          confirmText: '同意并继续',
          cancelText: '暂不使用',
          success: result => {
            if (!result.confirm) {
              resolve(false)
              return
            }
            this.prefs = savePrefs({ ...getPrefs(), ttsCloudConsent: true })
            resolve(true)
          },
          fail: () => resolve(false)
        })
      })
    },
    async selectCloudVoice(voice) {
      if (!await this.requestCloudConsent()) return
      this.prefs = savePrefs({
        ...getPrefs(),
        ttsVoiceProvider: 'volcengine',
        ttsVoiceId: voice.id,
        ttsVoiceName: voice.name
      })
      this.selectedProvider = 'volcengine'
      this.selectedId = voice.id
      uni.showToast({ title: `已选择${voice.name}`, icon: 'none' })
    },
    selectVoice(voice) {
      this.prefs = savePrefs({
        ...getPrefs(),
        ttsVoiceProvider: 'system',
        ttsVoiceId: voice.id,
        ttsVoiceName: voice.name
      })
      this.selectedProvider = 'system'
      this.selectedId = voice.id
      this.deviceExpanded = true
      uni.showToast({ title: `已选择${voice.name}`, icon: 'none' })
    },
    selectRole(role) {
      this.prefs = savePrefs({
        ...getPrefs(),
        ttsVoiceProvider: 'preset',
        ttsVoiceId: role.id,
        ttsVoiceName: role.name
      })
      this.selectedProvider = 'preset'
      this.selectedId = role.id
      uni.showToast({ title: `已选择${role.name}角色效果`, icon: 'none' })
    },
    previewRole(role) {
      return this.previewSelection({
        provider: 'preset',
        id: role.id,
        key: this.roleKey(role)
      })
    },
    async previewVoice(voice) {
      return this.previewSelection({
        provider: 'system',
        id: voice.id,
        key: this.voiceKey(voice)
      })
    },
    async previewCloudVoice(voice) {
      const key = this.cloudVoiceKey(voice)
      if (this.previewVoiceKey === key) {
        this.stopPreview()
        return
      }
      if (!await this.requestCloudConsent()) return
      return this.previewSelection({
        provider: 'volcengine',
        id: voice.id,
        key
      })
    },
    async previewSelection(selection) {
      const key = selection.key
      if (this.previewVoiceKey === key) {
        this.stopPreview()
        return
      }
      this.stopPreview()
      const token = ++this.previewToken
      this.previewVoiceKey = key
      const profile = resolveReadAloudVoiceProfile(selection.provider, selection.id)
      try {
        const driver = selection.provider === 'volcengine'
          ? this.ensureCloudDriver()
          : this.ensureDriver()
        await driver.speak(PREVIEW_TEXT, {
          rate: this.prefs.ttsRate * profile.rateScale,
          pitch: profile.pitch,
          voiceId: profile.voiceId,
          voiceProvider: profile.provider,
          presetId: profile.presetId,
          utteranceId: `voice-preview-${Date.now()}-${token}`
        })
      } catch (error) {
        if (token !== this.previewToken) return
        uni.showToast({
          title: String((error && error.message) || '声音试听失败'),
          icon: 'none'
        })
      } finally {
        if (token === this.previewToken) this.previewVoiceKey = ''
      }
    },
    stopPreview() {
      this.previewToken += 1
      this.previewVoiceKey = ''
      try {
        if (this.driver) this.driver.stop()
      } catch (error) {}
      try {
        if (this.cloudDriver) this.cloudDriver.stop()
      } catch (error) {}
    },
    disposeDriver() {
      this.loadToken += 1
      this.cloudLoadToken += 1
      this.stopPreview()
      try {
        if (this.driver && typeof this.driver.dispose === 'function') this.driver.dispose()
      } catch (error) {}
      this.driver = null
      try {
        if (this.cloudDriver && typeof this.cloudDriver.dispose === 'function') this.cloudDriver.dispose()
      } catch (error) {}
      this.cloudDriver = null
    },
    signatureBars(index) {
      const base = [22, 38, 54, 30, 46]
      return base.map((height, barIndex) => ({
        key: `${index}-${barIndex}`,
        height: 18 + ((height + index * 11 + barIndex * 7) % 42)
      }))
    },
    voiceKey(voice) {
      return `${voice.provider || 'system'}:${voice.id || '__default__'}`
    },
    roleKey(role) {
      return `preset:${role.id}`
    },
    cloudVoiceKey(voice) {
      return `volcengine:${voice.id}`
    },
    formatLanguage(lang) {
      const value = String(lang || 'zh-CN').replace(/_/g, '-')
      if (value.toLowerCase().startsWith('zh')) return value.toUpperCase()
      return value
    },
    qualityLabel(voice) {
      if (voice.isDefault) return '系统推荐'
      if (voice.quality === null || voice.quality === undefined) return '浏览器音色'
      if (Number(voice.quality) >= 400) return '高品质'
      if (Number(voice.quality) <= 200) return '轻量音色'
      return '标准品质'
    },
    sourceLabel(voice) {
      if (voice.networkRequired === null) return '浏览器提供'
      return voice.networkRequired ? '需要联网' : '设备本地'
    },
    goBack() {
      this.stopPreview()
      setNavigationMotion('enter', 'back')
      const pages = getCurrentPages()
      if (pages.length > 1) {
        uni.navigateBack()
        return
      }
      uni.switchTab({ url: '/pages/bookshelf/bookshelf' })
    }
  }
}
</script>

<style>
.voice-page {
  box-sizing: border-box;
  width: 100%;
  max-width: 1120px;
  min-height: 100vh;
  margin: 0 auto;
  overflow: hidden;
  color: var(--app-text);
  background: var(--app-bg);
}

button::after {
  border: 0;
}

.voice-topbar {
  position: relative;
  z-index: 3;
  display: grid;
  grid-template-columns: 72rpx 1fr 72rpx;
  align-items: center;
  gap: 20rpx;
  padding: calc(34rpx + env(safe-area-inset-top)) 30rpx 22rpx;
  border-bottom: 1rpx solid var(--app-border);
  background: var(--app-top);
  box-shadow: 0 12rpx 38rpx rgba(0, 0, 0, 0.12);
}

.round-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  padding: 0;
  border: 1rpx solid var(--app-border);
  border-radius: 999rpx;
  color: var(--app-text);
  background: var(--app-panel);
  font-size: 46rpx;
  line-height: 1;
}

.round-button.refresh {
  color: var(--app-accent);
  font-size: 34rpx;
}

.topbar-copy {
  min-width: 0;
}

.eyebrow,
.section-kicker,
.section-count,
.privacy-mark {
  font-family: var(--app-utility-font, monospace);
  letter-spacing: 1.4rpx;
}

.eyebrow {
  color: var(--app-accent);
  font-size: 19rpx;
  font-weight: 800;
}

.page-title {
  margin-top: 4rpx;
  font-family: var(--app-display-font);
  font-size: 40rpx;
  font-weight: 900;
}

.voice-scroll {
  box-sizing: border-box;
  height: calc(100vh - 130rpx - env(safe-area-inset-top));
  padding: 28rpx 30rpx calc(76rpx + env(safe-area-inset-bottom));
}

.voice-hero {
  position: relative;
  min-height: 238rpx;
  padding: 34rpx 34rpx 32rpx 172rpx;
  overflow: hidden;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-card-radius, 18rpx);
  background: var(--app-panel-strong);
  box-shadow: var(--app-card-outline), var(--app-shadow);
}

.hero-wave {
  position: absolute;
  left: 28rpx;
  top: 34rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 114rpx;
  height: 164rpx;
  gap: 5rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 999rpx;
  background: var(--app-input);
}

.hero-wave text {
  width: 4rpx;
  max-height: 90rpx;
  border-radius: 999rpx;
  background: linear-gradient(180deg, var(--app-accent-2), var(--app-accent), var(--app-accent-3));
  animation: voice-pulse 1.8s ease-in-out infinite alternate;
}

.hero-wave text:nth-child(2n) {
  animation-delay: -0.7s;
}

.hero-title {
  font-family: var(--app-display-font);
  font-size: 36rpx;
  font-weight: 900;
  line-height: 1.35;
}

.hero-desc {
  display: block;
  margin-top: 18rpx;
  color: var(--app-muted);
  font-size: 23rpx;
  line-height: 1.65;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
  margin: 42rpx 2rpx 18rpx;
}

.section-kicker {
  color: var(--app-accent-3);
  font-size: 18rpx;
  font-weight: 800;
}

.section-kicker.cloud {
  color: var(--app-accent);
}

.section-title {
  margin-top: 5rpx;
  font-family: var(--app-display-font);
  font-size: 31rpx;
  font-weight: 900;
}

.section-count {
  flex-shrink: 0;
  color: var(--app-muted);
  font-size: 17rpx;
}

.role-strip {
  width: 100%;
  white-space: nowrap;
}

.role-row {
  display: inline-flex;
  gap: 14rpx;
  padding: 2rpx 2rpx 12rpx;
}

.role-card {
  position: relative;
  box-sizing: border-box;
  width: 224rpx;
  min-height: 286rpx;
  padding: var(--app-space-sm);
  overflow: hidden;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-voice-card-shape, var(--app-card-radius, 18rpx));
  color: var(--app-text);
  text-align: left;
  background: var(--app-panel);
  box-shadow: var(--app-voice-card-outline, none);
  transition:
    transform var(--voice-motion) var(--app-voice-preview-ease),
    border-color var(--voice-motion) var(--app-voice-preview-ease),
    background var(--voice-motion) var(--app-voice-preview-ease);
}

.role-card.selected,
.role-card.previewing {
  border-color: var(--app-accent);
  background: var(--app-input);
}

.role-card.previewing {
  transform: translateY(-4rpx);
}

.role-glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 68rpx;
  height: 68rpx;
  border-radius: 50%;
  color: var(--app-on-accent);
  background: linear-gradient(145deg, var(--app-accent), var(--app-accent-2));
  font-family: var(--app-display-font);
  font-size: 30rpx;
  font-weight: 900;
}

.role-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8rpx;
  margin-top: 18rpx;
}

.role-name {
  font-size: 28rpx;
  font-weight: 900;
}

.role-desc {
  display: block;
  margin-top: 5rpx;
  color: var(--app-muted);
  font-size: 20rpx;
}

.role-params {
  display: block;
  margin-top: 9rpx;
  color: var(--app-muted);
  font-size: 16rpx;
}

.role-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8rpx;
  margin-top: 18rpx;
}

.role-action {
  min-width: 0;
  height: 52rpx;
  padding: 0;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-control-radius, 12rpx);
  color: var(--app-text);
  background: var(--app-panel-strong);
  font-size: 18rpx;
  line-height: 50rpx;
}

.role-action.select {
  border-color: transparent;
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.role-action[disabled] {
  color: var(--app-muted);
  background: var(--app-input);
  opacity: 1;
}

.device-head {
  margin-top: 34rpx;
}

.cloud-disclosure {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
  margin-bottom: 16rpx;
  padding: 18rpx 20rpx;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-control-radius, 14rpx);
  color: var(--app-muted);
  background: var(--app-input);
  font-size: 19rpx;
  line-height: 1.55;
}

.cloud-disclosure-badge {
  flex-shrink: 0;
  padding: 3rpx 10rpx;
  border-radius: 999rpx;
  color: var(--app-on-accent);
  background: linear-gradient(135deg, var(--app-accent), var(--app-accent-2));
  font-family: var(--app-utility-font, monospace);
  font-size: 17rpx;
  font-weight: 900;
}

.status-card,
.voice-card,
.privacy-note {
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-card-radius, 18rpx);
  background: var(--app-panel-strong);
  box-shadow: var(--app-card-outline), var(--app-shadow);
}

.status-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  min-height: 130rpx;
  padding: 24rpx;
}

.status-card.error {
  justify-content: space-between;
}

.status-card.cloud-unavailable {
  justify-content: space-between;
  border-style: dashed;
}

.status-orbit {
  width: 42rpx;
  height: 42rpx;
  flex-shrink: 0;
  border: 5rpx solid var(--app-border);
  border-top-color: var(--app-accent);
  border-radius: 50%;
  animation: voice-spin 0.9s linear infinite;
}

.status-title {
  font-size: 26rpx;
  font-weight: 900;
}

.status-desc {
  display: block;
  margin-top: 7rpx;
  color: var(--app-muted);
  font-size: 21rpx;
  line-height: 1.55;
}

.retry-button {
  min-width: 112rpx;
  min-height: 64rpx;
  padding: 0 18rpx;
  border-radius: var(--app-control-radius, 14rpx);
  color: var(--app-on-accent);
  background: var(--app-accent);
  font-size: 21rpx;
}

.voice-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.cloud-list {
  gap: 18rpx;
}

.cloud-voice-card {
  position: relative;
  overflow: hidden;
  border-color: color-mix(in srgb, var(--app-accent) 42%, var(--app-border));
}

.cloud-voice-card::before {
  position: absolute;
  top: 0;
  left: 0;
  width: 6rpx;
  height: 100%;
  content: '';
  background: linear-gradient(180deg, var(--app-accent), var(--app-accent-2), var(--app-accent-3));
}

.cloud-signature {
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--app-accent) 18%, var(--app-input)),
    var(--app-input)
  );
}

.voice-card {
  padding: 24rpx;
  transition: border-color var(--voice-motion) ease, transform var(--voice-motion) ease;
}

.voice-card.selected {
  border-color: var(--app-accent);
  box-shadow: var(--app-card-outline), 0 0 0 2rpx color-mix(in srgb, var(--app-accent) 22%, transparent), var(--app-shadow);
}

.voice-card.previewing {
  transform: translateY(-2rpx);
}

.voice-card-main {
  display: flex;
  align-items: center;
  gap: 22rpx;
}

.voice-signature {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 94rpx;
  height: 94rpx;
  flex-shrink: 0;
  gap: 5rpx;
  border-radius: 50%;
  background: var(--app-input);
}

.voice-signature text {
  width: 5rpx;
  border-radius: 999rpx;
  background: linear-gradient(180deg, var(--app-accent), var(--app-accent-2));
}

.previewing .voice-signature text {
  animation: voice-pulse 0.8s ease-in-out infinite alternate;
}

.voice-copy {
  min-width: 0;
  flex: 1;
}

.voice-name-row,
.voice-meta,
.voice-actions {
  display: flex;
  align-items: center;
}

.voice-name-row {
  gap: 12rpx;
}

.voice-name {
  overflow: hidden;
  font-size: 28rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-badge {
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  color: var(--app-on-accent);
  background: var(--app-accent);
  font-size: 17rpx;
  font-weight: 800;
}

.voice-id {
  display: block;
  max-width: 100%;
  margin-top: 5rpx;
  overflow: hidden;
  color: var(--app-muted);
  font-family: var(--app-utility-font, monospace);
  font-size: 17rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.voice-meta {
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 11rpx;
}

.voice-meta text {
  padding: 4rpx 9rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 999rpx;
  color: var(--app-muted);
  background: var(--app-input);
  font-size: 17rpx;
}

.voice-actions {
  justify-content: flex-end;
  gap: 12rpx;
  margin-top: 20rpx;
}

.voice-action {
  min-width: 128rpx;
  min-height: 66rpx;
  margin: 0;
  padding: 0 22rpx;
  border-radius: var(--app-control-radius, 14rpx);
  font-size: 21rpx;
  font-weight: 800;
}

.voice-action.preview {
  color: var(--app-text);
  border: 1rpx solid var(--app-border);
  background: var(--app-input);
}

.voice-action.select {
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.voice-action.select[disabled] {
  color: var(--app-muted);
  background: var(--app-input);
  opacity: 1;
}

.privacy-note {
  display: flex;
  gap: 20rpx;
  margin-top: 28rpx;
  padding: 22rpx;
}

.privacy-mark {
  flex-shrink: 0;
  color: var(--app-accent);
  font-size: 18rpx;
  font-weight: 900;
}

.privacy-note view view {
  font-size: 23rpx;
  font-weight: 900;
}

.privacy-note view text {
  display: block;
  margin-top: 6rpx;
  color: var(--app-muted);
  font-size: 19rpx;
  line-height: 1.55;
}

.voice-page {
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
}

.current-stage {
  position: relative;
  display: grid;
  grid-template-columns: 228rpx minmax(0, 1fr) 116rpx;
  align-items: center;
  gap: var(--app-space-lg);
  min-height: 318rpx;
  padding: var(--app-space-lg) var(--app-space-lg);
  overflow: hidden;
  border: 1rpx solid var(--app-border);
  border-radius: calc(var(--app-card-radius, 18rpx) + 8rpx);
  background:
    var(--app-voice-stage-decoration, none),
    linear-gradient(145deg, var(--app-panel-strong), var(--app-panel));
  box-shadow: 0 0 48rpx var(--app-voice-stage-glow, transparent), var(--app-card-outline), var(--app-shadow);
  transition: transform var(--voice-motion) var(--app-voice-preview-ease), border-color var(--voice-motion) var(--app-voice-preview-ease);
}

.current-stage.previewing {
  border-color: var(--voice-role);
  transform: translateY(-3rpx);
}

.stage-atmosphere {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 218rpx;
  height: 218rpx;
}

.stage-core {
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 128rpx;
  height: 128rpx;
  gap: 6rpx;
  border: 1rpx solid var(--voice-role-soft);
  border-radius: var(--app-voice-card-shape);
  background: var(--app-panel-strong);
  box-shadow: 0 0 48rpx var(--app-voice-stage-glow), 0 18rpx 42rpx var(--voice-role-wash);
}

.stage-core text,
.poster-wave text,
.device-wave text {
  width: 5rpx;
  border-radius: 999rpx;
  background: var(--voice-role, var(--app-accent));
  transform-origin: center;
}

.stage-copy {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.stage-label-row,
.stage-status-row {
  display: flex;
  align-items: center;
}

.stage-label-row {
  flex-wrap: wrap;
  gap: 12rpx;
}

.stage-kicker,
.stage-provider,
.poster-index,
.poster-state,
.device-meta {
  font-family: var(--app-voice-label-font, var(--app-display-font));
}

.stage-kicker {
  color: var(--voice-role);
  font-size: 17rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}

.stage-provider {
  padding: 4rpx 10rpx;
  border: 1rpx solid var(--voice-role-wash);
  border-radius: 999rpx;
  color: var(--app-muted);
  background: var(--voice-role-wash);
  font-size: 16rpx;
}

.stage-name {
  margin-top: 15rpx;
  overflow: hidden;
  font-family: var(--app-display-font);
  font-size: 42rpx;
  font-weight: 900;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stage-desc {
  display: block;
  margin-top: 10rpx;
  color: var(--app-muted);
  font-size: 21rpx;
  line-height: 1.55;
}

.stage-status-row {
  gap: 9rpx;
  margin-top: 20rpx;
  color: var(--app-muted);
  font-size: 18rpx;
}

.stage-status-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: var(--voice-role);
  box-shadow: 0 0 0 7rpx var(--voice-role-wash);
}

.current-stage.previewing .stage-status-dot {
  background: var(--voice-playing);
}

.stage-preview {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 104rpx;
  min-height: 104rpx;
  margin: 0;
  padding: 0;
  border: 1rpx solid var(--voice-role);
  border-radius: 50%;
  color: var(--voice-role);
  background: var(--app-panel-strong);
  font-size: 17rpx;
  font-weight: 800;
}

.stage-preview.active {
  border-color: var(--voice-playing);
  color: var(--voice-playing);
}

.stage-preview-icon {
  margin-bottom: 5rpx;
  font-size: 26rpx;
}

.cloud-stage-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.cloud-poster {
  position: relative;
  box-sizing: border-box;
  min-height: 398rpx;
  padding: var(--app-space-md);
  overflow: hidden;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-voice-card-shape, var(--app-card-radius, 18rpx));
  color: var(--app-text);
  background:
    radial-gradient(circle at 50% 34%, var(--voice-role-wash), transparent 44%),
    var(--app-panel-strong);
  box-shadow: var(--app-voice-card-outline, none), var(--app-card-outline), var(--app-shadow);
  transition:
    transform var(--voice-motion) var(--app-voice-preview-ease),
    border-color var(--voice-motion) var(--app-voice-preview-ease),
    box-shadow var(--voice-motion) var(--app-voice-preview-ease);
}

.cloud-poster.wide {
  grid-column: 1 / -1;
  min-height: 302rpx;
  padding-left: 286rpx;
}

.cloud-poster.selected {
  border-color: var(--voice-role);
  box-shadow: var(--app-card-outline), 0 0 0 3rpx var(--voice-role-wash), var(--app-shadow);
}

/* Theme-specific selected indicators */
.cloud-poster.selected::after,
.role-card.selected::after {
  position: absolute;
  top: var(--app-space-sm);
  right: var(--app-space-sm);
  font-size: 24rpx;
  line-height: 1;
  pointer-events: none;
}

.theme-xuanye .cloud-poster.selected::after,
.theme-xuanye .role-card.selected::after {
  content: '';
  width: 5rpx;
  height: 28rpx;
  top: var(--app-space-md);
  right: var(--app-space-md);
  border-radius: 999rpx;
  background: var(--voice-role);
  box-shadow: 0 0 12rpx var(--voice-role);
}

.theme-candy .cloud-poster.selected::after,
.theme-candy .role-card.selected::after {
  content: '⭐';
  font-size: 28rpx;
  filter: drop-shadow(0 2rpx 4rpx rgba(255, 211, 78, 0.5));
}

.theme-sakura .cloud-poster.selected::after,
.theme-sakura .role-card.selected::after {
  content: '';
  width: 18rpx;
  height: 18rpx;
  border-radius: 70% 30% 60% 40% / 45% 55% 45% 55%;
  background: radial-gradient(circle, var(--app-accent), var(--app-accent-2));
  box-shadow: 0 0 16rpx rgba(233, 122, 174, 0.35);
}

.theme-cyber .cloud-poster.selected::after,
.theme-cyber .role-card.selected::after {
  content: '[SEL]';
  color: var(--app-accent);
  font-family: var(--app-utility-font);
  font-size: 16rpx;
  font-weight: 800;
  letter-spacing: 1rpx;
}

.theme-noirGold .cloud-poster.selected::after,
.theme-noirGold .role-card.selected::after {
  content: '◆';
  color: var(--app-accent);
  font-size: 22rpx;
  text-shadow: 0 0 8rpx rgba(213, 175, 98, 0.5);
}

.cloud-poster.previewing {
  border-color: var(--voice-playing);
  transform: translateY(-5rpx);
}

.poster-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.poster-index {
  color: var(--voice-role);
  font-size: 17rpx;
  font-weight: 800;
  letter-spacing: 1rpx;
}

.poster-state {
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  color: var(--app-muted);
  background: var(--voice-role-wash);
  font-size: 16rpx;
  font-weight: 800;
}

.previewing .poster-state {
  color: var(--voice-playing);
}

.poster-state.selected {
  color: var(--voice-role);
}

.poster-portrait {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 158rpx;
  height: 158rpx;
  margin: 16rpx auto 12rpx;
}

.wide .poster-portrait {
  position: absolute;
  top: 65rpx;
  left: 64rpx;
}

.poster-glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 94rpx;
  height: 94rpx;
  border-radius: 38% 62% 46% 54%;
  color: var(--voice-role);
  background: var(--app-panel-strong);
  box-shadow: 0 0 0 13rpx var(--voice-role-wash);
  font-family: var(--app-display-font);
  font-size: 38rpx;
  font-weight: 900;
}

.poster-wave {
  position: absolute;
  right: -5rpx;
  bottom: 8rpx;
  display: flex;
  align-items: center;
  height: 58rpx;
  gap: 4rpx;
}

.poster-wave text {
  width: 4rpx;
}

.poster-name {
  overflow: hidden;
  font-family: var(--app-display-font);
  font-size: 29rpx;
  font-weight: 900;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wide .poster-name,
.wide .poster-note {
  text-align: left;
}

.poster-note {
  display: block;
  margin-top: 6rpx;
  color: var(--app-muted);
  font-size: 19rpx;
  text-align: center;
}

.poster-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10rpx;
  margin-top: 20rpx;
}

.poster-action,
.device-action {
  box-sizing: border-box;
  min-height: 88rpx;
  margin: 0;
  padding: 0 18rpx;
  border-radius: var(--app-control-radius, 14rpx);
  font-size: 20rpx;
  font-weight: 800;
  line-height: 1;
}

.poster-action.preview,
.device-action.preview {
  border: 1rpx solid var(--voice-role, var(--app-border));
  color: var(--voice-role, var(--app-text));
  background: transparent;
}

.poster-action.select,
.device-action.select {
  color: #fff;
  background: var(--voice-role, var(--app-accent));
}

.poster-action[disabled],
.device-action[disabled] {
  border-color: var(--app-border);
  color: var(--app-muted);
  background: var(--app-input);
  opacity: 1;
}

.skeleton-poster {
  border-color: var(--app-border);
  background: var(--app-panel-strong);
}

.skeleton-line,
.skeleton-medallion {
  border-radius: 999rpx;
  background: linear-gradient(90deg, var(--app-input), var(--app-panel), var(--app-input));
  background-size: 220% 100%;
  animation: voice-skeleton 1.25s ease-in-out infinite;
}

.skeleton-line {
  width: 82%;
  height: 20rpx;
  margin: 22rpx auto 0;
}

.skeleton-line.short {
  width: 36%;
  height: 14rpx;
  margin: 0;
}

.skeleton-line.small {
  width: 54%;
  height: 14rpx;
}

.skeleton-medallion {
  width: 146rpx;
  height: 146rpx;
  margin: 22rpx auto;
}

.compact-status {
  min-height: 104rpx;
  padding: 20rpx 22rpx;
  box-shadow: none;
}

.secondary-section {
  margin-top: 36rpx;
  overflow: hidden;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-card-radius, 18rpx);
  background: var(--app-panel-strong);
  box-shadow: var(--app-card-outline), var(--app-shadow);
}

.section-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 116rpx;
  margin: 0;
  padding: 22rpx 24rpx;
  border-radius: 0;
  color: var(--app-text);
  text-align: left;
  background: transparent;
  line-height: 1.2;
}

.compact-title {
  font-size: 27rpx;
}

.toggle-meta {
  display: flex;
  align-items: center;
  gap: 14rpx;
  color: var(--app-muted);
  font-family: var(--app-voice-label-font, var(--app-display-font));
  font-size: 17rpx;
}

.toggle-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54rpx;
  height: 54rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 50%;
  color: var(--app-accent);
  background: var(--app-input);
  font-size: 28rpx;
}

.device-panel {
  padding: 0 18rpx 18rpx;
  border-top: 1rpx solid var(--app-border);
}

.device-list {
  display: flex;
  flex-direction: column;
}

.device-row {
  display: grid;
  grid-template-columns: 72rpx minmax(0, 1fr) auto;
  align-items: center;
  gap: 16rpx;
  min-height: 124rpx;
  padding: 14rpx 4rpx;
  border-bottom: 1rpx solid var(--app-border);
  --voice-role: var(--app-accent);
}

.device-row:last-child {
  border-bottom: 0;
}

.device-row.selected {
  --voice-role: var(--app-accent-2);
}

.device-wave {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 68rpx;
  gap: 4rpx;
  border-radius: 50%;
  background: var(--app-input);
}

.device-wave text {
  width: 4rpx;
}

.device-copy {
  min-width: 0;
}

.device-name-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.device-name {
  overflow: hidden;
  font-size: 24rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-current {
  flex-shrink: 0;
  color: var(--app-accent);
  font-size: 16rpx;
  font-weight: 800;
}

.device-meta {
  display: block;
  margin-top: 6rpx;
  overflow: hidden;
  color: var(--app-muted);
  font-size: 15rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-actions {
  display: flex;
  gap: 8rpx;
}

.device-action {
  width: 88rpx;
  min-width: 88rpx;
  padding: 0 8rpx;
}

.device-action.select {
  width: 104rpx;
}

.role-card {
  width: 246rpx;
  min-height: 316rpx;
  border-color: var(--voice-role-wash);
  background:
    linear-gradient(155deg, var(--voice-role-wash), transparent 46%),
    var(--app-panel);
}

.role-card.selected,
.role-card.previewing {
  border-color: var(--voice-role);
  background:
    linear-gradient(155deg, var(--voice-role-wash), transparent 58%),
    var(--app-panel);
}

.role-card.previewing {
  border-color: var(--voice-playing);
}

.role-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10rpx;
}

.role-glyph {
  color: var(--voice-role);
  background: var(--app-panel-strong);
  box-shadow: 0 0 0 9rpx var(--voice-role-wash);
}

.role-state {
  color: var(--voice-role);
  font-family: var(--app-voice-label-font, var(--app-display-font));
  font-size: 15rpx;
  font-weight: 800;
}

.role-params {
  font-family: var(--app-voice-label-font, var(--app-display-font));
}

.role-action {
  min-height: 88rpx;
  height: 88rpx;
  line-height: 86rpx;
}

.role-action.preview {
  border-color: var(--voice-role);
  color: var(--voice-role);
  background: transparent;
}

.role-action.select {
  background: var(--voice-role);
}

.privacy-note {
  align-items: center;
  box-shadow: none;
}

.privacy-mark {
  padding: 6rpx 10rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 999rpx;
  background: var(--app-input);
}

.current-stage.previewing .stage-core text,
.cloud-poster.previewing .poster-wave text,
.device-row.previewing .device-wave text,
.role-card.previewing .role-glyph {
  animation: voice-pulse 0.8s ease-in-out infinite alternate;
}

@keyframes voice-pulse {
  from { transform: scaleY(0.58); opacity: 0.62; }
  to { transform: scaleY(1); opacity: 1; }
}

@keyframes voice-skeleton {
  to { background-position: -220% 0; }
}

@keyframes voice-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .hero-wave text,
  .previewing .voice-signature text,
  .current-stage.previewing .stage-core text,
  .cloud-poster.previewing .poster-wave text,
  .device-row.previewing .device-wave text,
  .role-card.previewing .role-glyph,
  .skeleton-line,
  .skeleton-medallion,
  .status-orbit {
    animation: none;
  }
}
</style>
