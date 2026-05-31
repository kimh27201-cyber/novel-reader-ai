# Real Source Mystic Dark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app demonstrably closer to a real novel source-decoding reader while upgrading the default UI to a premium dark and mysterious design.

**Architecture:** Keep the existing `uni-app + Vue 2 + FastAPI + Android WebView shell` architecture. Add focused utility behavior and theme tokens first, then apply the tokens and source-state affordances to the existing pages without large rewrites.

**Tech Stack:** uni-app Vue 2 single-file components, plain JavaScript ES modules, Node `.mjs` tests with `node:assert`, Android Java WebView shell, existing FastAPI backend only if needed.

---

## File Map

- `common/appTheme.js`: Owns app theme IDs and CSS token values. Add the new default premium dark theme here.
- `tests/appTheme.test.mjs`: Verifies default theme ID and token contract.
- `common/sourceEngine.js`: Owns source rule parsing and runtime URL rewriting. Preserve HTTP dev proxy behavior and file-protocol real URL behavior.
- `tests/sourceEngine.test.mjs`: Verifies yck proxy rewrite and file-protocol non-rewrite behavior.
- `android-webview-shell/src/com/novelreader/v1/MainActivity.java`: Owns packaged H5 asset serving and WebView request interception.
- `tests/h5Shell.test.mjs`: Text-level Android shell guardrails.
- `common/bookSources.js`: Owns source compatibility, searchability, testing, online book loading, TOC, content decode, and cache flags.
- `tests/sourceDiagnostics.test.mjs`: Verifies diagnostics, source selection, test state, and page affordance strings.
- `tests/onlineReadingFlow.test.mjs`: Verifies search-to-content-to-cache closed loop.
- `pages/library/library.vue`: Source management UI.
- `pages/search/search.vue`: Discovery/search UI.
- `pages/sourceMarket/sourceMarket.vue`: Source repository UI.
- `pages/sourceBook/sourceBook.vue`: Online book detail and TOC UI.
- `pages/reader/reader.vue`: Reading UI, source-aware failures, cache state, retry and chrome.
- `pages/bookshelf/bookshelf.vue`: Bookshelf UI.
- `tests/productShell.test.mjs`: Text-level guardrails for product shell and visual affordances.

---

### Task 1: Premium Mystic Dark Theme Tokens

**Files:**
- Modify: `tests/appTheme.test.mjs`
- Modify: `common/appTheme.js`
- Verify by reading: `App.vue`, `pages/bookshelf/bookshelf.vue`, `pages/search/search.vue`, `pages/library/library.vue`, `pages/sourceMarket/sourceMarket.vue`, `pages/sourceBook/sourceBook.vue`, `pages/reader/reader.vue`

- [ ] **Step 1: Write the failing theme test**

Replace the current default-theme assertions in `tests/appTheme.test.mjs` with:

```js
assert.equal(getAppThemeId(), 'xuanye')
assert.equal(appThemes.length, 5)
assert.ok(appThemes.some(theme => theme.id === 'xuanye' && theme.name === '玄夜'))
assert.ok(appThemes.every(theme => theme.vars['--app-bg'] && theme.vars['--app-panel'] && theme.vars['--app-text']))
assert.ok(appThemes.every(theme => theme.vars['--app-stage'] && theme.vars['--app-shell-border'] && theme.vars['--app-floating-shadow']))
assert.ok(appThemes.every(theme => theme.vars['--app-reader-control'] && theme.vars['--app-reader-control-text']))
assert.match(getAppThemeStyle()['--app-bg'], /#080b10|#0b0f17|radial-gradient/)
assert.equal(getAppThemeStyle()['--app-accent'], '#67fff2')
assert.equal(getAppThemeStyle()['--app-accent-2'], '#8f6dff')
assert.equal(getAppThemeStyle()['--app-accent-3'], '#d8a75f')
```

Replace the missing-theme fallback assertion with:

```js
assert.equal(saveAppTheme('missing'), 'xuanye')
assert.equal(getAppThemeId(), 'xuanye')
```

- [ ] **Step 2: Run the theme test and verify RED**

Run:

```powershell
node tests/appTheme.test.mjs
```

Expected: fails because `getAppThemeId()` is still `night` and `appThemes.length` is still `4`.

- [ ] **Step 3: Implement the minimal theme token change**

In `common/appTheme.js`, set:

```js
const DEFAULT_THEME_ID = 'xuanye'
```

Add this theme object as the first item in `appThemes`:

```js
{
  id: 'xuanye',
  name: '玄夜',
  desc: '高级、暗黑、神秘，适合默认展示和夜间解码',
  swatch: ['#080b10', '#67fff2', '#d8a75f'],
  vars: {
    '--app-bg': 'radial-gradient(circle at 14% -8%, rgba(103, 255, 242, 0.14), transparent 30%), radial-gradient(circle at 86% 8%, rgba(143, 109, 255, 0.14), transparent 28%), linear-gradient(180deg, #080b10 0%, #0d111a 48%, #121017 100%)',
    '--app-top': 'linear-gradient(180deg, rgba(18, 24, 34, 0.98) 0%, rgba(10, 14, 22, 0.96) 100%)',
    '--app-accent': '#67fff2',
    '--app-accent-2': '#8f6dff',
    '--app-accent-3': '#d8a75f',
    '--app-on-accent': '#071014',
    '--app-text': '#f4f1e8',
    '--app-muted': '#8f9bad',
    '--app-panel': 'rgba(17, 22, 32, 0.74)',
    '--app-panel-strong': 'rgba(20, 25, 36, 0.92)',
    '--app-input': 'rgba(255, 255, 255, 0.07)',
    '--app-border': 'rgba(153, 231, 255, 0.14)',
    '--app-shadow': '0 18rpx 52rpx rgba(0, 0, 0, 0.34), inset 0 1rpx 0 rgba(255, 255, 255, 0.04)',
    '--app-stage': '#070a0f',
    '--app-shell-border': 'rgba(153, 231, 255, 0.18)',
    '--app-shell-shadow': '0 30rpx 96rpx rgba(0, 0, 0, 0.48)',
    '--app-floating-shadow': '0 -22rpx 76rpx rgba(0, 0, 0, 0.44)',
    '--app-reader-control': 'rgba(12, 17, 25, 0.94)',
    '--app-reader-control-text': '#f4f1e8'
  }
}
```

- [ ] **Step 4: Run the theme test and verify GREEN**

Run:

```powershell
node tests/appTheme.test.mjs
```

Expected: `appTheme tests passed`.

- [ ] **Step 5: Commit Task 1**

Run:

```powershell
git add common/appTheme.js tests/appTheme.test.mjs
git commit -m "feat: add mystic dark default theme"
```

---

### Task 2: Source Status And Discovery Readiness

**Files:**
- Modify: `tests/sourceDiagnostics.test.mjs`
- Modify: `tests/productShell.test.mjs`
- Modify: `common/bookSources.js`
- Modify: `pages/library/library.vue`
- Modify: `pages/search/search.vue`

- [ ] **Step 1: Write failing diagnostics expectations**

In `tests/sourceDiagnostics.test.mjs`, extend the `passed` diagnostics assertions:

```js
assert.equal(passed.statusTitle, '已通过网络测试')
assert.match(passed.statusDesc, /发现页会使用它/)
assert.equal(passed.ruleSummary.search, true)
assert.equal(passed.ruleSummary.toc, true)
assert.equal(passed.ruleSummary.content, true)
```

Extend the `failed` diagnostics assertions:

```js
assert.equal(failed.statusTitle, '网络测试失败')
assert.match(failed.statusDesc, /发现页会跳过它/)
```

Add product-shell checks near the library assertions:

```js
assert.match(library, /规则状态/)
assert.match(library, /搜索/)
assert.match(library, /目录/)
assert.match(library, /正文/)
assert.match(library, /发现页会使用已通过测试的书源/)
```

Add search-page checks:

```js
const search = readFileSync(new URL('../pages/search/search.vue', import.meta.url), 'utf8')
assert.match(search, /lastSearchSourceNames/)
assert.match(search, /本次使用/)
assert.match(search, /去书源页批量检测/)
assert.match(search, /只使用已通过测试的书源/)
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node tests/sourceDiagnostics.test.mjs
node tests/productShell.test.mjs
```

Expected: fails on missing `statusTitle` / `statusDesc` or missing UI strings.

- [ ] **Step 3: Add status title and description to diagnostics**

In `common/bookSources.js`, inside `getSourceDiagnostics(source)`, after `ruleSummary` is computed, return `statusTitle` and `statusDesc` using this mapping:

```js
const statusTitle = !compatible
  ? '规则不兼容'
  : lastTest.status === 'passed'
    ? '已通过网络测试'
    : lastTest.status === 'failed'
      ? '网络测试失败'
      : '规则兼容，待网络测试'
const statusDesc = !compatible
  ? (reasons.length ? reasons.join('、') : '包含 H5 暂不支持的复杂规则')
  : lastTest.status === 'passed'
    ? `发现页会使用它，最近返回 ${lastTest.count || 0} 条结果。`
    : lastTest.status === 'failed'
      ? `${lastTest.message || '网络是否可用以单源测试为准'}，发现页会跳过它。`
      : '网络是否可用以单源测试为准，测试通过后发现页会使用它。'
```

Then include both fields in the returned object:

```js
statusTitle,
statusDesc,
```

- [ ] **Step 4: Surface rule readiness in source detail**

In `pages/library/library.vue`, ensure the source detail drawer contains this visible label near the rule summary:

```html
<view class="test-title">规则状态</view>
```

Ensure the existing rule summary labels are exactly:

```js
[
  { key: 'search', label: '搜索', ready: summary.search },
  { key: 'bookInfo', label: '详情', ready: summary.bookInfo },
  { key: 'toc', label: '目录', ready: summary.toc },
  { key: 'content', label: '正文', ready: summary.content }
]
```

Ensure the source page help text contains:

```text
发现页会使用已通过测试的书源。
```

- [ ] **Step 5: Improve discovery blocked-state copy**

In `pages/search/search.vue`, ensure the no-source tip says:

```text
只使用已通过测试的书源
```

Keep the existing `lastSearchSourceNames` display and `去书源页批量检测` button.

- [ ] **Step 6: Run diagnostics and product shell tests**

Run:

```powershell
node tests/sourceDiagnostics.test.mjs
node tests/productShell.test.mjs
```

Expected: both pass.

- [ ] **Step 7: Commit Task 2**

Run:

```powershell
git add common/bookSources.js pages/library/library.vue pages/search/search.vue tests/sourceDiagnostics.test.mjs tests/productShell.test.mjs
git commit -m "feat: clarify source readiness states"
```

---

### Task 3: Online Book Detail Chapter State

**Files:**
- Modify: `tests/onlineReadingFlow.test.mjs`
- Modify: `tests/productShell.test.mjs`
- Modify: `pages/sourceBook/sourceBook.vue`
- Modify only if needed: `common/bookSources.js`

- [ ] **Step 1: Write failing page affordance tests**

In `tests/onlineReadingFlow.test.mjs`, add these source-book checks after the library checks:

```js
const sourceBook = readFileSync(new URL('../pages/sourceBook/sourceBook.vue', import.meta.url), 'utf8')
assert.match(sourceBook, /chapterStateLabel/)
assert.match(sourceBook, /chapter-state/)
assert.match(sourceBook, /待解码/)
assert.match(sourceBook, /已缓存/)
assert.match(sourceBook, /解析失败/)
```

In `tests/productShell.test.mjs`, add:

```js
const sourceBookPage = readFileSync(new URL('../pages/sourceBook/sourceBook.vue', import.meta.url), 'utf8')
assert.match(sourceBookPage, /书源详情/)
assert.match(sourceBookPage, /chapter-state/)
assert.match(sourceBookPage, /重新解析/)
assert.match(sourceBookPage, /加入书架/)
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node tests/onlineReadingFlow.test.mjs
node tests/productShell.test.mjs
```

Expected: fails because `chapterStateLabel` and `chapter-state` are not yet present.

- [ ] **Step 3: Add chapter state labels to `sourceBook.vue`**

In `pages/sourceBook/sourceBook.vue`, change each chapter row to include a state badge:

```html
<text class="chapter-title">{{ chapter.title }}</text>
<text class="chapter-state" :class="chapterStateClass(chapter)">{{ chapterStateLabel(chapter) }}</text>
```

Add methods:

```js
chapterStateLabel(chapter) {
  if (chapter.errorMessage || chapter.loadStatus === 'failed') return '解析失败'
  if (chapter.isCached || chapter.loadStatus === 'cached' || chapter.loadStatus === 'loaded') return '已缓存'
  return '待解码'
},
chapterStateClass(chapter) {
  if (chapter.errorMessage || chapter.loadStatus === 'failed') return 'failed'
  if (chapter.isCached || chapter.loadStatus === 'cached' || chapter.loadStatus === 'loaded') return 'cached'
  return 'pending'
}
```

Add CSS:

```css
.chapter-state {
  flex-shrink: 0;
  min-width: 92rpx;
  padding: 8rpx 12rpx;
  border-radius: 999rpx;
  color: var(--app-muted);
  font-size: 21rpx;
  text-align: center;
  background: var(--app-input);
}

.chapter-state.cached {
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.chapter-state.failed {
  color: var(--app-on-accent);
  background: var(--app-accent-3);
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```powershell
node tests/onlineReadingFlow.test.mjs
node tests/productShell.test.mjs
```

Expected: both pass.

- [ ] **Step 5: Commit Task 3**

Run:

```powershell
git add pages/sourceBook/sourceBook.vue tests/onlineReadingFlow.test.mjs tests/productShell.test.mjs
git commit -m "feat: show online chapter decode states"
```

---

### Task 4: Reader Source Failure And Cache Affordances

**Files:**
- Modify: `tests/readerExperience.test.mjs`
- Modify: `pages/reader/reader.vue`

- [ ] **Step 1: Write failing reader shell tests**

In `tests/readerExperience.test.mjs`, add these assertions against `pages/reader/reader.vue`:

```js
const reader = readFileSync(new URL('../pages/reader/reader.vue', import.meta.url), 'utf8')
assert.match(reader, /章节解码失败/)
assert.match(reader, /sourceLabel/)
assert.match(reader, /chapterState/)
assert.match(reader, /已缓存/)
assert.match(reader, /待解码/)
assert.match(reader, /重新解码本章/)
```

- [ ] **Step 2: Run reader test and verify RED**

Run:

```powershell
node tests/readerExperience.test.mjs
```

Expected: fails because `chapterState` or the new state labels are missing.

- [ ] **Step 3: Add a reader chapter-state computed property**

In `pages/reader/reader.vue`, add:

```js
chapterState() {
  if (this.chapterLoadError) return '解析失败'
  if (this.chapter && (this.chapter.isCached || this.chapter.loadStatus === 'cached' || this.chapter.content)) return '已缓存'
  if (this.loadingChapter) return '解码中'
  if (this.book.source === 'online' || this.book.source === 'backend') return '待解码'
  return '本地'
}
```

Add this badge in the chapter metadata area:

```html
<text class="source-badge">{{ sourceLabel }}</text>
<text class="source-badge">{{ chapterState }}</text>
<text>{{ chapterIndex + 1 }}/{{ totalChapters }}</text>
```

Ensure the error card description includes source context:

```html
<text class="error-desc">{{ sourceLabel }} · {{ chapterLoadError }}</text>
```

- [ ] **Step 4: Run reader test and verify GREEN**

Run:

```powershell
node tests/readerExperience.test.mjs
```

Expected: pass.

- [ ] **Step 5: Commit Task 4**

Run:

```powershell
git add pages/reader/reader.vue tests/readerExperience.test.mjs
git commit -m "feat: surface reader decode state"
```

---

### Task 5: Android/H5 External Request Support And Verification

**Files:**
- Modify if needed: `tests/sourceEngine.test.mjs`
- Modify if needed: `common/sourceEngine.js`
- Modify if needed: `tests/h5Shell.test.mjs`
- Modify if needed: `android-webview-shell/src/com/novelreader/v1/MainActivity.java`

- [ ] **Step 1: Confirm or add request URL tests**

`tests/sourceEngine.test.mjs` must include:

```js
globalThis.window = { location: { protocol: 'http:' } }
assert.equal(
  getRuntimeRequestUrl('https://www.yck2026.top/yuedu/shuyuan/content/id/7274.html'),
  '/yck2026-proxy/yuedu/shuyuan/content/id/7274.html'
)
globalThis.window = { location: { protocol: 'file:' } }
assert.equal(
  getRuntimeRequestUrl('https://www.yck2026.top/yuedu/shuyuan/content/id/7274.html'),
  'https://www.yck2026.top/yuedu/shuyuan/content/id/7274.html'
)
delete globalThis.window
```

`tests/h5Shell.test.mjs` must include:

```js
assert.match(mainActivity, /interceptExternalRequest/)
assert.match(mainActivity, /HttpURLConnection/)
assert.match(mainActivity, /Access-Control-Allow-Origin/)
assert.match(mainActivity, /isLocalHost/)
```

- [ ] **Step 2: Run request tests and verify RED if behavior is missing**

Run:

```powershell
node tests/sourceEngine.test.mjs
node tests/h5Shell.test.mjs
```

Expected: pass if the current worktree already contains this behavior; otherwise fail on the missing behavior.

- [ ] **Step 3: Implement missing H5 URL behavior if needed**

In `common/sourceEngine.js`, `getRuntimeRequestUrl(url)` must return the original URL unless the page protocol is `http:` or `https:`:

```js
const protocol = window.location && window.location.protocol
if (protocol !== 'http:' && protocol !== 'https:') return value
```

- [ ] **Step 4: Implement missing Android external GET interception if needed**

In `MainActivity.java`, keep asset interception first, then call `interceptExternalRequest(request)`.

The method must:

```java
private WebResourceResponse interceptExternalRequest(WebResourceRequest request) {
    if (request == null || request.getUrl() == null) return null;
    Uri uri = request.getUrl();
    String scheme = uri.getScheme();
    if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) return null;
    if (!"GET".equalsIgnoreCase(request.getMethod())) return null;
    String host = uri.getHost();
    if (host == null || isLocalHost(host)) return null;
    // Open HttpURLConnection, set timeouts, set Accept-Encoding identity,
    // copy safe request headers, return WebResourceResponse with CORS headers.
}
```

Ensure `isLocalHost(host)` rejects localhost, 127.*, 10.*, 192.168.*, and 172.16-31.*.

- [ ] **Step 5: Run request tests and verify GREEN**

Run:

```powershell
node tests/sourceEngine.test.mjs
node tests/h5Shell.test.mjs
```

Expected: both pass.

- [ ] **Step 6: Commit Task 5**

Run:

```powershell
git add common/sourceEngine.js tests/sourceEngine.test.mjs android-webview-shell/src/com/novelreader/v1/MainActivity.java tests/h5Shell.test.mjs
git commit -m "feat: support packaged webview source requests"
```

---

### Task 6: Full Verification

**Files:**
- No required production edits.
- Modify docs only if a verification note is needed.

- [ ] **Step 1: Run every frontend utility test**

Run:

```powershell
Get-ChildItem tests -Filter *.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName }
```

Expected: every test prints its `... tests passed` message and PowerShell exits with code `0`.

- [ ] **Step 2: Parse app config JSON**

Run:

```powershell
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('pages.json','utf8')); JSON.parse(fs.readFileSync('manifest.json','utf8')); console.log('json config ok')"
```

Expected: `json config ok`.

- [ ] **Step 3: Run backend tests only if backend files changed**

If no files under `backend/` changed, record "backend not changed". If backend files changed, run:

```powershell
backend\.venv\Scripts\python.exe -m pytest
```

Expected: pytest exits with code `0`.

- [ ] **Step 4: Inspect worktree**

Run:

```powershell
git status --short
```

Expected: only intentional uncommitted files remain. Existing user worktree changes must not be reverted.

- [ ] **Step 5: Final commit if needed**

If Task 6 produced docs or verification notes, commit them:

```powershell
git add <files>
git commit -m "docs: record mystic dark verification"
```

---

## Self-Review

Spec coverage:

- Real source import, diagnostics, testing, search, TOC, content, cache, and reading states are covered by Tasks 2-4 and existing flow tests.
- Android packaged external source requests are covered by Task 5.
- Premium dark mysterious UI is covered by Task 1 plus page token usage checks in Tasks 2-4.
- Verification gates are covered by Task 6.

Placeholder scan:

- No `TBD`, `TODO`, or undefined future task remains.

Type consistency:

- Theme ID is consistently `xuanye`.
- New diagnostics fields are consistently `statusTitle` and `statusDesc`.
- New source book methods are consistently `chapterStateLabel` and `chapterStateClass`.
- New reader computed property is consistently `chapterState`.
