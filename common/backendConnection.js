const DEFAULT_BACKEND_BASE_URL = 'http://127.0.0.1:8000'

function hasProtocol(value) {
  return /^https?:\/\//i.test(value)
}

function getHost(value) {
  try {
    if (typeof URL === 'function') {
      return new URL(value).hostname
    }
  } catch (error) {
    // Fall through to the lightweight parser below. Some App runtimes do not
    // provide a browser-compatible URL constructor.
  }
  const match = String(value || '').match(/^[a-z][a-z0-9+.-]*:\/\/(\[[^\]]+\]|[^/:?#]+)/i)
  return match ? match[1].replace(/^\[|\]$/g, '') : ''
}

export function normalizeBackendBaseUrl(value) {
  const raw = String(value || '').replace(/\s+/g, '')
  const withProtocol = raw ? (hasProtocol(raw) ? raw : `http://${raw}`) : DEFAULT_BACKEND_BASE_URL
  return withProtocol.replace(/\/+$/, '') || DEFAULT_BACKEND_BASE_URL
}

export function analyzeBackendBaseUrl(value) {
  const normalized = normalizeBackendBaseUrl(value)
  const host = getHost(normalized).toLowerCase()
  const isLoopback = ['127.0.0.1', 'localhost', '::1'].includes(host)
  const mobileReady = !!host
  return {
    normalized,
    host,
    mobileReady,
    connectionMode: isLoopback ? 'adb-reverse' : 'lan',
    message: mobileReady
      ? (isLoopback
        ? '当前地址适合 USB 数据线联调：请保持 ADB reverse tcp:8000 tcp:8000。'
        : '当前地址适合真机访问，请确认手机和电脑在同一局域网。')
      : '后端地址无效，请填写 http://127.0.0.1:8000 或电脑局域网 IP。'
  }
}

export function buildBackendStartCommands(lanIp = '电脑局域网 IP') {
  return [
    'cd D:\\Codex\\novel-reader-uniapp\\backend',
    '.\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000',
    '数据线联调：ADB reverse tcp:8000 tcp:8000 后填写 http://127.0.0.1:8000',
    `局域网联调：手机端后端地址填写：http://${lanIp}:8000`
  ]
}
