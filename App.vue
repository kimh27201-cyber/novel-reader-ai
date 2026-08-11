<script>
import { registerNovelReaderDeepLinkListener } from './common/deepLinkImport.js'
import { applyAppThemeChrome } from './common/appTheme.js'
import { applyMotionPreference, installNavigationMotion, isMotionReduced } from './common/motion.js'
import { installTimeAwareness, refreshTimeAwareness } from './common/timeAwareness.js'
import { applyPerformanceProfile, refreshPerformanceProfile } from './common/performanceProfile.js'
import apiClient from './common/apiClient.js'
import { syncOfflineLibrary } from './common/backendLibrary.js'

export default {
  onLaunch() {
    applyAppThemeChrome()
    const motionState = applyMotionPreference()
    applyPerformanceProfile({ motionReduced: motionState.reduced })
    installNavigationMotion()
    installTimeAwareness()
    registerNovelReaderDeepLinkListener(globalThis, { storage: uni, navigator: uni })
    if (typeof uni !== 'undefined' && typeof uni.onNetworkStatusChange === 'function') {
      uni.onNetworkStatusChange(state => {
        if (state && state.isConnected && apiClient.getToken()) {
          syncOfflineLibrary({ reason: 'network-restored' }).catch(() => {})
        }
      })
    }
  },
  onShow() {
    refreshTimeAwareness()
    refreshPerformanceProfile({ motionReduced: isMotionReduced() })
    if (apiClient.getToken()) syncOfflineLibrary({ reason: 'app-show' }).catch(() => {})
  }
}
</script>

<style>
page {
  min-height: 100%;
  color: var(--app-text, #20352f);
  background: var(--app-stage, #e4efeb);
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
}

/* #ifdef H5 */
html,
body {
  min-height: 100%;
  background: var(--app-stage, #f4fbf8);
}

uni-page-body {
  position: relative;
  max-width: 1120px;
  min-height: 100vh;
  margin: 0 auto;
  overflow-x: hidden;
  background: var(--app-stage, #f4fbf8);
}

uni-tabbar .uni-tabbar {
  left: 50% !important;
  right: auto !important;
  width: min(100vw, 1120px) !important;
  max-width: 1120px;
  overflow: hidden;
  border-radius: 22rpx 22rpx 0 0;
  box-shadow: var(--app-floating-shadow, 0 -16rpx 54rpx rgba(42, 62, 57, 0.16));
  transform: translateX(-50%);
}

uni-tabbar .uni-tabbar__item img:not([src$="-active.png"]) {
  filter: var(--app-tabbar-icon-filter, none);
  opacity: var(--app-tabbar-icon-opacity, 0.78);
}

uni-tabbar {
  display: none !important;
}
/* #endif */

/* H5 preview shell: keep page roots flush with the viewport edges. */

.app-page,
.reader-page {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
}

.tab-page-shell {
  min-height: 100vh;
  overflow-x: hidden;
  color: var(--app-text);
  background: var(--app-bg);
}

.tab-page-content {
  position: relative;
}

.app-page {
  min-height: 100vh;
  overflow-x: hidden;
  color: var(--app-text);
  background: var(--app-bg);
  animation: app-page-enter var(--app-motion-duration-normal) var(--app-motion-smooth) both;
  will-change: opacity, transform;
}

/*
 * Reusable UI-copy alignment contract.
 * Apply `ui-text-centered` to a page root, `ui-text-stack` to vertical copy
 * groups and `ui-text-row` to flex rows. Reader prose and form controls stay
 * outside this opt-in contract so continuous reading and input are unaffected.
 */
.ui-text-centered,
.ui-text-centered button {
  text-align: center;
}

.ui-text-centered .ui-text-stack {
  text-align: center;
}

.ui-text-centered .ui-text-row {
  justify-content: center;
  text-align: center;
}

.app-page.secondary {
  padding-top: 58rpx;
}

.app-shell-panel {
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-card-radius, 18rpx);
  background: var(--app-panel-strong);
  box-shadow: var(--app-shadow);
}

.app-floating-panel {
  position: fixed;
  left: 50% !important;
  right: auto !important;
  width: min(94vw, 1048px);
  max-width: 1048px;
  transform: translateX(-50%);
  border: 1rpx solid var(--app-border);
  background: var(--app-panel-strong);
  box-shadow: var(--app-floating-shadow);
}

.app-action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 64rpx;
  border-radius: var(--app-control-radius, 16rpx);
  color: var(--app-on-accent);
  background: var(--app-accent);
}

.app-page button,
.reader-page button,
.glass-tabbar-item {
  -webkit-tap-highlight-color: transparent;
  transition: transform var(--app-touch-feedback-duration) ease, opacity var(--app-touch-feedback-duration) ease, background var(--app-motion-duration-normal) var(--app-motion-smooth), border-color var(--app-motion-duration-normal) var(--app-motion-smooth);
}

.app-page button:active,
.reader-page button:active,
.glass-tabbar-item:active {
  opacity: 0.84;
  transform: scale(var(--app-touch-feedback-scale));
}

.app-page button:focus-visible,
.reader-page button:focus-visible,
.glass-tabbar-item:focus-visible {
  outline: 2rpx solid var(--app-accent);
  outline-offset: 3rpx;
}

view,
text,
button,
input {
  box-sizing: border-box;
}

button {
  padding: 0;
  margin: 0;
  line-height: 1;
  background: transparent;
  border-radius: var(--app-control-radius, 14rpx);
}

button::after {
  border: none;
  border-radius: inherit;
}

input, textarea {
  border-radius: var(--app-control-radius, 12rpx);
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  min-height: 80rpx;
}

.title-block {
  min-width: 0;
}

.eyebrow {
  color: var(--app-accent-3);
  font-size: 24rpx;
  line-height: 34rpx;
}

.screen-title {
  margin-top: 4rpx;
  color: var(--app-text);
  font-size: 48rpx;
  font-weight: 700;
  line-height: 60rpx;
}

.icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76rpx;
  height: 76rpx;
  border-radius: 999rpx;
  color: var(--app-text);
  border: 1rpx solid var(--app-border);
  background: var(--app-panel);
  box-shadow: var(--app-glow);
}

.tap {
  opacity: 0.72;
}

@keyframes neonFlow {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 200% 50%;
  }
}

@keyframes app-page-enter {
  from {
    opacity: 0;
    transform: translate3d(var(--app-page-enter-x, 18rpx), 0, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes app-tab-page-enter {
  from {
    opacity: 0.88;
    transform: translate3d(var(--app-tab-enter-x, 12rpx), 0, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes app-tab-page-enter-reduced {
  from { opacity: 0.92; }
  to { opacity: 1; }
}

html[data-app-motion-direction="back"] {
  --app-page-enter-x: -14rpx;
}

html[data-app-motion-kind="tab"] {
  --app-page-enter-x: 0;
}

html[data-app-motion-kind="tab"] .app-page {
  animation: app-tab-page-enter 180ms var(--app-motion-standard) both;
  will-change: opacity, transform;
}

.app-page.app-tab-enter {
  animation: app-tab-page-enter 180ms var(--app-motion-standard) both;
  will-change: opacity, transform;
}

.app-page.app-tab-enter-forward {
  --app-tab-enter-x: 12rpx;
}

.app-page.app-tab-enter-back {
  --app-tab-enter-x: -12rpx;
}

.app-motion-overlay {
  animation: app-overlay-enter var(--app-motion-duration-fast) var(--app-motion-standard) both;
}

.app-motion-sheet {
  animation: app-sheet-enter var(--app-motion-duration-normal) var(--app-motion-spring) both;
}

.app-motion-dialog {
  animation: app-dialog-enter var(--app-motion-duration-normal) var(--app-motion-smooth) both;
}

/* Theme signatures only appear after a real confirmation or async result.
   They deliberately avoid ambient loops so scrolling and reading remain quiet. */
.app-motion-feedback {
  animation: app-feedback-enter var(--app-motion-duration-fast) var(--app-motion-standard) both;
  will-change: transform, opacity;
}

.theme-xuanye .app-motion-feedback {
  animation-name: theme-xuanye-feedback;
}

.theme-candy .app-motion-feedback {
  animation-name: theme-candy-feedback;
}

.theme-sakura .app-motion-feedback {
  animation-name: theme-sakura-feedback;
}

.theme-cyber .app-motion-feedback {
  animation-name: theme-cyber-feedback;
}

.theme-noirGold .app-motion-feedback {
  animation-name: theme-noir-gold-feedback;
}

@keyframes app-overlay-enter {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes app-sheet-enter {
  from { opacity: 0; transform: translate3d(0, 34rpx, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes app-dialog-enter {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes app-feedback-enter {
  from { opacity: 0; transform: translate3d(0, 8rpx, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes theme-xuanye-feedback {
  from { opacity: 0; transform: translate3d(-10rpx, 0, 0); }
  55% { opacity: 1; transform: translate3d(3rpx, 0, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes theme-candy-feedback {
  from { opacity: 0; transform: rotate(-3deg) scale(0.92); }
  68% { opacity: 1; transform: rotate(1deg) scale(1.025); }
  to { opacity: 1; transform: rotate(0) scale(1); }
}

@keyframes theme-sakura-feedback {
  from { opacity: 0; transform: translate3d(16rpx, 0, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

@keyframes theme-cyber-feedback {
  from { opacity: 0; transform: translate3d(0, -8rpx, 0) scaleX(0.92); }
  to { opacity: 1; transform: translate3d(0, 0, 0) scaleX(1); }
}

@keyframes theme-noir-gold-feedback {
  from { opacity: 0; transform: translate3d(-8rpx, 0, 0) scaleX(0.96); transform-origin: left center; }
  to { opacity: 1; transform: translate3d(0, 0, 0) scaleX(1); transform-origin: left center; }
}

html[data-app-motion="reduced"] .app-page,
html[data-app-motion="reduced"] .reader-page,
html[data-app-motion="reduced"] .glass-tabbar,
html[data-app-motion="reduced"] .app-page *,
html[data-app-motion="reduced"] .reader-page *,
html[data-app-motion="reduced"] .glass-tabbar * {
  animation-duration: 1ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 1ms !important;
}

@media (prefers-reduced-motion: reduce) {
  .app-page,
  .reader-page,
  .glass-tabbar,
  .app-page *,
  .reader-page *,
  .glass-tabbar * {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 1ms !important;
  }
}

html[data-app-motion="reduced"] .app-page.app-tab-enter {
  animation: app-tab-page-enter-reduced 80ms linear both !important;
  will-change: opacity;
}

/* Theme changes are one whole-screen snapshot, so surfaces never recolor in batches. */
::view-transition-group(root) {
  animation-duration: var(--app-theme-morph-duration, 220ms);
  animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}

::view-transition-old(root) {
  animation: app-theme-crossfade-out var(--app-theme-morph-duration, 220ms) cubic-bezier(0.22, 1, 0.36, 1) both;
  mix-blend-mode: normal;
}

::view-transition-new(root) {
  animation: app-theme-crossfade-in var(--app-theme-morph-duration, 220ms) cubic-bezier(0.22, 1, 0.36, 1) both;
  mix-blend-mode: normal;
}

html.app-theme-morph-fallback-a body {
  animation: app-theme-fallback-in-a var(--app-theme-morph-duration, 120ms) ease-out both;
  will-change: opacity;
}

html.app-theme-morph-fallback-b body {
  animation: app-theme-fallback-in-b var(--app-theme-morph-duration, 120ms) ease-out both;
  will-change: opacity;
}

@keyframes app-theme-crossfade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes app-theme-crossfade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes app-theme-fallback-in-a {
  from { opacity: 0.88; }
  to { opacity: 1; }
}

@keyframes app-theme-fallback-in-b {
  from { opacity: 0.88; }
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .app-page.app-tab-enter {
    animation: app-tab-page-enter-reduced 80ms linear both !important;
    will-change: opacity;
  }

  ::view-transition-group(root),
  ::view-transition-old(root),
  ::view-transition-new(root),
  html.app-theme-morph-fallback-a body,
  html.app-theme-morph-fallback-b body {
    animation-duration: 80ms !important;
  }
}

/* Decoder ink theme tokens */
.ink-script {
  font-family: "KaiTi", "STKaiti", "FZKai-Z03", "PingFang SC", "Microsoft YaHei", cursive;
  letter-spacing: 0;
}

/* Theme identity layer: shared information architecture, distinctly different reading worlds. */
.app-page,
.reader-page,
.glass-tabbar {
  font-family: var(--app-body-font);
}

.app-page .eyebrow,
.app-page .shelf-eyebrow,
.app-page .source-page-eyebrow,
.app-page .history-kicker,
.app-page .import-hub-eyebrow,
.reader-page .reader-progress-mark,
.reader-page .top-title text {
  font-family: var(--app-utility-font);
  letter-spacing: var(--app-heading-tracking);
}

.app-page .title,
.app-page .screen-title,
.app-page .shelf-filter-active,
.app-page .source-page-title,
.app-page .backend-title,
.app-page .panel-title,
.reader-page .top-title > view,
.reader-page .panel-title {
  font-family: var(--app-display-font);
  letter-spacing: var(--app-heading-tracking);
}

.app-page .cover-wrap,
.app-page .cover-image,
.app-page .cover-fallback,
.app-page .sheet-cover,
.app-page .sheet-cover-image {
  border-radius: var(--app-cover-radius);
}

.theme-xuanye.decoder-page .top-zone,
.theme-xuanye.decoder-source-page .source-discover-top,
.theme-xuanye.discover-page .top-zone,
.theme-xuanye.profile-page .top-zone {
  position: relative;
  padding-bottom: 18rpx;
}

.theme-xuanye.decoder-page .top-zone::after,
.theme-xuanye.decoder-source-page .source-discover-top::after,
.theme-xuanye.discover-page .top-zone::after,
.theme-xuanye.profile-page .top-zone::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 1rpx;
  content: '';
  background: linear-gradient(90deg, transparent, var(--app-accent), transparent);
  opacity: 0.62;
}

.theme-xuanye.decoder-page .book-row,
.theme-xuanye.decoder-source-page .installed-source-row,
.theme-xuanye.discover-page .search-panel,
.theme-xuanye.discover-page .tip-card,
.theme-xuanye.profile-page .backend-card,
.theme-xuanye.profile-page .setting-item {
  border-left: 3rpx solid var(--app-accent);
  box-shadow: var(--app-card-outline), var(--app-shadow);
}

.theme-xuanye.decoder-page .cover-spine {
  width: 5rpx;
  background: linear-gradient(180deg, var(--app-accent), var(--app-accent-2));
  box-shadow: 0 0 16rpx rgba(103, 255, 242, 0.72);
}

.theme-xuanye.reader-page .reading-surface {
  background-image: var(--app-reader-texture);
  background-blend-mode: screen;
}

.theme-xuanye.reader-page .reader-progress-rail-fill,
.theme-xuanye.reader-page .chapter-track-fill {
  background: linear-gradient(90deg, var(--app-accent-2), var(--app-accent), var(--app-accent-3));
  background-size: 200% 100%;
  animation: themeSignalFlow 4s linear infinite;
}

.theme-xuanye.glass-tabbar .glass-tabbar-shell {
  box-shadow: 0 -12rpx 38rpx rgba(0, 0, 0, 0.42), inset 0 1rpx 0 rgba(103, 255, 242, 0.12);
}

.theme-xuanye.glass-tabbar .glass-tabbar-indicator {
  border-color: rgba(103, 255, 242, 0.52);
  box-shadow: 0 0 22rpx rgba(103, 255, 242, 0.18), inset 0 0 18rpx rgba(103, 255, 242, 0.08);
}

.theme-candy.decoder-page .book-row,
.theme-candy.decoder-source-page .source-import-hub,
.theme-candy.decoder-source-page .installed-source-row,
.theme-candy.discover-page .search-panel,
.theme-candy.discover-page .tip-card,
.theme-candy.discover-page .history-strip,
.theme-candy.profile-page .backend-card,
.theme-candy.profile-page .setting-item,
.theme-candy.profile-page .theme-panel {
  border-width: var(--app-card-border-width);
  border-color: rgba(255, 122, 89, 0.48);
  box-shadow: var(--app-card-outline), var(--app-shadow);
}

.theme-candy.decoder-page .shelf-swipe-row:nth-child(3n + 1),
.theme-candy.decoder-source-page .import-hub-action:nth-child(odd),
.theme-candy.discover-page .history-chip:nth-child(odd) {
  transform: rotate(-0.55deg);
}

.theme-candy.decoder-page .shelf-swipe-row:nth-child(3n + 2),
.theme-candy.decoder-source-page .import-hub-action:nth-child(even),
.theme-candy.discover-page .history-chip:nth-child(even) {
  transform: rotate(0.55deg);
}

.theme-candy.decoder-page .cover-wrap,
.theme-candy.decoder-source-page .source-row-icon,
.theme-candy.discover-page .state-mark,
.theme-candy.profile-page .setting-icon {
  border: 2rpx solid rgba(52, 42, 50, 0.78);
  box-shadow: 3rpx 4rpx 0 rgba(85, 199, 232, 0.42);
}

.theme-candy.decoder-page .cover-wrap::after {
  position: absolute;
  top: -7rpx;
  right: -7rpx;
  width: 28rpx;
  height: 28rpx;
  border: 2rpx solid rgba(52, 42, 50, 0.78);
  border-radius: 50%;
  content: '';
  background: var(--app-accent-3);
  box-shadow: 2rpx 3rpx 0 rgba(52, 42, 50, 0.18);
}

.theme-candy.discover-page .search-button,
.theme-candy.profile-page .theme-apply-button,
.theme-candy.profile-page .backend-button.primary {
  border: 2rpx solid rgba(52, 42, 50, 0.78);
  box-shadow: 4rpx 5rpx 0 rgba(52, 42, 50, 0.20);
}

.theme-candy.glass-tabbar .glass-tabbar-shell {
  border-width: 2rpx;
  border-color: rgba(52, 42, 50, 0.68);
  border-radius: 32rpx;
  background: rgba(255, 253, 244, 0.96);
}

.theme-candy.glass-tabbar .glass-tabbar-indicator {
  border: 2rpx solid rgba(52, 42, 50, 0.74);
  box-shadow: 3rpx 4rpx 0 rgba(85, 199, 232, 0.46);
}

.theme-sakura.decoder-page .book-row,
.theme-sakura.decoder-source-page .source-import-hub,
.theme-sakura.decoder-source-page .installed-source-row,
.theme-sakura.discover-page .search-panel,
.theme-sakura.discover-page .tip-card,
.theme-sakura.discover-page .history-strip,
.theme-sakura.profile-page .backend-card,
.theme-sakura.profile-page .setting-item,
.theme-sakura.profile-page .theme-panel {
  border-color: rgba(194, 94, 140, 0.34);
  box-shadow: var(--app-card-outline), 0 14rpx 36rpx rgba(151, 91, 126, 0.10);
}

.theme-sakura.decoder-page .book-row,
.theme-sakura.decoder-source-page .installed-source-row,
.theme-sakura.profile-page .setting-item {
  position: relative;
  overflow: hidden;
}

.theme-sakura.decoder-page .book-row::after,
.theme-sakura.decoder-source-page .installed-source-row::after,
.theme-sakura.profile-page .setting-item::after {
  position: absolute;
  top: 0;
  right: 34rpx;
  width: 32rpx;
  height: 14rpx;
  content: '';
  background: linear-gradient(90deg, var(--app-accent), var(--app-accent-2));
  opacity: 0.78;
}

.theme-sakura.discover-page .mode.active,
.theme-sakura.discover-page .search-button,
.theme-sakura.profile-page .theme-apply-button {
  background: linear-gradient(100deg, var(--app-accent), var(--app-accent-2));
}

.theme-sakura.reader-page .reading-surface {
  background-image: var(--app-reader-texture);
  background-blend-mode: multiply;
}

.theme-sakura.reader-page .reader-progress-rail-fill,
.theme-sakura.reader-page .chapter-track-fill {
  background: linear-gradient(90deg, var(--app-accent), var(--app-accent-2));
}

.theme-sakura.glass-tabbar .glass-tabbar-shell {
  border-color: rgba(194, 94, 140, 0.28);
  background: rgba(255, 248, 252, 0.86);
}

.theme-sakura.glass-tabbar .glass-tabbar-indicator {
  border-radius: 999rpx;
  background: linear-gradient(100deg, rgba(233, 122, 174, 0.22), rgba(165, 139, 231, 0.20));
}

.theme-cyber.decoder-page .book-row,
.theme-cyber.decoder-source-page .source-import-hub,
.theme-cyber.decoder-source-page .installed-source-row,
.theme-cyber.discover-page .search-panel,
.theme-cyber.discover-page .tip-card,
.theme-cyber.discover-page .history-strip,
.theme-cyber.profile-page .backend-card,
.theme-cyber.profile-page .setting-item,
.theme-cyber.profile-page .theme-panel,
.theme-cyber.reader-page .top-chrome,
.theme-cyber.reader-page .bottom-chrome,
.theme-cyber.reader-page .settings-panel {
  border-radius: var(--app-card-radius, 8rpx);
  border-width: var(--app-card-border-width);
  border-color: rgba(52, 214, 255, 0.44);
  box-shadow: var(--app-card-outline), inset 0 0 24rpx rgba(52, 214, 255, 0.025);
}

.theme-cyber.decoder-page .book-row,
.theme-cyber.decoder-source-page .installed-source-row,
.theme-cyber.discover-page .search-panel,
.theme-cyber.profile-page .setting-item {
  background-image: linear-gradient(90deg, rgba(52, 214, 255, 0.06) 1rpx, transparent 1rpx), linear-gradient(rgba(52, 214, 255, 0.05) 1rpx, transparent 1rpx);
  background-size: 30rpx 30rpx;
}

.theme-cyber.decoder-page .chapter-badge,
.theme-cyber.decoder-source-page .source-compatibility-tag,
.theme-cyber.discover-page .source-count,
.theme-cyber.discover-page .search-status,
.theme-cyber.reader-page .reader-progress-mark,
.theme-cyber.profile-page .backend-status {
  font-family: var(--app-utility-font);
  letter-spacing: 1rpx;
}

.theme-cyber.discover-page .search-button,
.theme-cyber.profile-page .theme-apply-button,
.theme-cyber.profile-page .backend-button.primary {
  border-radius: 4rpx;
  background: linear-gradient(90deg, var(--app-accent), #63e2ff);
}

.theme-cyber.reader-page .reading-surface {
  background-image: var(--app-reader-texture);
  background-blend-mode: screen;
}

.theme-cyber.reader-page .reader-progress-rail-fill,
.theme-cyber.reader-page .chapter-track-fill {
  background: repeating-linear-gradient(90deg, var(--app-accent) 0 18rpx, var(--app-accent-3) 18rpx 22rpx, transparent 22rpx 28rpx);
}

.theme-cyber.glass-tabbar .glass-tabbar-shell {
  border-color: rgba(52, 214, 255, 0.42);
  background-image: linear-gradient(90deg, rgba(52, 214, 255, 0.08) 1rpx, transparent 1rpx);
  background-size: 25% 100%;
}

.theme-cyber.glass-tabbar .glass-tabbar-indicator {
  border-color: var(--app-accent);
  box-shadow: inset 0 0 18rpx rgba(52, 214, 255, 0.16);
}

.theme-noirGold.decoder-page .book-row,
.theme-noirGold.decoder-source-page .source-import-hub,
.theme-noirGold.decoder-source-page .installed-source-row,
.theme-noirGold.discover-page .search-panel,
.theme-noirGold.discover-page .tip-card,
.theme-noirGold.discover-page .history-strip,
.theme-noirGold.profile-page .backend-card,
.theme-noirGold.profile-page .setting-item,
.theme-noirGold.profile-page .theme-panel {
  border-color: rgba(213, 175, 98, 0.42);
  box-shadow: var(--app-card-outline), inset 0 0 0 6rpx rgba(213, 175, 98, 0.018), var(--app-shadow);
}

.theme-noirGold.decoder-page .book-row,
.theme-noirGold.decoder-source-page .source-import-hub,
.theme-noirGold.discover-page .search-panel,
.theme-noirGold.profile-page .backend-card {
  position: relative;
}

.theme-noirGold.decoder-page .book-row::before,
.theme-noirGold.decoder-source-page .source-import-hub::before,
.theme-noirGold.discover-page .search-panel::before,
.theme-noirGold.profile-page .backend-card::before {
  position: absolute;
  inset: 8rpx;
  border: 1rpx solid rgba(213, 175, 98, 0.18);
  content: '';
  pointer-events: none;
}

.theme-noirGold.decoder-page .book-title,
.theme-noirGold.decoder-source-page .source-page-title,
.theme-noirGold.discover-page .title,
.theme-noirGold.profile-page .title,
.theme-noirGold.reader-page .top-title > view {
  font-weight: 650;
}

.theme-noirGold.reader-page .reading-surface {
  background-image: var(--app-reader-texture);
  background-blend-mode: screen;
}

.theme-noirGold.reader-page .reader-progress-rail-fill,
.theme-noirGold.reader-page .chapter-track-fill {
  background: linear-gradient(90deg, #8c6a32, var(--app-accent), #f2e2b5);
}

.theme-noirGold.glass-tabbar .glass-tabbar-shell {
  border-color: rgba(213, 175, 98, 0.42);
  box-shadow: 0 -12rpx 38rpx rgba(0, 0, 0, 0.48), inset 0 1rpx 0 rgba(242, 226, 181, 0.08);
}

.theme-noirGold.glass-tabbar .glass-tabbar-indicator {
  border-color: rgba(213, 175, 98, 0.62);
  box-shadow: inset 0 0 0 1rpx rgba(242, 226, 181, 0.08);
}

/* Theme signature pass: each reading world has one recognisable material cue beyond colour. */
.theme-xuanye.decoder-page .empty-box,
.theme-xuanye.decoder-source-page .source-empty-state,
.theme-xuanye.discover-page .empty-state {
  position: relative;
  overflow: hidden;
}

.theme-xuanye.decoder-page .empty-bookmark,
.theme-xuanye.decoder-source-page .source-empty-mark,
.theme-xuanye.discover-page .state-mark {
  position: relative;
}

.theme-xuanye.decoder-page .empty-bookmark::after,
.theme-xuanye.decoder-source-page .source-empty-mark::after,
.theme-xuanye.discover-page .state-mark::after {
  position: absolute;
  right: -16rpx;
  bottom: -10rpx;
  color: var(--app-accent);
  content: '_';
  font-family: var(--app-utility-font);
  font-size: 34rpx;
  animation: themeTerminalCursor 1s step-end infinite;
}

.theme-candy.decoder-page .empty-box,
.theme-candy.decoder-source-page .source-empty-state,
.theme-candy.discover-page .empty-state {
  position: relative;
  overflow: visible;
}

.theme-candy.decoder-page .empty-box::after,
.theme-candy.decoder-source-page .source-empty-state::after,
.theme-candy.discover-page .empty-state::after {
  position: absolute;
  top: -18rpx;
  right: 26rpx;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42rpx;
  height: 42rpx;
  border: 2rpx solid rgba(52, 42, 50, 0.76);
  border-radius: 50%;
  color: #342a32;
  content: '★';
  font-size: 22rpx;
  background: var(--app-accent-3);
  box-shadow: 3rpx 4rpx 0 rgba(85, 199, 232, 0.48);
  transform: rotate(12deg);
}

.theme-sakura.decoder-page .book-row,
.theme-sakura.decoder-source-page .source-import-hub,
.theme-sakura.discover-page .search-panel,
.theme-sakura.profile-page .backend-card {
  position: relative;
  overflow: hidden;
}

.theme-sakura.decoder-page .book-row::before,
.theme-sakura.decoder-source-page .source-import-hub::before,
.theme-sakura.discover-page .search-panel::before,
.theme-sakura.profile-page .backend-card::before {
  position: absolute;
  inset: 0;
  z-index: 0;
  content: '';
  pointer-events: none;
  background: linear-gradient(120deg, transparent 40%, rgba(255, 255, 255, 0.62) 47% 52%, transparent 58%);
  opacity: 0.56;
}

.theme-sakura.decoder-page .empty-box,
.theme-sakura.decoder-source-page .source-empty-state,
.theme-sakura.discover-page .empty-state {
  position: relative;
  overflow: hidden;
}

.theme-sakura.decoder-page .empty-box::before,
.theme-sakura.decoder-source-page .source-empty-state::before,
.theme-sakura.discover-page .empty-state::before {
  position: absolute;
  top: 22rpx;
  right: 34rpx;
  width: 12rpx;
  height: 12rpx;
  border-radius: 50% 50% 50% 0;
  content: '';
  background: rgba(233, 122, 174, 0.46);
  box-shadow: -38rpx 38rpx 0 -1rpx rgba(165, 139, 231, 0.42), -10rpx 78rpx 0 -2rpx rgba(244, 185, 203, 0.72), -76rpx 102rpx 0 -3rpx rgba(233, 122, 174, 0.34);
  transform: rotate(28deg);
}

.theme-cyber.decoder-page .empty-box,
.theme-cyber.decoder-source-page .source-empty-state,
.theme-cyber.discover-page .empty-state {
  position: relative;
  overflow: hidden;
}

.theme-cyber.decoder-page .empty-box::before,
.theme-cyber.decoder-source-page .source-empty-state::before,
.theme-cyber.discover-page .empty-state::before {
  position: absolute;
  top: 24rpx;
  right: 28rpx;
  width: 84rpx;
  height: 84rpx;
  border: 1rpx solid rgba(52, 214, 255, 0.58);
  border-radius: 50%;
  content: '';
  background: linear-gradient(90deg, transparent calc(50% - 1rpx), rgba(52, 214, 255, 0.72) calc(50% - 1rpx) calc(50% + 1rpx), transparent calc(50% + 1rpx)), linear-gradient(transparent calc(50% - 1rpx), rgba(52, 214, 255, 0.72) calc(50% - 1rpx) calc(50% + 1rpx), transparent calc(50% + 1rpx));
  box-shadow: 0 0 26rpx rgba(52, 214, 255, 0.16), inset 0 0 20rpx rgba(52, 214, 255, 0.08);
}

.theme-cyber.decoder-page .empty-box::after,
.theme-cyber.decoder-source-page .source-empty-state::after,
.theme-cyber.discover-page .empty-state::after {
  position: absolute;
  right: 22rpx;
  bottom: 18rpx;
  color: var(--app-accent-3);
  content: 'AWAITING_DATA_INPUT';
  font-family: var(--app-utility-font);
  font-size: 15rpx;
  letter-spacing: 1rpx;
}

.theme-cyber.decoder-source-page .source-compatibility-tag,
.theme-cyber.discover-page .search-status,
.theme-cyber.profile-page .backend-status {
  background-image: repeating-linear-gradient(0deg, transparent 0 2rpx, rgba(52, 214, 255, 0.10) 2rpx 4rpx);
}

.theme-cyber.decoder-source-page .source-import-feedback.loading,
.theme-cyber.discover-page .search-status.loading,
.theme-cyber.profile-page .backend-status.loading {
  animation: themeCyberScan 2.8s linear infinite;
}

.theme-noirGold.decoder-page .book-row,
.theme-noirGold.decoder-source-page .source-import-hub,
.theme-noirGold.discover-page .search-panel,
.theme-noirGold.profile-page .backend-card {
  background-image: radial-gradient(rgba(242, 226, 181, 0.055) 0.8rpx, transparent 1rpx), radial-gradient(rgba(0, 0, 0, 0.24) 0.8rpx, transparent 1rpx);
  background-position: 0 0, 5rpx 5rpx;
  background-size: 10rpx 10rpx;
}

.theme-noirGold.decoder-page .book-row::after,
.theme-noirGold.decoder-source-page .source-import-hub::after,
.theme-noirGold.discover-page .search-panel::after,
.theme-noirGold.profile-page .backend-card::after {
  position: absolute;
  inset: 14rpx;
  content: '';
  pointer-events: none;
  background: linear-gradient(var(--app-accent), var(--app-accent)) left top / 22rpx 1rpx no-repeat, linear-gradient(var(--app-accent), var(--app-accent)) left top / 1rpx 22rpx no-repeat, linear-gradient(var(--app-accent), var(--app-accent)) right bottom / 22rpx 1rpx no-repeat, linear-gradient(var(--app-accent), var(--app-accent)) right bottom / 1rpx 22rpx no-repeat;
  opacity: 0.58;
}

@keyframes themeTerminalCursor {
  0%, 48% { opacity: 1; }
  49%, 100% { opacity: 0; }
}

@keyframes themeCyberScan {
  from { background-position: 0 0; }
  to { background-position: 0 16rpx; }
}

.theme-preview {
  font-family: var(--app-body-font);
}

.theme-preview .theme-preview-title {
  font-family: var(--app-display-font);
  letter-spacing: var(--app-heading-tracking);
}

.theme-preview-seal {
  position: absolute;
  z-index: 1;
  pointer-events: none;
}

.theme-preview.theme-xuanye .theme-preview-seal {
  top: 14rpx;
  right: 16rpx;
  width: 9rpx;
  height: 9rpx;
  border-radius: 50%;
  background: var(--app-accent-3);
  box-shadow: -28rpx 28rpx 0 -1rpx var(--app-accent), -6rpx 54rpx 0 -2rpx var(--app-accent-2), 0 0 14rpx var(--app-accent);
}

.theme-preview.theme-candy {
  border-width: 2rpx;
  border-color: rgba(52, 42, 50, 0.74);
  box-shadow: 3rpx 4rpx 0 rgba(85, 199, 232, 0.40);
}

.theme-preview.theme-candy .theme-preview-book {
  border-width: 2rpx;
  border-color: rgba(52, 42, 50, 0.74);
  box-shadow: 3rpx 3rpx 0 rgba(255, 122, 89, 0.20);
}

.theme-preview.theme-candy .theme-preview-seal {
  top: 11rpx;
  right: 14rpx;
  width: 24rpx;
  height: 24rpx;
  border: 2rpx solid rgba(52, 42, 50, 0.72);
  border-radius: 50%;
  background: var(--app-accent-3);
  box-shadow: 2rpx 2rpx 0 rgba(52, 42, 50, 0.18);
}

.theme-preview.theme-sakura .theme-preview-seal {
  top: -10rpx;
  right: 20rpx;
  width: 30rpx;
  height: 88rpx;
  transform: rotate(38deg);
  background: linear-gradient(180deg, rgba(233, 122, 174, 0.76), rgba(165, 139, 231, 0.56));
  opacity: 0.72;
}

.theme-preview.theme-cyber,
.theme-preview.theme-cyber .theme-preview-book {
  border-radius: var(--app-card-radius, 8rpx);
}

.theme-preview.theme-cyber .theme-preview-seal {
  top: 15rpx;
  right: 15rpx;
  width: 12rpx;
  height: 12rpx;
  background: var(--app-accent-3);
  box-shadow: -28rpx 0 0 -3rpx var(--app-accent), 0 28rpx 0 -3rpx var(--app-accent-2);
}

.theme-preview.theme-noirGold {
  border-color: rgba(213, 175, 98, 0.46);
  box-shadow: inset 0 0 0 5rpx rgba(213, 175, 98, 0.035);
}

.theme-preview.theme-noirGold .theme-preview-book {
  border-color: rgba(213, 175, 98, 0.44);
}

.theme-preview.theme-noirGold .theme-preview-seal {
  top: 13rpx;
  right: 15rpx;
  width: 22rpx;
  height: 22rpx;
  border: 1rpx solid var(--app-accent);
  border-radius: 50%;
  box-shadow: inset 0 0 0 4rpx rgba(213, 175, 98, 0.12);
}

@keyframes themeSignalFlow {
  from { background-position: 0% 50%; }
  to { background-position: 200% 50%; }
}

@media (prefers-reduced-motion: reduce) {
  .theme-xuanye.reader-page .reader-progress-rail-fill,
  .theme-xuanye.reader-page .chapter-track-fill {
    animation: none;
  }

  .theme-candy.decoder-page .shelf-swipe-row:nth-child(n),
  .theme-candy.decoder-source-page .import-hub-action:nth-child(n),
  .theme-candy.discover-page .history-chip:nth-child(n) {
    transform: none;
  }
}

/* V3.1 time awareness: environment light only; reading palettes stay untouched. */
html[data-time-awareness='on'] .tab-page-shell > .app-page {
  background-image: var(--app-time-ambient), var(--app-bg);
  background-blend-mode: soft-light, normal;
}

html[data-time-awareness='on'][data-time-slot='morning'] .d-empty-motif {
  position: relative;
}

html[data-time-awareness='on'][data-time-slot='morning'] .d-empty-motif::after {
  position: absolute;
  right: -14rpx;
  bottom: -10rpx;
  min-width: 36rpx;
  padding: 3rpx 7rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 999rpx;
  content: '茶';
  color: var(--app-on-accent);
  background: var(--app-accent);
  font-family: var(--app-body-font);
  font-size: 15rpx;
  line-height: 24rpx;
  transform: rotate(-5deg);
}
</style>
