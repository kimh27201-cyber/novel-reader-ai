# 底部导航栏 — 玻璃屏滑动选择动画 专项计划

> 日期：2026-07-16
> 目标文件：`custom-tab-bar/index.vue`（当前 282 行）
> 原则：只升级动画和视觉，不改架构和功能逻辑

---

## 〇、当前状态诊断

### 已具备的能力（保留）

| 能力 | 状态 | 说明 |
|------|------|------|
| 触摸滑动手势 | ✅ | touchstart/move/end 完整实现，阈值 22% 屏宽 |
| 指示器跟手拖拽 | ✅ | `tabSwipeOffset` 实时映射到 `indicatorStyle` |
| 预览高亮相邻 Tab | ✅ | `tabSwipePreviewIndex` 切换图标+标签色 |
| Spring 弹性曲线 | ✅ | `cubic-bezier(0.34, 1.56, 0.64, 1)` 380ms |
| 图标弹跳动画 | ✅ | `tab-icon-pop` 三段式弹簧 |
| 玻璃态外壳 | ✅ | `backdrop-filter: blur(18px)` + 高光渐变条 |
| 各主题差异化 | ✅ | 5 个主题独立样式 |

### 当前不足——缺少"玻璃屏"质感

```
现状：指示器是一个不透明的圆角药丸（毛玻璃感不足）
     ↓
     滑动时只是 translate3d 线性平移 + 颜色微调
     ↓
     缺少玻璃镜片特有的「折射」「聚光」「边缘光晕」
```

核心问题：当前指示器**看起来像一块实色卡片在滑动**，而不是**一块玻璃透镜在导航栏上滑过**。

---

## 一、目标效果

> 一块椭圆形毛玻璃镜片在底部导航栏上左右滑动。镜片覆盖的区域：背景被放大/增亮、文字更清晰、图标更饱和，镜片边缘有微弱的棱镜光晕。手指拖动时镜片跟手，松手后弹簧吸附到最近的 Tab。

### 视觉关键词

```
镜片材质：frosted glass lens（磨砂玻璃透镜）
边缘效果：prismatic edge glow（棱镜边缘微光）
覆盖效果：illuminated + sharpened（照亮+锐化）
滑动物理：magnetic snap with overshoot（磁性吸附+过冲回弹）
```

---

## 二、动画分层设计

每个 Tab 切换涉及 **5 层并发动画**：

```
图层 0：玻璃底板    — 高光条随滑动方向偏移
图层 1：镜片位移    — translateX 跟手 → 松手弹簧吸附
图层 2：镜片形变    — 滑动中宽度微压缩 → 静止回弹至标准宽度
图层 3：镜片边缘光  — 滑动方向一侧边缘增亮（棱镜折射）
图层 4：内容层响应  — 镜片覆盖的图标/文字亮度提升、饱和度增强
```

### 2.1 镜片位移（核心）

```
跟手阶段：
  指示器 translateX = activeIndex * 25% + (swipeOffset / windowWidth) * 100%
  无 transition（实时跟手，零延迟）

松手阶段：
  判定目标 Tab → 指示器 spring 吸附到目标位置
  transition: transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1)
  overshoot 8% → 回弹 → 稳定
```

### 2.2 镜片形变（果冻压缩）

```
跟手向右滑时：
  镜片左侧被压缩，右侧拉伸
  scaleX: 0.94  ← 滑动越快压缩越明显（上限 ±6%）
  transform-origin: 滑动方向的反侧

松手后：
  scaleX: 0.94 → 1.03 → 1.00（弹簧回弹，240ms）
```

### 2.3 镜片边缘棱镜光

```
镜片 ::before 伪元素 → 滑动方向侧出现渐隐光带

向右滑：
  left 侧：box-shadow inset -8rpx 0 20rpx rgba(255,255,255,0.4)
  right 侧：无

向左滑：
  right 侧：box-shadow inset 8rpx 0 20rpx rgba(255,255,255,0.4)
  left 侧：无

光带颜色根据主题变化：
  玄夜：rgba(103, 255, 242, 0.5)
  糖果：rgba(255, 255, 255, 0.6)
  樱雾：rgba(233, 122, 174, 0.4)
  量子：rgba(52, 214, 255, 0.5)
  黑曜：rgba(213, 175, 98, 0.45)
```

### 2.4 底板高光偏移

```
.glass-tabbar-shell::before（当前是静态高光渐变条）

改为跟手偏移：
  静止时：高光居中（50% 位置）
  向右滑：高光向右侧偏移（50% → 58%）
  向左滑：高光向左侧偏移（50% → 42%）

实现：background-position 跟随 tabSwipeOffset 变化
```

### 2.5 内容层响应

```
镜片覆盖的 Tab 内容（图标+文字）：
  图标：brightness(1.1) saturate(1.2) scale(1.06)
  文字：color 从 muted → text，font-weight 650 → 760
  过渡：跟随镜片位置渐进变化，不是突变

未覆盖的 Tab：
  图标：保持 opacity 0.78 + filter
  文字：保持 muted 色
```

---

## 三、镜片材质升级

### 3.1 当前指示器 → 玻璃透镜

```css
/* 当前：实色磨砂药丸 */
.glass-tabbar-indicator {
  border-radius: 999rpx;
  background: linear-gradient(..., var(--app-accent) 28%, ...);
  box-shadow: ...;
}

/* 升级为：玻璃透镜 */
.glass-lens {
  /* 透镜主体：高透玻璃 */
  background:
    radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.35) 0%, transparent 70%),
    linear-gradient(112deg,
      color-mix(in srgb, var(--app-accent) 15%, rgba(255,255,255,0.18)),
      color-mix(in srgb, var(--app-accent-2) 12%, rgba(255,255,255,0.08))
    );

  /* 透镜自身也有微弱的 backdrop-filter（套娃玻璃） */
  backdrop-filter: blur(4px) saturate(120%);

  /* 边缘：细边框 + 棱镜光晕 */
  border: 1rpx solid rgba(255, 255, 255, 0.45);
  box-shadow:
    inset 0 1rpx 0 rgba(255,255,255,0.5),    /* 顶部高光 */
    inset 0 -1rpx 0 rgba(255,255,255,0.1),    /* 底部弱反光 */
    0 8rpx 24rpx rgba(0,0,0,0.12),            /* 投影 */
    0 0 0 1rpx rgba(255,255,255,0.08);         /* 外晕 */
}
```

### 3.2 透镜曲面高光

```css
/* 透镜顶部的弧形高光 — 模拟曲面玻璃 */
.glass-lens::before {
  content: '';
  position: absolute;
  top: 2rpx;
  left: 12%;
  right: 12%;
  height: 35%;
  border-radius: 0 0 60% 60%;
  background: linear-gradient(180deg,
    rgba(255,255,255,0.55) 0%,
    rgba(255,255,255,0.15) 40%,
    transparent 100%
  );
  opacity: 0.8;
}
```

---

## 四、滑动物理参数

### 4.1 吸附阈值

```
松手判定：
  swipeOffset 绝对值 < 30% 指示器宽度（≈ 22% 屏宽 / 4 ≈ 20% 屏宽）
    → 回弹到当前 Tab

  swipeOffset 绝对值 ≥ 30% 指示器宽度
    → 吸附到相邻 Tab

松手时滑动速度 > 200px/s：
  → 无视阈值，直接切换到滑动方向 Tab（快速轻扫）
```

### 4.2 动效时间表

```
事件          | 镜片位移 | 镜片形变 | 边缘光 | 高光偏移 | 内容响应
-------------|---------|---------|--------|---------|----------
跟手拖动      | 0ms     | 实时     | 实时   | 实时    | 实时
松手回弹      | 280ms   | 420ms   | 200ms  | 280ms   | 200ms
松手吸附      | 420ms   | 420ms   | 280ms  | 280ms   | 280ms
tap 切换      | 380ms   | 320ms   | 200ms  | 280ms   | 200ms
```

### 4.3 跟手公式

```javascript
// 指示器位移
const dragPercent = clamp(swipeOffset / windowWidth * 100, -25, 25)
const targetX = activeIndex * 25 + dragPercent

// 镜片压缩（最大 8%）
const compressSpeed = Math.abs(swipeOffset) / windowWidth
const scaleX = 1 - Math.min(compressSpeed * 0.32, 0.08)

// 棱镜光偏转角
const prismAngle = Math.atan2(1, -swipeOffset) * (180 / Math.PI) // deg

// 高光偏移
const highlightShift = clamp(swipeOffset / windowWidth * 16, -8, 8) // percent
```

---

## 五、实施步骤

### Step 1：CSS 镜片样式（1.5h）

- 重写 `.glass-tabbar-indicator` 为 `.glass-lens`
- 添加透镜曲面高光 `::before`
- 添加棱镜边缘光 `::after`（动态方向）
- 5 个主题的透镜颜色微调

### Step 2：形变逻辑（1h）

- 新增 `lensScaleX` 计算属性
- 滑动中实时 scaleX 压缩
- 松手后弹簧回弹至 1.0

### Step 3：棱镜边缘光方向（45min）

- 新增 `prismEdgeStyle` 计算属性
- 根据滑动方向动态设置边缘光亮侧
- 动态 class 控制 `lens-dragging-left` / `lens-dragging-right`

### Step 4：底板高光偏移（30min）

- `.glass-tabbar-shell::before` 的 `background-position` 绑定 `tabSwipeOffset`
- 无滑动时归中

### Step 5：速度感知吸附（1h）

- 在 `onTabSwipeEnd` 中计算松手速度
- 速度 > 200px/s → 直接切换
- 速度 < 200px/s → 按阈值判定

### Step 6：各主题透镜微调（1.5h）

每个主题的透镜材质差异化：

| 主题 | 透镜色调 | 边缘光色 | 特殊处理 |
|------|---------|---------|---------|
| 玄夜 | 青荧光 | `rgba(103,255,242,0.5)` | 透镜带微弱的 scanline 纹理 |
| 糖果 | 暖白 | `rgba(255,255,255,0.6)` | 透镜边缘描粗黑边 |
| 樱雾 | 粉紫 | `rgba(233,122,174,0.4)` | 透镜高光带丝绸渐变 |
| 量子 | 冷蓝 | `rgba(52,214,255,0.5)` | 透镜带网格线纹理 |
| 黑曜 | 暖金 | `rgba(213,175,98,0.45)` | 透镜边框金色、高光偏暖 |

### Step 7：回归测试（1h）

- 5 个主题各验证一遍滑动切换
- tap 切换正常
- 同一 Tab 双击弹跳正常
- reduced-motion 降级正常
- H5 + Android 真机验证

---

## 六、改动范围

```
仅修改 1 个文件：
  custom-tab-bar/index.vue

改动量估算：
  <template>  5-10 行（新增动态 class/data 绑定）
  <script>   40-60 行（新增 lens 相关 computed + methods）
  <style>    80-120 行（重写 indicator 样式 + 新增 lens 动画）
  ─────────────────
  总计       ~150 行净增，文件从 282 → ~430 行
```

不碰页面文件、不碰 App.vue、不碰 common 模块。

---

## 七、验收标准

- [ ] 手指左右滑动时，镜片实时跟手（零延迟）
- [ ] 松手后镜片弹簧吸附到最近 Tab（overshoot + 回弹可见）
- [ ] 镜片覆盖的图标和文字明显更亮/更清晰
- [ ] 镜片边缘在滑动方向有棱镜微光
- [ ] 底板高光随滑动方向微偏移
- [ ] 快速轻扫直接切换（不卡在阈值边界）
- [ ] 5 个主题下镜片材质有明显差异
- [ ] reduced-motion 下所有动画降级为 1ms
- [ ] tap 点击切换依然正常工作
- [ ] 同一 Tab 双击仍有弹跳动画
