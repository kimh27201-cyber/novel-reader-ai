<template>
  <view class="d-skeleton" :class="`d-skeleton-${variant}`" :aria-label="ariaLabel">
    <view class="d-skeleton-row" v-for="index in safeRows" :key="index">
      <view class="d-skeleton-cover" v-if="variant !== 'profile'"></view>
      <view class="d-skeleton-copy">
        <view class="d-skeleton-line strong"></view>
        <view class="d-skeleton-line"></view>
        <view class="d-skeleton-line short"></view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'DSkeleton',
  props: {
    variant: { type: String, default: 'search' },
    rows: { type: Number, default: 3 },
    ariaLabel: { type: String, default: '正在加载' }
  },
  computed: {
    safeRows() {
      return Math.max(1, Math.min(8, Number(this.rows) || 3))
    }
  }
}
</script>

<style scoped>
.d-skeleton { display: flex; flex-direction: column; gap: 16rpx; }
.d-skeleton-row { display: flex; gap: 22rpx; min-height: 156rpx; padding: 22rpx; border: 1rpx solid var(--app-border); border-radius: var(--app-card-radius); background: var(--app-panel); }
.d-skeleton-cover { flex-shrink: 0; width: 88rpx; height: 118rpx; border-radius: var(--app-cover-radius); }
.d-skeleton-copy { display: flex; flex: 1; flex-direction: column; justify-content: center; gap: 14rpx; }
.d-skeleton-cover,
.d-skeleton-line { background: linear-gradient(90deg, var(--app-input) 20%, color-mix(in srgb, var(--app-panel-strong) 72%, var(--app-accent)) 50%, var(--app-input) 80%); background-size: 220% 100%; animation: d-skeleton-shimmer 1.35s ease-in-out infinite; }
.d-skeleton-line { width: 82%; height: 18rpx; border-radius: 999rpx; }
.d-skeleton-line.strong { width: 58%; height: 24rpx; }
.d-skeleton-line.short { width: 38%; }
@keyframes d-skeleton-shimmer { from { background-position: 200% 0; } to { background-position: -20% 0; } }
@media (prefers-reduced-motion: reduce) { .d-skeleton-cover, .d-skeleton-line { animation: none; } }
</style>
