import { buildSourceCapability } from './sourceCapability.js'
import { getSourceSession, sourceSessionStatus } from './sourceSession.js'

function unique(items) {
  return items.filter((item, index) => item && items.indexOf(item) === index)
}

export function buildCandidateLanes(step, capability = {}, session = null) {
  const lanes = []
  const status = sourceSessionStatus(session)
  const hasActiveSession = status === 'active'

  if (!capability.requiresRenderedHtml && !capability.requiresCookie) {
    lanes.push('http')
  }
  if (hasActiveSession) {
    lanes.push('http-session-cookie')
  }
  if (capability.jsMode === 'builtin-only' || (capability.jsMode === 'browser-only' && hasActiveSession)) {
    lanes.push('http-rule-js')
  }
  if (capability.requiresCookie || capability.requiresLogin || capability.requiresWebView) {
    lanes.push('webview-session-assist')
  }
  if (capability.requiresRenderedHtml || capability.requiresWebView || capability.requiresJsDom) {
    lanes.push('webview-rendered-dom')
  }
  if (capability.lastSuccessfulLane) {
    lanes.unshift(capability.lastSuccessfulLane)
  }

  return unique(lanes)
}

export async function executeSourceStep(step, source, input = {}, ctx = {}) {
  const capability = ctx.capability || buildSourceCapability(source)
  const session = Object.prototype.hasOwnProperty.call(ctx, 'session')
    ? ctx.session
    : getSourceSession(source && source.id)
  const lanes = ctx.lanes || buildCandidateLanes(step, capability, session)
  const failures = []

  if (typeof ctx.runLane !== 'function') {
    throw new Error('sourceRouter requires ctx.runLane')
  }

  for (const lane of lanes) {
    try {
      const result = await ctx.runLane(lane, step, source, input, { capability, session })
      if (typeof ctx.recordLaneSuccess === 'function') {
        await ctx.recordLaneSuccess(source && source.id, step, lane, result && result.meta || {})
      }
      return result
    } catch (error) {
      const failure = {
        lane,
        message: error && error.message || String(error)
      }
      failures.push(failure)
      if (typeof ctx.recordLaneFailure === 'function') {
        await ctx.recordLaneFailure(source && source.id, step, lane, failure)
      }
    }
  }

  const error = new Error(`all lanes failed: ${step}`)
  error.failures = failures
  throw error
}
