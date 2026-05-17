# 项目演示脚本

这份脚本用于面试现场演示、项目录屏或给面试官快速说明项目价值。建议演示时先打开 GitHub 仓库，再打开本地 Swagger 和 uni-app 页面。

## 演示目标

用 5-8 分钟证明这个项目不是简单页面，而是一个具备后端工程能力的完整 AI 应用项目：

- 有 FastAPI 后端、数据库模型、JWT 鉴权和业务接口
- 有书架、章节、阅读记录、书源解析和 AI 总结问答
- 有 pytest、GitHub Actions、Alembic、Docker 配置
- 有统一错误响应、`X-Request-ID` 和可排查日志
- 有 uni-app 前后端联调入口

## 演示前准备

PowerShell 启动后端：

```powershell
cd D:\Codex\novel-reader-uniapp\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

打开：

- Swagger: http://127.0.0.1:8000/docs
- GitHub Actions: https://github.com/kimh27201-cyber/novel-reader-ai/actions

如果要演示 uni-app 页面，用 HBuilderX 打开项目根目录 `D:\Codex\novel-reader-uniapp`，运行到浏览器或模拟器。

## 5 分钟演示顺序

### 1. 项目定位

可以这样开场：

> 这是一个 AI 阅读助手项目，前端使用 uni-app，后端使用 FastAPI。项目主要展示 Python 后端能力，包括 JWT 登录鉴权、数据库 CRUD、阅读记录、书源解析、AI 总结问答、接口测试、数据库迁移和 CI。

强调合规边界：

> 项目不内置盗版书源，只提供书源规则解析能力和本地演示源，真实内容需要用户自己有权使用。

### 2. 展示 GitHub 工程化

打开 GitHub 仓库：

- 指出 README 顶部 CI 徽章
- 打开 Actions 页面，展示最新 CI 为绿色
- 说明 CI 会自动运行后端 pytest、Alembic 迁移检查、前端工具测试

可以这样说：

> 这不是只在我电脑上能跑的项目。每次 push 到 main，GitHub Actions 会自动跑后端和前端工具测试，避免后续改动破坏核心流程。

### 3. 展示 Swagger 和鉴权

打开 Swagger：

1. `GET /api/health`，确认后端运行正常
2. `POST /api/auth/register`，注册用户
3. `POST /api/auth/login`，拿到 JWT
4. 点击右上角 `Authorize`，填入 token
5. `GET /api/auth/me`，验证当前用户

讲解重点：

- 密码不会明文保存，后端保存 hash
- 受保护接口通过 JWT 获取当前用户
- 用户只能访问自己的书架、章节和 AI 历史

### 4. 展示统一错误响应

退出 Swagger 授权后访问 `GET /api/books`。

预期结果：

- 状态码：`401`
- 响应头有 `x-request-id`
- 响应体有统一结构：

```json
{
  "error": {
    "code": "unauthorized",
    "message": "Not authenticated",
    "request_id": "..."
  },
  "detail": "Not authenticated"
}
```

可以这样说：

> 我保留了 FastAPI 原来的 detail 字段，同时新增统一 error 对象，方便前端统一弹错，也方便通过 request_id 对应后端日志。

### 5. 展示业务闭环

重新授权后按顺序演示：

1. `POST /api/sources/import-demo` 导入演示源
2. `GET /api/sources` 查看当前用户的书源
3. `POST /api/sources/{source_id}/search` 搜索示例书籍
4. `POST /api/books` 加入书架
5. `POST /api/books/{book_id}/chapters` 创建章节
6. `POST /api/reading-history` 保存阅读进度
7. `POST /api/ai/summary` 生成章节总结
8. `POST /api/ai/chat` 进行问答
9. `GET /api/ai/summaries` / `GET /api/ai/chats` 查看历史

讲解重点：

- 书源解析、书架、章节、阅读记录和 AI 历史都归属当前用户
- AI 默认 mock 模式，没有真实 API Key 也能完整演示
- 后续可以切换真实 AI provider

### 6. 展示前端联调

打开 uni-app：

1. “我的”页面登录后端
2. “导入”页面导入演示源或刷新后端书源
3. “发现”页面搜索并加入云端书架
4. “书架”页面进入云端书籍
5. 阅读器里触发 AI 总结或问答
6. “我的”页面进入 AI 记录

如果现场时间紧，可以只演示 Swagger，把 uni-app 作为补充说明。

## 录屏建议

录屏控制在 3-5 分钟：

1. GitHub README + CI 绿色：20 秒
2. Swagger 注册登录：40 秒
3. 未登录错误响应和 request_id：30 秒
4. 导入演示源、搜索、加入书架：60 秒
5. AI 总结、AI 记录：60 秒
6. 结尾展示测试命令或 Actions：20 秒

## 截图清单

建议后续放到 README 或简历附件中：

- GitHub Actions 绿色运行记录
- Swagger 接口列表
- 登录后 `GET /api/auth/me`
- 未登录 `GET /api/books` 的统一错误响应
- AI 总结接口响应
- uni-app 书架或阅读器页面

## 常见演示问题

如果注册提示用户已存在：

- 换一个 username/email
- 或直接登录已有账号

如果 Swagger 仍然带旧 token：

- 点击 `Authorize`
- 点击 `Logout`
- 重新登录并授权

如果 Docker 命令不可用：

- 说明本机尚未安装 Docker Desktop
- 本地演示使用 Python venv 启动后端即可
