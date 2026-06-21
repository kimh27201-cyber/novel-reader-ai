import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const rootPath = fileURLToPath(root)
const appVue = readFileSync(new URL('../App.vue', import.meta.url), 'utf8')
const reader = readFileSync(new URL('../pages/reader/reader.vue', import.meta.url), 'utf8')
const webviewManifest = readFileSync(new URL('../android-webview-shell/AndroidManifest.xml', import.meta.url), 'utf8')
const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'))

const globalShellBlock = appVue.match(/\/\* H5 preview shell:[\s\S]*?\.app-page,/)
assert.ok(globalShellBlock, 'App.vue should keep a named H5 preview shell section')
assert.doesNotMatch(globalShellBlock[0], /border-left\s*:/, 'global app shell must not draw a left edge line')
assert.doesNotMatch(globalShellBlock[0], /border-right\s*:/, 'global app shell must not draw a right edge line')
assert.doesNotMatch(globalShellBlock[0], /box-shadow\s*:/, 'global app shell must not draw outer side shadows')

const pageBodyBlock = appVue.match(/uni-page-body\s*\{[\s\S]*?\n\}/)
assert.ok(pageBodyBlock, 'App.vue should configure H5 uni-page-body')
assert.doesNotMatch(pageBodyBlock[0], /border-left\s*:/, 'uni-page-body must not draw a left edge line')
assert.doesNotMatch(pageBodyBlock[0], /border-right\s*:/, 'uni-page-body must not draw a right edge line')
assert.doesNotMatch(pageBodyBlock[0], /box-shadow\s*:/, 'uni-page-body must not draw outer side shadows')

const tabbarBlock = appVue.match(/uni-tabbar \.uni-tabbar\s*\{[\s\S]*?\n\}/)
assert.ok(tabbarBlock, 'App.vue should configure H5 uni-tabbar')
assert.doesNotMatch(tabbarBlock[0], /border-left\s*:/, 'tabbar must not draw a left edge line')
assert.doesNotMatch(tabbarBlock[0], /border-right\s*:/, 'tabbar must not draw a right edge line')

const readerEmbedBlock = reader.match(/\.reader-embed\s*\{[\s\S]*?\n\}/)
assert.ok(readerEmbedBlock, 'reader should keep a reader-embed container')
assert.doesNotMatch(readerEmbedBlock[0], /border\s*:/, 'reader embed must not draw a framed edge around the page')
assert.doesNotMatch(readerEmbedBlock[0], /box-shadow\s*:/, 'reader embed must not draw outer side shadows')

const iconConfig = manifest['app-plus']?.distribute?.icons?.android
assert.deepEqual(
  iconConfig,
  {
    hdpi: 'static/branding/icon-hdpi.png',
    xhdpi: 'static/branding/icon-xhdpi.png',
    xxhdpi: 'static/branding/icon-xxhdpi.png',
    xxxhdpi: 'static/branding/icon-xxxhdpi.png',
  },
  'manifest should configure Android app icon densities'
)

for (const iconPath of Object.values(iconConfig)) {
  assert.ok(existsSync(resolve(rootPath, iconPath)), `${iconPath} should exist`)
}

assert.match(webviewManifest, /android:icon="@mipmap\/ic_launcher"/)

const expectedIconSizes = {
  'static/branding/icon-hdpi.png': 72,
  'static/branding/icon-xhdpi.png': 96,
  'static/branding/icon-xxhdpi.png': 144,
  'static/branding/icon-xxxhdpi.png': 192,
  'android-webview-shell/res/mipmap-hdpi/ic_launcher.png': 72,
  'android-webview-shell/res/mipmap-xhdpi/ic_launcher.png': 96,
  'android-webview-shell/res/mipmap-xxhdpi/ic_launcher.png': 144,
  'android-webview-shell/res/mipmap-xxxhdpi/ic_launcher.png': 192,
}

for (const [iconPath, expectedSize] of Object.entries(expectedIconSizes)) {
  const icon = readFileSync(resolve(rootPath, iconPath))
  assert.equal(icon.readUInt32BE(16), expectedSize, `${iconPath} width should be ${expectedSize}`)
  assert.equal(icon.readUInt32BE(20), expectedSize, `${iconPath} height should be ${expectedSize}`)
}

const iconSource = readFileSync(new URL('../static/branding/app-icon-source.svg', import.meta.url), 'utf8')
assert.match(iconSource, /aria-label="解码阅读 App icon"/)
assert.match(iconSource, /<title>解码阅读<\/title>/)
assert.doesNotMatch(iconSource, /璇\?|瑙ｇ爜|闃呰/)

console.log('app shell branding tests passed')
