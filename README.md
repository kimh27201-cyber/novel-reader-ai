# 小说解码 AI 阅读助手

![CI](https://github.com/kimh27201-cyber/novel-reader-ai/actions/workflows/ci.yml/badge.svg)

一个面向学习和求职展示的阅读助手项目。项目保留原有 uni-app 客户端，同时新增 Python FastAPI 后端，把核心能力逐步迁移到后端：用户系统、书架管理、阅读记录、动态书源解析、AI 章节总结和 AI 问答。

## 求职展示入口

- [项目演示脚本](docs/DEMO_GUIDE.md)：面试或录屏时按步骤展示 Swagger、登录鉴权、书源、阅读器和 AI 功能。
- [简历与面试讲解稿](docs/INTERVIEW_NOTES.md)：可直接改写到简历里的项目描述、亮点和常见追问答案。
- [接口文档](docs/API.md)：后端主要 API、请求示例和演示顺序。
- [截图清单](docs/SCREENSHOTS.md)：用于 README、简历附件和录屏素材准备。
- [Android 真机验收清单](docs/ANDROID_VALIDATION.md)：后续 App 端扫码、文件、剪贴板和网络验证步骤。
- [Android APK 打包说明](docs/PACKAGING_ANDROID.md)：展示 APK、HBuilderX 云打包和正式包预留事项。

## 项目定位

这个项目不是小说资源站，也不内置盗版书源。它的定位是一个“阅读工具 + AI 应用后端”：

- uni-app 客户端负责页面展示和本地阅读体验
- FastAPI 后端负责用户、数据、书源解析和 AI 能力
- SQLite 方便本地开发，后续可切换 PostgreSQL
- AI 功能默认支持 mock 模式，没有 API Key 也能运行和测试

## 技术栈

后端：

- Python
- FastAPI
- SQLAlchemy
- SQLite
- JWT
- Pydantic
- httpx
- python-dotenv
- pytest

客户端：

- uni-app
- Vue 2
- 本地 TXT 阅读
- 本地书源解析原型

## 当前功能

后端已实现：

- 用户注册、登录、JWT 鉴权
- 书架管理
- 章节管理
- 阅读记录管理
- JSON 书源导入
- 动态书源搜索、目录、正文解析
- 本地演示书源，方便 Swagger 直接测试
- AI 章节总结
- AI 小说问答
- AI 总结、问答历史和调用日志查询
- AI 超时、上游错误、返回格式异常分类处理
- 统一错误响应、`X-Request-ID` 和请求日志
- 自动化测试

客户端已保留：

- 书架页面
- 搜索页面
- 阅读器页面
- 书源管理页面
- TXT 本地阅读相关原型
- 我的页面后端登录入口
- 阅读器内 AI 总结和问答入口
- AI 记录页展示总结、问答和调用日志
- 书源导入、兼容性诊断、单源测试、批量检测和发现页可用源引导
- 书源改名、分组管理、当前结果批量启停、删除确认和导入前预览
- 书源页扫码、剪贴板、本地 JSON/TXT 文件选择统一走跨端适配层，便于 Android 真机验证
- 我的页支持后端地址保存、真机地址风险提示和 `/api/health` 自检
- 书源页默认保持简洁，批量检测、分组筛选、批量启停和后端演示源收进“管理工具”
- 我的页通过“关于”版本号连续点击 7 次开启调试模式，调试模式下显示 APK 展示准备、一键演示准备和真机验收清单

## 项目结构

```text
novel-reader-uniapp/
  backend/       # Python FastAPI 后端
  common/        # uni-app 公共逻辑
  pages/         # uni-app 页面
  preview/       # 浏览器预览页面
  static/        # 静态测试文件
  static/branding/ # App 图标和启动页源文件
  tests/         # 前端书源引擎测试
  docs/          # 项目文档
```

## 后端启动

```powershell
cd D:\Codex\novel-reader-uniapp\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

Android 真机联调时使用：

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

手机端“我的”页后端地址填写电脑局域网地址，例如 `http://192.168.x.x:8000`。不要在真机里使用 `127.0.0.1` 或 `localhost`。

打开：

- Swagger: http://127.0.0.1:8000/docs
- 健康检查: http://127.0.0.1:8000/api/health

正式数据库迁移流程：

```powershell
cd D:\Codex\novel-reader-uniapp\backend
.\.venv\Scripts\Activate.ps1
alembic upgrade head
```

如果本地 SQLite 已经用 `python scripts/init_db.py` 建过表，第一次接入 Alembic 时不要直接升级，先标记当前库已经处在初始版本：

```powershell
alembic stamp head
alembic upgrade head
```

## 后端测试

```powershell
cd D:\Codex\novel-reader-uniapp\backend
.\.venv\Scripts\Activate.ps1
pytest
```

前端书源引擎测试：

```powershell
cd D:\Codex\novel-reader-uniapp
node tests/sourceEngine.test.mjs
node tests/sourceImport.test.mjs
node tests/sourceDiagnostics.test.mjs
node tests/searchHelpers.test.mjs
node tests/importAdapters.test.mjs
```

前端后端 API client 测试：

```powershell
cd D:\Codex\novel-reader-uniapp
node tests/apiClient.test.mjs
node tests/backendConnection.test.mjs
node tests/androidReadiness.test.mjs
node tests/demoMode.test.mjs
node tests/deviceValidation.test.mjs
node tests/productShell.test.mjs
```

AI 历史和后端适配层测试：

```powershell
cd D:\Codex\novel-reader-uniapp
node tests/backendLibrary.test.mjs
node tests/aiHistory.test.mjs
```

## GitHub Actions CI

仓库已提供 `.github/workflows/ci.yml`，推送到 `main` 或提交 Pull Request 时会自动执行：

- 后端依赖安装、Alembic 迁移检查、`pytest`
- `pages.json` 解析检查
- 前端工具测试：`sourceEngine`、`apiClient`、`backendConnection`、`backendLibrary`、`aiHistory`、`importAdapters`
- Android 展示准备测试：`androidReadiness`
- 演示模式测试：`demoMode`
- 真机验收清单测试：`deviceValidation`
- 产品外壳测试：`productShell`

## 错误响应与排查

后端所有请求都会返回 `X-Request-ID` 响应头。客户端也可以传入 `X-Request-ID`，方便把前端报错、Swagger 调试和后端日志对应起来。

错误响应会保留 FastAPI 兼容字段 `detail`，并额外提供统一的 `error` 对象：

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "request_id": "example-request-id"
  },
  "detail": []
}
```

## Docker 本地部署

项目根目录提供 `docker-compose.yml`，用于一键启动 FastAPI 后端和 PostgreSQL：

```powershell
cd D:\Codex\novel-reader-uniapp
docker compose up --build
```

启动后打开：

- Swagger: http://127.0.0.1:8000/docs
- 健康检查: http://127.0.0.1:8000/api/health

Docker 使用的环境变量示例在：

```text
backend\.env.docker.example
```

默认 Docker 配置使用 PostgreSQL：

```env
DATABASE_URL=postgresql+psycopg://novel_reader:novel_reader_password@db:5432/novel_reader
AI_PROVIDER=mock
```

容器启动时会自动执行：

```text
alembic upgrade head
```

如果要接入真实 AI 服务，请复制并修改环境变量，不要提交真实 API Key。

## 演示流程

适合面试或项目展示的完整流程：

1. 启动后端，打开 Swagger。
2. 注册并登录用户，复制 JWT。
3. 导入演示书源：`POST /api/sources/import-demo`。
4. 使用书源搜索、目录解析和正文解析接口。
5. 在 uni-app “我的”页面登录后端。
6. 如需录屏或打包验收，在“我的 > 关于”连续点击版本号 7 次开启调试模式，再查看“一键演示准备”和“APK 展示准备”。
7. 在“书源”页添加书源、进入源仓库或展开“管理工具”刷新后端演示源。
8. 在“书源”页查看书源诊断，运行单源测试或批量检测，确认发现页只使用测试通过的源。
9. 在“发现”页查看可用书源数量，搜索书籍，加入云端书架。
10. 进入阅读器，验证章节解析、阅读进度保存、AI 总结和 AI 问答。
11. 回到“我的”页打开“AI 记录”，查看总结、问答历史和 AI 调用日志。

## 重要接口

鉴权：

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

书架与阅读：

- `GET /api/books`
- `POST /api/books`
- `GET /api/books/{book_id}/chapters`
- `POST /api/books/{book_id}/chapters`
- `GET /api/chapters/{chapter_id}`
- `POST /api/reading-history`
- `GET /api/reading-history`

书源解析：

- `POST /api/sources/import`
- `POST /api/sources/import-demo`
- `GET /api/sources`
- `POST /api/sources/{source_id}/search`
- `POST /api/sources/{source_id}/toc`
- `POST /api/sources/{source_id}/content`

AI：

- `POST /api/ai/summary`
- `GET /api/ai/summaries`
- `POST /api/ai/chat`
- `GET /api/ai/chats`
- `GET /api/ai/calls`

更详细接口说明见 [docs/API.md](docs/API.md)。

## AI 配置

默认使用 mock 模式，不需要花钱：

```env
AI_PROVIDER=mock
AI_API_KEY=
```

如果后续要接 DeepSeek：

```env
AI_PROVIDER=deepseek
AI_API_KEY=你的 DeepSeek Key
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-chat
```

真实 `.env` 不要提交到 GitHub。

## 合规边界

本项目不提供、不维护、不内置任何盗版书源：

- 不执行书源里的 JS、登录、Cookie、WebView 或付费绕过规则
- 不解析付费章节
- 不绕过登录、会员、广告或版权限制
- 不在仓库内放置未经授权的小说正文

用户导入的第三方书源和 TXT 文件应来自用户自己有权使用的内容。

## 后续方向

- 更多 uni-app 页面接入后端 API
- Android 真机权限验证、局域网后端联调与打包展示
- AI 总结和问答展示页
- 书源规则兼容性检测、网络可用性检测和分组管理
- PostgreSQL 迁移
- Docker 本地部署
