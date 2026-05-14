# 小说解码 App 后端

这是小说解码 App 的 Python 后端：FastAPI + SQLAlchemy + SQLite + JWT。当前已实现健康检查、用户注册登录、书架、章节、阅读记录、书源导入和动态解析接口，后续阶段再接入 AI 功能。

## 目录

```text
backend/
  app/
    api/          # API 路由
    core/         # 配置与安全工具
    db/           # 数据库连接
    models/       # SQLAlchemy Model
    schemas/      # Pydantic Schema
    main.py       # FastAPI 入口
  scripts/
    init_db.py    # 初始化 SQLite 表
  tests/
    test_auth.py     # 鉴权接口测试
    test_library.py  # 书架、章节、阅读记录接口测试
    test_sources.py  # 书源导入和解析接口测试
```

## 启动

```powershell
cd D:\Codex\novel-reader-uniapp\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m ensurepip --upgrade
python -m pip install -r requirements.txt
copy .env.example .env
python scripts/init_db.py
uvicorn app.main:app --reload --port 8000
```

打开：

- Swagger 文档：http://127.0.0.1:8000/docs
- 健康检查：http://127.0.0.1:8000/api/health

## 测试

```powershell
cd D:\Codex\novel-reader-uniapp\backend
.\.venv\Scripts\Activate.ps1
pytest
```

## API

### GET /api/health

返回服务状态。

### POST /api/auth/register

注册用户。

```json
{
  "username": "reader",
  "email": "reader@example.com",
  "password": "secret123"
}
```

### POST /api/auth/login

登录并返回 JWT。

```json
{
  "username": "reader",
  "password": "secret123"
}
```

响应：

```json
{
  "access_token": "...",
  "token_type": "bearer"
}
```

### GET /api/auth/me

请求头：

```text
Authorization: Bearer <access_token>
```

返回当前登录用户。

## 数据库

默认使用 SQLite：

```text
sqlite:///./data/novel_reader.db
```

已建立的表：

- `users`
- `books`
- `chapters`
- `book_sources`
- `reading_history`
- `ai_summaries`
- `chat_records`

当前阶段已开放 `users`、`books`、`chapters`、`reading_history`、`book_sources` 相关接口，AI 表为后续阶段预留。

## 书架与章节接口

所有接口都需要请求头：

```text
Authorization: Bearer <access_token>
```

### GET /api/books

获取当前用户书架。

### POST /api/books

新增一本书。

```json
{
  "title": "星轨图书馆",
  "author": "示例作者",
  "cover_url": "",
  "description": "一本用于测试的小说",
  "book_url": "https://example.com/book/1",
  "toc_url": "https://example.com/book/1/catalog"
}
```

### GET /api/books/{book_id}

获取当前用户拥有的一本书。

### GET /api/books/{book_id}/chapters

获取书籍章节列表。

### POST /api/books/{book_id}/chapters

新增章节。

```json
{
  "chapter_index": 0,
  "title": "第一章 失重借阅证",
  "url": "https://example.com/book/1/0",
  "content": "凌晨四点，星轨图书馆经过城市上空。",
  "is_cached": true
}
```

### GET /api/chapters/{chapter_id}

获取章节正文。只能访问当前用户书架里的章节。

## 阅读记录接口

### POST /api/reading-history

保存或更新当前用户对一本书的阅读进度。

```json
{
  "book_id": 1,
  "chapter_id": 1,
  "chapter_index": 0,
  "page_index": 3,
  "progress_percent": 18.5
}
```

### GET /api/reading-history?book_id=1

读取指定书籍的阅读进度。

## 书源接口

所有接口都需要请求头：

```text
Authorization: Bearer <access_token>
```

### POST /api/sources/import

导入 JSON 书源。`content` 可以是单个书源对象、书源数组，或包含 `sources` 数组的对象。

```json
{
  "content": "{\"bookSourceName\":\"测试小说源\",\"bookSourceUrl\":\"https://example.com\",\"searchUrl\":\"https://example.com/search?q={{key}}\",\"ruleSearch\":{\"bookList\":\".result-list li\",\"name\":\"h3 a@text\",\"author\":\".author@text\",\"bookUrl\":\"h3 a@href\"},\"ruleToc\":{\"chapterList\":\".chapter-list a\",\"chapterName\":\"@text\",\"chapterUrl\":\"@href\"},\"ruleContent\":{\"content\":\"#content@text\"}}"
}
```

### GET /api/sources

获取当前用户导入的书源列表。

### POST /api/sources/{source_id}/search

根据书源规则搜索小说。

```json
{
  "keyword": "星轨",
  "page": 1
}
```

### POST /api/sources/{source_id}/toc

根据书源目录规则解析章节列表。

```json
{
  "book_url": "https://example.com/book/1",
  "toc_url": "https://example.com/book/1/catalog"
}
```

### POST /api/sources/{source_id}/content

根据书源正文规则解析章节正文。

```json
{
  "chapter_url": "https://example.com/book/1/0"
}
```

## 书源规则支持范围

当前后端解析器支持：

- `searchUrl`
- `ruleSearch.bookList/name/author/bookUrl`
- `ruleToc.chapterList/chapterName/chapterUrl`
- `ruleContent.content`
- 基础 CSS 选择器，如 `.list a`、`#content`
- `@text`、`@html`、`@href`、`@src`
- `||` 兜底规则
- `##regex##replace` 正则替换
- `{{key}}`、`{{keyword}}`、`{{page}}` 模板
- 基础 JSONPath，如 `$.data.books[*]`

暂不执行 JS、Cookie、登录、WebView 或付费绕过规则。导入这类规则时会标记为不兼容。
