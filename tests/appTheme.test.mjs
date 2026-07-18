import assert from 'node:assert/strict'

const store = {}
let lastTabBarStyle = null
const events = []
const documentStyles = {}
globalThis.document = {
  documentElement: {
    style: {
      setProperty(key, value) {
        documentStyles[key] = value
      }
    }
  }
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
  getAppThemeId,
  getAppThemeChrome,
  getAppThemeStyle,
  previewAppTheme,
  saveAppTheme
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

assert.equal(saveAppTheme('missing'), 'xuanye')
assert.equal(getAppThemeId(), 'xuanye')

console.log('appTheme tests passed')
