import assert from 'node:assert/strict'

import { encodeNodeLegacyRequestBody } from '../scripts/node_legacy_charset.mjs'

const encoded = await encodeNodeLegacyRequestBody('斗破', 'gb2312')
assert.deepEqual([...encoded], [0xB6, 0xB7, 0xC6, 0xC6])

assert.throws(
  () => encodeNodeLegacyRequestBody('test', 'utf-16'),
  error => error && error.code === 'REQUEST_TEMPLATE_UNSUPPORTED'
)
assert.throws(
  () => encodeNodeLegacyRequestBody('x'.repeat(512 * 1024 + 1), 'gbk'),
  error => error && error.code === 'REQUEST_BODY_INVALID'
)

console.log('nodeLegacyCharset tests passed')
