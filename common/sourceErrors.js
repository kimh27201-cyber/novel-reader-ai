const STABLE_CODES = new Set([
  'SITE_UNREACHABLE',
  'HTTP_BLOCKED',
  'HTTP_NOT_FOUND',
  'HTTP_SERVER_ERROR',
  'NETWORK_ERROR',
  'TIMEOUT',
  'CHARSET_ERROR',
  'REQUEST_TEMPLATE_UNSUPPORTED',
  'JS_HOST_API_UNSUPPORTED',
  'SCRIPT_POLICY_BLOCKED',
  'SCRIPT_BUDGET_EXCEEDED',
  'COOKIE_REQUIRED',
  'WEBVIEW_REQUIRED',
  'LOGIN_REQUIRED',
  'CAPTCHA_REQUIRED',
  'RULE_EMPTY',
  'PARSE_EMPTY',
  'SEARCH_EMPTY',
  'DETAIL_EMPTY',
  'TOC_EMPTY',
  'CONTENT_EMPTY',
  'CONTENT_TOO_SHORT',
  'TOC_TOO_SHORT',
  'INVALID_SOURCE'
])

export class SourceRuntimeError extends Error {
  constructor(code, message, details = {}) {
    super(message || code || '书源运行失败')
    this.name = 'SourceRuntimeError'
    this.code = code || 'NETWORK_ERROR'
    this.stage = details.stage || ''
    this.status = Number(details.status || 0)
    this.retryable = details.retryable === true
    this.diagnostics = details.diagnostics && typeof details.diagnostics === 'object' ? details.diagnostics : undefined
    this.cause = details.cause
  }
}

function normalizeStage(value) {
  const stage = String(value || '').replace(/[^a-z]/gi, '').toLowerCase()
  if (stage === 'bookinfo' || stage === 'detail') return 'DETAIL'
  if (stage === 'toc') return 'TOC'
  if (stage === 'content') return 'CONTENT'
  if (stage === 'search') return 'SEARCH'
  return stage ? stage.toUpperCase() : ''
}

function messageOf(error) {
  return String(error && error.message || error || '').replace(/https?:\/\/\S+/gi, '<url>').slice(0, 300)
}

export function classifySourceFailure(error, context = {}) {
  const message = messageOf(error)
  const originalCode = String(error && error.code || '').toUpperCase()
  const stage = normalizeStage(context.stage || error && error.stage)
  const codedStatus = originalCode.match(/^HTTP_(\d{3})$/)
  const status = Number(context.status || error && error.status || codedStatus && codedStatus[1] || 0)
  let errorCode = STABLE_CODES.has(originalCode) ? originalCode : ''

  if (!errorCode && (originalCode === 'ABORT_ERR' || /超时|timeout|timed out|aborted/i.test(message))) errorCode = 'TIMEOUT'
  if (!errorCode && (originalCode === 'UNSUPPORTED_JS_CAPABILITY' || /不支持的 JS 能力|unsupported js/i.test(message))) errorCode = 'JS_HOST_API_UNSUPPORTED'
  if (!errorCode && (originalCode === 'JS_RULE_BUDGET_EXCEEDED' || /语句预算|递归深度|budget/i.test(message))) errorCode = 'SCRIPT_BUDGET_EXCEEDED'
  if (!errorCode && (/JS_RULE_RESULT_TOO_LARGE|SCRIPT_POLICY/i.test(originalCode) || /危险脚本|策略阻止|forbidden/i.test(message))) errorCode = 'SCRIPT_POLICY_BLOCKED'
  if (!errorCode && (/验证码|captcha|turnstile|recaptcha|人机验证/i.test(message))) errorCode = 'CAPTCHA_REQUIRED'
  if (!errorCode && (status === 401 || /需要登录|请先登录|login required/i.test(message))) errorCode = 'LOGIN_REQUIRED'
  if (!errorCode && (status === 403 || status === 429 || /HTTP\s*(403|429)|访问被拒绝|频率限制|风控/i.test(message))) errorCode = 'HTTP_BLOCKED'
  if (!errorCode && (status === 404 || status === 410 || /HTTP\s*(404|410)/i.test(message))) errorCode = 'HTTP_NOT_FOUND'
  if (!errorCode && (status >= 500 || /HTTP\s*5\d\d/i.test(message))) errorCode = 'HTTP_SERVER_ERROR'
  if (!errorCode && (/ENOTFOUND|EAI_AGAIN|getaddrinfo|name not resolved|dns|无法解析主机|未知主机/i.test(`${originalCode} ${message}`))) errorCode = 'SITE_UNREACHABLE'
  if (!errorCode && (/certificate|SSL|TLS|CERT_|handshake|安全通道/i.test(`${originalCode} ${message}`))) errorCode = 'SITE_UNREACHABLE'
  if (!errorCode && (/charset|encoding|编码|解码失败|TextDecoder/i.test(message))) errorCode = 'CHARSET_ERROR'
  if (!errorCode && (/请求模板|request template|URL 配置|JSON 配置/i.test(message))) errorCode = 'REQUEST_TEMPLATE_UNSUPPORTED'
  if (!errorCode && (/Cookie/i.test(message))) errorCode = 'COOKIE_REQUIRED'
  if (!errorCode && (/WebView|动态渲染/i.test(message))) errorCode = 'WEBVIEW_REQUIRED'
  if (!errorCode && (/没有.*规则|规则为空/i.test(message))) errorCode = 'RULE_EMPTY'
  if (!errorCode && (/无搜索结果|没有搜索结果/i.test(message))) errorCode = 'SEARCH_EMPTY'
  if (!errorCode && (/解析为空|没有解析出/i.test(message))) errorCode = stage ? `${stage}_EMPTY` : 'PARSE_EMPTY'
  if (!errorCode && (/fetch failed|network|网络请求|connection|ECONN|socket|请求失败/i.test(`${originalCode} ${message}`))) errorCode = 'NETWORK_ERROR'
  if (!errorCode && /^HTTP_\d+$/.test(originalCode)) errorCode = status >= 500 ? 'HTTP_SERVER_ERROR' : 'HTTP_BLOCKED'
  if (!errorCode) errorCode = stage ? `${stage}_FAILED` : 'NETWORK_ERROR'

  return {
    errorCode,
    stage: stage.toLowerCase(),
    status,
    retryable: ['TIMEOUT', 'NETWORK_ERROR', 'HTTP_SERVER_ERROR'].includes(errorCode),
    message: message || '书源运行失败'
  }
}

export function asSourceRuntimeError(error, context = {}) {
  if (error instanceof SourceRuntimeError && (!context.stage || error.stage)) return error
  const classified = classifySourceFailure(error, context)
  return new SourceRuntimeError(classified.errorCode, classified.message, {
    stage: classified.stage,
    status: classified.status,
    retryable: classified.retryable,
    diagnostics: error && error.diagnostics,
    cause: error
  })
}

export default { SourceRuntimeError, classifySourceFailure, asSourceRuntimeError }
