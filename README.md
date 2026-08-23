# 小说解码 AI 阅读助手

> 桌面 V2 的交付状态、后续计划和人工验收清单见 [桌面 V2 开发计划与验收](docs/DESKTOP_V2_DEVELOPMENT_PLAN.md)；复杂书源兼容增强的技术记录见 [V2.5 开发与验收记录](docs/V2.5_COMPLEX_SOURCE_VALIDATION.md)。

![CI](https://github.com/kimh27201-cyber/novel-reader-ai/actions/workflows/ci.yml/badge.svg)

一个基于 `uni-app + Vue 2 + FastAPI` 的移动阅读助手项目，覆盖本地 TXT 导入、书源规则导入、在线搜索、目录解析、正文阅读、章节缓存、AI 总结/问答和 Android WebView APK 验收流程。项目面向学习、实习求职展示、自用 APK 验收和端到端产品能力演示。

> 合规说明：仓库不内置版权小说正文，不提供盗版内容，不绕过登录、会员、付费章节、广告或站点限制。内置的是书源规则导入、兼容性检测、源仓库入口、阅读体验和本地演示能力。

## 当前状态

- Android WebView APK 已完成 v1.0 打包验收，并持续补齐真实阅读体验。
- 客户端已覆盖书架、书源市场、扫码导入、发现搜索、阅读器、AI 记录和我的页面。
- 后端提供用户系统、书架、章节、阅读历史、书源解析 API、AI 总结/问答和统一错误响应。
- 默认 AI 使用 mock 模式，没有真实 API Key 也可以本地运行和测试。
- 在线书源流程已覆盖源仓库导入、单源测试、多源搜索、详情、目录、正文、加入书架和章节缓存。
- 测试覆盖前端工具逻辑、书源解析、导入适配、阅读器体验、产品外壳、真机验收清单和后端 API。

## 最近更新

- 新增独立扫码导入页：支持 Android 原生扫码桥接、`uni.scanCode` 和 Web BarcodeDetector 兜底。
- 在线搜索支持并发、超时、源数量和结果数量设置，并展示搜索进度。
- 多源搜索会合并重复结果，并基于成功率和耗时记录书源质量分。
- 书源支持反爬参数配置：请求间隔、重试次数、重试间隔、字符集、User-Agent 和自定义请求头。
- 增加书源全链路健康检查：搜索、详情、目录、正文、加入书架分阶段评分。
- 阅读器支持章节预加载、缓存上限、离线模式、缓存统计、清理缓存和导出在线书籍 TXT。
- Android WebView 壳增加扫码桥接和相机权限，`manifest.json` 配置了品牌图标资源。
- 增加 `scripts/patch_h5_build.py`，用于对已编译 H5 产物应用阅读器 UI 补丁。

## 核心功能

客户端：

- 书架、书源、源仓库、扫码导入、发现、阅读器、AI 记录、我的页面
- 本地 TXT 文件导入、章节识别、加入书架、继续阅读
- JSON / Legado / 阅读 3.x 书源导入和兼容性诊断
- 扫码、剪贴板、文件选择、URL 粘贴等统一导入入口
- yckceo / yck2026 源仓库入口、详情预览、一键导入
- 单源测试、批量检测、全链路健康检查、推荐可用源
- 在线书籍搜索、详情、目录、正文缓存、预加载和离线阅读策略
- Android 真机后端地址自检、导入功能自检、完整阅读测试入口

后端：

- 用户注册、登录、JWT 鉴权
- 书架、章节、阅读历史管理
- 动态书源导入、搜索、目录、正文解析
- 本地演示书源，方便 Swagger 和面试录屏演示
- AI 章节总结、AI 小说问答、AI 历史和调用日志
- 统一错误响应、`X-Request-ID`、CORS 和 pytest 覆盖

Android APK：

- WebView 壳工程：`android-webview-shell/`
- 构建脚本：`scripts/build_android_webview_apk.ps1`
- 扫码桥接：`NovelReaderScan.scanQr`
- 打包说明：[docs/PACKAGING_ANDROID.md](docs/PACKAGING_ANDROID.md)
- 真机验收清单：[docs/ANDROID_VALIDATION.md](docs/ANDROID_VALIDATION.md)
- WebView APK 说明：[docs/ANDROID_WEBVIEW_APK.md](docs/ANDROID_WEBVIEW_APK.md)

## 项目结构

```text
novel-reader-uniapp/
  backend/                 # FastAPI 后端
  common/                  # uni-app 公共逻辑、书源引擎、导入适配、缓存和 API 客户端
  pages/                   # uni-app 页面
  android-webview-shell/   # Android WebView APK 壳工程
  scripts/                 # 打包、图标生成和 H5 补丁脚本
  static/                  # 图标、tabbar、品牌静态资源
  docs/                    # API、演示、打包、验收文档
  tests/                   # 前端工具、产品行为和书源能力测试
```

## 快速启动

后端：

```powershell
cd D:\Codex\novel-reader-uniapp\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8765
```

首次运行或重建环境：

```powershell
cd D:\Codex\novel-reader-uniapp\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
copy .env.example .env
python scripts/init_db.py
uvicorn app.main:app --reload --port 8765
```

打开：

- Swagger: http://127.0.0.1:8765/docs
- 健康检查: http://127.0.0.1:8765/api/health

前端：

- 使用 HBuilderX 打开 `D:\Codex\novel-reader-uniapp`
- 运行到浏览器、Android App 基座或打包 Android WebView APK
- 手机端“我的”页面后端地址可填 `http://127.0.0.1:8765`，配合 `adb reverse` 使用

Android 真机通过 USB 调试连接本机后端：

```powershell
cd D:\Codex\novel-reader-uniapp\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8765
D:\program\Android\SDK\platform-tools\adb.exe reverse tcp:8765 tcp:8765
```

如果不用 USB 转发，也可以把后端启动在 `0.0.0.0:8765`，手机端填写电脑局域网 IP，例如 `http://192.168.x.x:8765`。

## Android APK 打包

```powershell
cd D:\Codex\novel-reader-uniapp
powershell -ExecutionPolicy Bypass -File .\scripts\build_android_webview_apk.ps1
```

默认产物：

```text
release\android-v1\novel-reader-1.0.0-android-webview-v1.apk
```

安装和启动：

```powershell
adb install -r .\release\android-v1\novel-reader-1.0.0-android-webview-v1.apk
adb reverse tcp:8765 tcp:8765
adb shell monkey -p com.novelreader.v1 1
```

如需对 H5 构建产物应用阅读器 UI 补丁：

```powershell
cd D:\Codex\novel-reader-uniapp
python .\scripts\patch_h5_build.py
```

## 测试

后端：

```powershell
cd D:\Codex\novel-reader-uniapp
backend\.venv\Scripts\python.exe -m pytest
```

前端工具测试：

```powershell
cd D:\Codex\novel-reader-uniapp
Get-ChildItem tests -Filter *.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName }
```

配置解析：

```powershell
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('pages.json','utf8')); JSON.parse(fs.readFileSync('manifest.json','utf8')); console.log('json config ok')"
```

重点测试文件：

- `tests/v2ScanImport.test.mjs`
- `tests/multiSourceSearch.test.mjs`
- `tests/sourceAntiCrawler.test.mjs`
- `tests/sourceHealth.test.mjs`
- `tests/onlineChapterCacheStrategy.test.mjs`
- `tests/appShellBranding.test.mjs`

GitHub Actions 会在 `main` 推送和 Pull Request 时自动运行后端 pytest、uni-app 配置解析和前端 `.test.mjs`。

## 演示入口

- 一键演示准备：在“我的”页面检查后端、登录、导入、搜索、阅读和 AI 记录演示状态。
- [项目演示脚本](docs/DEMO_GUIDE.md)：适合面试、录屏、答辩展示。
- [接口文档](docs/API.md)：后端 API、请求示例和演示顺序。
- [Android 真机验收清单](docs/ANDROID_VALIDATION.md)：扫码、文件、剪贴板、后端、网络和缓存验收。
- [Android APK 打包说明](docs/PACKAGING_ANDROID.md)：APK 构建、签名、安装和常见问题。
- [简历与面试讲解稿](docs/INTERVIEW_NOTES.md)：项目亮点、技术难点和追问答案。
- [截图清单](docs/SCREENSHOTS.md)：README、简历附件和录屏素材准备。

## AI 配置

默认使用 mock 模式：

```env
AI_PROVIDER=mock
AI_API_KEY=
```

接入 DeepSeek 示例：

```env
AI_PROVIDER=deepseek
AI_API_KEY=你的 DeepSeek Key
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-chat
```

真实 `.env` 和 API Key 不应提交到 GitHub。

## 书源导入日志

项目会在本地 `sources:import-logs` 中保留最近 30 条书源导入日志，入口在“书源”页的“最近导入”区域，点击“查看日志”可进入详情页。日志只保存在当前设备，不上传服务器。

每条日志包含导入时间、来源、原始数据类型、来源描述、解析总数、成功数、失败数、跳过数、重复数、部分不兼容数，以及每个候选书源的处理结果。常见状态包括：

- `success`：已保存并可在书源列表看到
- `unsupported`：已保存，但部分规则不兼容
- `duplicated`：重复书源，按当前策略跳过
- `skipped`：主动跳过
- `blocked`：缺少必要字段或依赖当前版本不支持的特殊能力
- `failed`：解析或保存失败

## 部分不兼容书源说明

部分第三方书源可能依赖 JS、H5、WebView、登录态、Cookie 或其它访问控制能力。项目允许导入和展示可安全保存的 `h5Unsupported` 书源，但会在书源列表中标记“部分不兼容”，并在发现页、分类页等不支持的入口给出明确提示。

当前版本不会执行第三方书源中的 JS，也不会绕过登录、Cookie、验证码、付费章节或反爬限制。对于这类书源，用户仍可查看导入日志中的具体原因，用于判断是否需要换用其它合法、静态规则更完整的书源。

## 合规边界

本项目是阅读工具和书源规则兼容性实验，不是内容分发站点：

- 不在仓库内放置未经授权的小说正文
- 不内置版权内容下载地址
- 不执行第三方书源中的 JS、登录、Cookie 或 WebView 绕过逻辑
- 不解析付费章节，不规避站点访问控制
- 第三方书源和 TXT 文件应来自用户自己有权使用的内容

## 开发环境一键启动说明

如果手机 App 突然登录不上 FastAPI 后端，通常不是登录代码错误，而是本地开发连接断了：

1. FastAPI 后端进程没有启动；
2. `adb reverse` 转发丢失；
3. 数据线重新插拔、ADB 重启或手机重新授权导致连接断开。

Windows 开发环境下，可以直接双击项目根目录：

```txt
start-dev.bat
```

脚本会自动：

1. 检查并启动 FastAPI 后端；
2. 检查 Android 设备是否已授权；
3. 清理旧的 `adb reverse`；
4. 重新建立 `adb reverse tcp:8765 tcp:8765`；
5. 打印当前 reverse 转发表。

手机 App 的后端地址保持填写：

```txt
http://127.0.0.1:8765
```

如果脚本提示 `unauthorized`，请解锁手机并允许 USB 调试；如果提示没有设备，请重新插入数据线并确认 USB 调试已开启。

## 后续计划

- 完成 Android 真机 UI 逐项验收，并补充截图到 `docs/SCREENSHOTS.md`
- 将推荐源检测和健康检查结果做成更直观的首启向导
- 增强换源入口、离线缓存进度和缓存空间管理
- 准备正式签名包、公网 HTTPS 后端、隐私政策和发布截图
