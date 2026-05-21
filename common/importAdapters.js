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

export function assertFileExtension(file, extension, message) {
  const allowed = Array.isArray(extension) ? extension : [extension]
  const name = getPickedFileName(file).toLowerCase()
  const matched = allowed.some(item => name.endsWith(String(item || '').toLowerCase()))
  if (!matched) throw new Error(message || `请选择 ${allowed.join(' / ')} 文件`)
  return true
}

export function chooseSingleFile(api, options = {}) {
  const uniApi = getUniApi(api)
  if (!uniApi.chooseFile) {
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

export function scanImportPayload(api) {
  const uniApi = getUniApi(api)
  if (!uniApi.scanCode) {
    return Promise.reject(new Error('H5 预览不支持扫码，请用真机测试或剪贴板导入'))
  }

  return new Promise((resolve, reject) => {
    uniApi.scanCode({
      onlyFromCamera: false,
      success: result => {
        const payload = String(result && result.result || '').trim()
        if (!payload) {
          reject(new Error('扫码结果为空'))
          return
        }
        resolve(payload)
      },
      fail: () => reject(new Error('未完成扫码'))
    })
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
