# User Source Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在书源详情中安全删除用户导入书源，同时禁止删除内置源和 API 源。

**Architecture:** 复用现有 `confirmRemoveSource`、`removeSource` 和 `deleteUserSource` 数据链路，只在详情面板增加受 `importedAt` 控制的危险操作入口。通过静态页面契约和现有存储测试覆盖权限、确认与删除链路。

**Tech Stack:** uni-app、Vue 2、Node.js `assert`

---

### Task 1: 删除入口契约

**Files:**
- Modify: `tests/v2SourceManagement.test.mjs`

- [x] 增加断言：页面包含 `v-if="selectedSource.importedAt"` 的删除区域、`confirmRemoveSource(selectedSource)` 调用和“删除此书源”文案。
- [x] 运行 `node tests/v2SourceManagement.test.mjs`，确认因详情模板缺少入口而失败。

### Task 2: 详情面板危险操作

**Files:**
- Modify: `pages/library/library.vue`

- [x] 在详情滚动区底部加入仅用户导入源可见的危险操作卡片。
- [x] 删除按钮调用 `confirmRemoveSource(selectedSource)`，复用已有二次确认和删除逻辑。
- [x] 增加与现有主题变量一致的卡片和按钮样式。
- [x] 删除成功后显示“书源已删除”提示。
- [x] 运行 `node tests/v2SourceManagement.test.mjs` 和书源存储相关测试，确认通过。

### Task 3: 回归与页面验收

**Files:**
- Verify: `pages/library/library.vue`
- Verify: `tests/*.test.mjs`

- [x] 运行全部前端测试文件。
- [x] 解析 `pages.json` 和 `manifest.json`，运行 `git diff --check`。
- [x] 在 `http://localhost:8080/#/pages/library/library` 验证：用户源显示删除入口、取消不删除、确认后列表消失；内置/API 源由 `importedAt` 条件保护。
