function gateLabel(state) {
  if (state === 'ready') return '已就绪'
  if (state === 'manual') return '人工项'
  return '需处理'
}

function buildItem(id, title, ready, readyDetail, actionDetail) {
  return {
    id,
    title,
    state: ready ? 'ready' : 'action',
    label: gateLabel(ready ? 'ready' : 'action'),
    detail: ready ? readyDetail : actionDetail
  }
}

export function buildApkMilestoneReadiness(options = {}) {
  const items = [
    buildItem(
      'h5-build',
      'H5 生产构建',
      !!options.h5BuildReady,
      'H5 build output is present and can be embedded into the Android shell.',
      'Run the H5 production build before packaging the Android APK.'
    ),
    buildItem(
      'source-hub-phone-preflight',
      'Source Hub 手机预检产物',
      !!options.phonePreflightAssetReady,
      'Built Source Hub assets contain the phone preflight report path.',
      'Build assets must contain androidPhonePreflight / phonePreflight evidence.'
    ),
    buildItem(
      'android-bridge-contract',
      'Android WebView Bridge 契约',
      !!options.androidBridgeContractReady,
      'Android shell exposes renderedFetch, openLogin, readCookie, and bridge profile.',
      'Verify android-webview-shell bridge contract before APK packaging.'
    ),
    buildItem(
      'apk-build-script',
      'APK 构建脚本',
      !!options.apkBuildScriptReady,
      'Build script copies H5 assets, signs the APK, and verifies the signature.',
      'Fix scripts/build_android_webview_apk.ps1 before packaging.'
    ),
    buildItem(
      'github-sync',
      'GitHub 同步',
      !!options.gitSynced,
      'Local milestone commits are synced to origin/main.',
      'Push local milestone commits to GitHub before packaging.'
    ),
    {
      id: 'phone-connected',
      title: '手机连接确认',
      state: options.phoneConnected ? 'ready' : 'manual',
      label: gateLabel(options.phoneConnected ? 'ready' : 'manual'),
      detail: options.phoneConnected
        ? 'ADB device is connected for install and runtime validation.'
        : 'Packaging is paused here until the user connects a phone.'
    },
    {
      id: 'apk-build',
      title: '里程碑 APK 打包',
      state: options.apkBuilt ? 'ready' : 'manual',
      label: gateLabel(options.apkBuilt ? 'ready' : 'manual'),
      detail: options.apkBuilt
        ? 'Milestone APK has been built and can be installed for validation.'
        : 'Run scripts/build_android_webview_apk.ps1 only after automatic gates are ready and phone is connected.'
    }
  ]

  const readyCount = items.filter(item => item.state === 'ready').length
  const actionCount = items.filter(item => item.state === 'action').length
  const manualCount = items.filter(item => item.state === 'manual').length
  const automaticGateCount = items.filter(item => item.state !== 'manual').length
  const status = actionCount ? 'blocked' : (options.apkBuilt ? 'complete' : 'ready-to-package')

  return {
    status,
    readyCount,
    actionCount,
    manualCount,
    automaticGateCount,
    canNotifyForPhone: status === 'ready-to-package',
    items,
    summary: actionCount
      ? `还有 ${actionCount} 个自动门禁未完成，先不要进入 APK 打包。`
      : (options.apkBuilt
          ? '里程碑 APK 已生成，可进入真机安装验收。'
          : '自动门禁已完成，可以通知用户连接手机后进入里程碑 APK 打包。')
  }
}
