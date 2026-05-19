<template>
  <view class="reader-page" :style="pageStyle">
    <view
      class="reading-surface"
      :style="readerSurfaceStyle"
      @tap="handleReaderTap"
      @touchstart="onTouchStart"
      @touchend="onTouchEnd"
    >
      <view class="page-head">
        <text class="book-name">{{ book.title }}</text>
        <text class="page-count">{{ pageIndex + 1 }}/{{ pages.length }}</text>
      </view>

      <view class="chapter-kicker">{{ sourceLabel }} · {{ chapterIndex + 1 }}/{{ totalChapters }}</view>
      <view class="chapter-title">{{ chapter.title || `第 ${chapterIndex + 1} 章` }}</view>

      <view class="loading-card" v-if="loadingChapter">
        <view class="loading-dot"></view>
        <text>{{ loadingText }}</text>
      </view>

      <view class="error-card" v-if="chapterLoadError">
        <view>
          <view class="error-title">章节解码失败</view>
          <text class="error-desc">{{ chapterLoadError }}</text>
        </view>
        <button class="retry-button" @tap.stop="retryChapter">重试</button>
      </view>

      <text
        class="reader-content"
        :class="{ quiet: loadingChapter }"
        :style="{ fontSize: prefs.fontSize + 'px', lineHeight: lineHeight + 'px' }"
      >
        {{ pageContent }}
      </text>

      <view class="page-foot">
        <view class="foot-line">
          <view class="foot-progress" :style="{ width: pageProgressPercent + '%' }"></view>
        </view>
        <text>{{ progressPercent }}%</text>
      </view>
    </view>

    <view class="top-chrome" v-if="controlsVisible">
      <button class="icon-button" @tap.stop="back">‹</button>
      <view class="top-title">
        <view>{{ book.title }}</view>
        <text>{{ chapter.title || `第 ${chapterIndex + 1} 章` }}</text>
      </view>
      <button class="icon-button" @tap.stop="toggleMore">•••</button>
    </view>

    <view class="more-menu" v-if="moreVisible">
      <button class="more-item" @tap.stop="aiSummarizeChapter">AI 总结本章</button>
      <button class="more-item" @tap.stop="aiAskChapter">AI 问答本章</button>
      <button class="more-item" @tap.stop="copyProgress">复制进度</button>
      <button class="more-item" @tap.stop="retryChapter">重新解码本章</button>
      <button class="more-item" @tap.stop="showCacheState">缓存状态</button>
      <button class="more-item" @tap.stop="back">回到书架</button>
    </view>

    <view class="bottom-chrome" v-if="controlsVisible && !settingsVisible && !catalogVisible">
      <view class="chapter-row">
        <button class="chapter-button" @tap.stop="prevChapter">上一章</button>
        <view class="chapter-track" @tap.stop>
          <view class="chapter-track-fill" :style="{ width: progressPercent + '%' }"></view>
        </view>
        <button class="chapter-button" @tap.stop="nextChapter">下一章</button>
      </view>
      <view class="dock-actions">
        <button class="dock-tool" @tap.stop="openCatalog">
          <text class="dock-icon">☰</text>
          <text>目录</text>
        </button>
        <button class="dock-tool" @tap.stop="adjustBrightness">
          <text class="dock-icon">◐</text>
          <text>亮度</text>
        </button>
        <button class="dock-tool" @tap.stop="openSettings">
          <text class="dock-icon">Aa</text>
          <text>字号</text>
        </button>
        <button class="dock-tool" @tap.stop="cycleTheme">
          <text class="dock-icon">◒</text>
          <text>主题</text>
        </button>
      </view>
    </view>

    <view class="settings-panel" v-if="settingsVisible">
      <view class="panel-head">
        <view>
          <view class="panel-title">阅读设置</view>
          <text class="panel-desc">字号 {{ prefs.fontSize }} · 行高 {{ lineHeight }} · 亮度 {{ prefs.brightness }}%</text>
        </view>
        <button class="close-button" @tap.stop="closeSettings">×</button>
      </view>

      <view class="font-row">
        <button class="step-button" @tap.stop="changeFont(-1)">A-</button>
        <view class="font-meter">
          <view class="font-meter-fill" :style="{ width: fontPercent + '%' }"></view>
        </view>
        <button class="step-button" @tap.stop="changeFont(1)">A+</button>
      </view>

      <view class="theme-row">
        <button
          class="theme-chip"
          v-for="item in visibleThemes"
          :key="item.id"
          :class="{ active: prefs.theme === item.id }"
          :style="{ background: item.background, color: item.text }"
          @tap.stop="setTheme(item.id)"
        >
          {{ item.name }}
        </button>
      </view>

      <view class="brightness-row">
        <text>亮度</text>
        <slider
          class="brightness-slider"
          :value="prefs.brightness"
          min="40"
          max="100"
          activeColor="#d85a3a"
          backgroundColor="rgba(255,255,255,0.16)"
          block-color="#f4f0e8"
          block-size="20"
          @change="changeBrightness"
        />
      </view>
    </view>

    <view class="catalog-mask" v-if="catalogVisible" @tap.stop="closeCatalog">
      <view class="catalog-panel" @tap.stop>
        <view class="panel-head">
          <view>
            <view class="panel-title">目录</view>
            <text class="panel-desc">{{ sourceLabel }} · {{ totalChapters }} 章 · 当前 {{ chapterIndex + 1 }}</text>
          </view>
          <button class="close-button" @tap.stop="closeCatalog">×</button>
        </view>

        <scroll-view class="catalog-list" scroll-y :scroll-into-view="activeChapterId" :show-scrollbar="false">
          <view
            class="catalog-item"
            v-for="(item, index) in book.chapters"
            :key="index"
            :id="`chapter-${index}`"
            :class="{ active: index === chapterIndex }"
            @tap.stop="jumpToChapter(index)"
          >
            <text class="catalog-index">{{ index + 1 }}</text>
            <view class="catalog-copy">
              <text class="catalog-title">{{ item.title || `第 ${index + 1} 章` }}</text>
              <text class="catalog-state">{{ item.isCached || item.content ? '已缓存' : book.source === 'online' ? '待解码' : '本地' }}</text>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <view class="brightness-mask" :style="{ opacity: brightnessOpacity }"></view>
  </view>
</template>

<script>
import { getBook } from '../../common/books.js'
import { addOnlineBookToShelf, loadOnlineChapter } from '../../common/bookSources.js'
import { getPrefs, getProgress, getTheme, savePrefs, saveProgress, splitChapter, themes } from '../../common/reader.js'
import { getAppThemeId, getAppThemeStyle } from '../../common/appTheme.js'
import apiClient from '../../common/apiClient.js'
import {
  backendBookId,
  backendChapterId,
  isBackendBookId,
  loadBackendBook,
  loadBackendReadingHistory,
  loadBackendSourceContent,
  saveBackendReadingHistory
} from '../../common/backendLibrary.js'
import { friendlyErrorMessage } from '../../common/uiFeedback.js'

export default {
  data() {
    return {
      bookId: '',
      book: { title: '', chapters: [] },
      chapterIndex: 0,
      pageIndex: 0,
      pages: [''],
      prefs: getPrefs(),
      themes,
      controlsVisible: false,
      settingsVisible: false,
      catalogVisible: false,
      moreVisible: false,
      loadingChapter: false,
      chapterLoadError: '',
      loadingText: '正在解码章节...',
      chapterLoadToken: 0,
      chromeTimer: null,
      touchStartX: 0,
      touchStartY: 0,
      appThemeId: getAppThemeId()
    }
  },
  computed: {
    chapter() {
      return this.book.chapters[this.chapterIndex] || { title: '', content: '' }
    },
    totalChapters() {
      return Math.max((this.book.chapters || []).length, 1)
    },
    progressPercent() {
      return Math.min(100, Math.max(1, Math.round(((this.chapterIndex + 1) / this.totalChapters) * 100)))
    },
    pageProgressPercent() {
      const total = Math.max(this.pages.length, 1)
      return Math.min(100, Math.max(4, Math.round(((this.pageIndex + 1) / total) * 100)))
    },
    activeChapterId() {
      return `chapter-${Math.max(0, this.chapterIndex - 2)}`
    },
    pageContent() {
      return this.pages[this.pageIndex] || ''
    },
    activeTheme() {
      return getTheme(this.prefs.theme)
    },
    pageStyle() {
      const appVars = getAppThemeStyle(this.appThemeId)
      return {
        ...appVars,
        background: appVars['--app-stage'],
        color: appVars['--app-text']
      }
    },
    readerSurfaceStyle() {
      return {
        background: this.activeTheme.background,
        color: this.activeTheme.text
      }
    },
    lineHeight() {
      return Math.round(this.prefs.fontSize * 1.86)
    },
    brightnessOpacity() {
      return Math.max(0, Math.min(0.42, (100 - this.prefs.brightness) / 140))
    },
    visibleThemes() {
      return this.themes
    },
    fontPercent() {
      return Math.round(((this.prefs.fontSize - 16) / 14) * 100)
    },
    sourceLabel() {
      if (this.book.source === 'backend') return this.book.sourceName || '云端书架'
      if (this.book.source === 'online') return this.book.sourceName || '在线书源'
      if (this.book.source === 'local') return '本地 TXT'
      return '内置示例'
    }
  },
  onLoad(options) {
    this.appThemeId = getAppThemeId()
    this.bookId = options.bookId || 'wind-city'
    this.prefs.readingMode = 'page'
    savePrefs(this.prefs)
    this.loadInitialBook(options)
  },
  onShow() {
    this.appThemeId = getAppThemeId()
  },
  methods: {
    async loadInitialBook(options) {
      try {
        if (isBackendBookId(this.bookId)) {
          this.book = await loadBackendBook(this.bookId)
          const backendProgress = await loadBackendReadingHistory(this.bookId)
          const fallbackProgress = getProgress(this.bookId)
          this.chapterIndex = Number(options.chapterIndex !== undefined ? options.chapterIndex : (backendProgress && backendProgress.chapter_index !== undefined ? backendProgress.chapter_index : fallbackProgress.chapterIndex)) || 0
          this.pageIndex = Number(options.pageIndex !== undefined ? options.pageIndex : (backendProgress && backendProgress.page_index !== undefined ? backendProgress.page_index : fallbackProgress.pageIndex)) || 0
        } else {
          this.book = getBook(this.bookId)
          const progress = getProgress(this.bookId)
          this.chapterIndex = Number(options.chapterIndex !== undefined ? options.chapterIndex : progress.chapterIndex) || 0
          this.pageIndex = Number(options.pageIndex !== undefined ? options.pageIndex : progress.pageIndex) || 0
        }
      } catch (error) {
        this.book = getBook('wind-city')
        this.chapterIndex = 0
        this.pageIndex = 0
        uni.showToast({ title: friendlyErrorMessage(error, '云端书籍加载失败'), icon: 'none' })
      }
      this.rebuildPages()
    },
    async rebuildPages() {
      const token = Date.now()
      this.chapterLoadToken = token
      const currentChapter = this.chapter
      this.chapterLoadError = ''

      if (this.book.source === 'online' && currentChapter && !currentChapter.content) {
        this.loadingChapter = true
        this.loadingText = currentChapter.isCached ? '正在读取缓存...' : '正在解码章节...'
        this.pages = ['请稍候，正在为你解析这一章。']
        try {
          const loaded = await loadOnlineChapter(this.book, currentChapter)
          if (this.chapterLoadToken !== token) return
          this.book.chapters.splice(this.chapterIndex, 1, loaded)
          addOnlineBookToShelf(this.book)
          this.pages = splitChapter(loaded.content, this.prefs.fontSize)
          this.loadingChapter = false
        } catch (error) {
          if (this.chapterLoadToken !== token) return
          this.loadingChapter = false
          this.chapterLoadError = friendlyErrorMessage(error, '请稍后重试，或换一个可用书源。')
          this.pages = ['这一章暂时没有解码成功。你可以轻点重试，或者回到目录换一章。']
        }
        this.pageIndex = Math.max(0, Math.min(this.pageIndex, this.pages.length - 1))
        this.persist()
        return
      }

      if (this.book.source === 'backend' && currentChapter && !currentChapter.content) {
        this.loadingChapter = true
        this.loadingText = '正在从后端解析章节...'
        this.pages = ['请稍候，正在从后端书源解析这一章。']
        try {
          const content = await loadBackendSourceContent(this.book, currentChapter)
          if (this.chapterLoadToken !== token) return
          this.book.chapters.splice(this.chapterIndex, 1, {
            ...currentChapter,
            content,
            isCached: !!content
          })
          this.pages = splitChapter(content, this.prefs.fontSize)
          this.loadingChapter = false
        } catch (error) {
          if (this.chapterLoadToken !== token) return
          this.loadingChapter = false
          this.chapterLoadError = friendlyErrorMessage(error, '后端章节解析失败')
          this.pages = ['这一章暂时没有解析成功。你可以重试，或回到目录换一章。']
        }
        this.pageIndex = Math.max(0, Math.min(this.pageIndex, this.pages.length - 1))
        this.persist()
        return
      }

      this.loadingChapter = false
      this.chapterLoadError = ''
      this.pages = splitChapter(currentChapter.content, this.prefs.fontSize)
      this.pageIndex = Math.max(0, Math.min(this.pageIndex, this.pages.length - 1))
      this.persist()
    },
    persist() {
      saveProgress(this.bookId, {
        chapterIndex: this.chapterIndex,
        pageIndex: this.pageIndex,
        scrollTop: 0
      })
      if (this.book.source === 'backend') {
        saveBackendReadingHistory({
          book: this.book,
          chapter: this.chapter,
          chapterIndex: this.chapterIndex,
          pageIndex: this.pageIndex,
          progressPercent: this.progressPercent
        }).catch(() => {})
      }
    },
    onTouchStart(event) {
      const touch = event.changedTouches[0]
      this.touchStartX = touch.clientX
      this.touchStartY = touch.clientY
    },
    onTouchEnd(event) {
      const touch = event.changedTouches[0]
      const deltaX = touch.clientX - this.touchStartX
      const deltaY = touch.clientY - this.touchStartY
      if (Math.abs(deltaX) < 54 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return
      if (deltaX < 0) this.nextPage()
      else this.prevPage()
    },
    handleReaderTap(event) {
      const width = this.getTapWidth()
      const x = event.detail && Number(event.detail.x)
      if (!Number.isFinite(x)) {
        this.toggleReaderChrome()
        return
      }
      if (x < width * 0.30) {
        this.prevPage()
        return
      }
      if (x > width * 0.70) {
        this.nextPage()
        return
      }
      this.toggleReaderChrome()
    },
    getTapWidth() {
      try {
        return uni.getSystemInfoSync().windowWidth || 375
      } catch (error) {
        return 375
      }
    },
    nextPage() {
      if (this.loadingChapter) return
      if (this.pageIndex < this.pages.length - 1) {
        this.pageIndex += 1
        this.persist()
        return
      }
      this.nextChapter()
    },
    prevPage() {
      if (this.loadingChapter) return
      if (this.pageIndex > 0) {
        this.pageIndex -= 1
        this.persist()
        return
      }
      this.prevChapter(true)
    },
    nextChapter() {
      if (this.chapterIndex < this.book.chapters.length - 1) {
        this.chapterIndex += 1
        this.pageIndex = 0
        this.hideReaderChrome()
        this.rebuildPages()
      } else {
        uni.showToast({ title: '已经读完', icon: 'none' })
      }
    },
    prevChapter(toLastPage) {
      if (this.chapterIndex > 0) {
        this.chapterIndex -= 1
        this.rebuildPages().then(() => {
          if (toLastPage) this.pageIndex = this.pages.length - 1
          this.persist()
        })
        this.hideReaderChrome()
      } else {
        uni.showToast({ title: '已经是开头', icon: 'none' })
      }
    },
    toggleReaderChrome() {
      if (this.controlsVisible && !this.settingsVisible && !this.catalogVisible && !this.moreVisible) {
        this.hideReaderChrome()
        return
      }
      this.controlsVisible = true
      this.settingsVisible = false
      this.catalogVisible = false
      this.moreVisible = false
      this.scheduleChromeAutoHide()
    },
    hideReaderChrome() {
      this.clearChromeTimer()
      this.controlsVisible = false
      this.settingsVisible = false
      this.catalogVisible = false
      this.moreVisible = false
    },
    openCatalog() {
      this.catalogVisible = true
      this.settingsVisible = false
      this.moreVisible = false
      this.controlsVisible = true
      this.clearChromeTimer()
    },
    closeCatalog() {
      this.catalogVisible = false
      this.scheduleChromeAutoHide()
    },
    toggleSettings() {
      this.settingsVisible = !this.settingsVisible
      this.catalogVisible = false
      this.moreVisible = false
      this.controlsVisible = true
      this.clearChromeTimer()
    },
    openSettings() {
      this.settingsVisible = true
      this.catalogVisible = false
      this.moreVisible = false
      this.controlsVisible = true
      this.clearChromeTimer()
    },
    closeSettings() {
      this.settingsVisible = false
      this.scheduleChromeAutoHide()
    },
    changeFont(delta) {
      this.prefs.fontSize = Math.max(16, Math.min(30, this.prefs.fontSize + delta))
      savePrefs(this.prefs)
      this.rebuildPages()
    },
    setTheme(themeId) {
      this.prefs.theme = themeId
      savePrefs(this.prefs)
      this.rebuildPages()
    },
    cycleTheme() {
      const index = this.themes.findIndex(theme => theme.id === this.prefs.theme)
      const next = this.themes[(index + 1 + this.themes.length) % this.themes.length]
      this.setTheme(next.id)
      uni.showToast({ title: next.name, icon: 'none' })
      this.scheduleChromeAutoHide()
    },
    adjustBrightness() {
      const next = this.prefs.brightness <= 55 ? 86 : this.prefs.brightness <= 86 ? 100 : 52
      this.prefs.brightness = next
      savePrefs(this.prefs)
      uni.showToast({ title: `亮度 ${next}%`, icon: 'none' })
      this.scheduleChromeAutoHide()
    },
    changeBrightness(event) {
      this.prefs.brightness = event.detail.value
      savePrefs(this.prefs)
    },
    copyProgress() {
      const text = `${this.book.title} · ${this.chapter.title || `第 ${this.chapterIndex + 1} 章`}`
      uni.setClipboardData({
        data: text,
        success: () => uni.showToast({ title: '进度已复制', icon: 'none' })
      })
      this.moreVisible = false
      this.scheduleChromeAutoHide()
    },
    jumpToChapter(index) {
      this.chapterIndex = Math.max(0, Math.min(index, this.totalChapters - 1))
      this.pageIndex = 0
      this.catalogVisible = false
      this.hideReaderChrome()
      this.rebuildPages()
    },
    retryChapter() {
      this.chapterLoadError = ''
      if (this.book.source === 'online' && this.book.chapters[this.chapterIndex]) {
        this.book.chapters[this.chapterIndex] = {
          ...this.book.chapters[this.chapterIndex],
          content: ''
        }
      }
      if (this.book.source === 'backend' && this.book.chapters[this.chapterIndex]) {
        this.book.chapters[this.chapterIndex] = {
          ...this.book.chapters[this.chapterIndex],
          content: ''
        }
      }
      this.moreVisible = false
      this.rebuildPages()
    },
    getCurrentChapterText() {
      return (this.chapter && this.chapter.content) || this.pageContent || ''
    },
    ensureBackendReady() {
      if (!apiClient.getToken()) {
        uni.showModal({
          title: '需要后端登录',
          content: '请先到“我的”页面登录 FastAPI 后端。',
          showCancel: false
        })
        return false
      }
      return true
    },
    async aiSummarizeChapter() {
      if (!this.ensureBackendReady()) return
      const chapterText = this.getCurrentChapterText()
      if (!chapterText.trim()) {
        uni.showToast({ title: '当前章节没有正文', icon: 'none' })
        return
      }
      this.moreVisible = false
      uni.showLoading({ title: 'AI 总结中...' })
      try {
        const result = await apiClient.summarizeChapter({
          chapterText,
          bookId: backendBookId(this.book) || null,
          chapterId: backendChapterId(this.chapter) || null
        })
        const content = [
          result.summary,
          '',
          `人物：${(result.characters || []).join('、') || '无'}`,
          `关键点：${(result.key_points || []).join('；') || '无'}`
        ].join('\n')
        uni.showModal({
          title: 'AI 总结',
          content,
          showCancel: true,
          cancelText: '关闭',
          confirmText: '复制',
          success: modal => {
            if (modal.confirm) {
              uni.setClipboardData({ data: content })
            }
          }
        })
      } catch (error) {
        uni.showModal({ title: 'AI 总结失败', content: friendlyErrorMessage(error, '请检查后端服务'), showCancel: false })
      } finally {
        uni.hideLoading()
      }
    },
    aiAskChapter() {
      if (!this.ensureBackendReady()) return
      const chapterText = this.getCurrentChapterText()
      if (!chapterText.trim()) {
        uni.showToast({ title: '当前章节没有正文', icon: 'none' })
        return
      }
      const question = this.askAIQuestionText()
      if (!question) return
      this.sendAIQuestion(question, chapterText)
    },
    askAIQuestionText() {
      const fallback = '本章发生了什么？'
      if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
        const value = window.prompt('请输入你想问本章的问题', fallback)
        return String(value || '').trim()
      }
      uni.showToast({ title: `将使用默认问题：${fallback}`, icon: 'none' })
      return fallback
    },
    async sendAIQuestion(question, context) {
      this.moreVisible = false
      uni.showLoading({ title: 'AI 回答中...' })
      try {
        const result = await apiClient.chatWithAI({
          question,
          context,
          bookId: backendBookId(this.book) || null,
          chapterId: backendChapterId(this.chapter) || null
        })
        uni.showModal({
          title: 'AI 回答',
          content: result.answer,
          showCancel: true,
          cancelText: '关闭',
          confirmText: '复制',
          success: modal => {
            if (modal.confirm) {
              uni.setClipboardData({ data: result.answer })
            }
          }
        })
      } catch (error) {
        uni.showModal({ title: 'AI 问答失败', content: friendlyErrorMessage(error, '请检查后端服务'), showCancel: false })
      } finally {
        uni.hideLoading()
      }
    },
    toggleMore() {
      this.moreVisible = !this.moreVisible
      this.settingsVisible = false
      this.catalogVisible = false
      this.controlsVisible = true
      this.moreVisible ? this.clearChromeTimer() : this.scheduleChromeAutoHide()
    },
    showCacheState() {
      const state = this.book.source === 'online'
        ? (this.chapter.content ? '当前章已缓存' : '当前章尚未缓存')
        : '当前书籍为本地内容'
      uni.showToast({ title: state, icon: 'none' })
      this.moreVisible = false
      this.scheduleChromeAutoHide()
    },
    scheduleChromeAutoHide() {
      this.clearChromeTimer()
      this.chromeTimer = setTimeout(() => {
        if (!this.settingsVisible && !this.catalogVisible && !this.moreVisible) {
          this.controlsVisible = false
        }
      }, 4200)
    },
    clearChromeTimer() {
      if (this.chromeTimer) {
        clearTimeout(this.chromeTimer)
        this.chromeTimer = null
      }
    },
    back() {
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
.reader-page {
  position: relative;
  width: 100%;
  max-width: 1120px;
  height: 100vh;
  overflow: hidden;
  padding: 40rpx 42rpx 54rpx;
  margin: 0 auto;
  box-sizing: border-box;
  border-radius: 0 0 24rpx 24rpx;
  transition: background 0.2s ease, color 0.2s ease;
}

.reader-page button {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  line-height: 1;
}

.reader-page button::after {
  border: 0;
}

.reading-surface {
  position: relative;
  z-index: 2;
  height: 100%;
  max-width: 920px;
  margin: 0 auto;
  padding: 116rpx 0 124rpx;
  overflow: hidden;
  border: 1rpx solid var(--app-shell-border);
  border-radius: 24rpx;
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.12), var(--app-shadow);
}

.page-head,
.page-foot,
.top-chrome,
.chapter-row,
.dock-actions,
.panel-head,
.font-row,
.brightness-row,
.catalog-item {
  display: flex;
  align-items: center;
}

.page-head,
.page-foot,
.top-chrome,
.panel-head,
.brightness-row {
  justify-content: space-between;
}

.page-head {
  min-height: 42rpx;
  color: rgba(244, 240, 232, 0.44);
  font-size: 22rpx;
}

.book-name {
  overflow: hidden;
  max-width: 70%;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chapter-kicker {
  margin-top: 46rpx;
  color: rgba(216, 90, 58, 0.86);
  font-size: 22rpx;
  letter-spacing: 0;
}

.chapter-title {
  margin-top: 14rpx;
  margin-bottom: 34rpx;
  color: inherit;
  font-family: "KaiTi", "STKaiti", "FZKai-Z03", "PingFang SC", serif;
  font-size: 42rpx;
  font-weight: 700;
  line-height: 54rpx;
}

.reader-content {
  display: block;
  max-height: calc(100vh - 420rpx);
  overflow: hidden;
  white-space: pre-wrap;
  text-align: justify;
  letter-spacing: 0;
}

.reader-content.quiet {
  color: rgba(244, 240, 232, 0.50);
}

.loading-card {
  display: flex;
  align-items: center;
  gap: 14rpx;
  min-height: 76rpx;
  padding: 0 22rpx;
  margin-bottom: 24rpx;
  border-radius: 18rpx;
  color: rgba(244, 240, 232, 0.78);
  font-size: 24rpx;
  background: rgba(255, 255, 255, 0.08);
}

.error-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 22rpx;
  margin-bottom: 24rpx;
  border: 1rpx solid rgba(216, 90, 58, 0.24);
  border-radius: 20rpx;
  background: rgba(216, 90, 58, 0.10);
}

.error-title {
  color: #f4f0e8;
  font-size: 27rpx;
  font-weight: 800;
}

.error-desc {
  display: block;
  margin-top: 8rpx;
  color: rgba(244, 240, 232, 0.64);
  font-size: 23rpx;
  line-height: 34rpx;
}

.retry-button {
  flex-shrink: 0;
  width: 96rpx;
  height: 56rpx;
  border-radius: 999rpx;
  color: #ffffff;
  font-size: 24rpx;
  background: #d85a3a;
}

.loading-dot {
  width: 18rpx;
  height: 18rpx;
  border-radius: 999rpx;
  background: #d85a3a;
  animation: pulse 1.2s ease-in-out infinite;
}

.page-foot {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  gap: 18rpx;
  color: rgba(244, 240, 232, 0.42);
  font-size: 21rpx;
}

.foot-line {
  position: relative;
  flex: 1;
  height: 4rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: rgba(244, 240, 232, 0.12);
}

.foot-progress {
  height: 100%;
  border-radius: 999rpx;
  background: #d85a3a;
}

.top-chrome {
  position: fixed;
  left: 50%;
  right: auto;
  top: 0;
  z-index: 8;
  box-sizing: border-box;
  width: min(100vw, 920px);
  max-width: 920px;
  min-height: 116rpx;
  padding: 42rpx 28rpx 14rpx;
  transform: translateX(-50%);
  color: #f4f0e8;
  background: rgba(32, 33, 31, 0.94);
  backdrop-filter: blur(10px);
}

.icon-button,
.close-button {
  width: 66rpx;
  height: 66rpx;
  border-radius: 999rpx;
  color: #f4f0e8;
  font-size: 40rpx;
  background: rgba(255, 255, 255, 0.08);
}

.top-title {
  min-width: 0;
  flex: 1;
  margin: 0 18rpx;
  text-align: center;
}

.top-title view {
  overflow: hidden;
  font-size: 27rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top-title text {
  display: block;
  overflow: hidden;
  margin-top: 4rpx;
  color: #a9aaa4;
  font-size: 21rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.more-menu {
  position: fixed;
  top: 124rpx;
  right: max(24rpx, calc((100vw - 1120px) / 2 + 24rpx));
  z-index: 10;
  width: 268rpx;
  padding: 10rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.06);
  border-radius: 20rpx;
  background: rgba(47, 48, 45, 0.96);
  box-shadow: 0 18rpx 44rpx rgba(0, 0, 0, 0.30), inset 0 1rpx 0 rgba(255, 255, 255, 0.04);
}

.more-item {
  width: 100%;
  height: 62rpx;
  justify-content: flex-start !important;
  padding: 0 18rpx !important;
  border-radius: 14rpx;
  color: #f4f0e8;
  font-size: 24rpx;
  background: transparent;
}

.more-item:active {
  background: rgba(255, 255, 255, 0.08);
}

.bottom-chrome,
.settings-panel,
.catalog-panel {
  position: fixed;
  left: 50%;
  right: auto;
  bottom: 24rpx;
  z-index: 8;
  box-sizing: border-box;
  width: min(94vw, 876px);
  max-width: 876px;
  padding: 24rpx;
  transform: translateX(-50%);
  border: 1rpx solid rgba(255, 255, 255, 0.06);
  border-radius: 26rpx;
  color: #f4f0e8;
  background: rgba(47, 48, 45, 0.94);
  box-shadow: 0 -18rpx 54rpx rgba(0, 0, 0, 0.34), inset 0 1rpx 0 rgba(255, 255, 255, 0.04);
}

.chapter-row {
  display: grid;
  grid-template-columns: 112rpx 1fr 112rpx;
  gap: 22rpx;
}

.chapter-button {
  height: 56rpx;
  border-radius: 14rpx;
  color: #d7d1c7;
  font-size: 23rpx;
  background: rgba(255, 255, 255, 0.06);
}

.chapter-track {
  height: 56rpx;
  overflow: hidden;
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.08);
}

.chapter-track-fill {
  height: 100%;
  border-radius: 18rpx;
  background: rgba(216, 90, 58, 0.42);
}

.dock-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10rpx;
  margin-top: 22rpx;
}

.dock-tool {
  min-height: 86rpx;
  flex-direction: column;
  border-radius: 16rpx;
  color: #d7d1c7;
  font-size: 21rpx;
  background: rgba(255, 255, 255, 0.05);
}

.dock-icon {
  margin-bottom: 8rpx;
  color: #f4f0e8;
  font-size: 30rpx;
  font-weight: 800;
}

.settings-panel {
  bottom: 0;
  left: 50%;
  right: auto;
  width: min(100vw, 920px);
  max-width: 920px;
  padding: 28rpx 28rpx 36rpx;
  transform: translateX(-50%);
  border-radius: 28rpx 28rpx 0 0;
}

.panel-title {
  color: #f4f0e8;
  font-family: "KaiTi", "STKaiti", "FZKai-Z03", "PingFang SC", serif;
  font-size: 34rpx;
  font-weight: 700;
}

.panel-desc {
  display: block;
  margin-top: 6rpx;
  color: #a9aaa4;
  font-size: 22rpx;
}

.font-row {
  gap: 16rpx;
  margin-top: 24rpx;
}

.step-button {
  width: 84rpx;
  height: 62rpx;
  border-radius: 16rpx;
  color: #f4f0e8;
  font-size: 24rpx;
  background: rgba(255, 255, 255, 0.08);
}

.font-meter {
  flex: 1;
  height: 14rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.12);
}

.font-meter-fill {
  height: 100%;
  border-radius: 999rpx;
  background: #d85a3a;
}

.theme-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12rpx;
  margin-top: 24rpx;
}

.theme-chip {
  height: 64rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.12);
  border-radius: 16rpx;
  font-size: 22rpx;
}

.theme-chip.active {
  border-color: #d85a3a;
}

.brightness-row {
  gap: 18rpx;
  margin-top: 24rpx;
  color: #d7d1c7;
  font-size: 24rpx;
}

.brightness-slider {
  flex: 1;
}

.catalog-mask {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 50%;
  z-index: 9;
  display: flex;
  align-items: flex-end;
  width: min(100vw, 1120px);
  padding: 24rpx;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.58);
}

.catalog-panel {
  position: relative;
  width: 100%;
  max-height: 78vh;
  bottom: auto;
  left: auto;
  right: auto;
  transform: none;
}

.catalog-list {
  height: 56vh;
  margin-top: 22rpx;
}

.catalog-item {
  min-height: 86rpx;
  padding: 0 18rpx;
  margin-bottom: 10rpx;
  border-radius: 18rpx;
  color: #d7d1c7;
  background: rgba(255, 255, 255, 0.06);
}

.catalog-item.active {
  color: #ffffff;
  background: rgba(216, 90, 58, 0.28);
}

.catalog-index {
  flex-shrink: 0;
  width: 58rpx;
  color: #d85a3a;
  font-size: 24rpx;
  font-weight: 900;
}

.catalog-copy {
  min-width: 0;
  flex: 1;
}

.catalog-title,
.catalog-state {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.catalog-title {
  color: inherit;
  font-size: 27rpx;
}

.catalog-state {
  margin-top: 6rpx;
  color: #a9aaa4;
  font-size: 21rpx;
}

.brightness-mask {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 50%;
  width: min(100vw, 1120px);
  transform: translateX(-50%);
  z-index: 1;
  pointer-events: none;
  background: #000000;
}

/* Global app theme polish for reader chrome */
.reader-page {
  box-shadow: 0 24rpx 80rpx rgba(42, 62, 57, 0.18);
}

.chapter-kicker,
.catalog-index {
  color: var(--app-accent-3);
}

.foot-progress,
.font-meter-fill {
  background: var(--app-accent-3);
}

.top-chrome,
.bottom-chrome,
.settings-panel,
.catalog-panel,
.more-menu {
  border-color: var(--app-border);
  color: var(--app-reader-control-text);
  background: var(--app-reader-control);
  box-shadow: var(--app-floating-shadow);
}

.icon-button,
.close-button,
.chapter-button,
.dock-tool,
.step-button,
.more-item,
.catalog-item {
  color: var(--app-text);
  background: var(--app-panel);
}

.top-title text,
.panel-desc,
.catalog-state {
  color: var(--app-muted);
}

.panel-title,
.dock-icon,
.catalog-title,
.error-title {
  color: var(--app-text);
}

.theme-chip.active {
  border-color: var(--app-accent-3);
}

.retry-button {
  color: var(--app-on-accent);
  background: var(--app-accent-3);
}

.catalog-item.active {
  color: var(--app-on-accent);
  background: var(--app-accent);
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.35;
    transform: scale(0.82);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
