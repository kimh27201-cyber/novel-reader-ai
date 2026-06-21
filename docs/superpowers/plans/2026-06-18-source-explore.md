# Source Explore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为每个已导入书源提供只展示其自身 `exploreUrl` 入口的独立发现页，并复用现有在线阅读链路。

**Architecture:** 扩展 `common/bookSources.js` 已有发现解析和请求函数，提供单书源结构化接口；新增 `sourceExplore` 页面作为轻量展示层。书源管理页拆分浏览和详情两个点击目标，不改动详情、目录、正文及书架协议。

**Tech Stack:** uni-app、Vue 2、JavaScript ES modules、Node.js `assert` 测试、FastAPI 代理

---

### Task 1: 固化单书源发现接口行为

**Files:**
- Modify: `tests/sourceExplore.test.mjs`
- Modify: `common/bookSources.js`

- [ ] **Step 1: 添加失败测试**

在 `tests/sourceExplore.test.mjs` 中断言：导入后保留 `raw.exploreUrl`；指定一个 `sourceId` 时不会混入其他书源入口；停用、无入口和非法协议返回明确状态；`{{page}}` 在入口解析后仍被保留。

- [ ] **Step 2: 验证测试失败**

Run: `node tests/sourceExplore.test.mjs`

Expected: FAIL，提示 `parseSourceExploreUrl` 或 `getSourceExploreEntries` 尚未导出。

- [ ] **Step 3: 实现最小接口**

在 `common/bookSources.js` 导出：

```js
export function parseSourceExploreUrl(source) {}
export function getSourceExploreEntries(sourceOrId) {}
export async function loadSourceExploreBooks(sourceOrId, entry, options = {}) {}
```

复用现有 `parseExploreEntryValue()`、`exploreSourceEntry()` 和反爬请求逻辑。入口 URL 仅接受 HTTP、HTTPS 或相对路径，模板替换留到请求阶段。

- [ ] **Step 4: 验证接口测试通过**

Run: `node tests/sourceExplore.test.mjs`

Expected: `sourceExplore tests passed`

### Task 2: 增加独立书源发现页

**Files:**
- Create: `pages/sourceExplore/sourceExplore.vue`
- Modify: `pages.json`
- Modify: `tests/sourceExplore.test.mjs`

- [ ] **Step 1: 添加页面结构失败测试**

断言页面读取路由 `sourceId`、调用 `getSourceExploreEntries()`、初始不调用加载函数、点击入口调用 `loadSourceExploreBooks()`、点击书籍保存草稿并进入 `/pages/sourceBook/sourceBook`。

- [ ] **Step 2: 验证测试失败**

Run: `node tests/sourceExplore.test.mjs`

Expected: FAIL，提示 `pages/sourceExplore/sourceExplore.vue` 不存在。

- [ ] **Step 3: 实现页面**

页面包含书源标题、入口分组、入口按钮、加载/空/错误状态和分批书籍列表。入口名称和分组只使用解析结果；封面使用 `lazy-load` 和文字封面兜底；滚动到底按页加载更多。

- [ ] **Step 4: 注册路由并验证 JSON**

Run: `node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('pages.json','utf8')); console.log('json config ok')"`

Expected: `json config ok`

### Task 3: 接入书源管理双入口

**Files:**
- Modify: `pages/library/library.vue`
- Modify: `tests/sourceExplore.test.mjs`

- [ ] **Step 1: 添加交互失败测试**

断言书源主体点击调用浏览跳转，行尾详情按钮使用 `.stop` 打开原详情抽屉；停用书源和无 `exploreUrl` 书源不跳转并显示提示。

- [ ] **Step 2: 删除管理页固定发现区域**

移除固定“分类/排行榜/最新”区块及只服务该区块的状态和计算属性，保留导入、筛选和书源列表。

- [ ] **Step 3: 实现双入口**

书源主体调用 `openSourceExplore(row)`；尾部图标调用 `openSourceDetail(row.raw)`。路由只携带编码后的 `sourceId`。

- [ ] **Step 4: 验证测试通过**

Run: `node tests/sourceExplore.test.mjs`

Expected: `sourceExplore tests passed`

### Task 4: 回归测试和 H5 验收

**Files:**
- Modify: `tests/sourceExplore.test.mjs`（仅在发现遗漏时）

- [ ] **Step 1: 运行全部前端测试**

Run: `Get-ChildItem tests -Filter *.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }`

Expected: 所有测试输出 `tests passed`，退出码为 0。

- [ ] **Step 2: 校验配置**

Run: `node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('pages.json','utf8')); JSON.parse(fs.readFileSync('manifest.json','utf8')); console.log('json config ok')"`

Expected: `json config ok`

- [ ] **Step 3: H5 验收**

验证书源主体进入独立发现页、详情图标打开管理抽屉、入口按需加载、分页、详情/目录/正文/书架链路和原书名搜索。记录真实书源失败阶段，不把外部站点失效误判为程序回归。

- [ ] **Step 4: APK 决策**

H5 全链路和至少两个普通书源通过后再生成阶段 APK；未达到真实书源验收条件时不打包。
