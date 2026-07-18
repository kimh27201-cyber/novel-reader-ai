<template>
  <view class="import-log-page app-page" :style="themeVars">
    <view class="log-header">
      <button class="icon-button" @tap="goBack">‹</button>
      <view class="header-copy">
        <text class="eyebrow">IMPORT LOGS</text>
        <view class="header-title">书源导入日志</view>
      </view>
      <button class="clear-button" :disabled="!logs.length" @tap="clearLogs">清空</button>
    </view>

    <scroll-view class="log-scroll" scroll-y :show-scrollbar="false">
      <view class="empty-panel" v-if="!logs.length">
        <view class="empty-title">暂无导入日志</view>
        <text class="empty-text">导入 URL、JSON、扫码或剪贴板书源后，会在这里记录处理详情。</text>
      </view>

      <view class="log-card" v-for="log in logs" :key="log.id">
        <view class="log-summary" @tap="toggle(log.id)">
          <view class="summary-main">
            <text class="summary-time">{{ formatTime(log.time) }}</text>
            <view class="summary-title">{{ sourceLabel(log.source) }} · {{ log.rawType }}</view>
            <text class="summary-source" v-if="log.sourceText">{{ log.sourceText }}</text>
          </view>
          <text class="summary-toggle">{{ expandedId === log.id ? '收起' : '展开' }}</text>
        </view>

        <view class="stat-grid">
          <view class="stat-item"><text>总数</text><strong>{{ log.total }}</strong></view>
          <view class="stat-item success"><text>成功</text><strong>{{ log.success }}</strong></view>
          <view class="stat-item failed"><text>失败</text><strong>{{ log.failed }}</strong></view>
          <view class="stat-item unsupported"><text>部分不兼容</text><strong>{{ log.unsupported }}</strong></view>
          <view class="stat-item"><text>重复</text><strong>{{ log.duplicated }}</strong></view>
          <view class="stat-item"><text>跳过</text><strong>{{ log.skipped }}</strong></view>
        </view>

        <view class="log-items" v-if="expandedId === log.id">
          <view class="log-item" v-for="(item, index) in log.items" :key="`${log.id}-${index}`">
            <view class="item-head">
              <text class="item-name">{{ index + 1 }}. {{ item.name || '未命名书源' }}</text>
              <text class="status-pill" :class="item.status">{{ statusText(item.status) }}</text>
            </view>
            <text class="item-url" v-if="item.url">{{ item.url }}</text>
            <text class="item-reason" v-if="item.reason">{{ item.reason }}</text>
          </view>
          <button class="copy-button" @tap="copyFailureReasons(log)">复制失败原因</button>
        </view>
      </view>

      <view class="bottom-space"></view>
    </scroll-view>
  </view>
</template>

<script>
import { getAppThemeId, getAppThemeStyle } from '../../common/appTheme.js'
import { clearImportLogs, getImportLogs } from '../../common/sourceImportLog.js'

export default {
  data() {
    return {
      logs: [],
      expandedId: '',
      themeId: getAppThemeId()
    }
  },
  computed: {
    themeVars() {
      return getAppThemeStyle(this.themeId)
    }
  },
  onShow() {
    this.themeId = getAppThemeId()
    this.loadLogs()
  },
  methods: {
    loadLogs() {
      this.logs = getImportLogs(30)
    },
    toggle(id) {
      this.expandedId = this.expandedId === id ? '' : id
    },
    clearLogs() {
      clearImportLogs()
      this.expandedId = ''
      this.loadLogs()
      uni.showToast({ title: '导入日志已清空', icon: 'none' })
    },
    copyFailureReasons(log) {
      const reasons = (log.items || [])
        .filter(item => item.status !== 'success' || item.reason)
        .map(item => `${item.name || '未命名书源'}：${item.reason || this.statusText(item.status)}`)
        .join('\n')
      uni.setClipboardData({
        data: reasons || '本次导入没有失败原因',
        success: () => uni.showToast({ title: '失败原因已复制', icon: 'none' })
      })
    },
    statusText(status) {
      const map = {
        success: '成功',
        failed: '失败',
        skipped: '跳过',
        duplicated: '重复',
        unsupported: '部分不兼容',
        blocked: '已阻止'
      }
      return map[status] || status || '未知'
    },
    sourceLabel(source) {
      const map = {
        json: 'JSON',
        url: 'URL',
        repo: '源仓库',
        clipboard: '剪贴板',
        scan: '扫码',
        qrcode: '二维码'
      }
      return map[source] || source || 'unknown'
    },
    formatTime(time) {
      if (!time) return ''
      return String(time).replace('T', ' ').slice(0, 19)
    },
    goBack() {
      uni.navigateBack()
    }
  }
}
</script>

<style scoped>
.import-log-page {
  min-height: 100vh;
  background: var(--app-bg, #0d171b);
  color: var(--app-text, #f4f6f5);
}

.log-header {
  height: 142rpx;
  padding: 28rpx;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 18rpx;
  background: var(--app-surface, #111d23);
  border-bottom: 1rpx solid var(--app-border, #29404a);
}

.icon-button,
.clear-button,
.copy-button {
  border: 1rpx solid var(--app-border, #29404a);
  border-radius: 8rpx;
  background: var(--app-surface-soft, #17252c);
  color: var(--app-text, #f4f6f5);
}

.icon-button {
  width: 72rpx;
  height: 72rpx;
  line-height: 72rpx;
  padding: 0;
  font-size: 52rpx;
}

.clear-button {
  min-width: 116rpx;
  height: 66rpx;
  line-height: 66rpx;
  padding: 0 20rpx;
  font-size: 24rpx;
}

.icon-button::after,
.clear-button::after,
.copy-button::after {
  border: 0;
}

.header-copy,
.summary-main {
  flex: 1;
  min-width: 0;
}

.eyebrow {
  color: var(--app-accent, #d8b15d);
  font-size: 20rpx;
  font-weight: 700;
}

.header-title {
  margin-top: 6rpx;
  font-size: 38rpx;
  font-weight: 800;
}

.log-scroll {
  height: calc(100vh - 142rpx);
}

.empty-panel,
.log-card {
  margin: 28rpx;
  padding: 26rpx;
  border: 1rpx solid var(--app-border, #29404a);
  border-radius: 8rpx;
  background: var(--app-surface, #111d23);
}

.empty-title {
  font-size: 32rpx;
  font-weight: 800;
}

.empty-text,
.summary-time,
.summary-source,
.item-url,
.item-reason {
  color: var(--app-muted, #a9b6bb);
  font-size: 23rpx;
}

.log-summary,
.item-head {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.summary-title {
  margin-top: 6rpx;
  font-size: 30rpx;
  font-weight: 800;
}

.summary-source,
.item-url,
.item-reason {
  display: block;
  margin-top: 8rpx;
  word-break: break-all;
}

.summary-toggle {
  color: var(--app-accent-strong, #5ff2e4);
  font-size: 24rpx;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: 22rpx;
}

.stat-item {
  min-height: 86rpx;
  padding: 12rpx;
  box-sizing: border-box;
  border-radius: 8rpx;
  background: rgba(255, 255, 255, 0.05);
}

.stat-item text {
  display: block;
  color: var(--app-muted, #a9b6bb);
  font-size: 21rpx;
}

.stat-item strong {
  display: block;
  margin-top: 4rpx;
  font-size: 30rpx;
}

.stat-item.success strong {
  color: #5ff2e4;
}

.stat-item.failed strong {
  color: #ff8f7d;
}

.stat-item.unsupported strong {
  color: #d8b15d;
}

.log-items {
  margin-top: 22rpx;
  border-top: 1rpx solid var(--app-border, #29404a);
}

.log-item {
  padding: 18rpx 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.08);
}

.item-name {
  flex: 1;
  min-width: 0;
  font-size: 26rpx;
  font-weight: 700;
}

.status-pill {
  padding: 5rpx 12rpx;
  border-radius: 8rpx;
  color: #0d171b;
  background: #d8b15d;
  font-size: 21rpx;
  font-weight: 700;
}

.status-pill.success {
  background: #5ff2e4;
}

.status-pill.failed,
.status-pill.blocked {
  background: #ff8f7d;
}

.status-pill.duplicated,
.status-pill.skipped {
  background: #a9b6bb;
}

.copy-button {
  width: 100%;
  margin-top: 22rpx;
  height: 72rpx;
  line-height: 72rpx;
  font-size: 25rpx;
}

.bottom-space {
  height: 40rpx;
}
</style>
