<template>
  <view class="source-scan-page app-page" :style="themeVars">
    <view class="scan-topbar">
      <button class="round-button" @tap="goBack">‹</button>
      <view class="scan-title-block">
        <text class="eyebrow">SOURCE IMPORT</text>
        <view class="scan-title">扫码导入</view>
      </view>
      <button class="round-button primary" @tap="startScan">⌗</button>
    </view>

    <view class="scan-stage">
      <view class="scan-frame">
        <view class="scan-corner left-top"></view>
        <view class="scan-corner right-top"></view>
        <view class="scan-corner left-bottom"></view>
        <view class="scan-corner right-bottom"></view>
        <view class="scan-line"></view>
        <text class="scan-frame-label">{{ scanStatusText }}</text>
      </view>
      <button class="scan-primary" :disabled="busy" @tap="startScan">
        {{ busy ? '处理中...' : '打开摄像头扫码' }}
      </button>
    </view>

    <view class="input-panel">
      <view class="panel-head">
        <view>
          <text class="eyebrow">PASTE</text>
          <view class="panel-title">粘贴链接</view>
        </view>
        <button class="text-action" @tap="pasteFromClipboard">读取剪贴板</button>
      </view>
      <textarea
        class="source-input"
        v-model="rawInput"
        maxlength="-1"
        placeholder="粘贴 yuedu://、legado://、书源 JSON、JSON 链接或源仓库详情页"
      />
      <view class="action-row">
        <button class="outline-action" :disabled="busy || !rawInput" @tap="previewInput">预览</button>
        <button class="solid-action" :disabled="busy || !rawInput" @tap="importInput">确认导入</button>
      </view>
    </view>

    <view class="preview-panel" v-if="preview">
      <view class="panel-title">识别结果</view>
      <view class="stats-grid">
        <view class="stat-cell">
          <text class="stat-value">{{ preview.imported }}</text>
          <text class="stat-label">新增</text>
        </view>
        <view class="stat-cell">
          <text class="stat-value">{{ preview.updated }}</text>
          <text class="stat-label">覆盖</text>
        </view>
        <view class="stat-cell">
          <text class="stat-value">{{ preview.incompatible }}</text>
          <text class="stat-label">不兼容</text>
        </view>
      </view>
      <view class="group-row" v-if="previewGroups">
        <text>{{ previewGroups }}</text>
      </view>
    </view>

    <view class="result-panel" v-if="resultMessage">
      <view class="panel-title">{{ resultTitle }}</view>
      <text class="result-desc">{{ resultMessage }}</text>
      <button class="solid-action" @tap="goLibrary">返回书源管理</button>
    </view>
  </view>
</template>

<script>
import { getAppThemeId, getAppThemeStyle } from '../../common/appTheme.js'
import { getClipboardText, scanImportPayload } from '../../common/importAdapters.js'
import { applyImportPreview, getSourceConfigs, importSourcesFromAny, previewSourcesFromAny } from '../../common/bookSources.js'
import { resolveMarketScanTarget } from '../../common/sourceMarket.js'
import { friendlyErrorMessage } from '../../common/uiFeedback.js'

export default {
  data() {
    return {
      themeId: getAppThemeId(),
      rawInput: '',
      preview: null,
      previewRaw: '',
      busy: false,
      scanned: false,
      resultTitle: '',
      resultMessage: '',
      sourceCount: getSourceConfigs().length
    }
  },
  computed: {
    themeVars() {
      return getAppThemeStyle(this.themeId)
    },
    scanStatusText() {
      if (this.busy) return '正在识别二维码'
      if (this.scanned) return '已读取扫码内容'
      return '将书源二维码放入取景框'
    },
    previewGroups() {
      if (!this.preview || !Array.isArray(this.preview.groups) || !this.preview.groups.length) return ''
      return `分组：${this.preview.groups.slice(0, 4).join(' / ')}`
    }
  },
  onShow() {
    this.themeId = getAppThemeId()
    this.sourceCount = getSourceConfigs().length
  },
  methods: {
    goBack() {
      if (typeof getCurrentPages === 'function' && getCurrentPages().length > 1) {
        uni.navigateBack()
        return
      }
      this.goLibrary()
    },
    goLibrary() {
      uni.switchTab({ url: '/pages/library/library' })
    },
    async startScan() {
      this.busy = true
      this.resultTitle = ''
      this.resultMessage = ''
      try {
        const payload = await scanImportPayload(uni)
        this.rawInput = payload
        this.scanned = true
        await this.previewInput()
      } catch (error) {
        uni.showToast({ title: friendlyErrorMessage(error, '未完成扫码'), icon: 'none' })
      } finally {
        this.busy = false
      }
    },
    async pasteFromClipboard() {
      try {
        this.rawInput = await getClipboardText(uni)
        this.preview = null
        this.previewRaw = ''
      } catch (error) {
        uni.showToast({ title: friendlyErrorMessage(error, '读取剪贴板失败'), icon: 'none' })
      }
    },
    getInputText() {
      return String(this.rawInput || '').trim()
    },
    handleMarketTarget(raw) {
      const target = resolveMarketScanTarget(raw)
      if (target.type !== 'market') return false
      uni.navigateTo({ url: `/pages/sourceMarket/sourceMarket?url=${encodeURIComponent(target.url)}` })
      return true
    },
    async previewInput() {
      const raw = this.getInputText()
      if (!raw) {
        uni.showToast({ title: '请先扫码或粘贴链接', icon: 'none' })
        return
      }
      if (this.handleMarketTarget(raw)) return
      this.busy = true
      try {
        this.preview = await previewSourcesFromAny(raw)
        this.previewRaw = raw
      } catch (error) {
        this.preview = null
        this.previewRaw = ''
        uni.showToast({ title: friendlyErrorMessage(error, '无法预览书源'), icon: 'none' })
      } finally {
        this.busy = false
      }
    },
    async importInput() {
      const raw = this.getInputText()
      if (!raw) {
        uni.showToast({ title: '请先扫码或粘贴链接', icon: 'none' })
        return
      }
      if (this.handleMarketTarget(raw)) return
      if (!this.preview || this.previewRaw !== raw) {
        await this.previewInput()
        if (this.preview) {
          uni.showToast({ title: '已生成导入预览，请再次确认', icon: 'none' })
        }
        return
      }
      this.busy = true
      try {
        const result = applyImportPreview(this.preview)
        this.sourceCount = getSourceConfigs().length
        this.resultTitle = '导入完成'
        this.resultMessage = `${result.imported} 个新增，${result.updated} 个覆盖，${result.incompatible} 个不兼容。当前共 ${this.sourceCount} 个真实书源。`
        this.preview = null
        this.previewRaw = ''
        uni.showToast({ title: '书源已导入', icon: 'none' })
      } catch (error) {
        uni.showToast({ title: friendlyErrorMessage(error, '导入书源失败'), icon: 'none' })
      } finally {
        this.busy = false
      }
    }
  }
}
</script>

<style>
.source-scan-page {
  min-height: 100vh;
  padding: 64rpx 36rpx 48rpx;
}

.scan-topbar,
.panel-head,
.action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.scan-title-block {
  flex: 1;
  min-width: 0;
}

.scan-title {
  margin-top: 6rpx;
  color: var(--app-text);
  font-size: 44rpx;
  font-weight: 700;
  line-height: 56rpx;
}

.round-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76rpx;
  height: 76rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 999rpx;
  color: var(--app-text);
  background: var(--app-panel);
}

.round-button.primary {
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.scan-stage,
.input-panel,
.preview-panel,
.result-panel {
  margin-top: 28rpx;
  padding: 28rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 18rpx;
  background: var(--app-panel-strong);
  box-shadow: var(--app-shadow);
}

.scan-frame {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 460rpx;
  overflow: hidden;
  border-radius: 14rpx;
  background: rgba(0, 0, 0, 0.28);
}

.scan-corner {
  position: absolute;
  width: 74rpx;
  height: 74rpx;
  border-color: var(--app-accent);
}

.left-top {
  top: 34rpx;
  left: 34rpx;
  border-top: 6rpx solid;
  border-left: 6rpx solid;
}

.right-top {
  top: 34rpx;
  right: 34rpx;
  border-top: 6rpx solid;
  border-right: 6rpx solid;
}

.left-bottom {
  bottom: 34rpx;
  left: 34rpx;
  border-bottom: 6rpx solid;
  border-left: 6rpx solid;
}

.right-bottom {
  right: 34rpx;
  bottom: 34rpx;
  border-right: 6rpx solid;
  border-bottom: 6rpx solid;
}

.scan-line {
  position: absolute;
  left: 60rpx;
  right: 60rpx;
  height: 4rpx;
  background: var(--app-accent);
  box-shadow: 0 0 28rpx var(--app-accent);
}

.scan-frame-label {
  color: var(--app-muted);
  font-size: 28rpx;
}

.scan-primary,
.solid-action,
.outline-action,
.text-action {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 76rpx;
  border-radius: 14rpx;
  font-size: 28rpx;
}

.scan-primary,
.solid-action {
  margin-top: 22rpx;
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.outline-action {
  flex: 1;
  color: var(--app-text);
  border: 1rpx solid var(--app-border);
  background: var(--app-input);
}

.solid-action {
  flex: 1;
}

.text-action {
  min-width: 168rpx;
  color: var(--app-accent);
}

.panel-title {
  color: var(--app-text);
  font-size: 34rpx;
  font-weight: 700;
  line-height: 44rpx;
}

.source-input {
  width: 100%;
  min-height: 190rpx;
  margin-top: 24rpx;
  padding: 22rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 14rpx;
  color: var(--app-text);
  background: var(--app-input);
  font-size: 26rpx;
  line-height: 38rpx;
}

.action-row {
  margin-top: 20rpx;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 22rpx;
}

.stat-cell {
  padding: 22rpx 12rpx;
  border-radius: 14rpx;
  text-align: center;
  background: var(--app-input);
}

.stat-value,
.stat-label,
.group-row,
.result-desc {
  display: block;
}

.stat-value {
  color: var(--app-accent);
  font-size: 40rpx;
  font-weight: 700;
  line-height: 48rpx;
}

.stat-label,
.group-row,
.result-desc {
  color: var(--app-muted);
  font-size: 25rpx;
  line-height: 36rpx;
}

.group-row,
.result-desc {
  margin-top: 18rpx;
}

button[disabled] {
  opacity: 0.48;
}
</style>
