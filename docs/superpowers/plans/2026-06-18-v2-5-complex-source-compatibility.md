# V2.5 Complex Source Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 V2.5 Header、发现规则、安全 JS、Android WebView、CookieJar、兼容分级和端到端验收。

**Architecture:** 用四个小型公共模块承载 Header、JS、WebView 和 Cookie 单一职责，由 `sourceEngine` 统一请求并返回诊断，`bookSources` 将能力与请求链路接入现有业务。Android 壳只提供渲染和手动登录桥，H5 明确降级。

**Tech Stack:** uni-app、Vue 2、JavaScript ES modules、Node assert、FastAPI/httpx、Android WebView Java

---

### Task 1: Header 标准化和代理全链路

**Files:**
- Create: `common/headerUtils.js`
- Create: `tests/headerNormalize.test.mjs`
- Modify: `common/sourceEngine.js`
- Modify: `common/bookSources.js`
- Modify: `backend/app/api/proxy.py`

- [ ] 先写失败测试：对象、JSON、多行、`['User-Agent']`、非法名称、H5 禁止项、代理允许项与 Cookie 脱敏。
- [ ] 运行 `node tests/headerNormalize.test.mjs`，确认因模块缺失失败。
- [ ] 实现 `normalizeHeaders(input, { channel, context })`、`redactHeaders(headers)`，并在 `parseRequestSpec`、书源反爬配置和 `requestText` 唯一入口调用。
- [ ] 运行前端测试，并运行 `backend\.venv\Scripts\python.exe -m pytest backend/tests -q` 验证代理仍允许 UA/Cookie/Referer 且过滤 hop-by-hop Header。

### Task 2: 发现能力、规则 fallback 与诊断

**Files:**
- Create: `tests/exploreRuleParser.test.mjs`
- Modify: `common/bookSources.js`
- Modify: `pages/sourceExplore/sourceExplore.vue`
- Modify: `pages/library/library.vue`

- [ ] 先写失败测试，覆盖只有 `exploreUrl`、`ruleExplore`、fallback `ruleSearch`、分页、JSONPath/Regex 和请求/解析诊断字段。
- [ ] 运行 `node tests/exploreRuleParser.test.mjs`，确认能力判定或诊断断言失败。
- [ ] 实现 `hasExploreCapability(source)`，让 `loadSourceExploreBooks()` 返回/抛出带阶段诊断的结果，并在页面显示失败阶段和脱敏 Header 摘要。
- [ ] 运行 `node tests/sourceExplore.test.mjs` 与新测试。

### Task 3: 无 eval 的安全 JS 规则子集

**Files:**
- Create: `common/jsRuleSandbox.js`
- Create: `tests/jsRuleSandbox.test.mjs`
- Modify: `common/sourceEngine.js`
- Modify: `common/bookSources.js`

- [ ] 先写失败测试，覆盖字符串、JSON、URL、正则、Base64、URI 编解码、变量上下文，以及网络/文件/window/eval/循环拒绝和超时。
- [ ] 运行 `node tests/jsRuleSandbox.test.mjs`，确认模块缺失失败。
- [ ] 实现 token 白名单解释器 `executeJsRule(rule, context, options)`；仅支持链式白名单方法和有限赋值，不调用 `eval`、`Function` 或页面全局对象。
- [ ] 在 URL 模板和规则前处理接入；不支持能力返回 `UNSUPPORTED_JS_CAPABILITY`。
- [ ] 运行新测试及现有 sourceEngine/bookSources 回归。

### Task 4: Android 渲染桥和 H5 降级

**Files:**
- Create: `common/webViewBridge.js`
- Create: `tests/webViewRenderedFetch.test.mjs`
- Modify: `android-webview-shell/src/com/novelreader/v1/MainActivity.java`
- Modify: `common/sourceEngine.js`

- [ ] 先写失败测试，覆盖 H5 提示、Android 桥参数/回调、成功和超时错误。
- [ ] 运行 `node tests/webViewRenderedFetch.test.mjs`，确认模块缺失失败。
- [ ] 实现 `renderedFetch()` 和 `NovelReaderWebViewParser.fetchRenderedHtml(url, optionsJson, callbackName)`，限制协议、等待和超时；返回 `html/finalUrl/title/cookie/status/error`。
- [ ] 将标记为 WebView 的请求路由到桥，HTML 继续进入现有解析器。
- [ ] 运行 Node 契约测试并执行 Android 构建脚本验证 Java 编译。

### Task 5: 手动登录和 CookieJar

**Files:**
- Create: `common/sourceCookieJar.js`
- Modify: `common/bookSources.js`
- Modify: `pages/library/library.vue`
- Modify: `android-webview-shell/src/com/novelreader/v1/MainActivity.java`
- Modify: `tests/webViewRenderedFetch.test.mjs`

- [ ] 先写失败测试，覆盖按源/域保存、合并、过期、清理、请求复用和脱敏。
- [ ] 增加书源详情操作：打开登录页、保存登录状态、清除该源 Cookie；H5 显示仅 APK 支持。
- [ ] Android 桥只打开 `loginUrl` 供用户手动操作，并通过 CookieManager 读取当前域 Cookie，不处理验证码、会员或付费。
- [ ] 运行 Cookie、请求链路和 UI 静态契约测试。

### Task 6: 兼容分级和 UI

**Files:**
- Create: `tests/sourceCompatibilityLevel.test.mjs`
- Modify: `common/sourceEngine.js`
- Modify: `common/bookSources.js`
- Modify: `pages/library/library.vue`

- [ ] 先写失败测试，逐类覆盖 `full_css/need_headers/need_js_sandbox/need_webview/need_login/unsupported` 和环境建议。
- [ ] 实现确定性分级函数，诊断模型增加 `compatibilityLevel/environmentSupported/nextAction`。
- [ ] 在书源列表和详情中显示分级、环境支持、失败原因和下一步建议。
- [ ] 运行兼容分级、诊断和 library 页面契约测试。

### Task 7: 全量验证、H5 验收与文档

**Files:**
- Modify: `README.md`
- Modify: `docs/ANDROID_WEBVIEW_APK.md`
- Modify: `docs/ANDROID_VALIDATION.md`
- Create: `docs/V2.5_COMPLEX_SOURCE_VALIDATION.md`

- [ ] 运行所有 `tests/*.test.mjs`，任何失败先修复后重跑。
- [ ] 运行后端 pytest、JSON 配置解析和 Android 构建验证。
- [ ] 在 `http://localhost:8080/#/pages/library/library` 验收导入、启用、发现、详情、目录、正文、书架及 H5 降级提示。
- [ ] 更新桌面 v2 开发文档，记录架构、运行命令、测试证据、真实源边界、风险和 APK 产物路径。
- [ ] 对照原始计划逐项核验，确认没有未说明的缺口后再完成目标。
