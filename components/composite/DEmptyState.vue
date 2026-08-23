<template>
  <view class="d-empty-state" :class="[`theme-${safeThemeId}`, `scene-${scene}`]">
    <view class="d-empty-motif" aria-hidden="true">{{ motif }}</view>
    <view class="d-empty-title">{{ title }}</view>
    <text class="d-empty-description">{{ description }}</text>
    <DButton v-if="actionText" class="d-empty-action" :label="actionText" @tap="$emit('action')" />
    <text class="d-empty-helper" v-if="helper">{{ helper }}</text>
  </view>
</template>

<script>
import DButton from '../base/DButton.vue'
import { normalizeThemeExperienceId } from '../../common/v3Experience.js'

export default {
  name: 'DEmptyState',
  components: { DButton },
  props: {
    scene: { type: String, default: 'bookshelf' },
    themeId: { type: String, default: 'xuanye' },
    title: { type: String, default: '这里还没有内容' },
    description: { type: String, default: '' },
    actionText: { type: String, default: '' },
    helper: { type: String, default: '' }
  },
  computed: {
    safeThemeId() {
      return normalizeThemeExperienceId(this.themeId)
    },
    motif() {
      return {
        xuanye: '>_',
        candy: '★',
        sakura: '花',
        cyber: '⌖',
        noirGold: '藏'
      }[this.safeThemeId]
    }
  }
}
</script>

<style scoped>
.d-empty-state {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 520rpx;
  padding: 64rpx 36rpx;
  text-align: center;
}

.d-empty-motif {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 116rpx;
  height: 116rpx;
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-card-radius);
  color: var(--app-accent);
  background: var(--app-panel);
  font-family: var(--app-display-font);
  font-size: 44rpx;
  box-shadow: var(--app-card-outline);
}

.d-empty-title { margin-top: 28rpx; color: var(--app-text); font-family: var(--app-display-font); font-size: 36rpx; font-weight: 720; }
.d-empty-description { max-width: 540rpx; margin-top: 14rpx; color: var(--app-muted); font-size: 25rpx; line-height: 40rpx; }
.d-empty-action { margin-top: 30rpx; }
.d-empty-helper { margin-top: 18rpx; color: var(--app-muted); font-size: 20rpx; }
.theme-xuanye .d-empty-motif { border-left: 4rpx solid var(--app-accent); border-radius: 0; box-shadow: 0 0 20rpx color-mix(in srgb, var(--app-accent) 18%, transparent); }
.theme-candy .d-empty-motif { border: 2rpx solid rgba(52, 42, 50, 0.78); border-radius: 42% 58% 62% 38%; box-shadow: 5rpx 6rpx 0 var(--app-accent-2); transform: rotate(-3deg); }
.theme-sakura .d-empty-motif { border-radius: 50% 12% 50% 12%; background: linear-gradient(135deg, var(--app-panel), color-mix(in srgb, var(--app-accent) 18%, var(--app-panel))); transform: rotate(8deg); }
.theme-cyber .d-empty-motif { border-radius: 0; background: repeating-linear-gradient(0deg, transparent 0 8rpx, color-mix(in srgb, var(--app-accent) 8%, transparent) 9rpx), var(--app-panel); }
.theme-noirGold .d-empty-motif { border-color: var(--app-accent); border-radius: 4rpx; box-shadow: inset 0 0 0 7rpx color-mix(in srgb, var(--app-accent) 5%, transparent); }
</style>

