<template>
  <view class="import-page app-page" :style="themeVars">
    <view class="top-zone">
      <view>
        <text class="eyebrow">IMPORT</text>
        <view class="title">导入</view>
      </view>
      <button class="top-button" @tap="goSearch">⌕</button>
    </view>

    <view class="entry-grid">
      <view class="entry-card" @tap="openSourcePanel">
        <text class="entry-icon">源</text>
        <view class="entry-copy">
          <view class="entry-title">书源管理</view>
          <text class="entry-desc">粘贴、URL、剪贴板、扫码、本地 JSON 和源仓库页导入</text>
        </view>
        <text class="entry-arrow">›</text>
      </view>

      <view class="entry-card" @tap="scanSourceQr">
        <text class="entry-icon">▣</text>
        <view class="entry-copy">
          <view class="entry-title">扫码导入</view>
          <text class="entry-desc">真机扫描二维码导入书源 URL 或 JSON</text>
        </view>
        <text class="entry-arrow">›</text>
      </view>

      <view class="entry-card" @tap="openTxtPanel">
        <text class="entry-icon">TXT</text>
        <view class="entry-copy">
          <view class="entry-title">TXT 目录规则</view>
          <text class="entry-desc">导入本地小说并按章节解码</text>
        </view>
        <text class="entry-arrow">›</text>
      </view>

      <view class="entry-card" @tap="coming('替换净化稍后接入')">
        <text class="entry-icon">A→B</text>
        <view class="entry-copy">
          <view class="entry-title">替换净化</view>
          <text class="entry-desc">配置广告、乱码、空白净化规则</text>
        </view>
        <text class="entry-arrow">›</text>
      </view>

      <view class="entry-card" @tap="coming('字典规则稍后接入')">
        <text class="entry-icon">文</text>
        <view class="entry-copy">
          <view class="entry-title">字典规则</view>
          <text class="entry-desc">配置词典、翻译和名称规整</text>
        </view>
        <text class="entry-arrow">›</text>
      </view>

      <view class="entry-card" @tap="goProfile">
        <text class="entry-icon">⚙</text>
        <view class="entry-copy">
          <view class="entry-title">备份与恢复</view>
          <text class="entry-desc">导入旧版本数据或复制备份</text>
        </view>
        <text class="entry-arrow">›</text>
      </view>
    </view>

    <view class="source-panel app-floating-panel" v-if="sourceVisible">
      <view class="panel-head">
        <view>
          <text class="eyebrow">BOOK SOURCES</text>
          <view class="panel-title">书源管理</view>
        </view>
        <button class="close-button" @tap="closePanels">×</button>
      </view>

      <view class="mode-row import-mode-row">
        <button class="mode" :class="{ active: sourceImportMode === 'json' }" @tap="setImportMode('json')">粘贴导入</button>
        <button class="mode" :class="{ active: sourceImportMode === 'url' }" @tap="setImportMode('url')">URL 导入</button>
        <button class="mode" :class="{ active: sourceImportMode === 'repo' }" @tap="setImportMode('repo')">源仓库页</button>
      </view>

      <textarea
        v-if="sourceImportMode === 'json'"
        class="source-area"
        v-model="sourceImportText"
        placeholder="粘贴书源 JSON、yuedu:// 一键导入链接，或 https://...json"
      ></textarea>
      <input
        v-else
        class="field"
        v-model="sourceImportUrl"
        :placeholder="sourceImportMode === 'repo' ? '粘贴 yck2026/yckceo 源仓库详情页 URL' : '粘贴 JSON 直链或一键导入链接'"
      />
      <text class="source-hint">{{ sourceImportHint }}</text>
      <button class="submit-button" :loading="sourceImporting" @tap="submitSourceImport">导入书源</button>

      <view class="quick-import-grid">
        <button class="mode" @tap="importFromClipboard">剪贴板</button>
        <button class="mode" @tap="chooseSourceJsonFile">本地 JSON</button>
        <button class="mode" @tap="scanSourceQr">扫码</button>
        <button class="mode" @tap="setImportMode('repo')">源仓库页</button>
      </view>

      <view class="mode-row">
        <button class="mode" :loading="backendLoading" @tap="importBackendDemo">导入后端演示源</button>
        <button class="mode" :loading="backendLoading" @tap="refreshBackendSources">刷新后端源</button>
      </view>

      <view class="filter-row">
        <button class="filter-chip" :class="{ active: sourceFilter === 'all' }" @tap="sourceFilter = 'all'">全部</button>
        <button class="filter-chip" :class="{ active: sourceFilter === 'enabled' }" @tap="sourceFilter = 'enabled'">启用</button>
        <button class="filter-chip" :class="{ active: sourceFilter === 'disabled' }" @tap="sourceFilter = 'disabled'">停用</button>
        <button class="filter-chip" :class="{ active: sourceFilter === 'incompatible' }" @tap="sourceFilter = 'incompatible'">不兼容</button>
        <button class="filter-chip" :class="{ active: sourceFilter === 'cloud' }" @tap="sourceFilter = 'cloud'">云端</button>
      </view>

      <scroll-view class="source-list" scroll-y :show-scrollbar="false">
        <view class="source-item" v-for="source in visibleBackendSources" :key="source.id">
          <view class="source-main">
            <view class="source-name">{{ source.name }}</view>
            <text class="source-desc">后端 · {{ source.group }} · {{ source.compatibility }}</text>
          </view>
          <button class="source-toggle active">云端</button>
        </view>

        <view class="source-item" v-for="source in filteredSources" :key="source.id">
          <view class="source-main">
            <view class="source-name">{{ source.name }}</view>
            <text class="source-desc">{{ source.group }} · {{ source.compatibility }} · {{ source.importedAt ? '本地导入' : '内置' }}</text>
          </view>
          <button class="source-toggle" :class="{ active: source.enabled }" @tap="toggleSource(source)">
            {{ source.enabled ? '启用' : '停用' }}
          </button>
          <button class="source-delete" v-if="source.importedAt" @tap="removeSource(source)">×</button>
        </view>
      </scroll-view>
    </view>

    <view class="source-panel app-floating-panel" v-if="txtVisible">
      <view class="panel-head">
        <view>
          <text class="eyebrow">TXT IMPORT</text>
          <view class="panel-title">导入本地小说</view>
        </view>
        <button class="close-button" @tap="closePanels">×</button>
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
      sourceVisible: false,
      txtVisible: false,
      sourceImportMode: 'json',
      sourceImportText: '',
      sourceImportUrl: '',
      sourceImporting: false,
      sourceFilter: 'all',
      backendSources: [],
      backendLoading: false,
      themeId: getAppThemeId(),
      importTitle: '',
      importAuthor: '',
      importFileName: '',
      importFileText: ''
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
      if (this.sourceImportMode === 'json') return '支持 JSON、sources 包装结构、一键导入链接和 JSON URL。'
      if (this.sourceImportMode === 'repo') return '支持 yck2026/yckceo 的源仓库详情页或合集页，系统会自动提取 JSON。'
      return '支持直接 JSON 链接、yuedu://、legado:// 和包含 src= 的链接。'
    },
    filteredSources() {
      if (this.sourceFilter === 'cloud') return []
      return this.sources.filter(source => {
        if (this.sourceFilter === 'enabled') return source.enabled
        if (this.sourceFilter === 'disabled') return !source.enabled
        if (this.sourceFilter === 'incompatible') return !/^v1/.test(source.compatibility)
        return true
      })
    },
    visibleBackendSources() {
      return this.sourceFilter === 'all' || this.sourceFilter === 'cloud' ? this.backendSources : []
    }
  },
  onShow() {
    this.themeId = getAppThemeId()
    this.sources = getSourceConfigs()
  },
  methods: {
    setImportMode(mode) {
      this.sourceImportMode = mode
    },
    openSourcePanel() {
      this.sources = getSourceConfigs()
      this.sourceVisible = true
      this.txtVisible = false
      this.refreshBackendSources({ silent: true })
    },
    openTxtPanel() {
      this.txtVisible = true
      this.sourceVisible = false
    },
    closePanels() {
      this.sourceVisible = false
      this.txtVisible = false
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
      await this.importSourcePayload(raw)
      this.sourceImportText = ''
      this.sourceImportUrl = ''
    },
    async importSourcePayload(raw, successPrefix = '已导入') {
      this.sourceImporting = true
      try {
        const result = await importSourcesFromAny(raw)
        this.sources = getSourceConfigs()
        uni.showToast({
          title: `${successPrefix} ${result.imported} 新增 / ${result.updated} 覆盖 / ${result.incompatible} 不兼容`,
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
        uni.showToast({ title: '当前环境暂不支持文件选择，请用 H5 或真机测试', icon: 'none' })
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
          uni.showToast({ title: `后端书源 ${this.backendSources.length} 个`, icon: 'none' })
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
    },
    goProfile() {
      uni.switchTab({ url: '/pages/profile/profile' })
    },
    coming(text) {
      uni.showToast({ title: text, icon: 'none' })
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

.top-zone {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 116rpx;
  margin: -86rpx -40rpx 34rpx;
  padding: 86rpx 40rpx 28rpx;
  background: var(--app-top);
}

.eyebrow {
  color: var(--app-accent);
  font-size: 22rpx;
  font-weight: 800;
}

.title,
.panel-title {
  margin-top: 8rpx;
  color: var(--app-text);
  font-size: 42rpx;
  font-weight: 800;
  line-height: 52rpx;
}

.top-button,
.close-button,
.mode,
.submit-button,
.source-toggle,
.source-delete,
.filter-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  line-height: 1;
}

.top-button,
.close-button {
  width: 78rpx;
  height: 78rpx;
  border-radius: 999rpx;
  color: var(--app-text);
  font-size: 42rpx;
  background: var(--app-panel);
}

.entry-card {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 124rpx;
  padding: 18rpx 76rpx 18rpx 10rpx;
  margin-bottom: 20rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 18rpx;
  background: var(--app-panel);
}

.entry-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 92rpx;
  color: var(--app-accent);
  font-size: 34rpx;
  font-weight: 800;
}

.entry-copy {
  min-width: 0;
  flex: 1;
  margin-left: 10rpx;
}

.entry-title {
  color: var(--app-text);
  font-size: 32rpx;
  font-weight: 800;
  line-height: 42rpx;
}

.entry-desc,
.source-desc,
.source-hint,
.file-desc {
  display: block;
  margin-top: 8rpx;
  color: var(--app-muted);
  font-size: 24rpx;
  line-height: 34rpx;
}

.entry-arrow {
  position: absolute;
  right: 22rpx;
  color: var(--app-muted);
  font-size: 56rpx;
}

.source-panel {
  position: fixed;
  left: 50%;
  bottom: 124rpx;
  z-index: 20;
  width: min(calc(100vw - 48rpx), 1040px);
  max-height: 78vh;
  padding: 28rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 26rpx;
  background: var(--app-panel-strong);
  box-shadow: var(--app-floating-shadow);
  transform: translateX(-50%);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mode-row,
.quick-import-grid,
.filter-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12rpx;
  margin-top: 22rpx;
}

.import-mode-row {
  grid-template-columns: repeat(3, 1fr);
}

.quick-import-grid {
  grid-template-columns: repeat(4, 1fr);
}

.filter-row {
  grid-template-columns: repeat(5, 1fr);
}

.mode,
.filter-chip {
  height: 68rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 14rpx;
  color: var(--app-text);
  font-size: 24rpx;
  background: var(--app-panel);
}

.mode.active,
.submit-button,
.source-toggle.active,
.filter-chip.active {
  color: var(--app-on-accent);
  border-color: var(--app-accent);
  background: var(--app-accent);
}

.source-area,
.field {
  width: 100%;
  margin-top: 18rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 16rpx;
  box-sizing: border-box;
  color: var(--app-text);
  background: var(--app-panel);
  font-size: 25rpx;
}

.source-area {
  height: 150rpx;
  padding: 18rpx;
}

.field {
  height: 78rpx;
  padding: 0 22rpx;
}

.submit-button {
  width: 100%;
  height: 76rpx;
  margin-top: 18rpx;
  border-radius: 16rpx;
  font-size: 27rpx;
}

.source-list {
  height: 310rpx;
  margin-top: 18rpx;
}

.source-item {
  display: flex;
  align-items: center;
  gap: 14rpx;
  min-height: 86rpx;
  padding: 14rpx;
  margin-bottom: 12rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 16rpx;
  background: var(--app-panel);
}

.source-main {
  min-width: 0;
  flex: 1;
}

.source-name {
  overflow: hidden;
  color: var(--app-text);
  font-size: 28rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-toggle,
.source-delete {
  min-width: 70rpx;
  height: 48rpx;
  border-radius: 14rpx;
  color: var(--app-text);
  background: var(--app-bg);
  font-size: 22rpx;
}

.source-delete {
  width: 48rpx;
  min-width: 48rpx;
}

.file-picker {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 120rpx;
  margin-top: 24rpx;
  padding: 18rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 18rpx;
  background: var(--app-panel);
}

.file-icon {
  width: 84rpx;
  color: var(--app-accent);
  font-size: 34rpx;
  font-weight: 900;
}

.file-copy {
  min-width: 0;
  flex: 1;
  text-align: left;
}

.file-title {
  color: var(--app-text);
  font-size: 28rpx;
  font-weight: 800;
}

@media (max-width: 760px) {
  .source-panel {
    width: calc(100vw - 28rpx);
    bottom: 112rpx;
    padding: 22rpx;
  }

  .quick-import-grid,
  .filter-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
