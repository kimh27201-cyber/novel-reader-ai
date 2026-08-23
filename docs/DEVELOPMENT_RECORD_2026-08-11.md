# 解码阅读 V3 阶段开发记录

记录日期：2026-08-11  
目标平台：H5、Android WebView APK  
代码分支：`feat/source-runtime-v3`

## 1. 阶段结论

本阶段围绕“书架 → 打开书籍 → 阅读器 → 主题切换”主链路完成了 V3 体验升级，并补齐后端书架离线镜像、离线阅读回退、进度同步、云端书籍删除、书源验收和云端 TTS 能力。现有书源导入、搜索、阅读进度、书签和基础 TTS 行为保持兼容。

## 2. 前端实现

### 2.1 公共组件与体验配置

- 新增 `DBookCover`、`DEmptyState`、`DButton`、`DBottomSheet`、`DModal`、`DSkeleton` 等首批公共组件。
- 新增 `common/v3Experience.js`，统一维护五主题的呼吸、入场、阅读仪式和转场参数。
- 增加统一遮罩滚动锁、性能档位、减弱动效、页面卸载清理机制。

### 2.2 书架体验

- 最近阅读书籍使用稳定相位的轻呼吸，长列表自动关闭非必要动画。
- 保留左滑删除和长按操作；已展开左滑项优先收起，避免误入阅读器。
- 云端书架使用账号隔离的本地镜像，后端不可用时立即显示离线数据。
- 云端书籍允许与本地书籍一样删除：离线时立即移出并排队，联网后幂等同步云端。
- 修正书架、卡片、操作面板和删除确认按钮文字的水平/垂直居中。

### 2.3 主题与导航

- 主题切换改用浏览器 View Transition 完整画面交叉淡化，旧 WebView 使用轻量淡入回退。
- 连续点击时跳过旧切换，只提交最后一次选择；预览与保存拆分，应用主题不重复播放动画。
- 液态导航保留跟手滑动与速度判断，增加涟漪、速度形变和单次反馈。

### 2.4 阅读器

- 新增阅读仪式参数和轻量接续入场，减弱动效模式使用短淡入。
- 新增正文分页整理与上下文衔接逻辑，约束单页内容进入可视区域。
- 目录与设置统一使用底部面板，处理遮罩、返回键和连续开关。
- 优化翻页反馈，关闭影响阅读的点击抖动；TTS、连续滚动和快速切章时停用装饰性动画。

## 3. 后端与离线同步

### 3.1 离线书架镜像

- 按“后端地址哈希 + 用户 ID”隔离缓存，退出登录后隐藏但不删除。
- 元数据、目录、同步游标和待同步操作保存在键值存储；章节正文复用 Android 文件与 H5 IndexedDB。
- 自动缓存当前章及后续章节，最多保留 120 章并按 LRU 淘汰；手动固定缓存不自动删除。
- 后端失败时不清空书架，已缓存章节可继续阅读，未缓存章节显示明确提示。

### 3.2 可靠同步与删除

- 离线进度先写本地，并携带唯一 `mutation_id` 进入待同步队列。
- 恢复连接后先推送本地操作，再拉取服务端更新；冲突按时间和服务端版本处理。
- 新增云端书籍删除队列，删除后本地立即隐藏，后台通过 `/api/sync/push` 或删除接口同步。
- 待删除书籍不会因后台刷新重新出现，正文缓存进入 7 天延迟清理区。

### 3.3 聚合接口与书源验收

- 新增 `/api/library/offline-snapshot`，一次返回书籍、目录、缓存正文和阅读历史，减少 N+1 请求。
- 增加书源全链路验收脚本和脱敏报告，覆盖导入、搜索、详情、目录、正文、入架、重启、离线阅读与恢复同步。
- 对含 JavaScript、登录、验证码或动态逻辑的复杂书源执行兼容性识别和安全拒绝，不绕过访问限制。

## 4. TTS 与 Android 能力

- 扩展云端 TTS 状态、音色列表、合成、请求追踪和调用日志字段。
- 增加角色音色选择、试听、验收页、失败重试和 Android WebView 桥接。
- 新增数据库迁移 `0007_tts_provider_metadata`，记录供应商请求 ID、上游状态和音频字节数。
- Android APK 构建继续使用固定更新签名，验证 v1、v2、v3 签名并支持覆盖安装。

## 5. 关键公共接口

- `morphAppTheme(themeId, options)`：主题预览、保存、取消和动画调度。
- `listBackendBooks(client, { cacheMode })`：支持 `prefer`、`refresh`、`only`。
- `loadBackendBook(bookId, client, { cacheMode })`：在线优先并提供离线回退。
- `syncOfflineLibrary({ reason })`：登录、应用显示、网络恢复或手动同步。
- `deleteBackendBook(book, client)`：本地立即删除并排队同步云端。
- `GET /api/library/offline-snapshot`：用户隔离的离线聚合快照。

## 6. 测试与验收结果

- 前端：90 个 `*.test.mjs` 测试文件全部通过。
- 后端：124 项 Pytest 测试全部通过。
- H5：生产构建完成；仅保留现有大体积 vendor 包提示。
- APK：v1、v2、v3 签名验证通过，Android 真机覆盖安装成功。
- 离线书架：关闭后端连接并重启 APK 后仍显示 5 本书，主链路可进入已缓存章节。
- 云端删除：离线删除《剑来》后书架立即由 5 本变为 4 本，恢复连接和重启后未重新出现。
- UI 回归：书架标题、卡片文字、操作菜单和删除确认按钮完成真机居中验证。

## 7. 已知风险

- 真实网络书源会随第三方页面结构、限流和反爬策略变化，验收报告只能代表抓取时点。
- PostgreSQL 16 的完整迁移与双数据库测试由 GitHub Actions 继续执行，本地主要完成 SQLite 全量回归。
- 低端 Android WebView 的 30/60fps 表现仍需在更多设备上长期观察。
- 离线整本下载、暂停恢复和空间不足路径需要继续补充长时间真机压力测试。

## 8. 后续计划

1. 完成离线整本下载、暂停/继续、缓存统计和清理入口的完整交互。
2. 扩展真实书源验收快照，并建立失效源替换和失败分级机制。
3. 增加账号切换、删除墓碑和同步冲突的多设备真机测试。
4. 收口 V3.1 候选功能，只保留不影响阅读性能的共享过渡和轻量环境感知。
5. 持续优化 APK 首屏时间、长列表滚动和 WebView 内存占用。

## 9. 运行与验证命令

前端测试（项目根目录）：

```powershell
Get-ChildItem tests -Filter *.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName }
```

后端测试（`backend` 目录）：

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

后端启动（项目根目录）：

```powershell
python scripts/start_backend_detached.py
```

Android 调试端口映射：

```powershell
adb reverse tcp:8765 tcp:8765
```

## 10. 书源本地优先运行时（2026-08-11 追加）

### 10.1 架构决策

- Android APK 的书源主链路改为本地优先：URL、文件、二维码、深链和 3.x JSON 在手机本地识别、预览、去重、保存与运行。
- Android 外部书源请求不再默认访问 `localhost:8765`。新增 `NovelReaderHttp` 原生桥，前端 `requestSourceText()` 在 APK 中固定走“原生 HTTP → 必要时 WebView 渲染”。
- 后端调整为可选云服务，只负责账号同步、云书架、云 TTS、H5 跨域代理和基础来源兼容。Android 联网阅读不要求用户连接电脑后端。
- H5 仍受浏览器 CORS 约束：登录且已配置后端时优先使用鉴权代理，否则尝试站点直连，并明确承认失败可能是平台限制。

### 10.2 导入流水线与数据迁移

- 对外统一接口：`resolveSourceImport`、`previewSourceImport`、`applySourceImport`、`requestSourceText`、`runSourceReadingFlow`。
- 支持对象、数组、`sources` 包装、BOM、JSON/TXT 文件、剪贴板、二维码、`yuedu://`、`legado://`、`booksource://`、JSON URL、YCK 详情页和仓库列表入口。
- YCK `/content/id/{id}.html` 会直接规范化到 `/json/id/{id}.json`；市场支持关键词查询和分页 URL。
- 新增稳定 `sourceKey`（规范化名称 + 基础 URL），本地存储版本升级到 3；旧数据补键时保留原 `id`，避免书架引用断裂。
- 合法但受限的 3.x 配置会保存为禁用状态；仅缺少名称/基础 URL 或 JSON 无效时拒绝。导入状态统一为 `ready`、`partial`、`needs_login`、`blocked`、`invalid`。
- 删除旧导入函数返回语句后的不可达代码；导入日志保留新增、覆盖、跳过、受限和拒绝原因。

### 10.3 Android 原生传输能力

`NovelReaderHttp` 当前支持：

- GET、POST、请求头、字符串 body、User-Agent、Referer。
- UTF-8、GBK、GB2312 和响应头 charset 自动识别。
- 书源 + 域名粒度 Cookie 隔离、最多 5 次重定向、跨域重定向清除 Cookie/Authorization。
- 1–60 秒超时、每来源请求间隔、4 路并发、默认 4 MiB/绝对 8 MiB 响应限制。
- 禁止 `file:`、`content:`、私网、回环、链路本地和组播地址。
- 回调只返回状态、最终 URL、脱敏响应头、文本、编码、耗时和错误码；日志不记录 Cookie、Token 或正文。

现有隐藏 WebView 渲染桥继续承担动态页面，已具备超时销毁、最终 URL 和 Cookie 回写。旧的 GET-only WebView 外部请求拦截已退出书源主链路。

### 10.4 3.x 规则能力矩阵

| 能力 | Android APK | H5 无后端 | 后端基础解析 | 当前说明 |
|---|---|---|---|---|
| CSS / 属性 / 正倒序索引 | 支持 | 支持 | 基础支持 | 支持 `@text/@html/@href/@src/@textNodes/@ownText` |
| XPath | 支持 | 取决于浏览器 DOM | 暂不支持 | WebView 使用 DOM XPath |
| JSONPath | 支持 | 支持 | 基础支持 | 支持数组索引和 `*` |
| 正则替换、`||`、`&&` | 支持 | 支持 | 基础支持 | 支持回退与拼接 |
| GET/POST/headers/body/charset | 支持 | 受 CORS 限制 | 支持 | APK 走原生桥 |
| `nextTocUrl` / `nextContentUrl` | 支持，默认最多 5 页 | 支持 | 暂未扩展 | 去重并限制最多 10 页 |
| 安全 JS 字符串/数组/JSON/URL/Base64 | 支持 | 支持 | 不执行 | 有时间、操作数、深度和结果大小预算 |
| 任意 `java.*` / `eval` / 动态模块 | 阻止并保存为禁用 | 阻止 | 阻止 | 第一阶段明确边界 |
| 登录/验证码/付费 | 仅提示并要求人工操作 | 受限 | 不绕过 | 不规避站点访问控制 |

### 10.5 后端契约

- 新增鉴权接口 `POST /api/sources/import/preview`，只解析和静态分类，不写数据库。
- `POST /api/sources/import` 新增 `source_url`、`import_method`、`duplicate_strategy`；响应新增 `updated_count`、`skipped_count`、`unsupported_count` 和逐项状态/平台能力/原因。
- 沿用 `raw_json`、`compatibility`、`health_status` 和既有加密会话字段，没有新增数据库表。
- 覆盖、跳过、恢复软删除和用户隔离继续由同一事务服务处理；`/api/proxy/fetch` 仍是登录用户专用代理。

### 10.6 真实 YCK 基准

基准仓库：`https://www.yckceo.com/yuedu/shuyuan/index.html`。抓取页为 1、28、56，按近期/中段/较早分层选取 200 个合法文字源；详细逐项结果见 `docs/source-acceptance/yck-text-source-benchmark-2026-08-11.md` 和同名 JSON。

- 有效文字 JSON：200；可导入：200；导入率 **100%**，达到 ≥95% 门槛。
- 静态状态：`ready 86`、`partial 32`、`needs_login 10`、`blocked 72`。
- 严格合格候选：38；桌面真实完整流程：`0/38`，错误为 `SEARCH_FAILED 30`、`SEARCH_EMPTY 6`、`TIMEOUT 2`。
- 额外代表源探测：YCK `7163`（速读谷）和 `7298`（速读谷 SUDUGU）均完成搜索、详情、目录和正文，目录分别为 1663、999 章。

结论：导入门槛已通过，但随机分层样本的 ≥80% 完整阅读目标**未通过**。本阶段不能宣称“绝大书源可读”。当前主要差距是更多 3.x 请求脚本/宿主 API 映射、站点失效识别和真机网络环境复核。

报告不保存第三方正文、Cookie、Token 或完整书源 JSON；只保存 ID、抓取时间、SHA-256、阶段状态、耗时和错误码。

### 10.7 本轮验证证据

- 前端：92 个 `*.test.mjs` 文件全量执行；新增本地传输、sourceKey、受限源保存和原生桥静态契约测试。
- 后端：SQLite 全量 `125 passed`；PostgreSQL 16 继续由 GitHub Actions 执行。
- H5：生产构建成功；粘贴 JSON → 导入预览 → 本地写入 → 页面重载后仍可见的验收脚本通过，截图保存于本机验收目录；仅有现有 `caniuse-lite` 过期与 vendor 大文件警告。
- APK：`release/android-v2/V2.apk`，大小 1,496,142 字节，SHA-256 为 `11D11EC281FBCF93D43B3B9A34C9900365238CAB93A523E92ABECBF8CBF39BCD`；v1、v2、v3 签名验证通过。
- 本轮没有可用 Android 真机/ADB 设备，因此“关闭 8765 后扫码导入、覆盖安装、重启续读、断网缓存、内置摄像头扫码”仍列为发布阻断项，不能沿用旧轮次结果替代。

### 10.8 剩余发布阻断项与下一步

1. 以 `SEARCH_FAILED` 的 30 个样本为第一批夹具，补齐常见 `java.ajax`、请求变量、Cookie 和站点响应解码映射；每次只增加白名单宿主能力。
2. 将随机基准拆成“站点已失效”“规则不支持”“网络超时”“无关键词结果”，重新计算真正合格分母；完整阅读率达到 ≥80% 前不合并为正式发布。
3. 在无电脑后端的 Android 真机完成 URL、文件、二维码、3.x 深链同源去重和阅读闭环，并保存录屏、日志摘要与 APK SHA-256。
4. GitHub Actions 通过 SQLite、PostgreSQL 16、前端全量测试后，再决定是否合并 `feat/source-runtime-v3`。

新增基准命令（项目根目录）：

```powershell
node scripts/source_import_benchmark.mjs --limit=200 --pages=1,28,56 --concurrency=8 --flowLimit=200 --timeoutMs=10000
node scripts/source_flow_probe.mjs 7163 7298
```

## 11. 书源运行时第二轮完善（2026-08-11）

### 11.1 稳定失败分类与脱敏诊断

- 新增统一 `SourceRuntimeError` 与 `classifySourceFailure()`，搜索、详情、目录、正文和传输层不再只返回笼统的“请求失败”。
- 稳定错误码覆盖网络失败、超时、HTTP 拦截、站点失效、登录/Cookie/WebView/验证码需求、规则为空、解析为空、安全脚本拒绝和执行预算超限。
- 书源健康记录增加失败阶段、HTTP 状态、是否可重试和脱敏诊断；诊断只保存响应长度、指纹、顶层字段、类名摘要和命中特征，不保存正文、Cookie、Token 或完整响应。
- 识别域名停放页、空 JSON 结果与验证码页，避免把站点失效或无搜索结果误判为引擎不兼容。

### 11.2 高频 3.x 兼容补齐

- 安全脚本解释器新增受控变量声明、字符串拼接、对象/数组字面量、`JSON.parse/stringify` 和 `String()`；可执行常见“动态 URL + POST 请求描述”规则，同时继续拒绝 `eval`、任意 Java 类、循环和外部模块。
- 请求解析器对非法请求模板返回 `REQUEST_TEMPLATE_UNSUPPORTED`，只允许 GET/POST；POST 默认使用表单编码，并完整传递 header、body 和 charset。
- 传输层增加可取消超时、响应头 charset 识别和 GBK/GB2312 解码；HTTP 状态与网络错误进入统一分类。
- 规则引擎新增 JSONPath 过滤、`@children`、裸标签链式属性；修复嵌套同名 HTML 标签被首个闭合标签截断的问题。
- 代表性证据：YCK `7655` 的动态 POST 搜索规则已完成搜索→详情→1914 章目录→正文；YCK `7628` 曾完成搜索→详情→100 章目录→正文，但第二轮固定基准时触发验证码，因此按 `CAPTCHA_REQUIRED` 计入外部限制而非稳定通过。

### 11.3 第二轮 200 源基准

详细结果见 `docs/source-acceptance/yck-text-source-benchmark-stage2-2026-08-11.md`、同名 JSON 和 `yck-source-failure-audit-2026-08-11.json`。

- 有效文字 JSON：200；可导入：200；导入率仍为 **100%**。
- 静态状态：`ready 82`、`partial 30`、`needs_login 10`、`blocked 78`；静态完整候选 36。
- 运行时外部排除 32：`NETWORK_ERROR 12`、`HTTP_BLOCKED 6`、`SITE_UNREACHABLE 4`、`TIMEOUT 4`、`HTTP_NOT_FOUND 3`、`HTTP_SERVER_ERROR 2`、`CAPTCHA_REQUIRED 1`。
- 排除外部限制后运行时合格分母为 4，完整通过 1，完整阅读率为 **25%**；其余为 `PARSE_EMPTY 1`、`SEARCH_EMPTY 2`。
- 失败样本审计覆盖 38 个配置：POST 19、请求 options 21、Cookie 16、自定义 headers 9、JS 1；公开书源配置下载失败 0。未发现需要新增任意 Java 类权限的高频宿主 API。

验收结论：失败分类和 3.x 高频 POST 链路已有实质进展，但 **25% 仍低于 ≥80% 发布目标**。当前 PR 继续保持草稿，不能宣称 YCK 绝大书源已可稳定阅读。

### 11.4 自动验证与产物

- 前端全量：`95 passed`；后端 SQLite：`125 passed`；语法检查与 `git diff --check` 通过。
- H5 生产构建成功；保留既有 `caniuse-lite` 过期和 vendor 包体积警告。
- APK：`release/android-v2/V2.apk`，大小 1,504,334 字节，SHA-256 为 `B7C810ACA13F12FA8978B79B4AA06E2862723F41A47B0FA2E0AB4CE80601050E`；v1、v2、v3 签名验证通过。
- 本轮仍无可用 Android 真机，因此关闭电脑后端后的 URL/文件/二维码/深链去重、覆盖安装、重启续读和断网缓存仍为发布阻断项。

### 11.5 下一阶段优先级

1. 为 `PARSE_EMPTY` 和 `SEARCH_EMPTY` 样本补齐规则差异夹具，继续扩展安全声明式规则，不扩大任意脚本权限。
2. 在 Android 真机、仅手机联网且关闭 8765 的条件下执行五入口同源导入和完整阅读闭环，记录 APK 哈希、设备/系统版本与脱敏日志。
3. 扩充运行时有效分母，避免 4 个样本导致统计波动；同一固定样本至少在两个时间窗口复测后再判定稳定可用。
4. 保持 PR 为草稿，待真实完整阅读率达到 ≥80%、真机阻断项清零且 GitHub Actions 全绿后再申请合并。

第二轮命令（项目根目录）：

```powershell
node scripts/source_failure_audit.mjs
node scripts/source_import_benchmark.mjs --limit=200 --pages=1,28,56 --concurrency=8 --flowLimit=200 --timeoutMs=10000 --output=docs/source-acceptance/yck-text-source-benchmark-stage2-2026-08-11.json
node scripts/source_flow_probe.mjs 7655 7628
```

## 12. YCK 全目录导入与 Android 大容量存储（2026-08-11）

### 12.1 全目录入口与批量下载

- 书源市场按 YCK 当前实际契约使用 `keys` 搜索参数，支持 `uid`、排序、版本、发现、搜索、图片和声音筛选；页面解析同时返回总数、当前页、每页数量和总页数。
- 新增 YCK 批量 JSON 地址 `/yuedu/shuyuan/jsons?id={id-id-...}`，每页优先一次批量下载；服务端漏项时自动以 4 路并发回退到单源 JSON，不因一个失效 ID 丢弃整页。
- “导入当前筛选全部”按 57 页顺序执行，提供页码、下载数、缺失数、新增数、覆盖数和进度条；可以保存进度后停止，并按筛选条件隔离断点后继续。
- 合法来源全部保存；仅 `ready` 自动启用。`partial`、`needs_login`、`blocked`、非文字类型及需要人工登录/验证码的来源默认禁用，并展示限制原因，不绕过访问控制。

### 12.2 唯一身份、事务提交与存储容量

- 新书源 ID 与 `sourceKey` 都按“规范化名称 + 规范化基础 URL”生成；同一站点发布的不同名称书源不再互相覆盖。已有本地 ID 保持不变，避免书架和阅读记录引用断裂。
- 同一批 JSON 内的重复 `sourceKey` 复用首条 ID，后一条按覆盖策略更新；最终落盘按 ID 唯一化，新增回归用例确保重复配置只保存一份。
- Android 新增 `NovelReaderSourceStorage` 原生桥别名，复用应用私有文件存储，将书源按 25 条分片并通过版本清单原子切换；写完新一代分片和清单后再清理旧分片。
- 本地存储架构版本提升至 4。原生清单未变化时复用内存缓存；H5/普通键值存储每次读取实际数据，避免外部清理或迁移后读取过期缓存。
- H5 默认阻止超过 500 条的一键全量落盘，明确提示使用 Android APK 或缩小筛选范围，避免浏览器 localStorage 配额导致半写入。

### 12.3 YCK 5621 条全量导入基准

抓取时间：2026-08-11；仓库声明 5621 条、57 页。脱敏明细见 `docs/source-acceptance/yck-full-import-stage3-2026-08-11.json`。

| 指标 | 结果 | 说明 |
|---|---:|---|
| 目录条目 / 下载成功 | 5621 / 5621 | 缺失 0、无效 JSON 0 |
| 唯一安装书源 | 5327 | `sourceKey` 去重后重复残留 0 |
| 新增 / 覆盖 | 5327 / 294 | 新增与覆盖合计等于目录条目数 |
| 静态状态 | ready 2537 / partial 700 | blocked 1870 / needs_login 220 |
| 自动启用 / 默认禁用 | 2356 / 2971 | 只自动启用静态检查通过且原配置允许启用的来源 |
| 文字 / 非文字 / 未声明类型 | 5072 / 250 / 5 | 非文字类型保留但当前阶段禁用 |
| Android 原生存储 | 214 分片 / 39,669,743 字节 | 不保存正文、Cookie 或 Token |

导入率按“成功下载且 JSON 合法”的目录条目计算为 **100%**。该数字证明 5621 条均可被解析和纳入导入流水线，**不等于 5621 条都能稳定阅读**；真实搜索→详情→目录→正文通过率仍沿用第 11 节的独立运行时基准，尚未达到 ≥80% 发布门槛。

### 12.4 自动验证、构建与真机状态

- 前端 Node 测试：`96 passed`；后端 SQLite：`125 passed`；新增全量分页、批量回退、取消/续传、大容量拦截、同网址多源 ID 和同批重复去重测试。
- H5 生产构建成功；保留既有 `caniuse-lite` 过期和大体积 vendor 警告，无新增构建错误。
- APK：`release/android-v2/V2.apk`，1,516,622 字节，SHA-256 为 `B11EBB3669C8D4346639F31712F07A2D2882E19390D58904255CDB10FA7DD586`；v1、v2、v3 签名验证通过。
- REA-AN00 真机已完成覆盖安装并成功启动 `com.novelreader.v1/.MainActivity`，安装包版本 `1.0.0 (10000)`；本轮未在用户手机上直接触发 39.7 MB 的全量导入压力操作。

### 12.5 验收命令与后续边界

```powershell
# 项目根目录：自动测试
$tests = Get-ChildItem tests -Filter *.test.mjs | ForEach-Object { $_.FullName }
node --test $tests
backend\.venv\Scripts\python.exe -m pytest backend\tests -q

# 需要访问 YCK：全目录脱敏验收
node scripts\yck_full_import_acceptance.mjs

# 生产构建与 APK
& .\scripts\build_android_webview_apk.ps1 -H5RootOverride 'D:\Codex\novel-reader-uniapp\.v3-build\h5'
adb install -r .\release\android-v2\V2.apk
```

下一阶段继续提高“已导入书源可阅读”的比例：优先处理第 11 节 `PARSE_EMPTY`、`SEARCH_EMPTY` 和受控 WebView/请求脚本差异；在 Android 真机关闭 8765 后完成全量导入耗时、磁盘占用、重启加载和随机抽样阅读压力测试。漫画、音频、任意 Java 类、复杂动态加密、验证码绕过和付费内容仍不在第一阶段支持范围内。

## 13. 第四轮真实阅读与 Android 全量导入（2026-08-12）

### 13.1 规则运行时兼容修复

- 对“相对路径 POST 搜索 + 首页跳转到新域名”的 3.x 来源，先以无敏感信息 GET 探测最终站点，再向新源站重建只包含搜索参数的 POST；Cookie、Authorization 和 Proxy-Authorization 不会跨域透传。
- `runSourceReadingFlow()` 按“斗破苍穹、剑来、诡秘之主”逐个执行完整流程。仅当搜索、解析、详情、目录或正文返回稳定空结果码时尝试下一个关键词；网络、登录、验证码和安全拒绝不会被掩盖。
- 代表源 YCK `7596` 已由 `PARSE_EMPTY` 修复为完整通过：搜索《斗破苍穹》、1914 章目录、抽样正文 1284 个清洗后字符。`7655`、`7163` 也分别取得 1914 章和 1663 章目录并完成正文。

### 13.2 书源市场本地网络可靠性

- YCK 市场请求统一使用 APK 原生网络桥、浏览器兼容 User-Agent/Accept 和 30 秒超时，不再把第三方站点超时提示成 FastAPI 后端故障。
- 批量 JSON 接口失败时自动回退为 4 路并发单源下载；页面快速入口不再误把点击事件对象当成 URL。
- APK 导入提示明确为“手机直接联网，无需连接电脑后端”；H5 仍按 CORS 规则使用可选鉴权代理。

### 13.3 固定 200 源阅读基准

详细结果见 `docs/source-acceptance/yck-text-source-benchmark-stage4-2026-08-12.md` 和同名 JSON。

| 指标 | 第四轮结果 | 验收结论 |
|---|---:|---|
| 有效文字 JSON / 可导入 | 200 / 200 | 导入率 100%，达到 ≥95% |
| 静态状态 | ready 83 / partial 29 | needs_login 10 / blocked 78 |
| 静态候选 / 外部排除 | 34 / 30 | 网络、站点、HTTP、登录等稳定分类 |
| 严格运行时分母 | 4 | 排除无法公开访问的外部状态 |
| 搜索→详情→目录→正文通过 | 2 / 4 | 完整阅读率 50% |
| 引擎侧未通过 | SEARCH_EMPTY 2 | 站点对三个验收关键词均明确返回空结果 |

第四轮从 25% 提升到 **50%**，但仍低于 ≥80% 发布目标。因此本分支可以交付“全目录可导入和稳定分类”，不能宣称 YCK 全部或绝大来源都已可稳定阅读。

### 13.4 桌面全目录与 Android 真机

- 桌面全目录基准：YCK 声明 5624 条、57 页；成功下载 5602，瞬时缺失 22；新增 5312、覆盖 290，最终 5312 个唯一来源，目录下载率 99.61%。详见 `yck-full-import-stage4-2026-08-12.md`。
- Android 真机：REA-AN00、Android 15；电脑 8765 关闭且没有 8765 反向端口。APK 处理 57/57 页、5624/5624 条，缺失 0，新增 5330、覆盖 294。
- 强制停止并重启 APK 后，书源页仍显示 5330 个来源，大容量原生分片写入和重启加载通过。真机结果与桌面结果的唯一项数量差异来自同日动态目录内容和桌面瞬时缺失，均保留抓取时间与各自口径。
- 真机脱敏证据见 `docs/source-acceptance/yck-android-full-import-stage4-2026-08-12.md` 和同名 JSON；不保存正文、Cookie 或 Token。

### 13.5 自动测试、构建和 APK 证据

- 前端 Node 全量：`97 passed`；后端 SQLite：`125 passed`。
- H5 生产构建成功；仅保留现有入口包体积提示。
- APK：`release/android-v2/V2.apk`，1,520,718 字节，SHA-256 为 `3C8BA0EFD6BCFB781188CA28063612CB74A1EFEACAA64B7D23D0DE656B542967`；v1、v2、v3 签名验证通过。
- Android 安装版本 `1.0.0 (10000)`，最终包安装更新时间 2026-08-12 22:33:11；再次强制停止并重启后仍显示 5330 源。

第四轮关键命令（项目根目录）：

```powershell
$tests = Get-ChildItem tests -Filter *.test.mjs | ForEach-Object { $_.FullName }
node --test $tests
backend\.venv\Scripts\python.exe -m pytest backend\tests -q
node scripts\source_import_benchmark.mjs --limit=200 --pages=1,28,56 --concurrency=8 --flowLimit=200 --timeoutMs=10000 --output=docs/source-acceptance/yck-text-source-benchmark-stage4-2026-08-12.json
node scripts\yck_full_import_acceptance.mjs --output=docs/source-acceptance/yck-full-import-stage4-2026-08-12.json
adb reverse --list
adb install -r .\release\android-v2\V2.apk
```

### 13.6 下一阶段

1. 为两个 `SEARCH_EMPTY` 固定样本增加站点级诊断，确认是关键词覆盖不足、搜索入口变化还是规则变更；只有可复现的引擎差异才扩展白名单能力。
2. 扩大严格运行时有效分母，并在第二个时间窗口复测 200 源；达到 ≥80% 前继续保持兼容边界说明。
3. 在真机继续抽样验证“导入→立即测试→加入书架→重启续读→断网缓存”，并补齐 URL、文件、二维码和 3.x 深链同源去重的现场证据。
4. 后端继续作为账号同步、云书架、云 TTS 和 H5 代理；Android 书源阅读保持本地优先，不恢复 8765 强依赖。

## 14. 第五轮发现页运行态隔离与视频问题修复（2026-08-12）

### 14.1 视频复现结论

- 用户录屏确认 5330 条书源已完成导入和持久化；故障发生在进入发现入口后的目标站点请求，不是导入失败。
- `阅书小说网` 的发现入口请求 `m.yueshu.org` 时，Android 返回 `Unable to resolve host ... No address associated with hostname`。该现象属于目标域名 DNS 不可达，不代表手机断网或必须连接 FastAPI 后端。
- 原实现只按“启用 + 规则兼容”聚合发现入口，未使用发现阶段的运行结果，因此已失效站点仍会继续出现；页面还把 21853 个原始入口显示成“可发现”数量，容易被理解为 21853 个均可用。

### 14.2 运行态隔离与错误分类

- 书源设置新增独立 `exploreTest`：记录 `passed/failed`、检测时间、入口名、结果数、稳定错误码、HTTP 状态和可重试标记；搜索测试 `lastTest` 继续独立保存，避免一个状态覆盖所有阶段。
- 发现入口成功后写入 `passed`；失败时通过 `SourceRuntimeError` 记录稳定分类，并从发现聚合中暂时隔离整个来源。以后从单源入口成功访问时会自动恢复。
- Android DNS 文本统一映射为 `SITE_UNREACHABLE`；即使底层先包装成 `NETWORK_ERROR`，也会按 DNS 特征纠正分类。
- `SITE_UNREACHABLE`、`HTTP_NOT_FOUND`、`HTTP_BLOCKED` 和 `HTTP_SERVER_ERROR` 均显示中文说明，不再把 Android 英文异常直接暴露给用户。
- 书源列表不再显示裸 `compatible`，改为“规则兼容/部分兼容/规则不兼容”与“已验证/待检测/站点不可用”两个维度。

### 14.3 发现页计数与交互

- 顶部口径改为“发现源数量”，说明区同时展示“可发现 M 个书源、K 个入口”，不再把入口条数当成可用书源数。
- 失败后保留中文错误卡片，同时刷新书源和入口集合；按钮改为“查看其他可用入口”，不会继续无意义重试已被隔离的 URL。
- REA-AN00 真机初始显示 1373 个发现源、21853 个入口；复现 `m.yueshu.org` DNS 失败后变为 1372 个发现源、21845 个入口，证明 1 个来源的 8 个入口已被隔离。
- 继续抽样得到 HTTP 404 后变为 1371 个发现源、21836 个入口；最终 APK 覆盖安装并等待大容量数据加载后仍保持该结果。

### 14.4 自动测试、构建、后端与 APK

- 前端 `*.test.mjs` 全量 97 passed；新增 DNS 覆盖、发现失败隔离、成功恢复、中文提示和运行状态测试，最终定向回归全部通过；`git diff --check` 通过。
- H5 生产构建成功；仅保留既有 `caniuse-lite` 过期和入口包体积提示。
- 最终 APK：`release/android-v2/V2.apk`，1,520,718 字节，SHA-256 为 `E882F28DA3ACFB134862081E129096FD8515A5C6A3719CCC41B865CFFE987C35`；v1、v2、v3 签名通过并在 REA-AN00 覆盖安装成功。
- FastAPI `http://127.0.0.1:8765/api/health` 返回 `ok`，ADB 保留 `tcp:8765` 反向映射供账号、云同步和 AI 语音试听使用；Android 第三方书源请求仍走本地原生网络桥，不恢复对后端的强制依赖。
- 脱敏真机记录见 `docs/source-acceptance/yck-android-discovery-health-stage5-2026-08-12.md`，不保存正文、Cookie、Token 或完整响应。

### 14.5 后续优先级

1. 对被隔离来源增加批量“稍后重新检测”调度、失败冷却时间和恢复统计，避免瞬时网络波动造成长期隔离。
2. 对 1371 个当前发现源分层抽样，分别统计 DNS、404/410、403/429、5xx、解析为空和成功结果，优先修复占比最高且可复现的规则差异。
3. 继续扩大严格完整阅读分母；只有搜索→详情→目录→正文达到既定 ≥80% 门槛，才宣称“绝大合格来源可读”。
4. 后端继续保持启用以支持 AI 语音试听，但书源 URL、文件、扫码、3.x 深链导入和 Android 阅读保持本地优先。

## 15. 第六轮自适应搜索、发现跨源回退与运行池（2026-08-13）

### 15.1 根因修复与统一运行状态

- 书源设置新增兼容式 `runtimeV2`，分别记录 `search`、`explore`、`detail`、`toc`、`content` 的 `untested/probing/passed/cooldown/blocked` 状态、耗时、结果数、HTTP 状态、稳定错误码、连续失败次数与冷却截止时间；旧 `lastTest`、`exploreTest`、`health` 字段继续兼容写入。
- 配置指纹变化会清除旧失败状态并重新探测。失败书源继续保留，不修改用户启用开关，只在相应运行阶段暂时隔离。
- 冷却策略按错误类型区分：普通网络失败从 30 分钟递增到 2/12 小时，DNS 为 6 小时，5xx 为 1 小时，403/429 为 12 小时，404/410 与解析为空为 7 天；登录、验证码、付费和安全越界进入人工处理状态。
- 候选池不再要求用户先逐个测试。静态支持搜索但尚未检测的文字源可以进入智能探测；登录、验证码、非文字类型和安全规则越界来源不会自动请求。

### 15.2 本地搜索、后端合并与 Wi-Fi 预热

- 新增 `buildSourceCandidatePool()`、`runAdaptiveSourceSearch()`、`searchUnifiedBooks()` 与 `getSourcePoolStats()`。Android 搜索始终先运行手机本地来源；已登录时后端只并行补充，失败或离线不会中断本地结果。
- 每轮先尝试最多 6 个高优先级来源，可用池不足时按 5 个一批补充，默认最多 20 个；并发 4，单源超时 6 秒，整轮上限 20 秒。成功结果增量显示，失败只进入搜索摘要，不再伪装成图书卡片。
- 搜索结果按“标题 + 作者”去重，本地已验证线路优先；同书其他来源保存在备用线路中，详情、目录或正文失败时可切换。
- 新增应用前台 Wi-Fi 空闲预热：每会话最多检测 20 个来源、并发 2；移动数据、应用隐藏、正在搜索或阅读时立即暂停。队列、关键词游标与冷却状态持久化，不新增常驻后台服务。
- 两个固定 200 源基准中曾真实完整通过的来源只作为冷启动优先种子；它们仍需实际请求验证，失败后同样进入冷却，不会被硬编码为“已通过”。

### 15.3 发现目录与阅读阶段闭环

- 新增 `buildExploreCatalog()` 与 `openExploreCatalogEntry()`；“玄幻小说/玄幻/玄幻魔法”等标签归一为同一分类，每个分类保留多个来源提供者，不再按导入顺序直接截取一批入口。
- 聚合发现入口最多尝试 3 个提供者、并发最多 2 个；DNS、404、超时或解析为空时自动切换，全部失败后显示稳定错误汇总和“检测更多发现源”，不再无限加载。
- 单源发现仍保持严格单源语义。搜索、详情、目录、正文统一写入分阶段运行状态；完整阅读通过后提升来源优先级，失败不会删除已缓存章节。
- 搜索页“云端”改为“联网”，明确表示“手机本地书源 + 可选后端结果”；高级设置提供 Wi-Fi 智能检测、10/20/30 单轮来源上限和后端合并开关。

### 15.4 自动测试、真实基准与真机证据

| 验收项 | 结果 | 结论 |
|---|---:|---|
| 前端全量测试 | 101 / 101 passed | runtimeV2、分批搜索、后端离线、冷却、预热、发现回退均覆盖 |
| 后端 SQLite 测试 | 125 / 125 passed | 账号、同步、代理与 AI TTS 契约无回归 |
| 第六轮合法文字源导入 | 200 / 200 | 导入率 100% |
| 静态候选 / 实际完整流测试 | 36 / 36 | 外部失败均落入稳定错误分类 |
| 严格运行时分母 | 3 | 尚未达到至少 20 个的目标 |
| 完整阅读通过 | 1 / 3 | 33.33%，尚未达到 ≥80% |

- 第六轮外部排除 33 个：`NETWORK_ERROR 13`、`TIMEOUT 6`、`HTTP_BLOCKED 6`、`SITE_UNREACHABLE 4`、`HTTP_NOT_FOUND 2`、`HTTP_SERVER_ERROR 2`；严格分母内另有 `SEARCH_EMPTY 2`。脱敏明细见 `docs/source-acceptance/yck-text-source-benchmark-stage6-2026-08-13.md` 与同名 JSON。
- REA-AN00 覆盖安装保留 5330 个来源。针对 5330 条数据的候选池性能优化后，发现页基础框架约 4 秒可交互，完整归一化目录约 10 秒出现；打开失效分类会跨多个提供者回退，并以“已尝试多个发现来源，暂时都不可用”稳定结束。
- 真机首次搜索“斗破苍穹”在 20 秒内探测 20 个来源但未返回结果；因此增加真实通过源冷启动排序，并修复无结果页被发现目录遮挡的问题，使用户可以直接“继续检测下一批”。该最后两项代码已通过自动测试并进入最终 APK，但真机无线 ADB 随后断开，尚待设备重新连接后复测。
- FastAPI `http://127.0.0.1:8765/api/health` 于 2026-08-13 返回 `ok`，ADB 保留 `tcp:8765` 映射供账号、同步与 AI 语音使用；书源本地搜索链路不依赖该映射。

### 15.5 当前交付状态与下一步

- 2026-08-13 最终 H5 与 APK 重建成功；APK 为 `release/android-v2/V2.apk`，6,260,746 字节，SHA-256 为 `AEBDCC9D87F7E4CA2A3B022DBAC20371848D83B1F94B0295867727D6E5B3405A`，v1、v2、v3 签名均通过。无线 ADB 在覆盖安装前断开，因此最终包尚未完成 REA-AN00 覆盖安装复测。
- PR #1 继续保持草稿。当前 33.33% 与严格分母 3 均未达到“至少 20 个分母、≥80% 完整阅读”的发布门槛，因此不宣称 YCK 全部或绝大来源已稳定可读。
- 设备重新连接后执行 REA-AN00 覆盖安装；随后在开启/关闭 8765 两种条件下复测搜索、发现、备用线路、断网缓存与 AI 语音试听。
- 下一轮优先扩大第二时间窗口严格分母，针对 `SEARCH_EMPTY` 和占比最高的可复现规则差异做白名单式修复；不开放任意 `eval`、Java 类、文件系统、验证码绕过或付费内容访问。

### 15.6 最终 Android 真机复测与按钮热修（2026-08-13）

- REA-AN00 无线 ADB 恢复后，最终 APK 使用 `adb install -r` 覆盖安装成功；应用版本仍为 `1.0.0 (10000)`，书源页继续显示 5330 源，书架中的两本在线书和阅读记录均保留。
- 首轮搜索“斗破苍穹”完成 20 源探测，结果为 0；真机发现“继续检测下一批”按钮只显示但不触发。已将空状态组件的二次事件转发替换为搜索页直接处理的原生按钮，并增加 `@tap.stop="continueSearch"` 静态回归断言。
- 热修版覆盖安装后，点击按钮 1.5 秒内进入“正在探测联网书源”；第二批完成后报告 `有结果 1、空结果 2、失败 17`，可用池首次形成 1 个已验证搜索源。
- 打开结果后正确识别为《斗破苍穹》，作者九支书竹，目录 1642 章；第一章正文真实加载并超过 50 个清洗字符。搜索卡片仍先显示“未命名小说”，正文顶部仍残留 `chap_tp(); theme();`，两者列为下一轮解析和清洗问题。
- 聚合发现“玄幻”会尝试多个提供者，并以“已尝试多个发现来源，暂时都不可用”稳定结束，没有无限加载。
- 临时移除 `adb reverse tcp:8765` 后重复搜索，12 秒内仍显示本地书源结果；测试结束后已恢复 8765 映射，证明后端仅作为账号、同步和云 TTS 的可选能力。
- 应用内置 TTS 自动验收确认后端、登录、真实服务、五种逻辑音色、五音色真实合成与手机播放、真实性刷新和缓存复跑均通过。为避免长时间继续占用扬声器和调用额度，在 8/11 项后人工停止三章连续播放，因此最终报告为 8 项通过、1 项因人工停止失败，降级与后台停止未执行；这不影响“五种 AI 声音可试听”的结论。
- 热修最终 APK 为 `release/android-v2/V2.apk`，6,433,142 字节，SHA-256 为 `D9FD511D04340AD0065A726BAEE4EDBD234467A4BCA155E000FEBC5BD1D9E1B8`；v1、v2、v3 签名通过并在 REA-AN00 覆盖安装成功。

## 16. 第七阶段真实书源质量、可读率与稳定交付（2026-08-13）

### 16.1 搜索元数据与正文质量

- 搜索解析不再提前写入“未命名小说”。结果统一分为 `complete`、`needs_detail`、`invalid`；仅标题和书籍 URL 均有效的结果可以直接展示。
- 新增 `hydrateSourceSearchResults()`：每个来源最多补齐 3 个缺失标题结果、并发 2、详情超时 4 秒。补齐失败的项目不生成虚假图书卡片，并分别记录 `SEARCH_RESULT_INCOMPLETE`、`DETAIL_METADATA_EMPTY`。
- 搜索与发现共用元数据补齐管线；只有至少返回一个完整结果时，才把 `runtimeV2.search` 写为 `passed`。同书备用来源也必须拥有完整标题与 URL。
- 新增独立正文清洗器 `sanitizeReadableContent()` 与质量评估器 `assessReadableContentQuality()`：依次删除脚本/样式等非正文块、执行书源替换、转换 HTML、清理独立 JavaScript 调用行并合并重复片段。
- `chapterCacheMeta` 增加 `sanitizerVersion`、`rawChars`、`cleanedChars`。旧缓存按版本 0 在首次读取时惰性重洗并原位升级，不清空章节、不改变书架 ID、章节索引或阅读进度。
- 清洗后为空或以页面脚本为主时分别返回 `CONTENT_EMPTY`、`CONTENT_NOISE`；不足 50 字的合法短章可阅读，但不计入完整阅读通过率。

### 16.2 候选调度与规则兼容

- 搜索和 Wi-Fi 预热按基础域名分散抽样，同一域名每轮最多选择 2 个来源；两个独立时间窗口均完整通过的来源进入最高优先级。
- `SEARCH_RESULT_INCOMPLETE` 与 `CONTENT_NOISE` 分别进入搜索、正文阶段冷却，不影响同一来源的其他阶段；正文质量通过后才写入 `runtimeV2.content=passed`。
- 声明式引擎补齐了可复现的 CSS 类选择、简单 XPath、JSONPath 递归属性和 JSON 模板变量差异。YCK 代表样本 6645、6931 已由解析为空修复为搜索→详情→目录→正文完整通过。
- 安全边界保持不变：任意 `eval`、`Function`、Java 类、文件系统、全局 DOM、验证码绕过和付费内容访问仍被拒绝；样本 7497 在需要越界宿主能力时继续返回稳定安全错误。

### 16.3 当前公开候选集首窗口

基准 schema 已升级为 v3，报告见 `docs/source-acceptance/yck-current-cohort-stage7-window1-2026-08-13.md` 与同名 JSON；失败审计见 `yck-source-failure-audit-stage7-window1-2026-08-13.json`。报告只保存 ID、配置哈希、阶段状态、耗时、错误码和内容长度统计，不保存正文、Cookie、Token、完整响应或完整配置。

| 验收项 | 首窗口结果 | 门槛/结论 |
|---|---:|---|
| 当前候选配置 | 120 | 近期/中段/较早确定性分层，同域名最多 2 个 |
| 合法且可导入 | 120 / 120 | 100% |
| 严格运行时分母 | 33 | 已达到 ≥20 |
| 完整阅读通过 | 9 / 33 | 27.27%，未达到 ≥80% |
| 外部不可达或受限 | 87 | 不进入严格分母 |
| 元数据失败 | 1 | `SEARCH_RESULT_INCOMPLETE` |
| 合格正文抽样 | 27 段 | 噪声 0、短章 0 |

- 外部排除主要为 `HTTP_BLOCKED 34`、`NETWORK_ERROR 25`、`TIMEOUT 13`、`HTTP_NOT_FOUND 11`、`HTTP_SERVER_ERROR 3`、`CAPTCHA_REQUIRED 1`。
- 严格分母内主要差异为 `PARSE_EMPTY 19`，另有 `TOC_EMPTY`、`CONTENT_EMPTY`、`SEARCH_RESULT_INCOMPLETE`、`SEARCH_EMPTY`、`REQUEST_TEMPLATE_UNSUPPORTED` 各 1。
- 首窗口已达到“严格分母至少 20”，但完整阅读率仅 27.27%。第二时间窗口必须与首窗口间隔至少 24 小时，当前尚未到可执行时间，因此 PR #1 继续保持草稿，不能宣称全部或绝大 YCK 来源已稳定可读。

### 16.4 自动测试、APK 与真机结果

- 前端全量 `106 / 106 passed`；后端 SQLite `125 / 125 passed`；H5 生产构建成功，仅保留既有 `caniuse-lite` 与入口包体积警告；`git diff --check` 通过。
- 当前最终 APK 为 `release/android-v2/V2.apk`，1,348,062 字节，SHA-256 为 `5F9E9658B559E0857A2E627365AE0C8624D71ACDA5C22883DEE21A17A5FCAAF2`；v1、v2、v3 签名均通过并在 REA-AN00 使用 `adb install -r` 覆盖安装成功。
- 覆盖安装后仍保留 5330 个来源、已有书架与阅读记录。移除 `adb reverse tcp:8765` 后搜索“斗破苍穹”，本轮探测 20 个来源并在 20 秒内得到 1 个有效来源的真实书名结果，未出现“未命名小说”。
- 无后端状态下打开搜索结果，详情识别到 1642 章；首章正文成功加载，页面中 `chap_tp`、`theme(` 与占位标题均未出现，验证了正文清洗和旧数据兼容。
- 恢复 `tcp:8765` 后，FastAPI 健康检查正常；AI TTS 为已启用、已配置状态，`loli`、`uncle`、`youth`、`shota`、`recital` 五种声音均为已验证且可用。本阶段只做轻量回归，没有重复长时间三章播放。

### 16.5 发布边界与后续工作

1. 在首窗口至少 24 小时后，用相同锁定清单和 SHA-256 执行第二窗口；随后运行 `scripts/combine_source_acceptance_windows.mjs` 生成双窗口结论。
2. 继续针对 `PARSE_EMPTY` 中占比最高且可复现的声明式规则差异增加脱敏夹具；每项能力同时包含成功样本、越界拒绝和执行预算测试。
3. 双窗口都达到“分母 ≥20、完整通过率 ≥80%”，且 PostgreSQL 16 CI、真机闭环和全部自动测试通过后，才把 PR #1 从草稿改为可审阅；不自动合并、不强推。
4. 第三方永久失效、主动屏蔽、登录、验证码和付费来源继续保存并准确标记限制，不通过引擎绕过访问控制。Android 阅读保持本地优先，后端继续仅承载账号、同步、云 TTS 和 H5 代理。

首窗口命令（项目根目录）：

```powershell
node scripts/source_import_benchmark.mjs --cohort=current --limit=120 --pages=1-57 --concurrency=8 --flowLimit=120 --timeoutMs=10000 --windowId=stage7-window1-2026-08-13 --output=docs/source-acceptance/yck-current-cohort-stage7-window1-2026-08-13.json
```

第二窗口完成后的合并命令：

```powershell
node scripts/combine_source_acceptance_windows.mjs docs/source-acceptance/yck-current-cohort-stage7-window1-2026-08-13.json <第二窗口报告.json>
```

### 16.6 首窗口高频规则差异重放（2026-08-13）

- 在不提前执行第二时间窗口的前提下，对首窗口 `PARSE_EMPTY` 样本逐项复测。新增标题链接 URL 推导、`book.kind/chapter` 阶段上下文、详情页目录回退、相对 URL 规则结果以及换行分隔的受控 JS 声明语句。
- YCK `6808` 由搜索解析为空修复为完整通过：搜索和详情成功，目录 1663 章，首章清洗后 3505 字符。
- YCK `6305` 由搜索解析为空修复为完整通过：`book.kind` 正确传递到详情、目录与正文请求，多行受控 JS 模板在既有预算内运行，目录 1663 章，首章清洗后 2852 字符。
- 继续复测后，YCK `6247` 也已完整通过：目录 50 章，首章清洗后 141 字符；该样本验证了复合类选择器兼容能力。
- YCK `6311` 的 `@onclick@js:result.match(...)[1]` 规则已通过只读属性、正则 `match()` 和安全数组索引实现，目录 1649 章，首章清洗后 3008 字符。
- 连同本阶段此前修复的 `6645`、`6931`，首窗口已有 6 个 `PARSE_EMPTY` 样本完成搜索→详情→目录→正文闭环。详细脱敏记录见 `docs/source-acceptance/yck-stage7-rule-replay-2026-08-13.md` 与同名 JSON。
- 前端全量回归提升为 `108 / 108 passed`；`eval`、`Function`、Java 类、文件系统、全局 DOM、循环与动态模块仍被拒绝。该重放不修改首窗口原始统计，也不替代间隔至少 24 小时的第二窗口。

- 对剩余失败逐项核对后，`6238`、`5915`、`5813` 的当前页面已不再包含配置声明的结果容器，`5998` 当前搜索接口仍返回“请输入搜索词”；这些属于站点或配置变化，继续保留稳定失败分类，不加入站点专用绕过代码。

### 16.7 第二批规则重放与交付复验（2026-08-13）

- 只读属性访问只对单段 `@属性名` 生效，旧式 `@a@text` 继续按后代选择器解释；该区分避免了新能力破坏目录规则，并已加入回归断言。
- 前端全量 `108 / 108 passed`，后端 SQLite `125 / 125 passed`；生产 H5 与 Android APK 均重新构建成功。H5 仅保留既有 Browserslist 数据与入口体积警告。
- 最新 APK 为 1,348,062 字节，SHA-256 `5F9E9658B559E0857A2E627365AE0C8624D71ACDA5C22883DEE21A17A5FCAAF2`，v1/v2/v3 签名通过。
- REA-AN00 无线 ADB 在线并完成保留数据覆盖安装；版本保持 `1.0.0 (10000)`，首次安装时间仍为 2026-05-29，说明覆盖安装没有重建应用数据目录。
- 本轮重放将首窗口原 `PARSE_EMPTY` 中 6 个样本恢复为完整闭环，但不能据此直接重算首窗口 27.27% 的冻结统计。第二窗口最早应在北京时间 2026-08-14 15:47 后执行，PR #1 在达标前继续保持草稿。

## 十七、第八阶段：全链路流畅度、内存与页面切换优化（2026-08-13）

### 17.1 导航与页面首帧

- 移除底部标签切换前固定的 160ms 延迟，点击后立即调用 `uni.switchTab()`；图标反馈、波纹与页面切换并行执行，路由失败时恢复正确选中态。
- Android 自动性能模式在 REA-AN00 上采用“流畅”配置，页面进入动效缩短为 80–100ms，并在页面隐藏时暂停连续动画与预热任务。
- 新增脱敏性能记录器，记录启动、标签导航、书源快照、索引、发现目录、阅读渲染与 PSS；不记录书名、正文、Cookie、Token 或完整书源配置。

### 17.2 5330 源快照、索引与写入降阻塞

- 书源配置、设置和合并结果改为版本化内存快照；单源读取使用 ID 索引，兼容入口 `getSourceConfigs()` 保留。
- Android 原生桥新增分片批量读取，替代首次载入时约 214 次同步 JS 桥调用；轻量索引和发现目录持久化后可直接恢复。
- 书源页只持有统计、分组和当前 30 条轻量行；搜索页只持有候选摘要和有限发现入口，编辑、测试、阅读时才按 ID 读取完整配置。
- 索引在首屏后按每批 100 个、单批预算 8ms 增量构建；筛选输入使用 120ms 防抖；`sources:changed` 精确失效快照。
- 搜索、发现和阅读运行状态先写内存，并在不超过 250ms 内合并持久化；进入后台或搜索结束前强制刷新。Wi-Fi 预热改为空闲 2 秒后恢复。

### 17.3 阅读、书架与 AI 声音

- 阅读器正文渲染加入性能跨度，下一章预加载推迟到首屏稳定后执行；章节缓存、阅读进度和书架 ID 保持兼容。
- AI 声音列表、设备状态和云端状态增加 5 分钟缓存；只有用户主动刷新或缓存过期才重新请求，五种声音及后端 TTS 行为不变。
- 标签页刷新从固定 30 秒全量刷新改为事件失效优先、最长 5 分钟后台复验。

### 17.4 自动化与真机验收

| 项目 | 本阶段结果 | 门槛/说明 |
| --- | ---: | --- |
| 前端测试 | 111 / 111 passed | 全量 `*.test.mjs` |
| 后端 SQLite | 125 / 125 passed | PostgreSQL 16 由 GitHub Actions 复验 |
| 暖启动 | P95 177ms | ≤200ms |
| 应用内标签导航 | P95 4.9ms，34 次 | 已移除固定 160ms |
| 书源轻量分页 | P95 16.2ms | 5330 源、每页 30 条 |
| 连续切换 | 30 次，janky 18/690（2.61%） | 慢 UI 线程 1 次 |
| 稳态 PSS | 约 155–158MB | 相对约 269MB 基线下降约 42%，低于 230MB |
| 稳态内存变化 | 约 1.1MB | 低于 20MB |

- 真机为 REA-AN00（Android 15），保留 5330 个书源与 3 本书架数据完成覆盖安装。WebView 在垃圾回收前观察到约 388–392MB 的瞬时峰值，约 2 秒后回落到 155–158MB；因此本报告同时披露峰值和 GC 后稳态值，不把瞬时峰值隐藏为稳态指标。
- H5 生产构建与 Android APK v1/v2/v3 签名验证通过。原生书源分片改为每批最多 16 个读取后，完整 5330 源首次加载采样峰值由 391,717KB 降至 212,276KB，约 0.9 秒回落到 151,123KB。最终 APK 为 1,352,158 字节，SHA-256 为 `A47BE2B0057D94D391ED314FF96446E4FC72CD41A03364269964609BF9034CC5`。
- 阶段七第二时间窗口最早为北京时间 2026-08-14 15:47。当前尚未到执行时间，固定首窗口仍为 9/33（27.27%），PR #1 必须保持 Draft；性能改进不替代书源可读率门槛。

### 17.5 后续路线

1. 2026-08-14 15:47 后使用冻结清单执行阶段七第二时间窗口并生成双窗口报告。
2. 继续用性能报告定位首次无轻量缓存时的书源/发现冷启动成本，并优化 WebView 瞬时内存峰值。
3. 双窗口均达到严格分母不少于 20、完整阅读率不少于 80%，自动测试、真机闭环和 GitHub Actions 全绿后，才将 PR #1 从 Draft 改为可审阅。

## 十八、第九阶段：发现目录预生成与首次进入优化（2026-08-13）

### 18.1 实现内容

- 书源索引首次构建完成后，在浏览器空闲回调中预生成发现候选、入口和分类目录；不再等用户打开“发现”页面后才启动完整规则整理。
- Android、H5 继续复用同一发现缓存结构；配置导入、覆盖、启停或编辑后按书源修订号失效，避免旧目录继续显示。
- 页面进入后台时取消尚未执行的预生成任务；重新回到前台后，如果当前快照仍有效则重新安排，不增加常驻后台服务。
- 如果发现缓存已经存在，索引恢复只读取轻量缓存，不重新解析 5330 个完整配置。

### 18.2 自动测试与真机结果

| 项目 | 结果 | 说明 |
| --- | ---: | --- |
| 前端测试 | 112 / 112 passed | 新增预生成、取消和失效测试 |
| 发现页暖切换 | 500ms 截图已完整显示 | 48 个发现源、12 个分类可见 |
| GC 后稳态 PSS | 142,817KB | REA-AN00，覆盖安装后采样 |
| 数据保留 | 5330 源、3 本书架 | 首次安装时间仍为 2026-05-29 |
| APK | 1,356,254 字节 | v1/v2/v3 签名通过 |

- 阶段九 APK 路径为 `release/android-stage9/V2.apk`，SHA-256 为 `5DD2B5DE7D79D4498BBCF60B0B10A0072F14B7FA6DA54A72BE58AA7D08E33575`。
- H5 生产构建成功；仍只有既有 Browserslist 数据过期及入口约 275KiB 的体积警告，本阶段没有新增运行时依赖。
- 阶段七第二时间窗口仍未到北京时间 2026-08-14 15:47，因此首窗口 9/33（27.27%）保持冻结，PR #1 继续保持 Draft。

### 18.3 下一步

1. 到规定时间后执行阶段七第二窗口，生成固定清单双窗口合并报告。
2. 若完整阅读率低于 80%，根据两个窗口的稳定错误频率修复前三类通用规则差异。
3. 若达到门槛，再完成关闭后端阅读、恢复后端同步和五种 AI 声音回归，最后将 PR 转为可审阅。

## 十九、第十阶段：书源运行诊断与长目录固定窗口（2026-08-13）

### 19.1 书源运行状态可见化

- 轻量书源索引保留 `runtimeState`、结果数、稳定错误码、HTTP 状态、检测时间和冷却截止时间；不包含完整 `raw` 配置、正文、Cookie、Token 或完整响应。
- 书源整理增加已验证、待检测、冷却中、受限四类快捷诊断，并支持对应筛选。当前 REA-AN00 的 5330 源为：已验证 0、待检测 5217、冷却中 100、受限 13、已有稳定错误码 113。
- 失败码按计数聚合，当前前六类为 `PARSE_EMPTY 23`、`TIMEOUT 21`、`HTTP_NOT_FOUND/404 17`、`SITE_UNREACHABLE 17`、`NETWORK_ERROR 11`、`REQUEST_TEMPLATE_UNSUPPORTED 11`。失败来源继续保留，不因诊断自动删除或修改用户启用状态。

### 19.2 长目录固定窗口

- 阅读器目录只生成当前窗口的 120 个轻量章节行，不再先复制 999/1642 个完整章节对象，也不会随着滚动不断扩容到全量响应式 DOM。
- 上下占位维持总滚动高度；窗口根据实时 `scrollTop` 提前移动并保留 20 行预加载余量。真机首次复测发现“仅滚到底才换窗”会出现占位空白，已在交付前修复并增加滚动位置计算测试。
- REA-AN00 在 999 章书籍中连续快速滚动 10 次，从第 1 章稳定到第 984 章，无空白、无崩溃；静置 PSS 为 145,282KB，接近阶段九 142,817KB 稳态基线。

### 19.3 验证与产物

| 项目 | 结果 |
| --- | ---: |
| 前端测试 | 114 / 114 passed |
| 后端 SQLite | 125 / 125 passed |
| H5 生产构建 | 通过，保留既有 Browserslist 与 276KiB 入口警告 |
| APK 签名 | v1 / v2 / v3 通过 |
| 数据保留 | 5330 源、3 本书架、阅读进度均保留 |

- 最终 APK 为 `release/android-stage10-runtime/V2.apk`，1,360,350 字节，SHA-256 为 `C285CE306891130CAD84C11BE48700C0AC7BEFAC8E6CDB9621A5FBFC3CF2860A`，已在 REA-AN00 使用 `adb install -r` 覆盖安装成功。
- 脱敏验收报告见 `docs/performance/stage10-runtime-diagnostics-catalog-window-2026-08-13.md`。
- DOCX 渲染工具因环境仍缺少 LibreOffice/soffice 无法生成页面 PNG；已完成 ZIP、正文 XML、样式、关系、阶段标题、测试数量和 APK 哈希结构审计并通过，未把结构审计表述为逐页视觉检查。
- 本阶段不改变阶段七冻结统计。第二时间窗口仍须等到北京时间 2026-08-14 15:47 后执行；在双窗口完整阅读率达到门槛前，PR #1 继续保持 Draft。

## 二十、第十一阶段：可操作书源诊断与安全重试（2026-08-13）

### 20.1 错误筛选与重试队列

- 运行诊断中的稳定错误码改为可点击筛选条件；点击后书源分页只返回对应错误来源，并显示“正在筛选错误码 · 来源数”，可一键清除。真机点击 `PARSE_EMPTY` 后准确收窄为 23 个来源。
- 诊断增加“重试到期”统计，按当前时间动态判断冷却是否结束。REA-AN00 当前 100 个冷却来源中有 60 个到期可重试；前六类错误中 `TIMEOUT 21`、`SITE_UNREACHABLE 17`、`NETWORK_ERROR 11` 均可安全重试。
- 新增确定性重试候选选择：只选择已启用、规则兼容、声明支持搜索、处于冷却状态且冷却已结束的来源；可按错误码与分组继续收窄。登录、验证码、付费和安全越界来源不会自动进入队列。
- 普通批量检测改为“检测下一批（20）”，优先取待检测来源；所有入口单次最多 20 个，并支持在当前单源结束后取消后续任务，避免误触后连续请求数千个第三方站点。
- 修复书源页重复 `sourceRuntimeLabel()` 覆盖问题；列表状态统一以 `runtimeV2.search` 为准，不再被旧 `lastTest/exploreTest/health` 聚合结果覆盖。

### 20.2 自动测试与真机验收

| 项目 | 结果 | 说明 |
| --- | ---: | --- |
| 前端测试 | 114 / 114 passed | 覆盖到期判断、错误筛选、20 源上限与取消 |
| 后端 SQLite | 125 / 125 passed | 本阶段未修改数据库或后端契约 |
| H5 生产构建 | 通过 | 仅保留既有 Browserslist 与 277KiB 入口警告 |
| APK 签名 | v1 / v2 / v3 通过 | 覆盖安装成功 |
| 真机数据 | 5330 源 | 导入数据与用户启停状态保留 |

- REA-AN00 真机诊断仍为：已验证 0、待检测 5217、冷却中 100、受限 13、稳定失败 113；错误筛选和动态到期统计与索引结果一致。
- 覆盖安装后交互采样 `TOTAL PSS` 为 179,275KB，低于第八阶段 230MB 目标；本次指标仅作为功能验收时点采样，不替代完整 30 次切换性能基准。
- 最终 APK 为 `release/android-stage11-actionable/V2.apk`，1,360,350 字节，SHA-256 为 `AB5E84B9DE59D39DF5D249D08F86B4FF06AC48733D8229948FBFC5D8AB128195`。
- 脱敏验收报告见 `docs/performance/stage11-actionable-source-diagnostics-2026-08-13.md`；不保存正文、Cookie、Token、完整响应或完整书源 JSON。

### 20.3 边界与下一步

- 本阶段没有扩大安全脚本白名单，没有自动启用、删除或重导任何书源，也没有改变 Android 本地优先与后端可选架构。
- 阶段七第二时间窗口最早仍为北京时间 2026-08-14 15:47；当前不能提前生成满足“间隔至少 24 小时”的有效复测数据，PR #1 继续保持 Draft。
- 到时按冻结清单执行第二窗口并生成双窗口报告；若仍低于 80%，优先根据两窗口稳定频率处理前三类可复现规则差异，再复测搜索、详情、目录与正文闭环。

## 二十一、第十二阶段：YCK 规则兼容与修复后双窗口验收（2026-08-13）

### 21.1 固定清单与双窗口门禁

- 新增 schema v4 锁定清单：固定 200 个 YCK ID、顺序、分层、`sourceKey`、公开配置 SHA-256、规范化 `configHash`、关键词、超时和同域名上限。
- 窗口 B 必须读取窗口 A 清单；缺少 A 引用、清单哈希不一致、顺序变化或间隔不足 24 小时均拒绝合并。配置变化标记 `CONFIG_CHANGED`，不替换样本，也不进入同配置分母。
- 双窗口门禁通过后才生成轻量稳定源清单。只有 `sourceKey + configHash` 同时匹配才提升候选排序；不自动启用、不解除冷却，也不改变用户开关。
- 3 源真实烟雾验收已验证 YCK 分页、配置下载和报告写入：从 300 个候选锁定 3 个不同配置，schema、双哈希、规则族和响应指纹均完整；烟雾文件未作为正式证据保留。

### 21.2 高频 3.x 规则兼容

- 请求模板先按严格 JSON 解析，再由受预算的对象字面量解析器处理未加引号固定字段、单双引号和 `method/body/data/charset/headers/header`；只允许 GET/POST。函数调用、表达式、非白名单字段和 `__proto__/prototype/constructor` 均拒绝。
- 选择器补齐负索引、`0:3` 范围、`text.下一页`、`@title/@alt/data-*` 属性链、`:eq/:has/:contains`、特殊类名、相对 XPath 及链式 `class/id/tag` 语义。
- 新增来源隔离的流程级 `@put/@get`：最多 32 个键、单值 8192 字符、总量 65536 字符；变量通过不可枚举内存字段在搜索→详情→目录→正文间传递，不写入书架、章节缓存或持久存储。
- 安全宿主上下文支持 `J(value)`、`Base()`、`source.getKey()` 和当前来源 Cookie 清理表达式。任意 Java 类、文件系统、浏览器全局、循环和动态执行继续返回安全拒绝。

### 21.3 历史失败重放

| 结果 | 数量 | 说明 |
| --- | ---: | --- |
| 完整阅读通过 | 1 | ID 6543：斗破苍穹、4718 章、正文 8516 字符 |
| 请求模板已推进 | 1 | ID 5992 从模板拒绝推进到站点 HTTP 500 |
| 外部失败 | 4 | HTTP 403 两个、HTTP 500 一个、超时一个 |
| 页面/配置变化 | 4 | 返回结构与公开选择器不匹配，不做站点硬编码 |
| 访问壳或待复测 | 2 | 7515 为加载壳；6438/7415 通用差异已修复但待联网复测 |

- 脱敏明细见 `docs/source-acceptance/stage12-rule-replay-2026-08-13.json` 和同名 Markdown；保留历史 `stage7-window1` 9/33（27.27%）作为修复前基线，不纳入新的发布双窗口。
- 每项新能力均有成功、越界拒绝和预算超限测试。没有开放 `eval`、`Function`、任意 Java 类、文件系统、验证码或付费绕过。

### 21.4 自动验证与当前阻断

| 项目 | 当前结果 | 说明 |
| --- | ---: | --- |
| 前端测试 | 115 / 115 passed | 全量 `tests/*.test.mjs` |
| 后端 SQLite | 125 / 125 passed | 同步、权限和 TTS 契约未回归 |
| H5 生产构建 | 未完成 | 编译启动后创建新输出目录被 EPERM 拒绝 |
| 资格窗口 A | 未执行 | 外部执行审批额度耗尽；代码和 3 源烟雾已通过 |
| 资格窗口 B | 未到条件 | 只能在 A 完成至少 24 小时后执行 |
| PR #1 | Draft | 未达到双窗口门槛，不转为可审阅 |

- 本阶段没有删除、重导或批量启用现有 5330 个来源；Android 本地优先和后端可选架构保持不变。
- 权限恢复后依次执行：正式 200 源窗口 A并冻结清单；H5/APK 构建和签名；窗口 A 满 24 小时后运行 B；双窗口均达到严格分母 ≥20、完整阅读率 ≥80% 后生成稳定排序清单并完成 REA-AN00、同步和五种 AI 声音回归。

```powershell
# 资格窗口 A：从全目录分层、跨域锁定 200 个静态合格文字源
node scripts\source_import_benchmark.mjs --cohort=current --limit=200 --flowLimit=200 --pages=1-57 --concurrency=3 --timeoutMs=12000 --windowId=stage12-qualification-a --manifestOutput=docs/source-acceptance/stage12-qualification-manifest.json --output=docs/source-acceptance/stage12-qualification-window-a.json

# 至少 24 小时后的资格窗口 B：只复用 A 的清单，不重新选样
node scripts\source_import_benchmark.mjs --cohort=current --limit=200 --flowLimit=200 --concurrency=3 --timeoutMs=12000 --windowId=stage12-qualification-b --referenceWindowId=stage12-qualification-a --manifest=docs/source-acceptance/stage12-qualification-manifest.json --output=docs/source-acceptance/stage12-qualification-window-b.json

# 合并门禁；时间、清单、顺序或哈希不合格时命令直接失败
node scripts\combine_source_acceptance_windows.mjs --inputs=docs/source-acceptance/stage12-qualification-window-a.json,docs/source-acceptance/stage12-qualification-window-b.json --output=docs/source-acceptance/stage12-qualification-combined.json --seedsOutput=docs/source-acceptance/stage12-stable-source-seeds.json
```
