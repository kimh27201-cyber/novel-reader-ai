# 解码阅读 V2 后端 API

本文件记录当前后端的主要接口和调用约定。运行服务后，以 Swagger 中的实时 OpenAPI 定义为最终依据：

```text
http://127.0.0.1:8000/docs
```

## 通用约定

- 基础地址：`http://127.0.0.1:8000`
- 请求与响应默认使用 JSON。
- 受保护接口使用 `Authorization: Bearer <access_token>`。
- 默认不支持通过 URL 查询参数传 token。
- 参数校验失败返回 `422`，未认证返回 `401`，资源不存在或不属于当前用户返回 `404`，唯一约束冲突返回 `409`。
- 错误响应包含 `detail`；服务端日志可通过响应中的 request ID 关联。

## 健康检查

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 应用名称和版本 |
| GET | `/api/health/live` | 进程存活检查 |
| GET | `/api/health/ready` | 数据库连接和 Alembic 版本检查；未就绪返回 `503` |

## 认证

### 注册

`POST /api/auth/register`

```json
{
  "username": "reader",
  "email": "reader@example.com",
  "password": "secret123"
}
```

### 登录

`POST /api/auth/login`

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
  "refresh_token": "...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

### 刷新 token

`POST /api/auth/refresh`

```json
{
  "refresh_token": "<当前 refresh token>"
}
```

成功后旧 refresh token 立即失效，客户端必须原子替换为响应中的新 token 对。

### 注销

`POST /api/auth/logout`，需要 access token。

```json
{
  "refresh_token": "<需要撤销的 refresh token>"
}
```

### 当前用户

`GET /api/auth/me`，需要 access token。

## 书架、章节与进度

以下接口均需要 access token。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/books?limit=100&offset=0` | 书架列表；`limit` 为 1–200 |
| POST | `/api/books` | 新增或按书籍 URL 合并书籍 |
| GET | `/api/books/{book_id}` | 读取当前用户的书籍 |
| PATCH | `/api/books/{book_id}` | 部分更新书籍 |
| DELETE | `/api/books/{book_id}` | 软删除书籍并进入同步 tombstone |
| GET | `/api/books/{book_id}/chapters` | 章节列表 |
| POST | `/api/books/{book_id}/chapters` | 新增或更新同序号章节 |
| GET | `/api/chapters/{chapter_id}` | 读取章节正文 |
| PATCH | `/api/chapters/{chapter_id}/content` | 写回章节正文缓存 |
| POST | `/api/reading-history` | 新增或更新阅读进度 |
| GET | `/api/reading-history?book_id=1` | 读取一本书的进度 |

新增书籍示例：

```json
{
  "title": "星轨图书馆",
  "author": "示例作者",
  "cover_url": "",
  "description": "演示小说",
  "book_url": "https://example.com/book/1",
  "toc_url": "https://example.com/book/1/catalog",
  "source_id": null
}
```

部分更新只发送需要修改的字段：

```json
{
  "title": "星轨图书馆（修订版）",
  "cover_url": "https://example.com/cover.jpg"
}
```

阅读进度示例：

```json
{
  "book_id": 1,
  "chapter_id": 1,
  "chapter_index": 0,
  "page_index": 3,
  "progress_percent": 18.5
}
```

## 书源

以下接口均需要 access token。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/sources/import` | 导入 JSON 书源 |
| POST | `/api/sources/import-demo` | 导入内置本地演示书源 |
| GET | `/api/sources?limit=100&offset=0` | 书源列表；`limit` 为 1–200 |
| PATCH | `/api/sources/{source_id}` | 修改名称、分组或启用状态 |
| DELETE | `/api/sources/{source_id}` | 软删除书源并解除书籍关联 |
| POST | `/api/sources/{source_id}/search` | 搜索单个书源 |
| POST | `/api/sources/{source_id}/book-info` | 解析书籍详情 |
| POST | `/api/sources/{source_id}/toc` | 解析目录 |
| POST | `/api/sources/{source_id}/content` | 解析正文 |

导入请求中的 `content` 可以是单个书源对象、书源数组或包含 `sources` 数组的 JSON 字符串：

```json
{
  "content": "{\"bookSourceName\":\"示例源\",\"bookSourceUrl\":\"https://example.com\",\"searchUrl\":\"https://example.com/search?q={{key}}\"}"
}
```

单源搜索：

```json
{
  "keyword": "星轨",
  "page": 1
}
```

目录解析：

```json
{
  "book_url": "https://example.com/book/1",
  "toc_url": "https://example.com/book/1/catalog"
}
```

正文解析：

```json
{
  "chapter_url": "https://example.com/book/1/chapter/1"
}
```

### 多书源搜索

`POST /api/search/books`

```json
{
  "keyword": "星轨",
  "page": 1,
  "source_ids": [1, 2, 3],
  "force_refresh": false
}
```

- `source_ids` 省略或为 `null` 时搜索当前用户全部启用书源，最多可指定 50 个。
- 后端按配置的最大并发数和超时并发请求，单源错误记录在 `source_results`，不会使整个请求失败。
- `books` 按标准化后的“书名 + 作者”去重，重复结果保存在每本书的 `alternatives` 中。
- `force_refresh=true` 跳过当前内存缓存；失败结果不会写入缓存。

响应结构：

```json
{
  "books": [
    {
      "title": "星轨图书馆",
      "author": "示例作者",
      "book_url": "https://source-a.example/book/1",
      "source_id": 1,
      "source_name": "书源 A",
      "alternatives": [
        {
          "source_id": 2,
          "source_name": "书源 B",
          "book_url": "https://source-b.example/book/9"
        }
      ]
    }
  ],
  "source_results": [
    {
      "source_id": 1,
      "source_name": "书源 A",
      "status": "success",
      "result_count": 1,
      "duration_ms": 120,
      "error_code": "",
      "message": ""
    }
  ],
  "duration_ms": 135
}
```

### 书源诊断

诊断会依次执行搜索、详情、目录、正文，并记录各阶段耗时与失败原因。它不会执行任意第三方 JavaScript，也不会绕过站点访问限制。

单源诊断：`POST /api/sources/{source_id}/diagnostics`

```json
{
  "keyword": "测试",
  "force_refresh": true
}
```

批量诊断：`POST /api/sources/diagnostics`

```json
{
  "keyword": "测试",
  "force_refresh": true,
  "source_ids": [1, 2, 3]
}
```

单源响应包含 `status`、`failed_stage`、`latency_ms`、`error_code`、`error_message` 和 `stages`。状态只使用 `healthy`、`degraded`、`unavailable`，便于直接定位失败阶段，不提供不透明的数字评分。批量接口通过 `diagnostics` 返回每个书源的结果。

### 书源会话

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/sources/{source_id}/session` | 读取当前用户保存的会话 |
| PUT | `/api/sources/{source_id}/session` | 新增或覆盖会话 |
| DELETE | `/api/sources/{source_id}/session` | 删除会话 |

```json
{
  "origin": "https://example.com",
  "cookie": "session=...",
  "user_agent": "Mozilla/5.0",
  "referer": "https://example.com/",
  "storage_state_json": "",
  "local_storage_json": "",
  "session_storage_json": "",
  "expires_at": 0,
  "last_verified_at": 0,
  "status": "active"
}
```

Cookie 和浏览器存储状态会加密后入库；后端解析搜索、详情、目录和正文时会自动注入处于 active 状态的 Cookie、User-Agent 和 Referer。不要保存无权使用的账号会话。

当前解析器支持基础 CSS、JSONPath、`@text`、`@html`、`@href`、`@src`、`||` 回退、正则替换和搜索模板变量。不执行任意第三方 JavaScript，也不绕过登录、会员或付费限制。

## 云同步

同步范围仅包括书架元数据、书源配置和阅读进度，不同步整本章节正文。所有同步接口都需要 access token。

### 推送本地变更

`POST /api/sync/push`

```json
{
  "device_id": "android-01",
  "mutations": [
    {
      "mutation_id": "01J4MUTATION001",
      "entity_type": "book",
      "sync_id": "01J4BOOKSYNC001",
      "base_version": 0,
      "operation": "upsert",
      "payload": {
        "title": "星轨图书馆",
        "author": "示例作者",
        "book_url": "https://example.com/book/1"
      }
    }
  ]
}
```

- `entity_type`：`book`、`source` 或 `reading_history`。
- `operation`：`upsert` 或 `delete`。
- 同一 `mutation_id` 重试会返回已保存结果，不重复写入。
- `base_version` 与服务端不一致时单项返回 `conflict`，不会覆盖服务端数据。
- 批次中每项独立返回 `applied`、`conflict` 或 `rejected`。

响应示例：

```json
{
  "results": [
    {
      "mutation_id": "01J4MUTATION001",
      "status": "applied",
      "entity_type": "book",
      "sync_id": "01J4BOOKSYNC001",
      "version": 1,
      "error_code": "",
      "message": "",
      "server_payload": null
    }
  ],
  "cursor": 12
}
```

### 拉取服务端变更

`GET /api/sync/pull?device_id=android-01&cursor=0&limit=200`

- `device_id` 必填。
- `cursor` 首次为 `0`，后续使用上次响应的 `next_cursor`。
- `limit` 为 1–500，默认 200。
- `has_more=true` 时继续用新的 cursor 拉取。
- 删除以 `operation=delete` 的 tombstone 下发。

## HTTP 代理

`GET /api/proxy/health` 用于确认代理路由存在；`POST /api/proxy/fetch` 需要 access token。

```json
{
  "url": "https://example.com/search?q=book",
  "method": "GET",
  "headers": {
    "User-Agent": "Mozilla/5.0",
    "Referer": "https://example.com/"
  },
  "body": null,
  "charset": "gbk",
  "throttle_ms": 500
}
```

代理只接受 `http`/`https` 目标和 `GET`/`POST` 方法。生产环境阻止私网目标，并对请求体、响应体、超时和同主机请求频率进行限制。响应包含解码后的 `text`、`status_code`、`final_url`、过滤后的响应头、`elapsed_ms`、`content_bytes` 和 `encoding`。

## AI 阅读助手

AI 接口均需要 access token。默认 `AI_PROVIDER=mock`，适合测试和演示。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/ai/summary` | 生成并保存章节总结 |
| GET | `/api/ai/summaries` | 总结历史，可按 `book_id`、`chapter_id` 筛选 |
| POST | `/api/ai/chat` | 基于上下文问答并保存记录 |
| GET | `/api/ai/chats` | 问答历史，可按 `book_id`、`chapter_id` 筛选 |
| GET | `/api/ai/calls` | 调用日志，可按书籍、章节、类型和状态筛选 |

AI 调用日志会记录 provider、model、状态、错误分类和耗时，但不得记录 AI Key 或完整章节正文。
