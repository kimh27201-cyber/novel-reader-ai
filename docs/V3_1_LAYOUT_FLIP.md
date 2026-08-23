# 解码阅读 V3.1-D 书架布局 FLIP 重排

更新时间：2026-08-01

## 1. 阶段结论

V3.1-D 已完成书架“列表 ↔ 紧凑”布局的轻量 FLIP 重排。书籍行在切换前后通过稳定 `bookId` 匹配，视觉上像书籍重新归位，而不是瞬间压缩或通用卡片弹跳。

本阶段只改变布局切换的视觉反馈，不改变书架数据、布局持久化、左滑删除、长按菜单、书封仪式、共享书封和滚动视差逻辑。

## 2. 实现范围

- `common/layoutFlip.js`
  - 规范化布局矩形并计算 First/Last 的位移与缩放差。
  - 使用浏览器原生 Web Animations 播放 `transform` 归位，不新增依赖。
  - 每条动画使用 `layout-flip:<bookId>` 标识，便于取消、诊断和验收。
  - 提供 capture、play、cancel 和 destroy；连续切换先取消旧动画。
- `common/v3Experience.js`
  - 五主题新增 `layoutFlipMs`：玄夜 240ms、糖果 300ms、樱雾 280ms、量子 220ms、黑曜 300ms。
  - easing 继续复用各主题已有动效曲线。
- `pages/bookshelf/bookshelf.vue`
  - 书籍行增加稳定 `data-book-id`。
  - 切换前捕获旧矩形，Vue 完成布局更新后读取新矩形并播放 FLIP。
  - 切换前主动收起左滑项，避免 FLIP 与删除位移同时作用。
  - 页面隐藏时取消动画，卸载时销毁控制器；reduced-motion 下只切换布局，不播放动画。

## 3. 公共接口

- `normalizeLayoutRect(input)`：返回可计算的矩形数据，无效尺寸返回 null。
- `computeLayoutFlip(first, last)`：计算位移、缩放和逆变换字符串。
- `captureLayoutRects(elements, options)`：按稳定键捕获一组元素矩形。
- `createLayoutFlipController(options)`：创建可取消的 FLIP 控制器。
- `LAYOUT_FLIP_DURATION`：未指定主题时的默认时长，值为 260ms。

## 4. 降级与边界

- reduced-motion 下跳过动画，但布局切换和本地持久化保持正常。
- DOM、Web Animations 或元素矩形不可用时直接完成布局，不阻塞操作。
- 只对当前已渲染书籍行执行动画；长列表未渲染项不创建动画。
- 动画只使用 `transform`，完成后主动取消 fill 状态，不残留行级 transform。
- 页面隐藏、卸载或再次切换布局时立即取消旧动画。

## 5. 验收结果

- 全量前端测试：82/82 个 `tests/*.test.mjs` 文件通过。
- H5 生产构建通过，产物位于 `.v3-build/h5-v31d`。
- Playwright 五主题验收通过：15 张截图、共享书封 5/5、视差滚动、多视口和阅读器控制面板均通过，浏览器 `pageerror` 为 0。
- 黑曜主题列表切换紧凑布局时，两本可见书籍均产生 300ms FLIP 动画；动画完成后残留动画数为 0。
- reduced-motion 下布局从紧凑切回列表，FLIP 动画数为 0。
- Android WebView APK 构建及 v1/v2/v3 签名校验通过，产物位于 `.v3-build/android-v31d/release/V2.apk`。
- REA-AN00 保留数据覆盖安装成功；冷启动 695ms，进程日志未发现 `FATAL EXCEPTION` 或 ANR，`tcp:8765` 反向映射正常。

下一候选优先进行低性能设备动效分级与自动降级；全局特殊手势继续暂缓。
