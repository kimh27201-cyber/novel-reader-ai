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
