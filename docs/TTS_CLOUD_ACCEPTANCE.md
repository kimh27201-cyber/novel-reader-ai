# AI 拟真听读配置与验收

## 功能边界

- 火山引擎神经 TTS 用于生成“AI 拟真音色”，正文片段会在用户明确同意后发送到云端。
- 云端密钥只配置在 FastAPI 后端，不写入 H5、HBuilderX App 或自建 APK。
- 未登录、未同意、断网、云端超时或额度不足时，阅读器会明确提示，并从当前段落切换到设备系统声音。
- 当前是单一旁白音色，不进行小说人物识别，也不宣称是真人录音。

## 后端配置

在 `backend/.env` 中配置：

```dotenv
TTS_ENABLED=true
TTS_APP_ID=你的火山引擎AppID
TTS_ACCESS_TOKEN=你的火山引擎AccessToken
TTS_BASE_URL=https://openspeech.bytedance.com/api/v3/tts/unidirectional
TTS_RESOURCE_ID=seed-tts-1.0
TTS_MODEL=volcengine-v3
TTS_MAX_CONCURRENCY=2
TTS_DAILY_UNCACHED_CHARACTERS=50000
```

默认五种逻辑角色及其 Speaker ID、Resource ID 已内置。若账号购买的音色不同，可通过 `TTS_VOICES_JSON` 替换白名单，前端只保存稳定的逻辑音色 ID，不保存供应商 Speaker ID。

配置后在 `backend` 目录执行：

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

访问 `GET /api/health/ready` 确认数据库迁移和服务就绪，再登录 App。

## 自动生成五种真实试听文件

后端运行且云 TTS 已启用后，在 `backend` 目录执行：

```powershell
$env:TTS_ACCEPTANCE_BASE_URL='http://127.0.0.1:8000'
.\.venv\Scripts\python.exe scripts\tts_real_service_acceptance.py
```

脚本会注册临时验收用户、枚举后端实际可用音色并生成 MP3，默认输出到：

```text
backend/data/tts-acceptance/
```

若使用已有账号：

```powershell
$env:TTS_ACCEPTANCE_USERNAME='你的用户名'
$env:TTS_ACCEPTANCE_PASSWORD='你的密码'
.\.venv\Scripts\python.exe scripts\tts_real_service_acceptance.py
```

## App 外部验收

1. 登录后进入阅读设置 → 声音选择，确认出现“AI 拟真音色”区域。
2. 首次试听或选择云音色时，确认出现正文片段上传说明；拒绝后不应调用云端。
3. 分别试听萝莉、大叔、青年、正太、朗诵，并至少选择两种音色进行正式听读。
4. 连续听读三章，观察高亮、自动翻页、自动下一章、暂停、恢复、跳段和进度保存。
5. 播放中断网，确认出现“云端音色不可用，已切换系统声音”，并从当前段落继续。
6. 切到后台、手动翻页、目录跳转和退出阅读页，确认声音停止。
7. 重启 App，确认选择和云端授权偏好仍保留。
8. 在未登录、TTS 未配置和用户额度用尽三种状态下，确认离线系统听读仍可用。

## 听感评分

每种音色使用同一段文案，按 1–5 分记录：

| 音色 | 自然度 | 角色匹配 | 清晰度 | 长听疲劳 | 是否通过 |
|---|---:|---:|---:|---:|---|
| 萝莉 |  |  |  |  |  |
| 大叔 |  |  |  |  |  |
| 青年 |  |  |  |  |  |
| 正太 |  |  |  |  |  |
| 朗诵 |  |  |  |  |  |

自然度与角色匹配平均分均达到 4 分，且三章连续播放无重复、跳段或崩溃，才判定拟真人听读验收通过。个人听感无法由自动化测试替代。

