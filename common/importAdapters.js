import { detectSourceImportPayload } from './sourceEngine.js'

const NATIVE_SCAN_TIMEOUT_MS = 2500
const NATIVE_BRIDGE_SCAN_TIMEOUT_MS = 15000

function getUniApi(api) {
  return api || globalThis.uni || {}
}

export function normalizePickedFile(result = {}) {
  const picked = Array.isArray(result.tempFiles) && result.tempFiles.length
    ? result.tempFiles[0]
    : Array.isArray(result.tempFilePaths) && result.tempFilePaths.length
      ? { path: result.tempFilePaths[0], name: result.tempFilePaths[0] }
      : result

  if (typeof picked === 'string') {
    return { path: picked, name: picked }
  }

  return {
    ...picked,
    path: picked && (picked.path || picked.tempFilePath || picked.url),
    name: picked && (picked.name || picked.fileName || picked.path || picked.tempFilePath || picked.url)
  }
}

export function getPickedFileName(file = {}) {
  return String(file.name || file.path || '未命名').split(/[\\/]/).pop()
}

export function normalizeImportPayload(value, options = {}) {
  const fileName = String(options.fileName || '').trim()
  const text = stripTextBom(String(value || '').trim())
  const importType = String(options.importType || '').trim().toLowerCase()

  if (importType === 'txt' || /\.txt$/i.test(fileName)) {
    return {
      type: 'txt',
      url: '',
      text,
      fileName
    }
  }

  const payload = detectSourceImportPayload(text)
  return {
    type: payload.type,
    url: payload.type === 'json' ? '' : payload.value,
    text: payload.type === 'json' ? payload.value : '',
    fileName
  }
}

export async function readImportFilePayload(file = {}, options = {}, env = globalThis) {
  if (options.extension) {
    assertFileExtension(file, options.extension, options.message)
  }
  const text = await readPickedFileText(file, env)
  return normalizeImportPayload(text, {
    fileName: getPickedFileName(file),
    importType: options.importType
  })
}

export function assertFileExtension(file, extension, message) {
  const allowed = Array.isArray(extension) ? extension : [extension]
  const name = getPickedFileName(file).toLowerCase()
  const matched = allowed.some(item => name.endsWith(String(item || '').toLowerCase()))
  if (!matched) throw new Error(message || `请选择 ${allowed.join(' / ')} 文件`)
  return true
}

export function chooseSingleFile(api, options = {}) {
  const uniApi = getUniApi(api)
  const runtime = options.runtime || globalThis

  // App-Plus exposes uni.chooseFile as a placeholder on Android. Calling it
  // only prints "API chooseFile is not yet implemented" and never opens the
  // picker, so prefer the native document picker whenever the bridge exists.
  if (canUseAndroidDocumentPicker(runtime)) {
    return chooseAndroidDocumentFile(options, runtime)
  }

  if (typeof uniApi.chooseFile !== 'function') {
    return Promise.reject(new Error('当前环境暂不支持文件选择，请使用粘贴导入'))
  }

  return new Promise((resolve, reject) => {
    uniApi.chooseFile({
      count: 1,
      type: options.type || 'all',
      extension: options.extension || [],
      success: result => {
        const file = normalizePickedFile(result)
        if (!file || (!file.path && !file.file && !file.name)) {
          reject(new Error('没有选择文件'))
          return
        }
        resolve(file)
      },
      fail: () => reject(new Error(`${options.label || '文件'}选择失败或已取消`))
    })
  })
}

function canUseAndroidDocumentPicker(runtime = globalThis) {
  return !!(
    runtime &&
    runtime.plus &&
    runtime.plus.android &&
    runtime.plus.os &&
    String(runtime.plus.os.name || '').toLowerCase() === 'android'
  )
}

function getMimeType(extensions = []) {
  const list = (Array.isArray(extensions) ? extensions : [extensions])
    .map(item => String(item || '').toLowerCase())
  if (list.length === 1 && list[0] === '.txt') return 'text/plain'
  if (list.length === 1 && list[0] === '.json') return 'application/json'
  return '*/*'
}

function chooseAndroidDocumentFile(options = {}, runtime = globalThis) {
  return new Promise((resolve, reject) => {
    try {
      const android = runtime.plus.android
      const Intent = android.importClass('android.content.Intent')
      const main = android.runtimeMainActivity()
      const requestCode = Date.now() % 100000
      const previousHandler = main.onActivityResult
      const intent = new Intent(Intent.ACTION_OPEN_DOCUMENT || 'android.intent.action.OPEN_DOCUMENT')
      const openable = Intent.CATEGORY_OPENABLE || 'android.intent.category.OPENABLE'

      if (intent.addCategory) intent.addCategory(openable)
      if (intent.setType) intent.setType(getMimeType(options.extension))
      if (intent.addFlags) intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION || 1)

      main.onActivityResult = function onActivityResult(code, resultCode, data) {
        if (code !== requestCode) {
          if (typeof previousHandler === 'function') return previousHandler.apply(this, arguments)
          return undefined
        }

        main.onActivityResult = previousHandler
        const okCode = typeof main.RESULT_OK === 'number' ? main.RESULT_OK : -1
        if (resultCode !== okCode || !data || !data.getData) {
          reject(new Error(`${options.label || '文件'}选择失败或已取消`))
          return undefined
        }

        if (android.importClass) android.importClass(data)
        const uri = invokeAndroid(android, data, 'getData')
        if (uri && android.importClass) android.importClass(uri)
        const path = uri
          ? String(invokeAndroid(android, uri, 'toString') || '')
          : ''
        if (!path) {
          reject(new Error('没有选择文件'))
          return undefined
        }

        const name = getAndroidDocumentName(android, main, uri) ||
          getAndroidFallbackFileName(path, options.extension)
        resolve({ path, name, type: 'android-content-uri' })
        return undefined
      }

      main.startActivityForResult(intent, requestCode)
    } catch (error) {
      reject(new Error(`${options.label || '文件'}选择失败或已取消`))
    }
  })
}

export function getClipboardText(api) {
  const uniApi = getUniApi(api)
  if (!uniApi.getClipboardData) {
    return Promise.reject(new Error('当前环境不支持读取剪贴板'))
  }

  return new Promise((resolve, reject) => {
    uniApi.getClipboardData({
      success: result => resolve(String(result && result.data || '').trim()),
      fail: () => reject(new Error('读取剪贴板失败'))
    })
  })
}

export function scanImportPayload(api, options = {}) {
  const uniApi = getUniApi(api)
  const runtime = options.runtime || globalThis
  const fallbackToWebScanner = error => scanWithWebBarcodeDetector(options.runtime || globalThis, options).catch(webError => {
    throw new Error(
      webError && webError.message
        ? webError.message
        : error && error.message
          ? error.message
          : 'Scan is not available. Use clipboard or URL import.'
    )
  })

  const fallbackToUniScan = nativeError => {
    if (!uniApi.scanCode) return fallbackToWebScanner(nativeError)
    return scanWithUniCode(uniApi, options, fallbackToWebScanner)
  }

  if (canUseNativeScanBridge(runtime)) {
    return scanWithNativeBridge(runtime, options).catch(fallbackToUniScan)
  }

  if (!uniApi.scanCode) {
    return fallbackToWebScanner(new Error('uni.scanCode is not available'))
  }

  return scanWithUniCode(uniApi, options, fallbackToWebScanner)
}

function scanWithUniCode(uniApi, options = {}, fallbackToWebScanner) {
  return new Promise((resolve, reject) => {
    let finished = false
    const timeoutId = setTimeout(() => {
      if (finished) return
      finished = true
      fallbackToWebScanner(new Error('Native scan did not respond')).then(resolve).catch(reject)
    }, options.nativeTimeoutMs || NATIVE_SCAN_TIMEOUT_MS)

    const finish = (error, value) => {
      if (finished) return
      finished = true
      clearTimeout(timeoutId)
      if (error) reject(error)
      else resolve(value)
    }

    uniApi.scanCode({
      onlyFromCamera: false,
      success: result => {
        const payload = String(result && result.result || '').trim()
        if (!payload) {
          finish(new Error('Scan result is empty'))
          return
        }
        finish(null, payload)
      },
      fail: error => {
        fallbackToWebScanner(error).then(value => finish(null, value)).catch(finish)
      }
    })
  })
}

function invokeAndroid(android, target, method, ...args) {
  if (target && typeof target[method] === 'function') {
    return target[method](...args)
  }
  return android.invoke(target, method, ...args)
}

function getAndroidDocumentName(android, activity, uri) {
  let cursor = null
  try {
    const resolver = invokeAndroid(android, activity, 'getContentResolver')
    const columns = android.importClass('android.provider.OpenableColumns')
    cursor = invokeAndroid(android, resolver, 'query', uri, null, null, null, null)
    if (!cursor) return ''
    if (android.importClass) android.importClass(cursor)
    if (!invokeAndroid(android, cursor, 'moveToFirst')) return ''
    const displayNameColumn = columns && columns.DISPLAY_NAME
      ? columns.DISPLAY_NAME
      : '_display_name'
    const columnIndex = invokeAndroid(android, cursor, 'getColumnIndex', displayNameColumn)
    if (columnIndex == null || columnIndex < 0) return ''
    return String(invokeAndroid(android, cursor, 'getString', columnIndex) || '').trim()
  } catch (error) {
    return ''
  } finally {
    try {
      if (cursor) invokeAndroid(android, cursor, 'close')
    } catch (error) {
      // The selected content URI is still readable without a display name.
    }
  }
}

function getAndroidFallbackFileName(path, extensions = []) {
  const pathName = getPickedFileName({ path })
  if (/\.[a-z0-9]+$/i.test(pathName)) return pathName
  const list = Array.isArray(extensions) ? extensions : [extensions]
  const extension = String(list[0] || '').trim()
  return `selected-file${extension.startsWith('.') ? extension : extension ? `.${extension}` : ''}`
}

function canUseNativeScanBridge(runtime = globalThis) {
  const bridge = runtime && runtime.NovelReaderScan
  return !!(bridge && typeof bridge.scanQr === 'function')
}

export function scanWithNativeBridge(runtime = globalThis, options = {}) {
  const bridge = runtime && runtime.NovelReaderScan
  if (!bridge || typeof bridge.scanQr !== 'function') {
    return Promise.reject(new Error('当前环境没有原生扫码桥接'))
  }

  return new Promise((resolve, reject) => {
    const callbackName = `__novelReaderScanCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`
    let finished = false
    let timeoutId = 0

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId)
      try {
        if (runtime && runtime[callbackName]) delete runtime[callbackName]
      } catch (error) {
        runtime[callbackName] = undefined
      }
      try {
        if (globalThis[callbackName]) delete globalThis[callbackName]
      } catch (error) {
        globalThis[callbackName] = undefined
      }
    }

    const finish = (error, value) => {
      if (finished) return
      finished = true
      cleanup()
      if (error) reject(error)
      else resolve(value)
    }

    const callback = rawResult => {
      try {
        const result = parseNativeScanResult(rawResult)
        if (!result.ok) {
          finish(new Error(result.error || '原生扫码未完成'))
          return
        }
        if (!result.value) {
          finish(new Error('扫码结果为空'))
          return
        }
        finish(null, result.value)
      } catch (error) {
        finish(error)
      }
    }

    runtime[callbackName] = callback
    globalThis[callbackName] = callback
    timeoutId = setTimeout(() => finish(new Error('原生扫码超时，请重试或使用粘贴导入')), options.nativeBridgeTimeoutMs || NATIVE_BRIDGE_SCAN_TIMEOUT_MS)

    try {
      const accepted = bridge.scanQr(callbackName)
      if (accepted === false) {
        finish(new Error('原生扫码启动失败'))
      }
    } catch (error) {
      finish(new Error(error && error.message ? error.message : '原生扫码启动失败'))
    }
  })
}

function parseNativeScanResult(rawResult) {
  let result = rawResult
  if (typeof result === 'string') {
    const text = result.trim()
    if (/^\{[\s\S]*\}$/.test(text)) {
      try {
        result = JSON.parse(text)
      } catch (error) {
        result = { ok: true, result: text }
      }
    } else {
      result = { ok: true, result: text }
    }
  }

  if (!result || typeof result !== 'object') {
    return { ok: false, value: '', error: '原生扫码返回无效' }
  }

  const ok = result.ok !== false && !result.cancelled
  const value = String(result.result || result.text || result.url || '').trim()
  const error = String(result.error || result.message || '').trim()
  return { ok, value, error }
}

export function scanWithWebBarcodeDetector(runtime = globalThis, options = {}) {
  const detectorClass = runtime.BarcodeDetector || globalThis.BarcodeDetector
  const mediaDevices = runtime.navigator && runtime.navigator.mediaDevices
  const documentRef = runtime.document || globalThis.document
  const requestFrame = runtime.requestAnimationFrame || globalThis.requestAnimationFrame
  const cancelFrame = runtime.cancelAnimationFrame || globalThis.cancelAnimationFrame

  if (!detectorClass || !mediaDevices || !mediaDevices.getUserMedia || !documentRef || !documentRef.createElement) {
    return Promise.reject(new Error('当前 WebView 不支持摄像头扫码，请改用剪贴板或网络导入'))
  }

  return new Promise((resolve, reject) => {
    let stream = null
    let frameId = 0
    let finished = false
    let overlay = null
    let video = null
    let timeoutId = 0

    const finish = (error, value) => {
      if (finished) return
      finished = true
      if (timeoutId) clearTimeout(timeoutId)
      if (stream && stream.getTracks) {
        stream.getTracks().forEach(track => {
          if (track && track.stop) track.stop()
        })
      }
      if (overlay && overlay.remove) overlay.remove()
      if (frameId && cancelFrame) cancelFrame(frameId)
      if (error) reject(error)
      else resolve(value)
    }

    const buildOverlay = () => {
      overlay = documentRef.createElement('div')
      overlay.className = 'novel-scan-overlay'
      overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#050607;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;'

      video = documentRef.createElement('video')
      video.playsInline = true
      video.muted = true
      video.style.cssText = 'width:100%;height:70%;object-fit:cover;background:#000;'

      const label = documentRef.createElement('div')
      label.textContent = '将二维码放入取景框'
      label.style.cssText = 'padding:16px;font-size:16px;'

      const cancel = documentRef.createElement('button')
      cancel.textContent = '取消扫码'
      cancel.style.cssText = 'margin-top:12px;padding:10px 18px;border:0;border-radius:6px;background:#e25f35;color:#fff;'
      if (cancel.addEventListener) {
        cancel.addEventListener('click', () => finish(new Error('未完成扫码')))
      }

      overlay.appendChild(video)
      overlay.appendChild(label)
      overlay.appendChild(cancel)
      documentRef.body.appendChild(overlay)
    }

    const start = async () => {
      try {
        buildOverlay()
        const detector = new detectorClass({ formats: ['qr_code'] })
        stream = await mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        })
        video.srcObject = stream
        if (video.play) await video.play()

        const scanFrame = async () => {
          if (finished) return
          try {
            const codes = await detector.detect(video)
            const raw = codes && codes[0] && (codes[0].rawValue || codes[0].rawData)
            if (raw) {
              finish(null, String(raw).trim())
              return
            }
          } catch (error) {
            // Keep scanning while the video warms up.
          }
          frameId = requestFrame ? requestFrame(scanFrame) : setTimeout(scanFrame, 120)
        }

        frameId = requestFrame ? requestFrame(scanFrame) : setTimeout(scanFrame, 120)
        timeoutId = setTimeout(() => finish(new Error('扫码超时，请重试或使用剪贴板导入')), options.timeoutMs || 30000)
      } catch (error) {
        finish(new Error('无法打开摄像头，请检查相机权限或使用剪贴板导入'))
      }
    }

    start()
  })
}

export function readPickedFileText(file = {}, env = globalThis) {
  const runtime = env || globalThis
  const BrowserFileReader = runtime.FileReader || globalThis.FileReader
  const RuntimeTextDecoder = runtime.TextDecoder || globalThis.TextDecoder
  if (file.file && typeof BrowserFileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new BrowserFileReader()
      reader.onload = event => {
        const value = event && event.target && event.target.result
        if (typeof value === 'string') {
          resolve(value)
          return
        }
        resolve(new RuntimeTextDecoder('utf-8').decode(value))
      }
      reader.onerror = () => reject(new Error('读取文件失败'))
      reader.readAsArrayBuffer(file.file)
    })
  }

  if (file.path && /^content:\/\//i.test(file.path) && runtime.plus && runtime.plus.android) {
    return readAndroidContentUriText(file.path, runtime)
  }

  if (file.path && runtime.plus && runtime.plus.io) {
    return new Promise((resolve, reject) => {
      runtime.plus.io.resolveLocalFileSystemURL(file.path, entry => {
        entry.file(rawFile => {
          const reader = new runtime.plus.io.FileReader()
          reader.onloadend = event => resolve(event && event.target && event.target.result || '')
          reader.onerror = () => reject(new Error('读取文件失败'))
          reader.readAsText(rawFile, 'utf-8')
        }, reject)
      }, reject)
    })
  }

  if (file.path && typeof runtime.fetch === 'function') {
    return runtime.fetch(file.path).then(response => response.text())
  }

  return Promise.reject(new Error('当前环境无法读取文件'))
}

export function readAndroidContentUriText(path, env = globalThis) {
  return new Promise((resolve, reject) => {
    try {
      const android = env && env.plus && env.plus.android
      if (!android) throw new Error('missing android runtime')
      const Uri = android.importClass('android.net.Uri')
      android.importClass('java.io.ByteArrayOutputStream')
      android.importClass('java.lang.String')

      const activity = android.runtimeMainActivity()
      const resolver = android.invoke(activity, 'getContentResolver')
      const uri = android.invoke(Uri, 'parse', path)
      const input = android.invoke(resolver, 'openInputStream', uri)
      const output = android.newObject('java.io.ByteArrayOutputStream')
      const buffer = new Array(4096).fill(0)

      while (true) {
        const length = typeof input.read === 'function'
          ? input.read(buffer)
          : android.invoke(input, 'read', buffer)
        if (length === -1 || length == null) break
        if (typeof output.write === 'function') output.write(buffer, 0, length)
        else android.invoke(output, 'write', buffer, 0, length)
      }

      const bytes = android.invoke(output, 'toByteArray')
      const text = android.newObject('java.lang.String', bytes, 'UTF-8')
      if (input && typeof input.close === 'function') input.close()
      if (output && typeof output.close === 'function') output.close()
      resolve(String(text || ''))
    } catch (error) {
      reject(new Error('读取文件失败'))
    }
  })
}

function stripTextBom(value) {
  return String(value || '').replace(/^\ufeff/, '')
}
