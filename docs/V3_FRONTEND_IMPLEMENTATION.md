# 解码阅读 V3 前端实现状态

更新时间：2026-07-31

## 1. 交付结论

本轮 6～8 周 MVP 计划中的前端实现已落地，覆盖 H5 与 Android WebView 主链路。未新增后端接口、数据库字段、页面路由或 npm 依赖；现有书源导入、搜索、阅读进度、书签、TTS 和后端连接逻辑保持不变。

设计收口遵循“书封是唯一会呼吸、会开门的对象”：只有最近阅读书籍运行低频呼吸，阅读正文区域不放置常驻粒子、呼吸或视差。

## 2. 已实现范围

### 体验配置与公共接口

- 新增 `common/v3Experience.js`，集中定义五主题的动效性格、仪式、stagger、阅读器入场和翻页类型。
- 提供 `getThemeExperience`、`stableBookPhase`、`getShelfEnterDelay`、`buildReaderRitualUrl` 和 `getReaderEntryClass`。
- `common/appTheme.js` 新增 `morphAppTheme` 与 `cancelAppThemeMorph`，支持预览、同步持久化、快速切换取消、事件通知和 reduced-motion。
- 主题 Morphing 只作用于主要容器、导航、面板和按钮；背景使用固定覆盖层交叉淡入，不使用全局 `*` 过渡。

### 首批公共组件

- `components/base/DButton.vue`
- `components/composite/DBookCover.vue`
- `components/composite/DEmptyState.vue`
- `components/feedback/DBottomSheet.vue`
- `components/feedback/DModal.vue`
- `components/feedback/DSkeleton.vue`

### 书架与导航

- 书架封面、空状态、操作面板和删除确认已组件化。
- 最近阅读书籍使用稳定相位的 5～6 秒轻呼吸；页面隐藏或卸载后停止。
- 保留左滑删除与长按菜单；左滑展开时点击优先收起，不误进阅读器。
- 首次列表 stagger 单项不超过 55ms、总等待不超过 350ms，超过 20 本自动关闭。
- 自定义 Tab 导航增加 400ms 涟漪、拖动速度形变和一次性反馈，不引入内容区全屏横滑。

### 阅读仪式与阅读器

- 五主题实现轻量 CSS 阅读仪式，并使用 `idle → opening → navigating` 状态锁防止重复跳转。
- 在仪式约 40% 时保留 `bookId` 并追加可选 `entry=ritual&themeId=<id>`；导航失败或超时自动解锁。
- 阅读器兼容原 `bookId/chapterIndex/pageIndex` 参数，并支持主题化短入场。
- 顶部、底部控制栏采用方向明确的进入/退出反馈。
- 目录和设置均接入 `DBottomSheet`，支持遮罩关闭、返回键和连续开关。
- 翻页按主题体验配置分型；加载失败、TTS 播放、连续滚动和快速章节切换时关闭装饰动画。
- 阅读进度同时保留轨道与数字信息。
- 阅读配色仍由用户原有阅读偏好控制；V3 应用主题纹理不再被行内 `background` 简写清除。

### 次要页面

- 搜索页接入 `DSkeleton` 和主题化 `DEmptyState`，并保留原并发搜索逻辑。
- 书源页接入 `DEmptyState`、`DSkeleton` 和 `DButton`，未改写导入、预览、检测与删除流程。
- 我的页主题选择统一通过 `morphAppTheme` 预览和保存，保留七次点击版本号调试入口。

## 3. 验证结果

- 全量前端测试：89/89 个 `tests/*.test.mjs` 文件通过。
- HBuilderX H5 生产编译：通过，产物位于 `.v3-build/h5`。
- Playwright：15 张主题验收截图生成完成。
- 375px、393px、412px：书架、我的、阅读器共 9 个视口检查均无横向溢出。
- 目录/设置 BottomSheet：打开和关闭连续操作通过。
- 浏览器 `pageerror`：0。
- Android WebView APK：构建和签名校验通过，v1/v2/v3 签名有效。
- 真机：REA-AN00 覆盖安装成功，最终 APK 冷启动 487ms，应用进程无 `FATAL EXCEPTION`。
- 真机主链路：书架 → 点击书籍 → 阅读器通过，已有书籍和阅读进度保留。

验收产物：

- H5：`.v3-build/h5`
- APK：`.v3-build/android/release/V2.apk`（文件名沿用现有打包脚本，内容为本轮 V3 H5）
- 五主题截图：`output/v3-acceptance/*-{theme,bookshelf,reader}.png`
- 真机截图：`output/v3-acceptance/android-real-device.png`、`android-real-device-reader.png`

## 4. 常用验证命令

在 `D:\Codex\novel-reader-uniapp` 执行：

```powershell
$failed=@(); Get-ChildItem tests -Filter *.test.mjs | Sort-Object Name | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { $failed += $_.Name } }; if ($failed.Count) { throw "Failed: $($failed -join ', ')" }
```

H5 生产编译使用 HBuilderX 自带 uni-app CLI，并将 `UNI_INPUT_DIR` 指向项目、`UNI_OUTPUT_DIR` 指向 `.v3-build\h5`。

APK 构建：

```powershell
.\scripts\build_android_webview_apk.ps1 `
  -H5RootOverride '.\.v3-build\h5' `
  -BuildRootOverride '.\.v3-build\android\build' `
  -AssetsRootOverride '.\.v3-build\android\assets\www' `
  -ReleaseRootOverride '.\.v3-build\android\release'
```

## 5. 仍需专项量化的验收项

- 当前环境未安装 Lighthouse，未给项目新增依赖，因此尚未生成正式 Lighthouse Performance 分数。
- 真机已完成启动和主链路验证，但未录制 Perfetto/SurfaceFlinger 帧时间，60fps/最低 30fps 仍需专项性能采样确认。
- 这两项属于量化验收，不影响本轮功能实现、H5 编译、APK 构建和真机主链路结果。

## 6. 按计划继续暂缓

- 时间感知 UI、共享元素跨页面过渡、多层视差。
- SVG Path Morph、JS 弹簧物理引擎。
- 摇晃、双指缩放和彩蛋手势。
- 全页面重型粒子与独立转场引擎。
- 小程序与 nvue 强兼容。

## 7. V3.1-A 后续增量（2026-07-31）

原暂缓项中的“时间感知 UI”已完成首个轻量增量，具体实现、接口和验收结果见 `docs/V3_1_TIME_AWARENESS.md`。共享元素跨页面过渡、多层视差和特殊手势仍保持暂缓。

## 8. V3.1-B 后续增量（2026-08-01）

“书封到阅读器”的轻量共享视觉接续已经完成，具体实现、降级策略和验收范围见 `docs/V3_1_SHARED_BOOK_TRANSITION.md`。本阶段只复用书封几何和主题装帧信息，不引入页面预渲染、全屏转场引擎或额外依赖；多层视差和特殊手势继续暂缓。

## 9. V3.1-C 后续增量（2026-08-01）

书架轻量视差的首个受控增量已经完成，具体实现、位移上限、降级策略和验收结果见 `docs/V3_1_SCROLL_PARALLAX.md`。本阶段只增加书架空间过渡带，不移动书籍列表，不引入全页面多层视差、FLIP 布局重排或特殊手势。

## 10. V3.1-D 后续增量（2026-08-01）

书架“列表 ↔ 紧凑”布局的轻量 FLIP 重排已经完成，具体几何算法、主题时长、取消策略和验收结果见 `docs/V3_1_LAYOUT_FLIP.md`。本阶段不改变书架数据与手势，只为现有布局切换补充可取消、可降级的归位反馈。

## 11. V3.1-E 后续增量（2026-08-01）

设备性能自动分档与书架装饰动效降级已经完成，具体阈值、功能矩阵、运行时接口和验收状态见 `docs/V3_1_PERFORMANCE_PROFILE.md`。本阶段只调整呼吸、视差、入场交错和布局 FLIP，不改变主题 Token、书籍数据、导航、阅读器、TTS 或后端行为。

最终验收已于 2026-08-03 完成：84/84 个前端测试文件通过，H5 三档浏览器实测通过，Android APK 构建与 v1/v2/v3 签名通过，REA-AN00 保留数据覆盖安装及书架 → 阅读器主链路通过，冷启动 912ms，未发现崩溃或 ANR。

## 12. 主题面板交互优化（2026-08-03）

根据 Android 录屏完成主题面板可达性和切换流畅度修复：弹层改为视口固定，底部应用栏无需滚动即可操作；主题预览使用 `requestAnimationFrame` 合并，并以 220ms View Transition 完整画面交叉淡化取代彩色幕布和分区颜色过渡。旧版 WebView、低性能设备和 reduced-motion 均保留短时无位移降级；应用只保存当前预览，不重复播放动画。

## 13. APK 冷启动主题连续性（2026-08-10）

- Android 原生窗口和 WebView 启动面读取上次保存主题，支持玄夜、糖果、樱雾、量子和黑曜五套背景与系统栏明暗。
- 启动阶段显示轻量“解码阅读 / DECODING READER”品牌标识，WebView 在后台加载，Vue 首帧就绪后一次性显示页面。

- `main.js` 在 Vue 挂载前调用 `primeAppTheme()` 恢复 Token，并在双 `requestAnimationFrame` 后通过 `NovelReaderLaunch.ready()` 完成原生/H5 交接。
- WebView 缓存策略从每次强制清空改为 `LOAD_DEFAULT`，保留 5 秒异常兜底与页面完成兜底。
- 全量前端测试更新为 89/89；H5 生产构建、APK v1/v2/v3 签名和 REA-AN00 覆盖安装通过。
- 糖果主题二次冷启动由 `vue-ready` 完成交接，实测 1281ms；全程不再出现系统白色空屏。

## 14. 中文长篇分页稳定性（2026-08-10）

- 阅读器改为按真实可视高度测量分页，并在测量完成后一次性提交结果，不再先显示粗分页面再二次重排。
- 分页优先保留完整段落和句子；段落边界导致页面留白过大时，继续寻找更靠后的完整句末。页首避开逗号、句号、右引号等标点，页尾避开左引号和左括号。
- 相邻末页会平衡过短的段落尾巴；跨页首段取消重复首行缩进，正文使用严格中文换行规则，并保留底部安全行高。
- 首次长章节测量使用固定悬浮提示，设置变更时保留当前页直至新布局完成；翻页只改变透明度，不再过渡正文宽度。
- 自动测试新增短尾平衡、标点避头尾、长章节测量次数和原子提交约束。375px、393px、412px 浏览器视口均无横向或纵向溢出，连续翻页时正文容器几何位置保持不变。
- Android WebView APK 已构建、签名、覆盖安装，并完成真实章节打开和连续点击翻页录屏；未发现应用 FATAL 或 ANR。
