function stringifySource(source) {
  try {
    return JSON.stringify(source || {})
  } catch (error) {
    return ''
  }
}

function unique(values = []) {
  const seen = new Set()
  return values
    .map(value => String(value || '').trim())
    .filter(value => {
      if (!value || seen.has(value)) return false
      seen.add(value)
      return true
    })
}

export function analyzeSourceCompatibility(source) {
  if (!source || typeof source !== 'object') {
    return {
      compatible: false,
      level: 'blocked',
      tags: ['invalidSource'],
      reasons: ['书源数据格式错误']
    }
  }

  const text = stringifySource(source)
  const tags = []
  const reasons = []
  let level = 'full'

  if (source.h5Unsupported === true || source.compatibleLevel === 'h5Unsupported' || source.compatibilityStatus === 'h5Unsupported') {
    level = 'partial'
    tags.push('h5Unsupported')
    reasons.push('该书源部分规则依赖 JS / H5 / WebView，当前版本不会执行第三方 JS')
  }

  if (/@js:|<js>|java\.|org\.jsoup|webview|WebView/i.test(text)) {
    level = level === 'full' ? 'partial' : level
    tags.push('maybeUnsupported')
    reasons.push('书源规则中包含当前 H5 安全解析器不执行的 JS / WebView / Legado runtime 能力')
  }

  if (/login|登录|cookie|Cookie|captcha|验证码|付费|VIP/i.test(text)) {
    level = level === 'full' ? 'partial' : level
    tags.push('specialAccess')
    reasons.push('书源规则中包含可能依赖登录、Cookie、验证码或付费访问控制的字段')
  }

  return {
    compatible: level !== 'blocked',
    level,
    tags: unique(tags),
    reasons: unique(reasons)
  }
}

export function canUseSourceFeature(source, featureName) {
  const compatibility = analyzeSourceCompatibility(source)
  if (compatibility.level === 'blocked') {
    return {
      allowed: false,
      reason: compatibility.reasons.join('；') || '书源不可用'
    }
  }

  const feature = String(featureName || '')
  const restricted = ['explore', 'category', 'discover']
  if (compatibility.tags.includes('h5Unsupported') && restricted.includes(feature)) {
    return {
      allowed: false,
      reason: '该功能依赖 JS / H5 / WebView，当前版本不支持执行第三方书源脚本'
    }
  }

  return {
    allowed: true,
    reason: ''
  }
}
