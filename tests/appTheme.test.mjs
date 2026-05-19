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

assert.equal(getAppThemeId(), 'qinglan')
assert.equal(appThemes.length, 4)
assert.ok(appThemes.every(theme => theme.vars['--app-bg'] && theme.vars['--app-panel'] && theme.vars['--app-text']))
assert.ok(appThemes.every(theme => theme.vars['--app-stage'] && theme.vars['--app-shell-border'] && theme.vars['--app-floating-shadow']))
assert.ok(appThemes.every(theme => theme.vars['--app-reader-control'] && theme.vars['--app-reader-control-text']))

assert.equal(saveAppTheme('paper'), 'paper')
assert.equal(getAppThemeId(), 'paper')
assert.equal(getAppThemeStyle('paper')['--app-accent'], '#d79c5f')

assert.equal(saveAppTheme('missing'), 'qinglan')
assert.equal(getAppThemeId(), 'qinglan')

console.log('appTheme tests passed')
