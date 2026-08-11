# 解码阅读 V3.1 主题面板交互优化

更新时间：2026-08-03

## 1. 用户问题

根据 `SVID_20260803_182454_1.mp4`（9.53 秒、576×1280）复现出两个问题：

- 主题面板打开后底部“取消/应用”不可见，必须继续上滑整个页面。
- 主题卡点击后存在约 120ms 人为等待，并叠加 480ms 高不透明度全屏覆盖和强制同步重排，Android WebView 中显得缓慢、闪暗。

## 2. 根因与修复

主题面板原本嵌套在带页面转场 `transform` 的 `.profile-page` 内。Android WebView 会让其 `position: fixed` 相对该滚动容器定位，因此弹层和操作栏会跟随页面滚动。

本次修改：

- 将遮罩和主题面板移到 `.profile-page` 外，直接作为 `.tab-page-shell` 子元素，恢复相对视口固定。
- 为弹层设置确定高度；头部与底部操作栏固定，仅中间 `.theme-grid` 独立滚动。
- 操作栏使用主题面板背景，始终停靠在自定义 Tab 栏上方。
- 主题预览等待从 120ms 缩短到 32ms。
- 预览 Morphing 默认从 480ms 缩短到 260ms；主题 Token 在动画约 18% 时更新。
- 覆盖层改用主题纯色舞台 Token，峰值不透明度从 0.78 降到 0.34，只动画 `opacity/transform`。
- 使用 A/B 动画脉冲支持连续点选，不再通过 `offsetWidth` 强制同步重排。
- 结构表面只过渡颜色、背景色和边框色，移除切换过程中的圆角与阴影重绘。
- reduced-motion 仍保持 80ms 降级。

## 3. 验收结果

- 专项与全量前端测试：85/85 个 `tests/*.test.mjs` 文件通过。
- HBuilderX H5 生产构建通过，产物位于 `.v3-build/h5-theme-ux`。
- Chrome 专项验收：
  - 打开弹层时操作栏立即可见。
  - 主题卡区域滚动 98px 后，弹层与操作栏位置误差不超过 1px，页面本身未滚动。
  - 点击到主题 Token 更新实测 119ms，总预览时长 260ms。
  - 快速连续选择最终仅保留最后一个主题，动画结束后状态完整清理。
  - 浏览器 `pageerror` 为 0。
- 五主题完整 H5 回归通过：15 张截图、9 个核心视口、共享书封、视差、FLIP、三性能档位、reduced-motion 和阅读器面板均通过。
- Android WebView APK 构建及 v1/v2/v3 签名通过，产物位于 `.v3-build/android-theme-ux/release/V2.apk`。
- APK SHA-256：`280071ECF3B6479AED58F071A49171C34C94D20850937927F4DA609E8C58EC3C`。
- REA-AN00 保留数据覆盖安装成功，冷启动 852ms；按录屏路径打开面板后按钮首屏可见，切换并应用“量子蓝图”成功，未发现 `FATAL EXCEPTION` 或 ANR。

## 4. 验收产物

- H5 专项结果：`output/theme-panel-ux/result.json`
- H5 初始/切换截图：`output/theme-panel-ux/theme-panel-initial.png`、`theme-panel-switched.png`
- Android 初始/切换/应用截图：`output/theme-panel-ux/android-panel-initial.png`、`android-panel-switched.png`、`android-theme-applied.png`
- 专项验收脚本：`scripts/theme_panel_ux_check.mjs`

本次未新增依赖、后端接口、页面路由或存储字段。
