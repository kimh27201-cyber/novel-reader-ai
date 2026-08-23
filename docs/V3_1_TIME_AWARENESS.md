# 解码阅读 V3.1-A 时间感知前端实现

更新时间：2026-07-31

## 1. 本阶段结论

V3.1-A 已完成“时间感知 UI”的首个可交付增量。它只调整页面环境光、最近阅读书封的呼吸节奏和清晨空状态细节，不改变五主题身份，不进入阅读正文配色，也不改动后端接口、数据库、路由、书源、进度或 TTS 逻辑。

视觉原则仍是“书封是唯一会呼吸、会开门的对象”。时间只作为安静的环境层存在，不新增持续粒子或抢占内容注意力的装饰。

## 2. 时间分层

| 时段 | 时间范围 | 环境表现 | 最近书封节奏 |
| --- | --- | --- | --- |
| 清晨 | 05:00～08:59 | 微冷的顶部天光；空状态增加轻量茶标记 | 比主题默认快 400ms |
| 白天 | 09:00～16:59 | 保持主题默认背景 | 使用主题默认时长 |
| 傍晚 | 17:00～19:59 | 低强度暖色侧光 | 比主题默认慢 400ms |
| 深夜 | 20:00～04:59 | 轻微压暗并加入克制暖光 | 比主题默认慢 1200ms |

关闭“时间氛围”后统一回到白天基线，不再叠加环境光和节奏偏移。

## 3. 实现范围

- `common/timeAwareness.js`
  - 提供时段识别、配置回退、存储开关、根节点 Token 注入和状态事件。
  - 使用单次定时器等待下一个时段边界，不运行高频轮询。
  - 页面重新可见时刷新状态；提供卸载函数清理定时器和监听器。
- `App.vue`
  - 应用启动时安装调度器，回到前台时刷新。
  - 仅对 Tab 页面外壳叠加时间环境光，阅读器正文区域明确排除。
- `components/composite/DBookCover.vue`
  - 最近阅读书封的主题呼吸时长叠加时间偏移。
  - reduced-motion、非最近阅读、仪式中和页面隐藏时仍按原有规则停止动画。
- `pages/profile/profile.vue`
  - 新增“时间氛围”设置项，支持即时关闭和恢复，状态持久化。

公共接口：

- `getTimeSlot(value)`：返回 `morning/day/evening/night`。
- `getTimeExperience(value)`：返回当前时段体验配置。
- `applyTimeAwareness(options)`：写入根节点属性和 CSS Token。
- `installTimeAwareness(options)` / `uninstallTimeAwareness()`：管理自动调度生命周期。
- `saveTimeAwarenessEnabled(enabled, options)`：保存开关并立即应用。

根节点契约：

- `data-time-awareness="on|off"`
- `data-time-slot="morning|day|evening|night"`
- `--app-time-ambient`
- `--app-time-breathe-offset`
- `--app-time-motion-scale`

## 4. 验证结果

- 全量前端测试：76/76 通过。
- 时间逻辑测试：四个边界、次日边界、开关持久化、事件、调度和卸载清理通过。
- UI 接线测试：App 安装、书封 Token、个人页设置入口通过。
- HBuilderX H5 生产构建：通过，产物位于 `.v3-build/h5`。
- Playwright：15/15 五主题截图生成成功；375px、393px、412px 共 9 个核心视口均无横向溢出。
- 时间氛围真实 DOM：深夜自动识别、关闭回到白天、恢复深夜均通过。
- 阅读器目录和设置面板连续开关：通过；浏览器 `pageerror` 为 0。
- Android WebView APK：重新构建完成，v1/v2/v3 签名有效。
- REA-AN00：覆盖安装成功；冷启动 776ms，复测 669ms；日志未发现本应用 `FATAL EXCEPTION` 或 ANR。验收期间存在真机手势切回桌面，events 日志记录为系统因 `SystemManagerSwipeUp` 终止后台进程，不属于应用崩溃。

验收产物：

- H5：`.v3-build/h5`
- APK：`.v3-build/android/release/V2.apk`
- 五主题截图：`output/v3-acceptance/*-{theme,bookshelf,reader}.png`

## 5. 下一增量

V3.1-B 建议实现“书封到阅读器”的轻量共享视觉接续：只复用书封几何信息与现有阅读仪式，不引入页面预渲染、全屏转场引擎或额外依赖。多层视差和特殊手势继续留在后续候选池。
