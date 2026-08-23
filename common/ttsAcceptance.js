export const TTS_ACCEPTANCE_SCHEMA_VERSION = 1
export const TTS_ACCEPTANCE_REQUIRED_VOICES = ['loli', 'uncle', 'youth', 'shota', 'recital']
export const TTS_ACCEPTANCE_MARKER = 'TTS_ACCEPTANCE:'

const ROLE_SAMPLE_TEXT = {
  loli: '月光落在窗台上，像一封刚刚拆开的信。请听这段可爱而清晰的拟真声音。',
  uncle: '风穿过旧城的长街，故事从沉稳的脚步声里慢慢醒来。',
  youth: '越过山丘以后，新的旅程正等待我们，现在就一起出发。',
  shota: '清晨的第一束光照进房间，我已经准备好讲今天的故事啦。',
  recital: '夜色铺开，星河无声流转，让文字在此刻被温柔地听见。'
}

const CHAPTER_SEEDS = [
  '雨后的石板路映着灯火，远处的钟声沿河岸缓缓传来。旅人收好地图，推开那扇写满旧日划痕的木门。',
  '山风翻动书页，云影从窗前掠过。少年在陌生的名字旁画下一颗星，决定天亮以后继续寻找答案。',
  '列车驶入晨雾，城市的轮廓一点点清晰。她听见广播响起，知道漫长旅程终于来到新的章节。'
]

function nowIso(now) {
  return new Date(now()).toISOString()
}

function safeDuration(value) {
  return Math.max(0, Math.round(Number(value) || 0))
}

function normalizeError(error) {
  const statusCode = Number(error && error.statusCode) || 0
  const raw = String((error && error.message) || error || '未知错误')
  const message = raw
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/([?&](?:ticket|token|access_token)=)[^&\s]+/gi, '$1[REDACTED]')
    .slice(0, 180)
  let code = 'tts_acceptance_error'
  if (statusCode === 401 || statusCode === 403) code = 'authentication_failed'
  else if (statusCode === 402) code = 'account_payment_required'
  else if (statusCode === 429) code = 'quota_or_rate_limited'
  else if (/timeout|超时/i.test(message)) code = 'timeout'
  else if (/cancel|停止|取消/i.test(message)) code = 'cancelled'
  else if (/notallowed|gesture|手势|用户操作/i.test(message)) code = 'manual_playback_required'
  return { code, message, statusCode: statusCode || undefined }
}

function repeatToLength(seed, targetLength) {
  let text = ''
  while (text.length < targetLength) text += seed
  return text.slice(0, targetLength)
}

export function buildTtsAcceptanceChapters() {
  return CHAPTER_SEEDS.map((seed, chapterIndex) => ({
    id: `chapter-${chapterIndex + 1}`,
    title: `模拟章节 ${chapterIndex + 1}`,
    segments: [
      repeatToLength(seed, 245),
      repeatToLength(`${seed}故事仍在继续。`, 245)
    ]
  }))
}

export function summarizeTtsAcceptance(report) {
  const steps = Array.isArray(report && report.steps) ? report.steps : []
  const passed = steps.filter(step => step.status === 'passed').length
  const failed = steps.filter(step => step.status === 'failed').length
  const warnings = steps.filter(step => step.status === 'warning').length
  return {
    passed,
    failed,
    warnings,
    total: steps.length,
    complete: steps.length > 0 && failed === 0 && !report.requiresManualPlayback
  }
}

export function sanitizeTtsAcceptanceReport(report) {
  const clone = JSON.parse(JSON.stringify(report || {}))
  delete clone.audioUrl
  delete clone.text
  delete clone.token
  delete clone.ticket
  const scrub = value => {
    if (Array.isArray(value)) return value.map(scrub)
    if (!value || typeof value !== 'object') {
      return typeof value === 'string'
        ? value
          .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
          .replace(/([?&](?:ticket|token|access_token)=)[^&\s]+/gi, '$1[REDACTED]')
        : value
    }
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !/^(?:audio_url|audioUrl|text|token|ticket|speaker_id|speakerId)$/i.test(key))
      .map(([key, nested]) => [key, scrub(nested)]))
  }
  return scrub(clone)
}

export function emitTtsAcceptanceMarker(payload, logger = console.log) {
  const safePayload = sanitizeTtsAcceptanceReport(payload)
  logger(`${TTS_ACCEPTANCE_MARKER}${JSON.stringify(safePayload)}`)
  return safePayload
}

function wait(delay, milliseconds) {
  return Promise.resolve(delay(milliseconds))
}

export function createTtsAcceptanceRunner(options = {}) {
  const client = options.apiClient
  const cloudDriver = options.cloudDriver
  const systemDriver = options.systemDriver
  const now = typeof options.now === 'function' ? options.now : Date.now
  const delay = typeof options.delay === 'function'
    ? options.delay
    : milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
  const emit = typeof options.emit === 'function'
    ? options.emit
    : payload => emitTtsAcceptanceMarker(payload)
  const onUpdate = typeof options.onUpdate === 'function' ? options.onUpdate : () => {}
  const onSegment = typeof options.onSegment === 'function' ? options.onSegment : () => {}
  let running = false
  let stopped = false
  let stopReason = ''
  let backgroundResolver = null
  let backgroundObserved = false
  let lastVoices = []
  let report = null

  function publish() {
    if (report) onUpdate(sanitizeTtsAcceptanceReport(report))
  }

  function addStep(id, label) {
    const step = { id, label, status: 'running', durationMs: 0, message: '' }
    report.steps.push(step)
    report.currentStep = id
    publish()
    return step
  }

  async function runStep(id, label, operation, stepOptions = {}) {
    const step = addStep(id, label)
    const startedAt = now()
    try {
      const details = await operation(step)
      step.status = details && details.warning ? 'warning' : 'passed'
      step.message = String((details && details.message) || '通过')
      if (details && details.metrics) step.metrics = details.metrics
      if (details && details.manualRequired) {
        step.status = 'warning'
        report.requiresManualPlayback = true
      }
      return details
    } catch (error) {
      const normalized = normalizeError(error)
      step.status = stepOptions.warningOnly ? 'warning' : 'failed'
      step.message = normalized.message
      step.errorCode = normalized.code
      if (normalized.statusCode) step.statusCode = normalized.statusCode
      if (normalized.code === 'manual_playback_required') {
        report.requiresManualPlayback = true
        step.status = 'warning'
      }
      report.failures.push({ step: id, ...normalized })
      if (!stepOptions.continueOnFailure) throw error
      return null
    } finally {
      step.durationMs = safeDuration(now() - startedAt)
      emit({
        phase: 'result',
        sessionId: report.sessionId,
        step: id,
        status: step.status,
        durationMs: step.durationMs,
        errorCode: step.errorCode || ''
      })
      publish()
    }
  }

  async function speak(driver, text, speakOptions) {
    if (stopped) throw new Error(`验收已停止：${stopReason || 'manual'}`)
    const result = await driver.speak(text, speakOptions)
    return result || {}
  }

  async function runVoiceProbe(voice, index) {
    const text = ROLE_SAMPLE_TEXT[voice.id] || ROLE_SAMPLE_TEXT.recital
    const startedAt = now()
    const synthesized = await client.synthesizeTts({ text, voiceId: voice.id, rate: 1 })
    const synthDurationMs = safeDuration(now() - startedAt)
    const playbackStartedAt = now()
    const played = await speak(cloudDriver, text, {
      voiceProvider: 'volcengine',
      voiceId: voice.id,
      rate: 1,
      utteranceId: `acceptance-voice-${index + 1}`
    })
    return {
      id: voice.id,
      name: String(voice.name || voice.id),
      verified: voice.verified !== false,
      synthDurationMs,
      playbackDurationMs: safeDuration(now() - playbackStartedAt),
      initialCacheHit: synthesized && synthesized.cache_hit === true,
      playbackCacheHit: played && played.cacheHit === true
    }
  }

  async function runChapterProbe(voices) {
    const chapters = buildTtsAcceptanceChapters()
    const voiceId = (voices.find(voice => voice.id === 'recital') || voices[0]).id
    const segmentResults = []
    let previousEndedAt = 0
    let utteranceSequence = 0
    for (const [chapterIndex, chapter] of chapters.entries()) {
      for (const [segmentIndex, text] of chapter.segments.entries()) {
        if (stopped) throw new Error(`验收已停止：${stopReason || 'manual'}`)
        const nextText = chapter.segments[segmentIndex + 1] ||
          (chapters[chapterIndex + 1] && chapters[chapterIndex + 1].segments[0])
        if (nextText && typeof cloudDriver.prefetch === 'function') {
          cloudDriver.prefetch(nextText, { voiceId, rate: 1 }).catch(() => {})
        }
        const startedAt = now()
        const scheduleGapMs = previousEndedAt ? safeDuration(startedAt - previousEndedAt) : 0
        onSegment({
          chapterIndex,
          segmentIndex,
          chapterTitle: chapter.title,
          progress: utteranceSequence + 1,
          total: chapters.reduce((count, item) => count + item.segments.length, 0)
        })
        const played = await speak(cloudDriver, text, {
          voiceProvider: 'volcengine',
          voiceId,
          rate: 1,
          utteranceId: `acceptance-chapter-${++utteranceSequence}`
        })
        previousEndedAt = now()
        segmentResults.push({
          chapterIndex,
          segmentIndex,
          scheduleGapMs,
          durationMs: safeDuration(previousEndedAt - startedAt),
          cacheHit: played && played.cacheHit === true
        })
      }
    }
    const maxScheduleGapMs = Math.max(...segmentResults.map(item => item.scheduleGapMs))
    const sequenceValid = segmentResults.every((item, index) => {
      const expectedChapter = Math.floor(index / 2)
      const expectedSegment = index % 2
      return item.chapterIndex === expectedChapter && item.segmentIndex === expectedSegment
    })
    if (!sequenceValid) throw new Error('三章连续听读出现重复或跳段')
    return {
      chapters: chapters.length,
      segments: segmentResults.length,
      uniqueCharacters: chapters.reduce(
        (count, chapter) => count + chapter.segments.reduce((sum, text) => sum + text.length, 0),
        0
      ),
      maxScheduleGapMs,
      targetMet: maxScheduleGapMs <= 800,
      sequenceValid,
      highlightTransitions: segmentResults.length,
      pageTransitions: chapters.length,
      chapterTransitions: chapters.length - 1,
      progressCheckpoints: segmentResults.length,
      segmentResults
    }
  }

  async function runControlProbe(voices) {
    const first = voices[0]
    const second = voices[1] || voices[0]
    const firstPromise = speak(cloudDriver, ROLE_SAMPLE_TEXT[first.id], {
      voiceProvider: 'volcengine',
      voiceId: first.id,
      rate: 1,
      utteranceId: 'acceptance-stale-first'
    })
    await wait(delay, 220)
    const switchedPromise = speak(cloudDriver, ROLE_SAMPLE_TEXT[second.id], {
      voiceProvider: 'volcengine',
      voiceId: second.id,
      rate: 1,
      utteranceId: 'acceptance-stale-second'
    })
    const firstCancelled = await firstPromise.then(() => false, () => true)
    await switchedPromise

    const stoppedPromise = speak(cloudDriver, ROLE_SAMPLE_TEXT[first.id], {
      voiceProvider: 'volcengine',
      voiceId: first.id,
      rate: 1,
      utteranceId: 'acceptance-stop'
    })
    await wait(delay, 220)
    cloudDriver.stop()
    const stopCancelled = await stoppedPromise.then(() => false, () => true)
    if (!firstCancelled || !stopCancelled) {
      throw new Error('切换或停止后，过期播放回调仍然生效')
    }
    return { switchPassed: true, stopPassed: true, staleCallbackIgnored: true }
  }

  async function runFallbackProbe() {
    if (!systemDriver || !systemDriver.available) {
      throw new Error('当前设备系统中文语音不可用，无法验证降级')
    }
    const events = []
    const failingCloud = {
      available: true,
      async speak() {
        throw new Error('acceptance_injected_cloud_failure')
      },
      stop() {},
      dispose() {}
    }
    const { createFallbackReadAloudDriver } = await import('./readAloud.js')
    const fallback = createFallbackReadAloudDriver(failingCloud, systemDriver, {
      onFallback(event) {
        events.push(event)
      }
    })
    try {
      await fallback.speak('云端失败后，应从当前段落切换到设备系统声音。', {
        voiceProvider: 'volcengine',
        voiceId: 'recital',
        rate: 1,
        utteranceId: 'acceptance-fallback'
      })
    } finally {
      fallback.dispose()
    }
    if (events.length !== 1 || events[0].fallbackProvider !== 'system') {
      throw new Error('云端失败后未触发系统声音降级')
    }
    return { fallbackProvider: 'system', continuedFromCurrentSegment: true }
  }

  function waitForBackground(timeoutMs) {
    if (backgroundObserved) return Promise.resolve(true)
    return new Promise(resolve => {
      let timer = null
      backgroundResolver = observed => {
        if (timer) clearTimeout(timer)
        backgroundResolver = null
        resolve(observed)
      }
      timer = setTimeout(() => {
        if (backgroundResolver) backgroundResolver(false)
      }, timeoutMs)
    })
  }

  async function runBackgroundProbe(voice) {
    emit({
      phase: 'result',
      sessionId: report.sessionId,
      step: 'background_stop',
      status: 'waiting_background',
      action: 'adb_home_then_restore'
    })
    const playback = speak(cloudDriver, ROLE_SAMPLE_TEXT[voice.id], {
      voiceProvider: 'volcengine',
      voiceId: voice.id,
      rate: 1,
      utteranceId: 'acceptance-background'
    })
    await wait(delay, 250)
    const observed = await waitForBackground(Number(options.backgroundTimeoutMs) || 15000)
    if (!observed) {
      cloudDriver.stop()
      await playback.catch(() => {})
      return {
        warning: true,
        manualRequired: true,
        message: '未检测到应用进入后台，请人工按 Home 后返回并重新验收'
      }
    }
    const cancelled = await playback.then(() => false, () => true)
    if (!cancelled) throw new Error('应用进入后台后云端声音未停止')
    return { message: '进入后台后声音已停止', metrics: { backgroundObserved: true } }
  }

  async function run() {
    if (running) return report
    running = true
    stopped = false
    stopReason = ''
    backgroundObserved = false
    const startedAt = now()
    report = {
      schemaVersion: TTS_ACCEPTANCE_SCHEMA_VERSION,
      sessionId: `tts-${startedAt}`,
      startedAt: nowIso(now),
      completedAt: '',
      passed: false,
      requiresManualPlayback: false,
      currentStep: '',
      environment: {
        backendBaseUrl: client && typeof client.getBaseUrl === 'function' ? client.getBaseUrl() : '',
        authenticated: false,
        ttsEnabled: false,
        verifiedVoiceCount: 0
      },
      metrics: {
        voices: [],
        cache: {},
        controls: {},
        chapters: {},
        fallback: {},
        background: {}
      },
      steps: [],
      failures: []
    }
    emit({ phase: 'start', sessionId: report.sessionId, schemaVersion: report.schemaVersion })
    publish()

    try {
      await runStep('backend', '后端与迁移状态', async () => {
        const readiness = await client.readinessCheck()
        const migrationVersion = String(
          (readiness && (readiness.migration || readiness.migration_version || readiness.migrationVersion)) || ''
        )
        report.environment.healthStatus = String((readiness && readiness.status) || 'ok')
        report.environment.databaseStatus = String((readiness && readiness.database) || '')
        report.environment.migrationVersion = migrationVersion
        if (!migrationVersion.startsWith('0007_')) {
          throw new Error(`数据库迁移未到 0007：${migrationVersion || 'unknown'}`)
        }
        return { message: `后端就绪，迁移 ${migrationVersion}` }
      })

      await runStep('authentication', '登录状态', async () => {
        if (!client.getToken || !client.getToken()) throw new Error('请先在“我的”页面登录后端')
        const user = await client.getMe()
        report.environment.authenticated = !!user
        return { message: '登录状态有效' }
      })

      const statusResult = await runStep('service_status', '真实 TTS 服务状态', async () => {
        const status = await client.getTtsStatus()
        report.environment.ttsConfigured = !!(
          status && (status.configured === null || status.configured === undefined ? true : status.configured)
        )
        report.environment.ttsEnabled = !!(
          status &&
          (status.enabled === null || status.enabled === undefined ? status.available : status.enabled) &&
          report.environment.ttsConfigured
        )
        report.environment.verifiedVoiceCount = Number(
          status && (
            status.verified_voice_count === null || status.verified_voice_count === undefined
              ? status.verifiedVoiceCount
              : status.verified_voice_count
          )
        ) || 0
        if (!report.environment.ttsEnabled) throw new Error('后端真实 TTS 尚未启用')
        return status
      })

      let voices = []
      await runStep('voices', '五种逻辑音色配置', async () => {
        const listed = await client.listTtsVoices()
        const rawVoices = Array.isArray(listed) ? listed : ((listed && listed.voices) || [])
        voices = rawVoices
          .map(voice => ({
            id: String(voice.id || voice.voice_id || ''),
            name: String(voice.name || voice.display_name || voice.id || ''),
            verified: voice.verified !== false,
            available: voice.available !== false,
            unavailableReason: String(voice.unavailable_reason || '')
          }))
          .filter(voice => voice.id)
        lastVoices = voices
        const missing = TTS_ACCEPTANCE_REQUIRED_VOICES.filter(
          voiceId => !voices.some(voice => voice.id === voiceId)
        )
        if (missing.length) throw new Error(`缺少已配置逻辑音色：${missing.join(', ')}`)
        return { message: '五种逻辑角色均已配置，开始显式真实探测' }
      })

      await runStep('voice_playback', '五音色合成与播放', async () => {
        for (const [index, voice] of voices
          .filter(item => TTS_ACCEPTANCE_REQUIRED_VOICES.includes(item.id))
          .slice(0, TTS_ACCEPTANCE_REQUIRED_VOICES.length)
          .entries()) {
          report.metrics.voices.push(await runVoiceProbe(voice, index))
          publish()
        }
        return { message: '五种音色均完成真实合成与播放' }
      })

      await runStep('verification_refresh', '刷新真实验证状态', async () => {
        const listed = await client.listTtsVoices()
        const refreshed = (Array.isArray(listed) ? listed : ((listed && listed.voices) || []))
          .map(voice => ({
            id: String(voice.id || voice.voice_id || ''),
            name: String(voice.name || voice.display_name || voice.id || ''),
            verified: voice.verified === true,
            available: voice.available === true,
            unavailableReason: String(voice.unavailable_reason || '')
          }))
        const unavailable = TTS_ACCEPTANCE_REQUIRED_VOICES.filter(voiceId => {
          const voice = refreshed.find(item => item.id === voiceId)
          return !voice || !voice.available || !voice.verified
        })
        if (unavailable.length) {
          throw new Error(`真实探测后仍不可用：${unavailable.join(', ')}`)
        }
        voices = refreshed.filter(voice => TTS_ACCEPTANCE_REQUIRED_VOICES.includes(voice.id))
        lastVoices = voices
        report.environment.verifiedVoiceCount = voices.length
        return { message: '五种音色均已由真实成功调用验证' }
      })

      await runStep('cache_replay', '相同文本缓存复跑', async () => {
        const voice = voices[0]
        const repeated = await client.synthesizeTts({
          text: ROLE_SAMPLE_TEXT[voice.id],
          voiceId: voice.id,
          rate: 1
        })
        const cacheHit = repeated && repeated.cache_hit === true
        report.metrics.cache = { cacheHit, voiceId: voice.id }
        if (!cacheHit) throw new Error('相同验收文本复跑未命中服务端缓存')
        return { message: '复跑已命中缓存' }
      })

      await runStep('controls', '切换、停止与过期回调', async () => {
        report.metrics.controls = await runControlProbe(voices)
        return { message: '播放控制与会话隔离正常' }
      })

      await runStep('chapters', '三章连续听读', async () => {
        report.metrics.chapters = await runChapterProbe(voices)
        const chapterMetrics = report.metrics.chapters
        return {
          message: chapterMetrics.targetMet
            ? '三章顺序、预取与段落衔接正常'
            : '连续播放完成，但段间调度超过 800ms',
          warning: !chapterMetrics.targetMet
        }
      })

      await runStep('fallback', '云端失败降级', async () => {
        report.metrics.fallback = await runFallbackProbe()
        return { message: '注入失败后已从当前段切换系统声音' }
      }, { continueOnFailure: true })

      await runStep('background_stop', '后台停止', async () => {
        const details = await runBackgroundProbe(voices[0])
        report.metrics.background = details.metrics || { backgroundObserved: false }
        return details
      }, { continueOnFailure: true })

      if (statusResult && statusResult.quota) {
        report.metrics.remainingQuota = statusResult.quota
      }
    } catch (error) {
      if (!report.failures.length) report.failures.push({ step: report.currentStep, ...normalizeError(error) })
    } finally {
      report.currentStep = ''
      report.completedAt = nowIso(now)
      report.summary = summarizeTtsAcceptance(report)
      report.passed = report.summary.complete
      running = false
      emit({ phase: 'complete', sessionId: report.sessionId, passed: report.passed, report })
      publish()
    }
    return sanitizeTtsAcceptanceReport(report)
  }

  async function retryBackground() {
    if (running) return sanitizeTtsAcceptanceReport(report)
    if (!report || !report.steps || !lastVoices.length) {
      throw new Error('请先完成一次完整 TTS 验收')
    }

    const step = report.steps.find(item => item.id === 'background_stop')
    if (!step) throw new Error('未找到后台停止验收项')

    running = true
    stopped = false
    stopReason = ''
    backgroundObserved = false
    step.status = 'running'
    step.message = '等待应用进入后台'
    step.durationMs = 0
    step.errorCode = ''
    report.failures = (report.failures || []).filter(item => item.step !== 'background_stop')
    report.currentStep = 'background_stop'
    report.completedAt = ''
    publish()

    const startedAt = now()
    try {
      const details = await runBackgroundProbe(lastVoices[0])
      step.status = details && details.warning ? 'warning' : 'passed'
      step.message = String((details && details.message) || '进入后台后声音已停止')
      report.metrics.background = (details && details.metrics) || { backgroundObserved: false }
      report.requiresManualPlayback = !!(details && details.manualRequired)
    } catch (error) {
      const normalized = normalizeError(error)
      step.status = 'failed'
      step.message = normalized.message
      step.errorCode = normalized.code
      report.failures = (report.failures || []).filter(item => item.step !== 'background_stop')
      report.failures.push({ step: 'background_stop', ...normalized })
    } finally {
      step.durationMs = safeDuration(now() - startedAt)
      report.currentStep = ''
      report.completedAt = nowIso(now)
      report.summary = summarizeTtsAcceptance(report)
      report.passed = report.summary.complete
      running = false
      emit({
        phase: 'complete',
        sessionId: report.sessionId,
        passed: report.passed,
        retryStep: 'background_stop',
        report
      })
      publish()
    }
    return sanitizeTtsAcceptanceReport(report)
  }

  return {
    run,
    retryBackground,
    restoreReport(savedReport) {
      const restored = sanitizeTtsAcceptanceReport(savedReport)
      if (!restored || !Array.isArray(restored.steps)) return false
      report = restored
      lastVoices = TTS_ACCEPTANCE_REQUIRED_VOICES.map(id => ({ id }))
      running = false
      stopped = false
      stopReason = ''
      backgroundObserved = false
      publish()
      return true
    },
    stop(reason = 'manual') {
      stopped = true
      stopReason = String(reason || 'manual')
      if (cloudDriver && typeof cloudDriver.stop === 'function') cloudDriver.stop()
      if (systemDriver && typeof systemDriver.stop === 'function') systemDriver.stop()
      if (backgroundResolver) backgroundResolver(reason === 'background')
    },
    onBackground() {
      backgroundObserved = true
      if (cloudDriver && typeof cloudDriver.stop === 'function') cloudDriver.stop()
      if (systemDriver && typeof systemDriver.stop === 'function') systemDriver.stop()
      if (backgroundResolver) backgroundResolver(true)
    },
    getReport() {
      return sanitizeTtsAcceptanceReport(report)
    },
    isRunning() {
      return running
    },
    dispose() {
      stopped = true
      stopReason = 'dispose'
      if (backgroundResolver) backgroundResolver(false)
      if (cloudDriver && typeof cloudDriver.dispose === 'function') cloudDriver.dispose()
      if (systemDriver && typeof systemDriver.dispose === 'function') systemDriver.dispose()
    }
  }
}
