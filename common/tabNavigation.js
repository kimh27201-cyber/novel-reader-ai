export const TAB_VISUAL_SETTLE_MS = 0
export const TAB_REDUCED_SETTLE_MS = 0
export const TAB_NAVIGATION_TIMEOUT_MS = 220

export const TAB_PAGE_PATHS = [
  'pages/bookshelf/bookshelf',
  'pages/library/library',
  'pages/search/search',
  'pages/profile/profile'
]

const tabNavigationListeners = new Set()
let tabNavigationState = {
  routeIndex: 0,
  visualIndex: 0,
  pendingTargetIndex: -1
}

function cloneTabNavigationState() {
  return { ...tabNavigationState }
}

export function getTabNavigationState() {
  return cloneTabNavigationState()
}

export function publishTabNavigationState(nextState = {}) {
  tabNavigationState = {
    routeIndex: Number.isInteger(nextState.routeIndex) ? nextState.routeIndex : tabNavigationState.routeIndex,
    visualIndex: Number.isInteger(nextState.visualIndex) ? nextState.visualIndex : tabNavigationState.visualIndex,
    pendingTargetIndex: Number.isInteger(nextState.pendingTargetIndex)
      ? nextState.pendingTargetIndex
      : tabNavigationState.pendingTargetIndex
  }
  const snapshot = cloneTabNavigationState()
  tabNavigationListeners.forEach(listener => listener(snapshot))
  return snapshot
}

export function subscribeTabNavigationState(listener) {
  if (typeof listener !== 'function') return () => {}
  tabNavigationListeners.add(listener)
  listener(cloneTabNavigationState())
  return () => tabNavigationListeners.delete(listener)
}

export function markTabRouteShown(pagePath) {
  const routeIndex = TAB_PAGE_PATHS.indexOf(String(pagePath || '').replace(/^\//, ''))
  if (routeIndex < 0) return cloneTabNavigationState()
  return publishTabNavigationState({
    routeIndex,
    visualIndex: routeIndex,
    pendingTargetIndex: -1
  })
}

export function resetTabNavigationState(routeIndex = 0) {
  return publishTabNavigationState({
    routeIndex,
    visualIndex: routeIndex,
    pendingTargetIndex: -1
  })
}

export function getTabCommitDelay(reduced = false) {
  return reduced ? TAB_REDUCED_SETTLE_MS : TAB_VISUAL_SETTLE_MS
}

export function stageTabSelection(routeIndex, targetIndex, tabCount) {
  const safeRouteIndex = Number.isInteger(routeIndex) && routeIndex >= 0 && routeIndex < tabCount
    ? routeIndex
    : 0
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= tabCount) {
    return {
      routeIndex: safeRouteIndex,
      visualIndex: safeRouteIndex,
      pendingTargetIndex: -1
    }
  }
  return {
    routeIndex: safeRouteIndex,
    visualIndex: targetIndex,
    pendingTargetIndex: targetIndex === safeRouteIndex ? -1 : targetIndex
  }
}
