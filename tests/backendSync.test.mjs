import assert from 'node:assert/strict'
import { createBackendSync } from '../common/backendSync.js'

function createStorage() {
  const values = new Map()
  return {
    values,
    getStorageSync(key) {
      return values.get(key) ?? ''
    },
    setStorageSync(key, value) {
      values.set(key, value)
    }
  }
}

async function testQueuePersistsAndDeduplicatesMutationIds() {
  const storage = createStorage()
  const sync = createBackendSync({}, {
    ...storage,
    randomUUID: () => 'generated-mutation-id'
  })

  const first = sync.enqueueMutation({
    mutationId: 'mutation-fixed',
    entityType: 'book',
    syncId: 'book-sync-1',
    payload: { title: 'Book' }
  })
  const duplicate = sync.enqueueMutation({
    mutation_id: 'mutation-fixed',
    entity_type: 'book',
    sync_id: 'book-sync-1',
    payload: { title: 'Changed duplicate' }
  })

  assert.equal(first.mutation_id, 'mutation-fixed')
  assert.deepEqual(duplicate, first)
  assert.equal(sync.getQueue().length, 1)
  assert.equal(JSON.parse(storage.values.get('novelReaderBackendMutationQueue')).length, 1)
}

async function testPushRemovesOnlyAppliedMutations() {
  const storage = createStorage()
  let pushed
  const client = {
    async syncPush(payload) {
      pushed = payload
      return {
        cursor: 7,
        results: [
          { mutation_id: 'mutation-applied', status: 'applied' },
          { mutation_id: 'mutation-conflict', status: 'conflict' },
          { mutation_id: 'mutation-rejected', status: 'rejected' }
        ]
      }
    }
  }
  const sync = createBackendSync(client, { ...storage, randomUUID: () => 'device-1' })
  for (const mutationId of ['mutation-applied', 'mutation-conflict', 'mutation-rejected']) {
    sync.enqueueMutation({
      mutationId,
      entityType: 'book',
      syncId: `sync-${mutationId}`,
      payload: {}
    })
  }

  await sync.pushQueued()

  assert.equal(pushed.deviceId, 'device-1')
  assert.equal(pushed.mutations.length, 3)
  assert.deepEqual(sync.getQueue().map(item => item.mutation_id), [
    'mutation-conflict',
    'mutation-rejected'
  ])
  assert.equal(sync.getCursor(), 0)
}

async function testPullAppliesChangesBeforeAdvancingCursor() {
  const storage = createStorage()
  const applied = []
  const client = {
    async syncPull(payload) {
      assert.equal(payload.cursor, 0)
      assert.equal(payload.deviceId, 'device-2')
      return {
        changes: [{ cursor: 3, entity_type: 'book', sync_id: 'book-sync-1' }],
        next_cursor: 3,
        has_more: false
      }
    }
  }
  const sync = createBackendSync(client, {
    ...storage,
    randomUUID: () => 'device-2',
    async applyChanges(changes) {
      applied.push(...changes)
    }
  })

  const response = await sync.pullChanges()

  assert.equal(response.next_cursor, 3)
  assert.equal(applied.length, 1)
  assert.equal(sync.getCursor(), 3)
}

async function testFailedApplyDoesNotAdvanceCursor() {
  const storage = createStorage()
  const client = {
    async syncPull() {
      return { changes: [{ cursor: 5 }], next_cursor: 5, has_more: false }
    }
  }
  const sync = createBackendSync(client, { ...storage, randomUUID: () => 'device-3' })

  await assert.rejects(() => sync.pullChanges({
    applyChanges() {
      throw new Error('local write failed')
    }
  }), /local write failed/)

  assert.equal(sync.getCursor(), 0)
}

await testQueuePersistsAndDeduplicatesMutationIds()
await testPushRemovesOnlyAppliedMutations()
await testPullAppliesChangesBeforeAdvancingCursor()
await testFailedApplyDoesNotAdvanceCursor()

console.log('backendSync tests passed')
