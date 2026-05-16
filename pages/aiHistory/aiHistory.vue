<template>
  <view class="history-page">
    <view class="topbar">
      <button class="back-button" @tap="goBack">‹</button>
      <view>
        <text class="eyebrow">AI HISTORY</text>
        <view class="title">AI 记录</view>
      </view>
      <button class="refresh-button" :loading="loading" @tap="refresh">↻</button>
    </view>

    <view class="filter-row">
      <button class="filter" :class="{ active: filter === 'all' }" @tap="setFilter('all')">全部</button>
      <button class="filter" :class="{ active: filter === 'summary' }" @tap="setFilter('summary')">总结</button>
      <button class="filter" :class="{ active: filter === 'chat' }" @tap="setFilter('chat')">问答</button>
    </view>

    <view class="status-card" v-if="errorMessage">
      <view class="status-title">无法读取 AI 记录</view>
      <text class="status-desc">{{ errorMessage }}</text>
      <button class="status-action" @tap="goProfile">去登录后端</button>
    </view>

    <view class="status-card" v-else-if="loading">
      <view class="status-title">正在同步 AI 记录</view>
      <text class="status-desc">从 FastAPI 后端读取总结和问答历史。</text>
    </view>

    <scroll-view class="history-list" scroll-y :show-scrollbar="false" v-else-if="visibleItems.length">
      <view class="history-item" v-for="item in visibleItems" :key="item.id" @tap="copyItem(item)">
        <view class="item-head">
          <text class="type-badge" :class="item.type">{{ item.type === 'summary' ? '总结' : '问答' }}</text>
          <text class="time-text">{{ item.displayTime }}</text>
        </view>
        <view class="item-title">{{ item.title }}</view>
        <text class="item-content">{{ item.content }}</text>
        <view class="tag-row" v-if="item.tags.length">
          <text class="tag" v-for="tag in item.tags" :key="tag">{{ tag }}</text>
        </view>
        <text class="provider">provider: {{ item.provider }}</text>
      </view>
    </scroll-view>

    <view class="empty-card" v-else>
      <view class="status-title">还没有 AI 记录</view>
      <text class="status-desc">在阅读器里使用 AI 总结或 AI 问答后，这里会显示历史记录。</text>
    </view>
  </view>
</template>

<script>
import { loadAIHistory } from '../../common/aiHistory.js'

export default {
  data() {
    return {
      items: [],
      filter: 'all',
      loading: false,
      errorMessage: ''
    }
  },
  computed: {
    visibleItems() {
      if (this.filter === 'all') return this.items
      return this.items.filter(item => item.type === this.filter)
    }
  },
  onShow() {
    this.refresh()
  },
  methods: {
    async refresh() {
      this.loading = true
      this.errorMessage = ''
      try {
        this.items = await loadAIHistory()
      } catch (error) {
        this.items = []
        this.errorMessage = error.message || '请先到“我的”页面登录后端。'
      } finally {
        this.loading = false
      }
    },
    setFilter(filter) {
      this.filter = filter
    },
    copyItem(item) {
      uni.setClipboardData({
        data: `${item.title}\n\n${item.content}`,
        success: () => uni.showToast({ title: '记录已复制', icon: 'none' })
      })
    },
    goProfile() {
      uni.switchTab({ url: '/pages/profile/profile' })
    },
    goBack() {
      const pages = getCurrentPages()
      if (pages.length > 1) {
        uni.navigateBack()
        return
      }
      uni.switchTab({ url: '/pages/profile/profile' })
    }
  }
}
</script>

<style>
.history-page {
  min-height: 100vh;
  padding: 58rpx 32rpx 120rpx;
  background: #1f1f1f;
}

button::after {
  border: 0;
}

.topbar {
  display: grid;
  grid-template-columns: 72rpx 1fr 72rpx;
  align-items: center;
  gap: 22rpx;
}

.back-button,
.refresh-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  padding: 0;
  border-radius: 999rpx;
  color: #f2f2f2;
  font-size: 44rpx;
  line-height: 1;
  background: #2d2d2d;
}

.eyebrow {
  color: #d85a3a;
  font-size: 22rpx;
  font-weight: 800;
}

.title {
  margin-top: 6rpx;
  color: #ffffff;
  font-size: 48rpx;
  font-weight: 900;
}

.filter-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: 30rpx;
}

.filter {
  height: 62rpx;
  padding: 0;
  border-radius: 999rpx;
  color: #cfcfcf;
  font-size: 25rpx;
  background: #2c2c2c;
}

.filter.active {
  color: #ffffff;
  background: #d44b2f;
}

.history-list {
  height: calc(100vh - 230rpx);
  margin-top: 26rpx;
}

.history-item,
.status-card,
.empty-card {
  margin-bottom: 22rpx;
  padding: 28rpx;
  border-radius: 18rpx;
  background: #2d2d2d;
}

.item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.type-badge {
  height: 42rpx;
  padding: 0 16rpx;
  border-radius: 999rpx;
  color: #061019;
  font-size: 22rpx;
  line-height: 42rpx;
  background: #7ad7c4;
}

.type-badge.chat {
  background: #f1bd70;
}

.time-text,
.provider,
.status-desc {
  color: #9d9d9d;
  font-size: 24rpx;
}

.item-title,
.status-title {
  margin-top: 18rpx;
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 800;
  line-height: 44rpx;
}

.item-content {
  display: block;
  margin-top: 14rpx;
  color: #dddddd;
  font-size: 28rpx;
  line-height: 42rpx;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 18rpx;
}

.tag {
  max-width: 100%;
  padding: 8rpx 14rpx;
  border-radius: 12rpx;
  color: #f3e7d5;
  font-size: 22rpx;
  line-height: 32rpx;
  background: rgba(216, 90, 58, 0.18);
}

.provider {
  display: block;
  margin-top: 18rpx;
}

.status-card,
.empty-card {
  margin-top: 28rpx;
}

.status-action {
  height: 70rpx;
  margin-top: 22rpx;
  padding: 0 24rpx;
  border-radius: 14rpx;
  color: #ffffff;
  font-size: 26rpx;
  background: #d44b2f;
}
</style>
