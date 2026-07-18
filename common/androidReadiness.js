import { analyzeBackendBaseUrl } from './backendConnection.js'

function stateLabel(state) {
  if (state === 'ready') return '已就绪'
  if (state === 'manual') return '手动'
  return '待处理'
}

function backendAddressDetail(backend) {
  if (!backend.mobileReady) {
    return '请填写 http://127.0.0.1:8000，或填写电脑局域网 IP。'
  }
  if (backend.connectionMode === 'adb-reverse') {
    return `手机将通过 ADB reverse 访问 ${backend.normalized}，请保持数据线连接。`
  }
  return `手机将访问 ${backend.normalized}，请保持手机和电脑在同一 Wi-Fi。`
}

export function getAndroidDemoReadiness(options = {}) {
  const backend = analyzeBackendBaseUrl(options.backendBaseUrl)
  const hasHealth = !!String(options.backendHealth || '').trim()
  const hasUser = !!options.backendUser
  const items = [
    {
      id: 'backend-address',
      title: '后端地址',
      state: backend.mobileReady ? 'ready' : 'action',
      detail: backendAddressDetail(backend)
    },
    {
      id: 'backend-health',
      title: '后端健康检查',
      state: hasHealth ? 'ready' : 'action',
      detail: hasHealth ? options.backendHealth : '点击“自检后端”，确认 /api/health 可访问。'
    },
    {
      id: 'backend-login',
      title: '后端登录状态',
      state: hasUser ? 'ready' : 'action',
      detail: hasUser ? `已登录：${options.backendUser.username || '当前用户'}` : '登录后再验收 AI 与云端书架链路。'
    },
    {
      id: 'dcloud-appid',
      title: 'DCloud AppID',
      state: 'manual',
      detail: 'HBuilderX 发行前绑定正式 DCloud AppID，替换 manifest 中的占位值。'
    },
    {
      id: 'cloud-package',
      title: '云打包签名',
      state: 'manual',
      detail: 'HBuilderX：发行 -> 原生App-云打包 -> Android APK -> HBuilderX 测试证书。'
    }
  ].map(item => ({
    ...item,
    label: stateLabel(item.state)
  }))

  const readyCount = items.filter(item => item.state === 'ready').length
  const actionCount = items.filter(item => item.state === 'action').length
  const manualCount = items.filter(item => item.state === 'manual').length
  const canRecordDemo = actionCount === 0

  return {
    items,
    readyCount,
    actionCount,
    manualCount,
    canRecordDemo,
    summary: canRecordDemo
      ? '主链路已准备，可以进入安装包录屏和真机验收。'
      : '先处理后端地址、自检和登录，再进入 APK 展示。'
  }
}
