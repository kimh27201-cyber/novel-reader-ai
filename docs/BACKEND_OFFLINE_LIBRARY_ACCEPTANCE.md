# 后端书架离线同步与书源验收

## 已实现链路

书架启动顺序为“账号隔离的本地镜像 → 立即渲染 → 后台刷新后端 → 原子更新镜像”。后端超时或停止时不会清空云端书籍，界面会显示“离线书架”。退出登录只移除当前账号激活标记，不删除正文；相同后端地址和账号再次登录后恢复。

章节正文存储在 Android 文件桥或 H5 IndexedDB，元数据、目录、游标和待同步进度存储在本地键值区。普通自动缓存最多 120 章并按 LRU 淘汰，整本下载章节固定保留。远程删除立即隐藏书籍，正文进入 7 天延迟清理队列。

阅读器对 `backend:<id>` 保持兼容：在线成功后先落本地缓存；网络失败时读取本地目录和正文；未缓存章节显示“该章节尚未下载”，不再回退到示例书。整本下载固定最多 2 个并发，支持暂停、继续和失败重试；页面卸载会停止任务。

阅读进度先本地写入并按书籍合并排队，联网后先向 `/api/sync/push` 提交带唯一 `mutation_id` 的变更，再通过 `/api/sync/pull` 拉取游标变更。应用唤醒同步有 30 秒节流，并发触发会共用同一任务。

## 新增接口

```http
GET /api/library/offline-snapshot?book_offset=0&book_limit=20&include_cached_content=true
```

接口按当前登录用户过滤书籍，使用聚合查询返回书籍、完整目录、已缓存正文、阅读历史和同步游标，不返回书源会话、Cookie 或 Token。未修改数据库表结构。

## 导入入口自动验收矩阵

| 入口 | 自动测试 |
| --- | --- |
| 原始 JSON、非法 JSON、重复导入 | `sourceImport.test.mjs`、`sourceImportFlow.test.mjs` |
| YCK JSON 直链、详情页链接 | `yckImportFlow.test.mjs`、`yckSourceImportAcceptance.test.mjs` |
| `booksource://`、`yuedu://` | `importAdapters.test.mjs`、`androidDeepLinkImport.test.mjs` |
| Android 二维码 | `v2ScanImport.test.mjs`、`scanImportVisibilityRegression.test.mjs` |
| H5/Android 本地 JSON 文件 | `importAdapters.test.mjs`、`sourceAndroidValidation.test.mjs` |
| 本地源同步后端、`/api/sources/import` | `backendLibrary.test.mjs`、`backend/tests/test_sources.py` |
| `/api/sources/import-demo` 确定性对照 | `backend/tests/test_demo_source.py`、真实验收脚本 |

所有入口最终使用“名称＋基础 URL”去重，JS、Cookie、登录、WebView 或动态规则只标记不兼容，不执行和不绕过限制。

## 2026-08-10 真实网络验收

主报告：`artifacts/source-full-chain-acceptance.json`

- 确定性演示源：搜索、详情、目录、正文全部健康。
- YCK 7037 速读古：配置下载、SHA-256、重复导入去重、搜索、详情、879 章目录、首章/第 440 章/末章正文、加入后端书架、阅读进度和离线快照全部通过；同时修复了 `.item a.0`、`img.0`、`text.全文目录` 等 Legado 选择器兼容问题。
- YCK 3135 追书神器：包含 JS/Cookie/登录规则，按预期 `safely_rejected`。
- YCK 6776 全能书源：包含大量动态、登录规则，按预期 `safely_rejected`。
- 备用候选 YCK 5306：配置兼容，但上游返回 `RemoteProtocolError`，记录在 `artifacts/source-candidate-5306.json`，不进入可用列表。

报告仅包含配置哈希、阶段状态、耗时、错误类型和正文长度，不保存正文全文或会话秘密。`trace_id` 可关联同一次导入、搜索、目录和正文请求日志。

## 运行与回归

在 `D:\Codex\novel-reader-uniapp` 执行：

```powershell
node tests/backendOfflineLibrary.test.mjs
node tests/backendLibrary.test.mjs
backend\.venv\Scripts\python.exe -m pytest backend\tests -q
backend\.venv\Scripts\python.exe backend\scripts\source_full_chain_acceptance.py --allow-live
```

真实网络脚本会创建独立验收账号和书源数据，并且必须显式传入 `--allow-live`。第三方书源状态会变化，交付判断以报告抓取时间和 SHA-256 为准。

## 尚需真机完成

自动测试无法替代 Android 飞行模式、移除 `adb reverse`、进程重启、存储空间不足和 APK 安装验收。真机时至少下载三章，停止后端并完全断网重启 APK，确认书架和已下载章节可读；恢复网络后确认进度上传且书籍、章节数量不增加。
