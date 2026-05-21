import assert from 'node:assert/strict'
import {
  assertFileExtension,
  chooseSingleFile,
  getClipboardText,
  getPickedFileName,
  normalizePickedFile,
  readPickedFileText,
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

await assert.rejects(
  () => scanImportPayload({ scanCode: options => options.success({ result: '   ' }) }),
  /扫码结果为空/
)

const fetchedText = await readPickedFileText(
  { path: 'blob:source-json' },
  { fetch: async path => ({ text: async () => `read:${path}` }) }
)
assert.equal(fetchedText, 'read:blob:source-json')

await assert.rejects(
  () => readPickedFileText({ name: 'missing.json' }, {}),
  /当前环境无法读取文件/
)

console.log('importAdapters tests passed')
