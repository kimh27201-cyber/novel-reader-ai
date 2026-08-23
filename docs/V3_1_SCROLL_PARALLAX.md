# 解码阅读 V3.1-C 书架轻量视差

更新时间：2026-08-01

## 1. 阶段结论

V3.1-C 已完成视差滚动系统的首个受控增量。实现只作用于书架顶部与书籍列表之间的“空间过渡带”，书籍内容保持正常滚动速度，点击、左滑删除、长按、下拉刷新和共享书封接续均不改变。

本阶段没有实现全页面多层视差、浮动按钮位移、FLIP 布局重排或特殊手势。视觉上继续保持“书封是唯一会开门的对象”，视差只负责表达书架空间深度，不成为第二个视觉主角。

## 2. 实现范围

- `common/scrollParallax.js`
  - 将滚动距离限制在 0～180px 的有效区间。
  - 输出环境光、分界线和刻度三层位移，以及过渡带透明度。
  - 使用 `requestAnimationFrame` 合并同一帧内的高频滚动事件。
  - 支持 reset、destroy、页面隐藏和 reduced-motion 即时归零。
- `pages/bookshelf/bookshelf.vue`
  - 接入 `<scroll-view>` 原生滚动事件，不改变列表自身 transform。
  - 通过 CSS 变量传递三层位移，动画属性仅使用 `transform` 和 `opacity`。
  - 五主题继续复用现有 Token，只调整过渡带的线条、刻度和环境光形态。
  - 页面恢复时按已保存的滚动位置恢复深度；隐藏时停止并归零，卸载时销毁控制器。

## 3. 位移约束

滚动 180px 后达到上限：

- 环境光层：-9px。
- 空间分界线：-18px。
- 主题刻度：+12.6px。
- 透明度：0.28 → 0.60。

继续滚动不会扩大位移，避免长列表中背景层持续偏移。reduced-motion 下三层位移统一为 0，保留静态主题装饰。

## 4. 公共接口

- `getScrollParallaxFrame(scrollTop, options)`：返回当前滚动位置对应的受限视差帧。
- `createScrollParallaxController(onFrame, options)`：创建按帧合并控制器，提供 `update/reset/destroy`。
- `SCROLL_PARALLAX_MAX_SCROLL`：当前最大有效滚动距离，值为 180。

## 5. 验收结果

- 全量前端测试：80/80 个 `tests/*.test.mjs` 文件通过。
- H5 生产构建通过，产物位于 `.v3-build/h5-v31c`。
- Playwright 五主题验收通过：15 张截图、9/9 核心视口无横向溢出、共享书封 5/5、目录与设置连续开关正常、浏览器 `pageerror` 为 0。
- 浏览器滚动 120px 时实测位移为：环境光 -6px、分界线 -12px、刻度 +8.4px；reduced-motion 下均为 0px。
- Android WebView APK 构建及 v1/v2/v3 签名校验通过，产物位于 `.v3-build/android-v31c/release/V2.apk`。
- REA-AN00 保留数据覆盖安装成功；冷启动 1380ms，进程日志未发现 `FATAL EXCEPTION` 或 ANR，`tcp:8765` 反向映射正常。

下一候选为书架“列表 ↔ 紧凑”布局的轻量 FLIP 重排；特殊手势和全页面多层视差继续暂缓。
