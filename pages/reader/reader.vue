<template>
  <view class="reader-page" :class="themeClass" :style="pageStyle">
    <view class="reader-embed text-only-reader" :class="{ immersive: prefs.immersiveMode, 'controls-open': controlsVisible }">
      <view
        class="reading-surface"
        :style="readerSurfaceStyle"
        @tap="handleReaderTap"
        @touchstart="onTouchStart"
        @touchend="onTouchEnd"
      >
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
          :key="pageTurnKey"
          :class="['page-turn-' + prefs.pageTurnMode, 'page-turn-' + pageTurnDirection, { quiet: loadingChapter, 'page-turn-active': pageTurnAnimating }]"
          :style="readerContentStyle"
        >
          <view class="reader-progress-mark" v-if="!loadingChapter && !chapterLoadError">
            <view class="reader-progress-rail">
              <view class="reader-progress-rail-fill" :style="{ width: pageProgressPercent + '%' }"></view>
            </view>
            <text>{{ chapterIndex + 1 }} / {{ totalChapters }}</text>
          </view>
          <text
            class="reader-paragraph"
            v-for="(paragraph, index) in pageParagraphs"
            :key="index"
            :style="paragraphStyle"
          >
            {{ paragraph }}
          </text>
        </view>

      </view>

      <view class="top-chrome reader-safe-top" :class="{ 'reader-chrome-visible': controlsVisible }">
        <button class="icon-button touch-hit" aria-label="返回" @tap.stop="back">‹</button>
        <view class="top-title">
          <view>{{ book.title }}</view>
          <text>{{ chapter.title || `第 ${chapterIndex + 1} 章` }}</text>
        </view>
        <button class="icon-button touch-hit" aria-label="更多操作" @tap.stop="toggleMore">•••</button>
      </view>

      <view class="quick-actions" :class="{ 'reader-chrome-visible': controlsVisible && !settingsVisible && !catalogVisible && !moreVisible }">
        <button class="quick-action touch-hit" aria-label="目录" @tap.stop="openCatalog">☰</button>
        <button class="quick-action touch-hit" aria-label="搜索本章" @tap.stop="searchInChapter">⌕</button>
        <button class="quick-action touch-hit" aria-label="重新解码" @tap.stop="retryChapter">↻</button>
        <button class="quick-action touch-hit" aria-label="调节亮度" @tap.stop="adjustBrightness">◐</button>
      </view>

      <view class="more-menu app-motion-dialog" v-if="moreVisible">
        <button class="more-item touch-hit" @tap.stop="aiSummarizeChapter">AI 总结本章</button>
        <button class="more-item touch-hit" @tap.stop="aiAskChapter">AI 问答本章</button>
        <button class="more-item touch-hit" @tap.stop="toggleCurrentBookmark">{{ currentBookmarkActive ? '取消书签' : '加入书签' }}</button>
        <button class="more-item touch-hit" @tap.stop="copyProgress">复制进度</button>
        <button class="more-item touch-hit" @tap.stop="retryChapter">重新解码本章</button>
        <button class="more-item touch-hit" @tap.stop="showSourceInfo">来源信息</button>
        <button class="more-item touch-hit" @tap.stop="back">回到书架</button>
      </view>

      <view class="bottom-chrome" :class="{ 'reader-chrome-visible': controlsVisible && !settingsVisible && !catalogVisible }">
        <view class="chapter-row">
          <button class="chapter-button touch-hit" :disabled="chapterIndex <= 0" @tap.stop="prevChapter">上一章</button>
          <view class="chapter-track" @tap.stop>
            <view class="chapter-track-fill" :style="{ width: progressPercent + '%' }"></view>
          </view>
          <button class="chapter-button touch-hit" :disabled="chapterIndex >= totalChapters - 1" @tap.stop="nextChapter">下一章</button>
        </view>
        <view class="dock-actions">
          <button class="dock-tool touch-hit" aria-label="目录" @tap.stop="openCatalog">
            <text class="dock-icon">☰</text>
            <text>目录</text>
          </button>
          <button class="dock-tool touch-hit" aria-label="听读" @tap.stop="toggleReadAloud">
            <text class="dock-icon">◉</text>
            <text>{{ speaking ? '停止' : '听读' }}</text>
          </button>
          <button class="dock-tool touch-hit" aria-label="界面设置" @tap.stop="openInterfaceSettings">
            <text class="dock-icon">Aa</text>
            <text>界面</text>
          </button>
          <button class="dock-tool touch-hit" aria-label="阅读设置" @tap.stop="openBehaviorSettings">
            <text class="dock-icon">⚙</text>
            <text>设置</text>
          </button>
        </view>
      </view>

      <view class="settings-panel app-motion-sheet reader-settings-enter" v-if="settingsVisible">
        <view class="panel-head">
          <view>
            <view class="panel-title">{{ settingsMode === 'interface' ? '界面设置' : '阅读设置' }}</view>
            <text class="panel-desc">{{ settingsSummary }}</text>
          </view>
          <button class="close-button touch-hit" aria-label="关闭设置" @tap.stop="closeSettings">×</button>
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
            <slider class="reader-slider" :value="prefs.fontSize" min="16" max="20" :activeColor="appAccent" @change="changeFontSlider" />
            <button class="step-button" @tap.stop="changeFont(1)">＋</button>
            <text class="control-value">{{ prefs.fontSize }}</text>
          </view>

          <view class="control-row">
            <text>行距</text>
            <button class="step-button" @tap.stop="changeLineHeight(-0.08)">−</button>
            <slider class="reader-slider" :value="lineHeightSlider" min="145" max="186" :activeColor="appAccent" @change="changeLineHeightSlider" />
            <button class="step-button" @tap.stop="changeLineHeight(0.08)">＋</button>
            <text class="control-value">{{ prefs.lineHeight.toFixed(2) }}</text>
          </view>

          <view class="control-row">
            <text>段距</text>
            <button class="step-button" @tap.stop="changeParagraphSpacing(-0.1)">−</button>
            <slider class="reader-slider" :value="paragraphSlider" min="0" max="220" :activeColor="appAccent" @change="changeParagraphSlider" />
            <button class="step-button" @tap.stop="changeParagraphSpacing(0.1)">＋</button>
            <text class="control-value">{{ prefs.paragraphSpacing.toFixed(1) }}</text>
          </view>

          <view class="control-row">
            <text>缩进</text>
            <button class="step-button" @tap.stop="changeTextIndent(-0.5)">−</button>
            <slider class="reader-slider" :value="textIndentSlider" min="0" max="40" :activeColor="appAccent" @change="changeTextIndentSlider" />
            <button class="step-button" @tap.stop="changeTextIndent(0.5)">＋</button>
            <text class="control-value">{{ prefs.textIndent.toFixed(1) }}</text>
          </view>

          <view class="control-row">
            <text>边距</text>
            <button class="step-button" @tap.stop="changeContentWidth(-4)">−</button>
            <slider class="reader-slider" :value="prefs.contentWidth" min="72" max="98" :activeColor="appAccent" @change="changeContentWidthSlider" />
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
            <slider class="reader-slider wide" :value="prefs.brightness" min="40" max="100" :activeColor="appAccent" @change="changeBrightness" />
            <text class="control-value">{{ prefs.brightness }}%</text>
          </view>
          <view class="turn-row">
            <text>翻页动画</text>
            <button :class="{ active: prefs.pageTurnMode === 'slide' }" @tap.stop="setPageTurnMode('slide')">滑动</button>
            <button :class="{ active: prefs.pageTurnMode === 'cover' }" @tap.stop="setPageTurnMode('cover')">覆盖</button>
            <button :class="{ active: prefs.pageTurnMode === 'none' }" @tap.stop="setPageTurnMode('none')">无动画</button>
          </view>
          <view class="setting-item">
            <text>沉浸模式</text>
            <switch :checked="prefs.immersiveMode" :color="appAccent" @change="togglePref('immersiveMode', $event)" />
          </view>
          <view class="setting-item">
            <text>自动同步云端进度</text>
            <switch :checked="prefs.autoSyncProgress" :color="appAccent" @change="togglePref('autoSyncProgress', $event)" />
          </view>
        </view>
      </view>

      <view class="catalog-mask app-motion-overlay" v-if="catalogVisible" @tap.stop="closeCatalog">
        <view class="catalog-panel app-motion-sheet" @tap.stop>
          <view class="panel-head">
            <view>
              <view class="panel-title">目录与书签</view>
              <text class="panel-desc">{{ sourceLabel }} · {{ totalChapters }} 章 · 当前 {{ chapterIndex + 1 }}</text>
            </view>
            <button class="close-button touch-hit" aria-label="关闭目录" @tap.stop="closeCatalog">×</button>
          </view>

          <view class="catalog-tabs">
            <button :class="{ active: catalogTab === 'catalog' }" @tap.stop="catalogTab = 'catalog'">目录</button>
            <button :class="{ active: catalogTab === 'bookmark' }" @tap.stop="catalogTab = 'bookmark'">书签</button>
          </view>

          <view class="catalog-search" v-if="catalogTab === 'catalog'">
            <input v-model="catalogKeyword" placeholder="搜索章节名" confirm-type="search" />
          </view>

          <scroll-view
            v-if="catalogTab === 'catalog'"
            class="catalog-list"
            scroll-y
            :scroll-into-view="activeChapterId"
            :show-scrollbar="false"
            @scrolltolower="loadMoreCatalogChapters"
            @scrolltoupper="loadPreviousCatalogChapters"
          >
            <view
              class="catalog-item"
              v-for="item in visibleCatalogChapters"
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
import { getBook, loadLocalBookCatalog, loadLocalChapterContent, loadLocalChapterContentAsync } from '../../common/books.js'
import { addOnlineBookToShelf, loadOnlineChapter, preloadOnlineChapters } from '../../common/bookSources.js'
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
import { isMotionReduced, setNavigationMotion } from '../../common/motion.js'

const CATALOG_BATCH_SIZE = 120

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
      pageTurnDirection: 'forward',
      pageTurnKey: 0,
      pageTurnTimer: null,
      pageTurnToken: 0,
      pageTurnAnimating: false,
      motionReduced: isMotionReduced(),
      appThemeId: getAppThemeId(),
      catalogTab: 'catalog',
      catalogKeyword: '',
      catalogStartIndex: 0,
      catalogVisibleCount: CATALOG_BATCH_SIZE,
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
    appAccent() {
      return getAppThemeStyle(this.appThemeId)['--app-accent'] || '#df7458'
    },
    themeClass() {
      return `theme-${this.appThemeId}`
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
    visibleCatalogChapters() {
      return this.filteredChapters.slice(this.catalogStartIndex, this.catalogStartIndex + this.catalogVisibleCount)
    },
    currentBookmarkActive() {
      return this.bookmarks.some(item => item.chapterIndex === this.chapterIndex && item.pageIndex === this.pageIndex)
    }
  },
  watch: {
    catalogKeyword() {
      this.resetCatalogWindow(false)
    }
  },
  onLoad(options) {
    this.appThemeId = getAppThemeId()
    this.bookId = options.bookId || 'wind-city'
    this.prefs = savePrefs({ ...this.prefs, readingMode: 'page' })
    this.loadBookmarks()
    this.loadInitialBook(options)
    if (typeof uni !== 'undefined' && typeof uni.$on === 'function') {
      uni.$on('app:motion-changed', this.handleMotionChange)
    }
  },
  onShow() {
    this.appThemeId = getAppThemeId()
    this.motionReduced = isMotionReduced()
    this.loadBookmarks()
  },
  onUnload() {
    this.stopReadAloud()
    this.clearPageTurnAnimation()
    this.clearChromeTimer()
    if (typeof uni !== 'undefined' && typeof uni.$off === 'function') {
      uni.$off('app:motion-changed', this.handleMotionChange)
    }
  },
  methods: {
    handleMotionChange(state) {
      this.motionReduced = !!(state && state.reduced)
    },
    playPageTurn(direction) {
      this.pageTurnDirection = direction === 'back' ? 'back' : 'forward'
      this.clearPageTurnAnimation()
      if (this.motionReduced || this.prefs.pageTurnMode === 'none') return
      this.pageTurnKey += 1
      this.pageTurnAnimating = true
      const token = ++this.pageTurnToken
      const duration = this.prefs.pageTurnMode === 'cover' ? 220 : 210
      this.pageTurnTimer = setTimeout(() => {
        if (token === this.pageTurnToken) this.pageTurnAnimating = false
      }, duration)
    },
    clearPageTurnAnimation() {
      if (this.pageTurnTimer) {
        clearTimeout(this.pageTurnTimer)
        this.pageTurnTimer = null
      }
      this.pageTurnAnimating = false
    },
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
          this.book = await loadLocalBookCatalog(this.book)
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
          const loaded = await loadOnlineChapter(this.book, currentChapter, { autoPreload: true })
          if (this.chapterLoadToken !== token) return
          this.book.chapters.splice(this.chapterIndex, 1, loaded)
          addOnlineBookToShelf(this.book)
          preloadOnlineChapters(this.book, this.chapterIndex).catch(() => {})
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

      if (this.book.source === 'local' && currentChapter && !currentChapter.content) {
        this.loadingChapter = true
        this.loadingText = '正在读取本地章节...'
        this.pages = ['请稍候，正在读取本地 TXT 正文。']
        try {
          const content = await loadLocalChapterContentAsync(this.book, currentChapter)
          if (this.chapterLoadToken !== token) return
          this.book.chapters.splice(this.chapterIndex, 1, {
            ...currentChapter,
            content,
            isCached: true
          })
          this.pages = splitChapter(content, this.prefs.fontSize, this.prefs)
          this.loadingChapter = false
        } catch (error) {
          if (this.chapterLoadToken !== token) return
          this.loadingChapter = false
          this.chapterLoadError = friendlyErrorMessage(error, '本地章节读取失败，请重新导入 TXT 文件。')
          this.pages = ['这一章暂时无法读取。请重新导入 TXT 文件后再试。']
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
        this.playPageTurn('forward')
        this.pageIndex += 1
        this.persist()
        return
      }
      this.nextChapter()
    },
    prevPage() {
      if (this.loadingChapter) return
      if (this.pageIndex > 0) {
        this.playPageTurn('back')
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
      this.resetCatalogWindow(true)
      this.clearChromeTimer()
    },
    resetCatalogWindow(centerCurrent = true) {
      const list = this.filteredChapters
      const currentIndex = list.findIndex(item => item.index === this.chapterIndex)
      const shouldCenter = centerCurrent && !this.catalogKeyword.trim() && currentIndex >= 0
      this.catalogStartIndex = shouldCenter ? Math.max(0, currentIndex - 20) : 0
      this.catalogVisibleCount = Math.min(CATALOG_BATCH_SIZE, Math.max(list.length - this.catalogStartIndex, 0))
    },
    loadMoreCatalogChapters() {
      const remaining = this.filteredChapters.length - this.catalogStartIndex
      if (this.catalogVisibleCount >= remaining) return
      this.catalogVisibleCount = Math.min(remaining, this.catalogVisibleCount + CATALOG_BATCH_SIZE)
    },
    loadPreviousCatalogChapters() {
      if (this.catalogStartIndex <= 0) return
      const step = Math.min(CATALOG_BATCH_SIZE, this.catalogStartIndex)
      this.catalogStartIndex -= step
      this.catalogVisibleCount += step
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
      if (chapter.wordCount) return `${chapter.wordCount} 字 · 本地`
      if (chapter.contentKey || (chapter.contentKeys && chapter.contentKeys.length)) return '本地'
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
      if (this.book.source === 'local' && this.chapter && !this.chapter.content) {
        try {
          return loadLocalChapterContent(this.book, this.chapter)
        } catch (error) {
          return this.pageContent || ''
        }
      }
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
        setNavigationMotion('enter', 'back')
        uni.navigateBack()
        return
      }
      setNavigationMotion('tab', 'back')
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
  border-radius: 0 0 var(--app-card-radius, 24rpx) var(--app-card-radius, 24rpx);
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
  border-radius: calc(var(--app-card-radius, 24rpx) + 4rpx);
  background: var(--app-stage);
}

.reading-surface {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  padding: calc(16rpx + env(safe-area-inset-top)) 0 calc(72rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.05);
  transition: background 0.2s ease, color 0.2s ease;
}

/* Shared flex-row utilities */
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

.panel-head,
.chapter-row,
.setting-item,
.turn-row {
  justify-content: space-between;
}

/* ── Reader content (merged — was duplicated) ── */
.reader-content {
  display: block;
  flex: 1;
  width: 88%;
  margin-left: auto;
  margin-right: auto;
  padding-top: 22rpx;
  padding-bottom: 10rpx;
  box-sizing: border-box;
  transition: opacity 0.2s ease, max-width 0.2s ease;
}

.reader-content.page-turn-slide.page-turn-forward:not(.quiet) {
  animation: reader-page-slide-forward 210ms var(--app-motion-standard) both;
}

.reader-content.page-turn-slide.page-turn-back:not(.quiet) {
  animation: reader-page-slide-back 210ms var(--app-motion-standard) both;
}

.reader-content.page-turn-cover.page-turn-forward:not(.quiet) {
  transform-origin: right center;
  animation: reader-page-cover-forward 220ms var(--app-motion-smooth) both;
}

.reader-content.page-turn-cover.page-turn-back:not(.quiet) {
  transform-origin: left center;
  animation: reader-page-cover-back 220ms var(--app-motion-smooth) both;
}

@keyframes reader-page-slide-forward {
  from { opacity: 0; transform: translate3d(22rpx, 0, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes reader-page-slide-back {
  from { opacity: 0; transform: translate3d(-22rpx, 0, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes reader-page-cover-forward {
  from { opacity: 0.12; transform: translate3d(12rpx, 0, 0) scaleX(0.96); }
  to { opacity: 1; transform: translate3d(0, 0, 0) scaleX(1); }
}

@keyframes reader-page-cover-back {
  from { opacity: 0.12; transform: translate3d(-12rpx, 0, 0) scaleX(0.96); }
  to { opacity: 1; transform: translate3d(0, 0, 0) scaleX(1); }
}


.reader-paragraph {
  display: block;
  color: inherit;
  font-weight: 400;
  text-align: justify;
  text-justify: inter-ideograph;
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  font-family: "KaiTi", "STKaiti", "FZKai-Z03", "PingFang SC", "Microsoft YaHei", serif;
}

.reader-progress-mark {
  display: flex;
  align-items: center;
  gap: 14rpx;
  height: 30rpx;
  margin: 0 0 22rpx;
  opacity: 0.58;
  font-family: var(--app-heading-font);
  font-size: 18rpx;
  font-variant-numeric: tabular-nums;
  letter-spacing: 1rpx;
}

.reader-progress-rail {
  width: 74rpx;
  height: 4rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: currentColor;
  opacity: 0.32;
}

.reader-progress-rail-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--app-accent);
}


.chapter-track,
.font-meter {
  position: relative;
  flex: 1;
  height: 10rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: rgba(128, 128, 128, 0.22);
}

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
  border-radius: var(--app-control-radius, 999rpx);
  color: var(--app-reader-control-text);
  /* color-mix with solid fallback for older WebViews */
  background: var(--app-reader-control);
  background: color-mix(in srgb, var(--app-reader-control) 88%, transparent);
  box-shadow: var(--app-floating-shadow);
}

.icon-button,
.quick-action,
.close-button {
  width: 58rpx;
  height: 58rpx;
  border-radius: calc(var(--app-control-radius, 999rpx) - 2rpx);
  color: var(--app-reader-control-text);
  background: var(--app-panel);
  font-size: 34rpx;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.icon-button:active,
.quick-action:active,
.close-button:active {
  opacity: 0.64;
  transform: scale(0.93);
}

/* Focus-visible ring for keyboard navigation */
.icon-button:focus-visible,
.quick-action:focus-visible,
.close-button:focus-visible,
.chapter-button:focus-visible,
.dock-tool:focus-visible,
.more-item:focus-visible,
.theme-chip:focus-visible,
.retry-button:focus-visible {
  outline: 2px solid var(--app-accent);
  outline-offset: 2px;
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
  right: 22rpx;
  bottom: 318rpx;
  z-index: 9;
  display: grid;
  gap: 12rpx;
}

.quick-action {
  width: 88rpx;
  height: 88rpx;
  border: 1rpx solid var(--app-border);
  background: var(--app-reader-control);
  box-shadow: var(--app-floating-shadow);
  font-size: 32rpx;
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
  border-radius: var(--app-card-radius, 28rpx);
  color: var(--app-reader-control-text);
  background: var(--app-reader-control);
  background: color-mix(in srgb, var(--app-reader-control) 94%, transparent);
  box-shadow: var(--app-floating-shadow);
}

.bottom-chrome {
  padding: 16rpx 18rpx 18rpx;
}

.chapter-row {
  gap: 18rpx;
}

.chapter-button {
  min-width: 112rpx;
  height: 48rpx;
  border-radius: var(--app-control-radius, 16rpx);
  color: var(--app-text);
  background: var(--app-panel);
  font-size: 24rpx;
  transition: opacity 0.15s ease;
}

.chapter-button:active {
  opacity: 0.64;
}

.chapter-button[disabled] {
  opacity: 0.32;
  pointer-events: none;
}

.dock-actions {
  gap: 12rpx;
  margin-top: 14rpx;
}

.dock-tool {
  flex: 1;
  min-width: 0;
  min-height: 88rpx;
  flex-direction: column;
  gap: 5rpx;
  border-radius: var(--app-control-radius, 16rpx);
  color: var(--app-text);
  background: var(--app-panel);
  font-size: 23rpx;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dock-tool:active {
  opacity: 0.68;
  transform: scale(0.96);
}

.dock-icon {
  font-size: 28rpx;
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
  border-radius: var(--app-card-radius, 22rpx);
  background: var(--app-panel-strong);
  box-shadow: var(--app-floating-shadow);
}

.more-item {
  width: 100%;
  min-height: 88rpx;
  justify-content: flex-start;
  padding: 0 22rpx;
  box-sizing: border-box;
  color: var(--app-text);
  background: transparent;
  font-size: 24rpx;
  transition: background 0.12s ease;
}

.more-item:active {
  background: rgba(128, 128, 128, 0.12);
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
  border-radius: var(--app-control-radius, 16rpx);
  color: var(--app-text);
  background: var(--app-panel);
  font-size: 23rpx;
  transition: opacity 0.12s ease, background 0.15s ease, color 0.15s ease;
}

.interface-tabs button:active,
.catalog-tabs button:active,
.turn-row button:active {
  opacity: 0.68;
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
  border-radius: var(--app-control-radius, 16rpx);
  color: var(--app-text);
  background: var(--app-panel);
  font-size: 28rpx;
  transition: opacity 0.12s ease;
}

.step-button:active {
  opacity: 0.6;
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
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.theme-chip:active {
  transform: scale(0.94);
}

.theme-chip.active {
  border-color: var(--app-accent);
  box-shadow: var(--app-glow);
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
  background: rgba(0, 0, 0, 0.28);
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
  border-radius: var(--app-control-radius, 18rpx);
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
  border-radius: var(--app-control-radius, 18rpx);
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
  border-radius: var(--app-card-radius, 20rpx);
  color: var(--app-muted);
  background: var(--app-panel);
  text-align: center;
  font-size: 24rpx;
}

.loading-card,
.error-card {
  width: 88%;
  margin: 44rpx auto 0;
  padding: 24rpx;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-card-radius, 22rpx);
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
  animation: dotPulse 1.2s ease-in-out infinite;
}

@keyframes dotPulse {
  0%, 100% { opacity: 0.32; transform: scale(0.8); }
  50%      { opacity: 1;    transform: scale(1.2); }
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
  min-width: 88rpx;
  min-height: 88rpx;
  height: 88rpx;
  border-radius: 16rpx;
  color: var(--app-on-accent);
  background: var(--app-accent);
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.retry-button:active {
  opacity: 0.76;
  transform: scale(0.95);
}

.brightness-mask {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: var(--app-brightness-overlay, #000000);
}
/* Note: --app-brightness-overlay falls back to #000 for older themes */

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
    padding-top: calc(12rpx + env(safe-area-inset-top));
    padding-bottom: calc(68rpx + env(safe-area-inset-bottom));
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
    right: 16rpx;
    bottom: 310rpx;
  }

  .bottom-chrome,
  .settings-panel {
    left: 18rpx;
    right: 18rpx;
    bottom: 18rpx;
  }

  .reader-content {
    width: 92%;
  }
}

/* V2 reader pass: the page is a reading surface first; controls arrive from its edges. */
.reader-page {
  background: var(--app-stage);
}

.reading-surface {
  background-image: var(--app-reader-texture);
  background-blend-mode: screen;
}

.reader-content {
  max-width: 920rpx;
}

.reader-embed.controls-open .reader-content {
  /* Chrome floats above the text: opening it must not repaginate the chapter. */
  padding-top: 22rpx;
  padding-bottom: 10rpx;
  transition: none;
}

.reader-progress-mark {
  font-family: var(--app-utility-font);
  letter-spacing: 1rpx;
}

.reader-progress-rail {
  height: 3rpx;
  border-radius: 2rpx;
}

.reader-progress-rail-fill,
.chapter-track-fill {
  background: linear-gradient(90deg, var(--app-accent-2), var(--app-accent), var(--app-accent-3));
}

.reader-chrome-enter-top {
  animation: reader-chrome-in-top var(--app-motion-duration-normal) var(--app-motion-smooth) both;
}

.reader-chrome-enter-bottom {
  animation: reader-chrome-in-bottom var(--app-motion-duration-normal) var(--app-motion-spring) both;
}

.reader-chrome-enter-side {
  animation: reader-chrome-in-side var(--app-motion-duration-normal) var(--app-motion-smooth) both;
}

.reader-settings-enter {
  animation: reader-chrome-in-bottom var(--app-motion-duration-normal) var(--app-motion-spring) both;
}

/* Keep reader chrome mounted so dismissal can be an exit transition instead of an abrupt removal. */
.top-chrome,
.quick-actions,
.bottom-chrome {
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--app-motion-duration-exit) var(--app-motion-standard), transform var(--app-motion-duration-exit) var(--app-motion-standard);
}

.top-chrome { transform: translate3d(0, -22rpx, 0); }
.quick-actions { transform: translate3d(18rpx, 0, 0); }
.bottom-chrome { transform: translate3d(0, 28rpx, 0); }

.top-chrome.reader-chrome-visible,
.quick-actions.reader-chrome-visible,
.bottom-chrome.reader-chrome-visible {
  opacity: 1;
  pointer-events: auto;
  transform: translate3d(0, 0, 0);
  transition-duration: var(--app-motion-duration-normal);
}

.top-chrome,
.bottom-chrome,
.settings-panel {
  border-width: var(--app-card-border-width, 1rpx);
  box-shadow: var(--app-card-outline), var(--app-floating-shadow);
}

.top-chrome .icon-button,
.quick-action,
.dock-tool {
  min-width: var(--app-touch-target-min, 88rpx);
  min-height: var(--app-touch-target-min, 88rpx);
}

.bottom-chrome {
  border-radius: var(--app-card-radius, 16rpx) var(--app-card-radius, 16rpx) 0 0;
}

.dock-tool {
  font-family: var(--app-utility-font);
  font-size: 20rpx;
  letter-spacing: .5rpx;
}

.catalog-mask {
  z-index: var(--app-z-modal, 400);
  align-items: stretch;
  justify-content: flex-end;
  padding: 0;
  background: rgba(1, 4, 9, 0.48);
}

.catalog-panel {
  width: min(84%, 690rpx);
  max-height: 100%;
  height: 100%;
  padding: calc(28rpx + env(safe-area-inset-top)) 28rpx calc(28rpx + env(safe-area-inset-bottom));
  border: 0;
  border-left: 1rpx solid var(--app-border);
  border-radius: var(--app-card-radius, 16rpx) 0 0 var(--app-card-radius, 16rpx);
  background: var(--app-panel-strong);
  box-shadow: -20rpx 0 70rpx rgba(0, 0, 0, 0.30);
  animation: reader-catalog-in var(--app-motion-duration-slow) var(--app-motion-smooth) both;
}

.catalog-item,
.bookmark-item {
  border-radius: var(--app-control-radius, 12rpx);
  border: 1rpx solid transparent;
  background: transparent;
}

.catalog-item:active,
.bookmark-item:active {
  border-color: var(--app-border);
  background: var(--app-input);
}

.catalog-item.active {
  color: var(--app-on-accent);
  border-color: var(--app-accent);
  background: var(--app-accent);
}

.theme-candy.reader-page .top-chrome,
.theme-candy.reader-page .bottom-chrome,
.theme-candy.reader-page .settings-panel,
.theme-candy.reader-page .catalog-panel {
  border: 2rpx solid rgba(52, 42, 50, 0.78);
}

.theme-candy.reader-page .reader-progress-rail-fill,
.theme-candy.reader-page .chapter-track-fill {
  background: linear-gradient(90deg, #55c7e8 0 35%, #ff7a59 35% 70%, #ffd34e 70% 100%);
}

.theme-sakura.reader-page .top-chrome,
.theme-sakura.reader-page .bottom-chrome,
.theme-sakura.reader-page .settings-panel {
  box-shadow: 0 10rpx 42rpx rgba(217, 96, 154, 0.16);
}

.theme-cyber.reader-page .top-chrome,
.theme-cyber.reader-page .bottom-chrome,
.theme-cyber.reader-page .settings-panel,
.theme-cyber.reader-page .catalog-panel,
.theme-cyber.reader-page .catalog-item,
.theme-cyber.reader-page .bookmark-item {
  border-radius: var(--app-card-radius, 8rpx);
}

.theme-cyber.reader-page .reader-progress-rail-fill,
.theme-cyber.reader-page .chapter-track-fill {
  background: repeating-linear-gradient(90deg, var(--app-accent) 0 22rpx, transparent 22rpx 28rpx);
}

.theme-noirGold.reader-page .catalog-panel {
  box-shadow: inset 0 0 0 8rpx rgba(213, 175, 98, 0.022), -20rpx 0 70rpx rgba(0, 0, 0, 0.40);
}

/* Reader chrome pass: tap-to-reveal controls float as rounded tools in every theme. */
.reader-page {
  --reader-chrome-radius: 30rpx;
  --reader-control-radius: 18rpx;
  --reader-catalog-radius: 32rpx;
}

.theme-xuanye.reader-page {
  --reader-chrome-radius: 28rpx;
  --reader-control-radius: 16rpx;
  --reader-catalog-radius: 30rpx;
}

.theme-candy.reader-page {
  --reader-chrome-radius: 24rpx;
  --reader-control-radius: 18rpx;
  --reader-catalog-radius: 28rpx;
}

.theme-sakura.reader-page {
  --reader-chrome-radius: 32rpx;
  --reader-control-radius: 20rpx;
  --reader-catalog-radius: 34rpx;
}

.theme-cyber.reader-page {
  --reader-chrome-radius: 20rpx;
  --reader-control-radius: 14rpx;
  --reader-catalog-radius: 24rpx;
}

.theme-noirGold.reader-page {
  --reader-chrome-radius: 26rpx;
  --reader-control-radius: 16rpx;
  --reader-catalog-radius: 30rpx;
}

.reader-page .top-chrome {
  border-radius: var(--reader-chrome-radius);
}

.reader-page .bottom-chrome,
.reader-page .settings-panel {
  border-radius: var(--reader-chrome-radius);
}

.reader-page .chapter-button,
.reader-page .dock-tool,
.reader-page .more-menu,
.reader-page .more-item,
.reader-page .interface-tab,
.reader-page .catalog-tab,
.reader-page .font-control,
.reader-page .theme-chip,
.reader-page .catalog-item,
.reader-page .bookmark-item,
.reader-page .retry-button {
  border-radius: var(--reader-control-radius);
}

.reader-page .catalog-panel {
  top: 18rpx;
  bottom: 18rpx;
  height: auto;
  margin-left: 18rpx;
  border: 1rpx solid var(--app-border);
  border-radius: var(--reader-catalog-radius);
}

.theme-cyber.reader-page .top-chrome,
.theme-cyber.reader-page .bottom-chrome,
.theme-cyber.reader-page .settings-panel {
  border-radius: var(--reader-chrome-radius);
}

.theme-cyber.reader-page .catalog-panel {
  border-radius: var(--reader-catalog-radius);
}

.theme-cyber.reader-page .catalog-item,
.theme-cyber.reader-page .bookmark-item {
  border-radius: var(--reader-control-radius);
}

@keyframes reader-chrome-in-top {
  from { opacity: 0; transform: translate3d(0, -26rpx, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes reader-chrome-in-bottom {
  from { opacity: 0; transform: translate3d(0, 34rpx, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes reader-chrome-in-side {
  from { opacity: 0; transform: translate3d(28rpx, 0, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes reader-catalog-in {
  from { opacity: 0; transform: translate3d(100%, 0, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}
</style>
