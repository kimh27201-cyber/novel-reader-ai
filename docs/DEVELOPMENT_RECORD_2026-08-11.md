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
