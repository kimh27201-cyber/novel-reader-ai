function getUniApi(runtime = globalThis) {
  return runtime && runtime.uni ? runtime.uni : globalThis.uni || {}
}

function hasFunction(value) {
  return typeof value === 'function'
}

function canUseNetwork(runtime = globalThis) {
  const uniApi = getUniApi(runtime)
  return hasFunction(uniApi.request) || hasFunction(runtime && runtime.fetch)
}

function canUseWebQrScanner(runtime = globalThis) {
  const detector = runtime && (runtime.BarcodeDetector || globalThis.BarcodeDetector)
  const mediaDevices = runtime && runtime.navigator && runtime.navigator.mediaDevices
  return !!(detector && mediaDevices && hasFunction(mediaDevices.getUserMedia))
}

function canUseScan(runtime = globalThis) {
  const uniApi = getUniApi(runtime)
  return hasFunction(uniApi.scanCode) || canUseWebQrScanner(runtime)
}

function canUseAndroidDocumentPicker(runtime = globalThis) {
  const plus = runtime && runtime.plus
  return !!(
    plus &&
    plus.android &&
    plus.os &&
    String(plus.os.name || '').toLowerCase() === 'android'
  )
}

function canUseHtmlFileInput(runtime = globalThis) {
  const documentRef = runtime && (runtime.document || globalThis.document)
  if (!documentRef || !hasFunction(documentRef.createElement)) return false
  try {
    const input = documentRef.createElement('input')
    input.type = 'file'
    return input.type === 'file'
  } catch (error) {
    return false
  }
}

function canUseFilePicker(runtime = globalThis) {
  const uniApi = getUniApi(runtime)
  return hasFunction(uniApi.chooseFile) ||
    hasFunction(uniApi.chooseMessageFile) ||
    canUseAndroidDocumentPicker(runtime) ||
    canUseHtmlFileInput(runtime)
}

function readinessItem(id, title, ready, detail) {
  return {
    id,
    title,
    state: ready ? 'ready' : 'blocked',
    detail
  }
}

export function buildImportReadiness(runtime = globalThis) {
  const networkReady = canUseNetwork(runtime)
  const scanReady = canUseScan(runtime)
  const fileReady = canUseFilePicker(runtime)
  const items = [
    readinessItem(
      'network-import',
      '网络导入',
      networkReady,
      networkReady ? '可读取 JSON 直链、yuedu://、legado:// 和源仓库详情页。' : '当前环境没有可用网络请求接口，网络书源导入不可用。'
    ),
    readinessItem(
      'legado3-import',
      '3.x 书源',
      true,
      '已支持常见 3.x 字段、yuedu://、legado://、JSON 包装结构和 class/id/tag/textNodes 等规则。'
    ),
    readinessItem(
      'scan-import',
      '扫码导入',
      scanReady,
      scanReady ? '可调用原生扫码或 WebView 摄像头二维码识别。' : '当前环境没有扫码能力，请使用剪贴板、网络导入或本地 JSON 兜底。'
    ),
    readinessItem(
      'file-import',
      '本地 JSON/TXT',
      fileReady,
      fileReady ? '可选择本地 JSON 书源和 TXT 小说文件。' : '当前环境没有文件选择能力，请使用剪贴板或网络导入兜底。'
    )
  ]

  return {
    ready: items.every(item => item.state === 'ready'),
    items
  }
}

export function summarizeImportReadiness(readiness = {}) {
  const items = Array.isArray(readiness.items) ? readiness.items : []
  const readyCount = items.filter(item => item.state === 'ready').length
  const blockedCount = items.filter(item => item.state === 'blocked').length
  const total = items.length
  return {
    ready: total > 0 && readyCount === total,
    total,
    readyCount,
    blockedCount,
    text: `已就绪 ${readyCount}/${total}，受限 ${blockedCount}`
  }
}
