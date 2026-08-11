<template>
  <view class="market-page app-page" :style="themeVars">
    <view class="top-zone">
      <button class="icon-button" @tap="goBack">‹</button>
      <view class="search-shell">
        <text class="search-icon">⌕</text>
        <input
          class="search-input"
          v-model="keyword"
          confirm-type="search"
          placeholder="筛选发现源"
          @confirm="loadMarket()"
        />
      </view>
      <button class="icon-button" @tap="scanQr">▣</button>
    </view>

    <scroll-view class="market-body" scroll-y :show-scrollbar="false">
      <view class="provider-card">
        <button
          class="provider-row"
          v-for="option in providers"
          :key="option.value"
          :class="{ active: provider === option.value }"
          @tap="selectProvider(option.value)"
        >
          <text>{{ option.label }}</text>
          <text>{{ provider === option.value ? '✓' : '›' }}</text>
        </button>
      </view>

      <view class="section-card">
        <view class="section-title">分类</view>
        <text class="status-desc market-notice" v-if="marketNotice">{{ marketNotice }}</text>
        <view class="recommended-block">
          <text class="status-desc">推荐可用源</text>
          <view class="chip-grid">
            <button class="chip recommended" v-for="item in recommendedSources" :key="item.detailUrl" @tap="openRecommendedSource(item)">
              {{ item.name }}
            </button>
          </view>
        </view>
        <view class="chip-grid">
          <button class="chip" v-for="item in categoryChips" :key="item" @tap="searchCategory(item)">
            {{ item }}
          </button>
        </view>
        <view class="rank-row">
          <button class="rank-button" v-for="item in rankChips" :key="item" @tap="searchCategory(item)">
            {{ item }}
          </button>
        </view>
      </view>

      <view class="bulk-card">
        <view class="source-head">
          <view>
            <view class="section-title">批量导入</view>
            <text class="status-desc">{{ bulkScopeLabel }}</text>
          </view>
          <text class="bulk-count">{{ marketMeta.total || items.length }}</text>
        </view>
        <view class="bulk-progress" v-if="bulkImporting || bulkProgress.page">
          <view class="bulk-progress-bar" :style="{ width: `${bulkPercent}%` }"></view>
        </view>
        <text class="status-desc" v-if="bulkProgress.page">
          第 {{ bulkProgress.page }}/{{ bulkProgress.totalPages || marketMeta.totalPages || 1 }} 页 ·
          已处理 {{ bulkProgress.stats ? bulkProgress.stats.downloaded : 0 }} ·
          缺失 {{ bulkProgress.stats ? bulkProgress.stats.missing : 0 }} ·
          新增 {{ bulkProgress.stats ? bulkProgress.stats.imported : 0 }} ·
          更新 {{ bulkProgress.stats ? bulkProgress.stats.updated : 0 }}
        </text>
        <text class="status-desc bulk-warning">
          仅静态检查为可用的来源自动启用；登录、验证码、WebView 或规则受限来源仍会保存，但默认停用。
        </text>
        <text class="status-desc" v-if="bulkCheckpoint && bulkCheckpoint.status !== 'completed'">
          检测到断点：可从第 {{ bulkCheckpoint.nextPage }} 页继续。
        </text>
        <text class="status-desc error-text" v-if="bulkError">{{ bulkError }}</text>
        <button class="submit-button bulk-action" v-if="!bulkImporting" @tap="startBulkImport">
          {{ bulkCheckpoint && bulkCheckpoint.status !== 'completed' ? '继续批量导入' : '导入当前筛选全部' }}
        </button>
        <button class="submit-button bulk-action cancel" v-else @tap="cancelBulkImport">保存进度并停止</button>
      </view>

      <view class="status-card" v-if="loading || error || !visibleItems.length">
        <view class="status-title">{{ loading ? '正在加载源仓库' : error ? '无法访问源仓库' : '暂无匹配书源' }}</view>
        <text class="status-desc">{{ loading ? '正在读取第三方源仓库页面。' : error || '换一个关键词，或点击右上角扫码导入。' }}</text>
        <button class="submit-button" v-if="error" @tap="loadMarket">重试</button>
      </view>

      <view class="source-card" v-for="item in visibleItems" :key="item.id" @tap="openPreview(item.detailUrl)">
        <view class="source-head">
          <view>
            <view class="source-title">{{ item.title }}</view>
            <text class="source-meta">{{ item.group || '未分组' }} · 下载 {{ item.downloads || 0 }}</text>
          </view>
          <text class="source-arrow">›</text>
        </view>
        <text class="source-url">{{ item.baseUrl || item.detailUrl }}</text>
        <view class="tag-row">
          <text class="tag" v-for="tag in item.tags" :key="tag">{{ tag }}</text>
          <text class="tag muted" v-if="item.updatedLabel">{{ item.updatedLabel }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="drawer-mask" v-if="previewVisible" @tap="closePreview"></view>
    <view class="preview-drawer app-floating-panel" v-if="previewVisible">
      <view class="drawer-head">
        <view>
          <text class="eyebrow">SOURCE PREVIEW</text>
          <view class="drawer-title">{{ previewSource ? previewSource.name : '书源预览' }}</view>
        </view>
        <button class="round-action" @tap="closePreview">×</button>
      </view>

      <view class="preview-card" v-if="previewSource">
        <view class="preview-row">
          <text class="preview-label">分组</text>
          <text class="preview-value">{{ previewSource.group || '用户导入' }}</text>
        </view>
        <view class="preview-row">
          <text class="preview-label">地址</text>
          <text class="preview-value one-line">{{ previewSource.baseUrl || '无地址' }}</text>
        </view>
        <view class="preview-row">
          <text class="preview-label">兼容性</text>
          <text class="preview-value">{{ sourceStatusLabel(previewSource.status) }}</text>
        </view>
        <view class="preview-row">
          <text class="preview-label">运行平台</text>
          <text class="preview-value">APK {{ previewSource.android_supported ? '可运行' : '受限' }} · H5 {{ previewSource.h5_supported ? '可运行' : '需代理/受限' }}</text>
        </view>
        <view class="preview-row">
          <text class="preview-label">阅读能力</text>
          <text class="preview-value">搜 {{ capabilityMark(previewSource.searchable) }} / 详情 {{ capabilityMark(previewSource.detailReadable) }} / 目录 {{ capabilityMark(previewSource.tocReadable) }} / 正文 {{ capabilityMark(previewSource.contentReadable) }}</text>
        </view>
        <view class="preview-row" v-if="previewSource.requiresCookie || previewSource.requiresLogin || previewSource.requiresWebView">
          <text class="preview-label">附加条件</text>
          <text class="preview-value">{{ sourceRequirements(previewSource) }}</text>
        </view>
        <view class="preview-row" v-if="previewSource.reasons && previewSource.reasons.length">
          <text class="preview-label">限制原因</text>
          <text class="preview-value">{{ previewSource.reasons.join('；') }}</text>
        </view>
        <view class="preview-row">
          <text class="preview-label">安装状态</text>
          <text class="preview-value">{{ previewInstalled ? '已安装' : '未安装' }}</text>
        </view>
      </view>
      <view class="status-card compact" v-else>
        <view class="status-title">{{ previewLoading ? '正在读取书源详情' : '无法预览书源' }}</view>
        <text class="status-desc">{{ previewError || '请稍后重试。' }}</text>
      </view>

      <button class="submit-button" :loading="importing" :disabled="!previewJsonUrl" @tap="importPreviewSource">
        确认导入
      </button>
    </view>
  </view>
</template>

<script>
import { getSourceConfigs, importSourcesFromAny } from '../../common/bookSources.js'
import { getYckBulkImportCheckpoint, runYckBulkImport } from '../../common/sourceBulkImport.js'
import { getAppThemeId, getAppThemeStyle } from '../../common/appTheme.js'
import { friendlyErrorMessage } from '../../common/uiFeedback.js'
import {
  fetchMarketSourcePreview,
  fetchSourceMarketPageWithFallback,
  RECOMMENDED_SOURCE_CANDIDATES,
  resolveMarketScanTarget,
  SOURCE_MARKET_PROVIDERS
} from '../../common/sourceMarket.js'
import { scanImportPayload } from '../../common/importAdapters.js'

export default {
  data() {
    return {
      themeId: getAppThemeId(),
      provider: 'yckceo',
      keyword: '',
      items: [],
      loading: false,
      error: '',
      marketNotice: '',
      marketMeta: { total: 0, totalPages: 1, page: 1 },
      bulkImporting: false,
      bulkProgress: { page: 0, totalPages: 0, stats: null },
      bulkCheckpoint: null,
      bulkSignal: null,
      bulkError: '',
      recommendedSources: RECOMMENDED_SOURCE_CANDIDATES,
      previewVisible: false,
      previewLoading: false,
      previewError: '',
      previewSource: null,
      previewJsonUrl: '',
      previewInstalled: false,
      importing: false,
      providers: [
        { label: SOURCE_MARKET_PROVIDERS.yckceo.label, value: 'yckceo' },
        { label: SOURCE_MARKET_PROVIDERS.yck2026.label, value: 'yck2026' }
      ],
      categoryChips: ['玄幻', '修真', '都市', '历史', '网游', '科幻', '悬疑', '同人', '轻小说', '女生', '短篇', '其他'],
      rankChips: ['点击榜', '推荐榜', '收藏榜', '下载榜', '评论数榜', '评分榜', '最新入库']
    }
  },
  computed: {
    themeVars() {
      return getAppThemeStyle(this.themeId)
    },
    visibleItems() {
      const word = this.keyword.trim().toLowerCase()
      if (!word) return this.items
      return this.items.filter(item => [
        item.title,
        item.group,
        item.baseUrl,
        item.tags.join(' ')
      ].join(' ').toLowerCase().includes(word))
    },
    bulkPercent() {
      const total = Number(this.bulkProgress.totalPages || this.marketMeta.totalPages || 1)
      return Math.max(0, Math.min(100, Math.round(Number(this.bulkProgress.page || 0) / total * 100)))
    },
    bulkScopeLabel() {
      return this.keyword.trim()
        ? `导入关键词“${this.keyword.trim()}”的全部匹配结果`
        : '导入 YCK 仓库全部书源配置'
    }
  },
  onLoad(query = {}) {
    if (query.provider && SOURCE_MARKET_PROVIDERS[query.provider]) this.provider = query.provider
    const targetUrl = query.url ? decodeURIComponent(query.url) : ''
    if (targetUrl) {
      const target = resolveMarketScanTarget(targetUrl)
      if (target.type === 'detail' || target.type === 'json') {
        this.openPreview(target.url)
      } else if (target.type === 'market') {
        this.loadMarket(target.url)
      }
    } else {
      this.loadMarket()
    }
  },
  onUnload() {
    if (this.bulkSignal) this.bulkSignal.cancelled = true
  },
  methods: {
    goBack() {
      if (typeof getCurrentPages === 'function' && getCurrentPages().length > 1) {
        uni.navigateBack()
        return
      }
      uni.switchTab({ url: '/pages/library/library' })
    },
    selectProvider(value) {
      this.provider = value
      this.loadMarket()
    },
    searchCategory(value) {
      this.keyword = value
      this.loadMarket()
    },
    openRecommendedSource(item) {
      if (item && item.testKeyword) this.keyword = item.testKeyword
      this.openPreview(item.detailUrl)
    },
    async loadMarket(url = '') {
      this.loading = true
      this.error = ''
      this.marketNotice = ''
      try {
        const result = await fetchSourceMarketPageWithFallback({
          provider: this.provider,
          keyword: this.keyword,
          url
        })
        this.items = result.items
        this.marketMeta = {
          total: Number(result.total || result.items.length),
          totalPages: Number(result.totalPages || 1),
          page: Number(result.page || 1)
        }
        if (result.provider && SOURCE_MARKET_PROVIDERS[result.provider]) {
          this.provider = result.provider
        }
        if (result.fallback) {
          this.marketNotice = `主仓库暂不可用，已切换备用仓库：${SOURCE_MARKET_PROVIDERS[result.provider].label}`
        }
        this.bulkCheckpoint = getYckBulkImportCheckpoint({ provider: this.provider, keyword: this.keyword })
      } catch (error) {
        this.items = []
        this.error = friendlyErrorMessage(error, '无法访问源仓库')
      } finally {
        this.loading = false
      }
    },
    confirmBulkImport() {
      const total = Number(this.marketMeta.total || this.items.length)
      return new Promise(resolve => {
        uni.showModal({
          title: '批量导入书源',
          content: `将分批下载并保存约 ${total} 个配置。受限来源默认停用，可随时停止并从断点继续。`,
          confirmText: '开始导入',
          cancelText: '暂不导入',
          success: result => resolve(!!result.confirm),
          fail: () => resolve(false)
        })
      })
    },
    async startBulkImport() {
      if (this.bulkImporting || !await this.confirmBulkImport()) return
      this.bulkImporting = true
      this.bulkError = ''
      this.bulkSignal = { cancelled: false }
      try {
        const result = await runYckBulkImport({
          provider: this.provider,
          keyword: this.keyword,
          signal: this.bulkSignal,
          resume: true,
          duplicateStrategy: 'overwrite',
          onProgress: progress => {
            this.bulkProgress = { ...this.bulkProgress, ...progress }
          }
        })
        this.bulkCheckpoint = result.checkpoint
        const label = result.status === 'cancelled' ? '已保存断点' : '批量导入完成'
        uni.showToast({
          title: `${label}：新增 ${result.stats.imported} / 更新 ${result.stats.updated}`,
          icon: 'none',
          duration: 3000
        })
      } catch (error) {
        this.bulkCheckpoint = error && error.bulkImport && error.bulkImport.checkpoint
          || getYckBulkImportCheckpoint({ provider: this.provider, keyword: this.keyword })
        this.bulkError = friendlyErrorMessage(error, '批量导入失败，已保存最近断点')
      } finally {
        this.bulkImporting = false
        this.bulkSignal = null
      }
    },
    cancelBulkImport() {
      if (this.bulkSignal) this.bulkSignal.cancelled = true
    },
    async scanQr() {
      try {
        uni.showLoading({ title: 'Scan', mask: true })
        const payload = await scanImportPayload(uni)
        uni.hideLoading()
        const target = resolveMarketScanTarget(payload)
        if (target.type === 'detail' || target.type === 'json') {
          await this.openPreview(target.url)
          return
        }
        if (target.type === 'market') {
          await this.loadMarket(target.url)
          return
        }
        uni.showToast({ title: '没有识别到源仓库二维码', icon: 'none' })
      } catch (error) {
        uni.hideLoading()
        uni.showToast({ title: error.message || '未完成扫码', icon: 'none' })
      }
    },
    async openPreview(url) {
      this.previewVisible = true
      this.previewLoading = true
      this.previewError = ''
      this.previewSource = null
      this.previewJsonUrl = ''
      this.previewInstalled = false
      try {
        const result = await fetchMarketSourcePreview(url)
        this.previewSource = result.source
        this.previewJsonUrl = result.jsonUrl
        this.previewInstalled = this.isSourceInstalled(result.source)
      } catch (error) {
        this.previewError = friendlyErrorMessage(error, '无法预览书源')
      } finally {
        this.previewLoading = false
      }
    },
    closePreview() {
      this.previewVisible = false
    },
    async importPreviewSource() {
      if (!this.previewJsonUrl) return
      this.importing = true
      try {
        const result = await importSourcesFromAny(this.previewJsonUrl)
        uni.showToast({
          title: `已导入：${result.imported} 新增 / ${result.updated} 覆盖`,
          icon: 'none'
        })
        this.previewInstalled = true
      } catch (error) {
        uni.showToast({ title: friendlyErrorMessage(error, '导入失败'), icon: 'none' })
      } finally {
        this.importing = false
      }
    },
    isSourceInstalled(source) {
      if (!source || !source.id) return false
      return getSourceConfigs().some(item => item.id === source.id)
    },
    capabilityMark(value) {
      return value ? '✓' : '—'
    },
    sourceStatusLabel(status) {
      return ({
        ready: '可用',
        partial: '部分可用（导入后默认停用）',
        needs_login: '需要登录（导入后默认停用）',
        blocked: '规则受限（导入后默认停用）',
        invalid: '配置无效'
      })[status] || '待测试'
    },
    sourceRequirements(source) {
      const labels = []
      if (source.requiresCookie) labels.push('Cookie')
      if (source.requiresLogin) labels.push('登录')
      if (source.requiresWebView) labels.push('WebView')
      return labels.join('、')
    }
  }
}
</script>

<style>
.market-page {
  box-sizing: border-box;
  width: 100%;
  max-width: 1120px;
  min-height: 100vh;
  margin: 0 auto;
  padding: 66rpx 24rpx 132rpx;
  background: var(--app-bg);
}

button::after {
  border: 0;
}

button,
input {
  box-sizing: border-box;
}

.top-zone {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin: -66rpx -24rpx 24rpx;
  padding: 66rpx 24rpx 24rpx;
  background: var(--app-top);
}

.icon-button,
.round-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 70rpx;
  height: 70rpx;
  margin: 0;
  padding: 0;
  border-radius: 999rpx;
  color: var(--app-text);
  font-size: 36rpx;
  background: var(--app-panel);
}

.search-shell {
  display: flex;
  align-items: center;
  flex: 1;
  height: 70rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: var(--app-input);
}

.search-icon {
  color: var(--app-muted);
  font-size: 28rpx;
}

.search-input {
  flex: 1;
  height: 68rpx;
  padding-left: 14rpx;
  color: var(--app-text);
  font-size: 25rpx;
}

.market-body {
  height: calc(100vh - 154rpx);
}

.provider-card,
.section-card,
.bulk-card,
.status-card,
.source-card,
.preview-card {
  border: 1rpx solid var(--app-border);
  border-radius: 18rpx;
  background: var(--app-panel);
}

.provider-card,
.section-card,
.bulk-card,
.status-card,
.source-card {
  margin-bottom: 18rpx;
}

.provider-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 76rpx;
  padding: 0 22rpx;
  color: var(--app-text);
  font-size: 26rpx;
  background: transparent;
}

.provider-row.active {
  color: var(--app-accent-3);
}

.section-card,
.bulk-card,
.status-card,
.source-card {
  padding: 22rpx;
}

.section-title,
.status-title,
.source-title,
.drawer-title {
  color: var(--app-text);
  font-size: 30rpx;
  font-weight: 850;
  line-height: 40rpx;
}

.chip-grid,
.rank-row,
.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 18rpx;
}

.chip,
.rank-button,
.tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 116rpx;
  height: 56rpx;
  margin: 0;
  padding: 0 18rpx;
  border-radius: 999rpx;
  color: var(--app-text);
  font-size: 24rpx;
  background: var(--app-input);
}

.rank-button {
  min-width: 156rpx;
}

.status-desc,
.source-meta,
.source-url,
.preview-label,
.preview-value,
.eyebrow {
  display: block;
  color: var(--app-muted);
  font-size: 23rpx;
  line-height: 34rpx;
}

.status-desc,
.source-url {
  margin-top: 8rpx;
}

.market-notice {
  color: var(--app-accent-3);
}

.bulk-count {
  color: var(--app-accent-3);
  font-size: 34rpx;
  font-weight: 900;
}

.bulk-progress {
  height: 12rpx;
  margin-top: 18rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: var(--app-input);
}

.bulk-progress-bar {
  height: 100%;
  border-radius: inherit;
  background: var(--app-accent-3);
  transition: width 180ms ease;
}

.bulk-warning {
  color: var(--app-muted);
}

.error-text {
  color: var(--app-danger, #c62828);
}

.bulk-action.cancel {
  color: var(--app-text);
  background: var(--app-input);
}

.recommended-block {
  margin-top: 12rpx;
}

.chip.recommended {
  color: var(--app-on-accent);
  background: var(--app-accent-3);
}

.source-head,
.drawer-head,
.preview-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.source-title,
.source-url,
.preview-value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-arrow {
  flex-shrink: 0;
  color: var(--app-muted);
  font-size: 42rpx;
}

.tag {
  min-width: 0;
  height: 42rpx;
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.tag.muted {
  color: var(--app-text);
  background: var(--app-input);
}

.drawer-mask {
  position: fixed;
  left: 50%;
  top: 0;
  z-index: 18;
  width: min(100vw, 1120px);
  height: 100vh;
  background: rgba(20, 35, 34, 0.26);
  transform: translateX(-50%);
}

.preview-drawer {
  position: fixed;
  left: 50%;
  bottom: 124rpx;
  z-index: 20;
  width: min(calc(100vw - 48rpx), 960px);
  max-height: 78vh;
  padding: 28rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 28rpx;
  background: var(--app-panel-strong);
  box-shadow: var(--app-floating-shadow);
  transform: translateX(-50%);
}

.eyebrow {
  color: var(--app-accent-3);
  font-weight: 900;
}

.preview-card {
  margin-top: 22rpx;
  padding: 18rpx;
}

.preview-row {
  min-height: 58rpx;
}

.preview-label {
  flex-shrink: 0;
  width: 120rpx;
}

.preview-value {
  color: var(--app-text);
  text-align: right;
}

.submit-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 78rpx;
  margin-top: 18rpx;
  border-radius: 18rpx;
  color: var(--app-on-accent);
  font-size: 27rpx;
  font-weight: 800;
  background: var(--app-accent);
}

.status-card.compact {
  margin-top: 18rpx;
}
</style>
