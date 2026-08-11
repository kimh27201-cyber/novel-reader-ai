# AI 拟真听读配置与验收

## 1. 安全边界

- 火山引擎神经 TTS 生成的是“AI 拟真音色”，不是声音复刻或真人录音。
- 正文片段只在用户明确同意后发往云端；未登录、未同意、断网或额度不足时，阅读器明确提示并回退到设备系统声音。
- `TTS_APP_ID`、`TTS_ACCESS_TOKEN` 只写入本机或服务器的 `backend/.env`。不要粘贴到聊天、前端代码、APK、验收报告或 Git。
- 自动测试全部使用 mock。只有本文的真实探测命令会调用火山引擎并消耗试用额度。

## 2. 开通并配置火山引擎

先在火山引擎控制台完成实名认证、开通豆包语音合成服务、创建应用，并确认账号拥有待测试音色的授权。将 `backend/.env.example` 复制为 `backend/.env`，至少配置：

```dotenv
TTS_ENABLED=true
TTS_APP_ID=控制台中的AppID
TTS_ACCESS_TOKEN=控制台中的AccessToken
TTS_BASE_URL=https://openspeech.bytedance.com/api/v3/tts/unidirectional
TTS_MODEL=volcengine-v3
TTS_MAX_CONCURRENCY=2
TTS_DAILY_UNCACHED_CHARACTERS=10000
TTS_GLOBAL_DAILY_UNCACHED_CHARACTERS=12000
TTS_GLOBAL_MONTHLY_UNCACHED_CHARACTERS=20000
```

实际试用额度若低于上述限制，应把应用限制同步调低。`.env` 已被 Git 忽略。

默认五个逻辑角色分别为 `loli`、`uncle`、`youth`、`shota`、`recital`。逻辑 ID 会持久化到阅读偏好，供应商 Speaker ID 不会进入前端。若账号授权音色不同，可以在运行探测前临时设置同角色候选：

```powershell
$env:TTS_PROBE_CANDIDATES_JSON=@'
{
  "loli": [
    {"name":"候选女生一","speaker_id":"控制台SpeakerID","resource_id":"控制台ResourceID"},
    {"name":"候选女生二","speaker_id":"另一个SpeakerID","resource_id":"对应ResourceID"}
  ],
  "recital": [
    {"name":"候选朗诵","speaker_id":"控制台SpeakerID","resource_id":"对应ResourceID"}
  ]
}
'@
```

脚本按照“环境变量候选 → `TTS_VOICES_JSON` 已配置音色 → 项目内置音色”的顺序尝试，每个角色找到首个可用音色后立即停止，不会遍历并消耗所有候选。

## 3. 真实音色探测

在任意目录执行以下命令均可，脚本会固定读取 `backend/.env`：

```powershell
cd D:\Codex\novel-reader-uniapp
.\backend\.venv\Scripts\python.exe .\backend\scripts\tts_real_service_acceptance.py
```

探测器会：

1. 验证 V3 鉴权、Speaker ID、Resource ID、24 kHz MP3 和 `X-Tt-Logid`。
2. 区分鉴权/音色授权、欠费、额度/限流、超时、网络和无效响应。
3. 为每个通过的角色生成一份试听 MP3。
4. 输出不含密钥、不含试听正文的 `probe-report.json`。
5. 严格限制所有候选请求的累计文本不超过 2,000 字；通常首轮远低于该值。

默认产物：

```text
backend/data/tts-acceptance/
├── loli.mp3
├── uncle.mp3
├── youth.mp3
├── shota.mp3
├── recital.mp3
└── probe-report.json
```

退出码 `0` 表示五个角色全部通过，`2` 表示探测已完成但存在未授权或不可用角色。报告中的 `recommended_tts_voices_json` 就是候选探测选出的最终映射；将它压缩为单行 JSON，写入 `backend/.env` 的 `TTS_VOICES_JSON`，然后重启后端。不要手工猜测 Speaker ID。

直连探测器只选择候选和生成试听文件，不修改数据库。后端重启后，Android 调试验收页会先按五个稳定逻辑 ID 调用 `/api/tts/synthesize`；成功日志会形成服务端验证记录，随后刷新 `/api/tts/voices`，正式声音页才会显示这些 `verified=true` 的音色。这避免把“仅配置但从未真实合成”的音色暴露给普通用户。

## 4. 启动后端

探测通过后，在 `backend` 目录执行：

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8765
```

确认：

- `GET http://127.0.0.1:8765/api/health/ready` 返回数据库和最新迁移就绪。
- 登录后访问 `GET /api/tts/status`，`enabled=true` 且五个逻辑角色已验证。
- `GET /api/tts/voices` 只将真实探测成功的声音标记为可用。

## 5. HBuilderX Android 基座自动验收

前置条件：

- HBuilderX 已把应用运行到一台已授权的 Android 手机。
- 设备上安装并可启动 `io.dcloud.HBuilder`。
- 电脑只连接这一台 Android 设备。
- 后端已在 `127.0.0.1:8765` 启动。
- 手机中的调试应用已经登录，或者调试验收页具备自动创建临时账号并登录的能力。编排脚本创建的临时账号仅用于后端状态预检，不会把 access token 注入手机，也不会写入日志。

从项目根目录运行：

```powershell
.\scripts\run_hbuilder_tts_acceptance.ps1
```

编排脚本自动执行：

1. 检查唯一授权设备和 HBuilderX 基座。
2. 建立 `adb reverse tcp:8765 tcp:8765`。
3. 检查后端 ready、以独立临时验收用户读取 TTS status；该身份不替代手机 App 登录。
4. 清空并采集 logcat，启动 `io.dcloud.HBuilder`。
5. 监听验收页输出的 `TTS_ACCEPTANCE:{json}` 标记。
6. 触发一次返回桌面和恢复，验证进入后台后声音停止。
7. 导出脱敏 JSON、完整 logcat、验收标记和最终截图。

HBuilderX 基座无法可靠通过 ADB 直接指定 uni-app 内部路由。脚本启动基座后，如果验收页没有自动打开，只需手动进入“调试 → TTS 自动验收”一次；进入后所有测试自动运行。如果页面提示未登录，先完成 App 登录再重试。无人值守场景可使用 `-NoPrompt`，但前提是验收页已在前台或应用支持自动进入：

```powershell
.\scripts\run_hbuilder_tts_acceptance.ps1 -NoPrompt -TimeoutSeconds 900
```

若使用其他端口：

```powershell
.\scripts\run_hbuilder_tts_acceptance.ps1 `
  -BackendUrl http://127.0.0.1:8765 `
  -DevicePort 8765
```

上例会建立 `adb reverse tcp:8765 tcp:8765`，手机与电脑统一使用本地开发端口
`8765`。如需执行会产生未缓存合成请求的完整验收，必须额外显式传入
`-AllowUpstreamTts`；未传入时脚本会拒绝执行，避免意外消耗额度。

验收产物默认位于：

```text
artifacts/tts-acceptance/<yyyyMMdd-HHmmss>/
├── orchestration-report.json
├── device-logcat.txt
├── tts-markers.txt
└── device-final.png
```

该目录已被 Git 忽略。报告和日志不会写入 access token、火山引擎密钥或正文。

## 6. 完成标准与人工听感

自动验收通过必须同时满足：

- 五个逻辑角色均有真实可用的官方神经音色。
- MP3 能完成 `canplay/play/ended`，三段模拟章节无重复、跳段或崩溃。
- 第二轮相同文本主要命中缓存。
- 云端失败时从当前段明确回退系统 TTS，进入后台后停止。
- 段间停顿目标不超过 800 ms；超出会在报告中标红。
- APK/HBuilderX 基座中扫描不到 App ID 或 Access Token。

自动化无法判断个人听感。请对同一段试听文案按 1–5 分记录：

| 音色 | 自然度 | 角色匹配 | 清晰度 | 长听疲劳 | 是否通过 |
|---|---:|---:|---:|---:|---|
| 萝莉 |  |  |  |  |  |
| 大叔 |  |  |  |  |  |
| 青年 |  |  |  |  |  |
| 正太 |  |  |  |  |  |
| 朗诵 |  |  |  |  |  |

自然度与角色匹配的平均分均达到 4 分，并且连续听读三章无异常，才判定“真实声音开发”最终验收通过。

## 7. 2026-07-27 本机真实验收结果

- 火山引擎免费试用字符包下，五个逻辑角色均完成真实 V3 MP3 合成与手机播放。
- HBuilderX Android 基座自动验收结果：`11/11`，失败 `0`，提醒 `0`。
- 三章连续听读共 6 个片段，顺序、预取和段落衔接通过；最大调度间隔 `32 ms`。
- 相同文本复跑命中缓存；云端故障降级、音色切换、停止、过期回调隔离及后台停止均通过。
- 后台停止单项耗时 `404 ms`。
- 前端 70 个测试文件全部通过；后端 `120 passed in 10.41s`。
- 手机已恢复到正常书架启动页，调试验收页仍仅通过调试入口访问。

脱敏机器报告：

```text
artifacts/tts-acceptance/20260727-0250/report.json
```

验收未点击正式付费开通；重复播放主要读取 7 天音频缓存。自动化完成后仅剩个人听感评分。
