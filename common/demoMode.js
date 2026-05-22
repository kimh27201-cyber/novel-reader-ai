import { analyzeBackendBaseUrl, normalizeBackendBaseUrl } from './backendConnection.js'

const DEMO_ACCOUNT = {
  username: 'student',
  password: 'secret123'
}

function labelForState(state) {
  if (state === 'ready') return '已就绪'
  if (state === 'action') return '待操作'
  return '手动'
}

export function getDemoAccount() {
  return { ...DEMO_ACCOUNT }
}

export function buildDemoModePreset(baseUrl) {
  const normalized = normalizeBackendBaseUrl(baseUrl)
  const backend = analyzeBackendBaseUrl(normalized)
  return {
    ...DEMO_ACCOUNT,
    baseUrl: normalized,
    backendReady: backend.mobileReady,
    backendMessage: backend.message
  }
}

export function buildDemoModeChecklist(options = {}) {
  const backendReady = options.backendReady === true
  const healthReady = options.healthReady === true
  const loggedIn = options.loggedIn === true
  return [
    {
      id: 'backend',
      title: '连接局域网后端',
      state: backendReady && healthReady ? 'ready' : 'action',
      detail: backendReady && healthReady
        ? '后端地址和健康检查已准备好。'
        : '保存电脑局域网 IP 后点击“自检后端”。'
    },
    {
      id: 'login',
      title: '登录演示账号',
      state: loggedIn ? 'ready' : 'action',
      detail: loggedIn ? '演示账号已登录。' : '使用 student / secret123 登录后端。'
    },
    {
      id: 'import',
      title: '准备演示源或 TXT',
      state: 'manual',
      detail: '到导入页导入演示源、本地 TXT 或合法书源 JSON。'
    },
    {
      id: 'search',
      title: '运行批量检测与搜索',
      state: 'manual',
      detail: '批量检测通过后，在发现页搜索并加入书架。'
    },
    {
      id: 'reader',
      title: '验证阅读链路',
      state: 'manual',
      detail: '进入阅读器，检查目录、翻页、返回和底部控制区。'
    },
    {
      id: 'ai-history',
      title: '展示 AI 记录',
      state: 'manual',
      detail: '触发总结/问答后，在 AI 记录页展示成功和失败状态。'
    }
  ].map(item => ({
    ...item,
    label: labelForState(item.state)
  }))
}

export function buildOfflineDemoStatus(options = {}) {
  const builtInBookCount = Math.max(0, Number(options.builtInBookCount) || 0)
  const hasTxtSample = options.hasTxtSample === true
  const backendReady = options.backendReady === true
  const loggedIn = options.loggedIn === true
  const onlineReady = backendReady && loggedIn
  const ready = builtInBookCount > 0 && hasTxtSample
  const items = [
    {
      id: 'builtin-books',
      title: '内置演示书籍',
      state: builtInBookCount > 0 ? 'ready' : 'action',
      detail: builtInBookCount > 0
        ? `已有 ${builtInBookCount} 本内置书籍，可直接进入阅读器。`
        : '需要至少保留一本内置书籍作为离线兜底。'
    },
    {
      id: 'txt-sample',
      title: '本地 TXT 示例',
      state: hasTxtSample ? 'ready' : 'action',
      detail: hasTxtSample
        ? '已有 static/test-novel.txt，可用于本地导入演示。'
        : '缺少本地 TXT 示例文件。'
    },
    {
      id: 'reader-fallback',
      title: '阅读器兜底',
      state: ready ? 'ready' : 'action',
      detail: ready
        ? '即使后端或第三方站点不可用，也能展示书架和阅读器。'
        : '离线演示依赖内置书籍和 TXT 示例。'
    },
    {
      id: 'backend-optional',
      title: '后端增强链路',
      state: onlineReady ? 'ready' : 'manual',
      detail: onlineReady
        ? '后端已连接，可继续展示云端书架和 AI 记录。'
        : '后端不可用时跳过在线搜索和 AI，先展示离线阅读链路。'
    }
  ].map(item => ({
    ...item,
    label: labelForState(item.state)
  }))

  return {
    ready,
    mode: onlineReady ? 'online' : 'offline',
    summary: onlineReady
      ? '在线演示链路已可用，可展示导入、搜索、阅读器和 AI 记录。'
      : '离线演示兜底已可用，可先展示书架、本地 TXT 和阅读器。',
    items
  }
}
