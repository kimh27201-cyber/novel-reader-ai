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
  const errorCode = String(error && error.code || '').toUpperCase()

  if (errorCode === 'SITE_UNREACHABLE' || /unable to resolve host|no address associated with hostname|ENOTFOUND|EAI_AGAIN|getaddrinfo|name not resolved|无法解析主机|未知主机/i.test(message)) {
    return '书源站点域名无法访问，已从发现页暂时隔离；请换源或稍后重新检测'
  }

  if (errorCode === 'HTTP_NOT_FOUND') {
    return '书源入口已失效（HTTP 404），已从发现页暂时隔离；请换源或稍后重新检测'
  }

  if (errorCode === 'HTTP_BLOCKED') {
    return '书源站点拒绝访问或请求过于频繁，已暂时隔离；请稍后重试或配置 Cookie/Header'
  }

  if (errorCode === 'HTTP_SERVER_ERROR') {
    return '书源站点服务异常，已暂时隔离；请换源或稍后重新检测'
  }

  if (errorCode === 'TIMEOUT' && /书源|源仓库|目标站点/i.test(message)) {
    return '目标站点响应超时，建议换源、稍后重试，或配置 Cookie/Header 后再测'
  }

  if (errorCode === 'NETWORK_ERROR' && /书源|源仓库|目标站点/i.test(message)) {
    return '目标书源网络访问失败，请检查手机网络、域名状态或稍后重试'
  }

  if (/proxy request failed/i.test(message) && /timeout|timed out|超时/i.test(message)) {
    return '后端代理访问目标站点超时，建议换源、稍后重试，或配置 Cookie/Header 后再测'
  }

  if (/响应超时/i.test(message)) {
    return '目标站点响应超时，建议换源、稍后重试，或配置 Cookie/Header 后再测'
  }

  if (/timeout|timed out|超时/i.test(message)) {
    return '后端连接超时，请确认 FastAPI 服务可访问，或稍后重试'
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
