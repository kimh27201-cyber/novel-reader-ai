# 解码阅读 V2 后端

基于 FastAPI、SQLAlchemy、Alembic 的可选云后端。未登录用户仍可使用客户端本地阅读；登录后可使用书架与进度同步、后端书源解析、受保护的 HTTP 代理和 AI 阅读助手。

## 技术栈与目录

- Python 3.12、FastAPI、Pydantic 2
- SQLAlchemy 2、Alembic
- 本地开发使用 SQLite，正式部署推荐 PostgreSQL 16
- JWT access token + 可轮换、可撤销的 refresh token
- pytest、GitHub Actions、Docker Compose

```text
backend/
  app/api/          # HTTP 路由
  app/core/         # 配置、安全与可观测性
  app/db/           # 数据库连接
  app/models/       # SQLAlchemy 模型
  app/schemas/      # 请求/响应模型
  app/services/     # 认证、同步、书源网关与解析服务
  migrations/       # Alembic 迁移
  tests/            # 后端测试
```

## 本地启动

在 `D:\Codex\novel-reader-uniapp\backend` 执行：

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --port 8765
```

启动后可访问：

- Swagger：`http://127.0.0.1:8765/docs`
- 基础健康检查：`GET http://127.0.0.1:8765/api/health`
- 存活检查：`GET http://127.0.0.1:8765/api/health/live`
- 就绪检查：`GET http://127.0.0.1:8765/api/health/ready`

离线书架、聚合快照和真实书源验收说明见 `..\docs\BACKEND_OFFLINE_LIBRARY_ACCEPTANCE.md`。

`ready` 会同时检查数据库连接和 Alembic 版本；数据库未迁移到最新版本时返回 `503`。

## 环境变量

完整默认值见 `.env.example`，Docker 示例见 `.env.docker.example`。常用配置：

| 变量 | 说明 |
| --- | --- |
| `APP_ENV` | `development`、`testing` 或 `production` |
| `DATABASE_URL` | SQLAlchemy 数据库 URL |
| `JWT_SECRET_KEY` | JWT 签名密钥；生产环境至少 32 字符且不得使用默认值 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | access token 有效分钟数 |
| `REFRESH_TOKEN_EXPIRE_DAYS` | refresh token 有效天数 |
| `ALLOW_QUERY_TOKEN_AUTH` | 是否兼容 URL 查询参数 token，默认 `false` |
| `BCRYPT_ROUNDS` | bcrypt 成本；测试环境可设为 `4` |
| `CORS_ALLOW_ORIGINS` | 逗号分隔的允许来源；生产环境禁止 `*` |
| `PROXY_ALLOW_PRIVATE_NETWORKS` | 是否允许代理访问私网；生产环境必须为 `false` |
| `PROXY_TIMEOUT_SECONDS` | 代理超时秒数 |
| `PROXY_MAX_REQUEST_BYTES` | 代理请求体上限 |
| `PROXY_MAX_RESPONSE_BYTES` | 代理响应体上限 |
| `SOURCE_TIMEOUT_SECONDS` | 单个书源请求超时秒数 |
| `SOURCE_MAX_CONCURRENCY` | 书源最大并发数 |
| `SOURCE_RETRY_COUNT` | 幂等 GET 失败重试次数 |
| `SOURCE_REQUEST_INTERVAL_MS` | 同一主机最小请求间隔 |
| `SOURCE_CACHE_MAX_ENTRIES` | 书源内存缓存最大条目数 |
| `SESSION_ENCRYPTION_KEY` | Cookie/存储状态加密密钥；生产环境必填且应与 JWT 密钥不同 |
| `AI_PROVIDER` | `mock`、`deepseek` 或 `openai` |

生产环境还必须满足：

```env
APP_ENV=production
JWT_SECRET_KEY=<至少 32 字符的随机密钥>
CORS_ALLOW_ORIGINS=https://your-frontend.example.com
PROXY_ALLOW_PRIVATE_NETWORKS=false
SESSION_ENCRYPTION_KEY=<独立随机密钥>
```

应用会在配置不安全时拒绝启动。不要把真实 token、Cookie、AI Key 或密钥提交到仓库。

## 数据库迁移

```powershell
cd D:\Codex\novel-reader-uniapp\backend
.\.venv\Scripts\Activate.ps1
python -m alembic current
python -m alembic upgrade head
```

不要对已经由 Alembic 管理的数据库执行 `alembic stamp head`，否则可能跳过真实表结构变更。迁移前先备份正式数据库。

当前模型包含用户、书籍、章节、书源、书源会话、阅读进度、AI 记录、refresh token、同步变更/设备以及书源健康检查等表。章节、阅读进度、书源和书源会话均有数据库唯一约束，外键删除行为由迁移明确管理。

## 测试

```powershell
cd D:\Codex\novel-reader-uniapp\backend
.\.venv\Scripts\Activate.ps1
$env:BCRYPT_ROUNDS='4'
python -m pytest
```

CI 执行以下检查：

1. 在 PostgreSQL 16 上从空库执行全部 Alembic 迁移。
2. 对 PostgreSQL 实例执行 readiness、注册、登录、当前用户和书架 API 冒烟测试。
3. 在 `0003_source_sessions` SQLite 中写入旧业务数据和归一化重复行，再升级并验证去重、引用重指与外键完整性。
4. 分别在 SQLite 和 PostgreSQL 16 上运行完整 pytest 测试套件。
5. 运行全部前端工具测试。

启动本地 API 后，可以运行可重复的阅读主链路验收脚本：

```powershell
cd D:\Codex\novel-reader-uniapp\backend
$env:ACCEPTANCE_BASE_URL='http://127.0.0.1:8765'
python scripts/acceptance_smoke.py
```

脚本会执行：注册/登录 → 导入本地演示书源 → 多源搜索 → 详情 → 目录 → 正文 → 加入书架 → 保存进度 → 第二设备同步。它只使用仓库内置演示源，不访问真实小说站点。

真实站点不进入自动化测试。发布前应选择至少 3 个明确允许公开访问的普通书源，手工执行同一条链路，并记录站点、测试时间、搜索/详情/目录/正文各阶段状态、HTTP 状态和失败原因；不得测试需要绕过登录、会员、付费、广告或其他访问限制的站点。

## Docker Compose

在项目根目录执行：

```powershell
cd D:\Codex\novel-reader-uniapp
docker compose up --build -d
docker compose ps
docker compose logs -f api
```

API 容器启动时自动执行 `alembic upgrade head`。Compose 为 API 和 PostgreSQL 配置了健康检查，并限制 JSON 日志为每个文件 10 MB、最多 3 个文件。

仓库中的 Docker 环境文件用于本地演示。正式部署前必须替换数据库口令、JWT 密钥、会话加密密钥和 CORS 来源，并设置 `APP_ENV=production`、`PROXY_ALLOW_PRIVATE_NETWORKS=false`。

### PostgreSQL 备份

Compose 将项目根目录的 `backups/` 挂载到数据库容器的 `/backups`。备份前先确保目录存在：

```powershell
New-Item -ItemType Directory -Force .\backups | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
docker compose exec -T db pg_dump -U novel_reader -d novel_reader -Fc -f "/backups/novel_reader-$stamp.dump"
```

验证备份内容：

```powershell
docker compose exec -T db pg_restore -l /backups/novel_reader-YYYYMMDD-HHMMSS.dump
```

恢复会覆盖数据库内容，应先停止 API 并再次备份，再按实际文件名执行：

```powershell
docker compose stop api
docker compose exec -T db pg_restore -U novel_reader -d novel_reader --clean --if-exists /backups/novel_reader-YYYYMMDD-HHMMSS.dump
docker compose start api
```

## 鉴权与接口

除注册、登录、refresh 和健康检查外，业务接口都通过请求头鉴权：

```text
Authorization: Bearer <access_token>
```

默认不接受 `?access_token=...`，避免 token 进入浏览器历史、访问日志和代理日志。登录响应同时返回 access token、refresh token 和 `expires_in`；refresh token 每次刷新后都会轮换，客户端必须保存最新值。

完整请求示例和同步协议见 [API 文档](../docs/API.md)。

## 书源安全边界

- 后端只执行受支持的 CSS/JSONPath/文本提取规则，不执行任意第三方 JavaScript。
- 不绕过登录、会员、付费、广告或站点访问限制。
- 已保存的 Cookie 和浏览器存储状态在数据库中加密；Cookie、User-Agent、Referer 会用于该用户对应书源的后续请求。
- `POST /api/search/books` 可并发搜索启用的书源，按“标准化书名 + 作者”去重，并保留候选书源；单源失败不会拖垮整批结果。
- 单源和批量 diagnostics 会依次检查搜索、详情、目录、正文阶段，返回 `healthy`、`degraded` 或 `unavailable` 及失败阶段。
- 生产模式阻止 loopback、私网、链路本地地址和解析到这些地址的域名，降低 SSRF 风险。
- HTTP 代理仅允许 `GET`、`POST`，并限制请求体、响应体和超时。

## 日志

请求日志包含 request ID、用户 ID、路由、状态码和耗时；上游错误使用错误码分类。日志不得记录 Authorization、refresh token、Cookie、章节正文或 AI Key。排查问题时优先使用响应头中的 request ID 关联日志。

## 云端拟真 TTS

云端 TTS 默认关闭，未配置时不会影响设备系统 TTS。启用火山引擎 V3 TTS：

```env
TTS_ENABLED=true
TTS_APP_ID=<火山引擎应用 ID>
TTS_ACCESS_TOKEN=<火山引擎 Access Token>
TTS_RESOURCE_ID=seed-tts-1.0
```

凭据只放在后端环境变量中，不得写入前端或 APK。内置五种角色会分别使用与 Speaker 匹配的 `seed-tts-1.0`、`seed-icl-1.0` 或 `seed-icl-2.0`；`TTS_RESOURCE_ID` 只是自定义音色未声明 `resource_id` 时的后备值。`TTS_VOICES_JSON` 可覆盖逻辑角色与火山 Speaker ID 的白名单：

```json
[
  {
    "id": "recital",
    "name": "内敛才俊",
    "role": "朗诵",
    "speaker_id": "控制台已授权的 Speaker ID",
    "resource_id": "与该音色匹配的 seed-icl/seed-tts 资源 ID",
    "is_default": true
  }
]
```

接口均要求登录，音频下载使用短期签名票据，不在 URL 中传递 access token：

- `GET /api/tts/voices`
- `POST /api/tts/synthesize`
- `GET /api/tts/audio/{cache_key}?ticket=...`

单次合成限制 300 字和 900 UTF-8 字节；默认每用户每日、全局每日、全局每月最多产生
10,000、12,000、20,000 个未缓存字符，全局最多并发 2 个上游请求。可分别通过
`TTS_DAILY_UNCACHED_CHARACTERS`、`TTS_GLOBAL_DAILY_UNCACHED_CHARACTERS` 和
`TTS_GLOBAL_MONTHLY_UNCACHED_CHARACTERS` 下调硬限额。MP3 缓存默认保留 7 天、总量最多
1 GB。

`GET /api/tts/status` 返回服务是否启用、真实验证过的音色数量和当前用户的剩余额度；
`GET /api/tts/voices` 中的 `verified` 只会在该音色产生过一次未缓存成功合成后变为
`true`。`tts_call_logs` 仅记录字符数、音色、耗时、缓存命中、供应商请求 ID、HTTP 状态
和音频字节数，不保存正文、Token 或供应商错误原文。

真实服务验收需先启动已配置 TTS 的后端，然后执行：

```powershell
cd D:\Codex\novel-reader-uniapp\backend
$env:TTS_ACCEPTANCE_BASE_URL='http://127.0.0.1:8765'
.\.venv\Scripts\python.exe scripts\tts_real_service_acceptance.py
```

脚本会注册临时用户，并为所有可用云音色生成固定文案试听文件到 `data/tts-acceptance/`。自动测试会 mock 上游，不会消耗真实额度。
