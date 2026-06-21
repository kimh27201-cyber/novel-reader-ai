import assert from 'node:assert/strict'
import { normalizeHeaders, redactHeaders } from '../common/headerUtils.js'

assert.deepEqual(normalizeHeaders({ 'User-Agent': 'UA', Referer: 'https://a.test/' }, { channel: 'proxy' }), {
  'User-Agent': 'UA',
  Referer: 'https://a.test/'
})
assert.deepEqual(normalizeHeaders('{"Cookie":"sid=1","X-Test":"ok"}', { channel: 'proxy' }), {
  Cookie: 'sid=1',
  'X-Test': 'ok'
})
assert.deepEqual(normalizeHeaders("['User-Agent']: Reader\n\"Referer\": https://a.test/\nBad Header: no", { channel: 'proxy' }), {
  'User-Agent': 'Reader',
  Referer: 'https://a.test/'
})
assert.deepEqual(normalizeHeaders('User-Agent: Reader\nCookie: sid=1\nReferer: https://a.test/\nX-Test: ok', { channel: 'direct' }), {
  'X-Test': 'ok'
})
assert.deepEqual(normalizeHeaders({ Authorization: 'Bearer {{token}}' }, {
  channel: 'proxy',
  context: { token: 'abc' }
}), { Authorization: 'Bearer abc' })
assert.deepEqual(redactHeaders({ Cookie: 'sid=secret; token=x', Authorization: 'Bearer secret', Referer: 'https://a.test/' }), {
  Cookie: '[REDACTED:19]',
  Authorization: '[REDACTED:13]',
  Referer: 'https://a.test/'
})

console.log('headerNormalize tests passed')
