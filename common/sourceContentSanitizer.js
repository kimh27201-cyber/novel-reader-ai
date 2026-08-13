import { cleanText } from './sourceEngine.js'

export const CONTENT_SANITIZER_VERSION = 1

const NON_CONTENT_BLOCKS = /<(script|style|noscript|template|svg|canvas)\b[^>]*>[\s\S]*?<\/\1\s*>/gi
const HTML_COMMENTS = /<!--[\s\S]*?-->/g
const STANDALONE_SCRIPT_CALL = /^(?=.{1,200}$)(?!.*[\u3400-\u9fff])\s*(?:(?:(?:[A-Za-z_$][\w$]*\.)*[A-Za-z_$][\w$]*\s*\([^\n;]{0,160}\)\s*;?\s*)+|(?:var|let|const)\s+[A-Za-z_$][\w$]*\s*=\s*[^\n]{1,160})\s*$/

function uniqueReadableBlocks(text) {
  const seen = new Set()
  return String(text || '').split(/\n{2,}/).map(block => block.trim()).filter(block => {
    if (!block) return false
    const key = block.replace(/\s+/g, ' ')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).join('\n\n')
}

export function sanitizeReadableContent(rawContent, context = {}) {
  const raw = String(rawContent == null ? '' : rawContent)
  const withoutBlocks = raw.replace(HTML_COMMENTS, '').replace(NON_CONTENT_BLOCKS, '')
  const normalized = cleanText(withoutBlocks)
  let removedScriptLines = 0
  const withoutCalls = normalized.split('\n').filter(line => {
    if (!STANDALONE_SCRIPT_CALL.test(line.trim())) return true
    removedScriptLines += 1
    return false
  }).join('\n')
  const text = uniqueReadableBlocks(withoutCalls)
  const rawChars = raw.length
  const cleanedChars = text.length
  return {
    text,
    version: CONTENT_SANITIZER_VERSION,
    rawChars,
    cleanedChars,
    removedChars: Math.max(0, rawChars - cleanedChars),
    removedScriptLines,
    chapterTitle: String(context.chapterTitle || '').slice(0, 120)
  }
}

export function assessReadableContentQuality(value, context = {}) {
  const sanitized = value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'text')
    ? value
    : sanitizeReadableContent(value, context)
  const compact = String(sanitized.text || '').replace(/\s+/g, '')
  const rawChars = Math.max(0, Number(sanitized.rawChars || 0))
  const cleanedChars = compact.length
  const removedRatio = rawChars ? Math.max(0, Math.min(1, (rawChars - Number(sanitized.cleanedChars || 0)) / rawChars)) : 0
  const residualScript = /(?:chap_tp|theme)\s*\(\s*\)\s*;?/i.test(sanitized.text || '')
  const empty = cleanedChars === 0
  const noisy = !empty && (residualScript || (rawChars >= 80 && removedRatio >= 0.9 && cleanedChars < 50))
  return {
    status: empty ? 'empty' : noisy ? 'noise' : cleanedChars < 50 ? 'short' : 'passed',
    readable: !empty && !noisy,
    qualifiesForAcceptance: !empty && !noisy && cleanedChars >= 50,
    cleanedChars,
    rawChars,
    removedRatio: Number(removedRatio.toFixed(4)),
    errorCode: empty ? 'CONTENT_EMPTY' : noisy ? 'CONTENT_NOISE' : ''
  }
}

export default {
  CONTENT_SANITIZER_VERSION,
  sanitizeReadableContent,
  assessReadableContentQuality
}
