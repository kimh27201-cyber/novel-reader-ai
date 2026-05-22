import { analyzeBackendBaseUrl } from './backendConnection.js'

function stateLabel(state) {
  if (state === 'ready') return '已就绪'
  if (state === 'manual') return '手动'
  return '待处理'
}

export function getAndroidDemoReadiness(options = {}) {
  const backend = analyzeBackendBaseUrl(options.backendBaseUrl)
  const hasHealth = !!String(options.backendHealth || '').trim()
  const hasUser = !!options.backendUser
  const items = [
    {
      id: 'backend-address',
      title: '局域网后端地址',
      state: backend.mobileReady ? 'ready' : 'action',
      detail: backend.mobileReady
        ? `手机将访问 ${backend.normalized}，请保持同一 Wi-Fi。`
        : '请把 127.0.0.1 / localhost 改成电脑局域网 IP。'
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
      detail: hasUser ? `已登录：${options.backendUser.username || '当前用户'}` : '登录后再录屏 AI 与云端书架链路。'
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
