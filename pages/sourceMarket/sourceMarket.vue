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
          <text class="preview-value">{{ previewSource.compatibility || 'v1 兼容' }}</text>
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
import { importSourcesFromAny } from '../../common/bookSources.js'
import { getAppThemeId, getAppThemeStyle } from '../../common/appTheme.js'
import { friendlyErrorMessage } from '../../common/uiFeedback.js'
import {
  fetchMarketSourcePreview,
  fetchSourceMarketItems,
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
      previewVisible: false,
      previewLoading: false,
      previewError: '',
      previewSource: null,
      previewJsonUrl: '',
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
    async loadMarket(url = '') {
      this.loading = true
      this.error = ''
      try {
        this.items = await fetchSourceMarketItems({
          provider: this.provider,
          keyword: this.keyword,
          url
        })
      } catch (error) {
        this.items = []
        this.error = friendlyErrorMessage(error, '无法访问源仓库')
      } finally {
        this.loading = false
      }
    },
    async scanQr() {
      try {
        const payload = await scanImportPayload(uni)
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
        uni.showToast({ title: error.message || '未完成扫码', icon: 'none' })
      }
    },
    async openPreview(url) {
      this.previewVisible = true
      this.previewLoading = true
      this.previewError = ''
      this.previewSource = null
      this.previewJsonUrl = ''
      try {
        const result = await fetchMarketSourcePreview(url)
        this.previewSource = result.source
        this.previewJsonUrl = result.jsonUrl
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
      } catch (error) {
        uni.showToast({ title: friendlyErrorMessage(error, '导入失败'), icon: 'none' })
      } finally {
        this.importing = false
      }
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
.status-card,
.source-card,
.preview-card {
  border: 1rpx solid var(--app-border);
  border-radius: 18rpx;
  background: var(--app-panel);
}

.provider-card,
.section-card,
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
