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
  color: #f4f0e8;
  background: #1f201e;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
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
