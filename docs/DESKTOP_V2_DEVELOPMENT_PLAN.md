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
