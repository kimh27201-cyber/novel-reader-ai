<template>
  <view class="reader-page" :style="pageStyle">
    <view class="reader-embed" :class="{ immersive: prefs.immersiveMode }">
      <view
        class="reading-surface"
        :style="readerSurfaceStyle"
        @tap="handleReaderTap"
        @touchstart="onTouchStart"
        @touchend="onTouchEnd"
      >
        <view class="page-head" v-if="prefs.showChapterInfo">
          <text class="book-name">{{ book.title }}</text>
          <text class="page-count">{{ pageIndex + 1 }}/{{ pages.length }}</text>
        </view>

        <view class="chapter-meta" v-if="prefs.showChapterInfo">
          <text class="source-badge">{{ sourceLabel }}</text>
          <text class="source-badge">{{ chapterState({ index: chapterIndex }) }}</text>
          <text>{{ chapterIndex + 1 }}/{{ totalChapters }}</text>
        </view>
        <view class="chapter-title">{{ chapter.title || `第 ${chapterIndex + 1} 章` }}</view>

        <view class="loading-card" v-if="loadingChapter">
          <view class="loading-dot"></view>
          <text>{{ loadingText }}</text>
        </view>

        <view class="error-card" v-if="chapterLoadError">
          <view>
            <view class="error-title">章节解码失败</view>
            <text class="error-desc">{{ sourceLabel }} · {{ chapterLoadError }}</text>
          </view>
          <button class="retry-button" @tap.stop="retryChapter">重试</button>
        </view>

        <view
          class="reader-content"
          :class="{ quiet: loadingChapter }"
          :style="readerContentStyle"
        >
          <text
            class="reader-paragraph"
            v-for="(paragraph, index) in pageParagraphs"
            :key="index"
            :style="paragraphStyle"
          >
            {{ paragraph }}
          </text>
        </view>

        <view class="page-foot" v-if="prefs.showProgress">
          <view class="foot-line">
            <view class="foot-progress" :style="{ width: pageProgressPercent + '%' }"></view>
          </view>
          <text>{{ progressPercent }}%</text>
        </view>
      </view>

      <view class="top-chrome reader-safe-top" v-if="controlsVisible">
        <button class="icon-button touch-hit" @tap.stop="back">‹</button>
        <view class="top-title">
          <view>{{ book.title }}</view>
          <text>{{ chapter.title || `第 ${chapterIndex + 1} 章` }}</text>
        </view>
        <button class="icon-button touch-hit" @tap.stop="toggleMore">•••</button>
      </view>

      <view class="quick-actions" v-if="controlsVisible && !settingsVisible && !catalogVisible && !moreVisible">
        <button class="quick-action" @tap.stop="openCatalog">☰</button>
        <button class="quick-action" @tap.stop="searchInChapter">⌕</button>
        <button class="quick-action" @tap.stop="retryChapter">↻</button>
        <button class="quick-action" @tap.stop="adjustBrightness">◐</button>
      </view>

      <view class="more-menu" v-if="moreVisible">
        <button class="more-item" @tap.stop="aiSummarizeChapter">AI 总结本章</button>
        <button class="more-item" @tap.stop="aiAskChapter">AI 问答本章</button>
        <button class="more-item" @tap.stop="toggleCurrentBookmark">{{ currentBookmarkActive ? '取消书签' : '加入书签' }}</button>
        <button class="more-item" @tap.stop="copyProgress">复制进度</button>
        <button class="more-item" @tap.stop="retryChapter">重新解码本章</button>
        <button class="more-item" @tap.stop="showSourceInfo">来源信息</button>
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
          <button class="dock-tool" @tap.stop="toggleReadAloud">
            <text class="dock-icon">◉</text>
            <text>{{ speaking ? '停止' : '听读' }}</text>
          </button>
          <button class="dock-tool" @tap.stop="openInterfaceSettings">
            <text class="dock-icon">Aa</text>
            <text>界面</text>
          </button>
          <button class="dock-tool" @tap.stop="openBehaviorSettings">
            <text class="dock-icon">⚙</text>
            <text>设置</text>
          </button>
        </view>
      </view>

      <view class="settings-panel" v-if="settingsVisible">
        <view class="panel-head">
          <view>
            <view class="panel-title">{{ settingsMode === 'interface' ? '界面设置' : '阅读设置' }}</view>
            <text class="panel-desc">{{ settingsSummary }}</text>
          </view>
          <button class="close-button" @tap.stop="closeSettings">×</button>
        </view>

        <view class="interface-tabs">
          <button :class="{ active: settingsMode === 'interface' }" @tap.stop="settingsMode = 'interface'">界面</button>
          <button :class="{ active: settingsMode === 'behavior' }" @tap.stop="settingsMode = 'behavior'">设置</button>
          <button @tap.stop="toggleCurrentBookmark">{{ currentBookmarkActive ? '已书签' : '书签' }}</button>
        </view>

        <view v-if="settingsMode === 'interface'">
          <view class="control-row">
            <text>字号</text>
            <button class="step-button" @tap.stop="changeFont(-1)">−</button>
            <slider class="reader-slider" :value="prefs.fontSize" min="16" max="30" activeColor="#df7458" @change="changeFontSlider" />
            <button class="step-button" @tap.stop="changeFont(1)">＋</button>
            <text class="control-value">{{ prefs.fontSize }}</text>
          </view>

          <view class="control-row">
            <text>行距</text>
            <button class="step-button" @tap.stop="changeLineHeight(-0.08)">−</button>
            <slider class="reader-slider" :value="lineHeightSlider" min="145" max="240" activeColor="#df7458" @change="changeLineHeightSlider" />
            <button class="step-button" @tap.stop="changeLineHeight(0.08)">＋</button>
            <text class="control-value">{{ prefs.lineHeight.toFixed(2) }}</text>
          </view>

          <view class="control-row">
            <text>段距</text>
            <button class="step-button" @tap.stop="changeParagraphSpacing(-0.1)">−</button>
            <slider class="reader-slider" :value="paragraphSlider" min="0" max="220" activeColor="#df7458" @change="changeParagraphSlider" />
            <button class="step-button" @tap.stop="changeParagraphSpacing(0.1)">＋</button>
            <text class="control-value">{{ prefs.paragraphSpacing.toFixed(1) }}</text>
          </view>

          <view class="control-row">
            <text>缩进</text>
            <button class="step-button" @tap.stop="changeTextIndent(-0.5)">−</button>
            <slider class="reader-slider" :value="textIndentSlider" min="0" max="40" activeColor="#df7458" @change="changeTextIndentSlider" />
            <button class="step-button" @tap.stop="changeTextIndent(0.5)">＋</button>
            <text class="control-value">{{ prefs.textIndent.toFixed(1) }}</text>
          </view>

          <view class="control-row">
            <text>边距</text>
            <button class="step-button" @tap.stop="changeContentWidth(-4)">−</button>
            <slider class="reader-slider" :value="prefs.contentWidth" min="62" max="96" activeColor="#df7458" @change="changeContentWidthSlider" />
            <button class="step-button" @tap.stop="changeContentWidth(4)">＋</button>
            <text class="control-value">{{ prefs.contentWidth }}%</text>
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
        </view>

        <view class="reader-setting-list" v-else>
          <view class="control-row">
            <text>亮度</text>
            <slider class="reader-slider wide" :value="prefs.brightness" min="40" max="100" activeColor="#df7458" @change="changeBrightness" />
            <text class="control-value">{{ prefs.brightness }}%</text>
          </view>
          <view class="turn-row">
            <text>翻页动画</text>
            <button :class="{ active: prefs.pageTurnMode === 'slide' }" @tap.stop="setPageTurnMode('slide')">滑动</button>
            <button :class="{ active: prefs.pageTurnMode === 'cover' }" @tap.stop="setPageTurnMode('cover')">覆盖</button>
            <button :class="{ active: prefs.pageTurnMode === 'none' }" @tap.stop="setPageTurnMode('none')">无动画</button>
          </view>
          <view class="setting-item">
            <text>显示章节信息</text>
            <switch :checked="prefs.showChapterInfo" color="#7cc1b6" @change="togglePref('showChapterInfo', $event)" />
          </view>
          <view class="setting-item">
            <text>显示阅读进度</text>
            <switch :checked="prefs.showProgress" color="#7cc1b6" @change="togglePref('showProgress', $event)" />
          </view>
          <view class="setting-item">
            <text>沉浸模式</text>
            <switch :checked="prefs.immersiveMode" color="#7cc1b6" @change="togglePref('immersiveMode', $event)" />
          </view>
          <view class="setting-item">
            <text>自动同步云端进度</text>
            <switch :checked="prefs.autoSyncProgress" color="#7cc1b6" @change="togglePref('autoSyncProgress', $event)" />
          </view>
        </view>
      </view>

      <view class="catalog-mask" v-if="catalogVisible" @tap.stop="closeCatalog">
        <view class="catalog-panel" @tap.stop>
          <view class="panel-head">
            <view>
              <view class="panel-title">目录与书签</view>
              <text class="panel-desc">{{ sourceLabel }} · {{ totalChapters }} 章 · 当前 {{ chapterIndex + 1 }}</text>
            </view>
            <button class="close-button" @tap.stop="closeCatalog">×</button>
          </view>

          <view class="catalog-tabs">
            <button :class="{ active: catalogTab === 'catalog' }" @tap.stop="catalogTab = 'catalog'">目录</button>
            <button :class="{ active: catalogTab === 'bookmark' }" @tap.stop="catalogTab = 'bookmark'">书签</button>
          </view>

          <view class="catalog-search" v-if="catalogTab === 'catalog'">
            <input v-model="catalogKeyword" placeholder="搜索章节名" confirm-type="search" />
          </view>

          <scroll-view v-if="catalogTab === 'catalog'" class="catalog-list" scroll-y :scroll-into-view="activeChapterId" :show-scrollbar="false">
            <view
              class="catalog-item"
              v-for="item in filteredChapters"
              :key="item.index"
              :id="`chapter-${item.index}`"
              :class="{ active: item.index === chapterIndex }"
              @tap.stop="jumpToChapter(item.index)"
            >
              <text class="catalog-index">{{ item.index + 1 }}</text>
              <view class="catalog-copy">
                <text class="catalog-title">{{ item.title || `第 ${item.index + 1} 章` }}</text>
                <text class="catalog-state">{{ chapterState(item) }}</text>
              </view>
              <text class="catalog-check" v-if="item.index === chapterIndex">✓</text>
            </view>
          </scroll-view>

          <scroll-view v-else class="bookmark-list" scroll-y :show-scrollbar="false">
            <view class="empty-state" v-if="bookmarks.length === 0">当前还没有书签，阅读时可在更多菜单或设置面板中加入。</view>
            <view
              class="bookmark-item"
              v-for="item in bookmarks"
              :key="item.id"
              @tap.stop="jumpToBookmark(item)"
            >
              <view>
                <text class="catalog-title">{{ item.chapterTitle }}</text>
                <text class="catalog-state">第 {{ item.chapterIndex + 1 }} 章 · 第 {{ item.pageIndex + 1 }} 页 · {{ formatTime(item.createdAt) }}</text>
              </view>
              <text class="catalog-check">›</text>
            </view>
          </scroll-view>
        </view>
      </view>

      <view class="brightness-mask" :style="{ opacity: brightnessOpacity }"></view>
    </view>
  </view>
</template>

<script>
import { getBook } from '../../common/books.js'
import { addOnlineBookToShelf, loadOnlineChapter } from '../../common/bookSources.js'
import {
  getBrightnessOverlayOpacity,
  getBookmarks,
  getPrefs,
  getProgress,
  getTheme,
  savePrefs,
  saveProgress,
  splitChapter,
  splitParagraphs,
  themes,
  toggleBookmark
} from '../../common/reader.js'
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
      bookmarks: [],
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
      appThemeId: getAppThemeId(),
      catalogTab: 'catalog',
      catalogKeyword: '',
      settingsMode: 'interface',
      speaking: false
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
    pageParagraphs() {
      return splitParagraphs(this.pageContent)
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
    readerContentStyle() {
      return {
        fontSize: `${this.prefs.fontSize}px`,
        lineHeight: `${this.lineHeight}px`,
        width: `${this.prefs.contentWidth}%`,
        letterSpacing: '0'
      }
    },
    paragraphStyle() {
      return {
        marginBottom: `${Math.round(this.prefs.paragraphSpacing * this.prefs.fontSize)}px`,
        textIndent: `${this.prefs.textIndent}em`
      }
    },
    lineHeight() {
      return Math.round(this.prefs.fontSize * this.prefs.lineHeight)
    },
    brightnessOpacity() {
      return getBrightnessOverlayOpacity(this.prefs.brightness)
    },
    visibleThemes() {
      return this.themes
    },
    lineHeightSlider() {
      return Math.round(this.prefs.lineHeight * 100)
    },
    paragraphSlider() {
      return Math.round(this.prefs.paragraphSpacing * 100)
    },
    textIndentSlider() {
      return Math.round(this.prefs.textIndent * 10)
    },
    sourceLabel() {
      if (this.book.source === 'backend') return this.book.sourceName || '云端书架'
      if (this.book.source === 'online') return this.book.sourceName || '在线书源'
      if (this.book.source === 'local') return '本地 TXT'
      return '内置示例'
    },
    settingsSummary() {
      if (this.settingsMode === 'interface') {
        return `字号 ${this.prefs.fontSize} · 行距 ${this.prefs.lineHeight.toFixed(2)} · 边距 ${this.prefs.contentWidth}%`
      }
      return `亮度 ${this.prefs.brightness}% · ${this.prefs.immersiveMode ? '沉浸' : '标准'} · ${this.prefs.pageTurnMode}`
    },
    filteredChapters() {
      const keyword = this.catalogKeyword.trim().toLowerCase()
      return (this.book.chapters || [])
        .map((item, index) => ({ ...item, index }))
        .filter(item => !keyword || String(item.title || '').toLowerCase().includes(keyword))
    },
    currentBookmarkActive() {
      return this.bookmarks.some(item => item.chapterIndex === this.chapterIndex && item.pageIndex === this.pageIndex)
    }
  },
  onLoad(options) {
    this.appThemeId = getAppThemeId()
    this.bookId = options.bookId || 'wind-city'
    this.prefs = savePrefs({ ...this.prefs, readingMode: 'page' })
    this.loadBookmarks()
    this.loadInitialBook(options)
  },
  onShow() {
    this.appThemeId = getAppThemeId()
    this.loadBookmarks()
  },
  onUnload() {
    this.stopReadAloud()
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
          this.pages = splitChapter(loaded.content, this.prefs.fontSize, this.prefs)
          this.loadingChapter = false
        } catch (error) {
          if (this.chapterLoadToken !== token) return
          this.loadingChapter = false
          this.chapterLoadError = this.formatChapterLoadError(error, '请稍后重试，或换一个可用书源。')
          this.book.chapters.splice(this.chapterIndex, 1, {
            ...currentChapter,
            loadStatus: 'failed',
            errorMessage: this.chapterLoadError
          })
          addOnlineBookToShelf(this.book)
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
          this.pages = splitChapter(content, this.prefs.fontSize, this.prefs)
          this.loadingChapter = false
        } catch (error) {
          if (this.chapterLoadToken !== token) return
          this.loadingChapter = false
          this.chapterLoadError = this.formatChapterLoadError(error, '后端章节解析失败')
          this.pages = ['这一章暂时没有解析成功。你可以重试，或回到目录换一章。']
        }
        this.pageIndex = Math.max(0, Math.min(this.pageIndex, this.pages.length - 1))
        this.persist()
        return
      }

      this.loadingChapter = false
      this.chapterLoadError = ''
      this.pages = splitChapter(currentChapter.content, this.prefs.fontSize, this.prefs)
      this.pageIndex = Math.max(0, Math.min(this.pageIndex, this.pages.length - 1))
      this.persist()
    },
    formatChapterLoadError(error, fallback) {
      const message = friendlyErrorMessage(error, fallback)
      if (/Content parsed empty|正文解析为空/i.test(message)) {
        return '章节正文解析为空。请刷新演示书源、重新加入书架，或换一个通过正文测试的书源。'
      }
      return message
    },
    persist() {
      saveProgress(this.bookId, {
        chapterIndex: this.chapterIndex,
        pageIndex: this.pageIndex,
        scrollTop: 0
      })
      if (this.book.source === 'backend' && this.prefs.autoSyncProgress) {
        saveBackendReadingHistory({
          book: this.book,
          chapter: this.chapter,
          chapterIndex: this.chapterIndex,
          pageIndex: this.pageIndex,
          progressPercent: this.progressPercent
        }).catch(() => {})
      }
    },
    loadBookmarks() {
      this.bookmarks = getBookmarks(this.bookId)
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
        this.stopReadAloud()
        this.rebuildPages()
      } else {
        uni.showToast({ title: '已经读完', icon: 'none' })
      }
    },
    prevChapter(toLastPage) {
      if (this.chapterIndex > 0) {
        this.chapterIndex -= 1
        this.stopReadAloud()
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
      this.catalogTab = 'catalog'
      this.clearChromeTimer()
    },
    closeCatalog() {
      this.catalogVisible = false
      this.scheduleChromeAutoHide()
    },
    openInterfaceSettings() {
      this.settingsMode = 'interface'
      this.openSettings()
    },
    openBehaviorSettings() {
      this.settingsMode = 'behavior'
      this.openSettings()
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
    saveReaderPrefs(rebuild = false) {
      this.prefs = savePrefs(this.prefs)
      if (rebuild) this.rebuildPages()
    },
    changeFont(delta) {
      this.prefs.fontSize += delta
      this.saveReaderPrefs(true)
    },
    changeFontSlider(event) {
      this.prefs.fontSize = Number(event.detail.value)
      this.saveReaderPrefs(true)
    },
    changeLineHeight(delta) {
      this.prefs.lineHeight += delta
      this.saveReaderPrefs(true)
    },
    changeLineHeightSlider(event) {
      this.prefs.lineHeight = Number(event.detail.value) / 100
      this.saveReaderPrefs(true)
    },
    changeParagraphSpacing(delta) {
      this.prefs.paragraphSpacing += delta
      this.saveReaderPrefs(false)
    },
    changeParagraphSlider(event) {
      this.prefs.paragraphSpacing = Number(event.detail.value) / 100
      this.saveReaderPrefs(false)
    },
    changeTextIndent(delta) {
      this.prefs.textIndent += delta
      this.saveReaderPrefs(false)
    },
    changeTextIndentSlider(event) {
      this.prefs.textIndent = Number(event.detail.value) / 10
      this.saveReaderPrefs(false)
    },
    changeContentWidth(delta) {
      this.prefs.contentWidth += delta
      this.saveReaderPrefs(true)
    },
    changeContentWidthSlider(event) {
      this.prefs.contentWidth = Number(event.detail.value)
      this.saveReaderPrefs(true)
    },
    setTheme(themeId) {
      this.prefs.theme = themeId
      this.saveReaderPrefs(false)
    },
    setPageTurnMode(mode) {
      this.prefs.pageTurnMode = mode
      this.saveReaderPrefs(false)
    },
    togglePref(key, event) {
      this.prefs[key] = !!(event.detail && event.detail.value)
      this.saveReaderPrefs(false)
    },
    adjustBrightness() {
      const next = this.prefs.brightness <= 55 ? 86 : this.prefs.brightness <= 86 ? 100 : 52
      this.prefs.brightness = next
      this.saveReaderPrefs(false)
      uni.showToast({ title: `亮度 ${next}%`, icon: 'none' })
      this.scheduleChromeAutoHide()
    },
    changeBrightness(event) {
      this.prefs.brightness = Number(event.detail.value)
      this.saveReaderPrefs(false)
    },
    toggleCurrentBookmark() {
      const result = toggleBookmark(this.bookId, {
        chapterIndex: this.chapterIndex,
        pageIndex: this.pageIndex,
        chapterTitle: this.chapter.title || `第 ${this.chapterIndex + 1} 章`,
        excerpt: this.pageContent
      })
      this.bookmarks = result.bookmarks
      uni.showToast({ title: result.active ? '已加入书签' : '已取消书签', icon: 'none' })
      this.moreVisible = false
    },
    jumpToBookmark(item) {
      this.chapterIndex = Math.max(0, Math.min(item.chapterIndex, this.totalChapters - 1))
      this.pageIndex = Math.max(0, item.pageIndex || 0)
      this.catalogVisible = false
      this.hideReaderChrome()
      this.rebuildPages()
    },
    chapterState(item) {
      const chapter = this.book.chapters[item.index] || item
      const length = String(chapter.content || '').length
      if (length) return `${length} 字 · 已缓存`
      if (chapter.isCached) return '已缓存'
      if (this.book.source === 'online' || this.book.source === 'backend') return '待解码'
      return '本地'
    },
    formatTime(timestamp) {
      const date = new Date(timestamp || Date.now())
      return `${date.getMonth() + 1}-${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    },
    searchInChapter() {
      const keyword = this.askText('搜索本章', '输入关键词')
      if (!keyword) return
      const index = this.pages.findIndex(page => page.includes(keyword))
      if (index < 0) {
        uni.showToast({ title: '本章未找到关键词', icon: 'none' })
        return
      }
      this.pageIndex = index
      this.persist()
      uni.showToast({ title: `已跳到第 ${index + 1} 页`, icon: 'none' })
    },
    toggleReadAloud() {
      if (this.speaking) {
        this.stopReadAloud()
        return
      }
      if (typeof window === 'undefined' || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') {
        uni.showToast({ title: '当前环境暂不支持听读', icon: 'none' })
        return
      }
      const text = this.getCurrentChapterText().trim() || this.pageContent.trim()
      if (!text) {
        uni.showToast({ title: '当前没有可朗读正文', icon: 'none' })
        return
      }
      const utterance = new window.SpeechSynthesisUtterance(text.slice(0, 4000))
      utterance.lang = 'zh-CN'
      utterance.rate = 0.95
      utterance.onend = () => { this.speaking = false }
      utterance.onerror = () => { this.speaking = false }
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
      this.speaking = true
      uni.showToast({ title: '开始听读', icon: 'none' })
    },
    stopReadAloud() {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      this.speaking = false
    },
    copyProgress() {
      const text = `${this.book.title} · ${this.chapter.title || `第 ${this.chapterIndex + 1} 章`} · ${this.pageIndex + 1}/${this.pages.length}`
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
      this.stopReadAloud()
      this.rebuildPages()
    },
    retryChapter() {
      this.chapterLoadError = ''
      if ((this.book.source === 'online' || this.book.source === 'backend') && this.book.chapters[this.chapterIndex]) {
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
            if (modal.confirm) uni.setClipboardData({ data: content })
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
      const question = this.askText('AI 问答本章', '本章发生了什么？')
      if (!question) return
      this.sendAIQuestion(question, chapterText)
    },
    askText(title, fallback) {
      if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
        return String(window.prompt(title, fallback) || '').trim()
      }
      uni.showToast({ title: fallback, icon: 'none' })
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
            if (modal.confirm) uni.setClipboardData({ data: result.answer })
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
    showSourceInfo() {
      const message = [
        `来源：${this.sourceLabel}`,
        `章节：${this.chapter.title || `第 ${this.chapterIndex + 1} 章`}`,
        `状态：${this.chapterState({ index: this.chapterIndex })}`
      ].join('\n')
      uni.showModal({ title: '来源信息', content: message, showCancel: false })
      this.moreVisible = false
    },
    scheduleChromeAutoHide() {
      this.clearChromeTimer()
      this.chromeTimer = setTimeout(() => {
        if (!this.settingsVisible && !this.catalogVisible && !this.moreVisible) {
          this.controlsVisible = false
        }
      }, 5200)
    },
    clearChromeTimer() {
      if (this.chromeTimer) {
        clearTimeout(this.chromeTimer)
        this.chromeTimer = null
      }
    },
    back() {
      this.stopReadAloud()
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
  min-height: 100vh;
  overflow: hidden;
  padding: 34rpx;
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

.reader-embed {
  position: relative;
  max-width: 930px;
  height: calc(100vh - 68rpx);
  min-height: 760rpx;
  margin: 0 auto;
  overflow: hidden;
  border: 1rpx solid var(--app-shell-border);
  border-radius: 24rpx;
  background: var(--app-panel);
  box-shadow: var(--app-floating-shadow);
}

.reading-surface {
  position: absolute;
  inset: 0;
  padding: 128rpx 0 174rpx;
  box-sizing: border-box;
  transition: background 0.2s ease, color 0.2s ease;
}

.page-head,
.chapter-meta,
.reader-content,
.chapter-title {
  width: 82%;
  margin-left: auto;
  margin-right: auto;
}

.page-head,
.chapter-meta,
.panel-head,
.chapter-row,
.dock-actions,
.control-row,
.setting-item,
.turn-row,
.catalog-item,
.bookmark-item {
  display: flex;
  align-items: center;
}

.page-head,
.chapter-meta,
.panel-head,
.chapter-row,
.setting-item,
.turn-row {
  justify-content: space-between;
}

.page-head {
  min-height: 32rpx;
  color: currentColor;
  opacity: 0.58;
  font-size: 23rpx;
}

.chapter-meta {
  gap: 14rpx;
  justify-content: flex-start;
  margin-top: 26rpx;
  color: var(--app-accent);
  font-size: 22rpx;
}

.source-badge {
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.18);
}

.chapter-title {
  margin-top: 18rpx;
  font-size: 34rpx;
  font-weight: 800;
}

.reader-content {
  display: block;
  min-height: 420rpx;
  margin-top: 38rpx;
  transition: opacity 0.2s ease, max-width 0.2s ease;
}

.reader-paragraph {
  display: block;
  white-space: pre-wrap;
}

.reader-content.quiet {
  opacity: 0.42;
}

.page-foot {
  position: absolute;
  left: 9%;
  right: 9%;
  bottom: 112rpx;
  display: flex;
  align-items: center;
  gap: 18rpx;
  color: currentColor;
  font-size: 22rpx;
  opacity: 0.58;
}

.foot-line,
.chapter-track,
.font-meter {
  position: relative;
  flex: 1;
  height: 10rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: rgba(128, 128, 128, 0.22);
}

.foot-progress,
.chapter-track-fill,
.font-meter-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--app-accent);
}

.top-chrome {
  position: absolute;
  top: 24rpx;
  left: 28rpx;
  right: 28rpx;
  z-index: 8;
  display: grid;
  grid-template-columns: 72rpx 1fr 72rpx;
  align-items: center;
  min-height: 76rpx;
  padding: 0 14rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 999rpx;
  color: var(--app-reader-control-text);
  background: color-mix(in srgb, var(--app-reader-control) 88%, transparent);
  box-shadow: var(--app-floating-shadow);
}

.icon-button,
.quick-action,
.close-button {
  width: 58rpx;
  height: 58rpx;
  border-radius: 999rpx;
  color: var(--app-reader-control-text);
  background: rgba(255, 255, 255, 0.24);
  font-size: 34rpx;
}

.touch-hit {
  min-width: 88rpx;
  min-height: 88rpx;
}

.top-title {
  min-width: 0;
  text-align: center;
  font-size: 26rpx;
  font-weight: 800;
}

.top-title text {
  display: block;
  margin-top: 5rpx;
  overflow: hidden;
  color: var(--app-muted);
  font-size: 20rpx;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-actions {
  position: absolute;
  right: 34rpx;
  bottom: 252rpx;
  z-index: 9;
  display: grid;
  gap: 16rpx;
}

.quick-action {
  width: 72rpx;
  height: 72rpx;
  background: var(--app-reader-control);
  box-shadow: var(--app-floating-shadow);
}

.bottom-chrome,
.settings-panel,
.catalog-panel {
  position: absolute;
  left: 28rpx;
  right: 28rpx;
  bottom: 28rpx;
  z-index: 10;
  border: 1rpx solid var(--app-border);
  border-radius: 28rpx;
  color: var(--app-reader-control-text);
  background: color-mix(in srgb, var(--app-reader-control) 94%, transparent);
  box-shadow: var(--app-floating-shadow);
}

.bottom-chrome {
  padding: 20rpx;
}

.chapter-row {
  gap: 18rpx;
}

.chapter-button {
  min-width: 118rpx;
  height: 52rpx;
  border-radius: 18rpx;
  color: var(--app-text);
  background: var(--app-panel);
  font-size: 24rpx;
}

.dock-actions {
  gap: 12rpx;
  margin-top: 18rpx;
}

.dock-tool {
  flex: 1;
  min-width: 0;
  min-height: 82rpx;
  flex-direction: column;
  gap: 8rpx;
  border-radius: 18rpx;
  color: var(--app-text);
  background: var(--app-panel);
  font-size: 22rpx;
}

.dock-icon {
  font-size: 32rpx;
  font-weight: 800;
}

.more-menu {
  position: absolute;
  top: 116rpx;
  right: 36rpx;
  z-index: 12;
  width: 250rpx;
  overflow: hidden;
  border: 1rpx solid var(--app-border);
  border-radius: 22rpx;
  background: var(--app-panel);
  box-shadow: var(--app-floating-shadow);
}

.more-item {
  width: 100%;
  min-height: 70rpx;
  justify-content: flex-start;
  padding: 0 22rpx;
  box-sizing: border-box;
  color: var(--app-text);
  background: transparent;
  font-size: 24rpx;
}

.settings-panel {
  max-height: 64%;
  padding: 24rpx;
  box-sizing: border-box;
}

.panel-title {
  color: var(--app-text);
  font-size: 30rpx;
  font-weight: 800;
}

.panel-desc {
  display: block;
  margin-top: 8rpx;
  color: var(--app-muted);
  font-size: 22rpx;
}

.interface-tabs,
.catalog-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin: 22rpx 0;
}

.catalog-tabs {
  grid-template-columns: repeat(2, 1fr);
}

.interface-tabs button,
.catalog-tabs button,
.turn-row button {
  height: 58rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 16rpx;
  color: var(--app-text);
  background: var(--app-panel);
  font-size: 23rpx;
}

.interface-tabs button.active,
.catalog-tabs button.active,
.turn-row button.active {
  color: var(--app-on-accent);
  border-color: var(--app-accent);
  background: var(--app-accent);
}

.control-row {
  gap: 14rpx;
  min-height: 66rpx;
  color: var(--app-text);
  font-size: 24rpx;
}

.control-row > text:first-child {
  width: 72rpx;
}

.reader-slider {
  flex: 1;
}

.reader-slider.wide {
  min-width: 0;
}

.step-button {
  width: 54rpx;
  height: 54rpx;
  border-radius: 16rpx;
  color: var(--app-text);
  background: var(--app-panel);
  font-size: 28rpx;
}

.control-value {
  width: 72rpx;
  color: var(--app-muted);
  text-align: right;
  font-size: 22rpx;
}

.theme-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 20rpx;
}

.theme-chip {
  width: 118rpx;
  height: 64rpx;
  border: 2rpx solid transparent;
  border-radius: 999rpx;
  font-size: 23rpx;
}

.theme-chip.active {
  border-color: var(--app-accent);
  box-shadow: 0 0 0 4rpx rgba(223, 116, 88, 0.16);
}

.reader-setting-list {
  display: grid;
  gap: 14rpx;
}

.setting-item {
  min-height: 68rpx;
  color: var(--app-text);
  font-size: 24rpx;
}

.turn-row {
  gap: 12rpx;
  min-height: 68rpx;
}

.turn-row text {
  width: 132rpx;
  color: var(--app-text);
  font-size: 24rpx;
}

.turn-row button {
  flex: 1;
}

.catalog-mask {
  position: absolute;
  inset: 0;
  z-index: 11;
  display: flex;
  align-items: flex-end;
  padding: 28rpx;
  box-sizing: border-box;
  background: rgba(10, 18, 20, 0.18);
}

.catalog-panel {
  position: relative;
  left: auto;
  right: auto;
  bottom: auto;
  width: 100%;
  max-height: 78%;
  padding: 24rpx;
  box-sizing: border-box;
}

.catalog-search {
  margin-bottom: 16rpx;
}

.catalog-search input {
  height: 64rpx;
  padding: 0 22rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 18rpx;
  color: var(--app-text);
  background: var(--app-bg);
  font-size: 24rpx;
}

.catalog-list,
.bookmark-list {
  height: 50vh;
}

.catalog-item,
.bookmark-item {
  gap: 18rpx;
  min-height: 86rpx;
  padding: 0 18rpx;
  border-radius: 18rpx;
  color: var(--app-text);
  background: var(--app-panel);
  margin-bottom: 12rpx;
}

.catalog-item.active {
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.catalog-index {
  flex-shrink: 0;
  width: 58rpx;
  color: var(--app-accent-3);
  font-size: 24rpx;
  font-weight: 800;
}

.catalog-item.active .catalog-index,
.catalog-item.active .catalog-state {
  color: var(--app-on-accent);
}

.catalog-copy,
.bookmark-item > view {
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
  font-size: 26rpx;
  font-weight: 700;
}

.catalog-state {
  margin-top: 7rpx;
  color: var(--app-muted);
  font-size: 21rpx;
}

.catalog-check {
  font-size: 34rpx;
  font-weight: 800;
}

.empty-state {
  padding: 48rpx 24rpx;
  border-radius: 20rpx;
  color: var(--app-muted);
  background: var(--app-panel);
  text-align: center;
  font-size: 24rpx;
}

.loading-card,
.error-card {
  width: 82%;
  margin: 44rpx auto 0;
  padding: 24rpx;
  border-radius: 22rpx;
  box-sizing: border-box;
  color: var(--app-text);
  background: var(--app-panel);
}

.loading-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.loading-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 999rpx;
  background: var(--app-accent);
}

.error-card {
  display: flex;
  justify-content: space-between;
  gap: 18rpx;
}

.error-title {
  font-size: 26rpx;
  font-weight: 800;
}

.error-desc {
  display: block;
  margin-top: 8rpx;
  color: var(--app-muted);
  font-size: 22rpx;
}

.retry-button {
  width: 96rpx;
  height: 56rpx;
  border-radius: 16rpx;
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.brightness-mask {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: #000000;
}

@media (max-width: 760px) {
  .reader-page {
    padding: 0;
  }

  .reader-embed {
    width: 100%;
    height: 100vh;
    min-height: 100vh;
    border-radius: 0;
    border: 0;
  }

  .reading-surface {
    padding-top: calc(132rpx + env(safe-area-inset-top));
  }

  .top-chrome {
    left: 24rpx;
    right: 24rpx;
    min-height: 88rpx;
    grid-template-columns: 104rpx 1fr 104rpx;
  }

  .reader-safe-top {
    top: calc(18rpx + env(safe-area-inset-top));
  }

  .top-chrome .icon-button {
    width: 88rpx;
    height: 88rpx;
    font-size: 38rpx;
  }

  .quick-actions {
    right: 22rpx;
    bottom: 240rpx;
  }

  .bottom-chrome,
  .settings-panel {
    left: 18rpx;
    right: 18rpx;
    bottom: 18rpx;
  }

  .page-head,
  .chapter-meta,
  .reader-content,
  .chapter-title {
    width: 88%;
  }
}
</style>
