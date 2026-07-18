import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ackNativeDeepLink,
  hasNativeDeepLinkBridge,
  normalizeDeepLinkToImportInput,
  peekNativeDeepLink
} from '../common/deepLinkBridge.js'

const jsonUrl = 'https://www.yckceo.com/yuedu/shuyuan/json/id/7514.json'

assert.equal(normalizeDeepLinkToImportInput(jsonUrl), jsonUrl)
assert.equal(
  normalizeDeepLinkToImportInput(`yuedu://booksource/import?src=${encodeURIComponent(jsonUrl)}`),
  jsonUrl
)
assert.equal(
  normalizeDeepLinkToImportInput(`legado://import/bookSource?url=${encodeURIComponent(jsonUrl)}`),
  jsonUrl
)
assert.equal(normalizeDeepLinkToImportInput('yuedu://booksource/import?id=7514'), 'yuedu://booksource/import?id=7514')

let pending = {
  ok: true,
  id: 'mock_1',
  uri: `yuedu://booksource/import?src=${encodeURIComponent(jsonUrl)}`,
  createdAt: Date.now(),
  source: 'mock'
}

const env = {
  NovelReaderDeepLinkBridge: {
    peekDeepLink() {
      return JSON.stringify(pending || { ok: false, reason: 'empty' })
    },
    ackDeepLink(id) {
      if (pending && pending.id === id) {
        pending = null
        return true
      }
      return false
    }
  }
}

assert.equal(hasNativeDeepLinkBridge(env), true)
const payload = peekNativeDeepLink(env)
assert.equal(payload.ok, true)
assert.equal(payload.id, 'mock_1')
assert.equal(normalizeDeepLinkToImportInput(payload.uri), jsonUrl)
assert.equal(ackNativeDeepLink('wrong_id', env), false)
assert.equal(pending.ok, true)
assert.equal(ackNativeDeepLink('mock_1', env), true)
assert.equal(peekNativeDeepLink(env).ok, false)

const scanPage = readFileSync(new URL('../pages/import/scan.vue', import.meta.url), 'utf8')
const bridgeModule = readFileSync(new URL('../common/deepLinkBridge.js', import.meta.url), 'utf8')
assert.match(scanPage, /tryHydrateFromNativeDeepLink/)
assert.match(scanPage, /scheduleNativeDeepLinkHydration/)
assert.match(scanPage, /ackNativeDeepLink/)
assert.match(bridgeModule, /pending_deeplink_import_input/)

console.log('deepLinkBridgeHydration tests passed')
