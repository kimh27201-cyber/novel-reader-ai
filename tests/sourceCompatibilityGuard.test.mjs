import assert from 'node:assert/strict'

const {
  analyzeSourceCompatibility,
  canUseSourceFeature
} = await import('../common/sourceCompatibilityGuard.js')

const cssSource = {
  bookSourceName: 'CSS Source',
  bookSourceUrl: 'https://css.example',
  searchUrl: '/search?q={{key}}',
  exploreUrl: '[{"title":"all","url":"/all/{{page}}"}]',
  ruleSearch: { bookList: '.book' },
  ruleExplore: { bookList: '.book' }
}

const h5Source = {
  ...cssSource,
  bookSourceName: 'H5 Unsupported Source',
  h5Unsupported: true,
  exploreUrl: '@js:java.ajax(source.bookSourceUrl)'
}

const blocked = analyzeSourceCompatibility(null)
assert.equal(blocked.level, 'blocked')
assert.equal(canUseSourceFeature(null, 'explore').allowed, false)

const css = analyzeSourceCompatibility(cssSource)
assert.equal(css.level, 'full')
assert.equal(canUseSourceFeature(cssSource, 'explore').allowed, true)

const h5 = analyzeSourceCompatibility(h5Source)
assert.equal(h5.level, 'partial')
assert.ok(h5.tags.includes('h5Unsupported'))
assert.equal(canUseSourceFeature(h5Source, 'explore').allowed, false)
assert.equal(canUseSourceFeature(h5Source, 'search').allowed, true)

console.log('sourceCompatibilityGuard tests passed')
