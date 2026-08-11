<template>
  <view class="d-bottom-sheet-root" v-if="visible">
    <view class="d-bottom-sheet-mask app-motion-overlay" @tap="handleMaskTap"></view>
    <view class="d-bottom-sheet-panel app-motion-sheet" :class="panelClass" :style="panelStyle" role="dialog" @tap.stop>
      <view class="d-bottom-sheet-handle" v-if="showHandle"></view>
      <view class="d-bottom-sheet-head" v-if="title">
        <view class="d-bottom-sheet-title">{{ title }}</view>
        <button class="d-bottom-sheet-close" aria-label="关闭" @tap.stop="$emit('close')">×</button>
      </view>
      <slot></slot>
    </view>
  </view>
</template>

<script>
import { acquireOverlayScrollLock, releaseOverlayScrollLock } from '../../common/overlayScrollLock.js'

export default {
  name: 'DBottomSheet',
  props: {
    visible: { type: Boolean, default: false },
    title: { type: String, default: '' },
    closeOnMask: { type: Boolean, default: true },
    showHandle: { type: Boolean, default: true },
    panelClass: { type: [String, Array, Object], default: '' },
    bottomOffsetRpx: { type: Number, default: 0 }
  },
  data() {
    return {
      scrollLockActive: false
    }
  },
  computed: {
    panelStyle() {
      const offsetRpx = Math.max(0, Number(this.bottomOffsetRpx) || 0)
      if (!offsetRpx) return null
      let offsetPx = offsetRpx / 2
      try {
        if (typeof uni !== 'undefined' && typeof uni.upx2px === 'function') {
          offsetPx = uni.upx2px(offsetRpx)
        }
      } catch (error) {}
      const safeOffset = Math.max(0, Number(offsetPx) || 0)
      return {
        bottom: `calc(${safeOffset}px + env(safe-area-inset-bottom))`,
        maxHeight: `calc(86vh - ${safeOffset}px - env(safe-area-inset-bottom))`
      }
    }
  },
  watch: {
    visible: {
      immediate: true,
      handler(value) {
        this.setScrollLocked(value)
      }
    }
  },
  beforeDestroy() {
    this.setScrollLocked(false)
  },
  methods: {
    handleMaskTap() {
      if (this.closeOnMask) this.$emit('close')
    },
    setScrollLocked(locked) {
      if (locked && !this.scrollLockActive) {
        this.scrollLockActive = acquireOverlayScrollLock()
      } else if (!locked && this.scrollLockActive) {
        releaseOverlayScrollLock()
        this.scrollLockActive = false
      }
    }
  }
}
</script>

<style scoped>
.d-bottom-sheet-root { position: fixed; z-index: var(--app-z-overlay, 300); inset: 0; pointer-events: none; }
.d-bottom-sheet-mask { position: absolute; inset: 0; pointer-events: auto; background: rgba(4, 6, 10, 0.56); }
.d-bottom-sheet-panel { position: absolute; z-index: 1; right: 0; bottom: 0; left: 0; box-sizing: border-box; max-width: 1120px; max-height: 86vh; padding: 24rpx 32rpx calc(30rpx + env(safe-area-inset-bottom)); margin: 0 auto; overflow-y: auto; pointer-events: auto; border: 1rpx solid var(--app-border); border-bottom: 0; border-radius: 30rpx 30rpx 0 0; color: var(--app-text); background: var(--app-panel-strong); box-shadow: var(--app-floating-shadow); }
.d-bottom-sheet-handle { width: 54rpx; height: 6rpx; margin: 0 auto 20rpx; border-radius: 999rpx; background: var(--app-border); }
.d-bottom-sheet-head { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; }
.d-bottom-sheet-title { font-family: var(--app-display-font); font-size: 34rpx; font-weight: 720; }
.d-bottom-sheet-close { width: 64rpx; height: 64rpx; border: 1rpx solid var(--app-border); color: var(--app-muted); background: var(--app-input); }
</style>
