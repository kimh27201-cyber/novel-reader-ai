function bridgeFromRuntime() {
  const parser = typeof window !== 'undefined' ? window.NovelReaderWebViewParser : null
  return {
    renderedFetch: !!(parser && typeof parser.fetchRenderedHtml === 'function'),
    openLogin: !!(parser && typeof parser.openLoginPage === 'function'),
    readCookie: !!(parser && typeof parser.getCookie === 'function')
  }
}

function normalizeBridge(bridge) {
  if (!bridge || typeof bridge !== 'object') return bridgeFromRuntime()
  return {
    renderedFetch: !!bridge.renderedFetch,
    openLogin: !!bridge.openLogin,
    readCookie: !!bridge.readCookie
  }
}

function jsModeLabel(mode) {
  if (mode === 'browser-only') return '浏览器 DOM JS'
  if (mode === 'builtin-only') return 'H5 沙箱 JS'
  return '无复杂 JS'
}

function platformLabel(platform) {
  if (platform === 'android') return 'Android APK'
  if (platform === 'h5') return 'H5'
  return '未知环境'
}

function recommendedLane(capability = {}) {
  if (capability.requiresRenderedHtml) return 'webview-rendered-dom'
  if (capability.requiresWebView) return 'webview-session-assist'
  if (capability.requiresCookie) return 'http-session-cookie'
  if (capability.jsMode === 'builtin-only') return 'http-rule-js'
  return 'http'
}

export function assessSourceBridgeReadiness(source = {}, capability = {}, options = {}) {
  const bridge = normalizeBridge(options.bridge)
  const platform = String(options.platform || '').toLowerCase() || 'h5'
  const requiresWebViewBridge = !!(
    capability.requiresWebView ||
    capability.requiresJsDom ||
    capability.requiresRenderedHtml ||
    capability.jsMode === 'browser-only'
  )
  const requiresSessionBridge = !!(capability.requiresCookie || capability.requiresLogin)
  const blockers = []

  if (requiresWebViewBridge && !bridge.renderedFetch) {
    blockers.push({
      code: platform === 'h5' ? 'APK_REQUIRED_FOR_WEBVIEW' : 'WEBVIEW_BRIDGE_MISSING',
      message: platform === 'h5'
        ? '当前 H5 环境不能渲染 WebView DOM，需要 Android APK bridge。'
        : '当前 Android bridge 未暴露渲染接口。'
    })
  }

  if (requiresSessionBridge && (!bridge.openLogin || !bridge.readCookie)) {
    blockers.push({
      code: platform === 'h5' ? 'APK_REQUIRED_FOR_SESSION' : 'SESSION_BRIDGE_MISSING',
      message: platform === 'h5'
        ? '当前 H5 环境不能读取 WebView Cookie，需要 Android APK bridge。'
        : '当前 Android bridge 未完整暴露登录页或 Cookie 读取接口。'
    })
  }

  let status = 'h5-ready'
  if (blockers.length && platform === 'h5') status = 'apk-required'
  else if (blockers.length) status = 'bridge-missing'
  else if (requiresWebViewBridge || requiresSessionBridge) status = 'bridge-ready'

  return {
    sourceId: source.id || capability.sourceId || '',
    status,
    platform,
    platformLabel: platformLabel(platform),
    requiresWebViewBridge,
    requiresSessionBridge,
    recommendedLane: recommendedLane(capability),
    bridge,
    blockers,
    diagnostics: [
      { key: 'js-mode', label: 'JS 模式', value: jsModeLabel(capability.jsMode) },
      { key: 'recommended-lane', label: '建议通道', value: recommendedLane(capability) },
      { key: 'rendered-fetch', label: '渲染接口', value: bridge.renderedFetch ? '可用' : '不可用' },
      { key: 'login-bridge', label: '登录页接口', value: bridge.openLogin ? '可用' : '不可用' },
      { key: 'cookie-bridge', label: 'Cookie 接口', value: bridge.readCookie ? '可用' : '不可用' }
    ]
  }
}
