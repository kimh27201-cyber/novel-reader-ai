<template>
  <view class="d-modal-root" v-if="visible">
    <view class="d-modal-mask app-motion-overlay" @tap="handleMaskTap"></view>
    <view class="d-modal-panel app-motion-dialog" :class="panelClass" role="dialog" @tap.stop>
      <slot></slot>
    </view>
  </view>
</template>

<script>
import { acquireOverlayScrollLock, releaseOverlayScrollLock } from '../../common/overlayScrollLock.js'

export default {
  name: 'DModal',
  props: {
    visible: { type: Boolean, default: false },
    closeOnMask: { type: Boolean, default: true },
    panelClass: { type: [String, Array, Object], default: '' }
  },
  data() {
    return {
      scrollLockActive: false
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
.d-modal-root { position: fixed; z-index: var(--app-z-modal, 400); inset: 0; display: flex; align-items: center; justify-content: center; padding: 28rpx; }
.d-modal-mask { position: absolute; inset: 0; background: rgba(4, 6, 10, 0.58); }
.d-modal-panel { position: relative; z-index: 1; box-sizing: border-box; width: min(100%, 760px); color: var(--app-text); background: var(--app-panel-strong); }
</style>
