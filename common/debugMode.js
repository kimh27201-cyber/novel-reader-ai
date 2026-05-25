const DEBUG_MODE_KEY = 'debug-mode:enabled'
const DEBUG_TAP_KEY = 'debug-mode:tap-count'

export const DEBUG_TAP_THRESHOLD = 7

const memoryStore = {}

function readStorage(key, fallback) {
  try {
    if (typeof uni !== 'undefined' && uni.getStorageSync) {
      const value = uni.getStorageSync(key)
      return value === '' || value == null ? fallback : value
    }
  } catch (error) {
    return fallback
  }
  return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : fallback
}

function writeStorage(key, value) {
  try {
    if (typeof uni !== 'undefined' && uni.setStorageSync) {
      uni.setStorageSync(key, value)
      return
    }
  } catch (error) {
    // fall through to memory
  }
  memoryStore[key] = value
}

function removeStorage(key) {
  try {
    if (typeof uni !== 'undefined' && uni.removeStorageSync) {
      uni.removeStorageSync(key)
      return
    }
  } catch (error) {
    // fall through to memory
  }
  delete memoryStore[key]
}

export function getDebugModeState() {
  const tapCount = Number(readStorage(DEBUG_TAP_KEY, 0) || 0)
  const enabled = readStorage(DEBUG_MODE_KEY, false) === true
  return {
    enabled,
    tapCount,
    remaining: enabled ? 0 : Math.max(DEBUG_TAP_THRESHOLD - tapCount, 0)
  }
}

export function setDebugModeEnabled(enabled) {
  writeStorage(DEBUG_MODE_KEY, !!enabled)
  removeStorage(DEBUG_TAP_KEY)
  return getDebugModeState()
}

export function resetDebugModeTapState() {
  removeStorage(DEBUG_TAP_KEY)
  return getDebugModeState()
}

export function tapDebugModeVersion() {
  if (getDebugModeState().enabled) return getDebugModeState()
  const nextCount = Math.min(Number(readStorage(DEBUG_TAP_KEY, 0) || 0) + 1, DEBUG_TAP_THRESHOLD)
  writeStorage(DEBUG_TAP_KEY, nextCount)
  if (nextCount >= DEBUG_TAP_THRESHOLD) {
    return setDebugModeEnabled(true)
  }
  return getDebugModeState()
}
