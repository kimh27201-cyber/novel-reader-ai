const NETWORK_PATTERNS = [
  /request:fail/i,
  /network/i,
  /failed to fetch/i,
  /ERR_CONNECTION/i,
  /ECONNREFUSED/i
]

function rawMessage(error) {
  if (!error) return ''
  if (typeof error === 'string') return error
  return String(error.message || error.errMsg || error.detail || '')
}

export function friendlyErrorMessage(error, fallback = '操作失败') {
  const message = rawMessage(error).trim()
  if (!message) return fallback

  if (/timeout|timed out|超时/i.test(message)) {
    return '后端连接超时，请稍后重试'
  }

  if (NETWORK_PATTERNS.some(pattern => pattern.test(message))) {
    return '后端连接失败，请确认 FastAPI 服务已启动'
  }

  return message
}

export function showFriendlyToast(error, fallback = '操作失败') {
  uni.showToast({
    title: friendlyErrorMessage(error, fallback),
    icon: 'none'
  })
}
