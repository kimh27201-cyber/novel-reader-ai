# 小说解码 AI 阅读助手

![CI](https://github.com/kimh27201-cyber/novel-reader-ai/actions/workflows/ci.yml/badge.svg)

一个基于 `uni-app + Vue 2 + FastAPI` 的阅读助手项目，面向学习、实习求职展示和自用 APK 验收。项目已经从早期本地原型推进到可打包 Android WebView APK，并补齐了真实书源导入、源仓库浏览、在线搜索、目录解析、正文阅读、TXT 导入和 AI 阅读辅助的闭环。

> 合规说明：仓库不内置版权小说正文，不提供盗版内容，不绕过登录、会员、付费章节、广告或站点限制。内置的是书源规则导入能力、源仓库入口和兼容性检测机制。

## 当前状态

- Android WebView APK 已完成 v1.0 打包验收，并在 v1.1-v1.4 阶段补齐真实阅读体验。
- 前端工具测试覆盖导入、书源解析、源仓库、阅读器体验、产品外壳、真机验收清单等模块。
- 后端提供用户系统、书架、章节、阅读历史、书源解析 API、AI 总结/问答和统一错误响应。
- 默认 AI 使用 mock 模式，没有真实 API Key 也可以本地运行和测试。
- 推荐源检测已跑通真实流程：源仓库拉取、书源导入、小说搜索、详情、目录、正文、加入书架。
- 调试模式内置“一键演示准备”“APK 展示准备”“真机验收清单”，方便录屏和现场验收。

## 核心功能

客户端：

- 书架、发现、阅读器、书源市场、我的页面
- 本地 TXT 文件导入、章节识别、加入书架、继续阅读
- JSON / Legado / 阅读 3.x 书源导入
- 扫码、剪贴板、文件选择统一导入入口
- yckceo / yck2026 源仓库入口、详情预览、一键导入
- 单源测试、批量检测、失败诊断、推荐可用源
- 在线书籍搜索、详情、目录、正文缓存和阅读器失败提示
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
- 打包说明：[docs/PACKAGING_ANDROID.md](docs/PACKAGING_ANDROID.md)
- 真机验收清单：[docs/ANDROID_VALIDATION.md](docs/ANDROID_VALIDATION.md)
- WebView APK 说明：[docs/ANDROID_WEBVIEW_APK.md](docs/ANDROID_WEBVIEW_APK.md)

## 项目结构

```text
novel-reader-uniapp/
  backend/                 # FastAPI 后端
  common/                  # uni-app 公共逻辑、书源引擎、导入适配、缓存
  pages/                   # uni-app 页面
  android-webview-shell/   # Android WebView APK 壳工程
  scripts/                 # 打包和辅助脚本
  static/                  # 图标、tabbar、静态资源
  docs/                    # API、演示、打包、验收文档
  tests/                   # 前端工具和产品行为测试
```

## 快速启动

后端：

```powershell
cd D:\Codex\novel-reader-uniapp\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

打开：

- Swagger: http://127.0.0.1:8000/docs
- 健康检查: http://127.0.0.1:8000/api/health

Android 真机通过 USB 调试连接本机后端：

```powershell
cd D:\Codex\novel-reader-uniapp\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
D:\program\Android\SDK\platform-tools\adb.exe reverse tcp:8000 tcp:8000
```

手机端“我的”页面后端地址填写：

```text
http://127.0.0.1:8000
```

如果不用 USB 转发，也可以把后端启动在 `0.0.0.0:8000`，手机端填写电脑局域网 IP，例如 `http://192.168.x.x:8000`。

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
adb reverse tcp:8000 tcp:8000
adb shell monkey -p com.novelreader.v1 1
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

GitHub Actions 会在 `main` 推送和 Pull Request 时自动运行后端 pytest、uni-app 配置解析和全部前端 `.test.mjs`。

## 演示入口

- [项目演示脚本](docs/DEMO_GUIDE.md)：适合面试、录屏、答辩展示。
- [接口文档](docs/API.md)：后端 API、请求示例和演示顺序。
- [Android 真机验收清单](docs/ANDROID_VALIDATION.md)：扫码、文件、剪贴板、后端、网络和缓存验收。
- [Android APK 打包说明](docs/PACKAGING_ANDROID.md)：APK 构建、签名、安装和常见问题。
- [简历与面试讲解稿](docs/INTERVIEW_NOTES.md)：项目亮点、技术难点和追问答案。
- [截图清单](docs/SCREENSHOTS.md)：README、简历附件和录屏素材准备。

## 真实书源路线

已完成：

- v1.0.1：APK 重新打包、后端 URL 容错、USB `adb reverse` 说明
- v1.1：扫码、剪贴板、JSON、TXT 统一导入闭环
- v1.2：Legado / 阅读 3.x 常见规则兼容和阶段化诊断
- v1.3：内置 yckceo / yck2026 源仓库入口、推荐源、预览和一键导入
- v1.4：在线书详情、目录、正文缓存、阅读器失败状态和完整阅读测试

仍需手动验收：

- 手机 UI 上扫码 yck 仓库二维码并进入源仓库页
- 手机 UI 上点击推荐源导入并完成真实搜索阅读
- 手机 UI 上选择本地 `.txt`，分章、加入书架、继续阅读
- 断网状态下验证已缓存章节可读、未缓存章节错误可理解

## AI 配置

默认使用 mock 模式：

```env
AI_PROVIDER=mock
AI_API_KEY=
```

后续接入 DeepSeek 示例：

```env
AI_PROVIDER=deepseek
AI_API_KEY=你的 DeepSeek Key
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-chat
```

真实 `.env` 和 API Key 不应提交到 GitHub。

## 合规边界

本项目是阅读工具和书源规则兼容性实验，不是内容分发站点：

- 不在仓库内放置未经授权的小说正文
- 不内置版权内容下载地址
- 不执行第三方书源中的 JS、登录、Cookie 或 WebView 绕过逻辑
- 不解析付费章节，不规避站点访问控制
- 第三方书源和 TXT 文件应来自用户自己有权使用的内容

## 后续计划

- 完成 Android 真机 UI 逐项验收，并补充截图到 `docs/SCREENSHOTS.md`
- 将推荐源检测结果做成更直观的首启向导
- 增加换源入口、下一章预加载和整本离线缓存进度
- 准备正式签名包、公网 HTTPS 后端、隐私政策和发布截图
