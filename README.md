# 小说解码 AI 阅读助手

一个面向学习和求职展示的阅读助手项目。项目保留原有 uni-app 客户端，同时新增 Python FastAPI 后端，把核心能力逐步迁移到后端：用户系统、书架管理、阅读记录、动态书源解析、AI 章节总结和 AI 问答。

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
- AI 总结和问答历史记录查询
- 自动化测试

客户端已保留：

- 书架页面
- 搜索页面
- 阅读器页面
- 书源管理页面
- TXT 本地阅读相关原型
- 我的页面后端登录入口
- 阅读器内 AI 总结和问答入口

## 项目结构

```text
novel-reader-uniapp/
  backend/       # Python FastAPI 后端
  common/        # uni-app 公共逻辑
  pages/         # uni-app 页面
  preview/       # 浏览器预览页面
  static/        # 静态测试文件
  tests/         # 前端书源引擎测试
  docs/          # 项目文档
```

## 后端启动

```powershell
cd D:\Codex\novel-reader-uniapp\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

打开：

- Swagger: http://127.0.0.1:8000/docs
- 健康检查: http://127.0.0.1:8000/api/health

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
```

前端后端 API client 测试：

```powershell
cd D:\Codex\novel-reader-uniapp
node tests/apiClient.test.mjs
```

AI 历史和后端适配层测试：

```powershell
cd D:\Codex\novel-reader-uniapp
node tests/backendLibrary.test.mjs
node tests/aiHistory.test.mjs
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

如果要接入真实 AI 服务，请复制并修改环境变量，不要提交真实 API Key。

## 演示流程

适合面试或项目展示的完整流程：

1. 启动后端，打开 Swagger。
2. 注册并登录用户，复制 JWT。
3. 导入演示书源：`POST /api/sources/import-demo`。
4. 使用书源搜索、目录解析和正文解析接口。
5. 在 uni-app “我的”页面登录后端。
6. 在“导入”页刷新后端书源或导入演示源。
7. 在“发现”页搜索书籍，加入云端书架。
8. 进入阅读器，验证章节解析、阅读进度保存、AI 总结和 AI 问答。
9. 回到“我的”页打开“AI 记录”，查看总结和问答历史。

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
- App 端扫码导入书源
- AI 总结和问答展示页
- 书源规则兼容性检测
- PostgreSQL 迁移
- Docker 本地部署
