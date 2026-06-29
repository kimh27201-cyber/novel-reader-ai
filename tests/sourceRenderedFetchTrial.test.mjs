import assert from 'node:assert/strict'
import { buildRenderedFetchTrialRequest, runRenderedFetchTrial } from '../common/sourceRenderedFetchTrial.js'

const request = buildRenderedFetchTrialRequest({
  url: ' https://example.test/books ',
  waitSelector: ' .book-list ',
  timeoutMs: 50000,
  waitMs: -10,
  cookie: 'sid=1',
  userAgent: 'NovelReaderTest/1.0'
})

assert.equal(request.url, 'https://example.test/books')
assert.equal(request.waitSelector, '.book-list')
assert.equal(request.timeoutMs, 30000)
assert.equal(request.waitMs, 0)
assert.equal(request.cookie, 'sid=1')
assert.equal(request.userAgent, 'NovelReaderTest/1.0')

const invalid = await runRenderedFetchTrial({ url: 'not-a-url' })
assert.equal(invalid.status, 'invalid')
assert.equal(invalid.errorCode, 'INVALID_URL')
assert.match(invalid.message, /HTTP\/HTTPS/)

delete globalThis.window
const unsupported = await runRenderedFetchTrial({ url: 'https://example.test/books' })
assert.equal(unsupported.status, 'unsupported')
assert.equal(unsupported.errorCode, 'APK_REQUIRED')
assert.equal(unsupported.request.url, 'https://example.test/books')

globalThis.window = {
  NovelReaderWebViewParser: {
    fetchRenderedHtml(url, optionsJson, callbackName) {
      const options = JSON.parse(optionsJson)
      assert.equal(url, 'https://example.test/books')
      assert.equal(options.waitSelector, '.book-list')
      queueMicrotask(() => globalThis.window[callbackName]({
        html: '<html><title>ok</title><body>ready</body></html>',
        finalUrl: 'https://example.test/books#done',
        title: 'ok',
        cookie: 'sid=2',
        status: 200,
        error: ''
      }))
      return true
    }
  }
}

const passed = await runRenderedFetchTrial({
  url: 'https://example.test/books',
  waitSelector: '.book-list',
  timeoutMs: 1000
})

assert.equal(passed.status, 'passed')
assert.equal(passed.httpStatus, 200)
assert.equal(passed.finalUrl, 'https://example.test/books#done')
assert.equal(passed.title, 'ok')
assert.equal(passed.htmlLength, 48)
assert.equal(passed.cookieCaptured, true)
assert.equal(typeof passed.elapsedMs, 'number')

console.log('sourceRenderedFetchTrial tests passed')
