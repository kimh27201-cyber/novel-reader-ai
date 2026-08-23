const PERFORMANCE_PROFILES = Object.freeze({
  full: Object.freeze({
    tier: 'full',
    label: '完整',
    staggerLimit: 20,
    features: Object.freeze({ parallax: true, layoutFlip: true, breathe: true, stagger: true })
  }),
  balanced: Object.freeze({
    tier: 'balanced',
    label: '均衡',
    staggerLimit: 12,
    features: Object.freeze({ parallax: false, layoutFlip: true, breathe: false, stagger: true })
  }),
  lite: Object.freeze({
    tier: 'lite',
    label: '轻量',
    staggerLimit: 0,
    features: Object.freeze({ parallax: false, layoutFlip: false, breathe: false, stagger: false })
  })
})

let currentProfile = null
const PERFORMANCE_MODE_KEY = 'performance:mode:v1'
const PERFORMANCE_MODES = ['auto', 'lite', 'full']

export function getPerformanceMode() {
  try {
    const value = typeof uni !== 'undefined' && uni.getStorageSync ? uni.getStorageSync(PERFORMANCE_MODE_KEY) : ''
    return PERFORMANCE_MODES.includes(value) ? value : 'auto'
  } catch (error) {
    return 'auto'
  }
}

export function savePerformanceMode(mode) {
  const value = PERFORMANCE_MODES.includes(mode) ? mode : 'auto'
  try {
    if (typeof uni !== 'undefined' && uni.setStorageSync) uni.setStorageSync(PERFORMANCE_MODE_KEY, value)
  } catch (error) {}
  return value
}

function finitePositive(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

function normalizeMemoryGb(value) {
  const memory = finitePositive(value)
  if (!memory) return 0
  return memory > 32 ? Math.round(memory / 1024 * 10) / 10 : memory
}

function firstDefined(...values) {
  return values.find(value => value !== undefined && value !== null)
}

function resolveSystemInfo(options = {}) {
  if (options.systemInfo) return options.systemInfo
  try {
    return typeof uni !== 'undefined' && typeof uni.getSystemInfoSync === 'function'
      ? uni.getSystemInfoSync() || {}
      : {}
  } catch (error) {
    return {}
  }
}

export function detectPerformanceCapabilities(options = {}) {
  const navigatorRef = options.navigatorRef || (typeof navigator !== 'undefined' ? navigator : null)
  const systemInfo = resolveSystemInfo(options)
  const hardwareConcurrency = finitePositive(
    firstDefined(options.hardwareConcurrency, navigatorRef && navigatorRef.hardwareConcurrency)
  )
  const deviceMemory = normalizeMemoryGb(
    firstDefined(options.deviceMemory, navigatorRef && navigatorRef.deviceMemory, systemInfo.deviceMemory, systemInfo.memorySize)
  )
  const benchmarkLevel = finitePositive(
    firstDefined(options.benchmarkLevel, systemInfo.benchmarkLevel, systemInfo.deviceBenchmarkLevel)
  )
  const platform = String(options.platform || systemInfo.platform || systemInfo.osName || '').toLowerCase()
  const userAgent = String(options.userAgent || (navigatorRef && navigatorRef.userAgent) || '').toLowerCase()
  return {
    hardwareConcurrency,
    deviceMemory,
    benchmarkLevel,
    isAndroid: platform.includes('android') || userAgent.includes('android')
  }
}

function profileResult(tier, capabilities, reasons) {
  const profile = PERFORMANCE_PROFILES[tier] || PERFORMANCE_PROFILES.full
  return {
    ...profile,
    features: { ...profile.features },
    capabilities,
    reasons
  }
}

export function getPerformanceProfile(options = {}) {
  const capabilities = detectPerformanceCapabilities(options)
  const mode = options.mode || getPerformanceMode()
  if (mode === 'lite' || mode === 'full') return profileResult(mode, capabilities, [`user-${mode}`])
  const reasons = []
  if (options.motionReduced) reasons.push('motion-reduced')
  if (capabilities.benchmarkLevel && capabilities.benchmarkLevel <= 15) reasons.push('low-benchmark')
  if (capabilities.hardwareConcurrency && capabilities.hardwareConcurrency <= 2) reasons.push('low-core-count')
  if (capabilities.deviceMemory && capabilities.deviceMemory <= 2) reasons.push('low-memory')
  if (reasons.length) return profileResult('lite', capabilities, reasons)

  if (capabilities.benchmarkLevel && capabilities.benchmarkLevel <= 25) reasons.push('balanced-benchmark')
  if (capabilities.hardwareConcurrency && capabilities.hardwareConcurrency <= 4) reasons.push('balanced-core-count')
  if (capabilities.deviceMemory && capabilities.deviceMemory <= 4) reasons.push('balanced-memory')
  if (capabilities.isAndroid) reasons.push('android-smooth-default')
  if (reasons.includes('android-smooth-default')) return profileResult('lite', capabilities, reasons)
  return reasons.length
    ? profileResult('balanced', capabilities, reasons)
    : profileResult('full', capabilities, ['capability-ready'])
}

export function applyPerformanceProfile(options = {}) {
  currentProfile = getPerformanceProfile(options)
  const root = options.rootElement || (typeof document !== 'undefined' ? document.documentElement : null)
  try {
    if (root) {
      root.setAttribute('data-app-performance', currentProfile.tier)
      root.style.setProperty('--app-performance-stagger-limit', String(currentProfile.staggerLimit))
    }
  } catch (error) {}
  try {
    if (typeof uni !== 'undefined' && typeof uni.$emit === 'function') {
      uni.$emit('app:performance-changed', currentProfile)
    }
  } catch (error) {}
  return currentProfile
}

export function refreshPerformanceProfile(options = {}) {
  return applyPerformanceProfile(options)
}

export function getCurrentPerformanceProfile() {
  if (!currentProfile) currentProfile = getPerformanceProfile()
  return currentProfile
}

export const PERFORMANCE_TIERS = Object.freeze(Object.keys(PERFORMANCE_PROFILES))
export const PERFORMANCE_MODE_OPTIONS = Object.freeze([...PERFORMANCE_MODES])
