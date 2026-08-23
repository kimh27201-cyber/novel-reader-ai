import assert from 'node:assert/strict'
import {
  TTS_ACCEPTANCE_MARKER,
  TTS_ACCEPTANCE_REQUIRED_VOICES,
  buildTtsAcceptanceChapters,
  createTtsAcceptanceRunner,
  emitTtsAcceptanceMarker,
  sanitizeTtsAcceptanceReport,
  summarizeTtsAcceptance
} from '../common/ttsAcceptance.js'

const voices = TTS_ACCEPTANCE_REQUIRED_VOICES.map(id => ({
  id,
  name: `voice-${id}`,
  verified: true,
  available: true
}))

const chapters = buildTtsAcceptanceChapters()
assert.equal(chapters.length, 3)
assert.ok(chapters.every(chapter => chapter.segments.length === 2))
assert.ok(chapters.flatMap(chapter => chapter.segments).every(text => text.length <= 300))
const chapterCharacters = chapters.reduce(
  (total, chapter) => total + chapter.segments.reduce((sum, text) => sum + text.length, 0),
  0
)
assert.ok(chapterCharacters >= 1400 && chapterCharacters <= 1600)

const dirtyReport = {
  token: 'secret',
  nested: {
    audio_url: '/api/tts/audio/key?ticket=secret',
    message: 'Bearer abc.def and ?access_token=hidden',
    speaker_id: 'provider-secret'
  }
}
const sanitized = sanitizeTtsAcceptanceReport(dirtyReport)
assert.equal(sanitized.token, undefined)
assert.equal(sanitized.nested.audio_url, undefined)
assert.equal(sanitized.nested.speaker_id, undefined)
assert.doesNotMatch(sanitized.nested.message, /abc\.def|hidden/)

const markerLines = []
emitTtsAcceptanceMarker({ phase: 'start', token: 'secret' }, line => markerLines.push(line))
assert.equal(markerLines.length, 1)
assert.ok(markerLines[0].startsWith(TTS_ACCEPTANCE_MARKER))
assert.doesNotMatch(markerLines[0], /secret/)

function createCloudDriver() {
  let active = null
  let disposed = false
  const calls = []
  return {
    available: true,
    calls,
    prefetchCalls: [],
    prefetch(text, options) {
      this.prefetchCalls.push({ text, options })
      return Promise.resolve(true)
    },
    speak(text, options) {
      if (disposed) return Promise.reject(new Error('disposed'))
      if (active) {
        active.reject(new Error('听读已停止'))
        active = null
      }
      calls.push({ text, options })
      if (/acceptance-stale-first|acceptance-stop|acceptance-background/.test(options.utteranceId)) {
        return new Promise((resolve, reject) => {
          active = { resolve, reject, utteranceId: options.utteranceId }
        })
      }
      return Promise.resolve({
        status: 'done',
        provider: 'volcengine',
        cacheHit: true
      })
    },
    stop() {
      if (!active) return
      active.reject(new Error('听读已停止'))
      active = null
    },
    dispose() {
      disposed = true
      this.stop()
    }
  }
}

const synthesizedKeys = new Set()
let voiceListCalls = 0
const client = {
  getBaseUrl: () => 'http://127.0.0.1:8000',
  getToken: () => 'stored-token',
  readinessCheck: async () => ({ status: 'ok', database: 'ready', migration: '0007_tts_provider_metadata' }),
  getMe: async () => ({ id: 1, username: 'student' }),
  getTtsStatus: async () => ({
    enabled: true,
    configured: true,
    verified_voice_count: 5,
    quota: { user_daily_remaining: 9000, global_monthly_remaining: 18000 }
  }),
  listTtsVoices: async () => {
    voiceListCalls += 1
    return {
      voices: voices.map(voice => ({
        ...voice,
        verified: voiceListCalls > 1,
        available: voiceListCalls > 1
      }))
    }
  },
  async synthesizeTts(payload) {
    const key = `${payload.voiceId}:${payload.rate}:${payload.text}`
    const cacheHit = synthesizedKeys.has(key)
    synthesizedKeys.add(key)
    return {
      audio_url: '/api/tts/audio/cache?ticket=redacted',
      cache_hit: cacheHit
    }
  }
}

const cloudDriver = createCloudDriver()
const systemCalls = []
const systemDriver = {
  available: true,
  speak(text, options) {
    systemCalls.push({ text, options })
    return Promise.resolve({ status: 'done' })
  },
  stop() {},
  dispose() {}
}
const markers = []
const updates = []
let runner
runner = createTtsAcceptanceRunner({
  apiClient: client,
  cloudDriver,
  systemDriver,
  delay: async () => {},
  backgroundTimeoutMs: 10,
  emit(payload) {
    markers.push(payload)
    if (payload.phase === 'result' && payload.status === 'waiting_background') {
      queueMicrotask(() => runner.onBackground())
    }
  },
  onUpdate(report) {
    updates.push(report)
  }
})

const report = await runner.run()
assert.equal(report.passed, true)
assert.equal(report.requiresManualPlayback, false)
assert.equal(report.environment.authenticated, true)
assert.equal(report.environment.ttsEnabled, true)
assert.equal(report.environment.migrationVersion, '0007_tts_provider_metadata')
assert.equal(report.environment.verifiedVoiceCount, 5)
assert.equal(voiceListCalls, 2)
assert.equal(report.metrics.voices.length, 5)
assert.equal(report.metrics.cache.cacheHit, true)
assert.deepEqual(report.metrics.controls, {
  switchPassed: true,
  stopPassed: true,
  staleCallbackIgnored: true
})
assert.equal(report.metrics.chapters.chapters, 3)
assert.equal(report.metrics.chapters.segments, 6)
assert.equal(report.metrics.chapters.targetMet, true)
assert.equal(report.metrics.chapters.sequenceValid, true)
assert.equal(report.metrics.chapters.highlightTransitions, 6)
assert.equal(report.metrics.chapters.chapterTransitions, 2)
assert.equal(report.metrics.chapters.progressCheckpoints, 6)
assert.equal(report.metrics.fallback.fallbackProvider, 'system')
assert.equal(report.metrics.background.backgroundObserved, true)
assert.deepEqual(report.metrics.remainingQuota, {
  user_daily_remaining: 9000,
  global_monthly_remaining: 18000
})
assert.equal(systemCalls.length, 1)
assert.ok(cloudDriver.prefetchCalls.length >= 5)
assert.ok(updates.length > 5)
assert.equal(markers[0].phase, 'start')
assert.ok(markers.some(item => item.phase === 'result' && item.status === 'waiting_background'))
assert.equal(markers.at(-1).phase, 'complete')
assert.equal(markers.at(-1).passed, true)

let retryRunner
let triggerBackground = false
retryRunner = createTtsAcceptanceRunner({
  apiClient: client,
  cloudDriver: createCloudDriver(),
  systemDriver,
  delay: async () => {},
  backgroundTimeoutMs: 10,
  emit(payload) {
    if (
      triggerBackground &&
      payload.phase === 'result' &&
      payload.status === 'waiting_background'
    ) {
      queueMicrotask(() => retryRunner.onBackground())
    }
  }
})
const warningReport = await retryRunner.run()
assert.equal(warningReport.steps.find(step => step.id === 'background_stop').status, 'warning')
assert.equal(warningReport.passed, false)
triggerBackground = true
const retriedReport = await retryRunner.retryBackground()
assert.equal(retriedReport.steps.find(step => step.id === 'background_stop').status, 'passed')
assert.equal(retriedReport.metrics.background.backgroundObserved, true)
assert.equal(retriedReport.passed, true)

let restoredRunner
restoredRunner = createTtsAcceptanceRunner({
  apiClient: client,
  cloudDriver: createCloudDriver(),
  systemDriver,
  delay: async () => {},
  backgroundTimeoutMs: 10,
  emit(payload) {
    if (payload.phase === 'result' && payload.status === 'waiting_background') {
      queueMicrotask(() => restoredRunner.onBackground())
    }
  }
})
assert.equal(restoredRunner.restoreReport(warningReport), true)
const restoredReport = await restoredRunner.retryBackground()
assert.equal(restoredReport.passed, true)

const summary = summarizeTtsAcceptance({
  steps: [
    { status: 'passed' },
    { status: 'warning' },
    { status: 'failed' }
  ],
  requiresManualPlayback: false
})
assert.deepEqual(summary, {
  passed: 1,
  failed: 1,
  warnings: 1,
  total: 3,
  complete: false
})

const missingVoiceRunner = createTtsAcceptanceRunner({
  apiClient: {
    ...client,
    listTtsVoices: async () => ({ voices: voices.slice(0, 4) })
  },
  cloudDriver: createCloudDriver(),
  systemDriver,
  delay: async () => {},
  emit() {}
})
const missingVoiceReport = await missingVoiceRunner.run()
assert.equal(missingVoiceReport.passed, false)
assert.equal(missingVoiceReport.steps.find(step => step.id === 'voices').status, 'failed')
assert.match(missingVoiceReport.failures[0].message, /缺少已配置逻辑音色/)

console.log('ttsAcceptance tests passed')
