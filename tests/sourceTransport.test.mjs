import assert from 'node:assert/strict'

const requests = []
globalThis.window = {
  location: { protocol: 'file:' },
  NovelReaderHttp: {
    capabilities() {
      return JSON.stringify({ native: true, methods: ['GET', 'POST'], charsets: ['utf-8', 'gbk'] })
    },
    request(requestJson, callbackName) {
      const request = JSON.parse(requestJson)
      requests.push(request)
      queueMicrotask(() => globalThis.window[callbackName]({
        ok: true,
        status: 200,
        finalUrl: request.url,
        headers: { 'Content-Type': 'text/plain; charset=gbk' },
        text: '原生桥正文',
        charset: 'gbk',
        elapsedMs: 12,
        errorCode: '',
        message: ''
      }))
      return true
    }
  }
}

const { getSourceTransportCapabilities, requestSourceText } = await import('../common/sourceTransport.js')
assert.equal(getSourceTransportCapabilities().native, true)
const response = await requestSourceText({
  url: 'https://public.example/search',
  method: 'POST',
  body: 'q=abc',
  charset: 'gbk',
  sourceKey: 'source-key-test'
})
assert.equal(response.text, '原生桥正文')
assert.equal(response.charset, 'gbk')
assert.equal(requests[0].method, 'POST')
assert.equal(requests[0].body, 'q=abc')
assert.equal(requests[0].sourceKey, 'source-key-test')
await assert.rejects(() => requestSourceText({ url: 'file:///data/private.json' }), /HTTP\/HTTPS/)

delete globalThis.window
console.log('sourceTransport tests passed')
