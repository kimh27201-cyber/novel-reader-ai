<template>
  <view class="import-page app-page" :style="themeVars">
    <view class="top-zone">
      <view>
        <text class="eyebrow">IMPORT</text>
        <view class="title">导入</view>
        <text class="subtitle">书源规则、TXT、本地与云端演示源</text>
      </view>
      <button class="icon-button" @tap="goSearch">⌕</button>
    </view>

    <view class="source-manager">
      <view class="manager-head">
        <view>
          <text class="eyebrow">BOOK SOURCES</text>
          <view class="section-title">书源管理</view>
          <text class="section-desc">启用的兼容书源会参与“发现”页在线搜索。</text>
        </view>
        <view class="head-actions">
          <button class="small-action primary" @tap="openImportDrawer('repo')">导入</button>
          <button class="round-action" @tap="sourceMenuVisible = !sourceMenuVisible">⋯</button>
        </view>
      </view>

      <view class="search-bar">
        <text class="search-icon">⌕</text>
        <input class="search-input" v-model="sourceKeyword" placeholder="搜索书源名称、分组或地址" />
      </view>

      <view class="menu-popover" v-if="sourceMenuVisible">
        <button
          class="menu-row"
          v-for="option in sortOptions"
          :key="option.value"
          :class="{ active: sourceSort === option.value }"
          @tap="selectSourceSort(option.value)"
        >
          <text>{{ option.label }}</text>
          <text>{{ sourceSort === option.value ? '●' : '○' }}</text>
        </button>
        <button class="menu-row" @tap="refreshBackendSources">
          <text>刷新云端源</text>
          <text>↻</text>
        </button>
      </view>

      <scroll-view class="filter-strip" scroll-x :show-scrollbar="false">
        <button
          class="filter-chip"
          v-for="item in filterOptions"
          :key="item.value"
          :class="{ active: sourceFilter === item.value }"
          @tap="sourceFilter = item.value"
        >
          {{ item.label }}
        </button>
      </scroll-view>

      <scroll-view class="group-strip" scroll-x :show-scrollbar="false">
        <button
          class="group-chip"
          v-for="group in sourceGroups"
          :key="group"
          :class="{ active: sourceGroupFilter === group }"
          @tap="sourceGroupFilter = group"
        >
          {{ group }}
        </button>
      </scroll-view>

      <view class="summary-row">
        <text>{{ sourceStats.total }} 个书源</text>
        <text>{{ sourceStats.enabled }} 启用</text>
        <text>{{ sourceStats.incompatible }} 不兼容</text>
      </view>

      <scroll-view class="source-list" scroll-y :show-scrollbar="false">
        <view class="source-empty" v-if="!visibleSources.length && !visibleBackendSources.length">
          <view class="empty-title">没有匹配的书源</view>
          <text class="empty-desc">换一个筛选条件，或点击“导入”添加 JSON / 源仓库页。</text>
        </view>

        <view class="source-row cloud" v-for="source in visibleBackendSources" :key="`cloud-${source.id}`">
          <view class="check-box active">云</view>
          <view class="source-main">
            <view class="source-name">{{ source.name }}</view>
            <text class="source-meta">后端 · {{ source.group || '云端源' }} · {{ source.compatibility || '可用' }}</text>
          </view>
          <text class="status-dot active"></text>
        </view>

        <view class="source-row" v-for="source in visibleSources" :key="source.id">
          <button class="check-box" :class="{ active: source.enabled }" @tap="toggleSource(source)">
            {{ source.enabled ? '✓' : '' }}
          </button>
          <view class="source-main">
            <view class="source-name">{{ source.name }}</view>
            <text class="source-meta">{{ source.group }} · {{ source.compatibility }} · {{ source.baseUrl || '无地址' }}</text>
          </view>
          <button class="status-switch" :class="{ active: source.enabled }" @tap="toggleSource(source)">
            {{ source.enabled ? '启用' : '停用' }}
          </button>
          <button class="row-action" v-if="source.importedAt" @tap="removeSource(source)">删</button>
        </view>
      </scroll-view>
    </view>

    <view class="utility-grid">
      <button class="utility-card" @tap="openTxtPanel">
        <text class="utility-icon">TXT</text>
        <view>
          <view class="utility-title">本地 TXT</view>
          <text class="utility-desc">选择本地小说并生成章节</text>
        </view>
      </button>
      <button class="utility-card" @tap="scanSourceQr">
        <text class="utility-icon">▣</text>
        <view>
          <view class="utility-title">扫码导入</view>
          <text class="utility-desc">真机扫描二维码书源</text>
        </view>
      </button>
      <button class="utility-card" :loading="backendLoading" @tap="importBackendDemo">
        <text class="utility-icon">云</text>
        <view>
          <view class="utility-title">后端演示源</view>
          <text class="utility-desc">登录后导入 FastAPI 示例源</text>
        </view>
      </button>
    </view>

    <view class="drawer-mask" v-if="importDrawerVisible || txtVisible" @tap="closePanels"></view>

    <view class="import-drawer app-floating-panel" v-if="importDrawerVisible">
      <view class="drawer-head">
        <view>
          <text class="eyebrow">ADD SOURCE</text>
          <view class="drawer-title">导入书源</view>
        </view>
        <button class="round-action" @tap="closePanels">×</button>
      </view>

      <view class="import-methods">
        <button class="method-card" :class="{ active: sourceImportMode === 'json' }" @tap="setImportMode('json')">
          <text class="method-icon">JSON</text>
          <text>粘贴导入</text>
        </button>
        <button class="method-card" :class="{ active: sourceImportMode === 'url' }" @tap="setImportMode('url')">
          <text class="method-icon">URL</text>
          <text>网络导入</text>
        </button>
        <button class="method-card" :class="{ active: sourceImportMode === 'repo' }" @tap="setImportMode('repo')">
          <text class="method-icon">仓</text>
          <text>源仓库页</text>
        </button>
      </view>

      <textarea
        v-if="sourceImportMode === 'json'"
        class="source-area"
        v-model="sourceImportText"
        placeholder="粘贴书源 JSON、sources 包装结构、yuedu:// 或 legado:// 一键导入链接"
      ></textarea>
      <input
        v-else
        class="field"
        v-model="sourceImportUrl"
        :placeholder="sourceImportMode === 'repo' ? '粘贴 yck2026/yckceo 源仓库详情页 URL' : '粘贴 JSON 直链或一键导入链接'"
      />
      <text class="source-hint">{{ sourceImportHint }}</text>

      <button class="submit-button" :loading="sourceImporting" @tap="submitSourceImport">导入书源</button>

      <view class="quick-actions">
        <button class="outline-action" @tap="importFromClipboard">剪贴板</button>
        <button class="outline-action" @tap="chooseSourceJsonFile">本地 JSON</button>
        <button class="outline-action" @tap="scanSourceQr">扫码</button>
        <button class="outline-action" @tap="openImportDrawer('repo')">源仓库页</button>
      </view>
    </view>

    <view class="import-drawer app-floating-panel" v-if="txtVisible">
      <view class="drawer-head">
        <view>
          <text class="eyebrow">TXT IMPORT</text>
          <view class="drawer-title">导入本地小说</view>
        </view>
        <button class="round-action" @tap="closePanels">×</button>
      </view>
      <button class="file-picker" @tap="chooseTxtFile">
        <text class="file-icon">TXT</text>
        <view class="file-copy">
          <view class="file-title">{{ importFileName || '选择 .txt 文件' }}</view>
          <text class="file-desc">{{ importFileText ? `${importPreview.chapterCount} 章 · ${importPreview.wordCount} 字` : '本地文件会在设备内完成目录识别' }}</text>
        </view>
      </button>
      <input class="field" v-model="importTitle" placeholder="书名，默认使用文件名" />
      <input class="field" v-model="importAuthor" placeholder="作者，可不填" />
      <button class="submit-button" :disabled="!importFileText" @tap="submitImport">加入书架</button>
    </view>
  </view>
</template>

<script>
import { importBookFromText, parseTxtChapters } from '../../common/books.js'
import {
  deleteUserSource,
  getSourceConfigs,
  importSourcesFromAny,
  setSourceEnabled
} from '../../common/bookSources.js'
import {
  importBackendDemoSource,
  listBackendSources
} from '../../common/backendLibrary.js'
import { getAppThemeId, getAppThemeStyle } from '../../common/appTheme.js'
import { friendlyErrorMessage } from '../../common/uiFeedback.js'

export default {
  data() {
    return {
      sources: [],
      importDrawerVisible: false,
      sourceMenuVisible: false,
      txtVisible: false,
      sourceImportMode: 'repo',
      sourceImportText: '',
      sourceImportUrl: '',
      sourceImporting: false,
      sourceFilter: 'all',
      sourceSort: 'manual',
      sourceKeyword: '',
      sourceGroupFilter: '全部分组',
      backendSources: [],
      backendLoading: false,
      themeId: getAppThemeId(),
      importTitle: '',
      importAuthor: '',
      importFileName: '',
      importFileText: '',
      filterOptions: [
        { label: '全部', value: 'all' },
        { label: '启用', value: 'enabled' },
        { label: '停用', value: 'disabled' },
        { label: '不兼容', value: 'incompatible' },
        { label: '云端', value: 'cloud' }
      ],
      sortOptions: [
        { label: '手动排序', value: 'manual' },
        { label: '名称排序', value: 'name' },
        { label: '分组排序', value: 'group' },
        { label: '更新时间排序', value: 'updated' },
        { label: '是否启用', value: 'enabled' }
      ]
    }
  },
  computed: {
    themeVars() {
      return getAppThemeStyle(this.themeId)
    },
    importPreview() {
      const chapters = parseTxtChapters(this.importFileText)
      return {
        chapterCount: chapters.length,
        wordCount: String(this.importFileText || '').replace(/\s/g, '').length
      }
    },
    sourceImportHint() {
      if (this.sourceImportMode === 'json') return '支持单个对象、数组、sources 包装结构和一键导入链接。'
      if (this.sourceImportMode === 'repo') return '粘贴 yck2026/yckceo 详情页，系统会优先读取页面里的 JSON 下载地址。'
      return '支持直接 JSON 链接、yuedu://、legado:// 和包含 src= 的链接。'
    },
    sourceStats() {
      return {
        total: this.sources.length + this.backendSources.length,
        enabled: this.sources.filter(source => source.enabled).length,
        incompatible: this.sources.filter(source => !/^v1/.test(source.compatibility)).length
      }
    },
    sourceGroups() {
      const groups = this.sources.map(source => source.group || '未分组')
      return ['全部分组', ...Array.from(new Set(groups))]
    },
    visibleSources() {
      if (this.sourceFilter === 'cloud') return []
      const keyword = this.sourceKeyword.trim().toLowerCase()
      const list = this.sources.filter(source => {
        if (this.sourceFilter === 'enabled' && !source.enabled) return false
        if (this.sourceFilter === 'disabled' && source.enabled) return false
        if (this.sourceFilter === 'incompatible' && /^v1/.test(source.compatibility)) return false
        if (this.sourceGroupFilter !== '全部分组' && source.group !== this.sourceGroupFilter) return false
        if (!keyword) return true
        return [source.name, source.group, source.baseUrl, source.compatibility]
          .some(value => String(value || '').toLowerCase().includes(keyword))
      })
      return this.sortSources(list)
    },
    visibleBackendSources() {
      if (!(this.sourceFilter === 'all' || this.sourceFilter === 'cloud')) return []
      const keyword = this.sourceKeyword.trim().toLowerCase()
      return this.backendSources.filter(source => {
        if (!keyword) return true
        return [source.name, source.group, source.compatibility]
          .some(value => String(value || '').toLowerCase().includes(keyword))
      })
    }
  },
  onShow() {
    this.themeId = getAppThemeId()
    this.sources = getSourceConfigs()
    this.refreshBackendSources({ silent: true })
  },
  methods: {
    sortSources(list) {
      const next = [...list]
      if (this.sourceSort === 'name') return next.sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-Hans-CN'))
      if (this.sourceSort === 'group') return next.sort((a, b) => String(a.group).localeCompare(String(b.group), 'zh-Hans-CN'))
      if (this.sourceSort === 'updated') return next.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      if (this.sourceSort === 'enabled') return next.sort((a, b) => Number(b.enabled) - Number(a.enabled))
      return next
    },
    selectSourceSort(value) {
      this.sourceSort = value
      this.sourceMenuVisible = false
    },
    setImportMode(mode) {
      this.sourceImportMode = mode
    },
    openImportDrawer(mode = this.sourceImportMode) {
      this.sourceImportMode = mode
      this.importDrawerVisible = true
      this.txtVisible = false
      this.sourceMenuVisible = false
    },
    openSourcePanel() {
      this.openImportDrawer('repo')
    },
    openTxtPanel() {
      this.txtVisible = true
      this.importDrawerVisible = false
      this.sourceMenuVisible = false
    },
    closePanels() {
      this.importDrawerVisible = false
      this.txtVisible = false
      this.sourceMenuVisible = false
      this.sourceImportText = ''
      this.sourceImportUrl = ''
      this.sources = getSourceConfigs()
    },
    async submitSourceImport() {
      const raw = String(this.sourceImportMode === 'json' ? this.sourceImportText : this.sourceImportUrl).trim()
      if (!raw) {
        uni.showToast({ title: '请先粘贴书源内容或 URL', icon: 'none' })
        return
      }
      const result = await this.importSourcePayload(raw)
      if (result) {
        this.sourceImportText = ''
        this.sourceImportUrl = ''
      }
    },
    async importSourcePayload(raw, successPrefix = '已导入') {
      this.sourceImporting = true
      try {
        const result = await importSourcesFromAny(raw)
        this.sources = getSourceConfigs()
        uni.showToast({
          title: `${successPrefix}：${result.imported} 新增 / ${result.updated} 覆盖 / ${result.incompatible} 不兼容`,
          icon: 'none'
        })
        return result
      } catch (error) {
        uni.showToast({ title: friendlyErrorMessage(error, '导入书源失败'), icon: 'none' })
        return null
      } finally {
        this.sourceImporting = false
      }
    },
    importFromClipboard() {
      if (!uni.getClipboardData) {
        uni.showToast({ title: '当前环境不支持读取剪贴板', icon: 'none' })
        return
      }
      uni.getClipboardData({
        success: result => this.importSourcePayload(result.data || '', '剪贴板导入'),
        fail: () => uni.showToast({ title: '读取剪贴板失败', icon: 'none' })
      })
    },
    chooseSourceJsonFile() {
      if (!uni.chooseFile) {
        uni.showToast({ title: '当前环境暂不支持文件选择，请使用粘贴导入', icon: 'none' })
        return
      }
      uni.chooseFile({
        count: 1,
        type: 'all',
        extension: ['.json'],
        success: async result => {
          try {
            const file = (result.tempFiles && result.tempFiles[0]) || {
              path: result.tempFilePaths && result.tempFilePaths[0],
              name: result.tempFilePaths && result.tempFilePaths[0]
            }
            const fileName = this.getFileName(file)
            if (!/\.json$/i.test(fileName)) throw new Error('请选择 .json 书源文件')
            const text = await this.readFileText(file)
            await this.importSourcePayload(text, '本地 JSON 导入')
          } catch (error) {
            uni.showToast({ title: error.message || '读取 JSON 失败', icon: 'none' })
          }
        }
      })
    },
    async refreshBackendSources(options = {}) {
      this.backendLoading = true
      try {
        this.backendSources = await listBackendSources()
        if (!options.silent) {
          uni.showToast({ title: `云端书源 ${this.backendSources.length} 个`, icon: 'none' })
        }
      } catch (error) {
        this.backendSources = []
        if (!options.silent) {
          uni.showToast({ title: friendlyErrorMessage(error, '请先登录后端'), icon: 'none' })
        }
      } finally {
        this.backendLoading = false
      }
    },
    async importBackendDemo() {
      this.backendLoading = true
      try {
        const result = await importBackendDemoSource()
        this.backendSources = result.sources
        uni.showToast({ title: `已导入后端演示源 ${result.importedCount} 个`, icon: 'none' })
      } catch (error) {
        uni.showToast({ title: friendlyErrorMessage(error, '导入后端演示源失败'), icon: 'none' })
      } finally {
        this.backendLoading = false
      }
    },
    toggleSource(source) {
      setSourceEnabled(source.id, !source.enabled)
      this.sources = getSourceConfigs()
    },
    removeSource(source) {
      deleteUserSource(source.id)
      this.sources = getSourceConfigs()
    },
    scanSourceQr() {
      if (!uni.scanCode) {
        uni.showToast({ title: 'H5 预览不支持扫码，请用真机测试或剪贴板导入', icon: 'none' })
        return
      }
      uni.scanCode({
        onlyFromCamera: false,
        success: result => this.importSourcePayload(String(result.result || '').trim(), '扫码导入'),
        fail: () => uni.showToast({ title: '未完成扫码', icon: 'none' })
      })
    },
    chooseTxtFile() {
      if (!uni.chooseFile) {
        uni.showToast({ title: '当前环境暂不支持文件选择，请用真机测试', icon: 'none' })
        return
      }
      uni.chooseFile({
        count: 1,
        type: 'all',
        extension: ['.txt'],
        success: async result => {
          try {
            const file = (result.tempFiles && result.tempFiles[0]) || {
              path: result.tempFilePaths && result.tempFilePaths[0],
              name: result.tempFilePaths && result.tempFilePaths[0]
            }
            const fileName = this.getFileName(file)
            if (!/\.txt$/i.test(fileName)) throw new Error('请选择 .txt 文件')
            const text = await this.readFileText(file)
            if (!text || text.trim().length < 20) throw new Error('TXT 内容太短')
            this.importFileName = fileName
            this.importFileText = text
            if (!this.importTitle) this.importTitle = fileName.replace(/\.txt$/i, '').slice(0, 30)
          } catch (error) {
            uni.showToast({ title: error.message || '读取失败', icon: 'none' })
          }
        }
      })
    },
    getFileName(file) {
      return String((file && (file.name || file.path)) || '未命名').split(/[\\/]/).pop()
    },
    readFileText(file) {
      if (file.file && typeof FileReader !== 'undefined') {
        return new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = event => resolve(new TextDecoder('utf-8').decode(event.target.result))
          reader.onerror = () => reject(new Error('读取文件失败'))
          reader.readAsArrayBuffer(file.file)
        })
      }
      if (file.path && typeof plus !== 'undefined' && plus.io) {
        return new Promise((resolve, reject) => {
          plus.io.resolveLocalFileSystemURL(file.path, entry => {
            entry.file(rawFile => {
              const reader = new plus.io.FileReader()
              reader.onloadend = event => resolve(event.target.result || '')
              reader.onerror = () => reject(new Error('读取文件失败'))
              reader.readAsText(rawFile, 'utf-8')
            }, reject)
          }, reject)
        })
      }
      if (file.path && typeof fetch !== 'undefined') return fetch(file.path).then(response => response.text())
      return Promise.reject(new Error('当前环境无法读取文件'))
    },
    submitImport() {
      try {
        const book = importBookFromText({
          title: this.importTitle,
          author: this.importAuthor,
          text: this.importFileText
        })
        this.closePanels()
        uni.showToast({ title: `已导入：${book.title}`, icon: 'none' })
      } catch (error) {
        uni.showToast({ title: error.message || '导入失败', icon: 'none' })
      }
    },
    goSearch() {
      uni.switchTab({ url: '/pages/search/search' })
    }
  }
}
</script>

<style>
.import-page {
  box-sizing: border-box;
  width: 100%;
  max-width: 1120px;
  min-height: 100vh;
  padding: 86rpx 40rpx 132rpx;
  margin: 0 auto;
  background: var(--app-bg);
}

button::after {
  border: 0;
}

button,
input,
textarea {
  box-sizing: border-box;
}

.top-zone {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 142rpx;
  margin: -86rpx -40rpx 28rpx;
  padding: 86rpx 40rpx 30rpx;
  background: var(--app-top);
}

.eyebrow {
  color: var(--app-accent-3);
  font-size: 22rpx;
  font-weight: 900;
}

.title,
.section-title,
.drawer-title {
  margin-top: 8rpx;
  color: var(--app-text);
  font-size: 42rpx;
  font-weight: 900;
  line-height: 52rpx;
}

.section-title,
.drawer-title {
  font-size: 34rpx;
  line-height: 44rpx;
}

.subtitle,
.section-desc,
.source-hint,
.source-meta,
.utility-desc,
.file-desc,
.empty-desc {
  display: block;
  margin-top: 8rpx;
  color: var(--app-muted);
  font-size: 24rpx;
  line-height: 34rpx;
}

.icon-button,
.round-action,
.small-action,
.filter-chip,
.group-chip,
.method-card,
.outline-action,
.submit-button,
.check-box,
.status-switch,
.row-action {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  line-height: 1;
}

.icon-button,
.round-action {
  width: 78rpx;
  height: 78rpx;
  border-radius: 999rpx;
  color: var(--app-text);
  font-size: 38rpx;
  background: var(--app-panel);
}

.source-manager {
  position: relative;
  padding: 28rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 24rpx;
  background: var(--app-panel-strong);
  box-shadow: var(--app-shadow);
}

.manager-head,
.drawer-head,
.source-row,
.utility-card,
.file-picker {
  display: flex;
  align-items: center;
}

.manager-head,
.drawer-head {
  justify-content: space-between;
  gap: 20rpx;
}

.head-actions {
  display: flex;
  gap: 12rpx;
}

.small-action {
  min-width: 110rpx;
  height: 66rpx;
  border-radius: 999rpx;
  color: var(--app-text);
  font-size: 24rpx;
  background: var(--app-panel);
}

.small-action.primary,
.filter-chip.active,
.group-chip.active,
.method-card.active,
.submit-button,
.check-box.active {
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.search-bar {
  display: flex;
  align-items: center;
  height: 72rpx;
  margin-top: 26rpx;
  padding: 0 22rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 999rpx;
  background: var(--app-input);
}

.search-icon {
  color: var(--app-muted);
  font-size: 28rpx;
}

.search-input {
  flex: 1;
  height: 70rpx;
  padding-left: 14rpx;
  color: var(--app-text);
  font-size: 26rpx;
}

.menu-popover {
  position: absolute;
  top: 112rpx;
  right: 28rpx;
  z-index: 8;
  width: 320rpx;
  padding: 12rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 20rpx;
  background: var(--app-panel-strong);
  box-shadow: var(--app-floating-shadow);
}

.menu-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 76rpx;
  padding: 0 18rpx;
  color: var(--app-text);
  font-size: 26rpx;
  background: transparent;
}

.menu-row.active {
  color: var(--app-accent-3);
}

.filter-strip,
.group-strip {
  width: 100%;
  white-space: nowrap;
  margin-top: 20rpx;
}

.filter-chip,
.group-chip {
  display: inline-flex;
  min-width: 116rpx;
  height: 60rpx;
  margin-right: 12rpx;
  padding: 0 20rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 999rpx;
  color: var(--app-text);
  font-size: 24rpx;
  background: var(--app-panel);
}

.group-chip {
  min-width: 140rpx;
}

.summary-row {
  display: flex;
  gap: 20rpx;
  margin-top: 18rpx;
  color: var(--app-muted);
  font-size: 23rpx;
}

.source-list {
  height: 560rpx;
  margin-top: 20rpx;
}

.source-row {
  gap: 16rpx;
  min-height: 104rpx;
  padding: 18rpx;
  margin-bottom: 12rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 18rpx;
  background: var(--app-panel);
}

.source-row.cloud {
  border-color: var(--app-accent);
}

.check-box {
  flex-shrink: 0;
  width: 52rpx;
  height: 52rpx;
  border: 2rpx solid var(--app-border);
  border-radius: 14rpx;
  color: var(--app-text);
  font-size: 24rpx;
  background: transparent;
}

.source-main {
  min-width: 0;
  flex: 1;
}

.source-name {
  overflow: hidden;
  color: var(--app-text);
  font-size: 29rpx;
  font-weight: 850;
  line-height: 38rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-switch,
.row-action {
  flex-shrink: 0;
  min-width: 76rpx;
  height: 50rpx;
  border-radius: 999rpx;
  color: var(--app-text);
  font-size: 22rpx;
  background: var(--app-bg);
}

.status-switch.active {
  color: var(--app-on-accent);
  background: var(--app-accent-3);
}

.row-action {
  min-width: 56rpx;
}

.status-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 999rpx;
  background: var(--app-muted);
}

.status-dot.active {
  background: var(--app-accent);
}

.source-empty {
  padding: 70rpx 20rpx;
  text-align: center;
}

.empty-title {
  color: var(--app-text);
  font-size: 30rpx;
  font-weight: 800;
}

.utility-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  margin-top: 20rpx;
}

.utility-card {
  min-height: 112rpx;
  padding: 18rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 18rpx;
  background: var(--app-panel);
  text-align: left;
}

.utility-icon,
.file-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 70rpx;
  height: 70rpx;
  margin-right: 16rpx;
  border-radius: 18rpx;
  color: var(--app-on-accent);
  font-size: 24rpx;
  font-weight: 900;
  background: var(--app-accent);
}

.utility-title,
.file-title {
  color: var(--app-text);
  font-size: 27rpx;
  font-weight: 800;
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

.import-drawer {
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

.import-methods,
.quick-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: 22rpx;
}

.quick-actions {
  grid-template-columns: repeat(4, 1fr);
}

.method-card,
.outline-action {
  min-height: 76rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 16rpx;
  color: var(--app-text);
  font-size: 24rpx;
  background: var(--app-panel);
}

.method-card {
  flex-direction: column;
  gap: 8rpx;
}

.method-icon {
  font-size: 22rpx;
  font-weight: 900;
}

.source-area,
.field {
  width: 100%;
  margin-top: 18rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 16rpx;
  color: var(--app-text);
  background: var(--app-input);
  font-size: 25rpx;
}

.source-area {
  height: 168rpx;
  padding: 18rpx;
}

.field {
  height: 78rpx;
  padding: 0 22rpx;
}

.submit-button {
  width: 100%;
  height: 78rpx;
  margin-top: 18rpx;
  border-radius: 18rpx;
  font-size: 27rpx;
  font-weight: 800;
}

.file-picker {
  width: 100%;
  min-height: 118rpx;
  margin-top: 24rpx;
  padding: 18rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 18rpx;
  background: var(--app-panel);
}

.file-copy {
  min-width: 0;
  flex: 1;
  text-align: left;
}

@media (max-width: 760px) {
  .import-page {
    padding-left: 24rpx;
    padding-right: 24rpx;
  }

  .top-zone {
    margin-left: -24rpx;
    margin-right: -24rpx;
    padding-left: 24rpx;
    padding-right: 24rpx;
  }

  .utility-grid,
  .import-methods,
  .quick-actions {
    grid-template-columns: 1fr;
  }

  .source-list {
    height: 500rpx;
  }

  .source-row {
    align-items: flex-start;
  }

  .status-switch {
    min-width: 68rpx;
  }
}
</style>
