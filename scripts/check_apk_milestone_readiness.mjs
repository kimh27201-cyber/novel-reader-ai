import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { buildApkMilestoneReadiness } from '../common/apkMilestoneReadiness.js'

const root = process.cwd()

function readIfExists(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
}

function sourceHubBundleText() {
  const jsDir = join(root, 'unpackage', 'dist', 'build', 'h5', 'static', 'js')
  if (!existsSync(jsDir)) return ''
  return readdirSync(jsDir)
    .filter(name => /^pages-sourceHub-sourceHub\..*\.js$/.test(name))
    .map(name => readIfExists(join(jsDir, name)))
    .join('\n')
}

function gitSynced() {
  try {
    const output = execFileSync('git', ['status', '--short', '--branch'], {
      cwd: root,
      encoding: 'utf8'
    })
    const firstLine = output.split(/\r?\n/)[0] || ''
    return !/\[.*ahead|behind.*\]/.test(firstLine) && output.trim().split(/\r?\n/).length === 1
  } catch {
    return false
  }
}

const h5Index = join(root, 'unpackage', 'dist', 'build', 'h5', 'index.html')
const sourceHubText = sourceHubBundleText()
const mainActivity = readIfExists(join(root, 'android-webview-shell', 'src', 'com', 'novelreader', 'v1', 'MainActivity.java'))
const buildScript = readIfExists(join(root, 'scripts', 'build_android_webview_apk.ps1'))
const readiness = buildApkMilestoneReadiness({
  h5BuildReady: existsSync(h5Index),
  phonePreflightAssetReady: /androidPhonePreflight/.test(sourceHubText) && /phonePreflight/.test(sourceHubText),
  androidBridgeContractReady: /getBridgeInfo/.test(mainActivity) &&
    /fetchRenderedHtml/.test(mainActivity) &&
    /openLoginPage/.test(mainActivity) &&
    /getCookie/.test(mainActivity),
  apkBuildScriptReady: /Apksigner verify/.test(buildScript) &&
    /V2\.apk/.test(buildScript) &&
    /AssetsRoot/.test(buildScript) &&
    /Copy-Item/.test(buildScript),
  gitSynced: gitSynced(),
  phoneConnected: false,
  apkBuilt: false
})

console.log(JSON.stringify(readiness, null, 2))
