# 解码阅读 V3.1-B 共享书封视觉接续

更新时间：2026-08-01

## 1. 阶段结论

V3.1-B 已完成“书架书封 → 阅读器”的轻量共享视觉接续。实现只传递书籍标识、封面信息和点击时的几何位置，不预渲染阅读器页面，不接管路由，也不引入第三方动画依赖。

视觉签名仍保持单一：书封是唯一会“开门”的对象。已有五主题阅读仪式负责起势，共享书封在阅读器首帧完成短距离接续，正文区域不增加常驻动画、粒子或视差。

## 2. 实现范围

- `common/sharedBookTransition.js`
  - 捕获并规范化书封矩形，拒绝过小、越界或无效几何数据。
  - 使用内存中的一次性过渡快照，不写入本地存储，不改变书籍数据。
  - 快照与 `bookId` 绑定，默认 2200ms 过期，读取后立即消费。
  - 统一计算起点、终点、缩放比例和 360ms 动画时长。
- `pages/bookshelf/bookshelf.vue`
  - 点击书封或书籍信息时定位真实书封节点。
  - 只有几何捕获成功时才在原阅读器 URL 后追加 `shared=cover`。
  - 保留左滑优先收起、重复点击锁定、导航失败提示和 800ms 兜底。
- `pages/reader/reader.vue`
  - 仅在 `shared=cover`、书籍匹配且未启用 reduced-motion 时消费快照。
  - 支持真实封面和无封面回退，两者均继承五主题装帧特征。
  - 页面隐藏、卸载或切换为 reduced-motion 时立即清理共享层、仪式层和翻页动画。

## 3. 公共接口

- `captureSharedBookTransition(book, elementOrRect, options)`：捕获一次过渡快照。
- `peekSharedBookTransition(bookId, options)`：检查匹配且未过期的快照。
- `consumeSharedBookTransition(bookId, options)`：一次性消费快照。
- `clearSharedBookTransition()`：主动清空未消费快照。
- `getSharedBookFlightStyle(transition, options)`：生成仅包含 `transform`、`opacity` 动画所需的几何变量。

原阅读器路由参数保持兼容；新增的 `shared=cover` 仍是可选参数，缺失或异常时直接使用原进入方式。

## 4. 降级与边界

- reduced-motion 下不捕获、不消费、不显示共享书封，只保留原 80ms 淡入。
- 无法获得 DOM 几何、书籍不匹配、快照过期或直接打开阅读器时自动降级。
- 导航失败会清空快照，不让下一次阅读误用旧书封。
- 高频动画只改变 `transform` 和 `opacity`；共享层不响应触摸，不阻塞阅读器操作。

## 5. 验收

- 逻辑测试覆盖：矩形规范化、一次性消费、书籍匹配、超时、reduced-motion 和飞行动画变量。
- UI 契约覆盖：书架捕获、路由参数、阅读器消费、无封面回退、页面隐藏及动效偏好清理。
- 全量前端测试：78/78 个 `tests/*.test.mjs` 文件通过。
- H5 生产构建通过，产物位于 `.v3-build/h5-v31b`。
- Playwright 五主题验收通过：15 张截图、5/5 共享书封几何、9/9 核心视口无横向溢出、目录/设置连续开关正常、reduced-motion 正确跳过共享层、浏览器 `pageerror` 为 0。
- Android WebView APK 构建及 v1/v2/v3 签名校验通过，产物位于 `.v3-build/android-v31b/release/V2.apk`。
- REA-AN00 保留数据覆盖安装成功；冷启动 1275ms，`tcp:8765` 反向映射正常，进程日志未发现 `FATAL EXCEPTION` 或 ANR。

多层视差、特殊手势、页面预渲染和独立转场引擎继续留在候选池，不属于本阶段范围。
