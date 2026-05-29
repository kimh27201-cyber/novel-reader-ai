import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildImportReadiness,
  summarizeImportReadiness
} from '../common/importReadiness.js'

const webviewRuntime = {
  fetch: async () => ({}),
  BarcodeDetector: function BarcodeDetector() {},
  navigator: {
    mediaDevices: {
      getUserMedia: async () => ({})
    }
  },
  document: {
    createElement(tag) {
      return tag === 'input' ? { type: 'file' } : {}
    }
  }
}

const webview = buildImportReadiness(webviewRuntime)
assert.equal(webview.ready, true)
assert.equal(webview.items.every(item => item.state === 'ready'), true)
assert.deepEqual(
  webview.items.map(item => item.id),
  ['network-import', 'legado3-import', 'scan-import', 'file-import']
)

const webviewSummary = summarizeImportReadiness(webview)
assert.equal(webviewSummary.total, 4)
assert.equal(webviewSummary.readyCount, 4)
assert.equal(webviewSummary.blockedCount, 0)
assert.match(webviewSummary.text, /4\/4/)

const limitedH5 = buildImportReadiness({
  fetch: async () => ({}),
  document: {
    createElement(tag) {
      return tag === 'input' ? { type: 'file' } : {}
    }
  }
})
assert.equal(limitedH5.ready, false)
assert.equal(limitedH5.items.find(item => item.id === 'network-import').state, 'ready')
assert.equal(limitedH5.items.find(item => item.id === 'file-import').state, 'ready')
assert.equal(limitedH5.items.find(item => item.id === 'scan-import').state, 'blocked')
assert.match(limitedH5.items.find(item => item.id === 'scan-import').detail, /剪贴板/)

const noNetwork = buildImportReadiness({
  uni: {
    chooseFile() {}
  }
})
assert.equal(noNetwork.items.find(item => item.id === 'network-import').state, 'blocked')
assert.equal(noNetwork.items.find(item => item.id === 'file-import').state, 'ready')

const library = readFileSync(new URL('../pages/library/library.vue', import.meta.url), 'utf8')
assert.match(library, /buildImportReadiness/)
assert.match(library, /summarizeImportReadiness/)
assert.match(library, /importReadiness/)
assert.match(library, /refreshImportReadiness/)
assert.match(library, /真实导入自检/)

console.log('importReadiness tests passed')
