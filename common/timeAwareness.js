const TIME_AWARENESS_KEY = 'ui:time-awareness'

const TIME_BOUNDARIES = Object.freeze([5, 9, 17, 20])

const TIME_EXPERIENCES = Object.freeze({
  morning: Object.freeze({
    id: 'morning',
    label: '清晨',
    startHour: 5,
    endHour: 9,
    ambient: 'radial-gradient(circle at 14% -8%, rgba(126, 205, 255, 0.24), transparent 38%), linear-gradient(180deg, rgba(207, 235, 255, 0.06), transparent 34%)',
    ambientOpacity: 0.72,
    breatheOffsetMs: -400,
    motionScale: 0.92
  }),
  day: Object.freeze({
    id: 'day',
    label: '白天',
    startHour: 9,
    endHour: 17,
    ambient: 'linear-gradient(180deg, transparent, transparent)',
    ambientOpacity: 0,
    breatheOffsetMs: 0,
    motionScale: 1
  }),
  evening: Object.freeze({
    id: 'evening',
    label: '傍晚',
    startHour: 17,
    endHour: 20,
    ambient: 'radial-gradient(circle at 86% 4%, rgba(255, 159, 104, 0.24), transparent 36%), linear-gradient(180deg, rgba(255, 201, 142, 0.06), transparent 42%)',
    ambientOpacity: 0.76,
    breatheOffsetMs: 400,
    motionScale: 1.08
  }),
  night: Object.freeze({
    id: 'night',
    label: '深夜',
    startHour: 20,
    endHour: 5,
    ambient: 'radial-gradient(circle at 50% -10%, rgba(216, 167, 95, 0.14), transparent 36%), linear-gradient(180deg, rgba(3, 6, 12, 0.16), rgba(48, 31, 22, 0.08))',
    ambientOpacity: 0.82,
    breatheOffsetMs: 1200,
    motionScale: 1.2
  })
})

let installed = false
let refreshTimer = null
let visibilityDocument = null
let visibilityHandler = null
let runtimeOptions = null
let currentState = null

function normalizeDate(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date()
    date.setHours(Math.max(0, Math.min(23, Math.floor(value))), 0, 0, 0)
    return date
  }
  const date = value ? new Date(value) : new Date()
  return Number.isFinite(date.getTime()) ? date : new Date()
}

function resolveUniApi(uniApi) {
  if (uniApi) return uniApi
  return typeof uni !== 'undefined' ? uni : null
}

function resolveDocument(documentRef) {
  if (documentRef) return documentRef
  return typeof document !== 'undefined' ? document : null
}

export function getTimeSlot(value = new Date()) {
  const hour = normalizeDate(value).getHours()
  if (hour >= 5 && hour < 9) return 'morning'
  if (hour >= 9 && hour < 17) return 'day'
  if (hour >= 17 && hour < 20) return 'evening'
  return 'night'
}

export function getTimeExperience(value = new Date()) {
  return TIME_EXPERIENCES[getTimeSlot(value)]
}

export function getTimeAwarenessEnabled(uniApi) {
  try {
    const storage = resolveUniApi(uniApi)
    if (!storage || typeof storage.getStorageSync !== 'function') return true
    const saved = storage.getStorageSync(TIME_AWARENESS_KEY)
    return saved !== false && saved !== 'off'
  } catch (error) {
    return true
  }
}

export function millisecondsUntilNextTimeSlot(value = new Date()) {
  const now = normalizeDate(value)
  const next = new Date(now.getTime())
  next.setMinutes(0, 0, 0)
  const hour = now.getHours()
  const nextHour = TIME_BOUNDARIES.find(boundary => boundary > hour)
  if (nextHour == null) {
    next.setDate(next.getDate() + 1)
    next.setHours(TIME_BOUNDARIES[0], 0, 0, 0)
  } else {
    next.setHours(nextHour, 0, 0, 0)
  }
  return Math.max(1000, next.getTime() - now.getTime())
}

export function applyTimeAwareness(options = {}) {
  const now = normalizeDate(typeof options.now === 'function' ? options.now() : options.now)
  const uniApi = resolveUniApi(options.uniApi)
  const enabled = options.enabled == null ? getTimeAwarenessEnabled(uniApi) : options.enabled !== false
  const experience = enabled ? getTimeExperience(now) : TIME_EXPERIENCES.day
  const documentRef = resolveDocument(options.documentRef)
  const root = documentRef && documentRef.documentElement

  if (root) {
    root.setAttribute('data-time-awareness', enabled ? 'on' : 'off')
    root.setAttribute('data-time-slot', experience.id)
    root.style.setProperty('--app-time-ambient', experience.ambient)
    root.style.setProperty('--app-time-ambient-opacity', String(experience.ambientOpacity))
    root.style.setProperty('--app-time-breathe-offset', `${experience.breatheOffsetMs}ms`)
    root.style.setProperty('--app-time-motion-scale', String(experience.motionScale))
  }

  currentState = {
    enabled,
    slot: experience.id,
    label: experience.label,
    appliedAt: now.getTime(),
    experience
  }

  try {
    if (uniApi && typeof uniApi.$emit === 'function') uniApi.$emit('app:time-changed', currentState)
  } catch (error) {}

  return currentState
}

export function getCurrentTimeAwareness() {
  return currentState || applyTimeAwareness()
}

function clearScheduledRefresh() {
  if (refreshTimer == null || !runtimeOptions) return
  const clearTimer = runtimeOptions.clearTimer || clearTimeout
  clearTimer(refreshTimer)
  refreshTimer = null
}

function scheduleNextRefresh() {
  if (!installed || !runtimeOptions) return
  clearScheduledRefresh()
  const now = normalizeDate(typeof runtimeOptions.now === 'function' ? runtimeOptions.now() : runtimeOptions.now)
  const setTimer = runtimeOptions.setTimer || setTimeout
  refreshTimer = setTimer(() => {
    refreshTimer = null
    refreshTimeAwareness()
    scheduleNextRefresh()
  }, millisecondsUntilNextTimeSlot(now) + 250)
  if (refreshTimer && typeof refreshTimer.unref === 'function') refreshTimer.unref()
}

export function refreshTimeAwareness(options = {}) {
  const merged = { ...(runtimeOptions || {}), ...options }
  return applyTimeAwareness(merged)
}

export function installTimeAwareness(options = {}) {
  if (installed) return refreshTimeAwareness(options)
  installed = true
  runtimeOptions = { ...options }
  const state = applyTimeAwareness(runtimeOptions)
  visibilityDocument = resolveDocument(runtimeOptions.documentRef)
  if (visibilityDocument && typeof visibilityDocument.addEventListener === 'function') {
    visibilityHandler = () => {
      if (visibilityDocument.visibilityState === 'visible') {
        refreshTimeAwareness()
        scheduleNextRefresh()
      }
    }
    visibilityDocument.addEventListener('visibilitychange', visibilityHandler)
  }
  scheduleNextRefresh()
  return state
}

export function uninstallTimeAwareness() {
  clearScheduledRefresh()
  if (visibilityDocument && visibilityHandler && typeof visibilityDocument.removeEventListener === 'function') {
    visibilityDocument.removeEventListener('visibilitychange', visibilityHandler)
  }
  installed = false
  visibilityDocument = null
  visibilityHandler = null
  runtimeOptions = null
  return true
}

export function saveTimeAwarenessEnabled(enabled, options = {}) {
  const normalized = enabled !== false
  const uniApi = resolveUniApi(options.uniApi)
  try {
    if (uniApi && typeof uniApi.setStorageSync === 'function') uniApi.setStorageSync(TIME_AWARENESS_KEY, normalized)
  } catch (error) {}
  const state = refreshTimeAwareness({ ...options, uniApi, enabled: normalized })
  if (installed) scheduleNextRefresh()
  return state
}

export const TIME_AWARENESS_STORAGE_KEY = TIME_AWARENESS_KEY
export const TIME_SLOT_IDS = Object.freeze(Object.keys(TIME_EXPERIENCES))
