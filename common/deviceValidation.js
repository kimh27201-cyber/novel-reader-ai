const DEVICE_VALIDATION_KEY = 'android:device-validation'

export const DEVICE_VALIDATION_ITEMS = [
  { id: 'app-launch', title: 'Android 基座启动', desc: '重新运行到 App 基座后，首页和底部 Tab 正常显示。' },
  { id: 'backend-url', title: '后端地址保存', desc: '保存电脑局域网 IP，不使用 127.0.0.1 / localhost。' },
  { id: 'backend-health', title: '后端自检', desc: '点击“自检后端”，确认 /api/health 可访问。' },
  { id: 'backend-login', title: '登录后端', desc: '使用演示账号登录，后端状态显示 ONLINE。' },
  { id: 'import-page', title: '进入导入页', desc: '从一键演示准备或底部 Tab 进入导入页。' },
  { id: 'local-import', title: '本地导入', desc: '验证本地 TXT / JSON、剪贴板或扫码入口至少一个可用。' },
  { id: 'batch-test', title: '批量检测', desc: '运行书源批量检测，能看到进度和逐源结果。' },
  { id: 'search-flow', title: '发现页搜索', desc: '发现页使用已通过源搜索，结果可加入书架。' },
  { id: 'reader-controls', title: '阅读器控制', desc: '验证返回、目录、翻页和底部控制区。' },
  { id: 'ai-actions', title: 'AI 总结/问答', desc: '阅读器内触发总结或问答，有明确成功/失败提示。' },
  { id: 'ai-history', title: 'AI 记录页', desc: 'AI 记录页能展示 summary/chat/success/failed。' }
]

function getUni() {
  return typeof uni === 'undefined' ? null : uni
}

function normalizeState(raw) {
  const input = raw && typeof raw === 'object' ? raw : {}
  return DEVICE_VALIDATION_ITEMS.reduce((state, item) => {
    if (input[item.id] === true) state[item.id] = true
    return state
  }, {})
}

function saveState(state) {
  const normalized = normalizeState(state)
  const uniApi = getUni()
  if (uniApi && uniApi.setStorageSync) {
    uniApi.setStorageSync(DEVICE_VALIDATION_KEY, normalized)
  }
  return normalized
}

export function getDeviceValidationState() {
  const uniApi = getUni()
  if (!uniApi || !uniApi.getStorageSync) return {}
  try {
    return normalizeState(uniApi.getStorageSync(DEVICE_VALIDATION_KEY))
  } catch (error) {
    return {}
  }
}

export function toggleDeviceValidationItem(itemId) {
  if (!DEVICE_VALIDATION_ITEMS.some(item => item.id === itemId)) {
    return getDeviceValidationState()
  }
  const state = getDeviceValidationState()
  if (state[itemId]) {
    delete state[itemId]
  } else {
    state[itemId] = true
  }
  return saveState(state)
}

export function resetDeviceValidationState() {
  const uniApi = getUni()
  if (uniApi && uniApi.removeStorageSync) {
    uniApi.removeStorageSync(DEVICE_VALIDATION_KEY)
  } else {
    saveState({})
  }
  return {}
}

export function getDeviceValidationSummary(state = getDeviceValidationState()) {
  const normalized = normalizeState(state)
  const total = DEVICE_VALIDATION_ITEMS.length
  const passed = DEVICE_VALIDATION_ITEMS.filter(item => normalized[item.id]).length
  return {
    total,
    passed,
    remaining: total - passed,
    complete: passed === total
  }
}
