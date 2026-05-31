# Real Source Mystic Dark Design

Date: 2026-05-31

## Goal

Move the novel reader closer to a real source-decoding app while upgrading the primary UI direction to a premium dark and mysterious style.

The first implementation pass must improve the existing app instead of replacing its architecture. The current `uni-app + Vue 2 + FastAPI + Android WebView shell` structure stays in place. The work should make the Android APK and H5 preview better at demonstrating a real reading flow:

1. Import or browse a real source repository.
2. Inspect source compatibility and test search.
3. Search a novel through available sources.
4. Open book detail, load table of contents, decode chapter content, cache readable text.
5. Read with clear retry, cache, source, and failure states.

The visual direction is "premium dark, mysterious, restrained". The app should feel like a polished decoding tool for night reading, not a light default template.

## Non-Goals

- Do not execute third-party source JavaScript rules.
- Do not bypass login, cookie, payment, membership, advertisement, or site access controls.
- Do not bundle copyrighted novel content in the repository.
- Do not replace the backend or rewrite the app shell.
- Do not introduce a large UI framework or dependency only for this pass.
- Do not copy the Open Design repository UI directly. Use it as inspiration for tokenized design systems, strong hierarchy, and artifact-quality polish.

## Product Scope

### Source Management

The source page remains the control center for imported and built-in sources.

It should make source status legible at a glance:

- compatible or incompatible
- enabled or disabled
- untested, passed, failed, or skipped
- search, detail, table-of-contents, and content rule readiness
- last test message and result count

The existing single-source test, batch test, complete reading flow test, source repository drawer, clipboard import, JSON file import, QR import, and TXT import remain. The first pass should improve clarity and route users toward the real flow: import source, test it, search with it, open result, read chapter.

### Discovery Search

The discovery page should keep three modes: cloud, source, and local.

For external source search, it should only use enabled and test-passed compatible sources. The UI should show which sources participated in the latest search and should display per-source failures without hiding successful results.

Empty and blocked states should tell the user the next concrete action:

- no usable source: go to source page and run tests
- search timeout: try fewer sources or test one source
- source rule failure: inspect source detail
- no result: change keyword or source

### Book Detail And Reading

The book detail and reader should make real decoding visible:

- chapter list loaded from the source
- chapter cache state shown as cached, loaded, failed, or pending
- chapter decoding failure includes retry and source information
- reader continues to support local TXT, online source, and backend books
- cached chapters remain readable when available

The first pass should add or improve UI affordances for retry, cache, and source state without changing the core data model more than necessary.

### Android WebView Request Support

The Android WebView shell should support real external GET requests from the packaged H5 app where possible, adding CORS-friendly responses for non-local HTTP/HTTPS requests.

Safety boundaries:

- only intercept GET
- do not intercept localhost or private network targets
- preserve local asset interception
- avoid forwarding unsafe headers such as host, origin, referer, and accept-encoding
- use short timeouts
- return null on failure so WebView default behavior remains available

The H5 source engine should only rewrite yck repository requests to local dev proxy paths when the page protocol is `http:` or `https:`. File-based Android packaged pages should keep real URLs so the WebView shell can intercept them.

## Visual Design

### Theme Direction

The default app theme should become a premium mysterious dark theme. Working name: `玄夜`.

Core palette:

- deep ink background: near black blue and charcoal
- panel surface: translucent graphite
- primary accent: spectral teal
- secondary accent: muted violet
- warning/action accent: antique gold or ember
- borders: low-opacity cool light
- text: warm off-white for primary, blue-gray for secondary

The palette must avoid a one-note purple or plain slate look. Purple is a supporting accent, not the dominant surface.

### Component Language

Use consistent tokens from `common/appTheme.js`:

- app background
- top surface
- panel surface
- input surface
- border
- shadow
- accent colors
- reader control surface

Cards should stay compact with moderate radii. The app should feel operational and readable, not like a marketing landing page. No decorative blobs, floating orbs, or large gradients as filler.

### Page Application

First-pass visual polish applies to:

- bookshelf
- discovery/search
- source management
- source market
- reader chrome and panels

Reader正文 themes should remain readable and user-controlled. The global dark app shell can be premium; the actual reading surface must preserve comfort and accessibility.

## Data Flow

### Source Import

User input can be JSON, URL, yuedu/legado link, source repository page, QR payload, clipboard text, or local JSON file.

Flow:

1. Normalize input.
2. Detect payload type.
3. Fetch source JSON when needed.
4. Parse into normalized source configs.
5. Save user sources and update settings.
6. Show import stats: imported, updated, incompatible.

### Source Testing

Flow:

1. Check compatibility.
2. Check enabled state unless explicitly allowed.
3. Run search with timeout.
4. Persist last test result.
5. Expose status to source page and discovery search.

Complete reading flow test adds:

1. search
2. book info
3. table of contents
4. content decode
5. shelf add

### Reading

Flow:

1. Reader loads local, backend, or online book.
2. Online/backend chapters without content request source content.
3. Successful content is cached.
4. Reader rebuilds pages from cached or loaded content.
5. Failures show retry and source-aware messages.

## Error Handling

Errors should be user-facing and specific:

- incompatible source rules: explain JS, cookie, login, or WebView dependency
- network failure: show retry and source name
- empty search result: distinguish no result from request failure
- empty table of contents: suggest changing source
- empty content: suggest retry or changing source
- Android external request failure: log and fall back to default WebView handling

The UI should avoid generic "failed" labels where a useful next action is known.

## Testing

The first implementation pass should add or update tests before production code changes.

Frontend utility tests:

- source engine keeps yck proxy rewrite on `http:` and `https:`
- source engine does not rewrite external requests under `file:`
- source diagnostics expose compatibility and readiness clearly
- discovery only selects enabled, compatible, test-passed sources
- batch or full reading flow test preserves stage-level failures
- theme tokens include the new dark premium theme as default

Android shell text tests:

- WebView shell contains external request interception
- local/private hosts are not proxied
- CORS response headers are added
- local asset interception still exists

Manual verification after tests:

- run all `.mjs` frontend tests
- parse `pages.json` and `manifest.json`
- if backend changes are made, run backend pytest
- start H5 preview or APK flow when feasible and inspect key pages for non-overlap and legible dark UI

## Acceptance Criteria

The first pass is complete when current evidence shows:

- the app has a default premium dark mysterious theme implemented through theme tokens
- bookshelf, discovery, source management, source market, and reader chrome use the theme consistently
- source import, source testing, search, detail, TOC, content decode, cache, and reader failure states remain functional
- Android packaged file protocol no longer forces yck proxy paths
- Android WebView shell can intercept safe external GET requests with CORS headers
- automated tests cover the changed behavior
- existing user worktree changes are preserved

## Implementation Order

1. Add failing tests for theme default and request URL behavior.
2. Add failing tests for source availability/readiness behavior if current coverage is weak.
3. Implement theme token changes and focused UI polish.
4. Finish Android/H5 external request support already present in the worktree if tests expose gaps.
5. Update source/search/reader state affordances where they are missing.
6. Run verification commands and document remaining manual checks.
