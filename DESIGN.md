# 解码阅读 — Design System

> 基于 Open Design `neon` + `minimal` 设计系统，融合项目现有视觉 tokens。
> 版本 1.0 · 2026-06-04

---

## 1. Visual Theme & Atmosphere

**暗黑霓虹解码** — 深色背景上高对比度霓虹光束，传达「数字解码」与「沉浸阅读」的双重气质。

- **主基调**：暗黑底部（`#0d1117` ~ `#20211f`），模拟终端/解码器氛围
- **霓虹层**：青霓虹 `#67fff2` 用于交互信号、边框发光、扫描线
- **暖色点缀**：暖橙 `#e25f35` 用于强调、进度、激活态
- **意图**：让阅读器在视觉上像一台「文字解码设备」，而非普通电子书

---

## 2. Color Palette

### 核心色板

| Token | Hex | HSL | 用途 |
|-------|-----|-----|------|
| **Neon Cyan** | `#67fff2` | 174° 100% 70% | 主交互信号、发光边框、扫描线、选中态 |
| **Warm Orange** | `#e25f35` | 16° 75% 55% | CTA 强调、进度条、激活态、书签 |
| **Deep Ink** | `#10181a` | 188° 25% 8% | 最深背景、阅读器夜间模式 |
| **Dark Surface** | `#20211f` | 90° 3% 13% | 页面背景、面板底色 |
| **Dark Panel** | `#2b2c2b` | 120° 1% 17% | 卡片、TabBar 背景 |
| **Muted Teal** | `#60757d` | 196° 13% 43% | 导航栏、次要表面 |
| **Light Text** | `#f4f9ff` | 212° 100% 98% | 深色背景上的正文 |
| **Muted Text** | `#d7dddc` | 170° 8% 85% | 辅助文字、非激活态 |
| **Dark Text** | `#20352f` | 163° 25% 17% | 浅色背景上的正文 |

### 阅读主题色板

| 主题 | 背景 | 正文 | 辅助 |
|------|------|------|------|
| 护眼夜 `eye` | `#10181a` | `#dfe8e4` | `#8fb1aa` |
| 清岚 `cool` | `#e9f5f2` | `#183433` | `#6b8c86` |
| 暖纸 `warm` | `#f7ecd8` | `#33291f` | `#8c765e` |
| 纸感 `paper` | `#fbf5e8` | `#2d261f` | `#786d61` |
| 薄荷 `mint` | `#e6f6ea` | `#193628` | `#628a71` |

### 语义色

| Token | Hex | 用途 |
|-------|-----|------|
| Success | `#16A34A` | 导入成功、检测通过 |
| Warning | `#D97706` | 书源失效、网络超时 |
| Danger | `#DC2626` | 解码失败、错误状态 |

### 使用原则
- **Neon Cyan 是交互的唯一信号色** — 悬停、聚焦、选中、进度均用此色或其半透明变体
- **Warm Orange 仅用于需要用户注意的关键节点** — 每个视图不超过 2 处
- **不在同一界面混合超过 3 个强调色**
- 深色表面上的文字必须满足 WCAG AA 对比度（≥ 4.5:1）

---

## 3. Typography

### 字体族

| 角色 | 字体 | 用途 |
|------|------|------|
| **UI 正文** | `-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif` | 界面文字、按钮、标签 |
| **阅读正文** | `"PingFang SC", "Microsoft YaHei", "KaiTi", "STKaiti", serif` | 阅读器内小说内容 |
| **品牌/标题** | `"PingFang SC", "Microsoft YaHei", sans-serif` | 页面标题、导航 |

### 字号层级

| 层级 | 大小 | 用途 |
|------|------|------|
| Display | `48rpx` (24px) | 页面主标题 `.screen-title` |
| Heading | `34rpx` (17px) | 章节标题 `.chapter-title` |
| Subhead | `26-30rpx` (13-15px) | 面板标题、列表项 |
| Body | `24rpx` (12px) | 正文、按钮文字 |
| Caption | `20-22rpx` (10-11px) | 辅助信息、元数据 |
| Reader | `16-20px` (可变) | 阅读器内正文 |

### 字重
- **Display/Heading**: `700-800` (bold/extrabold)
- **Body**: `400-500` (regular/medium)
- **Caption**: `400-500`

---

## 4. Spacing & Grid

### 间距尺度

| Token | rpx | 用途 |
|-------|-----|------|
| `space-xs` | `8rpx` | 图标与文字紧贴 |
| `space-sm` | `14-18rpx` | 标签间距、行内元素 |
| `space-md` | `24-28rpx` | 卡片内边距、列表项间距 |
| `space-lg` | `34-40rpx` | 页面边距、区块间距 |
| `space-xl` | `64rpx` | 大区块分离 |

### 布局约束
- 页面最大宽度：`1120px`，水平居中
- 移动端（< 760px）：全宽，内边距收紧至 `18-24rpx`
- 阅读器内容区宽度：默认 `88%`，可调范围 `72%–98%`

---

## 5. Layout & Composition

### 页面结构
```
┌─ Top Bar (导航/标题) ─┐
├─ Hero / Filter Zone  ─┤
├─ Main Content         ─┤
│  (列表 / 卡片 / 阅读)  │
├─ Bottom Chrome        ─┤
│  (TabBar / 控制栏)     │
└───────────────────────┘
```

### 原则
- **先留白，后边框** — 用间距分隔内容块，避免过度使用分割线
- **层级递进**：标题 → 辅助说明 → 主要内容 → 主要操作
- **浮动面板**：设置面板、目录面板使用 `position: fixed/absolute` + 大圆角 + 阴影，从底部或侧边滑入
- **TabBar 悬浮**：在 H5 端悬浮于底部中央，带圆角和阴影

---

## 6. Components

### 按钮
| 类型 | 样式 | 用途 |
|------|------|------|
| **Primary** | 暖橙背景 `#e25f35` + 白色文字 | 主要操作（重试、确认） |
| **Secondary** | 半透明底 + 霓虹青边框 | 次要操作（目录、设置） |
| **Ghost** | 透明底 + 当前文字色 | 导航图标、更多菜单 |
| **Theme Chip** | 主题背景色 + 主题文字色 | 阅读主题切换 |

### 卡片
- 圆角：`16-22rpx`
- 背景：`var(--app-panel)`（跟随主题）
- 边框：`1rpx solid var(--app-border)`
- 阴影：`var(--app-shadow)` / `var(--app-floating-shadow)`

### 输入框
- 最小高度：`64rpx`
- 内边距：`0 22rpx`
- 边框：`1rpx solid var(--app-border)`
- 圆角：`18rpx`

### 滑块
- 激活色：`#df7458`（暖橙）
- 轨道：`rgba(128, 128, 128, 0.22)`
- 高度：`10rpx`

### 阅读器专属
- **阅读表面**：`display: flex; flex-direction: column; padding: 88rpx 0 80rpx`
- **段落**：`text-indent: 2em; white-space: pre-wrap`
- **进度条**：底部固定，半透明背景 + 暖橙填充
- **章节信息**：顶部半透明，字号 `22-23rpx`

---

## 7. Motion & Interaction

### 动效原则
- 过渡时长：`150-250ms`
- 缓动曲线：`ease` / `ease-out`（默认），关键状态用 `cubic-bezier`
- 阅读器翻页：支持 `slide`（滑动）、`cover`（覆盖）、`none`（无动画）

### 关键动效
| 场景 | 效果 |
|------|------|
| 面板弹出 | `opacity` + `transform: translateY`，200ms ease-out |
| 按钮 hover/active | `scale(0.96-0.98)` + `opacity: 0.86` |
| 主题切换 | `background` + `color` 过渡，200ms ease |
| 沉浸模式 | 控制栏 `opacity` 渐隐，5.2s 自动隐藏 |
| 霓虹扫描线 | `background-position` 动画，`neonFlow` 关键帧 |

### 交互状态覆盖
每个交互元素必须定义：**hover · focus-visible · active · disabled · loading**

---

## 8. Voice & Brand

### 品牌名称
**解码阅读** — Decode Reading

### 品牌调性
- **技术感**：使用「解码」「解析」「书源」「规则」等术语
- **确定性**：操作反馈明确（成功 / 失败 / 进行中），错误信息可理解
- **亲和力**：加载文案用「正在为你解析…」而非「Loading…」

### 微文案规范
- 按钮：动词优先 ——「加入书架」「重新解码」「一键导入」
- 空态：说明当前状态 + 提供操作入口
- 错误：告知原因 + 提供解决方案（重试 / 换源 / 检查网络）
- Toast：简短、无标点、2 秒内可读完

---

## 9. Anti-Patterns

### 严格禁止

1. ❌ **引入色板外的颜色** — 所有新增颜色必须来自上述 palette 或通过 CSS 变量派生
2. ❌ **扁平化层级** — 不得将所有文字设为相同字号和字重
3. ❌ **装饰性效果干扰可读性** — 不使用模糊、过度阴影、无意义的渐变
4. ❌ **混合不相关的视觉隐喻** — 不在同一界面混用霓虹 + 纸质 + 3D 等风格
5. ❌ **AI 廉价感通病** — 禁止：紫蓝渐变、无意义的玻璃卡片、三卡特性行、过度圆角、空洞的营销形容词、装饰性 blob 图形
6. ❌ **忽略交互状态** — 每个可交互元素必须有 focus-visible、active、disabled 状态的视觉表示
7. ❌ **硬编码色值** — 组件中必须使用 CSS 变量（`var(--app-*)`），便于主题切换
