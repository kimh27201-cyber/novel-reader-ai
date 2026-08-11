import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const shelf = readFileSync(new URL('../pages/bookshelf/bookshelf.vue', import.meta.url), 'utf8')
const experience = readFileSync(new URL('../common/v3Experience.js', import.meta.url), 'utf8')

assert.match(shelf, /createLayoutFlipController/)
assert.match(shelf, /:data-book-id="book\.id"/)
assert.match(shelf, /getShelfFlipElements/)
assert.match(shelf, /controller\.capture/)
assert.match(shelf, /controller\.play/)
assert.match(shelf, /motionReduced: this\.motionReduced/)
assert.match(shelf, /onHide\(\)[\s\S]*?cancelShelfLayoutFlip\(\)/)
assert.match(shelf, /onUnload\(\)[\s\S]*?destroyShelfLayoutFlip\(\)/)
assert.match(experience, /layoutFlipMs/)

console.log('layout FLIP UI integration tests passed')
