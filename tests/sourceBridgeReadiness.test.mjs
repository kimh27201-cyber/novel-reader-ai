import assert from 'node:assert/strict'
import { assessSourceBridgeReadiness } from '../common/sourceBridgeReadiness.js'
import { buildSourceCapability } from '../common/sourceCapability.js'

const browserOnlySource = {
  id: 'browser-only',
  name: 'Browser Only',
  raw: {
    bookSourceName: 'Browser Only',
    bookSourceUrl: 'https://example.test',
    exploreUrl: 'https://example.test',
    ruleExplore: { bookList: '.book' },
    ruleContent: { content: '<js>document.querySelector(".content").innerText</js>' }
  }
}

const browserOnlyCapability = buildSourceCapability(browserOnlySource)
const h5BrowserOnly = assessSourceBridgeReadiness(browserOnlySource, browserOnlyCapability, {
  platform: 'h5',
  bridge: {}
})

assert.equal(h5BrowserOnly.status, 'apk-required')
assert.equal(h5BrowserOnly.requiresWebViewBridge, true)
assert.equal(h5BrowserOnly.bridge.renderedFetch, false)
assert.equal(h5BrowserOnly.recommendedLane, 'webview-rendered-dom')
assert.ok(h5BrowserOnly.blockers.some(item => item.code === 'APK_REQUIRED_FOR_WEBVIEW'))
assert.ok(h5BrowserOnly.diagnostics.some(item => item.key === 'js-mode' && item.value === '浏览器 DOM JS'))

const sandboxSource = {
  id: 'sandbox-js',
  name: 'Sandbox JS',
  raw: {
    bookSourceName: 'Sandbox JS',
    bookSourceUrl: 'https://example.test',
    searchUrl: 'https://example.test/search?q={{key}}',
    ruleSearch: { bookList: '.book', name: '<js>encodeURIComponent(name)</js>' }
  }
}

const sandboxCapability = buildSourceCapability(sandboxSource)
const h5Sandbox = assessSourceBridgeReadiness(sandboxSource, sandboxCapability, {
  platform: 'h5',
  bridge: {}
})

assert.equal(h5Sandbox.status, 'h5-ready')
assert.equal(h5Sandbox.requiresWebViewBridge, false)
assert.equal(h5Sandbox.recommendedLane, 'http-rule-js')
assert.ok(h5Sandbox.diagnostics.some(item => item.key === 'js-mode' && item.value === 'H5 沙箱 JS'))

const androidReady = assessSourceBridgeReadiness(browserOnlySource, browserOnlyCapability, {
  platform: 'android',
  bridge: {
    renderedFetch: true,
    openLogin: true,
    readCookie: true
  }
})

assert.equal(androidReady.status, 'bridge-ready')
assert.equal(androidReady.bridge.renderedFetch, true)
assert.equal(androidReady.bridge.openLogin, true)
assert.equal(androidReady.bridge.readCookie, true)
assert.equal(androidReady.blockers.length, 0)

console.log('sourceBridgeReadiness tests passed')
