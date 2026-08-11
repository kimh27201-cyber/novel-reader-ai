import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const shelf = readFileSync(new URL('../pages/bookshelf/bookshelf.vue', import.meta.url), 'utf8')
const reader = readFileSync(new URL('../pages/reader/reader.vue', import.meta.url), 'utf8')
const cover = readFileSync(new URL('../components/composite/DBookCover.vue', import.meta.url), 'utf8')

assert.match(shelf, /captureSharedBookTransition/)
assert.match(shelf, /resolveBookCoverElement/)
assert.match(shelf, /event && event\.coverRect/)
assert.match(shelf, /document\.querySelectorAll\('\.d-book-cover\[data-book-id\]'\)/)
assert.match(shelf, /resolveBookCoverElement\(event, book\.id\)/)
assert.match(shelf, /sharedCover: !!sharedTransition/)
assert.match(cover, /getBoundingClientRect/)
assert.match(cover, /:data-book-id="bookId"/)
assert.match(cover, /\$emit\('tap', { nativeEvent: event, coverRect }\)/)
assert.doesNotMatch(cover, /@tap\.stop/)
assert.match(reader, /consumeSharedBookTransition/)
assert.match(reader, /class="shared-book-transition"/)
assert.match(reader, /@keyframes shared-book-flight/)
assert.match(reader, /options\.shared !== 'cover'/)
assert.match(reader, /motionReduced/)
assert.match(reader, /clearSharedBookTransitionView\(\)/)
assert.match(reader, /onHide\(\)\s*{[\s\S]*?clearReaderEntry\(\)[\s\S]*?clearSharedBookTransitionView\(\)/)
assert.match(reader, /handleMotionChange\(state\)\s*{[\s\S]*?if \(this\.motionReduced\)[\s\S]*?clearPageTurnAnimation\(\)[\s\S]*?clearReaderEntry\(\)[\s\S]*?clearSharedBookTransitionView\(\)/)

console.log('shared book transition UI integration tests passed')
