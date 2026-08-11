import assert from 'node:assert/strict'

delete globalThis.window
delete globalThis.uni

globalThis.fetch = async (_url, options) => ({
  ok: true,
  status: 200,
  url: 'https://charset.example/final',
  headers: new Headers({ 'Content-Type': 'text/html; charset=gbk' }),
  arrayBuffer: async () => Uint8Array.from([0xD6, 0xD0, 0xCE, 0xC4]).buffer,
  text: async () => 'wrong decoder',
  requestOptions: options
})

const { requestSourceText } = await import(`../common/sourceTransport.js?charset=${Date.now()}`)
const response = await requestSourceText({
  url: 'https://charset.example/search',
  method: 'POST',
  body: 'keyword=test',
  charset: 'gbk',
  timeoutMs: 2000
})
assert.equal(response.text, '中文')
assert.equal(response.charset, 'gbk')
assert.equal(response.finalUrl, 'https://charset.example/final')

globalThis.fetch = async () => ({
  ok: false,
  status: 403,
  url: 'https://charset.example/blocked',
  headers: new Headers(),
  text: async () => 'blocked'
})
await assert.rejects(
  () => requestSourceText({ url: 'https://charset.example/blocked' }),
  error => error && error.code === 'HTTP_403' && error.status === 403
)

console.log('sourceTransportCharset tests passed')
