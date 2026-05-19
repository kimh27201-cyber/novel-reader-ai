<script>
export default {
  onLaunch() {
    // 纯离线模板：不请求网络、不配置接口。
  }
}
</script>

<style>
page {
  min-height: 100%;
  color: #20352f;
  background: #e4efeb;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
}

/* #ifdef H5 */
html,
body {
  min-height: 100%;
  background:
    radial-gradient(circle at 50% -8%, rgba(117, 173, 159, 0.22), transparent 38%),
    linear-gradient(90deg, #dce9e5 0%, #edf5f2 18%, #edf5f2 82%, #dce9e5 100%);
}

uni-page-body {
  position: relative;
  max-width: 1120px;
  min-height: 100vh;
  margin: 0 auto;
  overflow-x: hidden;
  border-left: 1rpx solid rgba(73, 114, 105, 0.18);
  border-right: 1rpx solid rgba(73, 114, 105, 0.18);
  background: #f4fbf8;
  box-shadow: 0 28rpx 90rpx rgba(51, 83, 76, 0.20);
}

uni-tabbar .uni-tabbar {
  left: 50% !important;
  right: auto !important;
  width: min(100vw, 1120px) !important;
  max-width: 1120px;
  overflow: hidden;
  border-left: 1rpx solid rgba(73, 114, 105, 0.18);
  border-right: 1rpx solid rgba(73, 114, 105, 0.18);
  border-radius: 22rpx 22rpx 0 0;
  box-shadow: 0 -16rpx 54rpx rgba(42, 62, 57, 0.16);
  transform: translateX(-50%);
}
/* #endif */

/* H5 preview shell: keep the app visually separate from the browser chrome. */
.decoder-page,
.import-page,
.discover-page,
.profile-page,
.source-book-page,
.history-page,
.reader-page {
  border-left: 1rpx solid var(--app-shell-border, rgba(60, 84, 78, 0.16));
  border-right: 1rpx solid var(--app-shell-border, rgba(60, 84, 78, 0.16));
  box-shadow: var(--app-shell-shadow, 0 24rpx 80rpx rgba(42, 62, 57, 0.18));
}

.app-page,
.reader-page {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
}

.app-page {
  min-height: 100vh;
  overflow-x: hidden;
  color: var(--app-text);
  background: var(--app-bg);
}

.app-page.secondary {
  padding-top: 58rpx;
}

.app-shell-panel {
  border: 1rpx solid var(--app-border);
  border-radius: 18rpx;
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
  border-radius: 16rpx;
  color: var(--app-on-accent);
  background: var(--app-accent);
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
}

button::after {
  border: none;
}

.safe-page {
  min-height: 100vh;
  padding: 64rpx 32rpx 40rpx;
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
  color: #67fff2;
  font-size: 24rpx;
  line-height: 34rpx;
}

.screen-title {
  margin-top: 4rpx;
  color: #f4f9ff;
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
  color: #eaf7ff;
  border: 1rpx solid rgba(103, 255, 242, 0.22);
  background: rgba(14, 22, 42, 0.72);
  box-shadow: 0 0 30rpx rgba(57, 215, 255, 0.16);
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

/* Decoder ink theme tokens */
.ink-script {
  font-family: "KaiTi", "STKaiti", "FZKai-Z03", "PingFang SC", "Microsoft YaHei", cursive;
  letter-spacing: 0;
}
</style>
