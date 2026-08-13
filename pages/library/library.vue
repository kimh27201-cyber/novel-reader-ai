<template>
  <view class="tab-page-shell" :class="themeClass" :style="themeVars">
  <view class="decoder-source-page app-page tab-page-content" :class="[themeClass, pageMotionClass]">
    <view class="source-discover-top">
      <view class="source-page-identity">
        <text class="source-page-eyebrow">解码阅读</text>
        <view class="source-page-title">书源 <text>{{ sourceStats.total }} 源</text></view>
      </view>
      <view class="source-top-controls">
        <view class="source-search-pill">
          <text class="source-search-icon">⌕</text>
          <input
            class="source-search-input"
            v-model="sourceKeyword"
            placeholder="筛选书源"
            confirm-type="search"
          />
        </view>
        <button class="source-filter-trigger" aria-label="筛选书源" @tap="openFilterSheet">筛选</button>
      </view>
    </view>

    <scroll-view class="decoder-source-scroll" scroll-y :show-scrollbar="false">
      <view class="source-import-hub">
        <view class="import-hub-copy">
          <text class="import-hub-eyebrow">ADD A SOURCE</text>
          <view class="import-hub-title">从任意入口开始导入</view>
          <text class="source-hint">导入前会先识别格式，并明确提示新增、覆盖与不兼容结果。</text>
        </view>
        <view class="import-hub-actions">
          <button class="import-hub-action import-hub-link" @tap="openImportDrawer('url')">
            <view class="import-hub-symbol"></view>
            <view class="import-hub-action-copy"><text class="import-hub-action-title">链接导入</text><text class="import-hub-action-desc">粘贴书源 URL</text></view>
          </button>
          <button class="import-hub-action import-hub-json" @tap="openImportDrawer('json')">
            <view class="import-hub-symbol"></view>
            <view class="import-hub-action-copy"><text class="import-hub-action-title">JSON 导入</text><text class="import-hub-action-desc">粘贴配置内容</text></view>
          </button>
          <button class="import-hub-action import-hub-scan" @tap="scanSourceQr">
            <view class="import-hub-symbol"></view>
            <view class="import-hub-action-copy"><text class="import-hub-action-title">扫码导入</text><text class="import-hub-action-desc">扫描二维码添加</text></view>
          </button>
          <button class="import-hub-action import-hub-file" @tap="chooseSourceJsonFile">
            <view class="import-hub-symbol"></view>
            <view class="import-hub-action-copy"><text class="import-hub-action-title">文件导入</text><text class="import-hub-action-desc">选择本地 JSON</text></view>
          </button>
        </view>
      </view>

      <view class="installed-source-list">
        <view
          class="installed-source-row"
          v-for="(source, index) in v2SourceRows"
          :key="source.rowKey"
          :style="{ '--source-enter-delay': `${Math.min(index, 10) * 60}ms` }"
          @tap="openSourceHub(source)"
        >
          <view class="source-row-icon" :class="source.iconClass"><view class="source-row-signal"></view></view>
          <view class="source-main">
            <view class="source-name">{{ source.name }}</view>
            <text class="source-meta">{{ source.meta }}</text>
            <text class="source-compatibility-tag" v-if="source.partialUnsupported">部分不兼容</text>
          </view>
          <button
            class="source-detail-action"
            aria-label="书源详情"
            @tap.stop="openSourceDetail(source)"
          >
            <text class="source-detail-mark">i</text>
          </button>
          <text class="chevron">›</text>
        </view>
      </view>

      <DEmptyState
        class="source-empty-state"
        v-if="!v2SourceRows.length"
        scene="source"
        :theme-id="themeId"
        title="书源列表还是空的"
        description="可粘贴 URL 或 JSON、扫描二维码，或选择本地 JSON 文件。"
        action-text="导入书源"
        @action="openImportDrawer('repo')"
      />

      <view class="recent-import-panel recent-import source-meta-section" v-if="recentImportHistory.length">
        <view class="recent-import-head">
          <view>
            <view class="tools-title">最近导入</view>
            <text class="source-hint">显示最近 20 条导入、覆盖、跳过和不兼容记录。</text>
          </view>
          <button class="small-action" @tap="openImportLogs">查看日志</button>
        </view>
        <view
          class="recent-import-row"
          v-for="item in recentImportHistory"
          :key="`${item.id}-${item.importTime}-${item.action}`"
        >
          <text class="batch-result-status" :class="item.visible ? 'passed' : 'incompatible'">{{ importHistoryActionLabel(item.action) }}</text>
          <view class="recent-import-copy">
            <view class="recent-import-name">{{ item.name || '未命名书源' }}</view>
            <text class="source-hint">{{ item.importMethod }} · {{ item.compatibleLevel || 'unknown' }} · {{ item.visible ? '列表可见' : (item.reason || '未写入列表') }}</text>
          </view>
        </view>
      </view>

      <view class="management-tools source-meta-section">
        <view class="tools-head" @tap="toolsExpanded = !toolsExpanded">
          <view>
            <view class="tools-title">书源整理</view>
            <text class="source-hint">筛选、整理和检查已导入的书源。</text>
          </view>
          <text class="tools-toggle">{{ toolsExpanded ? '收起' : '展开' }}</text>
        </view>
        <view class="tools-body" v-if="toolsExpanded">
          <view class="runtime-diagnostics">
            <view class="runtime-diagnostics-head">
              <view>
                <view class="test-title">运行诊断</view>
                <text class="source-hint">只汇总状态与错误码，不读取正文、Cookie 或完整配置。</text>
              </view>
              <text class="runtime-diagnostics-total">失败 {{ sourceRuntimeDiagnostics.counts.failed }}</text>
            </view>
            <view class="runtime-diagnostic-grid">
              <button class="runtime-diagnostic-item passed" @tap="sourceFilter = 'verified'">已验证 {{ sourceRuntimeDiagnostics.counts.verified }}</button>
              <button class="runtime-diagnostic-item" @tap="sourceFilter = 'untested'">待检测 {{ sourceRuntimeDiagnostics.counts.untested }}</button>
              <button class="runtime-diagnostic-item warning" @tap="sourceFilter = 'cooldown'">冷却中 {{ sourceRuntimeDiagnostics.counts.cooldown }}</button>
              <button class="runtime-diagnostic-item blocked" @tap="sourceFilter = 'blocked'">受限 {{ sourceRuntimeDiagnostics.counts.blocked }}</button>
            </view>
            <view class="runtime-error-list" v-if="sourceRuntimeDiagnostics.topErrors.length">
              <button
                class="runtime-error-chip"
                v-for="item in sourceRuntimeDiagnostics.topErrors"
                :key="`${item.code}-${item.httpStatus}`"
                :class="{ active: sourceErrorCode === item.code }"
                @tap="selectSourceErrorCode(item.code)"
              >{{ item.code }}{{ item.httpStatus ? ` · HTTP ${item.httpStatus}` : '' }} ×{{ item.count }}{{ item.retryReady ? ` · 可重试 ${item.retryReady}` : '' }}</button>
            </view>
            <view class="runtime-active-filter" v-if="sourceErrorCode">
              <text>正在筛选 {{ sourceErrorCode }} · {{ sourcePage.total }} 个来源</text>
              <button @tap="sourceErrorCode = ''">清除</button>
            </view>
            <view class="runtime-retry-row">
              <text class="source-hint">只重试冷却已结束且允许自动访问的来源，受限来源不会重复请求。</text>
              <view class="runtime-retry-actions">
                <button class="small-action primary" :loading="batchTesting" :disabled="!sourceRuntimeDiagnostics.counts.retryReady || batchTesting" @tap="runBatchSourceTest('retry')">重试到期 {{ sourceRuntimeDiagnostics.counts.retryReady }}</button>
                <button class="small-action" v-if="batchTesting" @tap="cancelBatchSourceTest">取消</button>
              </view>
            </view>
          </view>
          <scroll-view class="filter-strip" scroll-x :show-scrollbar="false">
            <button
              class="filter-chip"
              v-for="item in filterOptions"
              :key="item.value"
              :class="{ active: sourceFilter === item.value }"
              @tap="sourceFilter = item.value"
            >
              {{ filterOptionLabel(item) }}
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
                <view class="test-title">确认导入</view>
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
                <view class="test-title">检查书源</view>
                <text class="source-hint">发现页只会使用可正常搜索的书源；若不可用，会保留原因方便处理。</text>
              </view>
              <view class="batch-actions">
                <button class="small-action primary" :loading="batchTesting" @tap="runBatchSourceTest('all')">检测下一批（20）</button>
                <button class="small-action" :disabled="sourceGroupFilter === allSourceGroup" :loading="batchTesting" @tap="runBatchSourceTest('group')">测试当前分组</button>
                <button class="small-action" :loading="batchHealthTesting" @tap="runBatchSourceHealth('all')">健康检测</button>
                <button class="small-action" v-if="batchTesting" @tap="cancelBatchSourceTest">取消</button>
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

    <button
      v-if="!filterSheetVisible && !importDrawerVisible && !txtVisible && !sourceDetailVisible && !sourceEditVisible"
      class="source-primary-add-button"
      @tap="openImportDrawer('repo')"
    >扫码/链接添加书源</button>

    <view class="drawer-mask app-motion-overlay" v-if="filterSheetVisible || importDrawerVisible || txtVisible || sourceDetailVisible || sourceEditVisible" @tap="closePanels"></view>

    <view class="source-filter-sheet app-floating-panel app-motion-sheet" v-if="filterSheetVisible">
      <view class="drawer-head">
        <view>
          <text class="eyebrow">SOURCE FILTER</text>
          <view class="drawer-title">排序与筛选</view>
        </view>
        <button class="round-action" @tap="closeFilterSheet">×</button>
      </view>

      <view class="sheet-section">
        <view class="sheet-section-title">排序方式</view>
        <view class="sort-radio-list">
          <button
            class="sort-radio-row"
            v-for="option in sortOptions"
            :key="option.value"
            :class="{ active: sourceSort === option.value }"
            @tap="selectSourceSort(option.value)"
          >
            <text>{{ option.label }}</text>
            <text class="sort-radio-dot">{{ sourceSort === option.value ? '●' : '○' }}</text>
          </button>
        </view>
      </view>

      <view class="sheet-section sheet-switch-row">
        <view>
          <view class="sheet-section-title">只看启用书源</view>
          <text class="source-hint">关闭后显示全部状态，禁用和不兼容源仍会保留原因。</text>
        </view>
        <switch
          class="enabled-filter-switch"
          :checked="sourceFilter === 'enabled'"
          color="#d8b15d"
          @change="toggleEnabledFilter"
        />
      </view>

      <view class="sheet-section">
        <view class="sheet-section-title">分组</view>
        <scroll-view class="group-strip sheet-group-strip" scroll-x :show-scrollbar="false">
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
      </view>
    </view>

    <view class="import-drawer app-floating-panel app-motion-sheet" v-if="importDrawerVisible">
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
        :disabled="sourceImportPreviewing || sourceImporting"
        maxlength="-1"
        placeholder="粘贴书源 JSON、sources 包装结构、yuedu:// 或 legado:// 一键导入链接"
        @input="onSourceImportTextInput"
      ></textarea>
      <input
        v-else
        class="field"
        v-model="sourceImportUrl"
        :disabled="sourceImportPreviewing || sourceImporting"
        :placeholder="sourceImportMode === 'repo' ? '粘贴 yck2026/yckceo 源仓库详情页 URL' : '粘贴 JSON 直链或一键导入链接'"
        @input="invalidateSourceImportPreview"
      />
      <text class="source-hint">{{ sourceImportHint }}</text>

      <DSkeleton v-if="sourceImportPreviewing" scene="source" :rows="3" />

      <view class="preview-card" v-if="sourceImportPreview">
        <view class="test-title">导入前预览</view>
        <text class="source-hint">新增 {{ sourceImportPreview.imported }} / 覆盖 {{ sourceImportPreview.updated }} / 不兼容 {{ sourceImportPreview.incompatible }}</text>
        <text class="source-hint">分组：{{ sourceImportPreview.groups.join('、') || '未分组' }}</text>
        <text class="source-hint" v-if="sourceImportPreview.sourceUrl">JSON：{{ sourceImportPreview.sourceUrl }}</text>
      </view>
      <view class="source-import-feedback app-motion-feedback" v-if="sourceImportFeedback" :class="sourceImportFeedback.tone">
        <view class="source-import-feedback-title">{{ sourceImportFeedback.title }}</view>
        <text>{{ sourceImportFeedback.detail }}</text>
      </view>
      <DButton
        class="outline-action wide"
        variant="secondary"
        :disabled="sourceImportPreviewing || sourceImporting || !sourceImportRaw"
        :loading="sourceImportPreviewing"
        @tap="previewSourceImport"
      >导入前预览</DButton>
      <DButton
        class="submit-button"
        :disabled="sourceImportPreviewing || sourceImporting || !sourceImportRaw"
        :loading="sourceImporting"
        @tap="submitSourceImport"
      >{{ sourceImportPreview ? '确认导入' : '导入书源' }}</DButton>

      <view class="quick-actions">
        <button class="outline-action" @tap="importFromClipboard">剪贴板</button>
        <button class="outline-action" @tap="chooseSourceJsonFile">本地 JSON</button>
        <button class="outline-action" @tap="scanSourceQr">扫码</button>
        <button class="outline-action" @tap="goSourceMarket()">源仓库页</button>
      </view>
    </view>

    <view class="import-drawer app-floating-panel app-motion-sheet" v-if="txtVisible">
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

    <view class="import-drawer app-floating-panel app-motion-sheet" v-if="sourceEditVisible && editingSource">
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

    <view class="import-drawer source-detail-drawer app-floating-panel app-motion-sheet" v-if="sourceDetailVisible && selectedSource">
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
            <view class="test-title">书源状态 {{ sourceHealthScore }}</view>
            <text class="source-hint">全链路检测会依次验证搜索、详情、目录、正文和加入书架缓存。</text>
            <text class="source-hint">{{ sourceHealthText }}</text>
            <text class="source-hint source-health-warning" v-if="sourceHealthFailureText">{{ sourceHealthFailureText }}</text>
          </view>
          <view class="health-meter">
            <view class="health-meter-fill" :style="{ width: `${sourceHealthScore}%` }"></view>
          </view>
        </view>

        <view class="acceptance-card" v-if="sourceDiagnostics">
          <view class="test-head">
            <view>
            <view class="test-title">确认可读</view>
              <text class="source-hint">{{ sourceAcceptanceText }}</text>
            </view>
            <button class="small-action primary" :loading="sourceAcceptanceTesting" @tap="runSelectedSourceAcceptance">开始确认</button>
          </view>
          <view class="acceptance-summary" v-if="sourceAcceptanceReport">
            <text class="acceptance-status" :class="sourceAcceptanceReport.status">{{ sourceAcceptanceReport.status }}</text>
            <text>评分 {{ sourceAcceptanceReport.score }}</text>
            <text v-if="sourceAcceptanceReport.failureStage">失败阶段 {{ sourceAcceptanceReport.failureStage }}</text>
          </view>
          <view class="quick-actions">
            <button class="outline-action" :disabled="!sourceAcceptanceReport" @tap="copySelectedAcceptanceReport">复制报告</button>
            <button class="outline-action" :disabled="!sourceAcceptanceReport" @tap="clearSelectedAcceptanceReport">清除报告</button>
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
  <GlassTabBar active-path="pages/library/library" />
  </view>
</template>

<script>
import { importBookFromTextAsync, parseTxtChapters } from '../../common/books.js'
import {
  batchCheckSourceHealth,
  batchTestSources,
  batchSetSourcesEnabled,
  deleteUserSource,
  getRecentImportHistory,
  getSourceAntiCrawlerSettings,
  getSourceDiagnostics,
  getSourceExploreEntries,
  getSourceConfig,
  getSourceConfigs,
  getSourceLibraryPage,
  getSourceRetryCandidates,
  getSourceSnapshot,
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
import GlassTabBar from '../../custom-tab-bar/index.vue'
import DEmptyState from '../../components/composite/DEmptyState.vue'
import DButton from '../../components/base/DButton.vue'
import DSkeleton from '../../components/feedback/DSkeleton.vue'
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
import {
  buildCopyableAcceptanceReport,
  clearSourceAcceptanceReports,
  getSourceAcceptanceReports,
  runSourceAcceptance
} from '../../common/sourceAcceptance.js'
import { resolveMarketScanTarget } from '../../common/sourceMarket.js'
import { ALL_SOURCE_GROUP } from '../../common/sourceLibrary.js'
import { friendlyErrorMessage } from '../../common/uiFeedback.js'
import { markTabDirty, markTabFresh, shouldRefreshTab } from '../../common/tabFreshness.js'
import { getNavigationMotion } from '../../common/motion.js'
import { markTabRouteShown } from '../../common/tabNavigation.js'
import { ensureNativeTabBarHidden } from '../../common/tabShell.js'
import { clearSourceCookies, saveSourceCookie } from '../../common/sourceCookieJar.js'
import { openSourceLogin, readSourceLoginCookie } from '../../common/webViewBridge.js'
import apiClient from '../../common/apiClient.js'
import {
  addBackendBookWithChapters,
  deleteBackendSourceMatchingLocal,
  syncBackendSourceFromLocal
} from '../../common/backendLibrary.js'

export default {
  components: { GlassTabBar, DEmptyState, DButton, DSkeleton },
  data() {
    return {
      sources: [],
      sourcePage: { total: 0, rows: [], groups: [ALL_SOURCE_GROUP], groupStats: [], stats: { total: 0, enabled: 0, incompatible: 0, searchable: 0 }, diagnostics: { counts: { total: 0, verified: 0, untested: 0, probing: 0, cooldown: 0, blocked: 0, retryReady: 0, failed: 0, incompatible: 0 }, topErrors: [], lastCheckedAt: 0 } },
      pageMotionKind: '',
      pageMotionDirection: 'forward',
      toolsExpanded: false,
      importDrawerVisible: false,
      filterSheetVisible: false,
      txtVisible: false,
      sourceImportMode: 'repo',
      sourceImportText: '',
      sourceImportUrl: '',
      sourceImporting: false,
      sourceImportPreviewing: false,
      sourceImportPreview: null,
      sourceImportPreviewRaw: '',
      sourceImportFeedback: null,
      recentImportHistory: getRecentImportHistory(),
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
      sourceAcceptanceTesting: false,
      sourceAcceptanceReport: null,
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
      batchTestCancelled: false,
      batchHealthTesting: false,
      batchTestKeyword: '星轨图书馆',
      batchProgress: { current: 0, total: 0 },
      batchTestResult: null,
      batchTestItems: [],
      importReadiness: buildImportReadiness(),
      sourceFilter: 'all',
      sourceErrorCode: '',
      sourceSort: 'manual',
      sourceKeyword: '',
      sourceGroupFilter: ALL_SOURCE_GROUP,
      libraryFilterTimer: null,
      allSourceGroup: ALL_SOURCE_GROUP,
      themeId: getAppThemeId(),
      importTitle: '',
      importAuthor: '',
      importFileName: '',
      importFileText: '',
      filterOptions: [
        { label: '全部', value: 'all' },
        { label: '已验证', value: 'verified' },
        { label: '待检测', value: 'untested' },
        { label: '冷却中', value: 'cooldown' },
        { label: '受限', value: 'blocked' },
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
    themeClass() {
      return `theme-${this.themeId}`
    },
    pageMotionClass() {
      return this.pageMotionKind === 'tab'
        ? `app-tab-enter app-tab-enter-${this.pageMotionDirection === 'back' ? 'back' : 'forward'}`
        : ''
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
      if (this.sourceImportMode === 'repo') return '粘贴 yck2026/yckceo 详情页；Android APK 会在本机联网解析，H5 可使用已配置的代理。'
      return '支持直接 JSON 链接、yuedu://、legado:// 和包含 src= 的链接；Android APK 无需连接电脑后端。'
    },
    sourceImportRaw() {
      return String(this.sourceImportMode === 'json' ? this.sourceImportText : this.sourceImportUrl).trim()
    },
    sourceStats() {
      return this.sourcePage.stats
    },
    sourceRuntimeDiagnostics() {
      return this.sourcePage.diagnostics || {
        counts: { total: 0, verified: 0, untested: 0, probing: 0, cooldown: 0, blocked: 0, retryReady: 0, failed: 0, incompatible: 0 },
        topErrors: [],
        lastCheckedAt: 0
      }
    },
    v2SourceRows() {
      const rows = [
        ...this.visibleSources.map((source, index) => ({
          rowKey: source.id,
          type: 'source',
          id: source.id,
          name: source.name,
          meta: `${source.group || '未分组'} · ${source.enabled ? '已启用' : '已停用'} · ${source.compatible ? '规则兼容' : '规则不兼容'} · ${this.sourceRuntimeLabel(source)}`,
          partialUnsupported: false,
          icon: this.sourceListIcon(index),
          iconClass: this.sourceListIconClass(index),
          raw: source
        }))
      ]
      return rows.slice(0, 30)
    },
    sourceGroupStats() {
      return this.sourcePage.groupStats
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
    sourceAcceptanceText() {
      if (this.sourceAcceptanceTesting) return '正在依次验证分类/搜索、详情、目录、正文和加入书架。'
      if (!this.sourceAcceptanceReport) return '尚未验收。用于确认真实书源是否能完成可阅读闭环。'
      const stage = this.sourceAcceptanceReport.failureStage
      const status = this.sourceAcceptanceReport.status
      return stage ? `${status}，停在 ${stage}：${this.sourceAcceptanceReport.failureReason || ''}` : `${status}，最近评分 ${this.sourceAcceptanceReport.score}`
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
      return this.sourcePage.groups
    },
    visibleSources() {
      return this.sourcePage.rows
    }
  },
  watch: {
    sourceKeyword() { this.scheduleLibraryFilter() },
    sourceFilter() { this.scheduleLibraryFilter() },
    sourceErrorCode() { this.scheduleLibraryFilter() },
    sourceGroupFilter() { this.scheduleLibraryFilter() }
  },
  onLoad() {
    if (uni.$on) uni.$on('sources:changed', this.handleSourcesChanged)
  },
  onShow() {
    markTabRouteShown('pages/library/library')
    ensureNativeTabBarHidden()
    this.themeId = getAppThemeId()
    const motion = getNavigationMotion()
    this.pageMotionKind = motion.kind
    this.pageMotionDirection = motion.direction
    if (shouldRefreshTab('library')) this.refreshInstalledSources()
  },
  onUnload() {
    if (uni.$off) uni.$off('sources:changed', this.handleSourcesChanged)
    if (this.libraryFilterTimer) clearTimeout(this.libraryFilterTimer)
  },
  methods: {
    filterOptionLabel(item) {
      const counts = this.sourceRuntimeDiagnostics.counts
      const countMap = {
        all: counts.total,
        verified: counts.verified,
        untested: counts.untested,
        cooldown: counts.cooldown,
        blocked: counts.blocked,
        enabled: this.sourceStats.enabled,
        incompatible: this.sourceStats.incompatible
      }
      return countMap[item.value] == null ? item.label : `${item.label} ${countMap[item.value]}`
    },
    sourceRuntimeLabel(source) {
      const state = source && (source.runtimeState || source.runtimeStatus)
      if (state === 'passed') return '已验证'
      if (state === 'cooldown') return `冷却中${source.errorCode ? ` · ${source.errorCode}` : ''}`
      if (state === 'blocked') return `受限${source.errorCode ? ` · ${source.errorCode}` : ''}`
      if (state === 'probing') return '检测中'
      return '待检测'
    },
    selectSourceErrorCode(errorCode) {
      const next = String(errorCode || '').trim().toUpperCase()
      this.sourceErrorCode = this.sourceErrorCode === next ? '' : next
    },
    scheduleLibraryFilter() {
      if (this.libraryFilterTimer) clearTimeout(this.libraryFilterTimer)
      this.libraryFilterTimer = setTimeout(() => {
        this.libraryFilterTimer = null
        this.refreshInstalledSources({ readiness: false })
      }, 120)
    },
    sourceListIcon(index) {
      const icons = ['📘', '☯', '🌈', '八', '⑬']
      return icons[index % icons.length]
    },
    sourceListIconClass(index) {
      return ['blue', 'ink', 'rainbow', 'plain', 'red'][index % 5]
    },
    refreshInstalledSources(options = {}) {
      this.sourcePage = getSourceLibraryPage({
        keyword: this.sourceKeyword,
        filter: this.sourceFilter,
        errorCode: this.sourceErrorCode,
        group: this.sourceGroupFilter,
        sort: this.sourceSort,
        limit: 30
      })
      this.sources = this.sourcePage.rows
      this.recentImportHistory = getRecentImportHistory()
      if (this.sourceGroupFilter !== ALL_SOURCE_GROUP && !this.sourceGroups.includes(this.sourceGroupFilter)) {
        this.sourceGroupFilter = ALL_SOURCE_GROUP
      }
      if (options.readiness !== false) this.refreshImportReadiness()
      markTabFresh('library')
    },
    handleSourcesChanged() {
      markTabDirty('library')
      this.refreshInstalledSources()
    },
    openImportLogs() {
      uni.navigateTo({ url: '/pages/sources/import-logs' })
    },
    isPartialUnsupportedSource(source) {
      return source && (source.compatibleLevel === 'h5Unsupported' || source.compatibleLevel === 'partialCompatible' || source.h5Unsupported === true)
    },
    sourceCompatibilityLabel(source) {
      if (this.isPartialUnsupportedSource(source)) return '部分兼容'
      const diagnostics = getSourceDiagnostics(source)
      return diagnostics.compatible ? '规则兼容' : '规则不兼容'
    },
    importHistoryActionLabel(action) {
      if (action === 'added') return '新增'
      if (action === 'overwritten') return '覆盖'
      if (action === 'unsupported') return '不兼容'
      if (action === 'skipped') return '跳过'
      return '记录'
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
      this.refreshInstalledSources({ readiness: false })
    },
    openFilterSheet() {
      this.filterSheetVisible = true
      this.importDrawerVisible = false
      this.txtVisible = false
      this.sourceDetailVisible = false
      this.sourceEditVisible = false
    },
    closeFilterSheet() {
      this.filterSheetVisible = false
    },
    toggleEnabledFilter(event) {
      this.sourceFilter = event && event.detail && event.detail.value ? 'enabled' : 'all'
    },
    setImportMode(mode) {
      this.sourceImportMode = mode
      this.invalidateSourceImportPreview()
    },
    openImportDrawer(mode = this.sourceImportMode) {
      this.sourceImportMode = mode
      this.invalidateSourceImportPreview()
      this.importDrawerVisible = true
      this.txtVisible = false
      this.sourceEditVisible = false
      this.filterSheetVisible = false
    },
    openSourcePanel() {
      this.goSourceMarket()
    },
    openTxtPanel() {
      this.txtVisible = true
      this.importDrawerVisible = false
      this.sourceEditVisible = false
      this.filterSheetVisible = false
    },
    closePanels() {
      this.importDrawerVisible = false
      this.txtVisible = false
      this.sourceDetailVisible = false
      this.sourceEditVisible = false
      this.filterSheetVisible = false
      this.selectedSource = null
      this.editingSource = null
      this.sourceDiagnostics = null
      this.sourceTestResult = null
      this.sourceAcceptanceReport = null
      this.sourceAntiSaving = false
      this.sourceImportPreview = null
      this.sourceImportText = ''
      this.sourceImportUrl = ''
      this.sourceImportFeedback = null
      this.refreshInstalledSources({ readiness: false })
    },
    invalidateSourceImportPreview() {
      if (this.sourceImporting || this.sourceImportPreviewing) return
      this.sourceImportPreview = null
      this.sourceImportPreviewRaw = ''
      this.sourceImportFeedback = null
    },
    onSourceImportTextInput(event) {
      const detailValue = event && event.detail ? event.detail.value : undefined
      const targetValue = event && event.target ? event.target.value : undefined
      const nextValue = detailValue !== undefined ? detailValue : targetValue
      if (nextValue !== undefined) {
        this.sourceImportText = String(nextValue)
      }
      this.invalidateSourceImportPreview()
    },
    openSourceDetail(source) {
      const fullSource = getSourceConfig(source && source.id)
      if (!fullSource) return
      this.selectedSource = fullSource
      this.sourceDiagnostics = getSourceDiagnostics(fullSource)
      this.sourceAcceptanceReport = getSourceAcceptanceReports(source.id).latest
      this.syncAntiCrawlerForm(fullSource)
      this.testSourceKeyword = this.getSourceTestKeyword(fullSource)
      this.sourceTestResult = null
      this.importDrawerVisible = false
      this.txtVisible = false
      this.sourceEditVisible = false
      this.filterSheetVisible = false
      this.sourceDetailVisible = true
    },
    async runSelectedSourceAcceptance() {
      if (!this.selectedSource) return
      this.sourceAcceptanceTesting = true
      this.sourceTestResult = null
      try {
        this.sourceAcceptanceReport = await runSourceAcceptance(this.selectedSource.id, {
          keyword: this.testSourceKeyword,
          saveReport: true
        })
        uni.showToast({ title: `验收${this.sourceAcceptanceReport.status}`, icon: 'none' })
      } catch (error) {
        uni.showToast({ title: friendlyErrorMessage(error, '真实链路验收失败'), icon: 'none' })
      } finally {
        this.sourceAcceptanceTesting = false
      }
    },
    copySelectedAcceptanceReport() {
      if (!this.sourceAcceptanceReport) return
      uni.setClipboardData({
        data: buildCopyableAcceptanceReport(this.sourceAcceptanceReport),
        success: () => uni.showToast({ title: '验收报告已复制', icon: 'none' })
      })
    },
    clearSelectedAcceptanceReport() {
      if (!this.selectedSource) return
      clearSourceAcceptanceReports(this.selectedSource.id)
      this.sourceAcceptanceReport = null
      uni.showToast({ title: '验收报告已清除', icon: 'none' })
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
    openSourceHub(row) {
      if (!row || !row.id) return
      uni.navigateTo({
        url: `/pages/sourceHub/sourceHub?sourceId=${encodeURIComponent(row.id)}`
      })
    },
    openSourceExplore(row) {
      this.openSourceHub(row)
    },
    openSourceEdit(source) {
      this.editingSource = getSourceConfig(source && source.id)
      if (!this.editingSource) return
      this.sourceEditName = this.editingSource.name
      this.sourceEditGroup = this.editingSource.group || '未分组'
      this.importDrawerVisible = false
      this.txtVisible = false
      this.sourceDetailVisible = false
      this.filterSheetVisible = false
      this.sourceEditVisible = true
    },
    saveSourceEdit() {
      if (!this.editingSource) return
      try {
        updateSourceMetadata(this.editingSource.id, {
          name: this.sourceEditName,
          group: this.sourceEditGroup
        })
        this.refreshInstalledSources({ readiness: false })
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
      if (scope === 'retry') {
        return getSourceRetryCandidates({
          errorCode: this.sourceErrorCode,
          group: this.sourceGroupFilter,
          limit: 20
        }).map(source => source.id)
      }
      const group = scope === 'group' ? this.sourceGroupFilter : ALL_SOURCE_GROUP
      let page = getSourceLibraryPage({ filter: 'untested', group, limit: 20 })
      if (!page.rows.length) page = getSourceLibraryPage({ filter: 'enabled', group, limit: 20 })
      return page.rows.filter(source => source.enabled && source.compatible && source.searchable).map(source => source.id)
    },
    async runBatchSourceTest(scope = 'all') {
      const sourceIds = this.getBatchSourceIds(scope)
      if (!sourceIds.length) {
        uni.showToast({ title: scope === 'retry' ? '当前没有冷却到期的可重试来源' : scope === 'group' ? '当前分组没有可检测书源' : '没有可检测书源', icon: 'none' })
        return
      }
      this.batchTesting = true
      this.batchTestCancelled = false
      this.batchTestResult = null
      this.batchTestItems = []
      this.batchProgress = { current: 0, total: sourceIds.length }
      try {
        const result = await batchTestSources({
          keyword: this.batchTestKeyword,
          sourceIds,
          maxSources: 20,
          shouldCancel: () => this.batchTestCancelled,
          onProgress: item => {
            this.batchProgress = { current: item.index, total: item.total }
            this.batchTestItems = [...this.batchTestItems.filter(row => row.sourceId !== item.sourceId), item]
          }
        })
        this.batchTestResult = result
        this.batchTestItems = result.results
        this.refreshInstalledSources({ readiness: false })
        uni.showToast({ title: result.cancelled ? `已取消：完成 ${result.tested}` : `检测完成：通过 ${result.passed} / 失败 ${result.failed}`, icon: 'none' })
      } catch (error) {
        uni.showToast({ title: friendlyErrorMessage(error, '批量检测失败'), icon: 'none' })
      } finally {
        this.batchTesting = false
      }
    },
    cancelBatchSourceTest() {
      this.batchTestCancelled = true
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
        this.refreshInstalledSources({ readiness: false })
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
      const latest = getSourceConfig(this.selectedSource.id)
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
        this.refreshInstalledSources({ readiness: false })
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
        this.refreshInstalledSources({ readiness: false })
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
        this.refreshInstalledSources({ readiness: false })
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
        this.refreshInstalledSources({ readiness: false })
        this.refreshSelectedSource()
        this.sourceHealthTesting = false
        setTimeout(() => { this.sourceProgressText = '' }, 1200)
      }
    },
    async submitSourceImport() {
      const raw = this.sourceImportRaw
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
        const firstSource = (result.importedSources || []).find(source => source && source.id)
        this.sourceImportText = ''
        this.sourceImportUrl = ''
        this.sourceImportPreview = null
        this.sourceImportPreviewRaw = ''
        if (firstSource) {
          this.closePanels()
          uni.navigateTo({
            url: `/pages/sourceHub/sourceHub?sourceId=${encodeURIComponent(firstSource.id)}`
          })
        }
      }
    },
    async previewSourceImport() {
      const raw = this.sourceImportRaw
      if (!raw) {
        uni.showToast({ title: '请先粘贴书源内容或 URL', icon: 'none' })
        return
      }
      this.sourceImportPreviewing = true
      this.sourceImportFeedback = {
        tone: 'loading',
        title: '正在识别导入内容',
        detail: '正在检查格式与兼容性，请稍候。'
      }
      try {
        this.sourceImportPreview = this.sourceImportMode === 'json' && /^[\[{]/.test(raw)
          ? previewSourcesImport(raw)
          : await previewSourcesFromAny(raw)
        this.sourceImportPreviewRaw = raw
        const preview = this.sourceImportPreview
        const overwriteHint = preview.updated ? `其中 ${preview.updated} 个会覆盖已有书源。` : '确认后才会写入书源列表。'
        this.sourceImportFeedback = {
          tone: preview.incompatible ? 'warning' : 'ready',
          title: preview.incompatible ? '识别完成，存在不兼容项' : '识别完成，等待确认导入',
          detail: `新增 ${preview.imported} 个，覆盖 ${preview.updated} 个，不兼容 ${preview.incompatible} 个。${overwriteHint}`
        }
      } catch (error) {
        this.sourceImportPreview = null
        this.sourceImportPreviewRaw = ''
        const message = friendlyErrorMessage(error, '当前内容无法预览，请确认是书源 JSON 或 URL')
        this.sourceImportFeedback = {
          tone: 'failed',
          title: '无法识别导入内容',
          detail: message
        }
        uni.showToast({ title: message, icon: 'none' })
      } finally {
        this.sourceImportPreviewing = false
      }
    },
    async applySourceImportPreview(successPrefix = '已导入') {
      if (!this.sourceImportPreview) return null
      this.sourceImporting = true
      try {
        const result = applyImportPreview(this.sourceImportPreview, { importMethod: this.sourceImportMode })
        this.refreshInstalledSources({ readiness: false })
        if (uni.$emit) uni.$emit('sources:changed')
        const written = result.actualWritten || result.imported + result.updated
        const title = written > 0
          ? `${successPrefix}：${result.imported} 新增 / ${result.updated} 覆盖 / ${result.skipped || 0} 跳过 / 可见 ${result.visible || 0}`
          : `未导入有效书源：${result.skipped || 0} 跳过 / ${result.incompatible || 0} 不兼容`
        this.sourceImportFeedback = {
          tone: written > 0 ? 'success' : 'warning',
          title: written > 0 ? '导入完成' : '没有可写入的书源',
          detail: title
        }
        uni.showToast({
          title,
          icon: 'none'
        })
        return result
      } catch (error) {
        const message = friendlyErrorMessage(error, '导入书源失败')
        this.sourceImportFeedback = {
          tone: 'failed',
          title: '导入失败',
          detail: message
        }
        uni.showToast({ title: message, icon: 'none' })
        return null
      } finally {
        this.sourceImporting = false
      }
    },
    async importSourcePayload(raw, successPrefix = '已导入') {
      this.sourceImporting = true
      try {
        const result = await importSourcesFromAny(raw)
        this.refreshInstalledSources({ readiness: false })
        if (uni.$emit) uni.$emit('sources:changed')
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
      this.refreshInstalledSources({ readiness: false })
      this.refreshSelectedSource()
    },
    batchToggleVisibleSources(enabled) {
      const ids = this.visibleSources.map(source => source.id)
      if (!ids.length) {
        uni.showToast({ title: '当前结果没有可操作书源', icon: 'none' })
        return
      }
      const result = batchSetSourcesEnabled(ids, enabled)
      this.refreshInstalledSources({ readiness: false })
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
      this.refreshInstalledSources({ readiness: false })
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
      const targetUrl = typeof url === 'string' ? url.trim() : ''
      const query = targetUrl ? `?url=${encodeURIComponent(targetUrl)}` : ''
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
  --tabbar-reserved-height: 140rpx;
  --source-fab-height: 88rpx;
  box-sizing: border-box;
  width: 100%;
  max-width: 1120px;
  min-height: 100vh;
  padding: 0 30rpx calc(128rpx + var(--tabbar-reserved-height) + env(safe-area-inset-bottom));
  margin: 0 auto;
  color: var(--app-text);
  background: var(--app-bg);
}

.source-discover-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 112rpx;
  gap: 16rpx;
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

.source-filter-trigger {
  width: 112rpx;
  height: 64rpx;
  padding: 0;
  border: 1rpx solid var(--app-border);
  border-radius: 999rpx;
  color: var(--app-on-accent);
  font-size: 24rpx;
  font-weight: 900;
  line-height: 1;
  background: var(--app-accent);
}

.decoder-source-scroll {
  box-sizing: border-box;
  height: calc(100vh - 266rpx - var(--tabbar-reserved-height) - env(safe-area-inset-bottom));
  padding-bottom: calc(var(--source-fab-height) + 48rpx);
}

.installed-source-list {
  margin-top: 0;
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

.recent-import-panel {
  margin: 20rpx 0 0;
  padding: 20rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 18rpx;
  background: var(--app-panel);
}

.recent-import-head,
.recent-import-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.recent-import-head {
  justify-content: space-between;
  margin-bottom: 14rpx;
}

.recent-import-row {
  min-height: 72rpx;
  padding: 12rpx 0;
  border-top: 1rpx solid var(--app-border);
}

.recent-import-copy {
  min-width: 0;
  flex: 1;
}

.recent-import-name {
  overflow: hidden;
  color: var(--app-text);
  font-size: 28rpx;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.decoder-source-page .source-compatibility-tag {
  display: inline-flex;
  align-items: center;
  margin-top: 8rpx;
  padding: 4rpx 10rpx;
  border-radius: 8rpx;
  background: rgba(216, 177, 93, 0.16);
  color: var(--app-accent, #d8b15d);
  font-size: 20rpx;
  font-weight: 700;
  line-height: 1.2;
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

.filter-strip,
.group-strip {
  width: 100%;
  white-space: nowrap;
  margin-top: 20rpx;
}

.runtime-diagnostics {
  margin-top: 18rpx;
  padding: 18rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 20rpx;
  background: var(--app-panel);
}

.runtime-diagnostics-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.runtime-diagnostics-total {
  flex-shrink: 0;
  color: var(--app-muted);
  font-size: 22rpx;
}

.runtime-diagnostic-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 16rpx;
}

.runtime-diagnostic-item {
  min-width: 0;
  min-height: 58rpx;
  padding: 0 8rpx;
  border-radius: 14rpx;
  color: var(--app-text);
  background: var(--app-input);
  font-size: 21rpx;
}

.runtime-diagnostic-item.passed { color: var(--app-on-accent); background: var(--app-accent); }
.runtime-diagnostic-item.warning { color: var(--app-text); background: color-mix(in srgb, var(--app-accent-2) 24%, var(--app-input)); }
.runtime-diagnostic-item.blocked { opacity: 0.72; }

.runtime-error-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx 14rpx;
  margin-top: 14rpx;
  color: var(--app-muted);
  font-size: 20rpx;
}

.runtime-error-chip {
  min-height: 44rpx;
  padding: 4rpx 12rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 999rpx;
  color: var(--app-muted);
  background: var(--app-input);
  font-size: 20rpx;
}

.runtime-error-chip.active {
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.runtime-retry-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 14rpx;
}

.runtime-retry-actions {
  display: flex;
  flex-shrink: 0;
  gap: 10rpx;
}

.runtime-active-filter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 12rpx;
  padding: 10rpx 14rpx;
  border-radius: 14rpx;
  color: var(--app-text);
  background: color-mix(in srgb, var(--app-accent) 12%, var(--app-input));
  font-size: 21rpx;
}

.runtime-active-filter button {
  min-width: 84rpx;
  height: 44rpx;
  border-radius: 999rpx;
  color: var(--app-on-accent);
  background: var(--app-accent);
  font-size: 20rpx;
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
  flex-wrap: wrap;
  justify-content: flex-end;
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

.source-primary-add-button {
  position: fixed;
  left: 50%;
  bottom: calc(var(--tabbar-reserved-height) + 28rpx + env(safe-area-inset-bottom));
  z-index: 16;
  width: min(calc(100vw - 60rpx), 900px);
  height: 88rpx;
  padding: 0;
  border-radius: 999rpx;
  color: var(--app-on-accent);
  font-size: 28rpx;
  font-weight: 900;
  background: var(--app-accent);
  box-shadow: 0 18rpx 46rpx rgba(0, 0, 0, 0.34);
  transform: translateX(-50%);
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

.import-drawer,
.source-filter-sheet {
  position: fixed;
  left: 50%;
  bottom: calc(var(--tabbar-reserved-height) + var(--source-fab-height) + 48rpx + env(safe-area-inset-bottom));
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

.source-filter-sheet {
  bottom: calc(var(--tabbar-reserved-height) + var(--source-fab-height) + 56rpx + env(safe-area-inset-bottom));
  max-height: 72vh;
  border-radius: 30rpx 30rpx 24rpx 24rpx;
}

.sheet-section {
  margin-top: 22rpx;
  padding: 18rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 20rpx;
  background: var(--app-panel);
}

.sheet-section-title {
  color: var(--app-text);
  font-size: 27rpx;
  font-weight: 900;
}

.sort-radio-list {
  margin-top: 12rpx;
}

.sort-radio-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 78rpx;
  margin: 0;
  padding: 0 18rpx;
  border-radius: 16rpx;
  color: var(--app-text);
  font-size: 26rpx;
  background: transparent;
}

.sort-radio-row.active {
  color: var(--app-accent-3);
  background: rgba(255, 255, 255, 0.05);
}

.sort-radio-dot {
  flex-shrink: 0;
  margin-left: 20rpx;
  color: var(--app-accent-3);
  font-size: 28rpx;
}

.sheet-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22rpx;
}

.enabled-filter-switch {
  flex-shrink: 0;
}

.sheet-group-strip {
  margin-top: 14rpx;
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
.acceptance-card,
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

.acceptance-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 16rpx;
  color: var(--app-muted);
  font-size: 23rpx;
}

.acceptance-status {
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.acceptance-status.failed,
.acceptance-status.incompatible {
  background: #cf4e43;
}

.acceptance-status.partial {
  background: #d8b15d;
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

/* Source import: one short path from entry to preview to confirmation. */
.decoder-source-page {
  --source-ui-font: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
}

.source-discover-top {
  display: flex;
  align-items: flex-end;
  min-height: 164rpx;
  margin-bottom: 18rpx;
  padding-top: 56rpx;
  background: var(--app-top);
  box-shadow: 0 1rpx 0 var(--app-border);
}

.source-page-identity {
  flex-shrink: 0;
  margin-right: 22rpx;
}

.source-page-eyebrow,
.import-hub-eyebrow {
  display: block;
  color: var(--app-muted);
  font-family: var(--source-ui-font);
  font-size: 19rpx;
  font-weight: 650;
  letter-spacing: 3rpx;
  line-height: 28rpx;
}

.source-page-title {
  position: relative;
  color: var(--app-text);
  font-family: var(--source-ui-font);
  font-size: 38rpx;
  font-weight: 760;
  line-height: 48rpx;
}

.source-page-title::after {
  position: absolute;
  left: 0;
  bottom: -8rpx;
  width: 36rpx;
  height: 4rpx;
  border-radius: 999rpx;
  background: var(--app-accent-3);
  content: "";
}

.source-page-title text {
  margin-left: 8rpx;
  color: var(--app-muted);
  font-size: 20rpx;
  font-weight: 500;
}

.source-top-controls {
  display: flex;
  min-width: 0;
  flex: 1;
  gap: 10rpx;
}

.source-search-pill {
  height: 66rpx;
  border-radius: 14rpx;
  background: var(--app-input);
}

.source-search-input {
  height: 66rpx;
  font-family: var(--source-ui-font);
}

.source-filter-trigger {
  width: 82rpx;
  height: 66rpx;
  border-radius: 14rpx;
  font-family: var(--source-ui-font);
  font-weight: 700;
}

.decoder-source-scroll {
  height: calc(100vh - 326rpx - var(--tabbar-reserved-height) - env(safe-area-inset-bottom));
}

.source-import-hub {
  position: relative;
  overflow: hidden;
  padding: 24rpx;
  margin-bottom: 20rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 18rpx;
  background: var(--app-panel);
  box-shadow: var(--app-shadow);
}

.source-import-hub::before {
  position: absolute;
  left: 0;
  top: 24rpx;
  bottom: 24rpx;
  width: 5rpx;
  border-radius: 0 999rpx 999rpx 0;
  background: var(--app-accent-3);
  content: "";
}

.import-hub-copy {
  padding-left: 10rpx;
}

.import-hub-title {
  margin-top: 7rpx;
  color: var(--app-text);
  font-family: var(--source-ui-font);
  font-size: 31rpx;
  font-weight: 720;
  line-height: 40rpx;
}

.import-hub-actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 20rpx;
}

.import-hub-action {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 106rpx;
  padding: 0 4rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 13rpx;
  color: var(--app-text);
  font-family: var(--source-ui-font);
  font-size: 21rpx;
  background: var(--app-input);
}

.import-hub-action text:first-child {
  margin-bottom: 8rpx;
  color: var(--app-accent);
  font-size: 30rpx;
  font-weight: 700;
}

.import-hub-action:active,
.installed-source-row:active {
  opacity: 0.82;
  transform: scale(0.985);
}

.source-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 290rpx;
  padding: 36rpx;
  border: 1rpx dashed var(--app-border);
  border-radius: 18rpx;
  text-align: center;
  background: var(--app-panel);
}

.source-empty-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 70rpx;
  height: 84rpx;
  margin-bottom: 22rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 7rpx 7rpx 20rpx 7rpx;
  color: var(--app-accent-3);
  font-family: "KaiTi", "STKaiti", serif;
  font-size: 32rpx;
  box-shadow: inset 0 0 0 8rpx var(--app-input);
}

.source-empty-title {
  color: var(--app-text);
  font-family: var(--source-ui-font);
  font-size: 30rpx;
  font-weight: 720;
}

.installed-source-row,
.recent-import-panel,
.decoder-source-page .management-tools {
  background: var(--app-panel);
}

.installed-source-row {
  min-height: 112rpx;
  padding: 18rpx;
  transition: transform 180ms ease-out, opacity 180ms ease-out;
}

.decoder-source-page .source-name,
.recent-import-name {
  font-family: var(--source-ui-font);
}

.import-drawer {
  border: 1rpx solid var(--app-border);
  background: var(--app-panel-strong);
  box-shadow: var(--app-floating-shadow);
}

.import-methods {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10rpx;
}

.method-card {
  min-height: 116rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 14rpx;
  font-family: var(--source-ui-font);
  background: var(--app-input);
}

.method-card.active {
  border-color: var(--app-accent);
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.source-area,
.field {
  border-color: var(--app-border);
  border-radius: 14rpx;
  font-family: var(--source-ui-font);
  background: var(--app-input);
}

.source-import-feedback {
  margin-top: 16rpx;
  padding: 16rpx 18rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 14rpx;
  color: var(--app-muted);
  font-family: var(--source-ui-font);
  font-size: 23rpx;
  line-height: 34rpx;
  background: var(--app-input);
}

.source-import-feedback-title {
  margin-bottom: 5rpx;
  color: var(--app-text);
  font-size: 26rpx;
  font-weight: 720;
}

.source-import-feedback.loading { border-color: var(--app-accent); }
.source-import-feedback.ready { border-color: var(--app-accent); }
.source-import-feedback.success { border-color: var(--app-accent-3); }
.source-import-feedback.warning { border-color: var(--app-accent-3); }
.source-import-feedback.failed { border-color: #DC2626; }

.import-drawer .outline-action[disabled],
.import-drawer .submit-button[disabled] {
  color: var(--app-muted);
  border-color: var(--app-border);
  background: var(--app-input);
  opacity: 0.52;
}

@media (prefers-reduced-motion: reduce) {
  .installed-source-row { transition: none; }
}

/* V2 source pass: import methods become recognisable tools instead of text glyphs. */
.source-discover-top {
  position: relative;
  z-index: var(--app-z-sticky, 200);
  border-bottom: 1rpx solid color-mix(in srgb, var(--app-border) 86%, transparent);
}

.source-import-hub {
  border-width: var(--app-card-border-width, 1rpx);
  border-radius: var(--app-card-radius, 16rpx);
  box-shadow: var(--app-card-outline), var(--app-shadow);
}

.import-hub-action {
  min-height: 130rpx;
  border-radius: var(--app-control-radius, 12rpx);
  font-family: var(--app-utility-font);
  font-size: 21rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
}

.import-hub-symbol {
  position: relative;
  display: block;
  width: 42rpx;
  height: 42rpx;
  margin: 0 auto 12rpx;
  color: var(--app-accent);
}

.import-hub-link .import-hub-symbol::before,
.import-hub-link .import-hub-symbol::after {
  position: absolute;
  top: 10rpx;
  width: 24rpx;
  height: 16rpx;
  border: 3rpx solid currentColor;
  border-radius: 12rpx;
  content: '';
}

.import-hub-link .import-hub-symbol::before { left: 0; transform: rotate(-38deg); }
.import-hub-link .import-hub-symbol::after { right: 0; transform: rotate(-38deg); }

.import-hub-json .import-hub-symbol {
  border-top: 3rpx solid currentColor;
  border-bottom: 3rpx solid currentColor;
}

.import-hub-json .import-hub-symbol::before,
.import-hub-json .import-hub-symbol::after {
  position: absolute;
  top: 4rpx;
  bottom: 4rpx;
  width: 11rpx;
  border: 3rpx solid currentColor;
  content: '';
}

.import-hub-json .import-hub-symbol::before { left: 0; border-right: 0; }
.import-hub-json .import-hub-symbol::after { right: 0; border-left: 0; }

.import-hub-scan .import-hub-symbol {
  background: linear-gradient(90deg, currentColor 0 8rpx, transparent 8rpx 14rpx, currentColor 14rpx 24rpx, transparent 24rpx 30rpx, currentColor 30rpx 42rpx);
}

.import-hub-scan .import-hub-symbol::before {
  position: absolute;
  inset: -6rpx;
  border: 3rpx solid currentColor;
  content: '';
}

.import-hub-file .import-hub-symbol {
  border: 3rpx solid currentColor;
}

.import-hub-file .import-hub-symbol::before {
  position: absolute;
  right: -3rpx;
  top: -3rpx;
  width: 15rpx;
  height: 15rpx;
  border-bottom: 3rpx solid currentColor;
  border-left: 3rpx solid currentColor;
  background: var(--app-panel-strong);
  content: '';
}

.source-row-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.source-row-signal {
  width: 18rpx;
  height: 18rpx;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 7rpx color-mix(in srgb, currentColor 12%, transparent);
}

.source-detail-action {
  display: flex;
  align-items: center;
  justify-content: center;
}

.source-detail-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30rpx;
  height: 30rpx;
  border: 2rpx solid currentColor;
  border-radius: 50%;
  font-family: Georgia, serif;
  font-size: 21rpx;
  font-style: italic;
  font-weight: 700;
}

.installed-source-row {
  border-width: var(--app-card-border-width, 1rpx);
  box-shadow: none;
  animation: source-row-enter 360ms var(--app-motion-smooth) both;
  animation-delay: var(--source-enter-delay, 0ms);
  will-change: transform, opacity;
}

.installed-source-row:active {
  border-color: var(--app-accent);
  background: color-mix(in srgb, var(--app-panel) 84%, var(--app-accent));
}

.theme-candy.decoder-source-page .import-hub-action,
.theme-candy.decoder-source-page .installed-source-row {
  border: 2rpx solid rgba(52, 42, 50, 0.78);
}

.theme-cyber.decoder-source-page .source-import-hub,
.theme-cyber.decoder-source-page .import-hub-action,
.theme-cyber.decoder-source-page .installed-source-row {
  border-radius: var(--app-card-radius, 8rpx);
}

.theme-noirGold.decoder-source-page .source-import-hub {
  box-shadow: inset 0 0 0 7rpx rgba(213, 175, 98, 0.022), var(--app-shadow);
}

/* Information architecture pass: import is the primary action; records and tools stay secondary. */
.source-import-hub {
  padding: 30rpx;
}

.import-hub-actions {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 26rpx;
}

.import-hub-action {
  min-height: 154rpx;
  height: auto;
  flex-direction: row;
  justify-content: flex-start;
  gap: 16rpx;
  padding: 20rpx 18rpx;
  text-align: left;
  letter-spacing: 0;
}

.import-hub-action .import-hub-symbol {
  flex: 0 0 42rpx;
  margin: 0;
}

.import-hub-action-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
}

.import-hub-action-title,
.import-hub-action-desc {
	display: block;
	max-width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.import-hub-action-title {
	margin-bottom: 0;
	color: var(--app-text);
	font-family: var(--app-display-font);
	font-size: 25rpx;
	font-weight: 760;
  line-height: 34rpx;
}

.import-hub-action-desc {
  margin-top: 5rpx;
  color: var(--app-muted);
  font-family: var(--app-body-font);
  font-size: 18rpx;
  font-weight: 500;
  line-height: 26rpx;
}

.import-hub-action:nth-child(1),
.import-hub-action:nth-child(4) {
  background: color-mix(in srgb, var(--app-panel) 82%, var(--app-accent));
}

.import-hub-action:nth-child(2),
.import-hub-action:nth-child(3) {
  background: color-mix(in srgb, var(--app-panel) 86%, var(--app-accent-2));
}

.decoder-source-page .source-meta-section {
  margin-top: 34rpx;
  padding: 24rpx 0 0;
  border: 0;
  border-top: 1rpx solid var(--app-border);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.decoder-source-page .source-meta-section .tools-head,
.decoder-source-page .source-meta-section .recent-import-head {
  padding: 0 4rpx;
}

.decoder-source-page .source-meta-section .recent-import-row {
  margin: 0 4rpx;
  border-top: 1rpx solid color-mix(in srgb, var(--app-border) 72%, transparent);
}

@media (max-width: 360px) {
  .source-import-hub {
    padding: 24rpx;
  }

  .import-hub-actions {
    gap: 12rpx;
  }

  .import-hub-action {
    gap: 12rpx;
    min-height: 142rpx;
    padding: 16rpx 14rpx;
  }

  .import-hub-action-title { font-size: 23rpx; }
  .import-hub-action-desc { font-size: 17rpx; }
}

.drawer-mask {
  animation: source-drawer-mask-in 200ms ease both;
}

.import-drawer,
.source-filter-sheet {
  animation: source-drawer-enter var(--app-motion-duration-normal) var(--app-motion-spring) both;
}

@keyframes source-row-enter {
  from { opacity: 0; transform: translate3d(0, 20rpx, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes source-drawer-mask-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes source-drawer-enter {
  from { opacity: 0; transform: translate3d(-50%, 40rpx, 0); }
  to { opacity: 1; transform: translate3d(-50%, 0, 0); }
}
</style>
