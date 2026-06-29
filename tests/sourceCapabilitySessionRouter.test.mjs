import assert from 'node:assert/strict'

const store = {}
globalThis.uni = {
  getStorageSync(key) {
    return store[key]
  },
  setStorageSync(key, value) {
    store[key] = value
  },
  removeStorageSync(key) {
    delete store[key]
  }
}

const {
  buildSourceCapability,
  sourceCapabilitySummary
} = await import('../common/sourceCapability.js')
const {
  clearSourceSession,
  getSourceSession,
  saveManualSourceSession,
  sourceSessionStatus
} = await import('../common/sourceSession.js')
const {
  buildCandidateLanes,
  executeSourceStep
} = await import('../common/sourceRouter.js')

const plainSource = {
  id: 'plain',
  name: 'Plain Source',
  enabled: true,
  baseUrl: 'https://plain.example.com',
  raw: {
    searchUrl: '/search?q={{key}}',
    exploreUrl: 'Rank::/rank',
    ruleSearch: { bookList: '$.items[*]', name: '$.name', bookUrl: '$.url' },
    ruleExplore: { bookList: '$.items[*]', name: '$.name', bookUrl: '$.url' },
    ruleBookInfo: { name: '$.name' },
    ruleToc: { chapterList: '$.chapters[*]', chapterName: '$.title', chapterUrl: '$.url' },
    ruleContent: { content: '$.content' }
  }
}

const plainCapability = buildSourceCapability(plainSource)
assert.equal(plainCapability.supportsSearch, true)
assert.equal(plainCapability.supportsExplore, true)
assert.equal(plainCapability.supportsDetail, true)
assert.equal(plainCapability.supportsToc, true)
assert.equal(plainCapability.supportsContent, true)
assert.equal(plainCapability.requiresCookie, false)
assert.equal(plainCapability.requiresWebView, false)
assert.equal(plainCapability.jsMode, 'none')
assert.equal(plainCapability.riskLevel, 'trusted-http')
assert.deepEqual(buildCandidateLanes('explore', plainCapability, null), ['http'])
assert.match(sourceCapabilitySummary(plainCapability), /HTTP/)

const complexSource = {
  id: 'complex',
  name: 'Complex Source',
  enabled: true,
  raw: {
    searchUrl: '/search?q={{key}}',
    exploreUrl: 'Home::webView://dynamic',
    loginUrl: 'https://complex.example.com/login',
    header: '{"Cookie":"sid=manual"}',
    ruleSearch: '<js>result.trim()</js>',
    ruleExplore: { bookList: '$.items[*]', name: '$.name', bookUrl: '$.url' }
  }
}

const complexCapability = buildSourceCapability(complexSource)
assert.equal(complexCapability.requiresCookie, true)
assert.equal(complexCapability.requiresLogin, true)
assert.equal(complexCapability.requiresWebView, true)
assert.equal(complexCapability.requiresRenderedHtml, true)
assert.equal(complexCapability.jsMode, 'browser-only')
assert.equal(complexCapability.riskLevel, 'session-required')
assert.ok(complexCapability.notes.some(note => /session/i.test(note)))
assert.deepEqual(buildCandidateLanes('explore', complexCapability, null), ['webview-session-assist', 'webview-rendered-dom'])

const saved = saveManualSourceSession('complex', {
  origin: 'https://complex.example.com',
  cookie: 'sid=abc',
  userAgent: 'UA',
  referer: 'https://complex.example.com/login',
  expiresAt: Date.now() + 60000
})
assert.equal(saved.sourceId, 'complex')
assert.equal(saved.status, 'active')
assert.equal(getSourceSession('complex').cookie, 'sid=abc')
assert.equal(sourceSessionStatus(getSourceSession('complex')), 'active')
assert.deepEqual(buildCandidateLanes('search', complexCapability, saved), [
  'http-session-cookie',
  'http-rule-js',
  'webview-session-assist',
  'webview-rendered-dom'
])

const expired = saveManualSourceSession('expired', {
  cookie: 'sid=old',
  expiresAt: Date.now() - 1000
})
assert.equal(sourceSessionStatus(expired), 'expired')
assert.equal(clearSourceSession('complex'), true)
assert.equal(getSourceSession('complex'), null)

const attempts = []
const result = await executeSourceStep('search', complexSource, { keyword: 'book' }, {
  capability: complexCapability,
  session: saved,
  runLane: async lane => {
    attempts.push(lane)
    if (lane !== 'http-rule-js') throw new Error(`lane failed: ${lane}`)
    return { ok: true, lane }
  }
})
assert.equal(result.lane, 'http-rule-js')
assert.deepEqual(attempts, ['http-session-cookie', 'http-rule-js'])

await assert.rejects(
  executeSourceStep('content', complexSource, {}, {
    capability: complexCapability,
    runLane: async lane => {
      throw new Error(`failed ${lane}`)
    }
  }),
  /all lanes failed/
)

console.log('sourceCapabilitySessionRouter tests passed')
