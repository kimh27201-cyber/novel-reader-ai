import assert from 'node:assert/strict'

delete globalThis.window
delete globalThis.uni

let capturedOptions = null
let capturedUrl = ''
globalThis.__NOVEL_READER_ENCODE_REQUEST_BODY__ = async (body, charset) => {
  assert.equal(body, 'keyword=斗破苍穹')
  assert.equal(charset, 'gbk')
  return Uint8Array.from([0xB6, 0xB7, 0xC6, 0xC6])
}
globalThis.fetch = async (_url, options) => {
  capturedUrl = String(_url)
  capturedOptions = options
  return ({
  ok: true,
  status: 200,
  url: 'https://charset.example/final',
  headers: new Headers({ 'Content-Type': 'text/html; charset=gbk' }),
  arrayBuffer: async () => Uint8Array.from([0xD6, 0xD0, 0xCE, 0xC4]).buffer,
  text: async () => 'wrong decoder',
  requestOptions: options
  })
}

const { requestSourceText } = await import(`../common/sourceTransport.js?charset=${Date.now()}`)
const response = await requestSourceText({
  url: 'https://charset.example/search',
  method: 'POST',
  body: 'keyword=斗破苍穹',
  charset: 'gbk',
  timeoutMs: 2000
})
assert.equal(response.text, '中文')
assert.equal(response.charset, 'gbk')
assert.equal(response.finalUrl, 'https://charset.example/final')
assert.deepEqual([...capturedOptions.body], [0xB6, 0xB7, 0xC6, 0xC6])

globalThis.__NOVEL_READER_ENCODE_REQUEST_BODY__ = async (value, charset) => {
  assert.equal(value, '剑来')
  assert.equal(charset, 'gbk')
  return Uint8Array.from([0xBC, 0xA3, 0xC0, 0xB4])
}
await requestSourceText({ url: 'https://charset.example/search?q=剑来', charset: 'gbk', timeoutMs: 2000 })
assert.equal(capturedUrl, 'https://charset.example/search?q=%BC%A3%C0%B4')

globalThis.__NOVEL_READER_ENCODE_REQUEST_BODY__ = async () => new Uint8Array(512 * 1024 + 1)
await assert.rejects(
  () => requestSourceText({ url: 'https://charset.example/oversized', method: 'POST', body: 'x', charset: 'gbk' }),
  error => error && error.code === 'REQUEST_BODY_INVALID'
)

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

delete globalThis.__NOVEL_READER_ENCODE_REQUEST_BODY__
console.log('sourceTransportCharset tests passed')
