const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/
const DIRECT_BLOCKED_HEADERS = new Set([
  'accept-charset',
  'accept-encoding',
  'access-control-request-headers',
  'access-control-request-method',
  'connection',
  'content-length',
  'cookie',
  'date',
  'dnt',
  'expect',
  'host',
  'keep-alive',
  'origin',
  'referer',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'user-agent',
  'via'
])

function renderValue(value, context = {}) {
  return String(value == null ? '' : value).replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, name) => {
    const result = context[String(name || '').trim()]
    return result == null ? '' : String(result)
  })
}

function unwrapHeaderName(value) {
  let name = String(value == null ? '' : value).trim()
  if (/^\[['"][\s\S]+['"]\]$/.test(name)) name = name.slice(2, -2).trim()
  if ((name[0] === '"' && name[name.length - 1] === '"') || (name[0] === "'" && name[name.length - 1] === "'")) {
    name = name.slice(1, -1).trim()
  }
  return name
}

function parseHeaderLines(input) {
  return String(input || '').split(/\r?\n|&&/).reduce((result, rawLine) => {
    const line = String(rawLine || '').trim().replace(/^@Headers?\s*[:=]?\s*/i, '')
    if (!line || line.startsWith('#')) return result
    const separator = line.search(/\s*[:=]\s*/)
    if (separator <= 0) return result
    result[line.slice(0, separator).trim()] = line.slice(separator + 1).trim()
    return result
  }, {})
}

function parseHeaderInput(input) {
  if (!input) return {}
  if (Array.isArray(input)) {
    return input.reduce((result, item) => {
      if (Array.isArray(item) && item.length >= 2) result[item[0]] = item[1]
      else if (item && typeof item === 'object') Object.assign(result, item)
      return result
    }, {})
  }
  if (typeof input === 'object') return input
  const text = String(input).trim()
  if (!text) return {}
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch (error) {
    return parseHeaderLines(text)
  }
}

export function normalizeHeaders(input, options = {}) {
  const channel = String(options.channel || 'proxy').toLowerCase()
  const context = options.context || {}
  const parsed = parseHeaderInput(input)
  return Object.keys(parsed || {}).reduce((result, rawName) => {
    const name = unwrapHeaderName(rawName)
    const value = parsed[rawName]
    if (!name || !HEADER_NAME_PATTERN.test(name) || value == null || value === false) return result
    if (channel === 'direct' && DIRECT_BLOCKED_HEADERS.has(name.toLowerCase())) return result
    const rendered = renderValue(value, context).replace(/[\r\n]+/g, ' ').trim()
    if (rendered) result[name] = rendered
    return result
  }, {})
}

export function redactHeaders(input) {
  const headers = normalizeHeaders(input, { channel: 'proxy' })
  return Object.keys(headers).reduce((result, name) => {
    const value = headers[name]
    result[name] = /^(cookie|authorization|proxy-authorization)$/i.test(name)
      ? `[REDACTED:${String(value).length}]`
      : value
    return result
  }, {})
}

export function isForbiddenDirectHeader(name) {
  return DIRECT_BLOCKED_HEADERS.has(String(name || '').toLowerCase())
}
