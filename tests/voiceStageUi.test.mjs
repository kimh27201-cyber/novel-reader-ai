import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../pages/voice/voice.vue', import.meta.url), 'utf8')

const roleColors = {
  loli: '#FF7EA8',
  uncle: '#B87949',
  youth: '#4B87F7',
  shota: '#42C4B7',
  recital: '#8D72D9'
}

for (const [id, color] of Object.entries(roleColors)) {
  assert.match(source, new RegExp(`${id}:\\s*\\{[\\s\\S]*?color:\\s*'${color}'`))
}

assert.match(source, /DEFAULT_VOICE_VISUAL/)
assert.match(source, /resolveVoiceVisual\(voice, index = 0\)/)
assert.match(source, /VOICE_ROLE_VISUALS\[id\]/)
assert.match(source, /adaptColorForTheme\(source\.color, this\.themeId\)/)

assert.match(source, /class="current-stage"/)
assert.match(source, /activeVoicePreviewing/)
assert.match(source, /previewActiveVoice/)
assert.match(source, /class="cloud-stage-grid"/)
assert.match(source, /isWideCloudVoice\(voice\)/)
assert.match(source, /return String\(\(voice && voice\.id\) \|\| ''\)\.toLowerCase\(\) === 'recital'/)
assert.match(source, /deviceExpanded: prefs\.ttsVoiceProvider === 'system'/)
assert.match(source, /class="section-toggle"/)
assert.match(source, /deviceExpanded = !deviceExpanded/)

assert.match(source, /AI 合成音，不是真人录音/)
assert.match(source, /离线角色效果/)
assert.match(source, /min-height:\s*88rpx/)
assert.match(source, /@media \(prefers-reduced-motion: reduce\)/)
assert.doesNotMatch(source, /\.stage-orbit/)
assert.doesNotMatch(source, /<image\b/)
assert.doesNotMatch(source, /\.poster-ring/)
assert.doesNotMatch(source, /\.cloud-poster::before/)
assert.doesNotMatch(source, /@keyframes voice-orbit/)
assert.match(source, /themeClass/)
assert.match(source, /--app-voice-stage-decoration/)
assert.match(source, /--app-voice-label-font/)
assert.match(source, /--app-voice-card-shape/)
assert.match(source, /::after/)
assert.match(source, /theme-xuanye \.cloud-poster\.selected::after/)
assert.match(source, /theme-candy \.cloud-poster\.selected::after/)
assert.match(source, /adaptColorForTheme/)
assert.match(source, /adaptWashForTheme/)

console.log('voice stage UI tests passed')
