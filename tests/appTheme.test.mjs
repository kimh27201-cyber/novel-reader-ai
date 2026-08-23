import assert from 'node:assert/strict'

const store = {}
let lastTabBarStyle = null
const events = []
const documentStyles = {}
const documentClasses = new Set()
const nativeThemeCalls = []
let motionMode = 'full'
let performanceTier = 'full'
globalThis.document = {
  documentElement: {
    offsetWidth: 375,
    getAttribute(name) {
      if (name === 'data-app-motion') return motionMode
      if (name === 'data-app-performance') return performanceTier
      return null
    },
    classList: {
      add(name) { documentClasses.add(name) },
      remove(name) { documentClasses.delete(name) }
    },
    style: {
      setProperty(key, value) {
        documentStyles[key] = value
      },
      removeProperty(key) {
        delete documentStyles[key]
      }
    }
  }
}
globalThis.NovelReaderLaunch = {
  saveTheme(themeId) { nativeThemeCalls.push({ method: 'saveTheme', themeId }) },
  ready(themeId) { nativeThemeCalls.push({ method: 'ready', themeId }) }
}
globalThis.uni = {
  getStorageSync(key) {
    return store[key]
  },
  setStorageSync(key, value) {
    store[key] = value
  },
  setTabBarStyle(style) {
    lastTabBarStyle = style
  },
  $emit(name, payload) {
    events.push({ name, payload })
  }
}

const {
  appThemes,
  applyAppThemeDocumentStyle,
  applyAppThemeChrome,
  cancelAppThemeMorph,
  getAppThemeId,
  getAppThemeChrome,
  getAppThemeRuntimeStyle,
  getAppThemeStyle,
  morphAppTheme,
  notifyAppFirstPaint,
  primeAppTheme,
  previewAppTheme,
  saveAppTheme,
  syncAppThemeToNative
} = await import('../common/appTheme.js')

assert.equal(getAppThemeId(), 'xuanye')
assert.equal(appThemes.length, 5)
assert.ok(appThemes.some(theme => theme.id === 'xuanye' && theme.name === '玄夜'))
assert.deepEqual(
  appThemes.map(theme => theme.id),
  ['xuanye', 'candy', 'sakura', 'cyber', 'noirGold']
)
assert.ok(!appThemes.some(theme => ['qinglan', 'paper', 'mint', 'night'].includes(theme.id)))
assert.ok(appThemes.every(theme => theme.category && theme.preview && theme.chrome))
assert.ok(appThemes.every(theme => theme.vars['--app-bg'] && theme.vars['--app-panel'] && theme.vars['--app-text']))
assert.ok(appThemes.every(theme => theme.vars['--app-stage'] && theme.vars['--app-shell-border'] && theme.vars['--app-floating-shadow']))
assert.ok(appThemes.every(theme => theme.vars['--app-reader-control'] && theme.vars['--app-reader-control-text']))
assert.ok(appThemes.every(theme => theme.vars['--app-card-radius'] && theme.vars['--app-control-radius'] && theme.vars['--app-heading-font']))
assert.ok(appThemes.every(theme => theme.vars['--app-tabbar-icon-filter'] && theme.vars['--app-tabbar-icon-opacity']))
assert.ok(appThemes.every(theme => theme.vars['--app-display-font'] && theme.vars['--app-body-font'] && theme.vars['--app-utility-font']))
assert.ok(appThemes.every(theme => theme.vars['--app-cover-radius'] && theme.vars['--app-card-border-width'] && theme.vars['--app-motion-ease']))
assert.ok(appThemes.every(theme => theme.vars['--app-reader-texture'] !== undefined && theme.vars['--app-card-outline'] !== undefined))
assert.match(getAppThemeStyle()['--app-bg'], /#080b10|#0b0f17|radial-gradient/)
assert.equal(getAppThemeStyle()['--app-accent'], '#67fff2')
assert.equal(getAppThemeStyle()['--app-accent-2'], '#8f6dff')
assert.equal(getAppThemeStyle()['--app-accent-3'], '#d8a75f')
assert.equal(getAppThemeRuntimeStyle('xuanye')['--app-card-radius'], '8px')
assert.equal(getAppThemeRuntimeStyle('cyber')['--app-control-radius'], '3px')
assert.ok(Object.values(getAppThemeRuntimeStyle('candy')).every(value => !String(value).includes('rpx')))

assert.equal(saveAppTheme('paper'), 'xuanye')
assert.equal(getAppThemeId(), 'xuanye')
assert.equal(getAppThemeStyle('paper')['--app-accent'], '#67fff2')

assert.equal(saveAppTheme('cyber'), 'cyber')
assert.equal(getAppThemeId(), 'cyber')
assert.equal(getAppThemeStyle('cyber')['--app-card-radius'], '8rpx')
assert.equal(getAppThemeStyle('candy')['--app-tabbar-icon-filter'], 'brightness(0) saturate(100%)')
assert.match(getAppThemeStyle('cyber')['--app-display-font'], /Consolas|Cascadia Mono/)
assert.match(getAppThemeStyle('sakura')['--app-display-font'], /KaiTi|STKaiti/)
assert.match(getAppThemeStyle('noirGold')['--app-display-font'], /Songti|SimSun/)
assert.equal(getAppThemeChrome('cyber').selectedColor, '#34d6ff')
assert.equal(primeAppTheme('candy'), 'candy')
assert.equal(documentStyles['--app-accent'], '#ff7a59')
assert.equal(nativeThemeCalls.at(-1).method, 'saveTheme')
assert.equal(nativeThemeCalls.at(-1).themeId, 'candy')
assert.equal(syncAppThemeToNative('missing'), true)
assert.equal(nativeThemeCalls.at(-1).themeId, 'xuanye')
assert.equal(notifyAppFirstPaint('sakura'), true)
assert.deepEqual(nativeThemeCalls.at(-1), { method: 'ready', themeId: 'sakura' })
assert.equal(applyAppThemeDocumentStyle('cyber'), true)
assert.equal(documentStyles['--app-stage'], '#030817')
assert.equal(applyAppThemeChrome('cyber'), true)
assert.equal(lastTabBarStyle.backgroundColor, '#071027')

const previewStyle = lastTabBarStyle
assert.equal(previewAppTheme('sakura'), 'sakura')
assert.equal(getAppThemeId(), 'cyber')
assert.equal(lastTabBarStyle, previewStyle)
assert.equal(events.at(-1).name, 'app:theme-preview')
assert.equal(events.at(-1).payload, 'sakura')

assert.equal(morphAppTheme('candy', { persist: false }), 'candy')
await new Promise(resolve => setTimeout(resolve, 140))
assert.equal(documentStyles['--app-accent'], '#ff7a59')
assert.equal(events.some(event => event.name === 'app:theme-morph-start' && event.payload.themeId === 'candy' && event.payload.engine === 'fallback'), true)

const nativeTransitions = []
document.startViewTransition = update => {
  const transition = {
    skipped: false,
    ready: Promise.resolve(),
    skipTransition() { this.skipped = true }
  }
  transition.finished = Promise.resolve().then(update).then(() => new Promise(resolve => setTimeout(resolve, 8)))
  nativeTransitions.push(transition)
  return transition
}

let committedTheme = ''
assert.equal(morphAppTheme('sakura', {
  persist: false,
  preview: true,
  duration: 100,
  commit: async themeId => { committedTheme = themeId }
}), 'sakura')
const nativePreviewEvent = events.findLast(event => event.name === 'app:theme-morph-start')
assert.equal(nativePreviewEvent.payload.duration, 180)
assert.equal(nativePreviewEvent.payload.preview, true)
assert.equal(nativePreviewEvent.payload.engine, 'view-transition')
await nativeTransitions.at(-1).finished
assert.equal(committedTheme, 'sakura')
assert.equal(documentStyles['--app-accent'], '#d9609a')

assert.equal(morphAppTheme('cyber', { persist: false, preview: true }), 'cyber')
const interruptedTransition = nativeTransitions.at(-1)
assert.equal(morphAppTheme('noirGold', { persist: false, preview: true }), 'noirGold')
assert.equal(interruptedTransition.skipped, true)
await nativeTransitions.at(-1).finished
assert.equal(documentStyles['--app-accent'], '#d5af62')

motionMode = 'reduced'
assert.equal(morphAppTheme('candy', { persist: false }), 'candy')
const reducedEvent = events.findLast(event => event.name === 'app:theme-morph-start')
assert.equal(reducedEvent.payload.engine, 'reduced')
assert.equal(reducedEvent.payload.duration, 80)
await new Promise(resolve => setTimeout(resolve, 100))

motionMode = 'full'
const morphStartCount = events.filter(event => event.name === 'app:theme-morph-start').length
assert.equal(morphAppTheme('noirGold', { persist: true, animate: false }), 'noirGold')
assert.equal(getAppThemeId(), 'noirGold')
assert.equal(lastTabBarStyle.selectedColor, '#d5af62')
assert.equal(events.filter(event => event.name === 'app:theme-morph-start').length, morphStartCount)

performanceTier = 'lite'
assert.equal(morphAppTheme('sakura', { persist: false }), 'sakura')
assert.equal(events.findLast(event => event.name === 'app:theme-morph-start').payload.engine, 'reduced')
performanceTier = 'full'
cancelAppThemeMorph()
assert.equal(documentClasses.has('app-theme-morphing'), false)

assert.equal(saveAppTheme('missing'), 'xuanye')
assert.equal(getAppThemeId(), 'xuanye')

console.log('appTheme tests passed')
