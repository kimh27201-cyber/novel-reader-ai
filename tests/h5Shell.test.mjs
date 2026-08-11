import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const reader = readFileSync(new URL('../pages/reader/reader.vue', import.meta.url), 'utf8')
const profile = readFileSync(new URL('../pages/profile/profile.vue', import.meta.url), 'utf8')
const mainActivity = readFileSync(new URL('../android-webview-shell/src/com/novelreader/v1/MainActivity.java', import.meta.url), 'utf8')
const webviewManifest = readFileSync(new URL('../android-webview-shell/AndroidManifest.xml', import.meta.url), 'utf8')

assert.match(reader, /class="[^"]*reader-embed[^"]*"/)
assert.match(reader, /\.reader-embed\s*\{[\s\S]*position:\s*relative;/)
assert.match(reader, /\.top-chrome\s*\{[^}]*position:\s*absolute;/)
assert.match(reader, /\.bottom-chrome,[\s\S]*\.settings-panel[\s\S]*\{[\s\S]*position:\s*absolute;/)
assert.doesNotMatch(reader, /\.top-chrome\s*\{[^}]*position:\s*fixed;/)

assert.match(profile, /openSwagger/)
assert.match(profile, /FastAPI 未启动/)
assert.doesNotMatch(profile, /<switch v-if="item\.id === 'web'"/)

assert.match(webviewManifest, /android\.permission\.CAMERA/)
assert.match(mainActivity, /onPermissionRequest/)
assert.match(mainActivity, /RESOURCE_VIDEO_CAPTURE/)
assert.match(mainActivity, /requestPermissions/)
assert.match(mainActivity, /onRequestPermissionsResult/)
assert.match(mainActivity, /onShowFileChooser/)
assert.match(mainActivity, /ValueCallback<Uri\[\]>/)
assert.match(mainActivity, /ACTION_OPEN_DOCUMENT/)
assert.match(mainActivity, /onActivityResult/)
assert.match(mainActivity, /interceptExternalRequest/)
assert.match(mainActivity, /HttpURLConnection/)
assert.match(mainActivity, /Access-Control-Allow-Origin/)
assert.match(mainActivity, /isLocalHost/)
assert.match(mainActivity, /setCacheMode\(WebSettings\.LOAD_DEFAULT\)/)
assert.doesNotMatch(mainActivity, /clearCache\(true\)/)

console.log('h5Shell tests passed')
