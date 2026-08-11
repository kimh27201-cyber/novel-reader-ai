<template>
  <view class="glass-tabbar decoder-tabbar" :class="themeClass" :style="themeVars">
    <view
      class="glass-tabbar-shell"
      :class="{ 'is-dragging': tabSwipeActive }"
      :style="shellStyle"
      @touchstart="onTabSwipeStart"
      @touchmove="onTabSwipeMove"
      @touchend="onTabSwipeEnd"
      @touchcancel="onTabSwipeCancel"
    >
      <view
        class="glass-tabbar-indicator"
        :class="{
          'reduce-motion': reduceMotion,
          'is-dragging': tabSwipeActive,
          'lens-dragging-left': lensDirection === 'left',
          'lens-dragging-right': lensDirection === 'right'
        }"
        :style="indicatorStyle"
      ></view>
      <button
        v-for="(item, index) in tabs"
        :key="item.pagePath"
        class="glass-tabbar-item"
        :class="{
          active: index === visualIndex,
          'is-bouncing': index === bouncingIndex,
          'is-swipe-preview': index === tabSwipePreviewIndex && index !== visualIndex
        }"
        :aria-label="item.label"
        @tap="switchTab(index, $event)"
      >
        <view
          class="tab-ripple"
          v-if="rippleVisible && rippleIndex === index"
          :key="rippleKey"
          :style="rippleStyle"
          aria-hidden="true"
        ></view>
        <view class="glass-tabbar-icon-wrap">
          <image
            class="glass-tabbar-icon"
            :class="{ 'tab-icon-pop': index === bouncingIndex }"
            :src="index === visualIndex || index === tabSwipePreviewIndex ? item.selectedIconPath : item.iconPath"
            mode="aspectFit"
          />
        </view>
        <text class="glass-tabbar-label">{{ item.label }}</text>
      </button>
    </view>
  </view>
</template>

<script>
import { getAppThemeId, getAppThemeStyle } from '../common/appTheme.js'
import { isMotionReduced, setNavigationMotion } from '../common/motion.js'
import {
  TAB_NAVIGATION_TIMEOUT_MS,
  getTabNavigationState,
  getTabCommitDelay,
  markTabRouteShown,
  publishTabNavigationState,
  stageTabSelection,
  subscribeTabNavigationState
} from '../common/tabNavigation.js'

const tabs = [
  {
    pagePath: 'pages/bookshelf/bookshelf',
    label: '书架',
    iconPath: '/static/tabbar/bookshelf.png',
    selectedIconPath: '/static/tabbar/bookshelf-active.png'
  },
  {
    pagePath: 'pages/library/library',
    label: '书源',
    iconPath: '/static/tabbar/source.png',
    selectedIconPath: '/static/tabbar/source-active.png'
  },
  {
    pagePath: 'pages/search/search',
    label: '发现',
    iconPath: '/static/tabbar/discover.png',
    selectedIconPath: '/static/tabbar/discover-active.png'
  },
  {
    pagePath: 'pages/profile/profile',
    label: '我的',
    iconPath: '/static/tabbar/profile.png',
    selectedIconPath: '/static/tabbar/profile-active.png'
  }
]

let pendingBounceIndex = -1

export default {
  props: {
    activePath: {
      type: String,
      default: ''
    }
  },
  data() {
    const navigationState = getTabNavigationState()
    return {
      tabs,
      routeIndex: navigationState.routeIndex,
      visualIndex: navigationState.visualIndex,
      pendingTargetIndex: navigationState.pendingTargetIndex,
      unsubscribeTabNavigation: null,
      bouncingIndex: -1,
      bounceTimer: null,
      tabCommitTimer: null,
      tabSwipeStartX: 0,
      tabSwipeStartY: 0,
      tabSwipeStartAt: 0,
      tabSwipeLastX: 0,
      tabSwipeLastAt: 0,
      tabSwipeVelocity: 0,
      tabSwipeOffset: 0,
      tabSwipeActive: false,
      tabPressing: false,
      suppressTabTapUntil: 0,
      tabNavigating: false,
      tabNavigationTimer: null,
      themeId: getAppThemeId(),
      reduceMotion: false,
      motionQuery: null,
      rippleVisible: false,
      rippleIndex: -1,
      rippleX: 50,
      rippleKey: 0,
      rippleTimer: null
    }
  },
  computed: {
    themeVars() {
      return getAppThemeStyle(this.themeId)
    },
    themeClass() {
      return `theme-${this.themeId}`
    },
    indicatorStyle() {
      const windowWidth = this.getWindowWidth()
      const dragPercent = this.tabSwipeActive && windowWidth
        ? Math.max(-100, Math.min(100, this.tabSwipeOffset / windowWidth * 400))
        : 0
      return {
        transform: `translate3d(${this.visualIndex * 100 + dragPercent}%, 0, 0) scaleX(${this.lensScaleX})`,
        transformOrigin: this.lensDirection === 'right' ? 'right center' : 'left center',
        '--lens-prism-intensity': `${this.lensPrismIntensity}`
      }
    },
    shellStyle() {
      const windowWidth = this.getWindowWidth()
      const shift = this.tabSwipeActive && windowWidth
        ? Math.max(-8, Math.min(8, this.tabSwipeOffset / windowWidth * 16))
        : 0
      return { '--tab-highlight-x': `${50 + shift}%` }
    },
    lensDirection() {
      if (!this.tabSwipeActive || !this.tabSwipeOffset) return ''
      return this.tabSwipeOffset > 0 ? 'right' : 'left'
    },
    lensScaleX() {
      if (!this.tabSwipeActive) return this.tabPressing ? 0.94 : 1
      const windowWidth = this.getWindowWidth()
      const progress = windowWidth ? Math.abs(this.tabSwipeOffset) / windowWidth : 0
      const velocity = Math.min(1, Math.abs(this.tabSwipeVelocity) / 1600)
      return (1 + Math.min(progress * 0.22 + velocity * 0.07, 0.16)).toFixed(4)
    },
    lensPrismIntensity() {
      if (!this.tabSwipeActive) return 0
      const windowWidth = this.getWindowWidth()
      const progress = windowWidth ? Math.abs(this.tabSwipeOffset) / windowWidth : 0
      return Math.min(1, 0.25 + progress * 3.2).toFixed(3)
    },
    tabSwipePreviewIndex() {
      if (!this.tabSwipeActive || Math.abs(this.tabSwipeOffset) < 32) return this.visualIndex
      const direction = this.tabSwipeOffset < 0 ? 1 : -1
      const targetIndex = this.visualIndex + direction
      return targetIndex >= 0 && targetIndex < this.tabs.length ? targetIndex : this.visualIndex
    },
    rippleStyle() {
      return {
        left: `${this.rippleX}%`
      }
    }
  },
  created() {
    this.unsubscribeTabNavigation = subscribeTabNavigationState(this.applyTabNavigationState)
    this.syncActiveTab()
    if (typeof uni !== 'undefined' && typeof uni.$on === 'function') {
      uni.$on('app:theme-changed', this.handleThemeChange)
      uni.$on('app:theme-preview', this.handleThemePreview)
      uni.$on('app:motion-changed', this.handleMotionChange)
    }
  },
  mounted() {
    this.syncActiveTab()
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      this.reduceMotion = this.motionQuery.matches
      if (typeof this.motionQuery.addEventListener === 'function') {
        this.motionQuery.addEventListener('change', this.handleMotionPreference)
      }
    }
    this.reduceMotion = isMotionReduced()
    this.playPendingTabBounce()
  },
  onShow() {
    this.syncActiveTab()
    this.playPendingTabBounce()
  },
  beforeDestroy() {
    if (this.bounceTimer) clearTimeout(this.bounceTimer)
    if (this.tabCommitTimer) clearTimeout(this.tabCommitTimer)
    if (this.tabNavigationTimer) clearTimeout(this.tabNavigationTimer)
    if (this.rippleTimer) clearTimeout(this.rippleTimer)
    if (this.unsubscribeTabNavigation) this.unsubscribeTabNavigation()
    if (this.motionQuery && typeof this.motionQuery.removeEventListener === 'function') {
      this.motionQuery.removeEventListener('change', this.handleMotionPreference)
    }
    if (typeof uni !== 'undefined' && typeof uni.$off === 'function') {
      uni.$off('app:theme-changed', this.handleThemeChange)
      uni.$off('app:theme-preview', this.handleThemePreview)
      uni.$off('app:motion-changed', this.handleMotionChange)
    }
  },
  methods: {
    handleMotionPreference(event) {
      this.reduceMotion = !!(event && event.matches)
    },
    handleThemeChange(themeId) {
      this.themeId = themeId || getAppThemeId()
    },
    handleThemePreview(themeId) {
      this.themeId = themeId || getAppThemeId()
    },
    handleMotionChange(state) {
      this.reduceMotion = !!(state && state.reduced)
    },
    getCurrentRoute() {
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
      const current = pages.length ? pages[pages.length - 1] : null
      return current && current.route ? current.route.replace(/^\//, '') : ''
    },
    applyTabNavigationState(state) {
      if (!state) return
      this.routeIndex = state.routeIndex
      this.visualIndex = state.visualIndex
      this.pendingTargetIndex = state.pendingTargetIndex
    },
    syncActiveTab(syncTheme = true) {
      if (syncTheme) this.themeId = getAppThemeId()
      const pagePath = this.activePath || this.getCurrentRoute()
      const index = this.tabs.findIndex(item => item.pagePath === pagePath)
      if (index < 0) return
      const sharedState = getTabNavigationState()
      if (sharedState.pendingTargetIndex >= 0 || this.tabSwipeActive) {
        this.applyTabNavigationState(sharedState)
        return
      }
      this.applyTabNavigationState(markTabRouteShown(pagePath))
    },
    switchTab(index, event) {
      this.triggerRipple(index, event)
      if (this.tabNavigating || Date.now() < this.suppressTabTapUntil) return
      this.navigateToTab(index)
    },
    triggerRipple(index, event) {
      if (this.reduceMotion) return
      const windowWidth = this.getWindowWidth()
      const pageX = Number(event && event.detail && event.detail.x)
      const segmentWidth = windowWidth / this.tabs.length
      const localX = Number.isFinite(pageX)
        ? ((pageX - index * segmentWidth) / segmentWidth) * 100
        : 50
      if (this.rippleTimer) clearTimeout(this.rippleTimer)
      this.rippleVisible = false
      this.rippleIndex = index
      this.rippleX = Math.max(14, Math.min(86, localX))
      this.rippleKey += 1
      this.$nextTick(() => {
        this.rippleVisible = true
        this.rippleTimer = setTimeout(() => {
          this.rippleVisible = false
          this.rippleTimer = null
        }, 420)
      })
    },
    navigateToTab(index) {
      if (this.tabNavigating) return
      const next = this.tabs[index]
      if (!next) return
      this.themeId = getAppThemeId()
      const currentIndex = this.getRouteIndex()
      const staged = stageTabSelection(currentIndex, index, this.tabs.length)
      publishTabNavigationState(staged)
      if (this.pendingTargetIndex < 0) {
        this.cancelTabCommit(false)
        this.triggerTabBounce(index)
        return
      }
      setNavigationMotion('tab', index > currentIndex ? 'forward' : 'back')
      this.scheduleTabCommit(index)
    },
    getRouteIndex() {
      const currentIndex = this.tabs.findIndex(item => item.pagePath === this.getCurrentRoute())
      return currentIndex >= 0 ? currentIndex : this.routeIndex
    },
    scheduleTabCommit(index) {
      if (this.tabCommitTimer) clearTimeout(this.tabCommitTimer)
      const delay = getTabCommitDelay(this.reduceMotion)
      this.$nextTick(() => {
        if (this.pendingTargetIndex !== index) return
        this.tabCommitTimer = setTimeout(() => this.commitTabNavigation(index), delay)
      })
    },
    commitTabNavigation(index) {
      if (this.pendingTargetIndex !== index || this.tabNavigating) return
      const next = this.tabs[index]
      if (!next) return
      this.tabCommitTimer = null
      publishTabNavigationState({
        routeIndex: this.routeIndex,
        visualIndex: index,
        pendingTargetIndex: -1
      })
      pendingBounceIndex = index
      this.beginTabNavigation()
      uni.switchTab({
        url: `/${next.pagePath}`,
        success: () => this.releaseTabNavigation(),
        fail: () => {
          publishTabNavigationState({
            routeIndex: this.routeIndex,
            visualIndex: this.routeIndex,
            pendingTargetIndex: -1
          })
          this.releaseTabNavigation()
        }
      })
    },
    cancelTabCommit(resetVisual = true) {
      if (this.tabCommitTimer) {
        clearTimeout(this.tabCommitTimer)
        this.tabCommitTimer = null
      }
      publishTabNavigationState({
        routeIndex: this.routeIndex,
        visualIndex: resetVisual ? this.routeIndex : this.visualIndex,
        pendingTargetIndex: -1
      })
    },
    beginTabNavigation() {
      this.tabNavigating = true
      if (this.tabNavigationTimer) clearTimeout(this.tabNavigationTimer)
      this.tabNavigationTimer = setTimeout(() => this.releaseTabNavigation(), TAB_NAVIGATION_TIMEOUT_MS)
    },
    releaseTabNavigation() {
      if (this.tabNavigationTimer) {
        clearTimeout(this.tabNavigationTimer)
        this.tabNavigationTimer = null
      }
      this.tabNavigating = false
    },
    getTouchPoint(event) {
      const touch = event && ((event.touches && event.touches[0]) || (event.changedTouches && event.changedTouches[0]))
      return touch || { pageX: 0, pageY: 0 }
    },
    getWindowWidth() {
      try {
        const info = uni.getSystemInfoSync()
        return Number(info && info.windowWidth) || 375
      } catch (error) {
        return 375
      }
    },
    onTabSwipeStart(event) {
      if (this.tabNavigating) return
      if (this.pendingTargetIndex >= 0) this.cancelTabCommit()
      const touch = this.getTouchPoint(event)
      const now = Date.now()
      this.tabSwipeStartX = touch.pageX
      this.tabSwipeStartY = touch.pageY
      this.tabSwipeStartAt = now
      this.tabSwipeLastX = touch.pageX
      this.tabSwipeLastAt = now
      this.tabSwipeVelocity = 0
      this.tabSwipeOffset = 0
      this.tabSwipeActive = false
      this.tabPressing = true
    },
    onTabSwipeMove(event) {
      if (!this.tabSwipeStartX && !this.tabSwipeStartY) return
      const touch = this.getTouchPoint(event)
      const offsetX = touch.pageX - this.tabSwipeStartX
      const offsetY = touch.pageY - this.tabSwipeStartY
      if (!this.tabSwipeActive && Math.abs(offsetY) > Math.abs(offsetX)) return
      if (Math.abs(offsetX) < 8) return
      const now = Date.now()
      const elapsed = now - this.tabSwipeLastAt
      if (elapsed > 0) {
        this.tabSwipeVelocity = (touch.pageX - this.tabSwipeLastX) / elapsed * 1000
      }
      this.tabSwipeLastX = touch.pageX
      this.tabSwipeLastAt = now
      this.tabSwipeActive = true
      this.tabSwipeOffset = offsetX
    },
    onTabSwipeEnd(event) {
      if (!this.tabSwipeActive) {
        this.resetTabSwipe()
        return
      }
      const touch = this.getTouchPoint(event)
      const offsetX = touch.pageX - this.tabSwipeStartX
      const now = Date.now()
      const tailElapsed = now - this.tabSwipeLastAt
      const tailVelocity = tailElapsed > 0
        ? (touch.pageX - this.tabSwipeLastX) / tailElapsed * 1000
        : 0
      const averageVelocity = this.tabSwipeStartAt && now > this.tabSwipeStartAt
        ? offsetX / (now - this.tabSwipeStartAt) * 1000
        : 0
      const swipeVelocity = Math.abs(tailVelocity) > 1 ? tailVelocity : (this.tabSwipeVelocity || averageVelocity)
      const threshold = this.getWindowWidth() * 0.22
      const isQuickFlick = Math.abs(swipeVelocity) > 200 && swipeVelocity * offsetX > 0
      const targetIndex = isQuickFlick
        ? this.visualIndex + (swipeVelocity < 0 ? 1 : -1)
        : offsetX <= -threshold
          ? this.visualIndex + 1
          : offsetX >= threshold
            ? this.visualIndex - 1
            : this.visualIndex
      this.suppressTabTapUntil = Date.now() + 360
      this.resetTabSwipe()
      if (targetIndex >= 0 && targetIndex < this.tabs.length && targetIndex !== this.visualIndex) {
        this.$nextTick(() => this.navigateToTab(targetIndex))
      }
    },
    onTabSwipeCancel() {
      this.resetTabSwipe()
    },
    resetTabSwipe() {
      this.tabSwipeStartX = 0
      this.tabSwipeStartY = 0
      this.tabSwipeStartAt = 0
      this.tabSwipeLastX = 0
      this.tabSwipeLastAt = 0
      this.tabSwipeVelocity = 0
      this.tabSwipeOffset = 0
      this.tabSwipeActive = false
      this.tabPressing = false
    },
    playPendingTabBounce() {
      if (pendingBounceIndex !== this.visualIndex) return
      const index = pendingBounceIndex
      pendingBounceIndex = -1
      this.triggerTabBounce(index)
    },
    triggerTabBounce(index) {
      if (this.reduceMotion) return
      if (this.bounceTimer) clearTimeout(this.bounceTimer)
      this.bouncingIndex = -1
      this.$nextTick(() => {
        this.bouncingIndex = index
        this.bounceTimer = setTimeout(() => {
          this.bouncingIndex = -1
          this.bounceTimer = null
        }, 280)
      })
    }
  }
}
</script>

<style>
.glass-tabbar {
  position: fixed;
  z-index: 999;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0 18rpx calc(16rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: transparent;
}

.glass-tabbar-shell {
  --tab-highlight-x: 50%;
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: stretch;
  height: 116rpx;
  overflow: hidden;
  border: 1rpx solid color-mix(in srgb, var(--app-border) 70%, rgba(255, 255, 255, 0.42));
  border-radius: 32rpx;
  background: linear-gradient(125deg, rgba(255, 255, 255, 0.22), transparent 42%), var(--app-reader-control);
  box-shadow: 0 16rpx 42rpx rgba(34, 24, 41, 0.16), inset 0 1rpx 0 rgba(255, 255, 255, 0.34), inset 0 -1rpx 0 rgba(0, 0, 0, 0.05);
  transition: border-color 160ms ease;
}

.glass-tabbar-shell::before {
  position: absolute;
  z-index: 0;
  top: 1rpx;
  right: 1rpx;
  left: 1rpx;
  height: 40%;
  border-radius: 30rpx 30rpx 54rpx 54rpx;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.30), rgba(255, 255, 255, 0.05) 46%, transparent 100%);
  background-position: var(--tab-highlight-x) 0;
  background-size: 180% 100%;
  content: '';
  opacity: 0.9;
  pointer-events: none;
  transition: none;
}

.glass-tabbar-shell:active {
  box-shadow: 0 10rpx 28rpx rgba(34, 24, 41, 0.14), inset 0 1rpx 0 rgba(255, 255, 255, 0.28);
}

.glass-tabbar-shell.is-dragging::before {
  transition: none;
}

/* #ifdef H5 */
@supports ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
  .glass-tabbar-shell {
    background: linear-gradient(125deg, color-mix(in srgb, #fff 28%, transparent), transparent 42%), color-mix(in srgb, var(--app-reader-control) 68%, transparent);
    -webkit-backdrop-filter: blur(10px) saturate(118%);
    backdrop-filter: blur(10px) saturate(118%);
  }
}
/* #endif */

.glass-tabbar-indicator {
  --lens-prism-color: color-mix(in srgb, var(--app-accent) 58%, transparent);
  position: absolute;
  z-index: 0;
  top: 8rpx;
  bottom: 8rpx;
  left: 0;
  width: 25%;
  overflow: hidden;
  border: 1rpx solid color-mix(in srgb, var(--app-accent) 42%, rgba(255, 255, 255, 0.58));
  border-radius: 999rpx;
  background:
    radial-gradient(ellipse at 50% 26%, rgba(255, 255, 255, 0.42) 0%, transparent 68%),
    linear-gradient(112deg, color-mix(in srgb, var(--app-accent) 15%, rgba(255, 255, 255, 0.22)), color-mix(in srgb, var(--app-accent-2) 12%, rgba(255, 255, 255, 0.08)));
  box-shadow:
    inset 0 1rpx 0 rgba(255, 255, 255, 0.56),
    inset 0 -1rpx 0 rgba(255, 255, 255, 0.12),
    0 8rpx 24rpx rgba(0, 0, 0, 0.12),
    0 0 0 1rpx rgba(255, 255, 255, 0.08);
  transition: transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 120ms ease;
  will-change: transform;
}

/* #ifdef H5 */
@supports ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
  .glass-tabbar-indicator {
    -webkit-backdrop-filter: blur(4px) saturate(120%);
    backdrop-filter: blur(4px) saturate(120%);
  }
}
/* #endif */

.glass-tabbar-indicator::before {
  position: absolute;
  top: 2rpx;
  right: 12%;
  left: 12%;
  height: 35%;
  border-radius: 0 0 60% 60%;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0.15) 40%, transparent 100%);
  content: '';
  opacity: 0.76;
}

.glass-tabbar-indicator::after {
  position: absolute;
  z-index: 1;
  top: 0;
  bottom: 0;
  width: 42%;
  border-radius: inherit;
  content: '';
  opacity: 0;
  pointer-events: none;
  transition: opacity 200ms ease, transform 200ms ease;
}

.glass-tabbar-indicator.lens-dragging-right::after {
  left: 0;
  background: linear-gradient(90deg, var(--lens-prism-color, var(--app-accent)), transparent 92%);
  box-shadow: inset -8rpx 0 20rpx var(--lens-prism-color, var(--app-accent));
  opacity: var(--lens-prism-intensity);
  transform: translateX(-4rpx);
}

.glass-tabbar-indicator.lens-dragging-left::after {
  right: 0;
  background: linear-gradient(270deg, var(--lens-prism-color, var(--app-accent)), transparent 92%);
  box-shadow: inset 8rpx 0 20rpx var(--lens-prism-color, var(--app-accent));
  opacity: var(--lens-prism-intensity);
  transform: translateX(4rpx);
}

.glass-tabbar-indicator.reduce-motion {
  transition-duration: 1ms;
}

.glass-tabbar-indicator.is-dragging {
  opacity: 0.98;
  transition: none;
}

.glass-tabbar-item {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 25%;
  min-height: 116rpx;
  flex-direction: column;
  gap: 3rpx;
  padding: 0;
  background: transparent;
}

.tab-ripple {
  position: absolute;
  z-index: 0;
  top: 50%;
  width: 24rpx;
  height: 24rpx;
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(circle, color-mix(in srgb, var(--app-accent) 56%, transparent) 0%, color-mix(in srgb, var(--app-accent) 16%, transparent) 48%, transparent 72%);
  transform: translate(-50%, -50%) scale(0.2);
  animation: tab-ripple-expand 400ms cubic-bezier(0, 0, 0.2, 1) both;
}

.glass-tabbar-item::after {
  border: 0;
}

.glass-tabbar-icon {
  width: 42rpx;
  height: 42rpx;
  opacity: var(--app-tabbar-icon-opacity, 0.78);
  filter: var(--app-tabbar-icon-filter, none);
  transition: transform 160ms cubic-bezier(0.2, 0, 0, 1), opacity 120ms ease;
}

.glass-tabbar-item:active .glass-tabbar-icon {
  transform: scale(0.85);
  transition: transform 60ms ease;
}

.glass-tabbar-icon.tab-icon-pop {
  animation: tab-icon-pop 160ms cubic-bezier(0.2, 0, 0, 1) both;
}

.glass-tabbar-icon-wrap {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54rpx;
  height: 54rpx;
}

.glass-tabbar-label {
  position: relative;
  z-index: 1;
  color: var(--app-muted);
  font-family: var(--app-utility-font);
  font-size: 20rpx;
  font-weight: 650;
  letter-spacing: 1rpx;
  line-height: 26rpx;
  transition: opacity 120ms ease;
}

.glass-tabbar-item.active .glass-tabbar-icon {
  opacity: 1;
  filter: none;
  transform: translateY(-2rpx) scale(1.08);
}

.glass-tabbar-item.active .glass-tabbar-label {
  color: var(--app-text);
  font-weight: 760;
}

.glass-tabbar-item.is-swipe-preview .glass-tabbar-icon {
  opacity: 0.9;
  filter: none;
  transform: translateY(-1rpx) scale(1.04);
}

.glass-tabbar-item.is-swipe-preview .glass-tabbar-label {
  color: color-mix(in srgb, var(--app-accent) 72%, var(--app-text));
  font-weight: 730;
}

.theme-xuanye .glass-tabbar-shell {
  border-color: rgba(103, 255, 242, 0.28);
  background: linear-gradient(100deg, rgba(9, 16, 26, 0.78), rgba(19, 18, 31, 0.80));
  box-shadow: 0 16rpx 42rpx rgba(0, 0, 0, 0.42), inset 0 1rpx 0 rgba(103, 255, 242, 0.24);
}

.theme-xuanye .glass-tabbar-indicator {
  --lens-prism-color: rgba(103, 255, 242, 0.50);
  background:
    repeating-linear-gradient(0deg, transparent 0 5rpx, rgba(103, 255, 242, 0.06) 5rpx 6rpx),
    radial-gradient(ellipse at 50% 24%, rgba(191, 255, 252, 0.42), transparent 65%),
    linear-gradient(100deg, rgba(103, 255, 242, 0.19), rgba(143, 109, 255, 0.20));
  box-shadow: 0 0 20rpx color-mix(in srgb, var(--app-accent) 22%, transparent), inset 0 0 16rpx rgba(103, 255, 242, 0.12), inset 0 1rpx 0 rgba(255, 255, 255, 0.46), 0 8rpx 24rpx rgba(0, 0, 0, 0.18);
}

.theme-candy .glass-tabbar-shell {
  border-width: 2rpx;
  border-color: rgba(52, 42, 50, 0.78);
  background: linear-gradient(118deg, rgba(255, 255, 255, 0.68), rgba(255, 253, 244, 0.76));
  box-shadow: 4rpx 5rpx 0 rgba(85, 199, 232, 0.30), inset 0 1rpx 0 rgba(255, 255, 255, 0.72);
}

.theme-candy .glass-tabbar-indicator {
  --lens-prism-color: rgba(255, 255, 255, 0.60);
  border-width: 2rpx;
  border-color: rgba(52, 42, 50, 0.78);
  background: radial-gradient(ellipse at 50% 24%, rgba(255, 255, 255, 0.72), transparent 65%), linear-gradient(112deg, rgba(255, 255, 255, 0.70), rgba(255, 213, 232, 0.46));
  box-shadow: 3rpx 3rpx 0 rgba(52, 42, 50, 0.18), inset 0 1rpx 0 rgba(255, 255, 255, 0.80), 0 8rpx 20rpx rgba(85, 199, 232, 0.16);
}

.theme-sakura .glass-tabbar-indicator {
  --lens-prism-color: rgba(233, 122, 174, 0.42);
  border-color: rgba(233, 122, 174, 0.44);
  background: radial-gradient(ellipse at 50% 22%, rgba(255, 255, 255, 0.70), transparent 64%), linear-gradient(112deg, rgba(255, 207, 228, 0.48), rgba(211, 177, 255, 0.26));
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.72), inset 0 -1rpx 0 rgba(255, 255, 255, 0.22), 0 8rpx 24rpx rgba(233, 122, 174, 0.20);
}

.theme-cyber .glass-tabbar-indicator {
  --lens-prism-color: rgba(52, 214, 255, 0.50);
  background:
    linear-gradient(90deg, rgba(52, 214, 255, 0.10) 1rpx, transparent 1rpx),
    radial-gradient(ellipse at 50% 24%, rgba(154, 236, 255, 0.36), transparent 66%),
    linear-gradient(100deg, rgba(52, 214, 255, 0.18), rgba(109, 124, 255, 0.20));
  background-size: 18rpx 100%, 100% 100%, 100% 100%;
  box-shadow: 0 0 20rpx color-mix(in srgb, var(--app-accent) 22%, transparent), inset 0 0 18rpx rgba(52, 214, 255, 0.14), inset 0 1rpx 0 rgba(214, 248, 255, 0.46), 0 8rpx 24rpx rgba(0, 0, 0, 0.22);
}

.theme-cyber .glass-tabbar-shell {
  border-color: rgba(52, 214, 255, 0.44);
  background-image: linear-gradient(90deg, rgba(52, 214, 255, 0.09) 1rpx, transparent 1rpx), linear-gradient(180deg, rgba(8, 22, 45, 0.78), rgba(5, 14, 30, 0.82));
  background-size: 25% 100%, 100% 100%;
}

.theme-noirGold .glass-tabbar-shell {
  border-color: rgba(213, 175, 98, 0.48);
  background: linear-gradient(100deg, rgba(18, 14, 9, 0.80), rgba(31, 24, 15, 0.84));
  box-shadow: 0 16rpx 42rpx rgba(0, 0, 0, 0.46), inset 0 1rpx 0 rgba(242, 226, 181, 0.18);
}

.theme-noirGold .glass-tabbar-indicator {
  --lens-prism-color: rgba(213, 175, 98, 0.45);
  border-color: rgba(213, 175, 98, 0.62);
  background: radial-gradient(ellipse at 50% 24%, rgba(242, 226, 181, 0.34), transparent 66%), linear-gradient(100deg, rgba(213, 175, 98, 0.18), rgba(140, 106, 50, 0.20));
  box-shadow: inset 0 0 0 1rpx rgba(242, 226, 181, 0.16), inset 0 1rpx 0 rgba(242, 226, 181, 0.42), 0 8rpx 24rpx rgba(0, 0, 0, 0.24);
}

@keyframes tab-icon-pop {
  0% { transform: scale(0.94); }
  54% { transform: translateY(-2rpx) scale(1.07); }
  100% { transform: translateY(-2rpx) scale(1.08); }
}

@keyframes tab-ripple-expand {
  0% { opacity: 0.58; transform: translate(-50%, -50%) scale(0.2); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(8); }
}

@media (prefers-reduced-motion: reduce) {
  .glass-tabbar-indicator,
  .glass-tabbar-icon {
    transition-duration: 1ms;
  }

  .tab-ripple { display: none; }
}
</style>
