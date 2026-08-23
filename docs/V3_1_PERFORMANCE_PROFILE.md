# 解码阅读 V3.1-E 设备性能自动分档

更新时间：2026-08-03

## 1. 阶段结论

V3.1-E 已完成设备性能自动分档。应用根据 CPU 逻辑核心数、可用内存、uni-app 设备基准值和 reduced-motion 状态，在启动与回到前台时选择“完整、均衡、轻量”三档；降级只减少书架装饰动效，不改变五主题 Token、阅读仪式参数、导航、阅读器、TTS、书源和后端接口。

“我的”页只展示当前自动档位，不增加容易与系统动效偏好冲突的手动性能开关。

## 2. 分档规则

| 档位 | 触发条件（满足任一） | 呼吸 | 书架视差 | 布局 FLIP | 列表 stagger |
| --- | --- | --- | --- | --- | --- |
| 完整 | 未命中下述降级条件 | 开 | 开 | 开 | 开，最多 20 项 |
| 均衡 | 基准值 ≤25、核心数 ≤4、内存 ≤4GB，或无法识别能力的 Android | 关 | 关 | 开 | 开，最多 12 项 |
| 轻量 | reduced-motion、基准值 ≤15、核心数 ≤2 或内存 ≤2GB | 关 | 关 | 关 | 关 |

设备上报的内存大于 32 时按 MB 转换为 GB；未知字段不单独触发降级。玄夜仍是异常主题配置的回退主题，性能档位不会改写主题选择。

## 3. 实现范围

- `common/performanceProfile.js`
  - 统一采集 `navigator.hardwareConcurrency`、`navigator.deviceMemory` 和 `uni.getSystemInfoSync()` 能力信息。
  - 提供纯函数分档、根节点属性同步、当前档位读取和 `app:performance-changed` 通知。
  - 根节点写入 `data-app-performance`，便于浏览器验收和后续样式诊断。
- `App.vue`
  - 启动及回前台重新计算档位。
  - 将现有 reduced-motion 结果传给性能分档，保证无障碍偏好优先。
- `pages/bookshelf/bookshelf.vue`
  - 完整档保留最近阅读书封呼吸、受控视差、FLIP 和列表交错。
  - 均衡档保留短时 FLIP 与有限交错，关闭常驻呼吸和滚动视差。
  - 轻量档关闭四类装饰动效，但布局切换和打开书籍仍立即执行。
  - 页面监听档位事件；隐藏、卸载或档位降级时取消旧动画并重置位移。
- `pages/profile/profile.vue`
  - 展示“完整档 / 均衡档 / 轻量档”。
  - 用户切换现有动效偏好后立即刷新自动性能档位。
- `scripts/v3_h5_visual_check.mjs`
  - 增加 2 核/2GB、4 核/4GB、8 核/8GB 三档浏览器模拟与行为断言。

## 4. 公共接口

- `detectPerformanceCapabilities(options)`：读取并规范化核心数、内存、基准值和 Android 状态。
- `getPerformanceProfile(options)`：返回档位、原因、能力信息、stagger 上限和功能开关。
- `applyPerformanceProfile(options)`：应用档位到根节点并广播事件。
- `refreshPerformanceProfile(options)`：在前台恢复或偏好变化时重新应用。
- `getCurrentPerformanceProfile()`：读取当前档位；尚未应用时执行一次安全检测。
- `PERFORMANCE_TIERS`：固定为 `full`、`balanced`、`lite`。

## 5. 验收状态

- 全量前端测试：84/84 个 `tests/*.test.mjs` 文件通过。
- 新增分档单元测试：阈值、内存单位转换、未知 Android 回退、reduced-motion 优先级、根节点属性和事件均通过。
- 新增页面契约测试：应用生命周期、书架四类降级、事件绑定/解绑和“我的”页状态展示均通过。
- `common/performanceProfile.js` 与 H5 验收脚本通过 Node 语法检查。
- HBuilderX H5 生产构建通过，产物位于 `.v3-build/h5-v31e`。首次编译发现旧 Babel 不支持 `??`，已改为等价的 ES2015 兼容实现并重新通过编译。
- Playwright/Chrome 验收通过：五主题共 15 张截图，375px、393px、412px 共 9 个核心视口无横向溢出，浏览器 `pageerror` 为 0。
- 共享书封 5/5、滚动视差、布局 FLIP、reduced-motion、阅读器面板和时间氛围回归全部通过。
- 性能三档实测通过：2 核/2GB 为轻量档且四类装饰动效全关；4 核/4GB 为均衡档且保留 2 行 FLIP/交错；8 核/8GB 为完整档且呼吸、视差、2 行 FLIP/交错均启用。
- Android WebView APK 构建通过，v1/v2/v3 签名有效，产物位于 `.v3-build/android-v31e/release/V2.apk`；SHA-256 为 `022941335891ACC31F43E9615FD9DA3A65469DEEE922F2DA0915AF66BFC4D9FD`。
- REA-AN00 保留数据覆盖安装成功；冷启动 912ms，书架 → 第一本书 → 阅读器主链路通过，真机显示“完整档”，进程日志未发现 `FATAL EXCEPTION` 或 ANR，`tcp:8765` 反向映射已恢复。

## 6. 复验命令

在 `D:\Codex\novel-reader-uniapp` 执行：

```powershell
$env:NODE_ENV='production'
$env:UNI_PLATFORM='h5'
$env:UNI_INPUT_DIR='D:\Codex\novel-reader-uniapp'
$env:UNI_OUTPUT_DIR='D:\Codex\novel-reader-uniapp\.v3-build\h5-v31e'
$env:UNI_MINIMIZE='true'
$env:VUE_CLI_CONTEXT='D:\HBuilderX\plugins\uniapp-cli'
& 'D:\HBuilderX\plugins\node\node.exe' 'D:\HBuilderX\plugins\uniapp-cli\bin\uniapp-cli.js'
```

H5 编译成功后执行三档与既有五主题回归：

```powershell
$env:V3_H5_BUILD_DIR='D:\Codex\novel-reader-uniapp\.v3-build\h5-v31e'
$env:V3_ARTIFACT_DIR='D:\Codex\novel-reader-uniapp\output\v3-acceptance-v31e'
$env:CODEX_PLAYWRIGHT_PATH='C:\Users\周俊华\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
$env:CODEX_CHROMIUM_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'
node .\scripts\v3_h5_visual_check.mjs
```

APK 构建：

```powershell
.\scripts\build_android_webview_apk.ps1 `
  -H5RootOverride '.\.v3-build\h5-v31e' `
  -BuildRootOverride '.\.v3-build\android-v31e\build' `
  -AssetsRootOverride '.\.v3-build\android-v31e\assets\www' `
  -ReleaseRootOverride '.\.v3-build\android-v31e\release'
```

验收截图位于 `output/v3-acceptance-v31e`，包含五主题 H5 截图与 Android 书架、阅读器、“我的”页截图。

## 7. 风险与后续

- 浏览器和不同 Android WebView 对 `deviceMemory` 的支持不一致，因此实现同时使用核心数和 uni-app 设备信息，并将能力完全未知的 Android 保守设为均衡档。
- 当前属于启动/前台恢复时的静态能力分档，不根据瞬时 FPS 频繁升降档，避免阅读过程中视觉抖动。
- 若后续增加实时帧率采样，应采用连续窗口和迟滞阈值，并继续保证只降级装饰动效。
