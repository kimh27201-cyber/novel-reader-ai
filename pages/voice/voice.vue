<template>
  <view class="voice-page app-page secondary" :style="themeVars">
    <view class="voice-topbar reader-safe-top">
      <button class="round-button" aria-label="返回阅读器" @tap="goBack">‹</button>
      <view class="topbar-copy">
        <text class="eyebrow">VOICE LIBRARY</text>
        <view class="page-title">谁来为你读</view>
      </view>
      <button class="round-button refresh" :loading="loading" aria-label="刷新声音列表" @tap="loadVoices">↻</button>
    </view>

    <scroll-view class="voice-scroll" scroll-y :show-scrollbar="false">
      <view class="voice-hero">
        <view class="hero-wave" aria-hidden="true">
          <text v-for="height in heroWave" :key="height" :style="{ height: height + 'rpx' }"></text>
        </view>
        <view class="hero-title">先听一句，再决定谁陪你读完这一章。</view>
        <text class="hero-desc">角色效果由设备系统声音在本地调整音调与节奏生成，正文不会上传。</text>
      </view>

      <view class="section-head">
        <view>
          <text class="section-kicker">角色音色</text>
          <view class="section-title">选择一种本地角色效果</view>
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

      <view class="section-head device-head">
        <view>
          <text class="section-kicker">设备声音</text>
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

      <view class="privacy-note">
        <text class="privacy-mark">LOCAL</text>
        <view>
          <view>设备语音优先</view>
          <text>Android 已排除明确要求联网的音色；浏览器是否联网由系统语音服务决定。</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import {
  createReadAloudDriver,
  READ_ALOUD_ROLE_PRESETS,
  resolveReadAloudVoiceProfile,
  SYSTEM_DEFAULT_VOICE
} from '../../common/readAloud.js'
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
      voices: [{ ...SYSTEM_DEFAULT_VOICE }],
      selectedProvider: prefs.ttsVoiceProvider,
      selectedId: prefs.ttsVoiceId,
      loading: false,
      errorMessage: '',
      previewVoiceKey: '',
      previewToken: 0,
      driver: null,
      loadToken: 0,
      heroWave: [22, 42, 64, 34, 78, 52, 28, 66, 38, 54],
      roleVoices: READ_ALOUD_ROLE_PRESETS.map(role => ({ ...role }))
    }
  },
  computed: {
    themeVars() {
      return {
        ...getAppThemeStyle(this.themeId),
        '--voice-motion': this.motionReduced ? '0ms' : '220ms'
      }
    }
  },
  onLoad() {
    this.loadVoices()
  },
  onShow() {
    this.themeId = getAppThemeId()
    this.motionReduced = isMotionReduced()
  },
  onHide() {
    this.stopPreview()
  },
  onUnload() {
    this.disposeDriver()
  },
  methods: {
    ensureDriver() {
      if (!this.driver) this.driver = createReadAloudDriver()
      return this.driver
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
        await this.ensureDriver().speak(PREVIEW_TEXT, {
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
    },
    disposeDriver() {
      this.loadToken += 1
      this.stopPreview()
      try {
        if (this.driver && typeof this.driver.dispose === 'function') this.driver.dispose()
      } catch (error) {}
      this.driver = null
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
