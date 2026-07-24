import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const storage = new Map()
globalThis.uni = {
  getStorageSync(key) {
    return storage.get(key)
  },
  setStorageSync(key, value) {
    storage.set(key, value)
  }
}

const { getPrefs, savePrefs } = await import('../common/reader.js')

const defaults = getPrefs()
assert.equal(defaults.ttsVoiceProvider, 'system')
assert.equal(defaults.ttsVoiceId, '')
assert.equal(defaults.ttsVoiceName, '系统默认')
assert.equal(defaults.ttsCloudConsent, false)

const selected = savePrefs({
  ttsVoiceProvider: 'system',
  ttsVoiceId: 'zh-cn-local-1',
  ttsVoiceName: '中文女声'
})
assert.equal(selected.ttsVoiceId, 'zh-cn-local-1')
assert.equal(selected.ttsVoiceName, '中文女声')

const selectedRole = savePrefs({
  ttsVoiceProvider: 'preset',
  ttsVoiceId: 'loli',
  ttsVoiceName: '任意旧名称'
})
assert.equal(selectedRole.ttsVoiceProvider, 'preset')
assert.equal(selectedRole.ttsVoiceId, 'loli')
assert.equal(selectedRole.ttsVoiceName, '萝莉 · 本地角色')

const invalidRole = savePrefs({
  ttsVoiceProvider: 'preset',
  ttsVoiceId: 'missing',
  ttsVoiceName: '不存在'
})
assert.equal(invalidRole.ttsVoiceProvider, 'system')
assert.equal(invalidRole.ttsVoiceId, '')
assert.equal(invalidRole.ttsVoiceName, '系统默认')

const selectedCloud = savePrefs({
  ttsVoiceProvider: 'volcengine',
  ttsVoiceId: 'loli',
  ttsVoiceName: '可爱女生',
  ttsCloudConsent: true
})
assert.equal(selectedCloud.ttsVoiceProvider, 'volcengine')
assert.equal(selectedCloud.ttsVoiceId, 'loli')
assert.equal(selectedCloud.ttsVoiceName, '可爱女生')
assert.equal(selectedCloud.ttsCloudConsent, true)

const cloudWithoutConsent = savePrefs({
  ttsVoiceProvider: 'volcengine',
  ttsVoiceId: 'uncle',
  ttsVoiceName: '胡子叔叔'
})
assert.equal(cloudWithoutConsent.ttsVoiceProvider, 'system')
assert.equal(cloudWithoutConsent.ttsVoiceId, '')

const invalidCloud = savePrefs({
  ttsVoiceProvider: 'volcengine',
  ttsVoiceId: '',
  ttsVoiceName: '空音色',
  ttsCloudConsent: 'true'
})
assert.equal(invalidCloud.ttsVoiceProvider, 'system')
assert.equal(invalidCloud.ttsVoiceId, '')
assert.equal(invalidCloud.ttsVoiceName, '系统默认')
assert.equal(invalidCloud.ttsCloudConsent, false)

const normalized = savePrefs({
  ttsVoiceProvider: 'cloud',
  ttsVoiceId: '',
  ttsVoiceName: '过期声音'
})
assert.equal(normalized.ttsVoiceProvider, 'system')
assert.equal(normalized.ttsVoiceId, '')
assert.equal(normalized.ttsVoiceName, '系统默认')

const voicePage = readFileSync(new URL('../pages/voice/voice.vue', import.meta.url), 'utf8')
const readerPage = readFileSync(new URL('../pages/reader/reader.vue', import.meta.url), 'utf8')
const readAloud = readFileSync(new URL('../common/readAloud.js', import.meta.url), 'utf8')
const pages = JSON.parse(readFileSync(new URL('../pages.json', import.meta.url), 'utf8'))

assert.ok(pages.pages.some(page => page.path === 'pages/voice/voice'))
assert.match(voicePage, /createReadAloudDriver/)
assert.match(voicePage, /driver\.listVoices/)
assert.match(voicePage, /previewVoice\(voice\)/)
assert.match(voicePage, /selectVoice\(voice\)/)
assert.match(voicePage, /previewRole\(role\)/)
assert.match(voicePage, /selectRole\(role\)/)
assert.match(voicePage, /resolveReadAloudVoiceProfile/)
assert.match(voicePage, /provider: 'preset'/)
assert.match(voicePage, /AI 拟真音色/)
assert.match(voicePage, /设备系统声音/)
assert.match(voicePage, /离线角色效果/)
assert.match(voicePage, /不是真人录音/)
assert.match(voicePage, /ttsCloudConsent/)
assert.match(voicePage, /启用 AI 拟真音色/)
assert.match(voicePage, /当前短片段发送至云端/)
assert.match(voicePage, /createCloudReadAloudDriver/)
assert.match(voicePage, /provider: 'volcengine'/)
assert.match(voicePage, /ensureCloudDriver\(\)\.listVoices\(\)/)
assert.match(voicePage, /未登录不影响设备声音和离线角色效果/)
assert.match(voicePage, /火山引擎凭据和音色配置/)
assert.match(readAloud, /tts\.setPitch\(normalizeReadAloudPitch\(options\.pitch\)\)/)
assert.match(voicePage, /reconcileSavedVoice/)
assert.match(voicePage, /原声音不可用，已恢复系统默认/)
assert.match(voicePage, /onHide\(\)[\s\S]*stopPreview/)
assert.match(voicePage, /onUnload\(\)[\s\S]*disposeDriver/)
assert.match(readAloud, /name: '萝莉'/)
assert.match(readAloud, /name: '大叔'/)
assert.match(readAloud, /name: '青年'/)
assert.match(readAloud, /name: '正太'/)
assert.match(readAloud, /name: '朗诵'/)
assert.doesNotMatch(voicePage, /即将支持/)
assert.match(voicePage, /音调 \{\{ role\.pitch \}\}/)
assert.match(voicePage, /节奏 \{\{ role\.rateScale \}\}x/)
assert.match(voicePage, /Android 已排除明确要求联网的音色/)

assert.match(readerPage, /openVoiceSelector/)
assert.match(readerPage, /\/pages\/voice\/voice/)
assert.match(readerPage, /prefs\.ttsVoiceName/)
assert.match(readerPage, /voiceId: this\.prefs\.ttsVoiceId/)
assert.match(readerPage, /voiceProvider: this\.prefs\.ttsVoiceProvider/)
assert.match(readerPage, /readAloudController\.setVoice/)
assert.match(readerPage, /AI 拟真音色/)

console.log('voiceSelection tests passed')
