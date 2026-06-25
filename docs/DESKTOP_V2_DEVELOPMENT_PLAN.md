# 桌面 V2 开发计划与验收

更新时间：2026-06-21

## 当前结论

桌面 V2 与 V2.5 复杂书源兼容增强的计划内开发已完成，代码已覆盖真实书源导入、发现、搜索、详情、目录、正文、缓存、阅读、兼容性诊断及用户导入书源删除。剩余工作属于发布环境配置、真机人工验收和远端仓库同步，不需要继续修改核心业务代码。

## 完成状态

| 模块 | 状态 | 验收依据 |
|---|---|---|
| JSON / 阅读 3.x / Legado 书源导入 | 已完成 | 导入适配测试、桌面 H5 导入验收 |
| 源仓库、扫码和链接导入 | 已完成 | 页面契约测试、Android 扫码桥接 |
| 搜索、详情、目录、正文和加入书架 | 已完成 | 完整阅读测试、前后端自动化测试 |
| Header 书源 | 已完成 | `need_headers`，桌面 H5 与 APK 支持 |
| 安全 JS 书源 | 已完成 | `need_js_sandbox`，白名单解释器测试通过 |
| WebView 动态书源 | 已完成 | `need_webview`，由 Android APK 执行 |
| 登录书源 | 已完成 | `need_login`，APK 支持人工登录和 Cookie 保存/清除 |
| 用户导入书源删除 | 已完成 | 仅用户导入源显示删除入口；取消、确认和 Cookie 清理有测试覆盖 |
| H5 与 Android APK 构建 | 已完成 | 离线生产构建、APK 签名检查、真机安装启动 |
| Git 本地提交 | 本次完成 | 以本文件所在提交为准 |
| 推送远端仓库 | 外部操作 | 需要可用网络和远端仓库写权限 |

## 自动化验收

在项目根目录执行：

```powershell
Get-ChildItem tests -Filter *.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName }
backend\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('pages.json','utf8')); JSON.parse(fs.readFileSync('manifest.json','utf8')); console.log('json config ok')"
git diff --cached --check
```

预期结果：前端 39 个测试文件全部通过，后端 49 项测试通过，两个 JSON 配置文件可解析，Git 暂存内容无空白错误。

## 需要执行的外部操作

### 1. 推送远端仓库

本地提交完成后，由具备远端写权限的环境执行：

```powershell
cd D:\Codex\novel-reader-uniapp
git push origin main
```

推送后在代码托管平台确认最新提交存在，并检查 CI 全部通过。不要使用强制推送。

### 2. Android 真机准备

手机开启开发者选项和 USB 调试，电脑确认设备在线：

```powershell
adb devices
adb reverse tcp:8000 tcp:8000
adb install -r release\android-v2\V2.apk
```

如果手机直接访问局域网后端，不需要 `adb reverse`，但需要把前端后端地址改为电脑的局域网 IP，并允许防火墙访问对应端口。

### 3. 正式发布准备

- 将当前测试签名替换为妥善保管的正式签名，并保存 keystore、别名和密码恢复方案。
- 正式发布前更新包名、`versionName` 和 `versionCode`；当前安装包仍是 `com.novelreader.v1`、`1.0.0 (10000)`。
- 后端部署到 HTTPS，限制 CORS 来源，配置生产密钥和日志脱敏策略。
- 准备隐私政策、权限用途说明和应用商店所需截图，不在仓库提交真实密钥。

## 人工验收清单

### 桌面 H5

- 打开 `http://localhost:8080/#/pages/library/library`，页面无白屏、卡死和明显布局异常。
- 导入 Header 源，详情显示 `need_headers` 和“当前环境支持”。
- 导入 JS 源，详情显示 `need_js_sandbox` 和“当前环境支持”。
- 导入 WebView 源，详情显示 `need_webview` 并提示使用 Android APK。
- 导入登录源，详情显示 `need_login` 并提示在 APK 中登录。
- 对用户导入源执行删除：取消后源仍存在；确认后列表、持久化数据和对应 Cookie 均被清理。
- 内置源和 API 源不显示删除入口，避免误删验收与系统能力源。
- 执行完整阅读测试，搜索、详情、目录、正文和加入书架全部通过；浏览器控制台无明显报错。

### Android APK

- 启动应用并切换书架、书源、发现、阅读和我的页面，确认无崩溃、白屏或底部导航遮挡。
- 扫码导入时相机授权、拒绝授权和取消扫码都能得到明确反馈。
- WebView 源能够返回渲染后的搜索或正文内容；失败时有可理解提示，不无限等待。
- 登录源能够打开站点登录页；人工登录后保存状态，返回书源页面可复用 Cookie，清除后状态失效。
- 用户导入源可删除，内置源和 API 源不可删除。
- 完成一次真实阅读链路：搜索 → 详情 → 目录 → 正文 → 加入书架 → 重新打开继续阅读。

## 已知边界与风险

- 第三方站点的规则、验证码、风控和登录流程可能随时变化，单个真实书源失败不等同于客户端能力回归。
- 项目不绕过验证码、会员、付费、广告或站点访问控制，只验证用户有权访问的内容。
- WebView 与登录能力必须在 Android 真机验收，桌面 H5 只负责正确诊断和引导。
- 当前用户源判定依赖导入元数据；如果以后增加云同步或后台下发源，应显式增加 `sourceType`，避免仅凭时间字段决定删除权限。

## 后续版本建议

以下内容不属于本次 V2/V2.5 验收阻塞项：

1. 为书源增加显式的 `sourceType` 和稳定 ID，完善云同步后的删除权限模型。
2. 增加用户书源批量导出、备份、恢复和冲突处理。
3. 建立脱敏的失败阶段统计，区分网络、规则、WebView、登录和站点限制。
4. 在正式签名和生产后端就绪后，建立可重复的 APK 发布流水线。

## 2026-06-25 书架章节解码修复验收记录

### 问题

APK 中真实源“速读谷”完整阅读测试显示通过，但从书架重新打开《我有一枚命运魔骰》时，章节页提示“章节解码失败 / FastAPI 后端 · Request validation failed”。

### 根因

完整阅读测试加入后端书架时，前端传入的 `source_id` 为空。书架重新打开未缓存章节时会按 `source_id` 调用 `/api/sources/{source_id}/content`，因此形成 `/api/sources/null/content`，被 FastAPI 的整数路径参数校验拦截。

### 修复

- 前端完整阅读测试在写入后端书架前，先把当前本地书源同步到后端，并使用返回的后端 `source_id`。
- 后端 `POST /api/books` 对同一用户、同一 `book_url` 做 upsert，避免重复书籍，同时允许修正历史数据中的 `source_id`。
- 后端 `POST /api/books/{book_id}/chapters` 对同一本书、同一 `chapter_index` 做 upsert，避免重复章节并刷新缓存正文。
- 增加前后端回归测试覆盖上述逻辑。

### 本次验证证据

- 前端测试：`FRONTEND_TEST_FILES=39`，全部通过。
- 后端测试：`51 passed in 48.75s`。
- H5 产物：`http://127.0.0.1:8080/#/` 返回 HTTP 200。
- 真实后端链路：使用 student 账号和真实源 ID=5，完成搜索、目录、正文解码、书架入库、章节缓存、章节读取。
  - `bookId=5`
  - `source_id=5`
  - `tocCount=999`
  - `chapterIndex=1`
  - `cached=true`
  - `contentLen=2746`
  - `sourcePathOk=true`
- H5 构建完成：`unpackage/dist/build/h5/index.html` 已生成。
- APK 构建完成：`release/android-v2/V2.apk`，大小 `4178816` 字节。
- APK SHA256：`A12BAFB71C0D582421560548268FF191AB59524A4C3E458056A47456D35EA6C8`。
- APK 签名校验：v1/v2/v3 均通过。
- 真机安装：设备 `AADMVB3602032395`，`adb install --user 0 -r release/android-v2/V2.apk` 返回 `Success`，并已启动 `com.novelreader.v1/.MainActivity`。

### 手机验收项

1. 打开 App，进入“我的”，确认后端地址可登录或处于已登录状态。
2. 进入“书源管理”，选择“速读谷”。
3. 搜索《我有一枚命运魔骰》，执行完整阅读测试。
4. 返回书架，确认书架出现《我有一枚命运魔骰》。
5. 从书架打开该书，进入章节正文。
6. 切换目录中的下一章或点击重试，确认不再出现 `/api/sources/null/content` 对应的“Request validation failed”。
7. 如遇手机弹出 USB 安装、网络或权限确认，按系统提示允许；这属于外部操作，不属于代码缺陷。
