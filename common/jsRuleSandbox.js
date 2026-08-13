const FORBIDDEN_PATTERN = /\b(?:fetch|XMLHttpRequest|WebSocket|java|Packages|require|import|process|window|document|localStorage|sessionStorage|eval|Function|while|for|do|setTimeout|setInterval)\b/i
const IDENTIFIER_PATTERN = /^[A-Za-z_$][\w$]*$/

export class JsRuleSandboxError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'JsRuleSandboxError'
    this.code = code
  }
}

function failUnsupported(detail = '') {
  throw new JsRuleSandboxError('UNSUPPORTED_JS_CAPABILITY', `不支持的 JS 能力${detail ? `：${detail}` : ''}`)
}

function encodeBase64(value) {
  const text = String(value == null ? '' : value)
  if (typeof Buffer !== 'undefined') return Buffer.from(text, 'utf8').toString('base64')
  return btoa(unescape(encodeURIComponent(text)))
}

function decodeBase64(value) {
  const text = String(value == null ? '' : value)
  if (typeof Buffer !== 'undefined') return Buffer.from(text, 'base64').toString('utf8')
  return decodeURIComponent(escape(atob(text)))
}

function splitArgs(text) {
  return splitTopLevel(text, ',')
}

function splitTopLevel(text, delimiter) {
  const args = []
  let quote = ''
  let regex = false
  let escaped = false
  let depth = 0
  let start = 0
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (escaped) { escaped = false; continue }
    if (char === '\\') { escaped = true; continue }
    if (quote) { if (char === quote) quote = ''; continue }
    if (regex) { if (char === '/') regex = false; continue }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char === '/' && (index === 0 || /[,(=:\s]/.test(text[index - 1]))) { regex = true; continue }
    if (char === '(' || char === '[' || char === '{') depth += 1
    if (char === ')' || char === ']' || char === '}') depth -= 1
    if (char === delimiter && depth === 0) { args.push(text.slice(start, index).trim()); start = index + 1 }
  }
  const tail = text.slice(start).trim()
  if (tail) args.push(tail)
  return args
}

function splitStatements(text) {
  const statements = []
  let quote = ''
  let regex = false
  let escaped = false
  let depth = 0
  let start = 0
  const source = String(text || '')
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (escaped) { escaped = false; continue }
    if (char === '\\') { escaped = true; continue }
    if (quote) { if (char === quote) quote = ''; continue }
    if (regex) { if (char === '/') regex = false; continue }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char === '/' && (index === 0 || /[,(=:\s]/.test(source[index - 1]))) { regex = true; continue }
    if (char === '(' || char === '[' || char === '{') depth += 1
    if (char === ')' || char === ']' || char === '}') depth -= 1
    if ((char === ';' || char === '\n' || char === '\r') && depth === 0) {
      const statement = source.slice(start, index).trim()
      if (statement) statements.push(statement)
      start = index + 1
    }
  }
  const tail = source.slice(start).trim()
  if (tail) statements.push(tail)
  return statements
}

function findTopLevelBinary(text, operator) {
  const parts = splitTopLevel(text, operator)
  return parts.length > 1 ? parts : null
}

function evaluateObjectLiteral(text, context, budget, depth) {
  const body = String(text || '').trim().slice(1, -1).trim()
  if (!body) return {}
  return splitArgs(body).reduce((result, entry) => {
    const pair = splitTopLevel(entry, ':')
    if (pair.length < 2) failUnsupported('对象字面量')
    const rawKey = pair.shift().trim()
    const quotedKey = /^['"]/.test(rawKey)
    const key = quotedKey ? parseLiteral(rawKey, context) : rawKey
    if (!quotedKey && !IDENTIFIER_PATTERN.test(String(key))) failUnsupported('对象键')
    result[String(key)] = evaluateExpression(pair.join(':'), context, budget, depth + 1)
    return result
  }, {})
}

function evaluateArrayLiteral(text, context, budget, depth) {
  const body = String(text || '').trim().slice(1, -1).trim()
  return body ? splitArgs(body).map(item => evaluateExpression(item, context, budget, depth + 1)) : []
}

function parseLiteral(text, context) {
  const value = String(text || '').trim()
  if (IDENTIFIER_PATTERN.test(value)) {
    if (!Object.prototype.hasOwnProperty.call(context, value)) failUnsupported(value)
    return context[value]
  }
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value)
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null') return null
  if ((value[0] === '[' && value[value.length - 1] === ']') || (value[0] === '{' && value[value.length - 1] === '}')) {
    try { return JSON.parse(value) } catch (error) { failUnsupported('JSON 字面量无效') }
  }
  if ((value[0] === '"' && value[value.length - 1] === '"') || (value[0] === "'" && value[value.length - 1] === "'")) {
    if (value[0] === '"') return JSON.parse(value)
    return value.slice(1, -1).replace(/\\'/g, "'").replace(/\\n/g, '\n').replace(/\\\\/g, '\\')
  }
  failUnsupported(value)
}

function applyMethod(value, method, args, context) {
  if (method === 'trim' && !args.length) return String(value).trim()
  if (method === 'toUpperCase' && !args.length) return String(value).toUpperCase()
  if (method === 'toLowerCase' && !args.length) return String(value).toLowerCase()
  if (method === 'substring' || method === 'slice') {
    const numbers = args.map(arg => Number(parseLiteral(arg, context)))
    return String(value)[method](...numbers)
  }
  if (method === 'split' && args.length <= 1) return String(value).split(args.length ? String(parseLiteral(args[0], context)) : '')
  if (method === 'join' && Array.isArray(value) && args.length <= 1) return value.join(args.length ? String(parseLiteral(args[0], context)) : ',')
  if (method === 'reverse' && Array.isArray(value) && !args.length) return value.slice().reverse()
  if (method === 'concat') {
    const additions = args.map(arg => parseLiteral(arg, context))
    return Array.isArray(value) ? value.concat(...additions) : String(value).concat(...additions.map(String))
  }
  if (method === 'charAt' && args.length === 1) return String(value).charAt(Number(parseLiteral(args[0], context)))
  if (method === 'indexOf' && args.length >= 1) return value.indexOf(parseLiteral(args[0], context))
  if (method === 'includes' && args.length === 1) return value.includes(parseLiteral(args[0], context))
  if (method === 'replace' && args.length === 2) {
    const regexMatch = args[0].match(/^\/([\s\S]*)\/([gimsuy]*)$/)
    const pattern = regexMatch ? new RegExp(regexMatch[1], regexMatch[2]) : String(parseLiteral(args[0], context))
    return String(value).replace(pattern, String(parseLiteral(args[1], context)))
  }
  failUnsupported(method)
}

function emptyIfNullish(value) {
  return value == null ? '' : value
}

function evaluateExpression(expression, context, budget, depth = 0) {
  if (depth > budget.maxDepth) throw new JsRuleSandboxError('JS_RULE_BUDGET_EXCEEDED', 'JS 规则递归深度超限')
  budget.operations += 1
  if (budget.operations > budget.maxOperations) throw new JsRuleSandboxError('JS_RULE_BUDGET_EXCEEDED', 'JS 规则语句预算超限')
  const text = String(expression || '').trim().replace(/^return\s+/, '').replace(/;$/, '').trim()
  const additions = findTopLevelBinary(text, '+')
  if (additions) {
    const values = additions.map(item => evaluateExpression(item, context, budget, depth + 1))
    return values.some(value => typeof value === 'string') ? values.map(emptyIfNullish).join('') : values.reduce((sum, value) => sum + Number(value || 0), 0)
  }

  if (text[0] === '{' && text[text.length - 1] === '}') return evaluateObjectLiteral(text, context, budget, depth)
  if (text[0] === '[' && text[text.length - 1] === ']') return evaluateArrayLiteral(text, context, budget, depth)

  const functionMatch = text.match(/^(encodeURIComponent|decodeURIComponent|base64Encode|base64Decode|jsonParse|jsonStringify|JSON\.parse|JSON\.stringify|String|resolveUrl)\(([\s\S]*)\)([\s\S]*)$/)
  let value
  let rest = ''
  if (functionMatch) {
    const args = splitArgs(functionMatch[2]).map(arg => evaluateExpression(arg, context, budget, depth + 1))
    const name = functionMatch[1]
    if (name === 'encodeURIComponent') value = encodeURIComponent(String(emptyIfNullish(args[0])))
    else if (name === 'decodeURIComponent') value = decodeURIComponent(String(emptyIfNullish(args[0])))
    else if (name === 'base64Encode') value = encodeBase64(args[0])
    else if (name === 'base64Decode') value = decodeBase64(args[0])
    else if (name === 'jsonParse' || name === 'JSON.parse') value = JSON.parse(String(emptyIfNullish(args[0])))
    else if (name === 'jsonStringify' || name === 'JSON.stringify') value = JSON.stringify(args[0])
    else if (name === 'String') value = String(emptyIfNullish(args[0]))
    else value = new URL(String(emptyIfNullish(args[0])), String(emptyIfNullish(args[1]))).toString()
    rest = functionMatch[3]
  } else {
    const base = text.match(/^([A-Za-z_$][\w$]*|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|-?\d+(?:\.\d+)?)([\s\S]*)$/)
    if (!base) failUnsupported(text)
    value = parseLiteral(base[1], context)
    rest = base[2]
  }

  while (rest) {
    const method = rest.match(/^\.([A-Za-z_$][\w$]*)\(([^()]*)\)/)
    if (method) {
      value = applyMethod(value, method[1], splitArgs(method[2]), context)
      rest = rest.slice(method[0].length)
      continue
    }
    const property = rest.match(/^\.([A-Za-z_$][\w$]*)(?!\s*\()/)
    if (property) {
      if (value == null || !Object.prototype.hasOwnProperty.call(Object(value), property[1])) failUnsupported(property[1])
      value = value[property[1]]
      rest = rest.slice(property[0].length)
      continue
    }
    failUnsupported(rest)
  }
  return value
}

export function executeJsRule(rule, context = {}, options = {}) {
  const timeoutMs = options.timeoutMs == null ? 1000 : Number(options.timeoutMs)
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new JsRuleSandboxError('JS_RULE_TIMEOUT', 'JS 规则执行超时')
  let source = String(rule || '').trim().replace(/^<js>/i, '').replace(/<\/js>$/i, '').replace(/^@js:/i, '').trim()
  if (!source || source.length > 10000 || FORBIDDEN_PATTERN.test(source)) failUnsupported()
  const startedAt = Date.now()
  const budget = {
    operations: 0,
    maxOperations: Math.max(1, Math.min(256, Number(options.maxOperations || 64))),
    maxDepth: Math.max(1, Math.min(16, Number(options.maxDepth || 8)))
  }
  const sandboxContext = { ...context }
  const statements = splitStatements(source)
  let result = ''
  statements.forEach((statement, index) => {
    const declaration = statement.match(/^(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*([\s\S]+)$/)
    if (declaration) {
      sandboxContext[declaration[1]] = evaluateExpression(declaration[2], sandboxContext, budget)
      result = sandboxContext[declaration[1]]
      return
    }
    if (index < statements.length - 1 && /^[A-Za-z_$][\w$]*\s*=/.test(statement)) failUnsupported('变量重新赋值')
    result = evaluateExpression(statement, sandboxContext, budget)
  })
  if (Date.now() - startedAt > timeoutMs) throw new JsRuleSandboxError('JS_RULE_TIMEOUT', 'JS 规则执行超时')
  const resultSize = typeof result === 'string' ? result.length : JSON.stringify(result == null ? '' : result).length
  const maxResultSize = Math.max(1024, Math.min(1024 * 1024, Number(options.maxResultSize || 256 * 1024)))
  if (resultSize > maxResultSize) throw new JsRuleSandboxError('JS_RULE_RESULT_TOO_LARGE', 'JS 规则结果超过大小限制')
  return result
}
