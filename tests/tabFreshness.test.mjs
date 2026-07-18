import assert from 'node:assert/strict'
import {
  TAB_REFRESH_TTL,
  markTabDirty,
  markTabFresh,
  resetTabFreshness,
  shouldRefreshTab
} from '../common/tabFreshness.js'

const calls = []
globalThis.uni = {
  hideTabBar(options) {
    calls.push(options)
  }
}

const { ensureNativeTabBarHidden, resetNativeTabBarHidden } = await import('../common/tabShell.js')

resetTabFreshness()
assert.equal(shouldRefreshTab('bookshelf', { now: 100 }), true)
markTabFresh('bookshelf', 100)
assert.equal(shouldRefreshTab('bookshelf', { now: 100 + TAB_REFRESH_TTL - 1 }), false)
assert.equal(shouldRefreshTab('bookshelf', { now: 100 + TAB_REFRESH_TTL }), true)
markTabFresh('bookshelf', 200)
markTabDirty('bookshelf')
assert.equal(shouldRefreshTab('bookshelf', { now: 201 }), true)

resetNativeTabBarHidden()
assert.equal(ensureNativeTabBarHidden(), true)
assert.equal(ensureNativeTabBarHidden(), true)
assert.equal(calls.length, 2)

console.log('tab freshness tests passed')
