# Android WebView APK 打包说明

> V2.5 当前产物为 `release/android-v2/V2.apk`，包含动态 WebView 解析、CookieJar 与人工登录桥接。详细验收见 [V2.5 开发与验收记录](V2.5_COMPLEX_SOURCE_VALIDATION.md)。

这是 v1.0 的本地 Android SDK 兜底打包路径，用一个轻量 WebView 壳加载 `uni-app` 的 H5 构建产物。它可以产出可安装 APK，但不是 HBuilderX/DCloud 原生云打包包，因此 `plus` 原生能力会受限。

## 生成 H5 资源

```powershell
$env:NODE_ENV='production'
$env:UNI_PLATFORM='h5'
$env:UNI_INPUT_DIR='D:\Codex\novel-reader-uniapp'
$env:UNI_OUTPUT_DIR='D:\Codex\novel-reader-uniapp\unpackage\dist\build\h5'
$env:UNI_MINIMIZE='true'
$env:VUE_CLI_CONTEXT='D:\HBuilderX\plugins\uniapp-cli'
D:\HBuilderX\plugins\node\node.exe D:\HBuilderX\plugins\uniapp-cli\bin\uniapp-cli.js
```

## 生成 APK

```powershell
powershell -ExecutionPolicy Bypass -File D:\Codex\novel-reader-uniapp\scripts\build_android_webview_apk.ps1
```

输出文件：

```text
D:\Codex\novel-reader-uniapp\release\android-v1\novel-reader-1.0.0-android-webview-v1.apk
```

当前包名和版本：

```text
package: com.novelreader.v1
versionName: 1.0.0
versionCode: 10000
minSdkVersion: 23
targetSdkVersion: 36
```

正式发布仍建议走 HBuilderX 云打包或 DCloud Android 离线 SDK 工程，并使用正式 keystore、图标、隐私政策和稳定 HTTPS 后端。
