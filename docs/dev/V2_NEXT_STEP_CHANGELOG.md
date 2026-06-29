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

## Date: 2026-06-29

### Completed
- Connected the existing source acceptance runner to `pages/sourceHub/sourceHub.vue`.
- Added a Source Hub acceptance panel with run, copy report, clear report and stage-result display actions.
- The panel now shows latest status, score, elapsed time, failed stage, failure reason, suggestions and every acceptance stage.
- Reused `common/sourceAcceptance.js`; no new dependency or parser behavior change was introduced.
- Extended `tests/sourceHub.test.mjs` to cover the acceptance entry and diagnostics contract.

### Modified Files
- `pages/sourceHub/sourceHub.vue`
- `tests/sourceHub.test.mjs`
- `docs/dev/V2_NEXT_STEP_CHANGELOG.md`
- `docs/DESKTOP_V2_DEVELOPMENT_PLAN.md`

### Test Commands
- `node tests\sourceHub.test.mjs`
- `node tests\sourceAcceptance.test.mjs`
- `node tests\sourceExplore.test.mjs`

### Acceptance Result
- Source Hub page contract, source acceptance module and source explore regression tests passed.

### Known Issues
- This still does not execute third-party JS or bypass login, payment, CAPTCHA or anti-crawler policies.
- Real source success still depends on site availability, source rules, proxy state and valid session headers.

### Next Step
- Run full H5 regression and desktop self-acceptance at `http://localhost:8080/#/pages/library/library`, then proceed to Android WebView session collection only after H5 behavior is stable.

## Date: 2026-06-29

### Completed - Source Session Backend Persistence Milestone
- Added backend `source_sessions` persistence for per-user, per-source Cookie / User-Agent / Referer session context.
- Added authenticated `GET /api/sources/{source_id}/session`, `PUT /api/sources/{source_id}/session`, and `DELETE /api/sources/{source_id}/session`.
- Deleting a backend source now also clears its saved source session.
- Added migration `0003_source_sessions.py`.
- Extended `apiClient` with source session read/save/delete methods.
- Source Hub now syncs manual sessions to the backend for backend-bound sources while keeping local H5 storage as fallback.

### Modified Files - Source Session Backend Persistence Milestone
- `backend/app/models/models.py`
- `backend/app/schemas/sources.py`
- `backend/app/api/sources.py`
- `backend/migrations/versions/0003_source_sessions.py`
- `backend/tests/test_sources.py`
- `backend/tests/test_migration_artifacts.py`
- `common/apiClient.js`
- `pages/sourceHub/sourceHub.vue`
- `tests/apiClient.test.mjs`
- `tests/sourceHub.test.mjs`

### Test Commands - Source Session Backend Persistence Milestone
- `backend\.venv\Scripts\python.exe -m pytest backend\tests\test_sources.py backend\tests\test_migration_artifacts.py -q`
- `node tests\apiClient.test.mjs`
- `node tests\sourceHub.test.mjs`

### Acceptance Result - Source Session Backend Persistence Milestone
- Targeted backend source session API, migration artifact, frontend API client, and Source Hub contract tests passed.
- Full frontend `.mjs` regression suite passed.
- Backend pytest passed: `58 passed`.
- `pages.json` and `manifest.json` parsed successfully.
- `git diff --check` passed.
- H5 production build completed.
- Desktop H5 self-acceptance confirmed Source Hub renders the backend session state; the only console error was `favicon.ico` 404.

### Known Issues - Source Session Backend Persistence Milestone
- Desktop H5 still does not collect Android WebView Cookie automatically.
- Backend session sync only applies to sources already bound to backend source IDs; local-only H5 sources continue to use local storage.
- This does not bypass login, CAPTCHA, paid content, membership restrictions, or anti-crawler controls.

### Next Step
- Continue with Android WebView session collection only after desktop H5 review remains stable. APK packaging remains paused until the phone is connected.

## Date: 2026-06-29

### Completed - Source Hub Android Session Entry Milestone
- Added Android WebView login/session collection entry points to `pages/sourceHub/sourceHub.vue`.
- Source Hub now reuses `openSourceLogin()` and `readSourceLoginCookie()` from `common/webViewBridge.js`.
- Saved Android login cookies are written into `sourceCookieJar`, local source session storage, and backend session sync when a backend-bound source is available.
- Added a redacted cookie summary list to Source Hub so desktop/H5 can verify session state without exposing raw Cookie values.
- Clearing a Source Hub session now also clears the source CookieJar entries.
- H5 still shows the existing APK-required bridge error instead of attempting unsupported WebView collection.

### Modified Files - Source Hub Android Session Entry Milestone
- `pages/sourceHub/sourceHub.vue`
- `tests/sourceHub.test.mjs`
- `docs/dev/V2_NEXT_STEP_CHANGELOG.md`
- `docs/DESKTOP_V2_DEVELOPMENT_PLAN.md`

### Test Commands - Source Hub Android Session Entry Milestone
- `node tests\sourceHub.test.mjs`
- `node tests\webViewRenderedFetch.test.mjs`
- `Get-ChildItem tests -Filter *.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }`
- `backend\.venv\Scripts\python.exe -m pytest backend\tests -q`
- `node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('pages.json','utf8')); JSON.parse(fs.readFileSync('manifest.json','utf8')); console.log('json config ok')"`
- `git diff --check`

### Acceptance Result - Source Hub Android Session Entry Milestone
- Targeted Source Hub page contract and WebView bridge tests passed.
- Full frontend `.mjs` regression suite passed.
- Backend pytest passed: `58 passed`; only warning was an existing pytest cache directory warning.
- `pages.json` and `manifest.json` parsed successfully.
- `git diff --check` passed; Git only reported LF-to-CRLF working-copy warnings.
- H5 production build completed; build warnings were limited to the existing large uni-h5 bundle warning and outdated Browserslist data notice.
- Desktop H5 self-acceptance at `http://127.0.0.1:8080/#/pages/library/library` returned HTTP 200.
- Source Hub route rendered in Playwright, and the built H5 asset contains the `保存登录 Cookie` entry. The only browser console error was `favicon.ico` 404.

### Known Issues - Source Hub Android Session Entry Milestone
- Desktop H5 cannot actually collect WebView Cookie; it can only verify that the Source Hub entry and unsupported-environment feedback are present.
- Real Cookie collection must be validated later in Android APK with an authorized source and user-controlled login.

### Next Step
- Continue improving Source Hub diagnostics and WebView session bridge readiness on desktop H5. Pause before APK packaging until the phone is connected.

## Date: 2026-06-29

### Completed - Source Hub WebView JS Readiness Diagnostics Milestone
- Added `common/sourceBridgeReadiness.js` to assess WebView / JS bridge readiness independently from the UI.
- The readiness model now distinguishes H5-ready rule JS, APK-required browser DOM JS, missing Android bridge methods, and bridge-ready Android capability.
- Source Hub now shows a `WebView / JS 就绪度` panel with current environment, recommended lane, bridge method status, and blocking reasons.
- Source Hub copy diagnostics now includes bridge readiness data.
- Added `tests/sourceBridgeReadiness.test.mjs` with red/green coverage for browser DOM JS, H5 sandbox JS, and Android bridge-ready scenarios.
- Extended `tests/sourceHub.test.mjs` to cover the new readiness panel contract.

### Modified Files - Source Hub WebView JS Readiness Diagnostics Milestone
- `common/sourceBridgeReadiness.js`
- `pages/sourceHub/sourceHub.vue`
- `tests/sourceBridgeReadiness.test.mjs`
- `tests/sourceHub.test.mjs`
- `docs/dev/V2_NEXT_STEP_CHANGELOG.md`
- `docs/DESKTOP_V2_DEVELOPMENT_PLAN.md`

### Test Commands - Source Hub WebView JS Readiness Diagnostics Milestone
- `node tests\sourceBridgeReadiness.test.mjs`
- `node tests\sourceHub.test.mjs`
- `node tests\sourceCapabilitySessionRouter.test.mjs`
- `node tests\webViewRenderedFetch.test.mjs`
- `node tests\sourceAcceptance.test.mjs`
- `Get-ChildItem tests -Filter *.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }`
- `backend\.venv\Scripts\python.exe -m pytest backend\tests -q`
- `node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('pages.json','utf8')); JSON.parse(fs.readFileSync('manifest.json','utf8')); console.log('json config ok')"`
- `git diff --check`

### Acceptance Result - Source Hub WebView JS Readiness Diagnostics Milestone
- Targeted readiness, Source Hub, capability router, WebView bridge, and source acceptance tests passed.
- Full frontend `.mjs` regression suite passed.
- Backend pytest passed: `58 passed`; only warning was the existing pytest cache directory warning.
- `pages.json` and `manifest.json` parsed successfully.
- `git diff --check` passed; Git only reported LF-to-CRLF working-copy warnings.
- H5 production build completed; build warnings were limited to the existing large uni-h5 bundle warning and outdated Browserslist data notice.
- Desktop H5 self-acceptance at `http://127.0.0.1:8080/#/pages/library/library` returned HTTP 200.
- Playwright confirmed the Source Hub `WebView / JS 就绪度` panel renders. The only browser console error was `favicon.ico` 404.

### Known Issues - Source Hub WebView JS Readiness Diagnostics Milestone
- This stage only diagnoses and displays WebView / JS readiness; it does not execute arbitrary third-party JS in H5.
- Real Android bridge validation still requires APK packaging and a connected phone.
- This does not bypass login, CAPTCHA, paid content, membership restrictions, or anti-crawler controls.

### Next Step
- Continue toward Android WebView bridge validation after desktop H5 remains stable. APK packaging remains paused until the phone is connected.

## Date: 2026-06-29

### Completed - Source Hub WebView Bridge Probe Milestone
- Added `getWebViewBridgeCapabilities()` and `probeWebViewBridge()` to `common/webViewBridge.js`.
- The bridge probe reports whether the runtime exposes rendered fetch, login-page opening, and Cookie-reading methods.
- Source Hub now provides a `检测 Bridge` action inside the `WebView / JS 就绪度` panel.
- H5 bridge probe output clearly lists missing capabilities: `renderedFetch`, `openLogin`, and `readCookie`.
- Source Hub diagnostics copy now includes the latest bridge probe report.
- Added `tests/webViewBridgeProbe.test.mjs` and extended `tests/sourceHub.test.mjs`.

### Modified Files - Source Hub WebView Bridge Probe Milestone
- `common/webViewBridge.js`
- `pages/sourceHub/sourceHub.vue`
- `tests/webViewBridgeProbe.test.mjs`
- `tests/sourceHub.test.mjs`
- `docs/dev/V2_NEXT_STEP_CHANGELOG.md`
- `docs/DESKTOP_V2_DEVELOPMENT_PLAN.md`

### Test Commands - Source Hub WebView Bridge Probe Milestone
- `node tests\webViewBridgeProbe.test.mjs`
- `node tests\sourceHub.test.mjs`
- `node tests\webViewRenderedFetch.test.mjs`
- `node tests\sourceBridgeReadiness.test.mjs`
- `node tests\sourceCapabilitySessionRouter.test.mjs`
- `node tests\sourceAcceptance.test.mjs`
- `Get-ChildItem tests -Filter *.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }`
- `backend\.venv\Scripts\python.exe -m pytest backend\tests -q`
- `node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('pages.json','utf8')); JSON.parse(fs.readFileSync('manifest.json','utf8')); console.log('json config ok')"`
- `git diff --check`

### Acceptance Result - Source Hub WebView Bridge Probe Milestone
- Targeted bridge probe, Source Hub, WebView bridge, readiness, capability router, and source acceptance tests passed.
- Full frontend `.mjs` regression suite passed.
- Backend pytest passed: `58 passed`; only warning was the existing pytest cache directory warning.
- `pages.json` and `manifest.json` parsed successfully.
- `git diff --check` passed; Git only reported LF-to-CRLF working-copy warnings.
- H5 production build completed; build warnings were limited to the existing large uni-h5 bundle warning and outdated Browserslist data notice.
- Desktop H5 self-acceptance at `http://127.0.0.1:8080/#/pages/library/library` returned HTTP 200.
- Playwright confirmed the `检测 Bridge` action renders and reports missing H5 capabilities. The only browser console error was `favicon.ico` 404.

### Known Issues - Source Hub WebView Bridge Probe Milestone
- The bridge probe only checks method exposure; it does not validate a real rendered fetch or real Cookie collection until Android runtime is available.
- H5 cannot expose Android WebView bridge methods.
- This does not bypass login, CAPTCHA, paid content, membership restrictions, or anti-crawler controls.

### Next Step
- Add Android runtime bridge wiring validation when entering the phone-connected milestone flow.

## Date: 2026-06-29

### Completed - Source Hub Rendered Fetch Trial Milestone
- Added `common/sourceRenderedFetchTrial.js` as a focused WebView rendered fetch trial runner.
- The trial runner normalizes URL, wait selector, wait time, timeout, Cookie, User-Agent, and Referer before calling the existing WebView bridge.
- The trial report now distinguishes invalid request, unsupported H5 bridge, failed WebView render, and passed render states.
- Source Hub now includes a `Rendered Fetch 试运行` section inside the `WebView / JS 就绪度` panel.
- Source Hub users can enter a render URL and optional wait selector, run a rendered fetch trial, and see status, message, elapsed time, final URL, and HTML length.
- Source Hub diagnostics copy now includes the latest rendered fetch trial report.
- Added `tests/sourceRenderedFetchTrial.test.mjs` and extended `tests/sourceHub.test.mjs`.

### Modified Files - Source Hub Rendered Fetch Trial Milestone
- `common/sourceRenderedFetchTrial.js`
- `pages/sourceHub/sourceHub.vue`
- `tests/sourceRenderedFetchTrial.test.mjs`
- `tests/sourceHub.test.mjs`
- `docs/dev/V2_NEXT_STEP_CHANGELOG.md`
- `docs/DESKTOP_V2_DEVELOPMENT_PLAN.md`

### Test Commands - Source Hub Rendered Fetch Trial Milestone
- `node tests\sourceRenderedFetchTrial.test.mjs`
- `node tests\sourceHub.test.mjs`
- `node tests\webViewBridgeProbe.test.mjs`
- `node tests\webViewRenderedFetch.test.mjs`
- `node tests\sourceBridgeReadiness.test.mjs`
- `node tests\sourceCapabilitySessionRouter.test.mjs`
- `node tests\sourceAcceptance.test.mjs`
- `Get-ChildItem tests -Filter *.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }`
- `backend\.venv\Scripts\python.exe -m pytest backend\tests -q`
- `node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('pages.json','utf8')); JSON.parse(fs.readFileSync('manifest.json','utf8')); console.log('json config ok')"`
- `git diff --check`

### Acceptance Result - Source Hub Rendered Fetch Trial Milestone
- Targeted rendered fetch trial, Source Hub, WebView bridge probe, WebView rendered fetch, readiness, capability router, and source acceptance tests passed.
- Full frontend `.mjs` regression suite passed.
- Backend pytest passed: `58 passed`; only warning was the existing pytest cache directory warning.
- `pages.json` and `manifest.json` parsed successfully.
- `git diff --check` passed; Git only reported LF-to-CRLF working-copy warnings.
- H5 production build completed; build warnings were limited to the existing large uni-h5 bundle warning and outdated Browserslist data notice.
- Desktop H5 self-acceptance at `http://127.0.0.1:8080/#/pages/library/library` returned HTTP 200.
- Playwright confirmed the `Rendered Fetch 试运行` panel renders and empty URL trial reports `请求无效`. The only browser console error was `favicon.ico` 404.

### Known Issues - Source Hub Rendered Fetch Trial Milestone
- H5 can validate the trial UI and invalid/unsupported states, but cannot perform real WebView rendering.
- Real rendered DOM validation still requires Android WebView bridge runtime.
- This does not execute arbitrary third-party JS in H5 and does not bypass login, CAPTCHA, paid content, membership restrictions, or anti-crawler controls.

### Next Step
- Continue by wiring Android runtime rendered fetch validation into this same trial entry when phone validation starts.

## Date: 2026-06-29

### Completed - Source Hub Rendered Fetch Trial Target Milestone
- Added `buildRenderedFetchTrialTarget()` to derive a rendered fetch trial target from the current source definition.
- The target picker prefers `exploreUrl`, then `searchUrl`, then `loginUrl`, then `bookSourceUrl`, so list-rendering pages are tested before basic home-page access.
- Search trial URLs now replace `{{key}}`, `{{keyword}}`, `{{searchKey}}`, and single-brace variants with the active keyword.
- Trial wait selectors are derived from `ruleExplore.bookList` or `ruleSearch.bookList` when available.
- Source Hub now shows the recommended target source and reason, with an `应用推荐` action to fill the trial URL and selector.
- Diagnostics copy now includes both the recommended rendered fetch target and the latest rendered fetch trial report.
- Extended `tests/sourceRenderedFetchTrial.test.mjs` and `tests/sourceHub.test.mjs`.

### Modified Files - Source Hub Rendered Fetch Trial Target Milestone
- `common/sourceRenderedFetchTrial.js`
- `pages/sourceHub/sourceHub.vue`
- `tests/sourceRenderedFetchTrial.test.mjs`
- `tests/sourceHub.test.mjs`
- `docs/dev/V2_NEXT_STEP_CHANGELOG.md`
- `docs/DESKTOP_V2_DEVELOPMENT_PLAN.md`

### Test Commands - Source Hub Rendered Fetch Trial Target Milestone
- `node tests\sourceRenderedFetchTrial.test.mjs`
- `node tests\sourceHub.test.mjs`
- `node tests\webViewBridgeProbe.test.mjs`
- `node tests\webViewRenderedFetch.test.mjs`
- `node tests\sourceBridgeReadiness.test.mjs`
- `node tests\sourceCapabilitySessionRouter.test.mjs`
- `node tests\sourceAcceptance.test.mjs`
- `Get-ChildItem tests -Filter *.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }`
- `backend\.venv\Scripts\python.exe -m pytest backend\tests -q`
- `node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('pages.json','utf8')); JSON.parse(fs.readFileSync('manifest.json','utf8')); console.log('json config ok')"`
- `git diff --check`

### Acceptance Result - Source Hub Rendered Fetch Trial Target Milestone
- Targeted rendered fetch trial target and Source Hub contract tests passed.
- Related WebView bridge probe, WebView rendered fetch, readiness, capability router, and source acceptance tests passed.
- Full frontend `.mjs` regression suite passed.
- Backend pytest passed: `58 passed`; only warning was the existing pytest cache directory warning.
- `pages.json` and `manifest.json` parsed successfully.
- `git diff --check` passed; Git only reported LF-to-CRLF working-copy warnings.
- Existing H5 production build artifact was checked and the built Source Hub bundle contains the `推荐目标` and `应用推荐` UI text.
- Desktop H5 self-acceptance at `http://127.0.0.1:8080/#/pages/library/library` returned HTTP 200.

### Known Issues - Source Hub Rendered Fetch Trial Target Milestone
- H5 can validate the recommendation UI and request-building path, but real rendered DOM validation still depends on Android WebView bridge runtime.
- The recommended target is a best-effort choice from source rules; it does not guarantee a third-party site will allow access or render without login, CAPTCHA, membership, paid-content, or anti-crawler controls.

### Next Step
- Continue toward Android runtime validation by connecting this recommended target to the phone-side rendered fetch bridge once the milestone phone flow starts.

## Date: 2026-06-29

### Completed - Android WebView Bridge Profile Contract Milestone
- Added a native `getBridgeInfo()` method to the Android `NovelReaderWebViewParser` bridge.
- The bridge profile reports `contractVersion`, `runtime`, `platform`, supported features, and exposed method names.
- `getWebViewBridgeCapabilities()` now reads the runtime profile when available and falls back to method detection in H5.
- `openSourceLogin()` and `readSourceLoginCookie()` now depend on their own bridge capabilities instead of incorrectly requiring rendered fetch support.
- Source Hub bridge probing now shows profile contract information and uses probe capabilities in the readiness calculation.
- Added static Android shell contract coverage with `tests/androidWebViewBridgeContract.test.mjs`.

### Modified Files - Android WebView Bridge Profile Contract Milestone
- `android-webview-shell/src/com/novelreader/v1/MainActivity.java`
- `common/webViewBridge.js`
- `pages/sourceHub/sourceHub.vue`
- `tests/androidWebViewBridgeContract.test.mjs`
- `tests/webViewBridgeProbe.test.mjs`
- `tests/sourceHub.test.mjs`
- `docs/dev/V2_NEXT_STEP_CHANGELOG.md`
- `docs/DESKTOP_V2_DEVELOPMENT_PLAN.md`

### Test Commands - Android WebView Bridge Profile Contract Milestone
- `node tests\androidWebViewBridgeContract.test.mjs`
- `node tests\webViewBridgeProbe.test.mjs`
- `node tests\webViewRenderedFetch.test.mjs`
- `node tests\sourceHub.test.mjs`

### Acceptance Result - Android WebView Bridge Profile Contract Milestone
- Targeted Android bridge contract, WebView bridge probe, rendered fetch bridge, and Source Hub contract tests passed.
- The desktop H5 path can still validate missing bridge capability states.
- A future Android runtime can now prove that the injected bridge matches the expected profile before running rendered fetch or Cookie collection trials.

### Known Issues - Android WebView Bridge Profile Contract Milestone
- This validates the Java/JS bridge contract statically and through mocked runtime profiles; real device execution still needs the phone-connected milestone flow.
- The profile does not bypass login, CAPTCHA, paid content, membership restrictions, or anti-crawler controls.

### Next Step
- Use this bridge profile as the first gate in the Android rendered fetch and session collection validation flow.

## Date: 2026-06-29

### Completed - Rendered Fetch Bridge Profile Gate Milestone
- Rendered fetch trial now probes the WebView bridge before starting a render request.
- Missing rendered fetch bridge support returns an `unsupported` report with the full `bridgeProbe` payload.
- Successful rendered fetch trial reports now include the bridge probe and runtime profile used for the run.
- Source Hub rendered fetch trial output now shows the bridge gate status, missing capability list, and runtime profile when available.
- Extended rendered fetch trial and Source Hub tests to cover the new gate report.

### Modified Files - Rendered Fetch Bridge Profile Gate Milestone
- `common/sourceRenderedFetchTrial.js`
- `pages/sourceHub/sourceHub.vue`
- `tests/sourceRenderedFetchTrial.test.mjs`
- `tests/sourceHub.test.mjs`
- `docs/dev/V2_NEXT_STEP_CHANGELOG.md`
- `docs/DESKTOP_V2_DEVELOPMENT_PLAN.md`

### Test Commands - Rendered Fetch Bridge Profile Gate Milestone
- `node tests\sourceRenderedFetchTrial.test.mjs`
- `node tests\sourceHub.test.mjs`
- `node tests\webViewBridgeProbe.test.mjs`

### Acceptance Result - Rendered Fetch Bridge Profile Gate Milestone
- Targeted rendered fetch trial, Source Hub, and WebView bridge probe tests passed.
- H5 unsupported state now carries actionable bridge missing-capability evidence instead of only a generic APK-required message.

### Known Issues - Rendered Fetch Bridge Profile Gate Milestone
- The gate proves bridge capability exposure, not target-site accessibility or successful third-party DOM rendering.
- Real rendered DOM validation still depends on the Android WebView runtime and a user-authorized source/session where required.

### Next Step
- Extend the same profile-gated report shape to Android login/session collection so rendered fetch and Cookie capture share one diagnostics model.
