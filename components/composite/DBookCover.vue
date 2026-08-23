<template>
  <view
    class="d-book-cover"
    :class="[
      `theme-${safeThemeId}`,
      `ritual-${experience.ritualKind}`,
      `ritual-state-${ritualState}`,
      { 'is-recent': recent, 'is-selected': selected, 'reduce-motion': motionReduced }
    ]"
    :style="coverMotionStyle"
    :data-book-id="bookId"
    :aria-label="`打开《${title || '未命名书籍'}》`"
    @tap="emitTap"
    @longpress.stop="$emit('longpress', $event)"
  >
    <image class="d-book-cover-image" v-if="coverUrl" :src="coverUrl" mode="aspectFill" lazy-load />
    <view class="d-book-cover-fallback" v-else>
      <text class="d-book-cover-title">{{ shortTitle }}</text>
      <text class="d-book-cover-kind">{{ sourceKind }}</text>
    </view>
    <view class="d-book-cover-spine"></view>
    <view class="d-book-cover-decoration" aria-hidden="true"></view>
    <view class="d-book-cover-live" v-if="recent" aria-label="最近在读">LIVE</view>
    <view class="d-book-cover-ritual" v-if="ritualState !== 'idle'" aria-hidden="true">
      <text class="d-book-cover-ritual-glyph">{{ ritualGlyph }}</text>
    </view>
  </view>
</template>

<script>
import { getThemeExperience, normalizeThemeExperienceId, stableBookPhase } from '../../common/v3Experience.js'

export default {
  name: 'DBookCover',
  props: {
    bookId: { type: [String, Number], default: '' },
    coverUrl: { type: String, default: '' },
    title: { type: String, default: '' },
    sourceKind: { type: String, default: '本地' },
    themeId: { type: String, default: 'xuanye' },
    recent: { type: Boolean, default: false },
    selected: { type: Boolean, default: false },
    motionReduced: { type: Boolean, default: false },
    ritualState: { type: String, default: 'idle' }
  },
  computed: {
    safeThemeId() {
      return normalizeThemeExperienceId(this.themeId)
    },
    experience() {
      return getThemeExperience(this.safeThemeId)
    },
    shortTitle() {
      return String(this.title || '未命名').slice(0, 4)
    },
    coverMotionStyle() {
      return {
        '--d-book-breathe-duration': `${this.experience.breatheDurationMs}ms`,
        '--d-book-breathe-delay': `${stableBookPhase(this.bookId, this.experience.breatheDurationMs)}ms`,
        '--d-book-breathe-scale': String(this.experience.breatheScale),
        '--d-book-ritual-duration': `${this.experience.ritualDurationMs}ms`,
        '--d-book-motion-ease': this.experience.ease
      }
    },
    ritualGlyph() {
      return {
        terminal: 'DECRYPT',
        sticker: 'OPEN',
        petal: '✦',
        grid: '0xFF',
        hardcover: '◆'
      }[this.experience.ritualKind] || ''
    }
  },
  methods: {
    emitTap(event) {
      const target = event && event.currentTarget
      let coverRect = null
      if (target && typeof target.getBoundingClientRect === 'function') {
        try {
          const rect = target.getBoundingClientRect()
          coverRect = {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height
          }
        } catch (error) {}
      }
      this.$emit('tap', { nativeEvent: event, coverRect })
    }
  }
}
</script>

<style scoped>
.d-book-cover {
  position: relative;
  flex-shrink: 0;
  width: 150rpx;
  height: 202rpx;
  overflow: visible;
  border-radius: var(--app-cover-radius, 12rpx);
  transform-origin: center bottom;
  will-change: auto;
}

.d-book-cover-image,
.d-book-cover-fallback {
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: inherit;
}

.d-book-cover-image { display: block; }

.d-book-cover-fallback {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16rpx;
  color: var(--app-on-accent);
  background: linear-gradient(145deg, var(--app-accent) 0%, var(--app-accent-3) 100%);
}

.d-book-cover-title { font-family: var(--app-display-font); font-size: 27rpx; font-weight: 800; text-align: center; }
.d-book-cover-kind { margin-top: 12rpx; padding: 3rpx 9rpx; border: 1rpx solid currentColor; border-radius: 999rpx; font-size: 18rpx; }

.d-book-cover-spine {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 7rpx;
  border-radius: var(--app-cover-radius, 12rpx) 0 0 var(--app-cover-radius, 12rpx);
  background: color-mix(in srgb, var(--app-accent-2) 42%, transparent);
}

.d-book-cover-decoration,
.d-book-cover-ritual {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
}

.d-book-cover-live {
  position: absolute;
  right: -10rpx;
  bottom: -10rpx;
  padding: 5rpx 9rpx;
  border: 1rpx solid var(--app-accent);
  border-radius: 999rpx;
  color: var(--app-accent);
  background: var(--app-panel-strong);
  font-family: var(--app-utility-font);
  font-size: 15rpx;
  letter-spacing: 1rpx;
}

.is-recent:not(.reduce-motion):not(.ritual-state-opening):not(.ritual-state-navigating) {
  animation: d-book-breathe var(--d-book-breathe-duration) var(--d-book-breathe-delay) ease-in-out infinite;
  animation-duration: calc(var(--d-book-breathe-duration) + var(--app-time-breathe-offset, 0ms));
}

.is-selected { transform: translate3d(0, -4rpx, 0) scale(1.02); }
.theme-xuanye .d-book-cover-decoration { box-shadow: inset 0 0 0 1rpx var(--app-accent), 0 0 18rpx color-mix(in srgb, var(--app-accent) 24%, transparent); }
.theme-candy .d-book-cover-decoration { border: 2rpx solid rgba(52, 42, 50, 0.78); box-shadow: 4rpx 5rpx 0 var(--app-accent-2); }
.theme-candy .d-book-cover-decoration::after { position: absolute; top: 8rpx; right: 8rpx; width: 20rpx; height: 20rpx; border: 2rpx solid rgba(52, 42, 50, 0.72); border-radius: 50%; content: ''; background: var(--app-accent-3); }
.theme-sakura .d-book-cover-decoration { border: 1rpx solid color-mix(in srgb, var(--app-accent-3) 48%, transparent); box-shadow: inset 0 10rpx 0 color-mix(in srgb, var(--app-accent) 12%, transparent); }
.theme-cyber .d-book-cover-decoration { border: 1rpx solid var(--app-accent); background: repeating-linear-gradient(0deg, transparent 0 5rpx, color-mix(in srgb, var(--app-accent) 7%, transparent) 6rpx); }
.theme-noirGold .d-book-cover-decoration { border: 1rpx solid color-mix(in srgb, var(--app-accent) 64%, transparent); box-shadow: inset 7rpx 7rpx 0 -6rpx var(--app-accent), inset -7rpx -7rpx 0 -6rpx var(--app-accent); }

.d-book-cover-ritual { z-index: 5; display: flex; align-items: center; justify-content: center; color: var(--app-on-accent); background: color-mix(in srgb, var(--app-accent) 86%, transparent); }
.d-book-cover-ritual-glyph { position: relative; z-index: 2; font-family: var(--app-utility-font); font-size: 18rpx; font-weight: 800; letter-spacing: 2rpx; }
.ritual-state-opening { z-index: 8; animation: d-book-open var(--d-book-ritual-duration) var(--d-book-motion-ease) both; will-change: transform, opacity; }
.ritual-state-navigating { z-index: 8; opacity: 0; transform: translate3d(14rpx, -10rpx, 0) scale(1.08); }
.ritual-terminal .d-book-cover-ritual::after { position: absolute; right: 0; left: 0; height: 4rpx; content: ''; background: #ffffff; box-shadow: 0 0 14rpx var(--app-accent); animation: d-book-scan var(--d-book-ritual-duration) linear both; }
.ritual-sticker .d-book-cover-ritual { transform-origin: right bottom; animation: d-book-peel var(--d-book-ritual-duration) var(--d-book-motion-ease) both; }
.ritual-petal .d-book-cover-ritual { background: radial-gradient(ellipse at 30% 30%, var(--app-accent) 0 12%, transparent 13%), radial-gradient(ellipse at 70% 65%, var(--app-accent-2) 0 13%, transparent 14%), color-mix(in srgb, var(--app-panel-strong) 72%, transparent); }
.ritual-grid .d-book-cover-ritual { background: repeating-linear-gradient(0deg, var(--app-accent) 0 2rpx, transparent 2rpx 12rpx), repeating-linear-gradient(90deg, color-mix(in srgb, var(--app-accent) 58%, transparent) 0 2rpx, transparent 2rpx 12rpx), var(--app-stage); }
.ritual-hardcover .d-book-cover-ritual { background: linear-gradient(90deg, var(--app-accent) 0 2rpx, var(--app-panel-strong) 2rpx 49%, var(--app-accent) 49% 51%, var(--app-panel-strong) 51% 98%, var(--app-accent) 98%); }

@keyframes d-book-breathe { 0%, 100% { transform: translate3d(0, 0, 0) scale(1); } 50% { transform: translate3d(0, -1rpx, 0) scale(var(--d-book-breathe-scale)); } }
@keyframes d-book-open { 0% { transform: scale(1); opacity: 1; } 45% { transform: translate3d(0, -7rpx, 0) scale(1.035); opacity: 1; } 100% { transform: translate3d(14rpx, -10rpx, 0) scale(1.08); opacity: 0; } }
@keyframes d-book-scan { from { top: 0; } to { top: 100%; } }
@keyframes d-book-peel { from { transform: rotate(0) scale(1); } to { transform: rotate(7deg) scale(1.12); } }

.reduce-motion,
.reduce-motion * { animation-duration: 1ms !important; transition-duration: 1ms !important; }

@media (prefers-reduced-motion: reduce) {
  .d-book-cover,
  .d-book-cover * { animation-duration: 1ms !important; transition-duration: 1ms !important; }
}
</style>
