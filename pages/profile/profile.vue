<template>
  <view class="profile-page">
    <view class="top-zone">
      <view>
        <text class="eyebrow">ME</text>
        <view class="title">我的</view>
      </view>
      <button class="help-button" @tap="showHelp">?</button>
    </view>

    <view class="settings-list">
      <view class="setting-item" v-for="item in mainItems" :key="item.id" @tap="openItem(item.id)">
        <text class="setting-icon">{{ item.icon }}</text>
        <view class="setting-copy">
          <view class="setting-title">{{ item.title }}</view>
          <text class="setting-desc">{{ item.desc }}</text>
        </view>
        <view class="setting-extra" v-if="item.id === 'theme'">{{ activeThemeName }}</view>
        <switch v-if="item.id === 'web'" :checked="webEnabled" color="#d44b2f" @change="toggleWeb" />
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

    <view class="theme-panel" v-if="themeVisible">
      <view class="panel-head">
        <view class="panel-title">主题模式</view>
        <button class="close-button" @tap="themeVisible = false">×</button>
      </view>
      <view class="theme-row" v-for="theme in themes" :key="theme.id" :class="{ active: themeId === theme.id }" @tap="chooseTheme(theme.id)">
        <view>
          <view class="theme-name">{{ theme.name }}</view>
          <text class="theme-desc">{{ theme.desc }}</text>
        </view>
        <text class="theme-dot">●</text>
      </view>
    </view>
  </view>
</template>

<script>
import { exportTrackedBooks } from '../../common/tracking.js'
import { appThemes, getAppThemeId, saveAppTheme } from '../../common/appTheme.js'

export default {
  data() {
    return {
      themeId: getAppThemeId(),
      themes: appThemes,
      themeVisible: false,
      webEnabled: false,
      mainItems: [
        { id: 'source', icon: '▤', title: '书源管理', desc: '新建、导入、编辑或管理书源' },
        { id: 'txt', icon: '▤', title: 'TXT 目录规则', desc: '配置 TXT 目录规则' },
        { id: 'clean', icon: 'A↔B', title: '替换净化', desc: '配置替换净化规则' },
        { id: 'dict', icon: '文A', title: '字典规则', desc: '配置字典规则' },
        { id: 'theme', icon: '♜', title: '主题模式', desc: '选择主题模式' },
        { id: 'web', icon: '◎', title: 'Web 服务', desc: '用浏览器写源或看书' }
      ]
    }
  },
  computed: {
    activeThemeName() {
      return (this.themes.find(theme => theme.id === this.themeId) || this.themes[0]).name
    }
  },
  onShow() {
    this.themeId = getAppThemeId()
  },
  methods: {
    openItem(id) {
      if (id === 'source' || id === 'txt') {
        uni.switchTab({ url: '/pages/library/library' })
        return
      }
      if (id === 'theme') {
        this.openThemePanel()
        return
      }
      if (id !== 'web') {
        uni.showToast({ title: '规则模块稍后接入', icon: 'none' })
      }
    },
    toggleWeb(event) {
      this.webEnabled = !!event.detail.value
      uni.showToast({ title: this.webEnabled ? 'Web 服务为预留开关' : 'Web 服务已关闭', icon: 'none' })
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
  min-height: 100vh;
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
</style>
