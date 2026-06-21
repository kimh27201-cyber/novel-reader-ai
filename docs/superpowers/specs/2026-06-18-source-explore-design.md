# 单书源发现页设计

## 目标

已导入且启用的书源如果提供 `exploreUrl`，用户可以进入该书源独立的发现页，按书源自身定义的入口浏览书籍，并复用现有详情、目录、正文和书架链路。

## 设计边界

- 分类、排行和最新等入口完全来自当前书源的 `exploreUrl`，不提供全局固定分类。
- 页面初始只解析并展示入口，用户点击入口后才请求书籍。
- 不执行复杂 JS、WebView、登录、付费或访问控制绕过规则。
- 保留现有书名搜索、导入、健康检测、反爬配置和 Android WebView 能力。

## 架构

`common/bookSources.js` 继续承担书源发现入口解析和书籍列表加载。现有私有解析逻辑改为可测试的单书源接口，并继续复用 `sourceEngine.js` 的模板、URL、请求和规则解析能力。

新增 `pages/sourceExplore/sourceExplore.vue`，路由只传递 `sourceId`。页面从本地书源配置读取当前书源，展示按原始 group 分组的入口；点击入口后调用统一加载函数，点击书籍则通过在线草稿进入现有 `sourceBook` 页面。

书源管理页使用双入口：点击书源主体进入发现页，点击行尾详情按钮打开现有书源详情抽屉。没有 `exploreUrl` 或被停用时给出明确提示。

## 数据契约

入口对象包含 `id/sourceId/sourceName/sourceGroup/group/title/kind/url`。解析器同时接受标准化书源及其 `raw` 对象，只允许 HTTP、HTTPS 和可解析的相对 URL，并保留 `{{page}}` 模板直到请求阶段。

加载结果包含 `sourceId/sourceName/entryTitle/page/hasMore/books`。`books` 继续使用现有在线书籍结构，并补充 `origin: 'explore'` 和入口名称。无有效结果时 `hasMore` 为 `false`。

## 错误处理

- 停用：提示先启用书源。
- 无入口：提示该书源仅支持书名搜索。
- 复杂规则：提示发现规则当前不兼容，但不影响书名搜索。
- 网络、代理和解析异常：复用 `friendlyErrorMessage()`，页面保留入口以便重试。

## 验证

扩展 `tests/sourceExplore.test.mjs`，覆盖字段保留、单源隔离、分组、URL 安全、分页模板、按需加载、页面路由及原搜索功能不回归。H5 验收至少使用“速读谷”和另一项普通 `exploreUrl` 书源完成入口、列表、详情、目录、正文和书架链路。
