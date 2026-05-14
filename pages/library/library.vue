<template>
  <view class="import-page">
    <view class="top-zone">
      <view>
        <text class="eyebrow">IMPORT</text>
        <view class="title">导入</view>
      </view>
      <button class="top-button" @tap="goSearch">⌕</button>
    </view>

    <view class="entry-grid">
      <view class="entry-card" @tap="openSourcePanel">
        <text class="entry-icon">▦</text>
        <view class="entry-copy">
          <view class="entry-title">书源管理</view>
          <text class="entry-desc">新建、导入、编辑或管理书源</text>
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
          <text class="entry-desc">导入本地文件并按章节解码</text>
        </view>
        <text class="entry-arrow">›</text>
      </view>
      <view class="entry-card" @tap="coming('替换净化稍后接入')">
        <text class="entry-icon">A↔B</text>
        <view class="entry-copy">
          <view class="entry-title">替换净化</view>
          <text class="entry-desc">配置广告、乱码、空白净化规则</text>
        </view>
        <text class="entry-arrow">›</text>
      </view>
      <view class="entry-card" @tap="coming('字典规则稍后接入')">
        <text class="entry-icon">文A</text>
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

    <view class="source-panel" v-if="sourceVisible">
      <view class="panel-head">
        <view>
          <text class="eyebrow">BOOK SOURCES</text>
          <view class="panel-title">书源管理</view>
        </view>
        <button class="close-button" @tap="closePanels">×</button>
      </view>

      <view class="mode-row">
        <button class="mode" :class="{ active: sourceImportMode === 'json' }" @tap="sourceImportMode = 'json'">粘贴 JSON</button>
        <button class="mode" :class="{ active: sourceImportMode === 'url' }" @tap="sourceImportMode = 'url'">导入 URL</button>
      </view>

      <textarea
        v-if="sourceImportMode === 'json'"
        class="source-area"
        v-model="sourceImportText"
        placeholder="粘贴书源 JSON；如果你粘的是 https://...json，我也会自动按 URL 导入"
      ></textarea>
      <input
        v-else
        class="field"
        v-model="sourceImportUrl"
        placeholder="粘贴 JSON 直链或 yckceo 书源页面 URL"
      />
      <button class="submit-button" @tap="submitSourceImport">导入书源</button>

      <scroll-view class="source-list" scroll-y :show-scrollbar="false">
        <view class="source-item" v-for="source in sources" :key="source.id">
          <view class="source-main">
            <view class="source-name">{{ source.name }}</view>
            <text class="source-desc">{{ source.group }} · {{ source.compatibility }}</text>
          </view>
          <button class="source-toggle" :class="{ active: source.enabled }" @tap="toggleSource(source)">
            {{ source.enabled ? '启用' : '停用' }}
          </button>
          <button class="source-delete" v-if="source.importedAt" @tap="removeSource(source)">×</button>
        </view>
      </scroll-view>
    </view>

    <view class="source-panel" v-if="txtVisible">
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
  importSourcesFromJson,
  importSourcesFromUrl,
  setSourceEnabled
} from '../../common/bookSources.js'

export default {
  data() {
    return {
      sources: [],
      sourceVisible: false,
      txtVisible: false,
      sourceImportMode: 'json',
      sourceImportText: '',
      sourceImportUrl: '',
      importTitle: '',
      importAuthor: '',
      importFileName: '',
      importFileText: ''
    }
  },
  computed: {
    importPreview() {
      const chapters = parseTxtChapters(this.importFileText)
      return {
        chapterCount: chapters.length,
        wordCount: String(this.importFileText || '').replace(/\s/g, '').length
      }
    }
  },
  onShow() {
    this.sources = getSourceConfigs()
  },
  methods: {
    openSourcePanel() {
      this.sources = getSourceConfigs()
      this.sourceVisible = true
      this.txtVisible = false
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
      try {
        const raw = String(this.sourceImportMode === 'json' ? this.sourceImportText : this.sourceImportUrl).trim()
        const count = /^https?:\/\//i.test(raw) ? await importSourcesFromUrl(raw) : importSourcesFromJson(raw)
        this.sourceImportText = ''
        this.sourceImportUrl = ''
        this.sources = getSourceConfigs()
        uni.showToast({ title: `已导入 ${count} 个书源`, icon: 'none' })
      } catch (error) {
        uni.showToast({ title: error.message || '导入书源失败', icon: 'none' })
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
        uni.showToast({ title: '浏览器预览不支持扫码，请用真机测试', icon: 'none' })
        return
      }
      uni.scanCode({
        onlyFromCamera: false,
        success: async result => {
          const raw = String(result.result || '').trim()
          if (!raw) {
            uni.showToast({ title: '二维码内容为空', icon: 'none' })
            return
          }
          try {
            const count = /^https?:\/\//i.test(raw) ? await importSourcesFromUrl(raw) : importSourcesFromJson(raw)
            this.sources = getSourceConfigs()
            uni.showToast({ title: `已扫码导入 ${count} 个书源`, icon: 'none' })
          } catch (error) {
            uni.showToast({ title: error.message || '扫码导入失败', icon: 'none' })
          }
        },
        fail: () => {
          uni.showToast({ title: '未完成扫码', icon: 'none' })
        }
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
            const text = await this.readTxtFile(file)
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
      return String((file && (file.name || file.path)) || '未命名.txt').split(/[\\/]/).pop()
    },
    readTxtFile(file) {
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
      return Promise.reject(new Error('当前环境无法读取 TXT'))
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
  color: rgba(255, 255, 255, 0.7);
  font-size: 22rpx;
  font-weight: 800;
}

.title,
.panel-title {
  margin-top: 8rpx;
  color: #ffffff;
  font-family: cursive;
  font-size: 48rpx;
  line-height: 58rpx;
}

.top-button,
.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 78rpx;
  height: 78rpx;
  padding: 0;
  border-radius: 999rpx;
  color: #ffffff;
  font-size: 44rpx;
  background: transparent;
}

.entry-card {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 124rpx;
  padding: 18rpx 76rpx 18rpx 10rpx;
  margin-bottom: 26rpx;
}

.entry-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 92rpx;
  color: #d44b2f;
  font-size: 38rpx;
}

.entry-copy {
  min-width: 0;
  flex: 1;
  margin-left: 10rpx;
}

.entry-title {
  color: #ffffff;
  font-family: cursive;
  font-size: 38rpx;
  line-height: 48rpx;
}

.entry-desc {
  display: block;
  margin-top: 10rpx;
  color: #a7a7a7;
  font-family: cursive;
  font-size: 27rpx;
  line-height: 38rpx;
}

.entry-arrow {
  position: absolute;
  right: 16rpx;
  color: #c8c8c8;
  font-size: 62rpx;
}

.source-panel {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: 124rpx;
  z-index: 20;
  max-height: 78vh;
  padding: 28rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  border-radius: 26rpx;
  background: #252525;
  box-shadow: 0 -20rpx 60rpx rgba(0, 0, 0, 0.36);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mode-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
  margin-top: 24rpx;
}

.mode,
.submit-button,
.source-toggle,
.source-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.mode {
  height: 68rpx;
  border-radius: 14rpx;
  color: #d2d2d2;
  font-size: 25rpx;
  background: #303030;
}

.mode.active,
.submit-button,
.source-toggle.active {
  color: #ffffff;
  background: #d44b2f;
}

.source-area,
.field {
  width: 100%;
  margin-top: 18rpx;
  border-radius: 14rpx;
  color: #ffffff;
  font-size: 25rpx;
  background: #181818;
}

.source-area {
  height: 180rpx;
  padding: 20rpx;
  line-height: 36rpx;
}

.field {
  height: 76rpx;
  padding: 0 20rpx;
  line-height: 76rpx;
}

.submit-button {
  width: 100%;
  height: 78rpx;
  margin-top: 18rpx;
  border-radius: 14rpx;
  font-size: 26rpx;
}

.submit-button[disabled] {
  color: #888888;
  background: #333333;
}

.source-list {
  height: 30vh;
  margin-top: 20rpx;
}

.source-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-height: 86rpx;
  padding: 14rpx;
  margin-bottom: 12rpx;
  border-radius: 14rpx;
  background: #303030;
}

.source-main,
.file-copy {
  min-width: 0;
  flex: 1;
}

.source-name,
.file-title {
  overflow: hidden;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-desc,
.file-desc {
  display: block;
  margin-top: 8rpx;
  color: #a8a8a8;
  font-size: 22rpx;
  line-height: 32rpx;
}

.source-toggle {
  width: 78rpx;
  height: 50rpx;
  border-radius: 12rpx;
  color: #b8b8b8;
  font-size: 22rpx;
  background: #1b1b1b;
}

.source-delete {
  width: 48rpx;
  height: 48rpx;
  border-radius: 999rpx;
  color: #ffffff;
  font-size: 28rpx;
  background: #4b2a24;
}

.file-picker {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 112rpx;
  padding: 18rpx;
  margin-top: 24rpx;
  border-radius: 16rpx;
  background: #303030;
}

.file-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 76rpx;
  height: 76rpx;
  border-radius: 18rpx;
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 900;
  background: #d44b2f;
}

/* Ink theme polish */
.import-page {
  background:
    radial-gradient(circle at 18% 0%, rgba(96, 117, 125, 0.20), transparent 28%),
    linear-gradient(180deg, #20211f 0%, #1b1c1a 100%);
}

.top-zone {
  background: linear-gradient(180deg, #667b83 0%, #586d75 100%);
  box-shadow: 0 10rpx 28rpx rgba(0, 0, 0, 0.20);
}

.title,
.panel-title,
.entry-title {
  font-family: "KaiTi", "STKaiti", "FZKai-Z03", "PingFang SC", cursive;
  font-weight: 700;
}

.entry-card,
.source-panel,
.source-item,
.file-picker,
.mode,
.source-area,
.field {
  border: 1rpx solid rgba(255, 255, 255, 0.05);
  background: rgba(47, 48, 45, 0.92);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.035);
}

.entry-icon,
.section-label,
.theme-dot {
  color: #d85a3a;
}

.mode.active,
.submit-button,
.source-toggle.active,
.file-icon {
  background: #d85a3a;
}

.entry-desc,
.source-desc,
.file-desc {
  color: #a9aaa4;
}
</style>
