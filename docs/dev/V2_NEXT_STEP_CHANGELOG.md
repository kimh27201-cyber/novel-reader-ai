# V2 Next Step Changelog

## Date: 2026-06-29

### Completed - Source Session Request Milestone
- Manual source sessions now participate in real source HTTP requests.
- Active session `Cookie`, `User-Agent`, and `Referer` are merged in the shared request builder used by search, explore, detail, TOC, and content.
- Expired sessions are ignored and do not leak stale request headers.
- Added `buildSourceSessionHeaders()` and `getActiveSourceSession()` to `common/sourceSession.js`.
- Added regression coverage for session-backed single-source search requests.

### Modified Files - Source Session Request Milestone
- `common/sourceSession.js`
- `common/bookSources.js`
- `tests/sourceSessionRequest.test.mjs`
- `tests/sourceHub.test.mjs`

### Test Commands - Source Session Request Milestone
- `node tests\sourceSessionRequest.test.mjs`
- `node tests\sourceCapabilitySessionRouter.test.mjs`
- `node tests\sourceHub.test.mjs`
- `node tests\sourceExplore.test.mjs`

### Acceptance Result - Source Session Request Milestone
- Targeted session request, capability/session/router, Source Hub, and source explore tests passed.
- Full frontend `.mjs` regression suite passed.
- Backend pytest passed: `55 passed`.
- H5 production build completed, and `http://127.0.0.1:8080/#/pages/library/library` returned HTTP 200.

### Completed - Source Hub Milestone
- Added `common/sourceCapability.js` for unified source capability output.
- Added `common/sourceSession.js` for local manual session persistence and status detection.
- Added `common/sourceRouter.js` for capability/session based candidate lane ordering.
- Added `pages/sourceHub/sourceHub.vue` as the primary post-import source entry.
- Updated library source row clicks and successful imports to enter Source Hub first.
- Registered `pages/sourceHub/sourceHub` in `pages.json`.

### Modified Files - Source Hub Milestone
- `common/sourceCapability.js`
- `common/sourceSession.js`
- `common/sourceRouter.js`
- `pages/sourceHub/sourceHub.vue`
- `pages/library/library.vue`
- `pages.json`
- `tests/sourceCapabilitySessionRouter.test.mjs`
- `tests/sourceHub.test.mjs`
- `tests/sourceExplore.test.mjs`
- `tests/productShell.test.mjs`
- `docs/DESKTOP_V2_DEVELOPMENT_PLAN.md`

### Test Commands - Source Hub Milestone
- `node tests\sourceCapabilitySessionRouter.test.mjs`
- `node tests\sourceHub.test.mjs`
- `node tests\sourceExplore.test.mjs`
- `node tests\productShell.test.mjs`

### Acceptance Result - Source Hub Milestone
- Targeted Source Hub, capability/session/router, source explore routing, and product shell tests passed.

### Known Issues - Source Hub Milestone
- Manual sessions are currently local H5 storage only.
- Android WebView session collection, backend session tables, and Playwright render lanes remain follow-up task packages.

### Completed
- Added source explore fallback search for sources whose discovery entry contains complex JS or WebView-only rules.
- Added `reasonCode` and `canSearchFallback` to unavailable source explore results.
- Added `searchSourceBooks()` for single-source search without writing source test status.
- Kept complex discovery rules blocked; fallback search does not execute third-party JS or WebView rules.
- Optimized backend proxy fetch with reusable HTTP client, optional `throttle_ms`, and response diagnostics.
- Added proxy response diagnostics: `elapsed_ms`, `content_bytes`, and `encoding`.
- Frontend proxy requests now pass `throttle_ms: 0` because source-level throttling is already handled before the request.

### Modified Files
- `common/bookSources.js`
- `pages/sourceExplore/sourceExplore.vue`
- `common/apiClient.js`
- `common/sourceEngine.js`
- `backend/app/api/proxy.py`
- `tests/sourceExplore.test.mjs`
- `tests/apiClient.test.mjs`
- `tests/sourceEngine.test.mjs`
- `backend/tests/test_proxy.py`

### Test Commands
- `node tests\sourceExplore.test.mjs`
- `node tests\apiClient.test.mjs`
- `node tests\sourceEngine.test.mjs`
- `cd backend; .\.venv\Scripts\python.exe -m pytest tests\test_proxy.py -q`

### Acceptance Result
- Targeted source explore fallback, proxy payload, source engine proxy, and backend proxy tests passed.

### Known Issues
- This still does not execute third-party JS or WebView-only discovery rules.
- If a real source's search rule itself requires WebView, the fallback search remains unavailable.
- Chapter speed can still be limited by target-site response time or anti-crawler policies.

### Next Step
- Run H5 external acceptance against the real Sudugu source, then proceed to APK milestone validation only after the H5 chain passes.

## Date: 2026-06-28

### Completed
- Enhanced `exploreUrl` parsing for `title,URL`, `title|URL`, `title=>URL`, `group::title::URL::note`, grouped JSON objects and relative URLs.
- Added safe pagination rendering for `{{page}}`, `{{page+1}}`, `{page}`, `$page` and `%page%`.
- Kept dangerous protocols and complex JS-like templates blocked.
- Added explicit empty category-result diagnostics with likely causes: rule mismatch, site structure changes, Cookie/Referer/User-Agent needs, JS/WebView dependency.
- Added source explore page debug state: last request URL, elapsed time, page number and copyable debug payload.

### Modified Files
- `common/bookSources.js`
- `pages/sourceExplore/sourceExplore.vue`
- `tests/sourceExplore.test.mjs`

### Test Commands
- `node tests\sourceExplore.test.mjs`

### Acceptance Result
- Source explore parsing, pagination and empty-result diagnostics tests passed.

### Known Issues
- This still does not execute third-party JS or WebView-only rules.
- Real category success still depends on the target site and the source rule quality.

### Next Step
- Run H5 external acceptance with real imported sources before APK milestone validation.

## Date: 2026-06-28

### Completed
- Optimized the source management UI: replaced the top-right floating sort menu with a bottom filter sheet.
- Moved source import into a fixed primary button: "扫码/链接添加书源".
- Removed the old top import hero block to reduce visual clutter and avoid covering source cards.
- Added the first-stage real source acceptance utility for source metadata, compatibility, explore/search, detail, TOC, chapter, bookshelf and continue-read checks.
- Added a source detail drawer entry for real chain acceptance, report copy and report clearing.

### Modified Files
- `pages/library/library.vue`
- `common/sourceAcceptance.js`
- `tests/sourceAcceptance.test.mjs`
- `tests/sourceManagementUi.test.mjs`
- `tests/productShell.test.mjs`
- `tests/sourceImport.test.mjs`
- `tests/v2SourceManagement.test.mjs`
- `tests/v2SourceRealImport.test.mjs`

### Test Commands
- `node tests\sourceAcceptance.test.mjs`
- `node tests\sourceManagementUi.test.mjs`
- `node tests\productShell.test.mjs`
- `node tests\sourceImport.test.mjs`
- `node tests\v2SourceManagement.test.mjs`
- `node tests\v2SourceRealImport.test.mjs`
- `Get-ChildItem tests -Filter *.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }`
- `node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('pages.json','utf8')); JSON.parse(fs.readFileSync('manifest.json','utf8')); console.log('json config ok')"`

### Acceptance Result
- Full `.mjs` regression suite passed.
- `pages.json` and `manifest.json` parsed successfully.

### Known Issues
- Real website availability still depends on target site structure, network state and maintained source rules.
- The H5 rule engine still does not execute third-party JS or WebView-only rules.
- Android APK validation was not run in this change.

### Next Step
- Continue with the next document phase: enhance `exploreUrl` parsing, pagination diagnostics and empty category-result explanations.
