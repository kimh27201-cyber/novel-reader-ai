import assert from 'node:assert/strict'
import {
  getWebViewBridgeCapabilities,
  openSourceLogin,
  probeWebViewBridge,
  readSourceLoginCookie
} from '../common/webViewBridge.js'

delete globalThis.window
const h5Capabilities = getWebViewBridgeCapabilities()
assert.equal(h5Capabilities.available, false)
assert.equal(h5Capabilities.renderedFetch, false)
assert.equal(h5Capabilities.openLogin, false)
assert.equal(h5Capabilities.readCookie, false)
assert.equal(h5Capabilities.profile, null)

const h5Probe = probeWebViewBridge()
assert.equal(h5Probe.status, 'missing')
assert.ok(h5Probe.missing.includes('renderedFetch'))
assert.ok(h5Probe.missing.includes('openLogin'))
assert.ok(h5Probe.missing.includes('readCookie'))
assert.match(h5Probe.message, /未检测到/)

globalThis.window = {
  NovelReaderWebViewParser: {
    fetchRenderedHtml() {},
    openLoginPage() {},
    getCookie() { return '' },
    getBridgeInfo() {
      return JSON.stringify({
        contractVersion: 1,
        runtime: 'android-webview-shell',
        platform: 'android',
        features: {
          renderedFetch: true,
          openLogin: true,
          readCookie: true
        },
        methods: ['getBridgeInfo', 'fetchRenderedHtml', 'openLoginPage', 'getCookie']
      })
    }
  }
}

const readyCapabilities = getWebViewBridgeCapabilities()
assert.equal(readyCapabilities.available, true)
assert.deepEqual(readyCapabilities.methods.sort(), ['fetchRenderedHtml', 'getBridgeInfo', 'getCookie', 'openLoginPage'].sort())
assert.equal(readyCapabilities.profile.contractVersion, 1)
assert.equal(readyCapabilities.profile.runtime, 'android-webview-shell')
assert.equal(readyCapabilities.profile.features.renderedFetch, true)

const readyProbe = probeWebViewBridge()
assert.equal(readyProbe.status, 'ready')
assert.deepEqual(readyProbe.missing, [])
assert.match(readyProbe.message, /可用/)
assert.ok(readyProbe.checkedAt)
assert.equal(readyProbe.capabilities.profile.platform, 'android')

globalThis.window = {
  NovelReaderWebViewParser: {
    openLoginPage(url) { this.loginUrl = url; return true },
    getCookie(url) { return url === this.loginUrl ? 'sid=login' : '' },
    getBridgeInfo() {
      return JSON.stringify({
        contractVersion: 1,
        runtime: 'android-session-only',
        platform: 'android',
        features: {
          renderedFetch: false,
          openLogin: true,
          readCookie: true
        }
      })
    }
  }
}

const sessionCapabilities = getWebViewBridgeCapabilities()
assert.equal(sessionCapabilities.renderedFetch, false)
assert.equal(sessionCapabilities.openLogin, true)
assert.equal(sessionCapabilities.readCookie, true)
assert.equal(openSourceLogin('https://example.com/login'), true)
assert.equal(readSourceLoginCookie('https://example.com/login'), 'sid=login')

console.log('webViewBridgeProbe tests passed')
