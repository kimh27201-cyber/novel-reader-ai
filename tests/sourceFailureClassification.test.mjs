import assert from 'node:assert/strict'

import {
  asSourceRuntimeError,
  classifySourceFailure,
  SourceRuntimeError
} from '../common/sourceErrors.js'

assert.equal(classifySourceFailure(Object.assign(new Error('getaddrinfo ENOTFOUND old.example'), { code: 'ENOTFOUND' })).errorCode, 'SITE_UNREACHABLE')
assert.equal(classifySourceFailure(Object.assign(new Error('HTTP 403'), { status: 403 })).errorCode, 'HTTP_BLOCKED')
assert.equal(classifySourceFailure(Object.assign(new Error('HTTP 404'), { status: 404 })).errorCode, 'HTTP_NOT_FOUND')
assert.equal(classifySourceFailure(Object.assign(new Error('missing'), { code: 'HTTP_404' })).errorCode, 'HTTP_NOT_FOUND')
assert.equal(classifySourceFailure(new Error('无搜索结果'), { stage: 'search' }).errorCode, 'SEARCH_EMPTY')
assert.equal(classifySourceFailure(new Error('目录解析为空'), { stage: 'toc' }).errorCode, 'TOC_EMPTY')
assert.equal(classifySourceFailure(Object.assign(new Error('不支持的 JS 能力'), { code: 'UNSUPPORTED_JS_CAPABILITY' })).errorCode, 'JS_HOST_API_UNSUPPORTED')

const timeout = asSourceRuntimeError(Object.assign(new Error('aborted'), { name: 'AbortError' }), { stage: 'search' })
assert.ok(timeout instanceof SourceRuntimeError)
assert.equal(timeout.code, 'TIMEOUT')
assert.equal(timeout.stage, 'search')
assert.equal(timeout.retryable, true)

console.log('sourceFailureClassification tests passed')
