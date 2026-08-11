import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const shelf = readFileSync(new URL('../pages/bookshelf/bookshelf.vue', import.meta.url), 'utf8')

assert.match(shelf, /createScrollParallaxController/)
assert.match(shelf, /class="shelf-depth"/)
assert.match(shelf, /class="shelf-depth-ambient"/)
assert.match(shelf, /class="shelf-depth-horizon"/)
assert.match(shelf, /class="shelf-depth-marker"/)
assert.match(shelf, /@scroll="handleShelfScroll"/)
assert.match(shelf, /--shelf-parallax-ambient-y/)
assert.match(shelf, /translate3d\(0, var\(--shelf-parallax-ambient-y\), 0\)/)
assert.match(shelf, /onHide\(\)[\s\S]*?resetShelfParallax\(\)/)
assert.match(shelf, /onUnload\(\)[\s\S]*?destroyShelfParallax\(\)/)
assert.match(shelf, /motionReduced: this\.motionReduced/)
assert.doesNotMatch(shelf, /background-position\s*:/)

console.log('scroll parallax UI integration tests passed')
