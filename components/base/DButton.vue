<template>
  <button
    class="d-button"
    :class="[`d-button-${variant}`, `d-button-${size}`, { 'is-loading': loading }]"
    :disabled="disabled || loading"
    :aria-busy="loading ? 'true' : 'false'"
    @tap.stop="handleTap"
  >
    <view class="d-button-spinner" v-if="loading" aria-hidden="true"></view>
    <slot v-else>{{ label }}</slot>
  </button>
</template>

<script>
export default {
  name: 'DButton',
  props: {
    variant: {
      type: String,
      default: 'primary',
      validator: value => ['primary', 'secondary', 'ghost', 'danger'].includes(value)
    },
    size: {
      type: String,
      default: 'md',
      validator: value => ['sm', 'md', 'lg'].includes(value)
    },
    label: { type: String, default: '' },
    loading: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false }
  },
  methods: {
    handleTap(event) {
      if (this.disabled || this.loading) return
      this.$emit('tap', event)
    }
  }
}
</script>

<style scoped>
.d-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 160rpx;
  height: 72rpx;
  padding: 0 28rpx;
  border: 1rpx solid transparent;
  border-radius: var(--app-control-radius, 14rpx);
  color: var(--app-on-accent);
  background: var(--app-accent);
  font-family: var(--app-body-font);
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1;
  transition: transform 80ms ease, opacity 120ms ease, background 240ms var(--app-motion-smooth);
}

.d-button:active { transform: scale(0.97); }
.d-button[disabled] { opacity: 0.48; transform: none; }
.d-button-sm { min-width: 120rpx; height: 56rpx; padding: 0 20rpx; font-size: 24rpx; }
.d-button-lg { min-width: 200rpx; height: 88rpx; padding: 0 34rpx; font-size: 32rpx; }
.d-button-secondary { border-color: var(--app-accent); color: var(--app-accent); background: transparent; }
.d-button-ghost { color: var(--app-accent); background: transparent; }
.d-button-danger { color: #ffffff; background: #b93832; }

.d-button-spinner {
  width: 26rpx;
  height: 26rpx;
  border: 3rpx solid color-mix(in srgb, currentColor 28%, transparent);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: d-button-spin 680ms linear infinite;
}

@keyframes d-button-spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  .d-button { transition-duration: 1ms; }
  .d-button-spinner { animation-duration: 1.4s; }
}
</style>

