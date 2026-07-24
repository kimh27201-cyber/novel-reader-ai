import assert from 'node:assert/strict'

const {
  READ_ALOUD_RATES,
  createReadAloudController,
  createReadAloudDriver,
  normalizeReadAloudRate,
  normalizeReadAloudVoices,
  splitReadAloudSegments
} = await import('../common/readAloud.js')

const flush = () => new Promise(resolve => setImmediate(resolve))

assert.deepEqual(READ_ALOUD_RATES, [0.8, 1, 1.2, 1.5, 2])
assert.equal(normalizeReadAloudRate(-5), 0.8)
assert.equal(normalizeReadAloudRate(8), 2)
assert.equal(normalizeReadAloudRate('bad'), 1)
assert.deepEqual(splitReadAloudSegments([]), [])
assert.deepEqual(splitReadAloudSegments([' \n ']), [])

const mapped = splitReadAloudSegments([
  '第一页第一段。\n第一页第二段。',
  '第二页第一段。'
])
assert.deepEqual(
  mapped.map(item => [item.pageIndex, item.paragraphIndex, item.segmentIndex]),
  [[0, 0, 0], [0, 1, 1], [1, 0, 2]]
)

const sentenceChunks = splitReadAloudSegments([`${'甲'.repeat(180)}。${'乙'.repeat(180)}！${'丙'.repeat(180)}`])
assert.ok(sentenceChunks.length >= 2)
assert.ok(sentenceChunks.every(item => item.text.length <= 300))
assert.ok(sentenceChunks[0].text.endsWith('。'))
assert.ok(sentenceChunks.every(item => item.pageIndex === 0 && item.paragraphIndex === 0))

const hardChunks = splitReadAloudSegments(['字'.repeat(901)])
assert.equal(hardChunks.length, 4)
assert.ok(hardChunks.every(item => item.text.length <= 300))

const normalizedVoices = normalizeReadAloudVoices([
  { id: 'zh-local', name: '中文本地', lang: 'zh_CN', networkRequired: false },
  { id: 'zh-local', name: '重复音色', lang: 'zh-CN', networkRequired: false },
  { id: 'zh-online', name: '中文联网', lang: 'zh-CN', networkRequired: true },
  { id: 'en-local', name: 'English', lang: 'en-US', networkRequired: false }
])
assert.deepEqual(normalizedVoices.map(item => item.id), ['', 'zh-local'])
assert.equal(normalizedVoices[0].name, '系统默认')

const bridgeWindow = {
  speechSynthesis: {},
  SpeechSynthesisUtterance: class {}
}
const bridgeCalls = []
bridgeWindow.NovelReaderTts = {
  getState() {
    return JSON.stringify({ status: 'ready', available: true })
  },
  speak(text, rate, utteranceId, callbackName) {
    bridgeCalls.push({ text, rate, utteranceId, callbackName })
    queueMicrotask(() => bridgeWindow[callbackName](JSON.stringify({ utteranceId, status: 'done' })))
    return true
  },
  stop() {
    return true
  }
}
const fakePlus = {
  android: {
    importClass() {},
    implements() {},
    runtimeMainActivity() {}
  }
}
const fakeSynthesis = { speak() {}, cancel() {} }
class FakeUtterance {}

const bridgeDriver = createReadAloudDriver({
  window: bridgeWindow,
  plus: fakePlus
})
assert.equal(bridgeDriver.kind, 'novel-reader-tts')
await bridgeDriver.speak('桥接语音', { rate: 1.2, utteranceId: 'bridge-1' })
assert.equal(bridgeCalls[0].rate, 1.2)
assert.deepEqual((await bridgeDriver.listVoices()).map(item => item.id), [''])

const selectedBridgeVoices = []
const richBridgeWindow = {}
richBridgeWindow.NovelReaderTts = {
  getState() {
    return JSON.stringify({ status: 'ready', available: true })
  },
  getVoices() {
    return JSON.stringify({
      voices: [
        { id: 'local-zh', name: '本地中文', lang: 'zh-CN', networkRequired: false },
        { id: 'online-zh', name: '联网中文', lang: 'zh-CN', networkRequired: true }
      ]
    })
  },
  setVoice(voiceId) {
    selectedBridgeVoices.push(voiceId)
    return voiceId !== 'missing'
  },
  speak(text, rate, utteranceId, callbackName) {
    queueMicrotask(() => richBridgeWindow[callbackName]({ utteranceId, status: 'done' }))
    return true
  },
  stop() {
    return true
  }
}
const richBridgeDriver = createReadAloudDriver({ window: richBridgeWindow, plus: null })
assert.deepEqual((await richBridgeDriver.listVoices()).map(item => item.id), ['', 'local-zh'])
await richBridgeDriver.speak('选择音色', { voiceId: 'local-zh', utteranceId: 'bridge-voice' })
assert.deepEqual(selectedBridgeVoices, ['local-zh'])

assert.equal(createReadAloudDriver({ window: null, plus: fakePlus }).kind, 'app-plus')
assert.equal(createReadAloudDriver({
  window: { speechSynthesis: fakeSynthesis, SpeechSynthesisUtterance: FakeUtterance },
  plus: null
}).kind, 'web-speech')
assert.equal(createReadAloudDriver({ window: null, plus: null }).kind, 'unavailable')

const webUtterances = []
const webVoices = [
  { voiceURI: 'web-zh', name: '浏览器中文', lang: 'zh-CN', default: true },
  { voiceURI: 'web-en', name: 'Browser English', lang: 'en-US', default: false }
]
const webSynthesis = {
  getVoices() {
    return webVoices
  },
  speak(utterance) {
    webUtterances.push(utterance)
    queueMicrotask(() => utterance.onend())
  },
  cancel() {}
}
const webDriver = createReadAloudDriver({
  window: { speechSynthesis: webSynthesis, SpeechSynthesisUtterance: FakeUtterance },
  plus: null
})
assert.deepEqual((await webDriver.listVoices()).map(item => item.id), ['', 'web-zh'])
await webDriver.speak('浏览器选声', { voiceId: 'web-zh', utteranceId: 'web-voice' })
assert.equal(webUtterances[0].voice, webVoices[0])

let delayedVoices = []
let voicesChanged = null
const delayedSynthesis = {
  getVoices() {
    return delayedVoices
  },
  addEventListener(name, handler) {
    if (name === 'voiceschanged') voicesChanged = handler
  },
  removeEventListener() {},
  speak() {},
  cancel() {}
}
const delayedDriver = createReadAloudDriver({
  window: { speechSynthesis: delayedSynthesis, SpeechSynthesisUtterance: FakeUtterance },
  plus: null
})
const delayedList = delayedDriver.listVoices({ timeoutMs: 50 })
delayedVoices = [{ voiceURI: 'late-zh', name: '延迟中文', lang: 'zh-CN' }]
voicesChanged()
assert.deepEqual((await delayedList).map(item => item.id), ['', 'late-zh'])

function createDeferredDriver() {
  const calls = []
  return {
    kind: 'test',
    available: true,
    stops: 0,
    disposed: false,
    calls,
    speak(text, options) {
      let resolve
      let reject
      const promise = new Promise((onResolve, onReject) => {
        resolve = onResolve
        reject = onReject
      })
      calls.push({ text, options, resolve, reject })
      return promise
    },
    stop() {
      this.stops += 1
    },
    dispose() {
      this.disposed = true
    }
  }
}

const driver = createDeferredDriver()
const states = []
const spokenSegments = []
let chapterCompleteCalls = 0
const controller = createReadAloudController({
  driver,
  rate: 1,
  onStateChange(state) {
    states.push(state)
  },
  onSegmentChange(segment) {
    spokenSegments.push(segment)
  },
  async onChapterComplete() {
    chapterCompleteCalls += 1
    if (chapterCompleteCalls === 1) {
      return { chapterKey: 'chapter-2', pages: ['下一章第一段。'] }
    }
    return null
  }
})

assert.equal(controller.start({
  chapterKey: 'chapter-1',
  pages: ['跳过的段落。\n当前页第二段。', '下一页第一段。'],
  startPageIndex: 0,
  startParagraphIndex: 1
}), true)
await flush()
assert.equal(driver.calls[0].text, '当前页第二段。')
assert.equal(controller.getState().status, 'speaking')
assert.equal(controller.getState().segment.paragraphIndex, 1)

assert.equal(controller.pause(), true)
assert.equal(controller.getState().status, 'paused')
assert.equal(controller.resume(), true)
await flush()
assert.equal(driver.calls[1].text, '当前页第二段。')

// Finishing the pre-pause request is stale and must not advance the controller.
driver.calls[0].resolve({ status: 'done' })
await flush()
assert.equal(driver.calls.length, 2)
assert.equal(controller.getState().status, 'speaking')

driver.calls[1].resolve({ status: 'done' })
await flush()
assert.equal(driver.calls[2].text, '下一页第一段。')
assert.equal(spokenSegments.at(-1).pageIndex, 1)

assert.equal(controller.setRate(1.46), 1.5)
await flush()
assert.equal(driver.calls[3].text, '下一页第一段。')
assert.equal(driver.calls[3].options.rate, 1.5)
driver.calls[2].resolve({ status: 'done' })
await flush()
assert.equal(driver.calls.length, 4)

driver.calls[3].resolve({ status: 'done' })
await flush()
assert.equal(chapterCompleteCalls, 1)
assert.equal(controller.getState().chapterKey, 'chapter-2')
assert.equal(driver.calls[4].text, '下一章第一段。')

driver.calls[4].resolve({ status: 'done' })
await flush()
assert.equal(chapterCompleteCalls, 2)
assert.equal(controller.getState().status, 'completed')

const skipDriver = createDeferredDriver()
const skipController = createReadAloudController({ driver: skipDriver })
skipController.start({ pages: [`${'甲'.repeat(350)}\n第二段\n第三段`] })
await flush()
assert.equal(skipController.skipParagraph(1), true)
await flush()
assert.equal(skipDriver.calls[1].text, '第二段')
assert.equal(skipController.skipParagraph(-1), true)
await flush()
assert.ok(skipDriver.calls[2].text.startsWith('甲'))
skipController.pause()
assert.equal(skipController.skipParagraph(1), true)
assert.equal(skipController.getState().status, 'paused')
assert.equal(skipController.getState().segment.paragraphIndex, 1)

const staleDriver = createDeferredDriver()
const staleStates = []
const staleController = createReadAloudController({
  driver: staleDriver,
  onStateChange(state) {
    staleStates.push(state.status)
  }
})
staleController.start({ pages: ['不会在停止后推进。'] })
await flush()
staleController.stop()
staleDriver.calls[0].resolve({ status: 'done' })
await flush()
assert.equal(staleController.getState().status, 'idle')
assert.equal(staleController.getState().segment, null)
assert.equal(staleStates.at(-1), 'idle')

const voiceDriver = createDeferredDriver()
const voiceController = createReadAloudController({ driver: voiceDriver })
voiceController.start({ pages: ['切换声音后重读当前段。'] })
await flush()
assert.equal(voiceDriver.calls[0].options.voiceId, '')
assert.equal(voiceController.setVoice('voice-2'), 'voice-2')
await flush()
assert.equal(voiceDriver.calls[1].options.voiceId, 'voice-2')
voiceDriver.calls[0].resolve({ status: 'done' })
await flush()
assert.equal(voiceDriver.calls.length, 2)
voiceController.pause()
voiceController.setVoice('voice-3')
assert.equal(voiceController.getState().voiceId, 'voice-3')

const unavailable = createReadAloudController({
  driver: createReadAloudDriver({ window: null, plus: null })
})
assert.equal(unavailable.start({ pages: ['正文'] }), false)
assert.equal(unavailable.getState().status, 'error')
assert.match(unavailable.getState().error, /中文语音服务/)

skipController.dispose()
assert.equal(skipController.getState().status, 'disposed')
assert.equal(skipDriver.disposed, true)
assert.equal(skipController.start({ pages: ['不可重启'] }), false)

console.log('readAloud tests passed')
