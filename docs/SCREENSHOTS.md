# 截图清单

这份清单用于准备 README、简历附件和 3-5 分钟项目录屏素材。截图优先选择能证明工程能力和业务闭环的页面。

## GitHub 与工程化

- README 顶部 CI 徽章。
- GitHub Actions 最近一次绿色运行。
- `backend/tests` 或终端里 `38 passed` 的 pytest 输出。
- Swagger 接口列表。

## 后端闭环

- `GET /api/health` 健康检查。
- `POST /api/auth/login` 登录成功并返回 token。
- 未授权访问 `GET /api/books` 的统一错误响应和 `X-Request-ID`。
- `POST /api/sources/import-demo` 导入演示源。
- `POST /api/sources/{source_id}/search` 搜索《星轨图书馆》。
- `POST /api/sources/{source_id}/toc` 解析目录。
- `POST /api/sources/{source_id}/content` 解析正文。
- `POST /api/ai/summary` 生成总结。
- `GET /api/ai/calls` 查看调用日志。

## uni-app 前端

- “我的”页后端登录状态。
- “导入”页书源管理总览和分组统计。
- 书源详情抽屉：规则兼容、网络测试状态、规则摘要。
- 批量检测面板：正在测试 x/y、通过/失败/不兼容结果。
- 书源编辑抽屉：改名、分组说明。
- 导入前预览：新增、覆盖、不兼容、分组。
- “发现”页可用书源数量和无可用源引导。
- “发现”页搜索结果，展示本次使用书源和来源标签。
- 阅读器章节正文、AI 总结或问答入口。
- “AI 记录”页总结、问答和调用日志。

## Android 真机阶段

- 扫码导入权限弹窗和成功结果。
- 本地 JSON 文件选择。
- 剪贴板导入。
- 真机访问本机或局域网后端的成功页面。
- Android 安装包和安装后首页。
