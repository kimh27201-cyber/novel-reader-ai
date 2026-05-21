# API 使用说明

后端启动后打开 Swagger：

```text
http://127.0.0.1:8000/docs
```

## 1. 登录鉴权

### 注册

`POST /api/auth/register`

```json
{
  "username": "student",
  "email": "student@example.com",
  "password": "secret123"
}
```

### 登录

`POST /api/auth/login`

```json
{
  "username": "student",
  "password": "secret123"
}
```

复制返回的 `access_token`，点击 Swagger 右上角 `Authorize`，只粘贴 token 本身，不要手动加 `Bearer`。

## 2. 本地演示书源

### 导入演示书源

`POST /api/sources/import-demo`

返回结果中的 `sources[0].id` 是后续接口的 `source_id`。

### 搜索小说

`POST /api/sources/{source_id}/search`

```json
{
  "keyword": "星轨",
  "page": 1
}
```

### 解析目录

`POST /api/sources/{source_id}/toc`

```json
{
  "book_url": "http://127.0.0.1:8000/demo-source/books/star-library/catalog",
  "toc_url": "http://127.0.0.1:8000/demo-source/books/star-library/catalog"
}
```

### 解析正文

`POST /api/sources/{source_id}/content`

```json
{
  "chapter_url": "http://127.0.0.1:8000/demo-source/books/star-library/chapters/1"
}
```

## 3. AI 阅读助手

默认 mock 模式可以直接运行，不需要 API Key。

### 章节总结

`POST /api/ai/summary`

```json
{
  "chapter_text": "凌晨四点，星轨图书馆经过城市上空。安禾第一次看见它时，以为那只是一颗移动得过慢的星星。",
  "book_id": null,
  "chapter_id": null
}
```

返回字段：

- `summary`: 简洁总结
- `characters`: 人物或关键对象
- `key_points`: 剧情关键点
- `provider`: `mock`、`deepseek` 或 `openai`

### 总结历史

`GET /api/ai/summaries`

可选筛选：

```text
GET /api/ai/summaries?book_id=1
GET /api/ai/summaries?chapter_id=1
```

### 小说问答

`POST /api/ai/chat`

```json
{
  "question": "安禾看到了什么？",
  "context": "凌晨四点，星轨图书馆经过城市上空。安禾第一次看见它时，以为那只是一颗移动得过慢的星星。",
  "book_id": null,
  "chapter_id": null
}
```

### 问答历史

`GET /api/ai/chats`

可选筛选：

```text
GET /api/ai/chats?book_id=1
GET /api/ai/chats?chapter_id=1
```

### AI 调用日志

`GET /api/ai/calls`

用于查看当前用户的 AI 调用记录，包括总结、问答、成功、失败、耗时和错误信息。可选筛选：

```text
GET /api/ai/calls?book_id=1
GET /api/ai/calls?chapter_id=1
GET /api/ai/calls?call_type=summary
GET /api/ai/calls?status_value=failed
```

返回字段：

- `call_type`: `summary` 或 `chat`
- `provider`: `mock`、`deepseek` 或 `openai`
- `model`: 实际模型名
- `status`: `success` 或 `failed`
- `error_code`: 失败分类，例如 `timeout`、`provider_error`、`invalid_response`
- `error_message`: 失败原因
- `duration_ms`: 调用耗时

AI provider 错误分类：

- `timeout`：AI provider 请求超时，前端应提示稍后重试。
- `provider_error`：上游服务返回错误或连接失败，前端可展示 `error_message`。
- `invalid_response`：上游响应格式不符合预期，通常需要检查模型配置或提示词。
- mock 模式默认返回稳定结果，不依赖真实 API Key，适合 CI、录屏和面试现场演示。

uni-app 的“AI 记录”页会聚合总结、问答和调用日志，并支持按 summary / chat / success / failed 查看记录；失败调用会显示 `error_message`。

## 4. 数据库查看

SQLite 文件位置：

```text
D:\Codex\novel-reader-uniapp\backend\data\novel_reader.db
```

可以用 VS Code 的 SQLite Viewer 查看：

- `users`
- `books`
- `chapters`
- `book_sources`
- `reading_history`
- `ai_summaries`
- `chat_records`
- `ai_call_logs`
