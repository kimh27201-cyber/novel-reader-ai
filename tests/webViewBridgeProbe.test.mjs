import assert from 'node:assert/strict'
import { getWebViewBridgeCapabilities, probeWebViewBridge } from '../common/webViewBridge.js'

delete globalThis.window
const h5Capabilities = getWebViewBridgeCapabilities()
assert.equal(h5Capabilities.available, false)
assert.equal(h5Capabilities.renderedFetch, false)
assert.equal(h5Capabilities.openLogin, false)
assert.equal(h5Capabilities.readCookie, false)

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
    getCookie() { return '' }
  }
}

const readyCapabilities = getWebViewBridgeCapabilities()
assert.equal(readyCapabilities.available, true)
assert.deepEqual(readyCapabilities.methods.sort(), ['fetchRenderedHtml', 'getCookie', 'openLoginPage'].sort())

const readyProbe = probeWebViewBridge()
assert.equal(readyProbe.status, 'ready')
assert.deepEqual(readyProbe.missing, [])
assert.match(readyProbe.message, /可用/)
assert.ok(readyProbe.checkedAt)

console.log('webViewBridgeProbe tests passed')
