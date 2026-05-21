const DEFAULT_BACKEND_BASE_URL = 'http://127.0.0.1:8000'

function hasProtocol(value) {
  return /^https?:\/\//i.test(value)
}

function getHost(value) {
  try {
    return new URL(value).hostname
  } catch (error) {
    return ''
  }
}

export function normalizeBackendBaseUrl(value) {
  const raw = String(value || '').trim()
  const withProtocol = raw ? (hasProtocol(raw) ? raw : `http://${raw}`) : DEFAULT_BACKEND_BASE_URL
  return withProtocol.replace(/\/+$/, '') || DEFAULT_BACKEND_BASE_URL
}

export function analyzeBackendBaseUrl(value) {
  const normalized = normalizeBackendBaseUrl(value)
  const host = getHost(normalized).toLowerCase()
  const isLoopback = ['127.0.0.1', 'localhost', '::1'].includes(host)
  const mobileReady = !!host && !isLoopback
  return {
    normalized,
    host,
    mobileReady,
    message: mobileReady
      ? '当前地址适合真机访问，请确认手机和电脑在同一局域网。'
      : '真机不能访问 127.0.0.1 / localhost，请改成电脑局域网 IP，例如 http://192.168.x.x:8000。'
  }
}

export function buildBackendStartCommands(lanIp = '电脑局域网 IP') {
  return [
    'cd D:\\Codex\\novel-reader-uniapp\\backend',
    '.\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000',
    `手机端后端地址填写：http://${lanIp}:8000`
  ]
}
