<template>
  <view class="decoder-source-page app-page" :style="themeVars">
    <view class="source-discover-top">
      <view class="source-search-pill">
        <text class="source-search-icon">⌕</text>
        <input
          class="source-search-input"
          v-model="sourceKeyword"
          placeholder="筛选发现源"
          confirm-type="search"
        />
      </view>
      <button class="source-import-scan" @tap="scanSourceQr">⌘</button>
    </view>

    <scroll-view class="decoder-source-scroll" scroll-y :show-scrollbar="false">
      <view class="source-select-card" @tap="sourceMenuVisible = !sourceMenuVisible">
        <text class="source-select-icon">📖</text>
        <text class="source-select-name">{{ sourceSelectLabel }}</text>
        <text class="source-select-arrow">{{ sourceMenuVisible ? '⌃' : '⌄' }}</text>
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
        <button class="menu-row" @tap="openImportDrawer('repo')">
          <text>扫码/链接添加书源</text>
          <text>＋</text>
        </button>
      </view>

      <view class="source-hero-card">
        <view>
          <text class="eyebrow">REAL SOURCE</text>
          <view class="source-hero-title">扫码导入真实书源</view>
          <text class="source-hero-desc">支持阅读 3.x、Legado、yuedu://、JSON 链接和源仓库详情页。</text>
        </view>
        <view class="source-hero-actions">
          <button class="source-hero-action primary" @tap="scanSourceQr">扫码</button>
          <button class="source-hero-action" @tap="openImportDrawer('repo')">链接</button>
        </view>
      </view>

      <view class="installed-source-list">
        <view
          class="installed-source-row"
          v-for="source in v2SourceRows"
          :key="source.rowKey"
          @tap="openSourceExplore(source)"
        >
          <view class="source-row-icon" :class="source.iconClass">{{ source.icon }}</view>
          <view class="source-main">
            <view class="source-name">{{ source.name }}</view>
            <text class="source-meta">{{ source.meta }}</text>
          </view>
          <button
            class="source-detail-action"
            aria-label="书源详情"
            @tap.stop="openSourceDetail(source.raw)"
          >
            ⓘ
          </button>
          <text class="chevron">›</text>
        </view>
      </view>

      <view class="management-tools">
        <view class="tools-head" @tap="toolsExpanded = !toolsExpanded">
          <view>
            <view class="tools-title">管理工具</view>
            <text class="source-hint">批量检测、分组筛选和批量启停。</text>
          </view>
          <text class="tools-toggle">{{ toolsExpanded ? '收起' : '展开' }}</text>
        </view>
        <view class="tools-body" v-if="toolsExpanded">
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

          <view class="summary-row group-summary">
            <text>分组统计</text>
            <text v-for="item in sourceGroupStats" :key="item.group">{{ item.group }} {{ item.count }}</text>
          </view>

          <view class="batch-panel readiness-panel">
            <view class="batch-head">
              <view>
                <view class="test-title">真实导入自检</view>
                <text class="source-hint">{{ importReadinessSummaryText }}</text>
              </view>
              <button class="small-action" @tap="refreshImportReadiness">刷新</button>
            </view>
            <view class="batch-result-list">
              <view class="batch-result-row" v-for="item in importReadiness.items" :key="item.id">
                <text class="batch-result-status" :class="item.state">{{ importReadinessLabel(item.state) }}</text>
                <text class="batch-result-name">{{ item.title }}</text>
                <text class="batch-result-message">{{ item.detail }}</text>
              </view>
            </view>
          </view>

          <view class="bulk-actions tools-bulk-actions">
            <button class="small-action" @tap="batchToggleVisibleSources(true)">批量启用当前结果</button>
            <button class="small-action" @tap="batchToggleVisibleSources(false)">批量停用当前结果</button>
          </view>

          <view class="batch-panel tools-batch-panel">
            <view class="batch-head">
              <view>
                <view class="test-title">批量检测</view>
                <text class="source-hint">发现页只使用已通过测试的书源；发现页会使用已通过测试的书源。失败源会保留网络失败、规则不兼容、无搜索结果或超时原因。</text>
              </view>
              <view class="batch-actions">
                <button class="small-action primary" :loading="batchTesting" @tap="runBatchSourceTest('all')">测试全部启用源</button>
                <button class="small-action" :disabled="sourceGroupFilter === '全部分组'" :loading="batchTesting" @tap="runBatchSourceTest('group')">测试当前分组</button>
                <button class="small-action" :loading="batchHealthTesting" @tap="runBatchSourceHealth('all')">健康检测</button>
              </view>
            </view>
            <input class="field compact" v-model="batchTestKeyword" placeholder="批量测试关键词，例如 星轨图书馆" />
            <view class="batch-progress" v-if="batchTesting || batchHealthTesting || batchTestResult">
              <text>{{ batchProgressText }}</text>
              <text v-if="batchTestResult">通过 {{ batchTestResult.passed }} / 失败 {{ batchTestResult.failed }} / 跳过 {{ batchTestResult.skipped || 0 }}</text>
            </view>
            <view class="batch-result-list" v-if="batchTestItems.length">
              <view class="batch-result-row" v-for="item in batchTestItems" :key="item.sourceId">
                <text class="batch-result-status" :class="item.status">{{ batchStatusLabel(item.status) }}</text>
                <text class="batch-result-name">{{ item.name }}</text>
                <text class="batch-result-message">{{ item.message }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="drawer-mask" v-if="importDrawerVisible || txtVisible || sourceDetailVisible || sourceEditVisible" @tap="closePanels"></view>

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
        maxlength="-1"
        placeholder="粘贴书源 JSON、sources 包装结构、yuedu:// 或 legado:// 一键导入链接"
      ></textarea>
      <input
        v-else
        class="field"
        v-model="sourceImportUrl"
        :placeholder="sourceImportMode === 'repo' ? '粘贴 yck2026/yckceo 源仓库详情页 URL' : '粘贴 JSON 直链或一键导入链接'"
      />
      <text class="source-hint">{{ sourceImportHint }}</text>

      <view class="preview-card" v-if="sourceImportPreview">
        <view class="test-title">导入前预览</view>
        <text class="source-hint">新增 {{ sourceImportPreview.imported }} / 覆盖 {{ sourceImportPreview.updated }} / 不兼容 {{ sourceImportPreview.incompatible }}</text>
        <text class="source-hint">分组：{{ sourceImportPreview.groups.join('、') || '未分组' }}</text>
        <text class="source-hint" v-if="sourceImportPreview.sourceUrl">JSON：{{ sourceImportPreview.sourceUrl }}</text>
      </view>
      <button class="outline-action wide" :loading="sourceImportPreviewing" @tap="previewSourceImport">导入前预览</button>
      <button class="submit-button" :loading="sourceImporting" @tap="submitSourceImport">导入书源</button>

      <view class="quick-actions">
        <button class="outline-action" @tap="importFromClipboard">剪贴板</button>
        <button class="outline-action" @tap="chooseSourceJsonFile">本地 JSON</button>
        <button class="outline-action" @tap="scanSourceQr">扫码</button>
        <button class="outline-action" @tap="goSourceMarket">源仓库页</button>
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

    <view class="import-drawer app-floating-panel" v-if="sourceEditVisible && editingSource">
      <view class="drawer-head">
        <view>
          <text class="eyebrow">EDIT SOURCE</text>
          <view class="drawer-title">编辑书源</view>
        </view>
        <button class="round-action" @tap="closePanels">×</button>
      </view>
      <input class="field" v-model="sourceEditName" placeholder="书源名称" />
      <input class="field" v-model="sourceEditGroup" placeholder="书源分组" />
      <text class="source-hint">{{ editingSource.importedAt ? '用户导入书源可改名、改分组和删除。' : '内置书源只保存本地显示名和分组，不会修改原始规则。' }}</text>
      <button class="submit-button" @tap="saveSourceEdit">保存修改</button>
    </view>

    <view class="import-drawer source-detail-drawer app-floating-panel" v-if="sourceDetailVisible && selectedSource">
      <view class="drawer-head">
        <view>
          <text class="eyebrow">SOURCE DETAIL</text>
          <view class="drawer-title">{{ selectedSource.name }}</view>
        </view>
        <button class="round-action" @tap="closePanels">×</button>
      </view>

      <scroll-view class="source-detail-scroll" scroll-y :show-scrollbar="false">
        <view class="detail-status" :class="sourceStatusClass">
          <view>
            <view class="detail-status-title">
              {{ sourceStatusTitle }}
            </view>
            <text class="detail-status-desc">
              {{ sourceStatusDesc }}
            </text>
          </view>
          <button class="status-switch" :class="{ active: selectedSource.enabled }" @tap="toggleSelectedSource">
            {{ selectedSource.enabled ? '停用' : '启用' }}
          </button>
        </view>

        <view class="detail-grid">
          <view class="detail-item">
            <text class="detail-label">分组</text>
            <text class="detail-value">{{ selectedSource.group || '未分组' }}</text>
          </view>
          <view class="detail-item">
            <text class="detail-label">来源</text>
            <text class="detail-value">{{ selectedSource.importedAt ? '本地导入' : '内置书源' }}</text>
          </view>
          <view class="detail-item">
            <text class="detail-label">格式</text>
            <text class="detail-value">{{ sourceDiagnostics.formatVersion || 'legacy' }}</text>
          </view>
          <view class="detail-item">
            <text class="detail-label">权重</text>
            <text class="detail-value">{{ sourceDiagnostics.weight || 0 }}</text>
          </view>
          <view class="detail-item wide">
            <text class="detail-label">地址</text>
            <text class="detail-value one-line">{{ selectedSource.baseUrl || '无地址' }}</text>
          </view>
          <view class="detail-item wide" v-if="sourceDiagnostics.comment">
            <text class="detail-label">备注</text>
            <text class="detail-value">{{ sourceDiagnostics.comment }}</text>
          </view>
        </view>

        <view class="compatibility-card" v-if="sourceDiagnostics">
          <view class="test-title">兼容级别：{{ sourceDiagnostics.compatibilityLevel }}</view>
          <text class="source-hint">当前环境：{{ sourceDiagnostics.environmentSupported ? '支持' : '不支持' }}</text>
          <text class="source-hint">下一步：{{ sourceDiagnostics.nextAction }}</text>
          <view class="quick-actions" v-if="sourceDiagnostics.compatibilityLevel === 'need_login'">
            <button class="outline-action" @tap="openSelectedSourceLogin">打开登录页</button>
            <button class="outline-action" @tap="saveSelectedSourceLogin">保存登录状态</button>
            <button class="outline-action" @tap="clearSelectedSourceCookie">清除该源 Cookie</button>
          </view>
        </view>

        <view class="rule-state-head" v-if="sourceDiagnostics">
          <view class="test-title">规则状态</view>
          <text class="source-hint">搜索、详情、目录和正文规则决定真实阅读闭环能否跑通。</text>
        </view>
        <view class="rule-summary" v-if="sourceDiagnostics">
          <view
            class="rule-pill"
            v-for="rule in sourceRuleSummary"
            :key="rule.key"
            :class="{ active: rule.ready }"
          >
            <text>{{ rule.label }}</text>
            <text>{{ rule.ready ? '已配置' : '缺失' }}</text>
          </view>
        </view>
        <view class="rule-summary feature-summary" v-if="sourceFeatureTags.length">
          <view class="rule-pill active" v-for="feature in sourceFeatureTags" :key="feature">
            <text>{{ feature }}</text>
            <text>3.X</text>
          </view>
        </view>

        <view class="health-card" v-if="sourceDiagnostics">
          <view>
            <view class="test-title">健康评分 {{ sourceHealthScore }}</view>
            <text class="source-hint">全链路检测会依次验证搜索、详情、目录、正文和加入书架缓存。</text>
            <text class="source-hint">{{ sourceHealthText }}</text>
            <text class="source-hint source-health-warning" v-if="sourceHealthFailureText">{{ sourceHealthFailureText }}</text>
          </view>
          <view class="health-meter">
            <view class="health-meter-fill" :style="{ width: `${sourceHealthScore}%` }"></view>
          </view>
        </view>

        <view class="anti-crawler-card" v-if="selectedSource">
          <view class="test-head">
            <view>
              <view class="test-title">反爬策略</view>
              <text class="source-hint">为当前书源配置请求间隔、User-Agent、Cookie、Referer、编码和失败重试。</text>
            </view>
            <button class="small-action primary" :loading="sourceAntiSaving" @tap="saveAntiCrawler">保存</button>
          </view>
          <view class="anti-grid">
            <view class="anti-field">
              <text>请求间隔(ms)</text>
              <input class="field compact" type="number" v-model="antiCrawler.requestIntervalMs" />
            </view>
            <view class="anti-field">
              <text>重试次数</text>
              <input class="field compact" type="number" v-model="antiCrawler.retryCount" />
            </view>
            <view class="anti-field">
              <text>重试间隔(ms)</text>
              <input class="field compact" type="number" v-model="antiCrawler.retryIntervalMs" />
            </view>
            <view class="anti-field">
              <text>编码</text>
              <view class="charset-row">
                <button
                  class="charset-chip"
                  v-for="item in charsetOptions"
                  :key="item"
                  :class="{ active: antiCrawler.charset === item }"
                  @tap="antiCrawler.charset = item"
                >{{ item }}</button>
              </view>
            </view>
          </view>
          <input class="field compact" v-model="antiCrawler.userAgent" placeholder="User-Agent，可留空使用默认" />
          <textarea class="field headers-field" v-model="antiCrawler.headersText" placeholder="Headers，每行一个：Cookie: xxx&#10;Referer: https://example.com"></textarea>
        </view>

        <view class="test-panel">
          <view class="test-head">
            <view>
              <view class="test-title">单源搜索测试</view>
              <text class="source-hint">用于确认这个书源能否独立搜索，避免拖慢发现页。</text>
            </view>
            <view class="test-actions">
              <button class="small-action primary" :loading="sourceTesting" @tap="runSourceTest">搜索测试</button>
              <button class="small-action" :loading="sourceFlowTesting" @tap="runSourceReadingFlowTest">完整阅读测试</button>
              <button class="small-action" :loading="sourceHealthTesting" @tap="runSourceHealthCheckTest">健康检测</button>
            </view>
          </view>
          <input class="field compact" v-model="testSourceKeyword" placeholder="输入测试关键词，例如 星轨图书馆" />
          <view class="source-progress-line" v-if="sourceProgressText">{{ sourceProgressText }}</view>
          <view class="test-result" v-if="sourceTestResult">
            <view class="test-result-title">{{ sourceTestResult.title }}</view>
            <text class="test-result-desc">{{ sourceTestResult.desc }}</text>
            <view class="test-book" v-for="item in sourceTestResult.items" :key="item.bookId || item.title">
              {{ item.title }} · {{ item.subtitle || '在线结果' }}
            </view>
          </view>
        </view>

      </scroll-view>
      <view class="source-detail-fixed-footer" v-if="selectedSource.importedAt">
        <view class="source-delete-zone">
          <view>
            <view class="test-title">删除用户书源</view>
            <text class="source-hint">删除后将同时清理本地设置、Cookie 和后端同名书源，此操作不可撤销。</text>
          </view>
          <button class="source-delete-button" @tap="confirmRemoveSource(selectedSource)">删除此书源</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { importBookFromTextAsync, parseTxtChapters } from '../../common/books.js'
import {
  batchCheckSourceHealth,
  batchTestSources,
  batchSetSourcesEnabled,
  deleteUserSource,
  getSourceAntiCrawlerSettings,
  getSourceDiagnostics,
  getSourceExploreEntries,
  getSourceConfigs,
  applyImportPreview,
  importSourcesFromAny,
  previewSourcesFromAny,
  previewSourcesImport,
  runSourceHealthCheck,
  runSourceReadingFlow,
  saveSourceAntiCrawlerSettings,
  setSourceEnabled,
  testSourceSearch,
  updateSourceMetadata
} from '../../common/bookSources.js'
import { getAppThemeId, getAppThemeStyle } from '../../common/appTheme.js'
import {
  chooseSingleFile,
  getClipboardText,
  getPickedFileName,
  normalizeImportPayload,
  readImportFilePayload,
  scanImportPayload
} from '../../common/importAdapters.js'
import {
  buildImportReadiness,
  summarizeImportReadiness
} from '../../common/importReadiness.js'
import { resolveMarketScanTarget } from '../../common/sourceMarket.js'
import { friendlyErrorMessage } from '../../common/uiFeedback.js'
import { clearSourceCookies, saveSourceCookie } from '../../common/sourceCookieJar.js'
import { openSourceLogin, readSourceLoginCookie } from '../../common/webViewBridge.js'
import apiClient from '../../common/apiClient.js'
import {
  addBackendBookWithChapters,
  deleteBackendSourceMatchingLocal,
  syncBackendSourceFromLocal
} from '../../common/backendLibrary.js'

export default {
  data() {
    return {
      sources: [],
      toolsExpanded: false,
      importDrawerVisible: false,
      sourceMenuVisible: false,
      txtVisible: false,
      sourceImportMode: 'repo',
      sourceImportText: '',
      sourceImportUrl: '',
      sourceImporting: false,
      sourceImportPreviewing: false,
      sourceImportPreview: null,
      sourceImportPreviewRaw: '',
      sourceDetailVisible: false,
      sourceEditVisible: false,
      editingSource: null,
      sourceEditName: '',
      sourceEditGroup: '',
      selectedSource: null,
      sourceDiagnostics: null,
      sourceTesting: false,
      sourceFlowTesting: false,
      sourceHealthTesting: false,
      sourceProgressText: '',
      sourceAntiSaving: false,
      antiCrawler: {
        requestIntervalMs: 1500,
        retryCount: 0,
        retryIntervalMs: 800,
        charset: 'auto',
        userAgent: '',
        headersText: ''
      },
      charsetOptions: ['auto', 'utf-8', 'gbk', 'gb2312'],
      testSourceKeyword: '星轨图书馆',
      sourceTestResult: null,
      batchTesting: false,
      batchHealthTesting: false,
      batchTestKeyword: '星轨图书馆',
      batchProgress: { current: 0, total: 0 },
      batchTestResult: null,
      batchTestItems: [],
      importReadiness: buildImportReadiness(),
      sourceFilter: 'all',
      sourceSort: 'manual',
      sourceKeyword: '',
      sourceGroupFilter: '全部分组',
      themeId: getAppThemeId(),
      importTitle: '',
      importAuthor: '',
      importFileName: '',
      importFileText: '',
      filterOptions: [
        { label: '全部', value: 'all' },
        { label: '启用', value: 'enabled' },
        { label: '停用', value: 'disabled' },
        { label: '不兼容', value: 'incompatible' }
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
      if (this.sourceImportMode === 'repo') return '粘贴 yck2026/yckceo 详情页，系统会通过后端代理下载页面并优先读取 JSON 地址。'
      return '支持直接 JSON 链接、yuedu://、legado:// 和包含 src= 的链接；网络内容会通过后端代理下载。'
    },
    sourceStats() {
      return {
        total: this.sources.length,
        enabled: this.sources.filter(source => source.enabled).length,
        incompatible: this.sources.filter(source => !getSourceDiagnostics(source).compatible).length,
        searchable: this.sources.filter(source => getSourceDiagnostics(source).searchable).length
      }
    },
    sourceSelectLabel() {
      const first = this.visibleSources.find(source => source.enabled) || this.sources.find(source => source.enabled) || this.sources[0]
      return first ? first.name : '扫码导入书源'
    },
    v2SourceRows() {
      const rows = [
        ...this.visibleSources.map((source, index) => ({
          rowKey: source.id,
          type: 'source',
          id: source.id,
          name: source.name,
          meta: `${source.group || '未分组'} · ${source.enabled ? '已启用' : '已停用'}`,
          icon: this.sourceListIcon(index),
          iconClass: this.sourceListIconClass(index),
          raw: source
        }))
      ]
      return rows.slice(0, 30)
    },
    sourceGroupStats() {
      const counts = {}
      this.sources.forEach(source => {
        const group = source.group || '未分组'
        counts[group] = (counts[group] || 0) + 1
      })
      return Object.keys(counts)
        .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
        .map(group => ({ group, count: counts[group] }))
    },
    importReadinessSummaryText() {
      return summarizeImportReadiness(this.importReadiness).text
    },
    batchProgressText() {
      if (this.batchTesting || this.batchHealthTesting) {
        return `${this.batchHealthTesting ? '正在健康检测' : '正在测试'} ${this.batchProgress.current}/${this.batchProgress.total}`
      }
      if (this.batchTestResult) {
        return `检测完成 ${this.batchTestResult.total} 个书源`
      }
      return ''
    },
    sourceHealthScore() {
      const health = this.sourceDiagnostics && this.sourceDiagnostics.health
      return health && Number.isFinite(Number(health.score)) ? Number(health.score) : 0
    },
    sourceHealthText() {
      const health = this.sourceDiagnostics && this.sourceDiagnostics.health
      if (!health || !health.checkedAt) return '尚未进行全链路健康检测'
      return `${health.status === 'passed' ? '健康' : '异常'} · ${health.passed}/${health.stageCount} 阶段通过 · ${health.message || ''}`
    },
    sourceHealthFailureText() {
      const health = this.sourceDiagnostics && this.sourceDiagnostics.health
      if (!health || health.status !== 'failed') return ''
      const stages = Array.isArray(health.stages) ? health.stages : []
      const failedStage = stages.find(stage => stage && stage.status === 'failed')
      const stageName = failedStage && (failedStage.title || failedStage.id) || health.failedStage || '未知阶段'
      const message = failedStage && failedStage.message || health.message || ''
      return `失败阶段：${stageName}${message ? ` · ${message}` : ''}`
    },
    sourceReasonText() {
      const reasons = this.sourceDiagnostics && this.sourceDiagnostics.reasons || []
      return reasons.length ? reasons.join('、') : '包含当前 H5 解析器暂不支持的复杂规则。'
    },
    sourceStatusClass() {
      const status = this.sourceDiagnostics && this.sourceDiagnostics.networkStatus
      return {
        compatible: status === 'untested',
        passed: status === 'passed',
        failed: status === 'failed',
        incompatible: status === 'incompatible'
      }
    },
    sourceStatusTitle() {
      if (!this.sourceDiagnostics) return '书源状态'
      return this.sourceDiagnostics.statusTitle || '规则兼容，待网络测试'
    },
    sourceStatusDesc() {
      if (!this.sourceDiagnostics) return ''
      return this.sourceDiagnostics.statusDesc || '网络是否可用以单源测试为准'
    },
    sourceRuleSummary() {
      const summary = this.sourceDiagnostics && this.sourceDiagnostics.ruleSummary || {}
      return [
        { key: 'search', label: '搜索', ready: !!summary.search },
        { key: 'bookInfo', label: '详情', ready: !!summary.bookInfo },
        { key: 'toc', label: '目录', ready: !!summary.toc },
        { key: 'content', label: '正文', ready: !!summary.content },
        { key: 'explore', label: '发现', ready: !!summary.explore }
      ]
    },
    sourceFeatureTags() {
      const flags = this.sourceDiagnostics && this.sourceDiagnostics.featureFlags || {}
      return [
        flags.login ? '登录' : '',
        flags.explore ? '发现' : '',
        flags.cookie ? 'Cookie' : '',
        flags.headers ? 'Headers' : '',
        flags.webView ? 'WebView' : '',
        flags.jsRule ? 'JS 规则' : ''
      ].filter(Boolean)
    },
    sourceGroups() {
      const groups = this.sources.map(source => source.group || '未分组')
      return ['全部分组', ...Array.from(new Set(groups))]
    },
    visibleSources() {
      const keyword = this.sourceKeyword.trim().toLowerCase()
      const list = this.sources.filter(source => {
        if (this.sourceFilter === 'enabled' && !source.enabled) return false
        if (this.sourceFilter === 'disabled' && source.enabled) return false
        if (this.sourceFilter === 'incompatible' && getSourceDiagnostics(source).compatible) return false
        if (this.sourceGroupFilter !== '全部分组' && source.group !== this.sourceGroupFilter) return false
        if (!keyword) return true
        return [source.name, source.group, source.baseUrl, source.compatibility]
          .some(value => String(value || '').toLowerCase().includes(keyword))
      })
      return this.sortSources(list)
    }
  },
  onShow() {
    this.themeId = getAppThemeId()
    this.sources = getSourceConfigs()
    this.refreshImportReadiness()
  },
  methods: {
    sourceListIcon(index) {
      const icons = ['📘', '☯', '🌈', '八', '⑬']
      return icons[index % icons.length]
    },
    sourceListIconClass(index) {
      return ['blue', 'ink', 'rainbow', 'plain', 'red'][index % 5]
    },
    refreshImportReadiness() {
      this.importReadiness = buildImportReadiness()
    },
    importReadinessLabel(state) {
      if (state === 'ready') return '可用'
      if (state === 'blocked') return '受限'
      return '检查'
    },
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
      this.sourceImportPreview = null
    },
    openImportDrawer(mode = this.sourceImportMode) {
      this.sourceImportMode = mode
      this.importDrawerVisible = true
      this.txtVisible = false
      this.sourceEditVisible = false
      this.sourceMenuVisible = false
    },
    openSourcePanel() {
      this.goSourceMarket()
    },
    openTxtPanel() {
      this.txtVisible = true
      this.importDrawerVisible = false
      this.sourceEditVisible = false
      this.sourceMenuVisible = false
    },
    closePanels() {
      this.importDrawerVisible = false
      this.txtVisible = false
      this.sourceDetailVisible = false
      this.sourceEditVisible = false
      this.sourceMenuVisible = false
      this.selectedSource = null
      this.editingSource = null
      this.sourceDiagnostics = null
      this.sourceTestResult = null
      this.sourceAntiSaving = false
      this.sourceImportPreview = null
      this.sourceImportText = ''
      this.sourceImportUrl = ''
      this.sources = getSourceConfigs()
    },
    openSourceDetail(source) {
      this.selectedSource = source
      this.sourceDiagnostics = getSourceDiagnostics(source)
      this.syncAntiCrawlerForm(source)
      this.testSourceKeyword = this.getSourceTestKeyword(source)
      this.sourceTestResult = null
      this.importDrawerVisible = false
      this.txtVisible = false
      this.sourceEditVisible = false
      this.sourceMenuVisible = false
      this.sourceDetailVisible = true
    },
    selectedSourceLoginUrl() {
      const source = this.selectedSource || {}
      const raw = source.raw || source
      return String(raw.loginUrl || source.baseUrl || raw.bookSourceUrl || '').trim()
    },
    openSelectedSourceLogin() {
      try {
        openSourceLogin(this.selectedSourceLoginUrl())
      } catch (error) {
        uni.showToast({ title: friendlyErrorMessage(error, '打开登录页失败'), icon: 'none' })
      }
    },
    saveSelectedSourceLogin() {
      try {
        const url = this.selectedSourceLoginUrl()
        const cookie = readSourceLoginCookie(url)
        if (!cookie) throw new Error('未读取到登录 Cookie，请先完成手动登录')
        saveSourceCookie(this.selectedSource.id, url, cookie)
        uni.showToast({ title: '登录状态已保存', icon: 'none' })
      } catch (error) {
        uni.showToast({ title: friendlyErrorMessage(error, '保存登录状态失败'), icon: 'none' })
      }
    },
    clearSelectedSourceCookie() {
      const removed = clearSourceCookies(this.selectedSource && this.selectedSource.id)
      uni.showToast({ title: removed ? '该源 Cookie 已清除' : '该源没有已保存 Cookie', icon: 'none' })
    },
    getSourceTestKeyword(source) {
      const raw = source && source.raw || {}
      const ruleSearch = raw.ruleSearch && typeof raw.ruleSearch === 'object' ? raw.ruleSearch : {}
      return String(ruleSearch.checkKeyWord || raw.checkKeyWord || this.testSourceKeyword || '星轨图书馆').trim()
    },
    openSourceExplore(row) {
      if (!row || !row.raw) return
      const result = getSourceExploreEntries(row.raw)
      if (!result.available) {
        uni.showToast({ title: result.reason || '该书源仅支持书名搜索', icon: 'none' })
        return
      }
      uni.navigateTo({
        url: `/pages/sourceExplore/sourceExplore?sourceId=${encodeURIComponent(row.id)}`
      })
    },
    openSourceEdit(source) {
      this.editingSource = source
      this.sourceEditName = source.name
      this.sourceEditGroup = source.group || '未分组'
      this.importDrawerVisible = false
      this.txtVisible = false
      this.sourceDetailVisible = false
      this.sourceMenuVisible = false
      this.sourceEditVisible = true
    },
    saveSourceEdit() {
      if (!this.editingSource) return
      try {
        updateSourceMetadata(this.editingSource.id, {
          name: this.sourceEditName,
          group: this.sourceEditGroup
        })
        this.sources = getSourceConfigs()
        uni.showToast({ title: '书源信息已保存', icon: 'none' })
        this.closePanels()
      } catch (error) {
        uni.showToast({ title: friendlyErrorMessage(error, '保存书源失败'), icon: 'none' })
      }
    },
    sourceAvailabilityLabel(source) {
      const diagnostics = getSourceDiagnostics(source)
      if (!diagnostics.compatible) return '不兼容'
      if (diagnostics.networkStatus === 'passed') return '可搜索'
      if (diagnostics.networkStatus === 'failed') return '不可用'
      return '待检测'
    },
    sourceAvailabilityClass(source) {
      const diagnostics = getSourceDiagnostics(source)
      if (!diagnostics.compatible) return 'incompatible'
      if (diagnostics.networkStatus === 'passed') return 'passed'
      if (diagnostics.networkStatus === 'failed') return 'failed'
      return 'untested'
    },
    batchStatusLabel(status) {
      if (status === 'passed') return '通过'
      if (status === 'failed') return '失败'
      if (status === 'skipped') return '不兼容'
      return '未测试'
    },
    getBatchSourceIds(scope) {
      return this.sources
        .filter(source => source.enabled)
        .filter(source => {
          if (scope !== 'group') return true
          if (this.sourceGroupFilter === '全部分组') return true
          return source.group === this.sourceGroupFilter
        })
        .map(source => source.id)
    },
    async runBatchSourceTest(scope = 'all') {
      const sourceIds = this.getBatchSourceIds(scope)
      if (!sourceIds.length) {
        uni.showToast({ title: scope === 'group' ? '当前分组没有启用书源' : '没有启用书源可检测', icon: 'none' })
        return
      }
      this.batchTesting = true
      this.batchTestResult = null
      this.batchTestItems = []
      this.batchProgress = { current: 0, total: sourceIds.length }
      try {
        const result = await batchTestSources({
          keyword: this.batchTestKeyword,
          sourceIds,
          onProgress: item => {
            this.batchProgress = { current: item.index, total: item.total }
            this.batchTestItems = [...this.batchTestItems.filter(row => row.sourceId !== item.sourceId), item]
          }
        })
        this.batchTestResult = result
        this.batchTestItems = result.results
        this.sources = getSourceConfigs()
        uni.showToast({ title: `检测完成：通过 ${result.passed} / 失败 ${result.failed}`, icon: 'none' })
      } catch (error) {
        uni.showToast({ title: friendlyErrorMessage(error, '批量检测失败'), icon: 'none' })
      } finally {
        this.batchTesting = false
      }
    },
    async runBatchSourceHealth(scope = 'all') {
      const sourceIds = this.getBatchSourceIds(scope)
      if (!sourceIds.length) {
        uni.showToast({ title: scope === 'group' ? '当前分组没有启用书源' : '没有启用书源可检测', icon: 'none' })
        return
      }
      this.batchHealthTesting = true
      this.batchTestResult = null
      this.batchTestItems = []
      this.batchProgress = { current: 0, total: sourceIds.length }
      try {
        const result = await batchCheckSourceHealth({
          keyword: this.batchTestKeyword,
          sourceIds,
          onProgress: item => {
            this.batchProgress = { current: item.index, total: item.total }
            this.batchTestItems = [
              ...this.batchTestItems.filter(row => row.sourceId !== item.sourceId),
              {
                ...item,
                message: `健康评分 ${item.score || 0} · ${item.message || ''}`
              }
            ]
          }
        })
        this.batchTestResult = { ...result, skipped: 0 }
        this.batchTestItems = result.results.map(item => ({
          ...item,
          message: `健康评分 ${item.score || 0} · ${item.message || ''}`
        }))
        this.sources = getSourceConfigs()
        this.refreshSelectedSource()
        uni.showToast({ title: `健康检测完成：通过 ${result.passed} / 失败 ${result.failed}`, icon: 'none' })
      } catch (error) {
        uni.showToast({ title: friendlyErrorMessage(error, '批量健康检测失败'), icon: 'none' })
      } finally {
        this.batchHealthTesting = false
      }
    },
    refreshSelectedSource() {
      if (!this.selectedSource) return
      const latest = getSourceConfigs().find(source => source.id === this.selectedSource.id)
      if (!latest) {
        this.closePanels()
        return
      }
      this.selectedSource = latest
      this.sourceDiagnostics = getSourceDiagnostics(latest)
      this.syncAntiCrawlerForm(latest)
    },
    syncAntiCrawlerForm(source) {
      if (!source) return
      const settings = getSourceAntiCrawlerSettings(source.id)
      this.antiCrawler = {
        requestIntervalMs: settings.requestIntervalMs,
        retryCount: settings.retryCount,
        retryIntervalMs: settings.retryIntervalMs,
        charset: settings.charset,
        userAgent: settings.userAgent,
        headersText: settings.headersText
      }
    },
    saveAntiCrawler() {
      if (!this.selectedSource) return
      this.sourceAntiSaving = true
      try {
        saveSourceAntiCrawlerSettings(this.selectedSource.id, this.antiCrawler)
        this.sources = getSourceConfigs()
        this.refreshSelectedSource()
        uni.showToast({ title: '反爬策略已保存', icon: 'none' })
      } catch (error) {
        uni.showToast({ title: friendlyErrorMessage(error, '保存反爬策略失败'), icon: 'none' })
      } finally {
        this.sourceAntiSaving = false
      }
    },
    toggleSelectedSource() {
      if (!this.selectedSource) return
      this.toggleSource(this.selectedSource)
      this.refreshSelectedSource()
    },
    async runSourceTest() {
      if (!this.selectedSource) return
      this.sourceTesting = true
      this.sourceTestResult = null
      this.sourceProgressText = '搜索测试中…'
      try {
        const result = await testSourceSearch(this.selectedSource.id, this.testSourceKeyword)
        this.sourceProgressText = '搜索测试完成'
        this.sourceTestResult = {
          title: `搜索完成：${result.count} 条结果`,
          desc: result.count ? '已通过网络测试，发现页会使用它搜索。' : '网络请求成功，已记录为可用；这个关键词没有返回书籍。',
          items: result.results
        }
      } catch (error) {
        const isCompatible = this.sourceDiagnostics && this.sourceDiagnostics.compatible
        this.sourceTestResult = {
          title: '测试未通过',
          desc: isCompatible
            ? `${friendlyErrorMessage(error, '网络请求失败')}。规则本身仍兼容，发现页会跳过它。通常是目标站不可访问、跨域代理未生效或站点限制请求。`
            : friendlyErrorMessage(error, '书源测试失败'),
          items: []
        }
      } finally {
        this.sources = getSourceConfigs()
        this.refreshSelectedSource()
        this.sourceTesting = false
        setTimeout(() => { this.sourceProgressText = '' }, 1200)
      }
    },
    async runSourceReadingFlowTest() {
      if (!this.selectedSource) return
      this.sourceFlowTesting = true
      this.sourceTestResult = null
      this.sourceProgressText = '完整阅读测试中：搜索、目录和正文解析…'
      try {
        const result = await runSourceReadingFlow(this.selectedSource.id, this.testSourceKeyword)
        let backendSynced = false
        let backendSyncMessage = ''
        if (apiClient.getToken()) {
          try {
            this.sourceProgressText = '完整阅读测试中：同步后端书架…'
            const backendSource = await syncBackendSourceFromLocal(this.selectedSource)
            await addBackendBookWithChapters({
              ...result.book,
              sourceId: backendSource && backendSource.backendId
            }, result.chapters)
            backendSynced = true
            backendSyncMessage = '，已同步后端书架'
          } catch (syncError) {
            backendSyncMessage = `，但后端书架同步失败：${friendlyErrorMessage(syncError, '同步失败')}`
          }
        }
        this.sourceProgressText = '完整阅读测试完成'
        this.sourceTestResult = {
          title: `完整阅读测试通过：${result.book.title}`,
          desc: `已完成搜索、详情、目录、正文，并加入书架缓存：${result.chapter.title}${backendSyncMessage}`,
          items: [
            ...result.stages.map(stage => ({
              bookId: stage.id,
              title: stage.title,
              subtitle: stage.message
            })),
            ...(apiClient.getToken() ? [{
              bookId: 'backendShelf',
              title: '后端书架同步',
              subtitle: backendSynced ? '通过' : backendSyncMessage.replace(/^，/, '')
            }] : [])
          ]
        }
        uni.showToast({ title: backendSynced ? '已加入书架并同步后端' : '已加入书架并缓存首章', icon: 'none' })
      } catch (error) {
        const stages = Array.isArray(error.flowStages) ? error.flowStages : []
        this.sourceTestResult = {
          title: '完整阅读测试未通过',
          desc: friendlyErrorMessage(error, '真实阅读闭环失败'),
          items: stages.map(stage => ({
            bookId: stage.id,
            title: stage.title,
            subtitle: stage.message
          }))
        }
      } finally {
        this.sources = getSourceConfigs()
        this.refreshSelectedSource()
        this.sourceFlowTesting = false
        setTimeout(() => { this.sourceProgressText = '' }, 1200)
      }
    },
    async runSourceHealthCheckTest() {
      if (!this.selectedSource) return
      this.sourceHealthTesting = true
      this.sourceTestResult = null
      this.sourceProgressText = '健康检测中：轻量验证搜索、目录和正文…'
      try {
        const result = await runSourceHealthCheck(this.selectedSource.id, this.testSourceKeyword)
        this.sourceProgressText = '健康检测完成'
        this.sourceTestResult = {
          title: `健康检测${result.status === 'passed' ? '通过' : '未通过'}：${result.score}`,
          desc: result.message || `全链路阶段通过 ${result.passed}/${result.stageCount}`,
          items: (result.stages || []).map(stage => ({
            bookId: stage.id,
            title: `${stage.title} · ${stage.status === 'passed' ? '通过' : '失败'}`,
            subtitle: `${stage.message || ''}${stage.elapsedMs ? ` · ${stage.elapsedMs}ms` : ''}`
          }))
        }
        uni.showToast({ title: `健康评分 ${result.score}`, icon: 'none' })
      } catch (error) {
        this.sourceTestResult = {
          title: '健康检测未通过',
          desc: friendlyErrorMessage(error, '全链路健康检测失败'),
          items: []
        }
      } finally {
        this.sources = getSourceConfigs()
        this.refreshSelectedSource()
        this.sourceHealthTesting = false
        setTimeout(() => { this.sourceProgressText = '' }, 1200)
      }
    },
    async submitSourceImport() {
      const raw = String(this.sourceImportMode === 'json' ? this.sourceImportText : this.sourceImportUrl).trim()
      if (!raw) {
        uni.showToast({ title: '请先粘贴书源内容或 URL', icon: 'none' })
        return
      }
      if (!this.sourceImportPreview || this.sourceImportPreviewRaw !== raw) {
        await this.previewSourceImport()
        if (this.sourceImportPreview) {
          uni.showToast({ title: '已生成导入预览，请再次确认', icon: 'none' })
        }
        return
      }
      const result = await this.applySourceImportPreview('已导入')
      if (result) {
        this.sourceImportText = ''
        this.sourceImportUrl = ''
        this.sourceImportPreview = null
        this.sourceImportPreviewRaw = ''
      }
    },
    async previewSourceImport() {
      const raw = String(this.sourceImportMode === 'json' ? this.sourceImportText : this.sourceImportUrl).trim()
      if (!raw) {
        uni.showToast({ title: '请先粘贴书源内容或 URL', icon: 'none' })
        return
      }
      this.sourceImportPreviewing = true
      try {
        this.sourceImportPreview = this.sourceImportMode === 'json'
          ? previewSourcesImport(raw)
          : await previewSourcesFromAny(raw)
        this.sourceImportPreviewRaw = raw
      } catch (error) {
        this.sourceImportPreview = null
        this.sourceImportPreviewRaw = ''
        uni.showToast({ title: friendlyErrorMessage(error, '当前内容无法预览，请确认是书源 JSON 或 URL'), icon: 'none' })
      } finally {
        this.sourceImportPreviewing = false
      }
    },
    async applySourceImportPreview(successPrefix = '已导入') {
      if (!this.sourceImportPreview) return null
      this.sourceImporting = true
      try {
        const result = applyImportPreview(this.sourceImportPreview)
        this.sources = getSourceConfigs()
        uni.showToast({
          title: `${successPrefix}：${result.imported} 新增 / ${result.updated} 覆盖 / ${result.skipped || 0} 跳过`,
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
    async importFromClipboard() {
      try {
        const text = await getClipboardText(uni)
        this.sourceImportMode = 'json'
        this.sourceImportText = text
        this.sourceImportUrl = ''
        this.importDrawerVisible = true
        await this.previewSourceImport()
        if (this.sourceImportPreview) {
          uni.showToast({ title: '已读取剪贴板，请确认导入', icon: 'none' })
        }
      } catch (error) {
        uni.showToast({ title: error.message || '读取剪贴板失败', icon: 'none' })
      }
    },
    async chooseSourceJsonFile() {
      try {
        const file = await chooseSingleFile(uni, {
          extension: ['.json'],
          label: '本地 JSON'
        })
        const payload = await readImportFilePayload(file, {
          extension: ['.json'],
          message: '请选择 .json 书源文件'
        })
        this.sourceImportMode = 'json'
        this.sourceImportText = payload.text || payload.url
        this.sourceImportUrl = ''
        this.importDrawerVisible = true
        await this.previewSourceImport()
        if (this.sourceImportPreview) {
          uni.showToast({ title: '已读取本地 JSON，请确认导入', icon: 'none' })
        }
      } catch (error) {
        uni.showToast({ title: error.message || '读取 JSON 失败', icon: 'none' })
      }
    },
    toggleSource(source) {
      setSourceEnabled(source.id, !source.enabled)
      this.sources = getSourceConfigs()
      this.refreshSelectedSource()
    },
    batchToggleVisibleSources(enabled) {
      const ids = this.visibleSources.map(source => source.id)
      if (!ids.length) {
        uni.showToast({ title: '当前结果没有可操作书源', icon: 'none' })
        return
      }
      const result = batchSetSourcesEnabled(ids, enabled)
      this.sources = getSourceConfigs()
      this.refreshSelectedSource()
      uni.showToast({ title: `${enabled ? '已启用' : '已停用'} ${result.updated} 个书源`, icon: 'none' })
    },
    confirmRemoveSource(source) {
      if (!source || !source.importedAt) return
      const remove = () => this.removeSource(source)
      if (!uni.showModal) {
        remove()
        return
      }
      uni.showModal({
        title: '确认删除',
        content: `删除书源“${source.name}”后，它不会再参与发现页搜索。`,
        confirmText: '删除',
        confirmColor: '#e26a4f',
        success: result => {
          if (result.confirm) remove()
        }
      })
    },
    async removeSource(source) {
      const sourceSnapshot = { ...source }
      deleteUserSource(source.id)
      this.sources = getSourceConfigs()
      this.selectedSource = null
      this.sourceDiagnostics = null
      this.closePanels()
      let backendMessage = ''
      if (apiClient.getToken()) {
        try {
          const result = await deleteBackendSourceMatchingLocal(sourceSnapshot)
          backendMessage = result && result.deleted ? '，后端已同步' : '，后端无匹配源'
        } catch (error) {
          backendMessage = `，后端同步失败：${friendlyErrorMessage(error, '同步失败')}`
        }
      }
      uni.showToast({ title: `书源已删除${backendMessage}`, icon: 'none' })
    },
    goSourceMarket(url = '') {
      const query = url ? `?url=${encodeURIComponent(url)}` : ''
      uni.navigateTo({ url: `/pages/sourceMarket/sourceMarket${query}` })
    },
    scanSourceQr() {
      uni.navigateTo({ url: '/pages/import/scan' })
    },
    async chooseTxtFile() {
      try {
        const file = await chooseSingleFile(uni, {
          extension: ['.txt'],
          label: 'TXT'
        })
        const payload = await readImportFilePayload(file, {
          extension: ['.txt'],
          importType: 'txt',
          message: '请选择 .txt 文件'
        })
        if (!payload.text || payload.text.trim().length < 20) throw new Error('TXT 内容太短')
        this.importFileName = payload.fileName || getPickedFileName(file)
        this.importFileText = payload.text
        if (!this.importTitle) this.importTitle = this.importFileName.replace(/\.txt$/i, '').slice(0, 30)
      } catch (error) {
        uni.showToast({ title: error.message || '读取失败', icon: 'none' })
      }
    },
    async submitImport() {
      try {
        uni.showLoading({ title: '正在加入书架...' })
        const book = await importBookFromTextAsync({
          title: this.importTitle,
          author: this.importAuthor,
          text: this.importFileText
        })
        this.importFileName = ''
        this.importFileText = ''
        this.importTitle = ''
        this.importAuthor = ''
        this.closePanels()
        uni.showToast({ title: `已导入：${book.title}`, icon: 'none' })
        uni.switchTab({ url: '/pages/bookshelf/bookshelf' })
      } catch (error) {
        uni.showToast({ title: error.message || '导入失败', icon: 'none' })
      } finally {
        uni.hideLoading()
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

.decoder-source-page {
  box-sizing: border-box;
  width: 100%;
  max-width: 1120px;
  min-height: 100vh;
  padding: 0 30rpx 128rpx;
  margin: 0 auto;
  color: var(--app-text);
  background: var(--app-bg);
}

.source-discover-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 64rpx;
  gap: 22rpx;
  align-items: center;
  min-height: 122rpx;
  margin: 0 -30rpx 28rpx;
  padding: 48rpx 30rpx 20rpx;
  background: var(--app-top);
  box-shadow: var(--app-shadow);
}

.source-search-pill {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 60rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  border: 1rpx solid var(--app-border);
  background: var(--app-input);
}

.source-search-icon {
  flex-shrink: 0;
  color: var(--app-muted);
  font-size: 30rpx;
}

.source-search-input {
  min-width: 0;
  flex: 1;
  height: 60rpx;
  padding-left: 12rpx;
  color: var(--app-text);
  font-family: "KaiTi", "STKaiti", "PingFang SC", serif;
  font-size: 25rpx;
}

.source-import-scan {
  width: 64rpx;
  height: 64rpx;
  padding: 0;
  color: var(--app-text);
  font-size: 42rpx;
  line-height: 1;
  background: transparent;
}

.decoder-source-scroll {
  height: calc(100vh - 236rpx);
}

.source-select-card {
  display: flex;
  align-items: center;
  height: 72rpx;
  padding: 0 24rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 18rpx;
  background: var(--app-panel-strong);
  box-shadow: var(--app-shadow);
}

.source-select-icon {
  flex-shrink: 0;
  margin-right: 10rpx;
  font-size: 28rpx;
}

.source-select-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--app-text);
  font-family: "KaiTi", "STKaiti", "PingFang SC", serif;
  font-size: 28rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-select-arrow {
  flex-shrink: 0;
  color: var(--app-muted);
  font-size: 30rpx;
}

.source-hero-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22rpx;
  margin-top: 22rpx;
  padding: 26rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 24rpx;
  background: var(--app-panel-strong);
  box-shadow: var(--app-shadow);
}

.source-hero-title {
  margin-top: 8rpx;
  color: var(--app-text);
  font-size: 34rpx;
  font-weight: 900;
  line-height: 42rpx;
}

.source-hero-desc {
  display: block;
  margin-top: 8rpx;
  color: var(--app-muted);
  font-size: 23rpx;
  line-height: 32rpx;
}

.source-hero-actions {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 12rpx;
}

.source-hero-action {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 106rpx;
  height: 58rpx;
  margin: 0;
  padding: 0 22rpx;
  border-radius: 999rpx;
  color: var(--app-text);
  font-size: 24rpx;
  font-weight: 800;
  background: var(--app-panel);
}

.source-hero-action.primary {
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.installed-source-list {
  margin-top: 22rpx;
}

.installed-source-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  min-height: 72rpx;
  padding: 0 18rpx;
  margin-bottom: 18rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 18rpx;
  background: var(--app-panel-strong);
}

.source-row-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36rpx;
  height: 36rpx;
  border-radius: 8rpx;
  color: var(--app-on-accent);
  font-size: 20rpx;
  font-weight: 900;
  background: var(--app-accent);
}

.source-row-icon.ink {
  color: var(--app-text);
  background: transparent;
}

.source-row-icon.rainbow {
  background: linear-gradient(135deg, #4aa3ff 0%, #58d268 45%, #ffb43a 100%);
}

.source-row-icon.plain {
  color: var(--app-text);
  background: transparent;
}

.source-row-icon.red {
  background: #cf4e43;
}

.decoder-source-page .source-main {
  min-width: 0;
  flex: 1;
}

.decoder-source-page .source-name {
  overflow: hidden;
  color: var(--app-text);
  font-family: "KaiTi", "STKaiti", "PingFang SC", serif;
  font-size: 27rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.decoder-source-page .source-meta {
  display: block;
  margin-top: 3rpx;
  overflow: hidden;
  color: var(--app-muted);
  font-size: 20rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron {
  flex-shrink: 0;
  color: var(--app-muted);
  font-size: 44rpx;
  line-height: 1;
}

.source-detail-action {
  width: 58rpx;
  height: 58rpx;
  min-width: 58rpx;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid var(--app-border);
  border-radius: 8rpx;
  background: var(--app-panel);
  color: var(--app-muted);
  font-size: 28rpx;
  line-height: 1;
}

.decoder-source-page .management-tools {
  margin: 20rpx 0 0;
  border: 1rpx solid var(--app-border);
  border-radius: 18rpx;
  background: var(--app-panel);
}

button::after {
  border: 0;
}

button,
input,
textarea {
  box-sizing: border-box;
}

button,
.source-delete-button {
  display: flex;
  align-items: center;
  justify-content: center;
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
.row-action,
.source-delete-button {
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
  flex-wrap: wrap;
  gap: 20rpx;
  margin-top: 18rpx;
  color: var(--app-muted);
  font-size: 23rpx;
}

.management-tools {
  margin-top: 18rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.03);
}

.tools-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 18rpx;
}

.tools-title {
  color: var(--app-text);
  font-size: 28rpx;
  font-weight: 900;
}

.tools-toggle {
  flex-shrink: 0;
  padding: 9rpx 18rpx;
  border-radius: 999rpx;
  color: var(--app-on-accent);
  font-size: 22rpx;
  font-weight: 900;
  background: var(--app-accent-3);
}

.tools-body {
  padding: 0 18rpx 18rpx;
  border-top: 1rpx solid var(--app-border);
}

.group-summary {
  gap: 12rpx;
}

.bulk-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: 18rpx;
}

.batch-panel {
  margin-top: 18rpx;
  padding: 18rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 20rpx;
  background: var(--app-panel);
}

.batch-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.batch-actions {
  display: flex;
  flex-shrink: 0;
  gap: 12rpx;
}

.batch-progress {
  display: flex;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 14rpx;
  color: var(--app-muted);
  font-size: 23rpx;
}

.batch-result-list {
  margin-top: 12rpx;
}

.batch-result-row {
  display: grid;
  grid-template-columns: 86rpx minmax(0, 1fr) minmax(0, 1.5fr);
  gap: 12rpx;
  align-items: center;
  min-height: 54rpx;
  color: var(--app-muted);
  font-size: 22rpx;
}

.batch-result-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 38rpx;
  border-radius: 999rpx;
  color: var(--app-text);
  background: var(--app-input);
}

.batch-result-status.passed {
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.batch-result-status.ready {
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.batch-result-status.failed {
  color: var(--app-on-accent);
  background: var(--app-accent-3);
}

.batch-result-status.blocked {
  color: var(--app-on-accent);
  background: var(--app-accent-3);
}

.batch-result-name,
.batch-result-message {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.source-status-label {
  flex-shrink: 0;
  min-width: 94rpx;
  padding: 9rpx 14rpx;
  border-radius: 999rpx;
  color: var(--app-muted);
  font-size: 21rpx;
  font-weight: 900;
  line-height: 1;
  text-align: center;
  background: rgba(255, 255, 255, 0.06);
}

.source-status-label.passed {
  color: var(--app-on-accent);
  background: var(--app-accent-3);
}

.source-status-label.failed {
  color: #ffd5c8;
  background: rgba(216, 90, 58, 0.24);
}

.source-status-label.incompatible {
  color: #f4f0e8;
  background: rgba(96, 117, 125, 0.38);
}

.source-status-label.untested {
  color: #ffcf9a;
  background: rgba(216, 90, 58, 0.12);
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

.outline-action.wide {
  width: 100%;
  margin-top: 18rpx;
}

.preview-card {
  margin-top: 18rpx;
  padding: 16rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 16rpx;
  background: var(--app-panel);
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

.source-detail-drawer {
  top: 64rpx;
  bottom: calc(112rpx + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  max-height: none;
  padding: 0;
  overflow: hidden;
}

.source-detail-drawer .drawer-head {
  flex-shrink: 0;
  padding: 28rpx 28rpx 12rpx;
}

.source-detail-scroll {
  flex: 1;
  min-height: 0;
  height: calc(100vh - 64rpx - 112rpx - env(safe-area-inset-bottom) - 124rpx);
  padding: 0 28rpx 180rpx;
  box-sizing: border-box;
}

.source-detail-fixed-footer {
  flex-shrink: 0;
  padding: 12rpx 28rpx calc(18rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid var(--app-border);
  background: rgba(15, 18, 28, 0.96);
  box-shadow: 0 -16rpx 32rpx rgba(0, 0, 0, 0.22);
}

.detail-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 22rpx;
  padding: 20rpx;
  border: 1rpx solid rgba(230, 105, 74, 0.42);
  border-radius: 20rpx;
  background: rgba(230, 105, 74, 0.08);
}

.detail-status.compatible {
  border-color: rgba(229, 166, 91, 0.62);
  background: rgba(229, 166, 91, 0.1);
}

.detail-status.passed {
  border-color: rgba(142, 207, 194, 0.58);
  background: rgba(142, 207, 194, 0.12);
}

.detail-status.failed,
.detail-status.incompatible {
  border-color: rgba(230, 105, 74, 0.42);
  background: rgba(230, 105, 74, 0.08);
}

.detail-status-title,
.test-title,
.test-result-title {
  color: var(--app-text);
  font-size: 28rpx;
  font-weight: 850;
  line-height: 38rpx;
}

.detail-status-desc,
.test-result-desc {
  display: block;
  margin-top: 8rpx;
  color: var(--app-muted);
  font-size: 23rpx;
  line-height: 34rpx;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12rpx;
  margin-top: 18rpx;
}

.detail-item {
  min-width: 0;
  padding: 18rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 18rpx;
  background: var(--app-panel);
}

.detail-item.wide {
  grid-column: 1 / -1;
}

.detail-label {
  display: block;
  color: var(--app-muted);
  font-size: 22rpx;
}

.detail-value {
  display: block;
  margin-top: 8rpx;
  color: var(--app-text);
  font-size: 25rpx;
  font-weight: 750;
  line-height: 34rpx;
}

.one-line {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rule-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10rpx;
  margin-top: 18rpx;
}

.rule-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 72rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 16rpx;
  color: var(--app-muted);
  font-size: 22rpx;
  background: var(--app-panel);
}

.rule-pill.active {
  color: var(--app-text);
  border-color: rgba(142, 207, 194, 0.58);
  background: rgba(142, 207, 194, 0.12);
}

.test-panel {
  margin-top: 18rpx;
  padding: 18rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 20rpx;
  background: var(--app-panel);
}

.source-progress-line {
  margin-top: 12rpx;
  padding: 12rpx 16rpx;
  border-radius: 14rpx;
  color: var(--app-on-accent);
  font-size: 23rpx;
  font-weight: 800;
  text-align: center;
  background: rgba(91, 231, 218, 0.22);
}

.source-delete-zone {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 0;
  padding: 18rpx;
  border: 1rpx solid rgba(226, 95, 53, 0.55);
  border-radius: 20rpx;
  background: rgba(226, 95, 53, 0.08);
}

.source-delete-button {
  flex-shrink: 0;
  min-width: 190rpx;
  height: 68rpx;
  padding: 0 22rpx;
  border: 1rpx solid rgba(226, 95, 53, 0.7);
  border-radius: 16rpx;
  color: #ff9a78;
  background: rgba(226, 95, 53, 0.14);
  font-size: 24rpx;
  font-weight: 700;
}

.health-card,
.compatibility-card {
  margin-top: 18rpx;
  padding: 18rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 20rpx;
  background: var(--app-panel);
}

.source-health-warning {
  color: #f1b45f;
}

.anti-crawler-card {
  margin-top: 18rpx;
  padding: 18rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 20rpx;
  background: var(--app-panel);
}

.anti-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 16rpx;
}

.anti-field text {
  display: block;
  margin-bottom: 8rpx;
  color: var(--app-muted);
  font-size: 22rpx;
}

.charset-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8rpx;
}

.charset-chip {
  min-width: 0;
  height: 58rpx;
  padding: 0 8rpx;
  border-radius: 999rpx;
  color: var(--app-text);
  font-size: 21rpx;
  background: var(--app-input);
}

.charset-chip.active {
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.headers-field {
  height: 150rpx;
  margin-top: 14rpx;
  padding-top: 14rpx;
  line-height: 34rpx;
}

.health-meter {
  height: 14rpx;
  margin-top: 16rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: var(--app-input);
}

.health-meter-fill {
  height: 100%;
  min-width: 10rpx;
  border-radius: 999rpx;
  background: var(--app-accent);
  transition: width 0.2s ease;
}

.test-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.test-actions {
  display: flex;
  flex-shrink: 0;
  gap: 12rpx;
}

.field.compact {
  margin-top: 14rpx;
}

.test-result {
  margin-top: 16rpx;
  padding: 16rpx;
  border-radius: 16rpx;
  background: var(--app-input);
}

.test-book {
  margin-top: 10rpx;
  padding: 12rpx 14rpx;
  border-radius: 14rpx;
  color: var(--app-text);
  font-size: 23rpx;
  background: var(--app-panel-strong);
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
  .quick-actions,
  .bulk-actions,
  .detail-grid,
  .rule-summary,
  .batch-result-row {
    grid-template-columns: 1fr;
  }

  .batch-head,
  .batch-progress,
  .batch-actions,
  .test-actions {
    flex-direction: column;
    align-items: stretch;
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
