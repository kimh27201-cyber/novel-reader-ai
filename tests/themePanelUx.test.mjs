import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const profile = readFileSync(new URL('../pages/profile/profile.vue', import.meta.url), 'utf8')
const appTheme = readFileSync(new URL('../common/appTheme.js', import.meta.url), 'utf8')
const app = readFileSync(new URL('../App.vue', import.meta.url), 'utf8')

assert.match(profile, /Keep the theme studio outside the transformed page/)
assert.match(profile, /class="theme-panel[^"]*" :class="themeClass"/)
assert.match(profile, /\.theme-panel\s*\{[\s\S]*height:\s*calc\(100vh - 210rpx[\s\S]*max-height:\s*1240rpx;/)
assert.match(profile, /\.theme-grid\s*\{[\s\S]*flex:\s*1 1 0;[\s\S]*height:\s*0;/)
assert.match(profile, /\.theme-panel-actions\s*\{[\s\S]*flex-shrink:\s*0;[\s\S]*background:\s*var\(--app-panel-strong\)/)
assert.match(profile, /requestAnimationFrame\(runPreview\)/)
assert.match(profile, /cancelAnimationFrame\(this\.themePreviewFrame\)/)
assert.match(profile, /commit: nextThemeId => this\.commitThemeState\(nextThemeId\)/)
assert.match(profile, /persist:\s*true,[\s\S]*animate:\s*false/)
assert.doesNotMatch(profile, /themePreviewTimer|\}, 32\)/)

assert.match(appTheme, /document\.startViewTransition/)
assert.match(appTheme, /activeThemeViewTransition\.skipTransition\(\)/)
assert.match(appTheme, /'view-transition'/)
assert.match(appTheme, /'fallback'/)
assert.match(appTheme, /'reduced'/)
assert.match(appTheme, /typeof options\.commit === 'function'/)
assert.match(appTheme, /if \(!animate\)/)
assert.doesNotMatch(appTheme, /offsetWidth/)
assert.doesNotMatch(appTheme, /app-theme-morph-overlay|app-theme-surface-duration/)
assert.match(app, /::view-transition-old\(root\)/)
assert.match(app, /::view-transition-new\(root\)/)
assert.match(app, /app-theme-crossfade-in/)
assert.match(app, /app-theme-fallback-in-a/)
assert.doesNotMatch(app, /body::before|opacity:\s*0\.34|scale\(1\.012\)/)

console.log('theme panel UX tests passed')
