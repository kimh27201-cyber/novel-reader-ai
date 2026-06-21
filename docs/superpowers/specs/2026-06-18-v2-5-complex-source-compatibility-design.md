# V2.5 复杂书源兼容增强设计

## 目标与边界

在不执行任意代码、不绕过验证码、会员、付费和强风控的前提下，提高阅读 3.x/Legado 书源在搜索、发现、详情、目录和正文链路中的兼容率。H5 负责普通 HTTP/CSS/JSON/Regex 与安全 JS 子集；Android APK 额外提供渲染后 HTML、手动登录和 Cookie 复用。

## 架构

1. `common/headerUtils.js` 统一解析对象、JSON、多行文本和阅读 3.x Header，并区分 H5 直连与后端代理可用 Header。
2. `common/jsRuleSandbox.js` 实现无 `eval` 的白名单表达式解释器，只允许字符串、JSON、URL、正则、Base64 和 URI 编解码操作，并设置复杂度与超时限制。
3. `common/webViewBridge.js` 封装 Android `NovelReaderWebViewParser`；非 Android 环境返回结构化的 APK 能力提示。
4. `common/sourceCookieJar.js` 按书源和域名保存、读取、清理 Cookie；Cookie 只进入代理或 Android 渲染请求，诊断信息只显示脱敏摘要。
5. `common/sourceEngine.js` 作为统一请求入口，生成请求诊断，按普通代理、Android 渲染两个通道获取文本；`common/bookSources.js` 负责书源能力判定、规则 fallback 和 UI 所需状态。
6. Android 壳使用独立隐藏 WebView 执行渲染和手动登录，不向第三方页面注入绕过逻辑；后端代理继续执行协议、方法和 Header 安全过滤。

## 兼容分级

- `full_css`：普通 CSS/JSON/Regex 可直接运行。
- `need_headers`：依赖 UA、Referer 或 Cookie，可通过代理运行。
- `need_js_sandbox`：依赖受支持的安全 JS 子集。
- `need_webview`：需要 Android 渲染后 HTML。
- `need_login`：需要用户手动登录并保存 Cookie。
- `unsupported`：验证码、强风控、会员、付费或超出白名单的 JS/WebView 能力。

## 错误与诊断

每次发现加载保留 `requestUrl/httpStatus/responseLength/charset/usedRule/parsedCount/failedStage/errorMessage/viaProxy`。Cookie 仅显示名称和长度，不显示值。请求失败、解析失败、环境不支持和规则不支持分别给出下一步建议。

## 验收

自动测试覆盖 Header、发现规则、JS 沙箱、WebView 分支、CookieJar 和兼容分级；H5 在 `http://localhost:8080/#/pages/library/library` 验收页面状态、发现链路与 H5 降级提示；Android 能力通过 Java 桥单元契约测试和 APK 构建验证，真实登录或动态源只做人工操作，不自动绕过限制。
