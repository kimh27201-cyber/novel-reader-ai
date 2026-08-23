import { spawn } from 'node:child_process'

import { SourceRuntimeError } from '../common/sourceErrors.js'

const MAX_BODY_BYTES = 512 * 1024
const cache = new Map()

export function encodeNodeLegacyRequestBody(value, charset) {
  const normalized = String(charset || '').trim().toLowerCase()
  if (!['gbk', 'gb2312', 'gb18030'].includes(normalized)) {
    throw new SourceRuntimeError('REQUEST_TEMPLATE_UNSUPPORTED', `验收工具不支持请求编码：${normalized}`, { stage: 'request' })
  }
  const text = String(value || '')
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
    throw new SourceRuntimeError('REQUEST_BODY_INVALID', '验收请求体超过大小限制', { stage: 'request' })
  }
  const cacheKey = `${normalized}\u0000${text}`
  if (cache.has(cacheKey)) return Promise.resolve(cache.get(cacheKey))
  const executable = process.env.NOVEL_READER_PYTHON || process.env.PYTHON || 'python'
  const codec = normalized === 'gb2312' ? 'gbk' : normalized
  const script = 'import sys;sys.stdout.buffer.write(sys.stdin.buffer.read().decode("utf-8").encode(sys.argv[1]))'
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ['-c', script, codec], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    const output = []
    const errors = []
    let outputBytes = 0
    let settled = false
    const finish = callback => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      callback()
    }
    const timer = setTimeout(() => {
      child.kill()
      finish(() => reject(new SourceRuntimeError('REQUEST_CHARSET_ERROR', '请求体编码超时', { stage: 'request' })))
    }, 5000)
    child.stdout.on('data', chunk => {
      outputBytes += chunk.length
      if (outputBytes > MAX_BODY_BYTES) child.kill()
      else output.push(chunk)
    })
    child.stderr.on('data', chunk => {
      if (errors.reduce((sum, item) => sum + item.length, 0) < 4096) errors.push(chunk)
    })
    child.on('error', error => finish(() => reject(
      new SourceRuntimeError('REQUEST_CHARSET_UNAVAILABLE', `无法启动请求编码器：${error.message}`, { stage: 'request', cause: error })
    )))
    child.on('close', code => finish(() => {
      if (code !== 0 || outputBytes > MAX_BODY_BYTES) {
        const detail = Buffer.concat(errors).toString('utf8').trim().slice(0, 240)
        reject(new SourceRuntimeError('REQUEST_CHARSET_ERROR', detail || '请求体编码失败', { stage: 'request' }))
        return
      }
      const encoded = Buffer.concat(output)
      if (cache.size >= 64) cache.delete(cache.keys().next().value)
      cache.set(cacheKey, encoded)
      if (process.env.NOVEL_READER_CHARSET_TRACE === '1') {
        process.stderr.write(`${JSON.stringify({ event: 'legacy-request-body-encoded', charset: codec, inputChars: text.length, outputBytes: encoded.length })}\n`)
      }
      resolve(encoded)
    }))
    child.stdin.end(Buffer.from(text, 'utf8'))
  })
}

export function installNodeLegacyRequestBodyEncoder() {
  globalThis.__NOVEL_READER_ENCODE_REQUEST_BODY__ = encodeNodeLegacyRequestBody
}
