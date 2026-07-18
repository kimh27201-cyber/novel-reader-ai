export const TAB_REFRESH_TTL = 30 * 1000

const tabState = Object.create(null)

function getState(key) {
  if (!tabState[key]) tabState[key] = { refreshedAt: 0, dirty: true }
  return tabState[key]
}

export function shouldRefreshTab(key, options = {}) {
  const state = getState(key)
  const now = Number(options.now) || Date.now()
  const maxAge = Number(options.maxAge) || TAB_REFRESH_TTL
  return state.dirty || !state.refreshedAt || now - state.refreshedAt >= maxAge
}

export function markTabFresh(key, now = Date.now()) {
  const state = getState(key)
  state.refreshedAt = Number(now) || Date.now()
  state.dirty = false
  return { ...state }
}

export function markTabDirty(key) {
  const state = getState(key)
  state.dirty = true
  return { ...state }
}

export function resetTabFreshness(key) {
  if (key) delete tabState[key]
  else Object.keys(tabState).forEach(item => delete tabState[item])
}
