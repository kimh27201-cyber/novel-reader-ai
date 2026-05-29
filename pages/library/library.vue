<template>
  <view class="import-page app-page" :style="themeVars">
    <view class="top-zone">
      <view>
        <text class="eyebrow">SOURCES</text>
        <view class="title">书源</view>
        <text class="subtitle">导入、检测和管理你的阅读来源</text>
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
          <button class="small-action primary" @tap="openImportDrawer('repo')">添加书源</button>
          <button class="small-action" @tap="goSourceMarket">源仓库</button>
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

      <view class="summary-row">
        <text>{{ sourceStats.total }} 个书源</text>
        <text>{{ sourceStats.enabled }} 启用</text>
        <text>{{ sourceStats.searchable }} 可搜索</text>
        <text>{{ sourceStats.incompatible }} 不兼容</text>
      </view>

      <view class="management-tools">
        <view class="tools-head" @tap="toolsExpanded = !toolsExpanded">
          <view>
            <view class="tools-title">管理工具</view>
            <text class="source-hint">批量检测、分组筛选、云端演示源和批量启停。</text>
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
            <button class="small-action" :loading="backendLoading" @tap="importBackendDemo">后端演示源</button>
          </view>

          <view class="batch-panel tools-batch-panel">
            <view class="batch-head">
              <view>
                <view class="test-title">批量检测</view>
                <text class="source-hint">发现页只使用已通过测试的书源。失败源会保留网络失败、规则不兼容、无搜索结果或超时原因。</text>
              </view>
              <view class="batch-actions">
                <button class="small-action primary" :loading="batchTesting" @tap="runBatchSourceTest('all')">测试全部启用源</button>
                <button class="small-action" :disabled="sourceGroupFilter === '全部分组'" :loading="batchTesting" @tap="runBatchSourceTest('group')">测试当前分组</button>
              </view>
            </view>
            <input class="field compact" v-model="batchTestKeyword" placeholder="批量测试关键词，例如 星轨图书馆" />
            <view class="batch-progress" v-if="batchTesting || batchTestResult">
              <text>{{ batchProgressText }}</text>
              <text v-if="batchTestResult">通过 {{ batchTestResult.passed }} / 失败 {{ batchTestResult.failed }} / 跳过 {{ batchTestResult.skipped }}</text>
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

      <scroll-view class="source-list" scroll-y :show-scrollbar="false">
        <view class="source-empty" v-if="!visibleSources.length && !visibleBackendSources.length">
          <view class="empty-title">没有匹配的书源</view>
          <text class="empty-desc">换一个筛选条件，或点击“导入”添加 JSON / 源仓库页。</text>
        </view>

        <view class="source-row cloud" v-for="source in visibleBackendSources" :key="`cloud-${source.id}`">
          <view class="check-box active">云</view>
          <view class="source-main">
            <view class="source-name">{{ source.name }}</view>
            <text class="source-meta">后端 · {{ source.group || '云端源' }}</text>
          </view>
          <text class="source-status-label passed">可搜索</text>
          <text class="status-dot active"></text>
        </view>

        <view class="source-row" v-for="source in visibleSources" :key="source.id" @tap="openSourceDetail(source)">
          <button class="check-box" :class="{ active: source.enabled }" @tap.stop="toggleSource(source)">
            {{ source.enabled ? '✓' : '' }}
          </button>
          <view class="source-main">
            <view class="source-name">{{ source.name }}</view>
            <text class="source-meta">{{ source.group || '未分组' }}</text>
          </view>
          <text class="source-status-label" :class="sourceAvailabilityClass(source)">{{ sourceAvailabilityLabel(source) }}</text>
          <button class="status-switch" :class="{ active: source.enabled }" @tap.stop="toggleSource(source)">
            {{ source.enabled ? '启用' : '停用' }}
          </button>
          <button class="row-action" @tap.stop="openSourceEdit(source)">编</button>
          <button class="row-action" v-if="source.importedAt" @tap.stop="confirmRemoveSource(source)">删</button>
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
    </view>

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
      </view>
      <button class="outline-action wide" @tap="previewSourceImport">导入前预览</button>
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
        <view class="detail-item wide">
          <text class="detail-label">地址</text>
          <text class="detail-value one-line">{{ selectedSource.baseUrl || '无地址' }}</text>
        </view>
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

      <view class="test-panel">
        <view class="test-head">
          <view>
            <view class="test-title">单源搜索测试</view>
            <text class="source-hint">用于确认这个书源能否独立搜索，避免拖慢发现页。</text>
          </view>
          <view class="test-actions">
            <button class="small-action primary" :loading="sourceTesting" @tap="runSourceTest">搜索测试</button>
            <button class="small-action" :loading="sourceFlowTesting" @tap="runSourceReadingFlowTest">完整阅读测试</button>
          </view>
        </view>
        <input class="field compact" v-model="testSourceKeyword" placeholder="输入测试关键词，例如 星轨图书馆" />
        <view class="test-result" v-if="sourceTestResult">
          <view class="test-result-title">{{ sourceTestResult.title }}</view>
          <text class="test-result-desc">{{ sourceTestResult.desc }}</text>
          <view class="test-book" v-for="item in sourceTestResult.items" :key="item.bookId || item.title">
            {{ item.title }} · {{ item.subtitle || '在线结果' }}
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { importBookFromText, parseTxtChapters } from '../../common/books.js'
import {
  batchTestSources,
  batchSetSourcesEnabled,
  deleteUserSource,
  getSourceDiagnostics,
  getSourceConfigs,
  importSourcesFromAny,
  previewSourcesImport,
  runSourceReadingFlow,
  setSourceEnabled,
  testSourceSearch,
  updateSourceMetadata
} from '../../common/bookSources.js'
import {
  importBackendDemoSource,
  listBackendSources
} from '../../common/backendLibrary.js'
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
      sourceImportPreview: null,
      sourceDetailVisible: false,
      sourceEditVisible: false,
      editingSource: null,
      sourceEditName: '',
      sourceEditGroup: '',
      selectedSource: null,
      sourceDiagnostics: null,
      sourceTesting: false,
      sourceFlowTesting: false,
      testSourceKeyword: '星轨图书馆',
      sourceTestResult: null,
      batchTesting: false,
      batchTestKeyword: '星轨图书馆',
      batchProgress: { current: 0, total: 0 },
      batchTestResult: null,
      batchTestItems: [],
      importReadiness: buildImportReadiness(),
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
        incompatible: this.sources.filter(source => !getSourceDiagnostics(source).compatible).length,
        searchable: this.sources.filter(source => getSourceDiagnostics(source).searchable).length
      }
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
      if (this.batchTesting) {
        return `正在测试 ${this.batchProgress.current}/${this.batchProgress.total}`
      }
      if (this.batchTestResult) {
        return `检测完成 ${this.batchTestResult.total} 个书源`
      }
      return ''
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
      if (!this.sourceDiagnostics.compatible) return 'H5 暂不兼容'
      if (this.sourceDiagnostics.networkStatus === 'passed') return '已通过网络测试'
      if (this.sourceDiagnostics.networkStatus === 'failed') return '网络测试未通过'
      return '规则兼容，待网络测试'
    },
    sourceStatusDesc() {
      if (!this.sourceDiagnostics) return ''
      if (!this.sourceDiagnostics.compatible) return this.sourceReasonText
      const lastTest = this.sourceDiagnostics.lastTest || {}
      if (this.sourceDiagnostics.networkStatus === 'passed') {
        const suffix = lastTest.keyword ? `关键词：${lastTest.keyword}` : '可参与发现页搜索'
        return `已通过网络测试，发现页会使用它搜索。${suffix}`
      }
      if (this.sourceDiagnostics.networkStatus === 'failed') {
        const message = lastTest.message || '最近网络测试失败'
        return `${message}。规则本身仍兼容，发现页会跳过它。`
      }
      return '规则结构可解析；网络是否可用以单源测试为准。'
    },
    sourceRuleSummary() {
      const summary = this.sourceDiagnostics && this.sourceDiagnostics.ruleSummary || {}
      return [
        { key: 'search', label: '搜索', ready: !!summary.search },
        { key: 'bookInfo', label: '详情', ready: !!summary.bookInfo },
        { key: 'toc', label: '目录', ready: !!summary.toc },
        { key: 'content', label: '正文', ready: !!summary.content }
      ]
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
        if (this.sourceFilter === 'incompatible' && getSourceDiagnostics(source).compatible) return false
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
    this.refreshImportReadiness()
    this.refreshBackendSources({ silent: true })
  },
  methods: {
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
      this.sourceImportPreview = null
      this.sourceImportText = ''
      this.sourceImportUrl = ''
      this.sources = getSourceConfigs()
    },
    openSourceDetail(source) {
      this.selectedSource = source
      this.sourceDiagnostics = getSourceDiagnostics(source)
      this.sourceTestResult = null
      this.importDrawerVisible = false
      this.txtVisible = false
      this.sourceEditVisible = false
      this.sourceMenuVisible = false
      this.sourceDetailVisible = true
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
    refreshSelectedSource() {
      if (!this.selectedSource) return
      const latest = getSourceConfigs().find(source => source.id === this.selectedSource.id)
      if (!latest) {
        this.closePanels()
        return
      }
      this.selectedSource = latest
      this.sourceDiagnostics = getSourceDiagnostics(latest)
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
      try {
        const result = await testSourceSearch(this.selectedSource.id, this.testSourceKeyword)
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
      }
    },
    async runSourceReadingFlowTest() {
      if (!this.selectedSource) return
      this.sourceFlowTesting = true
      this.sourceTestResult = null
      try {
        const result = await runSourceReadingFlow(this.selectedSource.id, this.testSourceKeyword)
        this.sourceTestResult = {
          title: `完整阅读测试通过：${result.book.title}`,
          desc: `已完成搜索、详情、目录、正文，并加入书架缓存：${result.chapter.title}`,
          items: result.stages.map(stage => ({
            bookId: stage.id,
            title: stage.title,
            subtitle: stage.message
          }))
        }
        uni.showToast({ title: '已加入书架并缓存首章', icon: 'none' })
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
      }
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
        this.sourceImportPreview = null
      }
    },
    previewSourceImport() {
      const raw = String(this.sourceImportMode === 'json' ? this.sourceImportText : this.sourceImportUrl).trim()
      if (!raw) {
        uni.showToast({ title: '请先粘贴书源内容或 URL', icon: 'none' })
        return
      }
      try {
        this.sourceImportPreview = previewSourcesImport(raw)
      } catch (error) {
        this.sourceImportPreview = null
        uni.showToast({ title: friendlyErrorMessage(error, '当前内容无法预览，请确认是书源 JSON'), icon: 'none' })
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
        await this.importSourcePayload(text, '剪贴板导入')
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
        await this.importSourcePayload(payload.text || payload.url, '本地 JSON 导入')
      } catch (error) {
        uni.showToast({ title: error.message || '读取 JSON 失败', icon: 'none' })
      }
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
    removeSource(source) {
      deleteUserSource(source.id)
      this.sources = getSourceConfigs()
      if (this.selectedSource && this.selectedSource.id === source.id) {
        this.closePanels()
      }
    },
    goSourceMarket(url = '') {
      const query = url ? `?url=${encodeURIComponent(url)}` : ''
      uni.navigateTo({ url: `/pages/sourceMarket/sourceMarket${query}` })
    },
    async scanSourceQr() {
      try {
        const payload = await scanImportPayload(uni)
        const normalized = normalizeImportPayload(payload)
        const target = resolveMarketScanTarget(normalized.url || normalized.text)
        if (target.type === 'detail' || target.type === 'json' || target.type === 'market') {
          this.goSourceMarket(target.url)
          return
        }
        await this.importSourcePayload(normalized.url || normalized.text, '扫码导入')
      } catch (error) {
        uni.showToast({ title: error.message || '未完成扫码', icon: 'none' })
      }
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
    submitImport() {
      try {
        const book = importBookFromText({
          title: this.importTitle,
          author: this.importAuthor,
          text: this.importFileText
        })
        this.closePanels()
        uni.showToast({ title: `已导入：${book.title}`, icon: 'none' })
        uni.switchTab({ url: '/pages/bookshelf/bookshelf' })
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
  max-height: 82vh;
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
