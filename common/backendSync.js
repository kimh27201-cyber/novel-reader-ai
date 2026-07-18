import apiClient from './apiClient.js'

const QUEUE_KEY = 'novelReaderBackendMutationQueue'
const CURSOR_KEY = 'novelReaderBackendSyncCursor'
const DEVICE_KEY = 'novelReaderBackendDeviceId'

function getUni() {
  return typeof uni === 'undefined' ? null : uni
}

function storageMethod(deps, name, fallback) {
  const uniApi = getUni()
  return deps[name] || (uniApi && uniApi[name] ? uniApi[name].bind(uniApi) : fallback)
}

function parseArray(value) {
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(String(value || '[]'))
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}

function createId(prefix, deps) {
  if (typeof deps.randomUUID === 'function') return deps.randomUUID()
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  const random = Math.random().toString(36).slice(2, 12)
  return `${prefix}-${Date.now().toString(36)}-${random}`
}

export function createBackendSync(client = apiClient, deps = {}) {
  const getStorageSync = storageMethod(deps, 'getStorageSync', () => '')
  const setStorageSync = storageMethod(deps, 'setStorageSync', () => {})

  function getQueue() {
    return parseArray(getStorageSync(QUEUE_KEY)).filter(item => item && item.mutation_id)
  }

  function saveQueue(queue) {
    setStorageSync(QUEUE_KEY, JSON.stringify(queue))
    return queue
  }

  function getDeviceId() {
    const existing = String(getStorageSync(DEVICE_KEY) || '')
    if (existing) return existing
    const deviceId = createId('device', deps)
    setStorageSync(DEVICE_KEY, deviceId)
    return deviceId
  }

  function getCursor() {
    const cursor = Number(getStorageSync(CURSOR_KEY) || 0)
    return Number.isInteger(cursor) && cursor >= 0 ? cursor : 0
  }

  function setCursor(cursor) {
    const normalized = Math.max(0, Number(cursor) || 0)
    setStorageSync(CURSOR_KEY, normalized)
    return normalized
  }

  function enqueueMutation(input) {
    const mutation = {
      mutation_id: String(input.mutation_id || input.mutationId || createId('mutation', deps)),
      entity_type: String(input.entity_type || input.entityType || ''),
      sync_id: String(input.sync_id || input.syncId || ''),
      base_version: Math.max(0, Number(
        input.base_version !== undefined ? input.base_version : input.baseVersion !== undefined ? input.baseVersion : 0
      ) || 0),
      operation: String(input.operation || 'upsert'),
      payload: input.payload && typeof input.payload === 'object' ? input.payload : {}
    }
    if (mutation.mutation_id.length < 8 || mutation.mutation_id.length > 64) {
      throw new TypeError('mutation_id must contain 8 to 64 characters')
    }
    if (!['book', 'source', 'reading_history'].includes(mutation.entity_type)) {
      throw new TypeError('entity_type must be book, source, or reading_history')
    }
    if (mutation.sync_id.length < 8 || mutation.sync_id.length > 32) {
      throw new TypeError('sync_id must contain 8 to 32 characters')
    }
    if (!['upsert', 'delete'].includes(mutation.operation)) {
      throw new TypeError('operation must be upsert or delete')
    }
    if (Array.isArray(mutation.payload)) throw new TypeError('payload must be an object')
    const queue = getQueue()
    const duplicate = queue.find(item => item.mutation_id === mutation.mutation_id)
    if (duplicate) return duplicate
    queue.push(mutation)
    saveQueue(queue)
    return mutation
  }

  function removeMutation(mutationId) {
    const next = getQueue().filter(item => item.mutation_id !== mutationId)
    saveQueue(next)
    return next
  }

  function clearQueue() {
    return saveQueue([])
  }

  async function pushQueued(options = {}) {
    const batchSize = Math.min(200, Math.max(1, Number(options.batchSize) || 200))
    const mutations = getQueue().slice(0, batchSize)
    if (!mutations.length) return { results: [], cursor: null }
    const response = await client.syncPush({
      deviceId: options.deviceId || getDeviceId(),
      mutations
    })
    const appliedIds = new Set((response.results || [])
      .filter(result => result.status === 'applied')
      .map(result => result.mutation_id))
    if (appliedIds.size) {
      saveQueue(getQueue().filter(item => !appliedIds.has(item.mutation_id)))
    }
    return response
  }

  async function pullChanges(options = {}) {
    const requestedCursor = options.cursor !== undefined ? options.cursor : getCursor()
    const response = await client.syncPull({
      deviceId: options.deviceId || getDeviceId(),
      cursor: requestedCursor,
      limit: options.limit || 200
    })
    const applyChanges = options.applyChanges || deps.applyChanges
    if (typeof applyChanges === 'function') {
      await applyChanges(response.changes || [])
    }
    setCursor(response.next_cursor !== undefined ? response.next_cursor : requestedCursor)
    return response
  }

  async function syncNow(options = {}) {
    const push = await pushQueued(options)
    const pull = await pullChanges(options)
    return { push, pull, pending: getQueue() }
  }

  return {
    getDeviceId,
    getCursor,
    setCursor,
    getQueue,
    enqueueMutation,
    removeMutation,
    clearQueue,
    pushQueued,
    pullChanges,
    syncNow
  }
}

const backendSync = createBackendSync()

export default backendSync
