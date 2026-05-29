import assert from 'node:assert/strict'
import {
  assertFileExtension,
  chooseSingleFile,
  getClipboardText,
  getPickedFileName,
  normalizePickedFile,
  readAndroidContentUriText,
  readImportFilePayload,
  readPickedFileText,
  normalizeImportPayload,
  scanWithWebBarcodeDetector,
  scanImportPayload
} from '../common/importAdapters.js'

const h5File = normalizePickedFile({
  tempFiles: [{ name: 'sources.json', file: { marker: 'browser-file' } }]
})
assert.equal(h5File.name, 'sources.json')
assert.deepEqual(h5File.file, { marker: 'browser-file' })
assert.equal(getPickedFileName(h5File), 'sources.json')

const androidFile = normalizePickedFile({
  tempFiles: [{ path: '_doc/import/bookSources.JSON' }]
})
assert.equal(androidFile.path, '_doc/import/bookSources.JSON')
assert.equal(getPickedFileName(androidFile), 'bookSources.JSON')
assertFileExtension(androidFile, '.json', '请选择 .json 书源文件')

const legacyFile = normalizePickedFile({
  tempFilePaths: ['file:///storage/emulated/0/Download/book.txt']
})
assert.equal(legacyFile.path, 'file:///storage/emulated/0/Download/book.txt')
assert.equal(getPickedFileName(legacyFile), 'book.txt')
assert.throws(
  () => assertFileExtension(legacyFile, '.json', '请选择 .json 书源文件'),
  /请选择 \.json 书源文件/
)

await assert.rejects(
  () => chooseSingleFile({}, { label: '本地 JSON' }),
  /当前环境暂不支持文件选择/
)

const picked = await chooseSingleFile({
  chooseFile(options) {
    assert.equal(options.count, 1)
    assert.deepEqual(options.extension, ['.json'])
    options.success({ tempFiles: [{ name: 'picked.json', path: '/tmp/picked.json' }] })
  }
}, {
  extension: ['.json']
})
assert.equal(picked.name, 'picked.json')

let launchedIntent = null
const androidRuntime = {
  plus: {
    os: { name: 'Android' },
    android: {
      importClass(name) {
        if (name === 'android.content.Intent') {
          function Intent(action) {
            this.action = action
            this.categories = []
            this.extras = {}
          }
          Intent.ACTION_OPEN_DOCUMENT = 'android.intent.action.OPEN_DOCUMENT'
          Intent.CATEGORY_OPENABLE = 'android.intent.category.OPENABLE'
          Intent.EXTRA_MIME_TYPES = 'android.intent.extra.MIME_TYPES'
          Intent.prototype.addCategory = function addCategory(category) {
            this.categories.push(category)
          }
          Intent.prototype.setType = function setType(type) {
            this.type = type
          }
          Intent.prototype.putExtra = function putExtra(name, value) {
            this.extras[name] = value
          }
          return Intent
        }
        return function MockClass() {}
      },
      runtimeMainActivity() {
        return {
          RESULT_OK: -1,
          startActivityForResult(intent, requestCode) {
            launchedIntent = { intent, requestCode }
            this.onActivityResult(requestCode, -1, {
              getData: () => ({ toString: () => 'content://downloads/document/42' })
            })
          }
        }
      }
    }
  }
}
const androidPicked = await chooseSingleFile({}, {
  extension: ['.txt'],
  label: 'TXT',
  runtime: androidRuntime
})
assert.equal(androidPicked.path, 'content://downloads/document/42')
assert.equal(androidPicked.name, 'content://downloads/document/42')
assert.equal(launchedIntent.intent.action, 'android.intent.action.OPEN_DOCUMENT')
assert.equal(launchedIntent.intent.type, 'text/plain')

assert.equal(await getClipboardText({
  getClipboardData(options) {
    options.success({ data: '  [{"bookSourceName":"A"}]  ' })
  }
}), '[{"bookSourceName":"A"}]')

await assert.rejects(
  () => getClipboardText({ getClipboardData: options => options.fail(new Error('denied')) }),
  /读取剪贴板失败/
)

assert.equal(await scanImportPayload({
  scanCode(options) {
    assert.equal(options.onlyFromCamera, false)
    options.success({ result: ' yuedu://source?src=https%3A%2F%2Fexample.com%2Fa.json ' })
  }
}), 'yuedu://source?src=https%3A%2F%2Fexample.com%2Fa.json')

assert.deepEqual(normalizeImportPayload('  [{"bookSourceName":"A"}]  ', { fileName: 'sources.json' }), {
  type: 'json',
  url: '',
  text: '[{"bookSourceName":"A"}]',
  fileName: 'sources.json'
})

assert.deepEqual(normalizeImportPayload('legado://import?src=https%3A%2F%2Fexample.com%2Fsources.json'), {
  type: 'import-link',
  url: 'https://example.com/sources.json',
  text: '',
  fileName: ''
})

const txtPayload = await readImportFilePayload(
  { name: 'book.txt', path: 'blob:book-txt' },
  { extension: ['.txt'], importType: 'txt' },
  { fetch: async () => ({ text: async () => '\ufeff第一章 开始\n正文内容' }) }
)
assert.deepEqual(txtPayload, {
  type: 'txt',
  url: '',
  text: '第一章 开始\n正文内容',
  fileName: 'book.txt'
})

await assert.rejects(
  () => scanImportPayload({ scanCode: options => options.success({ result: '   ' }) }),
  /扫码结果为空/
)

const webScanEvents = []
const webScanPayload = await scanWithWebBarcodeDetector({
  navigator: {
    mediaDevices: {
      getUserMedia: async constraints => {
        webScanEvents.push(constraints.video.facingMode)
        return {
          getTracks: () => [{ stop: () => webScanEvents.push('stopped') }]
        }
      }
    }
  },
  BarcodeDetector: class MockDetector {
    async detect() {
      return [{ rawValue: 'https://www.yckceo.com/yuedu/shuyuan/index.html' }]
    }
  },
  document: {
    body: {
      appendChild(node) {
        webScanEvents.push(node.className)
      }
    },
    createElement(tag) {
      return {
        tagName: tag,
        style: {},
        className: '',
        textContent: '',
        playsInline: false,
        muted: false,
        srcObject: null,
        appendChild() {},
        remove: () => webScanEvents.push(`removed:${tag}`),
        addEventListener() {},
        play: async () => webScanEvents.push('played')
      }
    }
  },
  requestAnimationFrame: callback => {
    callback()
    return 1
  },
  cancelAnimationFrame: id => webScanEvents.push(`cancel:${id}`)
}, { timeoutMs: 500 })
assert.equal(webScanPayload, 'https://www.yckceo.com/yuedu/shuyuan/index.html')
assert.deepEqual(webScanEvents, ['novel-scan-overlay', 'environment', 'played', 'stopped', 'removed:div', 'cancel:1'])

assert.equal(await scanImportPayload({}, {
  runtime: {
    navigator: {
      mediaDevices: {
        getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] })
      }
    },
    BarcodeDetector: class MockDetector {
      async detect() {
        return [{ rawValue: 'legado://import?src=https%3A%2F%2Fexample.com%2Fs.json' }]
      }
    },
    document: {
      body: { appendChild() {} },
      createElement() {
        return {
          style: {},
          appendChild() {},
          remove() {},
          addEventListener() {},
          play: async () => {}
        }
      }
    },
    requestAnimationFrame: callback => {
      callback()
      return 7
    },
    cancelAnimationFrame() {}
  },
  timeoutMs: 500
}), 'legado://import?src=https%3A%2F%2Fexample.com%2Fs.json')

const fetchedText = await readPickedFileText(
  { path: 'blob:source-json' },
  { fetch: async path => ({ text: async () => `read:${path}` }) }
)
assert.equal(fetchedText, 'read:blob:source-json')

assert.equal(await readAndroidContentUriText('content://downloads/document/42', {
  plus: {
    android: {
      importClass(target) {
        return target
      },
      invoke(target, method) {
        if (method === 'getContentResolver') return 'resolver'
        if (method === 'parse') return 'uri'
        if (method === 'openInputStream') {
          return {
            offset: 0,
            bytes: [65, 66, 67],
            read(buffer) {
              if (this.offset >= this.bytes.length) return -1
              buffer[0] = this.bytes[this.offset]
              this.offset += 1
              return 1
            },
            close() {}
          }
        }
        if (method === 'toByteArray') return [65, 66, 67]
        return null
      },
      newObject(name) {
        if (name === 'java.io.ByteArrayOutputStream') {
          return {
            data: [],
            write(buffer, offset, length) {
              this.data.push(...buffer.slice(offset, offset + length))
            },
            close() {}
          }
        }
        if (name === 'java.lang.String') return 'ABC'
        return {}
      },
      runtimeMainActivity() {
        return 'activity'
      }
    }
  }
}), 'ABC')

await assert.rejects(
  () => readPickedFileText({ name: 'missing.json' }, {}),
  /当前环境无法读取文件/
)

console.log('importAdapters tests passed')
