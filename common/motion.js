const MOTION_PREFERENCE_KEY = 'ui:motion-preference'

export const MOTION_PREFERENCES = ['system', 'reduced', 'full']

let navigationIntent = { kind: 'enter', direction: 'forward', at: 0 }

function safeStorage() {
  return typeof uni !== 'undefined' ? uni : null
}

function systemPrefersReducedMotion() {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  } catch (error) {
    return false
  }
}

export function getMotionPreference() {
  try {
    const saved = safeStorage() && safeStorage().getStorageSync(MOTION_PREFERENCE_KEY)
    return MOTION_PREFERENCES.includes(saved) ? saved : 'system'
  } catch (error) {
    return 'system'
  }
}

export function isMotionReduced(preference = getMotionPreference()) {
  return preference === 'reduced' || (preference === 'system' && systemPrefersReducedMotion())
}

export function applyMotionPreference(preference = getMotionPreference()) {
  const normalized = MOTION_PREFERENCES.includes(preference) ? preference : 'system'
  const reduced = isMotionReduced(normalized)
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-app-motion', reduced ? 'reduced' : 'full')
    }
  } catch (error) {}
  try {
    if (typeof uni !== 'undefined' && typeof uni.$emit === 'function') {
      uni.$emit('app:motion-changed', { preference: normalized, reduced })
    }
  } catch (error) {}
  return { preference: normalized, reduced }
}

export function saveMotionPreference(preference) {
  const normalized = MOTION_PREFERENCES.includes(preference) ? preference : 'system'
  try {
    const storage = safeStorage()
    if (storage) storage.setStorageSync(MOTION_PREFERENCE_KEY, normalized)
  } catch (error) {}
  return applyMotionPreference(normalized)
}

export function setNavigationMotion(kind = 'enter', direction = 'forward') {
  navigationIntent = {
    kind: ['enter', 'tab', 'overlay'].includes(kind) ? kind : 'enter',
    direction: direction === 'back' ? 'back' : 'forward',
    at: Date.now()
  }
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-app-motion-direction', navigationIntent.direction)
      document.documentElement.setAttribute('data-app-motion-kind', navigationIntent.kind)
    }
  } catch (error) {}
  return navigationIntent
}

export function getNavigationMotion() {
  return Date.now() - navigationIntent.at < 900
    ? navigationIntent
    : { kind: 'enter', direction: 'forward', at: 0 }
}

export function installNavigationMotion() {
  try {
    if (typeof uni === 'undefined') return false
    const wrap = (name, kind, direction) => {
      const original = uni[name]
      if (typeof original !== 'function' || original.__motionWrapped) return
      const wrapped = function (...args) {
        const current = getNavigationMotion()
        if (!(name === 'switchTab' && current.kind === 'tab')) {
          setNavigationMotion(kind, direction)
        }
        return original.apply(this, args)
      }
      wrapped.__motionWrapped = true
      uni[name] = wrapped
    }
    wrap('navigateTo', 'enter', 'forward')
    wrap('navigateBack', 'enter', 'back')
    wrap('switchTab', 'tab', 'forward')
    return true
  } catch (error) {
    return false
  }
}
