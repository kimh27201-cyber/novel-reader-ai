import assert from 'node:assert/strict'

const store = {}
globalThis.uni = {
  getStorageSync(key) {
    return store[key]
  },
  setStorageSync(key, value) {
    store[key] = value
  }
}

const {
  appThemes,
  getAppThemeId,
  getAppThemeStyle,
  saveAppTheme
} = await import('../common/appTheme.js')

assert.equal(getAppThemeId(), 'xuanye')
assert.equal(appThemes.length, 5)
assert.ok(appThemes.some(theme => theme.id === 'xuanye' && theme.name === '玄夜'))
assert.ok(appThemes.every(theme => theme.vars['--app-bg'] && theme.vars['--app-panel'] && theme.vars['--app-text']))
assert.ok(appThemes.every(theme => theme.vars['--app-stage'] && theme.vars['--app-shell-border'] && theme.vars['--app-floating-shadow']))
assert.ok(appThemes.every(theme => theme.vars['--app-reader-control'] && theme.vars['--app-reader-control-text']))
assert.match(getAppThemeStyle()['--app-bg'], /#080b10|#0b0f17|radial-gradient/)
assert.equal(getAppThemeStyle()['--app-accent'], '#67fff2')
assert.equal(getAppThemeStyle()['--app-accent-2'], '#8f6dff')
assert.equal(getAppThemeStyle()['--app-accent-3'], '#d8a75f')

assert.equal(saveAppTheme('paper'), 'paper')
assert.equal(getAppThemeId(), 'paper')
assert.equal(getAppThemeStyle('paper')['--app-accent'], '#d79c5f')

assert.equal(saveAppTheme('missing'), 'xuanye')
assert.equal(getAppThemeId(), 'xuanye')

console.log('appTheme tests passed')
