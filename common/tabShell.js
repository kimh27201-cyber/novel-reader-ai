export function ensureNativeTabBarHidden() {
  try {
    if (typeof uni === 'undefined' || typeof uni.hideTabBar !== 'function') return false
    uni.hideTabBar({ animation: false })
    return true
  } catch (error) {
    return false
  }
}

export function resetNativeTabBarHidden() {
  return true
}
