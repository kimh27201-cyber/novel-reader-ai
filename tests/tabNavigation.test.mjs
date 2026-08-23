import assert from 'node:assert/strict'
import {
  TAB_NAVIGATION_TIMEOUT_MS,
  TAB_REDUCED_SETTLE_MS,
  TAB_VISUAL_SETTLE_MS,
  getTabCommitDelay,
  stageTabSelection
} from '../common/tabNavigation.js'

assert.equal(getTabCommitDelay(false), TAB_VISUAL_SETTLE_MS)
assert.equal(getTabCommitDelay(true), TAB_REDUCED_SETTLE_MS)
assert.equal(TAB_VISUAL_SETTLE_MS, 0)
assert.equal(TAB_REDUCED_SETTLE_MS, 0)
assert.equal(TAB_NAVIGATION_TIMEOUT_MS, 220)

const firstTap = stageTabSelection(0, 3, 4)
assert.deepEqual(firstTap, {
  routeIndex: 0,
  visualIndex: 3,
  pendingTargetIndex: 3
})

const lastTapWins = stageTabSelection(firstTap.routeIndex, 1, 4)
assert.equal(lastTapWins.visualIndex, 1)
assert.equal(lastTapWins.pendingTargetIndex, 1)

const currentTab = stageTabSelection(2, 2, 4)
assert.equal(currentTab.visualIndex, 2)
assert.equal(currentTab.pendingTargetIndex, -1)

const invalidTarget = stageTabSelection(3, 8, 4)
assert.equal(invalidTarget.visualIndex, 3)
assert.equal(invalidTarget.pendingTargetIndex, -1)

console.log('tab navigation tests passed')
