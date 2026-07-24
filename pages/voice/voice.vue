<template>
  <view class="voice-page app-page secondary" :style="themeVars">
    <view class="voice-topbar reader-safe-top">
      <button class="round-button" aria-label="返回阅读器" @tap="goBack">‹</button>
      <view class="topbar-copy">
        <text class="eyebrow">VOICE LIBRARY</text>
        <view class="page-title">谁来为你读</view>
      </view>
      <button class="round-button refresh" :loading="refreshing" aria-label="刷新声音列表" @tap="refreshAllVoices">↻</button>
    </view>

    <scroll-view class="voice-scroll" scroll-y :show-scrollbar="false">
      <view class="voice-hero">
        <view class="hero-wave" aria-hidden="true">
          <text v-for="height in heroWave" :key="height" :style="{ height: height + 'rpx' }"></text>
        </view>
        <view class="hero-title">选一个真正有角色感的声音。</view>
        <text class="hero-desc">AI 拟真音色更自然；设备声音与离线角色效果可在无网络时继续使用。</text>
      </view>

      <view class="section-head">
        <view>
          <text class="section-kicker cloud">AI 拟真音色</text>
          <view class="section-title">神经语音 · 云端生成</view>
        </view>
        <text class="section-count">{{ cloudVoices.length }} VOICES</text>
      </view>

      <view class="cloud-disclosure">
        <text class="cloud-disclosure-badge">AI</text>
        <text>以下为 AI 合成音，不是真人录音。选择后仅将当前朗读片段发送至云端生成语音。</text>
      </view>

      <view class="status-card" v-if="cloudLoading">
        <view class="status-orbit"></view>
        <view>
          <view class="status-title">正在连接拟真语音服务</view>
          <text class="status-desc">正在读取账号可用的火山引擎音色。</text>
        </view>
      </view>

      <view class="status-card cloud-unavailable" v-else-if="cloudMessage">
        <view>
          <view class="status-title">{{ cloudStatusTitle }}</view>
          <text class="status-desc">{{ cloudMessage }}</text>
        </view>
        <button class="retry-button" v-if="hasLoginToken" @tap="loadCloudVoices">重试</button>
      </view>

      <view class="voice-list cloud-list" v-else>
        <view
          class="voice-card cloud-voice-card"
          v-for="(voice, index) in cloudVoices"
          :key="'volcengine:' + voice.id"
          :class="{
            selected: selectedProvider === 'volcengine' && selectedId === voice.id,
            previewing: previewVoiceKey === cloudVoiceKey(voice)
          }"
        >
          <view class="voice-card-main">
            <view class="voice-signature cloud-signature" aria-hidden="true">
              <text
                v-for="bar in signatureBars(index + 12)"
                :key="bar.key"
                :style="{ height: bar.height + 'rpx' }"
              ></text>
            </view>
            <view class="voice-copy">
              <view class="voice-name-row">
                <view class="voice-name">{{ voice.name }}</view>
                <text class="selected-badge" v-if="selectedProvider === 'volcengine' && selectedId === voice.id">当前</text>
              </view>
              <text class="voice-id">{{ voice.description || voice.role || 'AI 拟真旁白' }}</text>
              <view class="voice-meta">
                <text>AI 拟真</text>
                <text>{{ formatLanguage(voice.lang) }}</text>
                <text>需要联网</text>
              </view>
            </view>
          </view>
          <view class="voice-actions">
            <button class="voice-action preview" @tap="previewCloudVoice(voice)">
              {{ previewVoiceKey === cloudVoiceKey(voice) ? '停止试听' : '试听' }}
            </button>
            <button
              class="voice-action select"
              :disabled="selectedProvider === 'volcengine' && selectedId === voice.id"
              @tap="selectCloudVoice(voice)"
            >
              {{ selectedProvider === 'volcengine' && selectedId === voice.id ? '已选择' : '选择' }}
            </button>
          </view>
        </view>
      </view>

      <view class="section-head device-head">
        <view>
          <text class="section-kicker">设备系统声音</text>
          <view class="section-title">当前可用的中文音色</view>
        </view>
        <text class="section-count">{{ voices.length }} VOICES</text>
      </view>

      <view class="status-card" v-if="loading">
        <view class="status-orbit"></view>
        <view>
          <view class="status-title">正在读取系统声音</view>
          <text class="status-desc">部分浏览器需要稍候片刻才能返回音色列表。</text>
        </view>
      </view>

      <view class="status-card error" v-else-if="errorMessage">
        <view>
          <view class="status-title">无法读取额外声音</view>
          <text class="status-desc">{{ errorMessage }}</text>
        </view>
        <button class="retry-button" @tap="loadVoices">重试</button>
      </view>

      <view class="voice-list" v-else>
        <view
          class="voice-card"
          v-for="(voice, index) in voices"
          :key="voice.provider + ':' + voice.id"
          :class="{
            selected: selectedProvider === 'system' && selectedId === voice.id,
            previewing: previewVoiceKey === voiceKey(voice)
          }"
        >
          <view class="voice-card-main">
            <view class="voice-signature" aria-hidden="true">
              <text
                v-for="bar in signatureBars(index)"
                :key="bar.key"
                :style="{ height: bar.height + 'rpx' }"
              ></text>
            </view>
            <view class="voice-copy">
              <view class="voice-name-row">
                <view class="voice-name">{{ voice.name }}</view>
                <text class="selected-badge" v-if="selectedProvider === 'system' && selectedId === voice.id">当前</text>
              </view>
              <text class="voice-id" v-if="voice.id">{{ voice.id }}</text>
              <view class="voice-meta">
                <text>{{ formatLanguage(voice.lang) }}</text>
                <text>{{ qualityLabel(voice) }}</text>
                <text>{{ sourceLabel(voice) }}</text>
              </view>
            </view>
          </view>

          <view class="voice-actions">
            <button
              class="voice-action preview"
              :aria-label="`试听${voice.name}`"
              @tap="previewVoice(voice)"
            >
              {{ previewVoiceKey === voiceKey(voice) ? '停止试听' : '试听' }}
            </button>
            <button
              class="voice-action select"
              :disabled="selectedProvider === 'system' && selectedId === voice.id"
              :aria-label="`选择${voice.name}`"
              @tap="selectVoice(voice)"
            >
              {{ selectedProvider === 'system' && selectedId === voice.id ? '已选择' : '选择' }}
            </button>
          </view>
        </view>
      </view>

      <view class="section-head device-head">
        <view>
          <text class="section-kicker">离线角色效果</text>
          <view class="section-title">本地音调与节奏模拟</view>
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
          >
            <view class="role-glyph">{{ role.glyph }}</view>
            <view class="role-name-row">
              <view class="role-name">{{ role.name }}</view>
              <text
                class="selected-badge"
                v-if="selectedProvider === 'preset' && selectedId === role.id"
              >当前</text>
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
        <text class="privacy-mark">PRIVACY</text>
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
      heroWave: [22, 42, 64, 34, 78, 52, 28, 66, 38, 54],
      roleVoices: READ_ALOUD_ROLE_PRESETS.map(role => ({ ...role }))
    }
  },
  computed: {
    refreshing() {
      return this.loading || this.cloudLoading
    },
    hasLoginToken() {
      return this.loggedIn
    },
    cloudStatusTitle() {
      return this.hasLoginToken ? '拟真语音暂不可用' : '登录后使用拟真音色'
    },
    themeVars() {
      return {
        ...getAppThemeStyle(this.themeId),
        '--voice-motion': this.motionReduced ? '0ms' : '220ms'
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
      this.cloudAvailable = false
      if (!this.hasLoginToken) {
        this.cloudVoices = []
        this.cloudMessage = '请先在“我的”页面登录。未登录不影响设备声音和离线角色效果。'
        this.cloudLoading = false
        return
      }
      try {
        const listed = await this.ensureCloudDriver().listVoices()
        if (token !== this.cloudLoadToken) return
        const availableVoices = Array.isArray(listed) ? listed : []
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
          this.cloudMessage = '服务尚未配置可用音色，请检查后端火山引擎凭据和音色配置；离线声音仍可正常使用。'
        }
        this.reconcileCloudVoice(true)
      } catch (error) {
        if (token !== this.cloudLoadToken) return
        this.cloudVoices = []
        this.cloudMessage = this.cloudErrorMessage(error)
      } finally {
        if (token === this.cloudLoadToken) this.cloudLoading = false
      }
    },
    cloudErrorMessage(error) {
      const status = Number(error && error.statusCode)
      if (status === 401) {
        this.loggedIn = false
        return '登录状态已失效，请重新登录。设备声音和离线角色效果仍可使用。'
      }
      if (status === 429) return '今日拟真语音额度已用完，请稍后再试或改用离线声音。'
      return '请检查网络和后端拟真语音配置后重试；设备声音和离线角色效果仍可使用。'
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
  padding: 20rpx;
  overflow: hidden;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-card-radius, 18rpx);
  color: var(--app-text);
  text-align: left;
  background: var(--app-panel);
  transition:
    transform var(--voice-motion) ease,
    border-color var(--voice-motion) ease,
    background var(--voice-motion) ease;
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

@keyframes voice-pulse {
  from { transform: scaleY(0.58); opacity: 0.62; }
  to { transform: scaleY(1); opacity: 1; }
}

@keyframes voice-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .hero-wave text,
  .previewing .voice-signature text,
  .status-orbit {
    animation: none;
  }
}
</style>
