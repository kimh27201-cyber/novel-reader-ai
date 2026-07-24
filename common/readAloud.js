export const READ_ALOUD_RATES = Object.freeze([0.8, 1, 1.2, 1.5, 2])

const DEFAULT_RATE = 1
const DEFAULT_PITCH = 1
const DEFAULT_MAX_CHARS = 300
const CANCELLED_CODE = 'READ_ALOUD_CANCELLED'
const SYSTEM_VOICE_PROVIDER = 'system'
const PRESET_VOICE_PROVIDER = 'preset'

let nativeCallbackSequence = 0
let utteranceSequence = 0

export const SYSTEM_DEFAULT_VOICE = Object.freeze({
  id: '',
  name: '系统默认',
  lang: 'zh-CN',
  provider: SYSTEM_VOICE_PROVIDER,
  quality: null,
  latency: null,
  networkRequired: false,
  isDefault: true
})

export const READ_ALOUD_ROLE_PRESETS = Object.freeze([
  Object.freeze({
    id: 'loli',
    provider: PRESET_VOICE_PROVIDER,
    glyph: '萝',
    name: '萝莉',
    desc: '轻快甜亮',
    pitch: 1.35,
    rateScale: 1.08
  }),
  Object.freeze({
    id: 'uncle',
    provider: PRESET_VOICE_PROVIDER,
    glyph: '叔',
    name: '大叔',
    desc: '沉稳厚重',
    pitch: 0.78,
    rateScale: 0.92
  }),
  Object.freeze({
    id: 'youth',
    provider: PRESET_VOICE_PROVIDER,
    glyph: '青',
    name: '青年',
    desc: '自然清晰',
    pitch: 1,
    rateScale: 1
  }),
  Object.freeze({
    id: 'shota',
    provider: PRESET_VOICE_PROVIDER,
    glyph: '少',
    name: '正太',
    desc: '少年元气',
    pitch: 1.22,
    rateScale: 1.12
  }),
  Object.freeze({
    id: 'recital',
    provider: PRESET_VOICE_PROVIDER,
    glyph: '诵',
    name: '朗诵',
    desc: '舒缓有致',
    pitch: 0.96,
    rateScale: 0.88
  })
])

function asError(error, fallback = '听读失败') {
  if (error instanceof Error) return error
  return new Error(String(error || fallback))
}

function cancellationError() {
  const error = new Error('听读已停止')
  error.code = CANCELLED_CODE
  return error
}

function isCancellation(error) {
  return !!(error && error.code === CANCELLED_CODE)
}

function normalizeMaxChars(value) {
  const number = Math.floor(Number(value))
  return Number.isFinite(number) && number > 0
    ? Math.min(number, DEFAULT_MAX_CHARS)
    : DEFAULT_MAX_CHARS
}

export function normalizeReadAloudRate(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return DEFAULT_RATE
  return READ_ALOUD_RATES.reduce((closest, candidate) => (
    Math.abs(candidate - number) < Math.abs(closest - number) ? candidate : closest
  ), DEFAULT_RATE)
}

export function normalizeReadAloudPitch(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return DEFAULT_PITCH
  return Number(Math.max(0.5, Math.min(2, number)).toFixed(2))
}

export function normalizeReadAloudSpeechRate(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return DEFAULT_RATE
  return Number(Math.max(0.5, Math.min(2, number)).toFixed(2))
}

export function resolveReadAloudVoiceProfile(provider, voiceId) {
  const normalizedProvider = provider === PRESET_VOICE_PROVIDER
    ? PRESET_VOICE_PROVIDER
    : SYSTEM_VOICE_PROVIDER
  const normalizedId = String(voiceId || '').trim()
  if (normalizedProvider === PRESET_VOICE_PROVIDER) {
    const preset = READ_ALOUD_ROLE_PRESETS.find(item => item.id === normalizedId)
    if (preset) {
      return {
        provider: PRESET_VOICE_PROVIDER,
        presetId: preset.id,
        name: preset.name,
        voiceId: '',
        pitch: normalizeReadAloudPitch(preset.pitch),
        rateScale: normalizeReadAloudSpeechRate(preset.rateScale)
      }
    }
  }
  return {
    provider: SYSTEM_VOICE_PROVIDER,
    presetId: '',
    name: '',
    voiceId: normalizedProvider === SYSTEM_VOICE_PROVIDER ? normalizedId : '',
    pitch: DEFAULT_PITCH,
    rateScale: DEFAULT_RATE
  }
}

function isChineseVoiceLanguage(value) {
  const lang = String(value || '').trim().toLowerCase()
  return lang === 'zh' || lang.startsWith('zh-') || lang.startsWith('cmn') || lang.startsWith('yue')
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeVoiceDescriptor(raw = {}, provider = SYSTEM_VOICE_PROVIDER) {
  const id = String(raw.id ?? raw.voiceURI ?? raw.name ?? '').trim()
  const name = String(raw.name || id || SYSTEM_DEFAULT_VOICE.name).trim()
  const lang = String(raw.lang || raw.language || 'zh-CN').replace(/_/g, '-')
  return {
    id,
    name,
    lang,
    provider: String(raw.provider || provider || SYSTEM_VOICE_PROVIDER),
    quality: nullableNumber(raw.quality),
    latency: nullableNumber(raw.latency),
    networkRequired: raw.networkRequired === null || raw.networkRequired === undefined
      ? null
      : raw.networkRequired === true,
    isDefault: raw.isDefault === true || !id
  }
}

export function normalizeReadAloudVoices(voices, options = {}) {
  const includeDefault = options.includeDefault !== false
  const allowNetwork = options.allowNetwork === true
  const provider = options.provider || SYSTEM_VOICE_PROVIDER
  const normalized = (Array.isArray(voices) ? voices : [])
    .map(item => normalizeVoiceDescriptor(item, provider))
    .filter(item => item.id && isChineseVoiceLanguage(item.lang))
    .filter(item => allowNetwork || item.networkRequired !== true)

  const seen = new Set()
  const unique = normalized.filter(item => {
    const key = `${item.provider}:${item.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  unique.sort((left, right) => {
    if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1
    return left.name.localeCompare(right.name, 'zh-CN')
  })
  return includeDefault ? [{ ...SYSTEM_DEFAULT_VOICE }, ...unique] : unique
}

function splitLongParagraph(paragraph, maxChars) {
  const chunks = []
  let rest = String(paragraph || '').trim()
  const strongBoundary = /[。！？!?；;…]/
  const softBoundary = /[，、,:：]/

  while (rest.length > maxChars) {
    const sample = rest.slice(0, maxChars)
    let cut = -1

    for (let index = sample.length - 1; index >= Math.floor(maxChars * 0.45); index -= 1) {
      if (strongBoundary.test(sample[index])) {
        cut = index + 1
        break
      }
    }
    if (cut < 0) {
      for (let index = sample.length - 1; index >= Math.floor(maxChars * 0.65); index -= 1) {
        if (softBoundary.test(sample[index]) || /\s/.test(sample[index])) {
          cut = index + 1
          break
        }
      }
    }
    if (cut <= 0) cut = maxChars

    const chunk = rest.slice(0, cut).trim()
    if (chunk) chunks.push(chunk)
    rest = rest.slice(cut).trim()
  }

  if (rest) chunks.push(rest)
  return chunks
}

/**
 * Convert rendered reader pages into TTS-safe chunks.
 *
 * paragraphIndex is local to a page so it can be compared directly with the
 * v-for index used by the reader page.
 */
export function splitReadAloudSegments(pages, options = {}) {
  const maxChars = normalizeMaxChars(options.maxChars)
  const sourcePages = Array.isArray(pages) ? pages : [pages]
  const segments = []

  sourcePages.forEach((page, pageIndex) => {
    const paragraphs = String(page || '')
      .replace(/\r\n?/g, '\n')
      .split(/\n+/)
      .map(item => item.trim())
      .filter(Boolean)

    paragraphs.forEach((paragraph, paragraphIndex) => {
      splitLongParagraph(paragraph, maxChars).forEach((text, chunkIndex) => {
        const segmentIndex = segments.length
        segments.push({
          id: `${pageIndex}:${paragraphIndex}:${chunkIndex}`,
          text,
          pageIndex,
          paragraphIndex,
          segmentIndex
        })
      })
    })
  })

  return segments
}

function unavailableDriver(message = '当前设备未安装或未启用中文语音服务') {
  return {
    kind: 'unavailable',
    available: false,
    async listVoices() {
      return []
    },
    speak() {
      return Promise.reject(new Error(message))
    },
    stop() {},
    dispose() {}
  }
}

function safeParseNativePayload(payload) {
  if (payload && typeof payload === 'object') return payload
  try {
    return JSON.parse(String(payload || '{}'))
  } catch (error) {
    return { status: 'error', message: String(payload || '原生语音回调格式错误') }
  }
}

function createBridgeDriver(bridge, hostWindow) {
  const pending = new Map()

  function settleAll(error) {
    const entries = [...pending.values()]
    pending.clear()
    entries.forEach(entry => {
      try {
        delete hostWindow[entry.callbackName]
      } catch (ignored) {}
      entry.reject(error)
    })
  }

  return {
    kind: 'novel-reader-tts',
    available: true,
    getState() {
      try {
        return safeParseNativePayload(bridge.getState())
      } catch (error) {
        return { status: 'error', available: false, message: asError(error).message }
      }
    },
    async listVoices() {
      if (typeof bridge.getVoices !== 'function') {
        return [{ ...SYSTEM_DEFAULT_VOICE }]
      }
      try {
        const payload = safeParseNativePayload(bridge.getVoices())
        const voices = Array.isArray(payload) ? payload : payload.voices
        return normalizeReadAloudVoices(voices, {
          provider: SYSTEM_VOICE_PROVIDER,
          allowNetwork: false
        })
      } catch (error) {
        return [{ ...SYSTEM_DEFAULT_VOICE }]
      }
    },
    speak(text, options = {}) {
      const utteranceId = String(options.utteranceId || `tts-${++utteranceSequence}`)
      const callbackName = `__novelReaderTtsCallback_${Date.now()}_${++nativeCallbackSequence}`

      return new Promise((resolve, reject) => {
        const cleanup = () => {
          pending.delete(utteranceId)
          try {
            delete hostWindow[callbackName]
          } catch (ignored) {}
        }
        hostWindow[callbackName] = payload => {
          const result = safeParseNativePayload(payload)
          if (result.utteranceId && String(result.utteranceId) !== utteranceId) return
          cleanup()
          if (result.status === 'done') {
            resolve(result)
          } else {
            reject(new Error(result.message || '系统语音合成失败'))
          }
        }
        pending.set(utteranceId, { callbackName, reject })

        try {
          const voiceId = String(options.voiceId || '').trim()
          if (typeof bridge.setVoice === 'function') {
            const selected = bridge.setVoice(voiceId)
            if (selected === false && voiceId) bridge.setVoice('')
          }
          if (typeof bridge.setPitch === 'function') {
            bridge.setPitch(normalizeReadAloudPitch(options.pitch))
          }
          const accepted = bridge.speak(
            String(text || ''),
            normalizeReadAloudSpeechRate(options.rate),
            utteranceId,
            callbackName
          )
          if (accepted === false) {
            cleanup()
            reject(new Error('系统语音服务未能开始朗读'))
          }
        } catch (error) {
          cleanup()
          reject(asError(error))
        }
      })
    },
    stop() {
      try {
        bridge.stop()
      } finally {
        settleAll(cancellationError())
      }
    },
    dispose() {
      this.stop()
    }
  }
}

function createAppPlusDriver(plusApi) {
  const android = plusApi.android
  const pending = new Map()
  let engine = null
  let disposed = false
  let initializationError = null
  let operationToken = 0
  let defaultVoice = null
  const voiceById = new Map()

  function localeTag(locale) {
    if (!locale) return ''
    try {
      if (typeof locale.toLanguageTag === 'function') return String(locale.toLanguageTag())
    } catch (error) {}
    try {
      return String(locale.toString()).replace(/_/g, '-')
    } catch (error) {
      return ''
    }
  }

  function collectVoices(tts) {
    const descriptors = []
    voiceById.clear()
    try {
      const currentVoice = tts.getVoice()
      const voices = tts.getVoices()
      if (!voices) return normalizeReadAloudVoices([], { provider: SYSTEM_VOICE_PROVIDER })
      android.importClass(voices)
      const iterator = voices.iterator()
      android.importClass(iterator)
      while (iterator.hasNext()) {
        const voice = iterator.next()
        android.importClass(voice)
        const id = String(voice.getName() || '').trim()
        if (!id) continue
        const descriptor = {
          id,
          name: id,
          lang: localeTag(voice.getLocale()),
          provider: SYSTEM_VOICE_PROVIDER,
          quality: Number(voice.getQuality()),
          latency: Number(voice.getLatency()),
          networkRequired: voice.isNetworkConnectionRequired() === true,
          isDefault: !!(currentVoice && voice.equals(currentVoice))
        }
        voiceById.set(id, voice)
        descriptors.push(descriptor)
      }
    } catch (error) {}
    return normalizeReadAloudVoices(descriptors, {
      provider: SYSTEM_VOICE_PROVIDER,
      allowNetwork: false
    })
  }

  const ready = new Promise((resolve, reject) => {
    try {
      const TextToSpeech = android.importClass('android.speech.tts.TextToSpeech')
      const Locale = android.importClass('java.util.Locale')
      const activity = android.runtimeMainActivity()
      const initListener = android.implements(
        'android.speech.tts.TextToSpeech$OnInitListener',
        {
          onInit(status) {
            if (Number(status) !== 0) {
              reject(new Error('系统语音服务初始化失败'))
              return
            }
            try {
              const languageResult = engine.setLanguage(new Locale('zh', 'CN'))
              if (Number(languageResult) < 0) {
                reject(new Error('当前设备未安装或未启用中文语音服务'))
                return
              }
              try {
                defaultVoice = engine.getVoice()
              } catch (error) {}
              // Native.js implements Java interfaces, while
              // UtteranceProgressListener is an abstract class. Use the
              // completion interface here so App-Plus can receive callbacks
              // reliably on all supported Android versions.
              const completionListener = android.implements(
                'android.speech.tts.TextToSpeech$OnUtteranceCompletedListener',
                {
                  onUtteranceCompleted(utteranceId) {
                    const entry = pending.get(String(utteranceId))
                    if (!entry) return
                    pending.delete(String(utteranceId))
                    entry.resolve({ utteranceId: String(utteranceId), status: 'done' })
                  }
                }
              )
              engine.setOnUtteranceCompletedListener(completionListener)
              resolve(engine)
            } catch (error) {
              reject(asError(error, '系统语音服务初始化失败'))
            }
          }
        }
      )
      engine = new TextToSpeech(activity, initListener)
    } catch (error) {
      reject(asError(error, '系统语音服务初始化失败'))
    }
  }).catch(error => {
    initializationError = asError(error, '系统语音服务初始化失败')
    return null
  })

  function rejectPending(error) {
    const entries = [...pending.values()]
    pending.clear()
    entries.forEach(entry => entry.reject(error))
  }

  return {
    kind: 'app-plus',
    available: true,
    async listVoices() {
      if (disposed) return []
      const tts = await ready
      if (!tts) return []
      return collectVoices(tts)
    },
    async speak(text, options = {}) {
      if (disposed) throw new Error('听读控制器已释放')
      const token = operationToken
      const tts = await ready
      if (token !== operationToken) throw cancellationError()
      if (disposed) throw new Error('听读控制器已释放')
      if (!tts) throw initializationError || new Error('系统语音服务初始化失败')
      const utteranceId = String(options.utteranceId || `tts-${++utteranceSequence}`)
      const voiceId = String(options.voiceId || '').trim()
      try {
        if (voiceId) {
          if (!voiceById.size) collectVoices(tts)
          const voice = voiceById.get(voiceId)
          if (voice && Number(tts.setVoice(voice)) < 0 && defaultVoice) tts.setVoice(defaultVoice)
          if (!voice && defaultVoice) tts.setVoice(defaultVoice)
        } else if (defaultVoice) {
          tts.setVoice(defaultVoice)
        }
      } catch (error) {
        if (defaultVoice) {
          try {
            tts.setVoice(defaultVoice)
          } catch (ignored) {}
        }
      }
      tts.setPitch(normalizeReadAloudPitch(options.pitch))
      tts.setSpeechRate(normalizeReadAloudSpeechRate(options.rate))
      return new Promise((resolve, reject) => {
        pending.set(utteranceId, { resolve, reject })
        try {
          const result = tts.speak(String(text || ''), 0, null, utteranceId)
          if (Number(result) < 0) {
            pending.delete(utteranceId)
            reject(new Error('系统语音服务未能开始朗读'))
          }
        } catch (error) {
          pending.delete(utteranceId)
          reject(asError(error))
        }
      })
    },
    stop() {
      operationToken += 1
      try {
        if (engine) engine.stop()
      } finally {
        rejectPending(cancellationError())
      }
    },
    dispose() {
      disposed = true
      this.stop()
      try {
        if (engine) engine.shutdown()
      } catch (error) {}
      engine = null
    }
  }
}

function createWebSpeechDriver(hostWindow) {
  const synthesis = hostWindow.speechSynthesis
  let active = null

  function webVoiceId(voice) {
    return String((voice && (voice.voiceURI || `${voice.name || ''}::${voice.lang || ''}`)) || '').trim()
  }

  function readWebVoices() {
    let voices = []
    try {
      voices = typeof synthesis.getVoices === 'function' ? synthesis.getVoices() : []
    } catch (error) {}
    return Array.isArray(voices) ? voices : Array.from(voices || [])
  }

  function describeWebVoices() {
    return normalizeReadAloudVoices(readWebVoices().map(voice => ({
      id: webVoiceId(voice),
      name: String(voice.name || webVoiceId(voice) || '浏览器语音'),
      lang: String(voice.lang || ''),
      provider: SYSTEM_VOICE_PROVIDER,
      quality: null,
      latency: null,
      networkRequired: null,
      isDefault: voice.default === true
    })), {
      provider: SYSTEM_VOICE_PROVIDER,
      allowNetwork: true
    })
  }

  function waitForVoices(timeoutMs) {
    if (readWebVoices().length) return Promise.resolve()
    return new Promise(resolve => {
      let finished = false
      let previousHandler = null
      let timer = null
      const finish = () => {
        if (finished) return
        finished = true
        if (timer) clearTimeout(timer)
        if (typeof synthesis.removeEventListener === 'function') {
          synthesis.removeEventListener('voiceschanged', finish)
        } else if (synthesis.onvoiceschanged === finish) {
          synthesis.onvoiceschanged = previousHandler
        }
        resolve()
      }
      if (typeof synthesis.addEventListener === 'function') {
        synthesis.addEventListener('voiceschanged', finish)
      } else {
        previousHandler = synthesis.onvoiceschanged
        synthesis.onvoiceschanged = event => {
          if (typeof previousHandler === 'function') previousHandler.call(synthesis, event)
          finish()
        }
      }
      timer = setTimeout(finish, Math.max(0, Number(timeoutMs) || 0))
    })
  }

  function cancelActive(error = cancellationError()) {
    const entry = active
    active = null
    try {
      synthesis.cancel()
    } catch (ignored) {}
    if (entry) entry.reject(error)
  }

  return {
    kind: 'web-speech',
    available: true,
    async listVoices(options = {}) {
      await waitForVoices(options.timeoutMs === undefined ? 1500 : options.timeoutMs)
      return describeWebVoices()
    },
    speak(text, options = {}) {
      cancelActive()
      return new Promise((resolve, reject) => {
        try {
          const utterance = new hostWindow.SpeechSynthesisUtterance(String(text || ''))
          utterance.lang = 'zh-CN'
          utterance.rate = normalizeReadAloudSpeechRate(options.rate)
          utterance.pitch = normalizeReadAloudPitch(options.pitch)
          const voiceId = String(options.voiceId || '').trim()
          if (voiceId) {
            const selected = readWebVoices().find(voice => webVoiceId(voice) === voiceId)
            if (selected) {
              utterance.voice = selected
              utterance.lang = String(selected.lang || 'zh-CN')
            }
          }
          utterance.onend = () => {
            if (!active || active.utterance !== utterance) return
            active = null
            resolve({ utteranceId: options.utteranceId, status: 'done' })
          }
          utterance.onerror = event => {
            if (!active || active.utterance !== utterance) return
            active = null
            reject(new Error((event && event.error) || '浏览器语音合成失败'))
          }
          active = { utterance, reject }
          synthesis.speak(utterance)
        } catch (error) {
          active = null
          reject(asError(error))
        }
      })
    },
    pause() {
      if (typeof synthesis.pause === 'function') synthesis.pause()
    },
    resume() {
      if (typeof synthesis.resume === 'function') synthesis.resume()
    },
    stop() {
      cancelActive()
    },
    cancel() {
      cancelActive()
    },
    dispose() {
      cancelActive()
    }
  }
}

/**
 * Pick the highest fidelity driver available in the current runtime.
 * Explicit env values make selection deterministic in unit tests.
 */
export function createReadAloudDriver(env = {}) {
  const hostWindow = Object.prototype.hasOwnProperty.call(env, 'window')
    ? env.window
    : (typeof window !== 'undefined' ? window : null)
  const plusApi = Object.prototype.hasOwnProperty.call(env, 'plus')
    ? env.plus
    : (typeof plus !== 'undefined' ? plus : null)
  const bridge = env.bridge || (hostWindow && hostWindow.NovelReaderTts)

  if (bridge && typeof bridge.speak === 'function' && typeof bridge.stop === 'function' && hostWindow) {
    return createBridgeDriver(bridge, hostWindow)
  }
  if (
    plusApi &&
    plusApi.android &&
    typeof plusApi.android.importClass === 'function' &&
    typeof plusApi.android.implements === 'function' &&
    typeof plusApi.android.runtimeMainActivity === 'function'
  ) {
    return createAppPlusDriver(plusApi)
  }
  if (
    hostWindow &&
    hostWindow.speechSynthesis &&
    typeof hostWindow.SpeechSynthesisUtterance === 'function'
  ) {
    return createWebSpeechDriver(hostWindow)
  }
  return unavailableDriver()
}

function cloneSegment(segment) {
  return segment ? { ...segment } : null
}

export function createReadAloudController(options = {}) {
  const driver = options.driver || createReadAloudDriver(options.env)
  const onStateChange = typeof options.onStateChange === 'function' ? options.onStateChange : () => {}
  const onSegmentChange = typeof options.onSegmentChange === 'function' ? options.onSegmentChange : () => {}
  const onChapterComplete = typeof options.onChapterComplete === 'function' ? options.onChapterComplete : null
  let segments = []
  let cursor = -1
  let sessionToken = 0
  let disposed = false
  const initialVoiceProfile = resolveReadAloudVoiceProfile(options.voiceProvider, options.voiceId)

  const state = {
    status: 'idle',
    rate: normalizeReadAloudRate(options.rate),
    voiceProvider: initialVoiceProfile.provider,
    voiceId: initialVoiceProfile.provider === PRESET_VOICE_PROVIDER
      ? initialVoiceProfile.presetId
      : initialVoiceProfile.voiceId,
    driverKind: driver.kind || 'unknown',
    segmentIndex: -1,
    segment: null,
    chapterKey: null,
    error: ''
  }

  function snapshot() {
    return { ...state, segment: cloneSegment(state.segment) }
  }

  function emitState(patch = {}) {
    Object.assign(state, patch)
    try {
      onStateChange(snapshot())
    } catch (error) {}
  }

  function showSegment(index) {
    cursor = index
    const segment = segments[index] || null
    state.segmentIndex = segment ? index : -1
    state.segment = cloneSegment(segment)
    if (segment) {
      try {
        onSegmentChange(cloneSegment(segment), index, snapshot())
      } catch (error) {}
    }
  }

  function initialIndex(startPageIndex, startParagraphIndex) {
    const pageIndex = Math.max(0, Number(startPageIndex) || 0)
    const paragraphIndex = Math.max(0, Number(startParagraphIndex) || 0)
    const index = segments.findIndex(segment => (
      segment.pageIndex > pageIndex ||
      (segment.pageIndex === pageIndex && segment.paragraphIndex >= paragraphIndex)
    ))
    return index >= 0 ? index : segments.length
  }

  async function playSession(token) {
    while (!disposed && token === sessionToken) {
      if (cursor >= segments.length) {
        if (!onChapterComplete) {
          emitState({ status: 'completed', error: '' })
          return
        }

        emitState({ status: 'loading-next', error: '' })
        let nextChapter
        try {
          nextChapter = await onChapterComplete({
            chapterKey: state.chapterKey,
            lastSegment: cloneSegment(segments[segments.length - 1]),
            rate: state.rate,
            voiceProvider: state.voiceProvider,
            voiceId: state.voiceId
          })
        } catch (error) {
          if (token !== sessionToken || disposed) return
          emitState({ status: 'error', error: asError(error, '下一章加载失败').message })
          return
        }
        if (token !== sessionToken || disposed) return
        if (!nextChapter) {
          emitState({ status: 'completed', error: '' })
          return
        }

        segments = splitReadAloudSegments(nextChapter.pages, nextChapter)
        if (!segments.length) {
          emitState({ status: 'error', error: '下一章没有可朗读正文' })
          return
        }
        state.chapterKey = nextChapter.chapterKey ?? state.chapterKey
        showSegment(initialIndex(nextChapter.startPageIndex, nextChapter.startParagraphIndex))
        emitState({ status: 'speaking', error: '' })
        continue
      }

      const segment = segments[cursor]
      if (state.segmentIndex !== cursor || !state.segment) showSegment(cursor)
      emitState({ status: 'speaking', error: '' })
      const utteranceId = `${token}:${state.chapterKey ?? 'chapter'}:${segment.id}:${++utteranceSequence}`
      const voiceProfile = resolveReadAloudVoiceProfile(state.voiceProvider, state.voiceId)
      try {
        await driver.speak(segment.text, {
          rate: normalizeReadAloudSpeechRate(state.rate * voiceProfile.rateScale),
          pitch: voiceProfile.pitch,
          voiceProvider: voiceProfile.provider,
          presetId: voiceProfile.presetId,
          voiceId: voiceProfile.voiceId,
          utteranceId
        })
      } catch (error) {
        if (token !== sessionToken || disposed || isCancellation(error)) return
        emitState({ status: 'error', error: asError(error).message })
        return
      }
      if (token !== sessionToken || disposed) return
      cursor += 1
    }
  }

  function restartCurrent() {
    const token = ++sessionToken
    try {
      driver.stop()
    } catch (error) {}
    void playSession(token)
  }

  function findAdjacentParagraph(direction) {
    if (!segments.length) return -1
    const currentIndex = Math.max(0, Math.min(cursor, segments.length - 1))
    const current = segments[currentIndex]

    if (direction >= 0) {
      const next = segments.findIndex((segment, index) => (
        index > currentIndex &&
        (segment.pageIndex !== current.pageIndex || segment.paragraphIndex !== current.paragraphIndex)
      ))
      return next >= 0 ? next : segments.length
    }

    let currentStart = currentIndex
    while (
      currentStart > 0 &&
      segments[currentStart - 1].pageIndex === current.pageIndex &&
      segments[currentStart - 1].paragraphIndex === current.paragraphIndex
    ) {
      currentStart -= 1
    }
    if (currentStart === 0) return 0

    const previous = segments[currentStart - 1]
    let previousStart = currentStart - 1
    while (
      previousStart > 0 &&
      segments[previousStart - 1].pageIndex === previous.pageIndex &&
      segments[previousStart - 1].paragraphIndex === previous.paragraphIndex
    ) {
      previousStart -= 1
    }
    return previousStart
  }

  return {
    start(input = {}) {
      if (disposed) return false
      sessionToken += 1
      try {
        driver.stop()
      } catch (error) {}
      segments = splitReadAloudSegments(input.pages, input)
      state.chapterKey = input.chapterKey ?? null
      state.error = ''

      if (!driver.available) {
        showSegment(-1)
        emitState({ status: 'error', error: '当前设备未安装或未启用中文语音服务' })
        return false
      }
      if (!segments.length) {
        showSegment(-1)
        emitState({ status: 'error', error: '当前没有可朗读正文' })
        return false
      }

      showSegment(initialIndex(input.startPageIndex, input.startParagraphIndex))
      emitState({ status: 'initializing', error: '' })
      const token = sessionToken
      void playSession(token)
      return true
    },

    pause() {
      if (disposed || !['speaking', 'initializing'].includes(state.status)) return false
      sessionToken += 1
      try {
        driver.stop()
      } catch (error) {}
      emitState({ status: 'paused', error: '' })
      return true
    },

    resume() {
      if (disposed || state.status !== 'paused' || cursor < 0 || cursor > segments.length) return false
      const token = ++sessionToken
      emitState({ status: 'speaking', error: '' })
      void playSession(token)
      return true
    },

    stop(reason = 'stopped') {
      if (disposed) return false
      sessionToken += 1
      try {
        driver.stop()
      } catch (error) {}
      showSegment(-1)
      emitState({ status: 'idle', error: '', reason })
      return true
    },

    skipParagraph(direction = 1) {
      if (disposed || !['speaking', 'initializing', 'paused'].includes(state.status)) return false
      const wasPaused = state.status === 'paused'
      const nextIndex = findAdjacentParagraph(Number(direction) < 0 ? -1 : 1)
      if (nextIndex < 0) return false
      sessionToken += 1
      try {
        driver.stop()
      } catch (error) {}
      showSegment(nextIndex)
      if (wasPaused) {
        emitState({ status: 'paused', error: '' })
      } else {
        const token = sessionToken
        emitState({ status: 'speaking', error: '' })
        void playSession(token)
      }
      return true
    },

    setRate(rate) {
      if (disposed) return state.rate
      const normalized = normalizeReadAloudRate(rate)
      const shouldRestart = ['speaking', 'initializing'].includes(state.status)
      state.rate = normalized
      if (shouldRestart) {
        restartCurrent()
      } else {
        emitState({ rate: normalized })
      }
      return normalized
    },

    setVoice(voiceId, provider = SYSTEM_VOICE_PROVIDER) {
      if (disposed) return state.voiceId
      const profile = resolveReadAloudVoiceProfile(provider, voiceId)
      const normalized = profile.provider === PRESET_VOICE_PROVIDER
        ? profile.presetId
        : profile.voiceId
      const shouldRestart = ['speaking', 'initializing'].includes(state.status)
      state.voiceProvider = profile.provider
      state.voiceId = normalized
      if (shouldRestart) {
        restartCurrent()
      } else {
        emitState({ voiceProvider: profile.provider, voiceId: normalized })
      }
      return normalized
    },

    dispose() {
      if (disposed) return
      sessionToken += 1
      disposed = true
      try {
        if (typeof driver.dispose === 'function') driver.dispose()
        else driver.stop()
      } catch (error) {}
      segments = []
      cursor = -1
      state.segment = null
      state.segmentIndex = -1
      state.status = 'disposed'
      state.error = ''
      try {
        onStateChange(snapshot())
      } catch (error) {}
    },

    getState() {
      return snapshot()
    }
  }
}
