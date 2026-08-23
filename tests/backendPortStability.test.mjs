import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const starter = readFileSync(new URL('../scripts/start_backend_detached.py', import.meta.url), 'utf8')
const acceptance = readFileSync(new URL('../scripts/run_hbuilder_tts_acceptance.ps1', import.meta.url), 'utf8')
const voicePage = readFileSync(new URL('../pages/voice/voice.vue', import.meta.url), 'utf8')
const startDev = readFileSync(new URL('../start-dev.bat', import.meta.url), 'utf8')

assert.match(starter, /DEFAULT_PORT = 8765/)
assert.match(starter, /api\/health\/ready/)
assert.match(starter, /payload\.get\("database"\) == "ready"/)
assert.match(starter, /"pythonhome", "pythonpath"/)
assert.match(starter, /LOG_DIR = ROOT \/ "logs"/)
assert.match(starter, /json\.loads\(response\.read\(\)\.decode\("utf-8"\)\)/)
assert.match(starter, /payload\.get\("status"\) == "ok"/)
assert.match(starter, /startsWith\("Novel Reader"\)|startswith\("Novel Reader"\)/)
assert.match(starter, /occupied by a non-Novel Reader service/)
assert.match(starter, /return 3/)

assert.match(acceptance, /\$BackendUrl = "http:\/\/127\.0\.0\.1:8765"/)
assert.match(acceptance, /\$DevicePort = 8765/)
assert.match(acceptance, /\[switch\]\$AllowUpstreamTts/)
assert.match(acceptance, /may synthesize uncached text/)

assert.match(startDev, /BACKEND_URL=http:\/\/127\.0\.0\.1:8765/)
assert.match(startDev, /start_backend_detached\.py/)
assert.match(startDev, /"%BACKEND_STARTER%" --port 8765/)
assert.doesNotMatch(startDev, /uvicorn app\.main:app.*--reload/)
assert.match(startDev, /api\/health\/ready/)
assert.match(startDev, /reverse tcp:8765 tcp:8765/)
assert.doesNotMatch(startDev, /reverse --remove-all/)
assert.match(startDev, /\$r\.app -like 'Novel Reader\*'/)

for (const state of [
  'wrong_service',
  'backend_offline',
  'not_configured',
  'not_verified',
  'quota_exhausted',
  'no_voices'
]) {
  assert.match(voicePage, new RegExp(state))
}
assert.match(voicePage, /连接到了错误服务/)
assert.match(voicePage, /HBuilderX 基座联调请使用 8765 端口/)

console.log('backend port stability tests passed')
