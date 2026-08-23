import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const bookshelf = readFileSync(new URL('../pages/bookshelf/bookshelf.vue', import.meta.url), 'utf8')
const reader = readFileSync(new URL('../pages/reader/reader.vue', import.meta.url), 'utf8')
const profile = readFileSync(new URL('../pages/profile/profile.vue', import.meta.url), 'utf8')

assert.match(bookshelf, /Editorial shelf:/)
assert.match(bookshelf, /\.decoder-page \.book-row\s*\{[\s\S]*box-shadow:\s*none;/)
assert.match(bookshelf, /\.decoder-page \.book-row::before\s*\{[\s\S]*background:\s*var\(--app-accent\)/)
assert.match(bookshelf, /\.decoder-page \.shelf-swipe-row\s*\{[\s\S]*animation:\s*none;/)
assert.match(bookshelf, /\.theme-candy\.decoder-page \.book-row/)
assert.match(bookshelf, /\.theme-cyber\.decoder-page \.book-row/)
assert.match(bookshelf, /\.theme-noirGold\.decoder-page \.book-row/)

assert.match(reader, /Editorial reader chrome:/)
assert.match(reader, /\.reader-page \.quick-actions\s*\{[\s\S]*gap:\s*0;[\s\S]*overflow:\s*hidden;/)
assert.match(reader, /\.reader-page \.quick-action\s*\{[\s\S]*box-shadow:\s*none;/)
assert.match(reader, /\.reader-page \.dock-actions\s*\{[\s\S]*border-top:\s*1rpx solid var\(--app-border\)/)
assert.match(reader, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.reader-page \.top-chrome/)

assert.equal((profile.match(/class="setting-group"/g) || []).length, 2)
assert.match(profile, /Reading passport:/)
assert.match(profile, /\.profile-page \.setting-group\s*\{[\s\S]*background:\s*var\(--app-panel\);[\s\S]*box-shadow:\s*none;/)
assert.match(profile, /\.profile-page \.setting-item\s*\{[\s\S]*margin:\s*0;[\s\S]*border-bottom:\s*1rpx solid var\(--app-border\)/)
assert.match(profile, /\.profile-page \.setting-item:last-child\s*\{[\s\S]*border-bottom:\s*0;/)
assert.match(profile, /\.profile-page \.tts-acceptance-card\s*\{[\s\S]*background:\s*var\(--app-panel\)/)

console.log('P0 editorial UI tests passed')
