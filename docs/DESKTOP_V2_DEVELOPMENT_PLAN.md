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

## 2026-06-25 书源删除、按钮居中与阅读测试提速修复记录

### 修复范围

- 书源详情抽屉：用户导入书源的“删除此书源”改为底部固定操作区，避免被底部导航和安全区遮挡。
- 书源页按钮：统一补充 flex 居中样式，覆盖保存、搜索测试、完整阅读测试、健康检测、删除、关闭等截图相关按钮。
- 用户书源删除：本地删除后立即刷新列表、关闭详情弹层；已登录后端时，同步删除同名且同 `baseUrl` 的后端书源，避免刷新后重新出现。
- 后端接口：新增 `DELETE /api/sources/{source_id}`，仅允许当前登录用户删除自己的书源；删除前解除书架中引用该源的 `Book.source_id`。
- 完整阅读测试提速：加入后端书架时不再对 999 章逐条同步，只同步书籍本体和当前已缓存章节；没有缓存章节时最多预取第一章用于验收。
- 健康检测提速：改为轻量链路 `搜索 → 详情 → 目录 → 第一章正文`，不再执行书架同步。
- 后端正文解析：复用 HTTP client 并设置超时/连接池，减少重复请求开销。

### 自动化验收结果

- 前端测试：`Get-ChildItem tests -Filter '*.test.mjs' | Sort-Object Name | ForEach-Object { node $_.FullName }`，共 39 个测试文件通过。
- 后端测试：`backend\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider`，共 52 项通过。
- 新增覆盖：
  - 本地用户源删除后不再出现在 `getSourceConfigs()`。
  - 后端同名同 URL 书源可通过 `DELETE /api/sources/{source_id}` 删除，列表和搜索中不再出现。
  - `addBackendBookWithChapters` 只同步缓存章节，不再对 999 章全量 `POST /chapters`。
  - 健康检测不再包含 `shelf` 阶段。

### 当前外部阻塞

本次代码和自动化测试已完成，但当前 Codex 系统额度限制拒绝了需要外部权限/风险确认的操作：

- 清理旧 H5 构建产物：`unpackage/dist/build/h5/index.html` 当前构建时报 `EPERM: operation not permitted`。
- H5 Chrome 人工验收、APK 打包、Git 提交和 GitHub 推送仍需在可用额度或用户本机终端中执行。

### 待人工执行命令

在项目根目录 `D:\Codex\novel-reader-uniapp` 执行：

```powershell
# 1. 如 H5 构建仍提示 index.html EPERM，先关闭占用该目录的浏览器/本地服务，再清理旧产物
$target = "D:\Codex\novel-reader-uniapp\unpackage\dist\build\h5"
Remove-Item -LiteralPath $target -Recurse -Force
New-Item -ItemType Directory -Path $target | Out-Null

# 2. H5 构建
$env:UNI_INPUT_DIR='D:\Codex\novel-reader-uniapp'
$env:UNI_PLATFORM='h5'
$env:UNI_OUTPUT_DIR='D:\Codex\novel-reader-uniapp\unpackage\dist\build\h5'
$env:VUE_CLI_CONTEXT='D:\HBuilderX\plugins\uniapp-cli'
$env:NODE_ENV='production'
& 'D:\HBuilderX\plugins\node\node.exe' 'D:\HBuilderX\plugins\uniapp-cli\bin\uniapp-cli.js'
backend\.venv\Scripts\python.exe .\scripts\patch_h5_build.py

# 3. H5 本地验收服务
cd D:\Codex\novel-reader-uniapp\unpackage\dist\build\h5
D:\Codex\novel-reader-uniapp\backend\.venv\Scripts\python.exe -m http.server 8080
```

浏览器打开 `http://localhost:8080/#/pages/library/library` 后验收：

1. 打开用户导入源详情，删除按钮应固定在详情抽屉底部且容易点击。
2. 点击删除，源应立即从列表消失；刷新页面后仍不出现。
3. 完整阅读测试点击后应立即显示阶段进度，成功后书架有书，章节可打开。
4. 健康检测应只跑轻量链路，响应明显快于旧版本。
5. 书源页按钮文字应居中，无明显偏左或偏上。

H5 通过后再执行一次 APK 打包：

```powershell
cd D:\Codex\novel-reader-uniapp
powershell -ExecutionPolicy Bypass -File .\scripts\build_android_webview_apk.ps1
Get-FileHash -Algorithm SHA256 .\release\android-v2\V2.apk
```

手机安装验收：

```powershell
D:\program\Android\SDK\platform-tools\adb.exe devices -l
D:\program\Android\SDK\platform-tools\adb.exe reverse tcp:8000 tcp:8000
D:\program\Android\SDK\platform-tools\adb.exe install --user 0 -r D:\Codex\novel-reader-uniapp\release\android-v2\V2.apk
D:\program\Android\SDK\platform-tools\adb.exe shell am start -n com.novelreader.v1/.MainActivity
```

## 2026-06-28 速读谷完整阅读测试超时修复记录

### 问题

Android APK 中打开“速读谷”书源详情，使用关键词《我有一枚命运魔骰》执行“完整阅读测试”时，搜索阶段失败，页面显示：

```text
完整阅读测试未通过
目标站点响应超时，建议换源、稍后重试，或配置 Cookie/Header 后再测
```

### 根因

真实目标站点和后端代理均可访问：

- `https://www.sudugu.org/i/sor.aspx?key=...` 本机直连约 2.1 秒返回 HTTP 200。
- 通过 `POST /api/proxy/fetch` 代理约 4.7 秒返回 HTTP 200。

失败根因不是目标站不可用，而是前端单源测试链路使用默认 `ONLINE_SOURCE_TIMEOUT_MS = 5000`，加反爬间隔后约 6.5 秒就判定超时；而速读谷书源 JSON 中声明了 `respondTime: 180000`，旧逻辑没有纳入单源测试预算，导致代理请求成功前被前端 `withTimeout` 误杀。

### 修复

- `common/sourceEngine.js`
  - 规范化书源时保留 `respondTimeMs`，来源为 Legado/阅读书源 JSON 的 `respondTime`。
- `common/bookSources.js`
  - 新增单源测试最大超时上限 `ONLINE_SOURCE_TEST_TIMEOUT_MAX_MS = 30000`。
  - `getSourceTimeoutBudget` 支持 `respectSourceRespondTime`，只在单源测试、完整阅读测试、健康检测链路启用。
  - 多源发现页仍保持默认快速超时策略，避免慢源拖垮整体搜索。
  - `withTimeout` 在请求先完成时清理计时器，减少残留定时器。
- `tests/sourceHealth.test.mjs`
  - 增加慢源回归测试：调用方传入 `timeoutMs: 100`，但书源声明 `respondTime: 3000`，搜索延迟 1.8 秒仍应通过。

### 验证

- 真实速读谷搜索复现：
  - 修复前：约 6.5 秒前端报 `速读谷响应超时`，但代理请求随后返回 200。
  - 修复后：使用真实速读谷规则和关键词《我有一枚命运魔骰》，返回 1 条结果，书籍 URL 为 `https://www.sudugu.org/1844/`。
- 前端测试：39 个 `.test.mjs` 文件全部通过。
- 后端测试：`52 passed in 43.10s`。
- H5 构建：已清理并重新生成 `unpackage/dist/build/h5/index.html`。
- APK 构建：已生成 `release/android-v2/V2.apk`。
- APK 大小：`1051766` 字节。
- APK SHA256：`FD834708EE03457059501E1B8695DD0C69756E9D31A92B33C62FD71BAB711EF7`。
- APK 签名校验：v1/v2/v3 均通过。
- 真机安装：设备 `AADMVB3602032395`，`adb install --user 0 -r release/android-v2/V2.apk` 返回 `Success`，并已启动 `com.novelreader.v1/.MainActivity`。
- GitHub 推送：`540fefa fix: respect source response timeout in source tests` 已推送到 `origin/main`。

### 验收重点

1. 手机重新安装新 APK。
2. 进入“书源管理” → “速读谷”。
3. 关键词输入《我有一枚命运魔骰》。
4. 点击“完整阅读测试”，搜索阶段不应再出现“目标站点响应超时”。
5. 成功后继续确认详情、目录、正文、加入书架链路。

Git 提交和推送：

```powershell
cd D:\Codex\novel-reader-uniapp
git diff --check
git add backend/app/api/sources.py backend/app/services/source_parser.py backend/tests/test_sources.py common/apiClient.js common/backendLibrary.js common/bookSources.js pages/library/library.vue tests/backendLibrary.test.mjs tests/sourceHealth.test.mjs tests/v2SourceManagement.test.mjs docs/DESKTOP_V2_DEVELOPMENT_PLAN.md
git commit -m "fix: improve source deletion and reading checks"
git push origin main
```

## 2026-06-26 H5 构建与 APK 打包执行记录

### 已完成

- 已清理旧 H5 构建产物目录：`unpackage/dist/build/h5`。
- 已重新执行 H5 构建，`unpackage/dist/build/h5/index.html` 生成成功。
- 已启动本地 H5 静态服务，`http://127.0.0.1:8080/` 返回 HTTP 200。
- 已确认后端健康检查：`http://127.0.0.1:8000/api/health` 返回 `{"status":"ok","app":"Novel Reader AI Backend","version":"0.1.0"}`。
- 已确认 H5 构建产物包含本次关键 UI/逻辑变更：`source-detail-fixed-footer`、`source-progress-line`、删除提示、同步书架和健康检测相关文案。
- 已一次性生成 APK：`release/android-v2/V2.apk`。
- APK 大小：`1051766` 字节。
- APK SHA256：`69A3EC09B2770A96BF3439B5292BC90B87FBCD74EFDCCBFDA818DCCF95829544`。
- APK 签名校验：v1/v2/v3 均通过。

### 待手机侧确认

ADB 安装时手机返回：

```text
INSTALL_FAILED_ABORTED: User rejected permissions
```

这表示手机端安装权限确认被拒绝或超时，不是构建失败。下一步只需要在手机上允许安装/调试权限后重新执行：

```powershell
D:\program\Android\SDK\platform-tools\adb.exe install --user 0 -r D:\Codex\novel-reader-uniapp\release\android-v2\V2.apk
D:\program\Android\SDK\platform-tools\adb.exe shell am start -n com.novelreader.v1/.MainActivity
```

### 后续状态更新

2026-06-28 已重新安装新版 APK，手机返回 `Success`，并已启动 `com.novelreader.v1/.MainActivity`。6 月 26 日的安装拒绝问题已归类为当时手机端权限确认未允许，不再是当前阻塞项。
## 2026-06-29 Source Hub 阶段推进记录

### 本次目标

根据 `deep-research-report.md` 的阶段一/阶段二建议，本次先完成可交付的最小闭环：把“搜索测试”从主入口降级为辅助工具，新增书源中心入口，并建立后续会话中心、能力判定和分层执行路由的前端基础模型。

### 已完成

- 新增 `common/sourceCapability.js`：为书源生成统一 capability 对象，覆盖搜索、发现、详情、目录、正文、Cookie、登录、WebView、渲染、JS 模式和风险级别。
- 新增 `common/sourceSession.js`：支持本地保存、读取、清除手动会话，并区分 `none / empty / active / expired` 状态。
- 新增 `common/sourceRouter.js`：根据 capability 和 session 构建候选 lane，当前先落地 `http`、`http-session-cookie`、`http-rule-js`、`webview-session-assist`、`webview-rendered-dom` 的排序规则。
- 新增 `pages/sourceHub/sourceHub.vue`：作为书源中心页，展示能力状态、会话状态、候选执行通道，并提供“进入发现”“书源内搜索”“录入会话”“复制诊断”入口。
- 修改 `pages/library/library.vue`：书源列表主体点击进入 `sourceHub`，导入成功后优先跳转到第一个导入或覆盖书源的 `sourceHub`。
- 更新 `pages.json`：注册 `pages/sourceHub/sourceHub`。
- 新增测试 `tests/sourceCapabilitySessionRouter.test.mjs` 和 `tests/sourceHub.test.mjs`，并同步更新入口相关断言。

### 当前边界

- 本次只完成 H5/本地模型层和书源中心入口，不执行任意第三方 JS，不绕过验证码、会员、付费、风控或登录限制。
- WebView 会话采集、后端 `source_session/source_cookie` 表、Android `SourceSessionBridge` 和 Playwright render worker 仍属于后续任务包。
- 当前手动会话保存在本地 storage，后续需要与 Android CookieManager 和后端执行上下文打通。

### 已验收

```powershell
cd D:\Codex\novel-reader-uniapp
node tests\sourceCapabilitySessionRouter.test.mjs
node tests\sourceHub.test.mjs
node tests\sourceExplore.test.mjs
node tests\productShell.test.mjs
Get-ChildItem tests -Filter *.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
```

H5 自验收路径：

```text
http://localhost:8080/#/pages/library/library
```

验收重点：书源列表主体点击进入书源中心；书源中心可展示 capability/session/lane；发现入口可继续跳转 `sourceExplore`；搜索测试不再作为主入口。

实际结果：前端 `.mjs` 全量回归通过，后端 pytest 通过，H5 构建通过；Playwright 桌面端自验收确认 `library -> sourceHub -> sourceExplore` 主路径可用。APK 里程碑打包按当前约定暂缓，等电脑端功能验收完成并连接手机后再执行。
## 2026-06-29 Source Session 请求链路推进记录

### 本次目标

继续推进 Source Session Center 电脑端基础版：让 `sourceHub` 保存的手动 Cookie / UA / Referer 不只停留在 UI 和本地 storage，而是真正参与搜索、发现、详情、目录、正文的统一请求链路。

### 已完成

- `common/sourceSession.js`
  - 新增 `getActiveSourceSession()`，只返回未过期且状态有效的 session。
  - 新增 `buildSourceSessionHeaders()`，统一输出 Cookie、User-Agent、Referer 请求头。
- `common/bookSources.js`
  - 在 `createSourceRequestSpec()` 中合并活跃 session 请求头。
  - session Cookie / UA 会同步写入 request spec，供普通 HTTP 和 WebView rendered fetch 共用。
  - 过期 session 不参与请求，避免发送旧 Cookie。
- `tests/sourceSessionRequest.test.mjs`
  - 覆盖 `searchSourceBooks()` 真实请求链路，确认 session 请求头会进入 `/api/proxy/fetch` payload。
  - 覆盖过期 session 不应污染请求头。
- `tests/sourceHub.test.mjs`
  - 补充 sourceHub 保存会话和会话状态展示的页面契约断言。

### 当前边界

- 本阶段仍只处理电脑端 H5 与本地 storage 会话，不采集 Android WebView Cookie。
- 后端 `source_session/source_cookie` 表、Android `SourceSessionBridge`、WebView DOM 采集仍是后续任务。
- 不执行任意第三方 JS，不绕过验证码、会员、付费、风控或登录限制。

### 已验收

```powershell
node tests\sourceSessionRequest.test.mjs
node tests\sourceCapabilitySessionRouter.test.mjs
node tests\sourceHub.test.mjs
node tests\sourceExplore.test.mjs
```

结果：本阶段目标测试通过。前端 `.mjs` 全量回归通过，`pages.json` / `manifest.json` 解析通过，`git diff --check` 通过，后端 pytest 通过 `55 passed`，H5 生产构建完成，`http://127.0.0.1:8080/#/pages/library/library` 返回 HTTP 200。APK 仍按约定暂缓，不在本阶段打包。下一步建议继续增强 sourceHub 的真实链路验收入口和失败诊断展示，再做 Android WebView 会话采集。

## 2026-06-29 Source Hub 真实链路验收入口推进记录

### 本次目标

继续围绕电脑端 H5 做下一阶段开发：把已经存在的 `common/sourceAcceptance.js` 验收能力前移到 `sourceHub` 页面，让书源中心不只展示 capability/session/lane，还能直接发起真实链路验收并看到失败诊断。

### 已完成

- `pages/sourceHub/sourceHub.vue`
  - 新增“真实链路验收”入口。
  - 新增验收面板，支持运行验收、复制报告、清空报告。
  - 展示最近一次验收状态、分数、耗时、失败阶段、失败原因、修复建议和每个 stage 的执行结果。
  - 复用 `runSourceAcceptance()`、`getSourceAcceptanceReports()`、`clearSourceAcceptanceReports()`、`buildCopyableAcceptanceReport()`，没有改动验收算法和书源解析规则。
- `tests/sourceHub.test.mjs`
  - 补充 sourceHub 页面契约断言，覆盖验收入口、报告复制/清空、验收面板和阶段列表。
- `docs/dev/V2_NEXT_STEP_CHANGELOG.md`
  - 同步追加本阶段变更记录。

### 当前边界

- 本阶段仍只做电脑端 H5 和本地 storage 链路，不做 APK 打包。
- 不执行任意第三方 JS，不绕过验证码、会员、付费、登录或风控限制。
- 真实验收结果仍受目标站点可用性、书源规则质量、代理状态和 Cookie / UA / Referer 会话影响。

### 验收方式

```powershell
cd D:\Codex\novel-reader-uniapp
node tests\sourceHub.test.mjs
node tests\sourceAcceptance.test.mjs
node tests\sourceExplore.test.mjs
```

桌面自验路径：

```text
http://localhost:8080/#/pages/library/library
```

验收重点：从书源列表进入书源中心，确认页面出现“真实链路验收”入口；点击后可以生成报告；失败时能看到失败阶段、失败原因和建议；报告可以复制和清空。APK 仍按约定暂缓，等电脑端功能全部稳定并连接手机后再打里程碑包。

## 2026-06-29 Source Session 后端持久化基础版推进记录

### 本次目标

继续围绕电脑端 H5 与后端完成 Source Session Center 的下一层基础能力：让手动录入的 Cookie / User-Agent / Referer 不只保存在 H5 本地 storage，也能按用户和书源持久化到后端，为后续 Android WebView Cookie 采集和跨端复用打基础。

### 已完成

- `backend/app/models/models.py`
  - 新增 `SourceSession` 模型，按 `user_id + source_id` 保存 origin、cookie、user_agent、referer、storage/local/session state、过期时间、验证时间和状态。
- `backend/app/api/sources.py`
  - 新增 `GET /api/sources/{source_id}/session`：读取当前用户拥有书源的会话；没有会话时返回 `exists: false`。
  - 新增 `PUT /api/sources/{source_id}/session`：保存或覆盖当前用户当前书源的会话。
  - 新增 `DELETE /api/sources/{source_id}/session`：删除当前用户当前书源的会话。
  - 删除后端书源时同步清理该书源会话。
- `backend/migrations/versions/0003_source_sessions.py`
  - 新增 `source_sessions` 数据库迁移。
- `common/apiClient.js`
  - 新增 `getSourceSession()`、`saveSourceSession()`、`deleteSourceSession()`。
- `pages/sourceHub/sourceHub.vue`
  - 后端绑定书源进入页面时会尝试读取后端会话。
  - 保存手动会话时同步写入后端；后端不可用时保留本地会话兜底。
  - 清除会话时同步删除后端会话。
  - 新增后端会话同步状态提示。

### 数据库影响

新增表：`source_sessions`

核心字段：
- `user_id`：会话所属用户。
- `source_id`：会话所属后端书源。
- `cookie` / `user_agent` / `referer`：请求链路复用的会话上下文。
- `storage_state_json` / `local_storage_json` / `session_storage_json`：预留给后续 WebView / Playwright 渲染状态。
- `expires_at` / `last_verified_at` / `status`：会话有效性与诊断状态。

迁移方式：后端迁移新增 `0003_source_sessions.py`，现有数据不受影响。

### 当前边界

- 本阶段仍不自动采集 Android WebView Cookie。
- 只有已经绑定后端 `backendId` 的书源会同步到后端；纯本地 H5 书源继续使用本地 storage。
- 不绕过验证码、登录、会员、付费或站点风控。
- APK 打包继续暂缓。

### 已验收

```powershell
backend\.venv\Scripts\python.exe -m pytest backend\tests\test_sources.py backend\tests\test_migration_artifacts.py -q
node tests\apiClient.test.mjs
node tests\sourceHub.test.mjs
```

阶段结果：目标测试通过，前端 `.mjs` 全量回归通过，后端 pytest 通过 `58 passed`，`pages.json` / `manifest.json` 解析通过，`git diff --check` 通过，H5 生产构建完成，桌面 H5 自验确认 Source Hub 可渲染后端会话状态。Playwright 控制台唯一错误为 `favicon.ico` 404，不影响业务功能。APK 仍按约定暂缓，不在本阶段打包。

## 2026-06-29 Source Hub Android 会话采集入口推进记录

### 本次目标

继续围绕电脑端 H5 可验收范围推进下一阶段：在 `sourceHub` 中补齐 Android WebView 登录和 Cookie 采集入口，让页面先具备可见、可测试、可降级的会话采集操作，为后续连接手机后的 APK 真实采集验证做准备。

### 已完成

- `pages/sourceHub/sourceHub.vue`
  - 接入 `openSourceLogin()` 和 `readSourceLoginCookie()`。
  - 为需要 Cookie 或 WebView 的书源展示“打开登录页”和“保存登录 Cookie”入口。
  - 保存登录 Cookie 时同步写入 `sourceCookieJar`、本地 Source Session，并在后端绑定书源可用时继续同步后端会话。
  - 新增脱敏 Cookie 摘要列表，便于 H5 桌面端确认会话状态而不直接暴露完整 Cookie。
  - 清除会话时同步清理该书源的 CookieJar 条目。
- `tests/sourceHub.test.mjs`
  - 补充 Source Hub Android 会话入口、Cookie 摘要、WebView bridge 和 CookieJar 调用契约断言。
- `docs/dev/V2_NEXT_STEP_CHANGELOG.md`
  - 追加本阶段变更记录。

### 当前边界

- 电脑端 H5 不能真实采集 Android WebView Cookie，只能验证入口、状态展示和不支持环境下的错误提示。
- 真实 Cookie 采集必须等后续连接手机并打 APK 后，在用户主动登录授权的 Android WebView 环境中验证。
- 本阶段不绕过验证码、登录、会员、付费或站点风控，也不做 APK 打包。

### 验收方式

```powershell
cd D:\Codex\novel-reader-uniapp
node tests\sourceHub.test.mjs
node tests\webViewRenderedFetch.test.mjs
Get-ChildItem tests -Filter *.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
backend\.venv\Scripts\python.exe -m pytest backend\tests -q
```

桌面自验路径：

```text
http://localhost:8080/#/pages/library/library
```

验收重点：Source Hub 页面不报错；需要 Cookie / WebView 的书源能看到 Android 登录和保存 Cookie 入口；H5 环境点击采集时应给出 APK/桥接能力不足提示；Cookie 摘要只显示脱敏信息。APK 打包继续暂缓，等电脑端功能全部稳定并连接手机后再进入里程碑包流程。

### 已验收

- `node tests\sourceHub.test.mjs` 通过。
- `node tests\webViewRenderedFetch.test.mjs` 通过。
- 前端 `.mjs` 全量回归通过。
- 后端 pytest 通过 `58 passed`；仅有 pytest cache 目录已存在 warning。
- `pages.json` / `manifest.json` 解析通过。
- `git diff --check` 通过；仅有 Git 工作区 LF 到 CRLF 的换行提示。
- H5 生产构建完成；仅有现有 uni-h5 大文件提示和 Browserslist 数据偏旧提示。
- `http://127.0.0.1:8080/#/pages/library/library` 返回 HTTP 200。
- Playwright 桌面自验确认书源页和 Source Hub 路由可渲染；控制台唯一错误为 `favicon.ico` 404，不影响业务功能。
- 构建后的 H5 产物已包含“保存登录 Cookie”入口。本阶段仍不打 APK。

## 2026-06-29 Source Hub WebView / JS 就绪度诊断推进记录

### 本次目标

继续向复杂 JS 和 WebView 书源适配推进，但先不直接执行第三方复杂 JS，也不进入 APK 打包。本阶段先在电脑端 H5 做一层可诊断、可解释、可验收的 bridge readiness：让 Source Hub 能说明当前书源为什么需要 WebView、当前 H5 缺什么能力、后续 Android bridge 应该满足哪些接口。

### 已完成

- `common/sourceBridgeReadiness.js`
  - 新增 WebView / JS 就绪度诊断纯函数。
  - 区分 `H5 沙箱 JS`、`浏览器 DOM JS`、`无复杂 JS`。
  - 区分 `h5-ready`、`apk-required`、`bridge-ready`、`bridge-missing` 状态。
  - 输出建议通道、bridge 方法状态和阻塞原因。
- `pages/sourceHub/sourceHub.vue`
  - 新增“WebView / JS 就绪度”面板。
  - 展示当前环境、建议执行通道、渲染接口、登录页接口、Cookie 接口。
  - 对 H5 下需要 WebView / Cookie 的书源展示明确的 APK bridge 阻塞原因。
  - 复制诊断时同步带上 bridge readiness 数据。
- `tests/sourceBridgeReadiness.test.mjs`
  - 覆盖浏览器 DOM JS 在 H5 下需要 APK。
  - 覆盖内置规则 JS 可走 H5 沙箱。
  - 覆盖 Android bridge 方法齐全时可进入 bridge-ready。
- `tests/sourceHub.test.mjs`
  - 补充 Source Hub 新面板契约断言。

### 当前边界

- 本阶段只做诊断与展示，不在 H5 执行任意第三方复杂 JS。
- Android bridge 真实可用性还需要后续 APK 包和手机验证。
- 不绕过验证码、登录、会员、付费或站点风控。
- APK 打包继续暂缓。

### 已验收

```powershell
node tests\sourceBridgeReadiness.test.mjs
node tests\sourceHub.test.mjs
node tests\sourceCapabilitySessionRouter.test.mjs
node tests\webViewRenderedFetch.test.mjs
node tests\sourceAcceptance.test.mjs
Get-ChildItem tests -Filter *.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
backend\.venv\Scripts\python.exe -m pytest backend\tests -q
```

阶段结果：目标测试通过，前端 `.mjs` 全量回归通过，后端 pytest 通过 `58 passed`，`pages.json` / `manifest.json` 解析通过，`git diff --check` 通过，H5 生产构建完成，`http://127.0.0.1:8080/#/pages/library/library` 返回 HTTP 200。Playwright 桌面自验确认 Source Hub 可渲染“WebView / JS 就绪度”面板；控制台唯一错误为 `favicon.ico` 404，不影响业务功能。本阶段仍不打 APK。

## 2026-06-29 Source Hub WebView Bridge 自检入口推进记录

### 本次目标

在上一阶段“WebView / JS 就绪度诊断”的基础上，继续补齐可操作的 bridge 自检入口。目标是让 Source Hub 不只静态展示当前能力，还能在运行时主动检查 Android WebView bridge 是否暴露了后续需要的关键方法。

### 已完成

- `common/webViewBridge.js`
  - 新增 `getWebViewBridgeCapabilities()`，统一读取 runtime bridge 方法暴露情况。
  - 新增 `probeWebViewBridge()`，输出自检状态、缺失能力、检测时间和方法清单。
  - `hasRenderedFetchBridge()` 改为复用统一能力读取结果。
- `pages/sourceHub/sourceHub.vue`
  - 在“WebView / JS 就绪度”面板中新增“检测 Bridge”按钮。
  - 点击后展示检测时间和缺失能力。
  - H5 环境会明确显示缺失 `renderedFetch / openLogin / readCookie`。
  - 复制诊断时带上最近一次 bridge probe 报告。
- `tests/webViewBridgeProbe.test.mjs`
  - 覆盖无 bridge 环境下的缺失能力报告。
  - 覆盖 runtime 暴露完整 bridge 方法时的 ready 状态。
- `tests/sourceHub.test.mjs`
  - 补充 bridge probe UI 契约断言。

### 当前边界

- 当前自检只验证 bridge 方法是否暴露，不发起真实 WebView 渲染请求。
- 真实 WebView 渲染、Cookie 读取和登录页授权仍需要 Android 运行时验证。
- 不执行任意第三方复杂 JS，不绕过验证码、登录、会员、付费或站点风控。

### 已验收

```powershell
node tests\webViewBridgeProbe.test.mjs
node tests\sourceHub.test.mjs
node tests\webViewRenderedFetch.test.mjs
node tests\sourceBridgeReadiness.test.mjs
node tests\sourceCapabilitySessionRouter.test.mjs
node tests\sourceAcceptance.test.mjs
Get-ChildItem tests -Filter *.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
backend\.venv\Scripts\python.exe -m pytest backend\tests -q
```

阶段结果：目标测试通过，前端 `.mjs` 全量回归通过，后端 pytest 通过 `58 passed`，`pages.json` / `manifest.json` 解析通过，`git diff --check` 通过，H5 生产构建完成，`http://127.0.0.1:8080/#/pages/library/library` 返回 HTTP 200。Playwright 桌面自验确认 Source Hub 可点击“检测 Bridge”，并显示缺失能力 `renderedFetch / openLogin / readCookie`；控制台唯一错误为 `favicon.ico` 404，不影响业务功能。

## 2026-06-29 Source Hub Rendered Fetch 试运行入口推进记录

### 本次目标

继续围绕复杂 JS / WebView 书源适配推进，把上一阶段的 bridge 自检向“可发起渲染试运行”的方向扩展。电脑端 H5 先完成入口、参数、报告和降级状态，后续 Android WebView 可直接复用同一入口做真实 rendered fetch 验证。

### 已完成

- `common/sourceRenderedFetchTrial.js`
  - 新增 `buildRenderedFetchTrialRequest()`，统一清洗 WebView 渲染 URL、等待选择器、等待时间、超时时间、Cookie、User-Agent、Referer。
  - 新增 `runRenderedFetchTrial()`，复用现有 `renderedFetch()` bridge。
  - 输出 `invalid / unsupported / failed / passed` 四类状态。
  - 通过报告返回错误码、提示、耗时、最终地址、标题、HTML 长度和 Cookie 捕获状态。
- `pages/sourceHub/sourceHub.vue`
  - 在“WebView / JS 就绪度”面板中新增“Rendered Fetch 试运行”区域。
  - 支持输入 WebView 渲染 URL 和可选等待选择器。
  - 试运行后展示状态、提示、耗时、最终地址和 HTML 长度。
  - 复制诊断时带上最近一次 rendered fetch trial 报告。
- `tests/sourceRenderedFetchTrial.test.mjs`
  - 覆盖 URL 清洗和超时裁剪。
  - 覆盖无效 URL、H5 缺 bridge、模拟 Android bridge 成功三类结果。
- `tests/sourceHub.test.mjs`
  - 补充 Source Hub rendered fetch 试运行 UI 契约断言。

### 当前边界

- H5 只能验证入口、参数和 invalid / unsupported 状态，不能进行真实 WebView 渲染。
- 真实 DOM 渲染、复杂浏览器 JS 执行和 Cookie 回传仍依赖 Android WebView bridge 运行时。
- 不在 H5 执行任意第三方复杂 JS，不绕过验证码、登录、会员、付费或站点风控。

### 已验收

```powershell
node tests\sourceRenderedFetchTrial.test.mjs
node tests\sourceHub.test.mjs
node tests\webViewBridgeProbe.test.mjs
node tests\webViewRenderedFetch.test.mjs
node tests\sourceBridgeReadiness.test.mjs
node tests\sourceCapabilitySessionRouter.test.mjs
node tests\sourceAcceptance.test.mjs
Get-ChildItem tests -Filter *.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
backend\.venv\Scripts\python.exe -m pytest backend\tests -q
```

阶段结果：目标测试通过，前端 `.mjs` 全量回归通过，后端 pytest 通过 `58 passed`，`pages.json` / `manifest.json` 解析通过，`git diff --check` 通过，H5 生产构建完成，`http://127.0.0.1:8080/#/pages/library/library` 返回 HTTP 200。Playwright 桌面自验确认 Source Hub 可显示“Rendered Fetch 试运行”区域，空 URL 试运行会显示“请求无效”和明确的 HTTP/HTTPS URL 提示；控制台唯一错误为 `favicon.ico` 404，不影响业务功能。

## 2026-06-29 Source Hub Rendered Fetch 推荐目标推进记录

### 本次目标

继续围绕复杂 JS / WebView 书源适配推进，把“Rendered Fetch 试运行”从手动输入 URL 扩展为“根据书源规则自动推荐试运行目标”。这样后续进入 Android WebView 验证时，可以直接复用当前书源的发现页、搜索页、登录页或首页作为试运行入口，减少人工判断成本。

### 已完成

- `common/sourceRenderedFetchTrial.js`
  - 新增 `buildRenderedFetchTrialTarget()`，从书源原始规则中推导推荐试运行 URL。
  - 推荐顺序为 `exploreUrl`、`searchUrl`、`loginUrl`、`bookSourceUrl`，优先选择更能验证列表渲染的页面。
  - 支持搜索 URL 中的 `{{key}}`、`{{keyword}}`、`{{searchKey}}` 以及单大括号变体替换。
  - 从 `ruleExplore.bookList` 或 `ruleSearch.bookList` 推导等待选择器，便于后续真实 WebView 等待 DOM 渲染完成。
- `pages/sourceHub/sourceHub.vue`
  - 在 `Rendered Fetch 试运行` 区域展示推荐目标、来源和推荐原因。
  - 新增 `应用推荐` 操作，一键填入推荐 URL 和等待选择器。
  - 复制诊断时带上推荐目标，方便后续排查书源规则和 WebView bridge 表现。
- `tests/sourceRenderedFetchTrial.test.mjs`
  - 覆盖发现页、搜索页、登录页三类推荐目标。
  - 覆盖搜索关键词编码替换和等待选择器推导。
- `tests/sourceHub.test.mjs`
  - 补充推荐目标 UI、状态字段和应用方法的契约断言。

### 当前边界

- 本阶段仍在电脑端 H5 验证推荐目标推导、UI 展示和请求参数拼装，不在 H5 中执行第三方复杂 JS。
- 推荐目标是基于书源规则的 best-effort 推导，不保证目标站点一定免登录、免验证码、免风控或可直接访问。
- 真实 DOM 渲染、复杂浏览器 JS 执行、Cookie 回传和登录态联动仍依赖后续 Android WebView bridge 运行时验证。

### 已验收

```powershell
node tests\sourceRenderedFetchTrial.test.mjs
node tests\sourceHub.test.mjs
node tests\webViewBridgeProbe.test.mjs
node tests\webViewRenderedFetch.test.mjs
node tests\sourceBridgeReadiness.test.mjs
node tests\sourceCapabilitySessionRouter.test.mjs
node tests\sourceAcceptance.test.mjs
Get-ChildItem tests -Filter *.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
backend\.venv\Scripts\python.exe -m pytest backend\tests -q
```

阶段结果：目标测试通过，相关 WebView / Source Hub 回归通过，前端 `.mjs` 全量回归通过，后端 pytest 通过 `58 passed`，`pages.json` / `manifest.json` 解析通过，`git diff --check` 通过，已检查现有 H5 生产构建产物包含“推荐目标”和“应用推荐”入口，`http://127.0.0.1:8080/#/pages/library/library` 返回 HTTP 200。

## 2026-06-29 Android WebView Bridge Profile 契约推进记录

### 本次目标

继续把复杂 JS / WebView 书源适配向 Android runtime 验证推进。上一阶段已经能在 Source Hub 推导 rendered fetch 推荐目标，本阶段补齐 bridge profile 契约：让前端不只判断“方法是否存在”，还可以读取 Android 壳主动返回的契约版本、运行时、平台和能力清单。后续连接手机时，先确认 bridge profile，再执行真实渲染和 Cookie 采集。

### 已完成

- `android-webview-shell/src/com/novelreader/v1/MainActivity.java`
  - 在 `RenderedHtmlBridge` 中新增 `getBridgeInfo()`。
  - 返回 `contractVersion: 1`、`runtime: android-webview-shell`、`platform: android`。
  - 返回 `renderedFetch`、`openLogin`、`readCookie` 三项能力和 native bridge 方法清单。
- `common/webViewBridge.js`
  - `getWebViewBridgeCapabilities()` 优先读取 runtime profile，读取失败时回退到方法检测。
  - `openSourceLogin()` 和 `readSourceLoginCookie()` 改为分别依赖 `openLogin`、`readCookie` 能力，不再误依赖 rendered fetch。
- `pages/sourceHub/sourceHub.vue`
  - Bridge 自检报告增加“契约信息”展示。
  - Bridge 就绪度会复用最近一次 probe 的能力结果，便于 Android runtime 下判断 profile 是否完整。
- `tests/androidWebViewBridgeContract.test.mjs`
  - 新增 Android 壳 bridge 契约静态检查，锁定 Java 注入名、`getBridgeInfo()` 和能力字段。
- `tests/webViewBridgeProbe.test.mjs`
  - 覆盖 runtime profile 读取。
  - 覆盖只有登录/Cookie 能力、没有 rendered fetch 能力时，登录和 Cookie 入口仍可独立工作。
- `tests/sourceHub.test.mjs`
  - 补充 Source Hub bridge profile 文案契约断言。

### 当前边界

- 本阶段验证 Java/JS bridge 契约和桌面端展示逻辑，不执行真实第三方 WebView 渲染。
- 真实 rendered fetch、登录页跳转和 Cookie 回传仍要在 Android WebView 运行时中验收。
- profile 只证明客户端能力契约，不保证目标站点免登录、免验证码、免风控或可直接访问。

### 已验收

```powershell
node tests\androidWebViewBridgeContract.test.mjs
node tests\webViewBridgeProbe.test.mjs
node tests\webViewRenderedFetch.test.mjs
node tests\sourceHub.test.mjs
```

阶段结果：Android bridge 契约测试、WebView bridge probe、rendered fetch bridge 和 Source Hub 契约测试均通过。下一步可以把 bridge profile 作为 Android 渲染试运行和会话采集前的第一道验收门。

## 2026-06-29 Rendered Fetch Bridge Profile Gate 推进记录

### 本次目标

在已有 bridge profile 契约基础上，把 `Rendered Fetch 试运行` 改成先验 bridge、再发起渲染。这样后续手机侧验收时，失败报告可以明确区分“bridge 没注入/版本不对/能力缺失”和“目标站点渲染失败”，避免把运行时能力问题误判成书源规则问题。

### 已完成

- `common/sourceRenderedFetchTrial.js`
  - `runRenderedFetchTrial()` 在 URL 校验通过后先执行 `probeWebViewBridge(['renderedFetch'])`。
  - 缺少 rendered fetch bridge 时返回 `unsupported`，并携带完整 `bridgeProbe`。
  - 渲染成功或渲染失败报告都会带上本次使用的 bridge probe 结果。
- `pages/sourceHub/sourceHub.vue`
  - `Rendered Fetch 试运行`报告新增 Bridge 状态行。
  - 展示 gate 状态、缺失能力，以及 profile 中的 runtime/platform 信息。
- `tests/sourceRenderedFetchTrial.test.mjs`
  - 覆盖 H5 缺少 rendered fetch bridge 时的 `bridgeProbe.missing`。
  - 覆盖模拟 Android profile 成功渲染时，报告中保留 runtime profile。
- `tests/sourceHub.test.mjs`
  - 补充 rendered fetch bridge gate 展示契约断言。

### 当前边界

- 本阶段解决的是试运行前置能力证明，不改变第三方站点访问策略。
- bridge gate 通过后，真实渲染仍可能因登录、验证码、付费、会员、站点风控、网络或规则变化失败。
- H5 仍只用于验证报告结构和 unsupported 降级状态。

### 已验收

```powershell
node tests\sourceRenderedFetchTrial.test.mjs
node tests\sourceHub.test.mjs
node tests\webViewBridgeProbe.test.mjs
```

阶段结果：目标测试通过，rendered fetch 试运行报告现在能明确带出 bridge profile gate 结果。下一步可以把同样的诊断模型扩展到登录页打开和 Cookie 采集。

## 2026-06-29 Session Bridge Profile Gate 推进记录

### 本次目标

把 rendered fetch 已经建立的 profile gate 模型扩展到 Android 会话采集入口。目标是点击“打开登录页”和“保存登录 Cookie”之前先确认对应 bridge 能力，避免在 H5 或 bridge 不完整的 Android runtime 中直接调用 native 方法后只得到泛化错误。

### 已完成

- `pages/sourceHub/sourceHub.vue`
  - 点击“打开登录页”前执行 `probeWebViewBridge(['openLogin'])`。
  - 点击“保存登录 Cookie”前执行 `probeWebViewBridge(['readCookie'])`。
  - 会话面板新增 `会话 Bridge` 报告，展示 gate 状态和缺失能力。
  - 复制诊断时新增 `sessionBridgeReport`，便于后续手机验收排查。
- `tests/sourceHub.test.mjs`
  - 补充 `sessionBridgeReport`、`sessionBridgeStatusText`、`sessionBridgeMissingText` 契约断言。
  - 补充会话 bridge 报告 UI 和诊断字段断言。

### 当前边界

- 本阶段验证入口前置能力检查和报告结构，不执行真实 Android 登录页跳转或 Cookie 读取。
- bridge gate 通过只说明客户端能力存在，不代表目标站点登录一定成功或 Cookie 一定有效。

### 已验收

```powershell
node tests\sourceHub.test.mjs
node tests\webViewBridgeProbe.test.mjs
node tests\sourceRenderedFetchTrial.test.mjs
```

阶段结果：目标测试通过。Source Hub 的 rendered fetch、登录页打开和 Cookie 采集现在共用同一套 bridge profile gate 诊断思路。

## 2026-06-30 Source Hub Android 验证清单推进记录

### 本次目标

把前面已经完成的 bridge profile、rendered fetch gate、登录页 gate、Cookie gate 和真实链路验收结果汇总成一个桌面端可见的验证顺序。目标是后续连接手机时不再分散查看多个面板，而是能按 Source Hub 中的清单逐项确认。

### 已完成

- `pages/sourceHub/sourceHub.vue`
  - 新增 `Android 验证清单`面板。
  - 清单包含 5 项：Bridge Profile、Rendered Fetch、登录页、Cookie、真实链路。
  - 每项根据现有报告自动显示 `已通过`、`需处理`、`待验证` 或 `可跳过`。
  - 清单复用 `bridgeProbeReport`、`renderedTrialReport`、`sessionBridgeReport`、本地会话状态和 `acceptanceReport`。
  - 复制诊断时新增 `androidValidationItems`，便于后续手机侧验收对照。
- `tests/sourceHub.test.mjs`
  - 补充清单面板、计算字段、诊断字段和关键文案契约断言。

### 当前边界

- 本阶段仍是桌面端 H5 可验收的手机前置清单，不执行真实 Android runtime。
- 清单中的 ready/action/waiting 只代表当前已收集证据，不代表第三方站点一定可访问或登录态一定有效。

### 已验收

```powershell
node tests\sourceHub.test.mjs
Get-ChildItem tests -Filter *.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
backend\.venv\Scripts\python.exe -m pytest backend\tests -q
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('pages.json','utf8')); JSON.parse(fs.readFileSync('manifest.json','utf8')); console.log('json config ok')"
git diff --check
```

阶段结果：Source Hub 契约测试通过，前端 `.mjs` 全量回归通过，后端 pytest 通过 `58 passed`，`pages.json` / `manifest.json` 解析通过，`git diff --check` 通过，H5 生产构建完成，构建产物已包含“Android 验证清单”入口，`http://127.0.0.1:8080/#/pages/library/library` 返回 HTTP 200。下一步继续推进剩余桌面可验证任务。

## 2026-06-30 Source Hub Android 验证报告复制推进记录

### 本次目标

在已有 Android 验证清单基础上，补齐一键复制报告能力。后续手机验收时，可以把 bridge profile、rendered fetch、登录页、Cookie 和真实链路结果打包为同一份 JSON，减少手动截图和分散复制。

### 已完成

- `pages/sourceHub/sourceHub.vue`
  - 在 `Android 验证清单`面板中新增 `复制清单`按钮。
  - 新增 `buildAndroidValidationReport()`，汇总清单、Bridge 自检、Rendered Fetch 推荐目标和报告、会话 Bridge、会话状态、真实链路验收报告。
  - 新增 `copyAndroidValidationReport()`，把汇总报告写入剪贴板。
- `tests/sourceHub.test.mjs`
  - 补充报告构建、复制动作和清单工具栏契约断言。

### 当前边界

- 复制报告只汇总当前已收集证据，不会自动执行手机侧操作。
- 真实 WebView 渲染、登录页跳转和 Cookie 采集仍依赖 Android runtime。

### 已验收

```powershell
node tests\sourceHub.test.mjs
Get-ChildItem tests -Filter *.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
backend\.venv\Scripts\python.exe -m pytest backend\tests -q
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('pages.json','utf8')); JSON.parse(fs.readFileSync('manifest.json','utf8')); console.log('json config ok')"
git diff --check
```

H5 构建和产物验收：

```powershell
# HBuilderX uniapp-cli H5 production build, then scripts\patch_h5_build.py
Select-String -Path 'unpackage\dist\build\h5\static\js\*.js' -Pattern '复制清单','Android 验证清单已复制','buildAndroidValidationReport' -SimpleMatch
Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:8080/#/pages/library/library'
```

阶段结果：Source Hub 契约测试通过，前端 `.mjs` 全量回归通过，后端 pytest 通过 `58 passed`，`pages.json` / `manifest.json` 解析通过，`git diff --check` 通过，H5 生产构建完成，构建产物包含 `复制清单`、`Android 验证清单已复制`、`buildAndroidValidationReport`，桌面 H5 入口返回 HTTP 200。下一步继续基于报告和清单基础推进剩余手机侧验证流程。

## 2026-06-30 Source Hub Android 验证汇总推进记录

### 本次目标

继续围绕复杂 JS / WebView 手机侧门禁闭环推进，但保持桌面端可验收：在 Android 验证清单上方增加阶段汇总，让后续打里程碑包前能快速判断哪些 gate 已完成、哪些还需要 Android runtime。

### 已完成

- `pages/sourceHub/sourceHub.vue`
  - 新增 `androidValidationSummary`，统计 total / ready / action / waiting / skipped / complete。
  - 在 `Android 验证清单`面板增加汇总块，展示总体状态、完成数和下一步建议。
  - `copyDiagnostics()` 和 `buildAndroidValidationReport()` 均带上 `androidValidationSummary`。
- `tests/sourceHub.test.mjs`
  - 补充汇总 computed、汇总 UI class、诊断 payload 和复制报告 payload 契约断言。

### 当前边界

- 汇总只归纳当前已有证据，不会替代 Android 真机 WebView 运行。
- Rendered Fetch、登录页打开和 Cookie 读取仍需要后续手机 runtime 验证。

### 已验收

```powershell
node tests\sourceHub.test.mjs
node tests\webViewBridgeProbe.test.mjs
node tests\sourceRenderedFetchTrial.test.mjs
node tests\sourceBridgeReadiness.test.mjs
Get-ChildItem tests -Filter *.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
backend\.venv\Scripts\python.exe -m pytest backend\tests -q
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('pages.json','utf8')); JSON.parse(fs.readFileSync('manifest.json','utf8')); console.log('json config ok')"
git diff --check
```

H5 构建和产物验收：

```powershell
# HBuilderX uniapp-cli H5 production build, then scripts\patch_h5_build.py
Select-String -Path 'unpackage\dist\build\h5\static\js\*.js' -Pattern 'androidValidationSummary','validation-summary-count','阶段汇总' -SimpleMatch
Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:8080/#/pages/library/library'
```

阶段结果：Source Hub 契约测试通过，WebView Bridge Probe / Rendered Fetch Trial / Bridge Readiness 目标回归通过，前端 `.mjs` 全量回归通过，后端 pytest 通过 `58 passed`，`pages.json` / `manifest.json` 解析通过，`git diff --check` 通过，H5 生产构建完成，构建产物包含 `androidValidationSummary`、`validation-summary-count`、`阶段汇总`，桌面 H5 入口返回 HTTP 200。下一步继续从汇总后的 Android gate 证据推进手机连接后的验证流程。

## 2026-06-30 Source Hub Android 手机预检推进记录

### 本次目标

继续向复杂 JS / WebView 真机验收闭环推进，但仍限定在电脑端可验收范围：在 Android 验证清单和阶段汇总之上生成“手机预检”报告，明确当前是否存在阻塞项、是否可以进入手机验证、连接手机后应先执行哪一个 gate。

### 已完成

- `common/sourceAndroidValidation.js`
  - 新增 `buildAndroidPhonePreflight()`，根据 checklist 和 summary 生成 `blocked / phone-required / complete` 预检状态。
  - 输出 `readyForPhone`、`blockers`、`pending`、`completed`、`phoneSteps` 和 `nextAction`。
- `pages/sourceHub/sourceHub.vue`
  - 新增 `androidPhonePreflight` computed。
  - 在 `Android 验证清单`面板增加 `手机预检`块，展示能否上手机和下一步动作。
  - `buildAndroidValidationReport()` 增加 `phonePreflight`。
  - `copyDiagnostics()` 增加 `androidPhonePreflight`。
- `tests/sourceAndroidValidation.test.mjs`
  - 覆盖阻塞、待手机执行和证据完整三种预检状态。
- `tests/sourceHub.test.mjs`
  - 补充预检导入、computed、UI class、报告 payload 和诊断 payload 契约断言。

### 当前边界

- 手机预检只组织当前已有证据，不执行 Android WebView。
- Rendered Fetch、登录页打开和 Cookie 读取仍必须等手机连接后的 Android runtime 验证。

### 已验收

```powershell
node tests\sourceAndroidValidation.test.mjs
node tests\sourceHub.test.mjs
node tests\webViewBridgeProbe.test.mjs
node tests\sourceRenderedFetchTrial.test.mjs
node tests\sourceBridgeReadiness.test.mjs
Get-ChildItem tests -Filter *.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
backend\.venv\Scripts\python.exe -m pytest backend\tests -q
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('pages.json','utf8')); JSON.parse(fs.readFileSync('manifest.json','utf8')); console.log('json config ok')"
git diff --check
```

H5 构建和产物验收：

```powershell
# HBuilderX uniapp-cli H5 production build, then scripts\patch_h5_build.py
Select-String -Path 'unpackage\dist\build\h5\static\js\*.js' -Pattern 'androidPhonePreflight','phonePreflight','手机预检','readyForPhone' -SimpleMatch
Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:8080/#/pages/library/library'
```

阶段结果：Android 预检纯函数测试、Source Hub 契约测试、WebView Bridge Probe / Rendered Fetch Trial / Bridge Readiness 目标回归通过，前端 `.mjs` 全量回归通过，后端 pytest 通过 `58 passed`，`pages.json` / `manifest.json` 解析通过，`git diff --check` 通过，H5 生产构建完成，构建产物包含 `androidPhonePreflight`、`phonePreflight`、`手机预检`、`readyForPhone`，桌面 H5 入口返回 HTTP 200。下一步提交并推送本阶段，然后继续向里程碑 APK readiness 推进。

## 2026-07-01 APK 里程碑 readiness 门禁推进记录

### 本次目标

在真正进入 APK 打包前增加一个桌面可运行的 readiness 汇总，避免仅凭文档记忆判断是否该通知连接手机。该门禁需要检查 H5 产物、Source Hub 手机预检产物、Android WebView Bridge 契约、APK 构建脚本和 GitHub 同步状态。

### 已完成

- `common/apkMilestoneReadiness.js`
  - 新增 `buildApkMilestoneReadiness()`，输出 `blocked / ready-to-package / complete` 状态。
  - 区分自动门禁、人工项和是否应该通知用户连接手机。
- `scripts/check_apk_milestone_readiness.mjs`
  - 检查 H5 `index.html` 是否存在。
  - 检查构建后的 Source Hub bundle 是否包含 `androidPhonePreflight` / `phonePreflight`。
  - 检查 Android shell 是否包含 `getBridgeInfo`、`fetchRenderedHtml`、`openLoginPage`、`getCookie`。
  - 检查 APK 构建脚本是否包含 H5 asset 复制、`V2.apk` 输出和签名校验。
  - 检查本地分支是否仍领先或落后远端。
- `tests/apkMilestoneReadiness.test.mjs`
  - 覆盖阻塞、可通知连接手机、已完成三种状态。
- `.github/workflows/ci.yml`
  - 前端工具测试改为自动发现并运行全部 `tests/*.test.mjs`，避免新增测试未进入 CI。
- `tests/androidReadiness.test.mjs`、`tests/demoMode.test.mjs`、`tests/deviceValidation.test.mjs`
  - CI 契约断言同步为全量测试发现策略。

### 当前边界

- 当前本地分支仍领先 `origin/main`，因此 readiness 脚本会把 `github-sync` 判为 `action`。
- `release/android-v2/V2.apk` 即使存在，也不代表本阶段已完成打包；脚本不会把历史 APK 当作当前里程碑产物。

### 已验收

```powershell
node tests\apkMilestoneReadiness.test.mjs
node scripts\check_apk_milestone_readiness.mjs
node tests\androidReadiness.test.mjs
node tests\demoMode.test.mjs
node tests\deviceValidation.test.mjs
Get-ChildItem tests -Filter *.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
backend\.venv\Scripts\python.exe -m pytest backend\tests -q
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('pages.json','utf8')); JSON.parse(fs.readFileSync('manifest.json','utf8')); console.log('json config ok')"
git diff --check
```

阶段结果：APK readiness 单测通过；readiness 脚本显示 H5 构建、Source Hub 手机预检产物、Android Bridge 契约、APK 构建脚本均为 ready，当前唯一自动门禁是 GitHub 同步；前端 `.mjs` 全量回归通过，CI 已改为发现并运行全部 `tests/*.test.mjs`；后端 pytest 通过 `58 passed`；`pages.json` / `manifest.json` 解析通过；`git diff --check` 通过。下一步需要获得用户对 `git push origin main` 的明确授权并完成推送，然后重新运行 readiness；若状态变为 `ready-to-package`，再通知用户连接手机并进入里程碑 APK 打包。
