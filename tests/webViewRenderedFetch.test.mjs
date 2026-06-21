import assert from 'node:assert/strict'
import { openSourceLogin, readSourceLoginCookie, renderedFetch, WebViewCapabilityError } from '../common/webViewBridge.js'
import { clearSourceCookies, getSourceCookie, saveSourceCookie } from '../common/sourceCookieJar.js'

const store = {}
globalThis.uni = {
  getStorageSync(key) { return store[key] },
  setStorageSync(key, value) { store[key] = value },
  removeStorageSync(key) { delete store[key] }
}

delete globalThis.window
await assert.rejects(() => renderedFetch('https://example.com'), error => {
  return error instanceof WebViewCapabilityError && error.code === 'APK_REQUIRED'
})

globalThis.window = {
  NovelReaderWebViewParser: {
    openLoginPage(url) { this.loginUrl = url; return true },
    getCookie(url) { return url === this.loginUrl ? 'sid=login' : '' },
    fetchRenderedHtml(url, optionsJson, callbackName) {
      assert.equal(url, 'https://example.com/page')
      assert.equal(JSON.parse(optionsJson).waitSelector, '.book-list')
      queueMicrotask(() => globalThis.window[callbackName]({
        html: '<html>ok</html>', finalUrl: url, title: 'ok', cookie: 'sid=1', status: 200, error: ''
      }))
      return true
    }
  }
}
const rendered = await renderedFetch('https://example.com/page', { waitSelector: '.book-list', timeoutMs: 1000 })
assert.equal(rendered.html, '<html>ok</html>')
assert.equal(rendered.status, 200)
assert.equal(openSourceLogin('https://example.com/login'), true)
assert.equal(readSourceLoginCookie('https://example.com/login'), 'sid=login')

saveSourceCookie('source-1', 'https://example.com/a', 'sid=1; theme=dark', { expiresAt: Date.now() + 10000 })
assert.equal(getSourceCookie('source-1', 'https://example.com/b'), 'sid=1; theme=dark')
saveSourceCookie('source-1', 'https://expired.test', 'old=1', { expiresAt: Date.now() - 1 })
assert.equal(getSourceCookie('source-1', 'https://expired.test'), '')
assert.equal(clearSourceCookies('source-1'), 1)
assert.equal(getSourceCookie('source-1', 'https://example.com'), '')

console.log('webViewRenderedFetch tests passed')
