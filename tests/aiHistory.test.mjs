import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildAIHistoryItems,
  formatHistoryTime,
  loadAIHistory,
  mapCallLogRecord,
  mapChatRecord,
  mapSummaryRecord
} from '../common/aiHistory.js'

const summary = {
  id: 1,
  book_id: 12,
  chapter_id: 34,
  summary: '本章讲述主角第一次进入星轨图书馆。',
  characters: ['安祺', '图书馆'],
  key_points: ['收到借阅证', '进入轨道图书馆'],
  provider: 'mock',
  created_at: '2026-05-16T10:30:00'
}

const chat = {
  id: 2,
  book_id: 12,
  chapter_id: 34,
  question: '主角看到了什么？',
  answer: '主角看到了从城市上空经过的星轨图书馆。',
  provider: 'mock',
  created_at: '2026-05-16T10:35:00'
}

const callLog = {
  id: 3,
  book_id: 12,
  chapter_id: 34,
  call_type: 'summary',
  provider: 'mock',
  model: 'mock',
  status: 'success',
  error_code: '',
  error_message: '',
  duration_ms: 8,
  created_at: '2026-05-16T10:36:00'
}

const failedCallLog = {
  ...callLog,
  id: 4,
  call_type: 'chat',
  status: 'failed',
  error_code: 'provider_timeout',
  error_message: 'AI provider 响应超时',
  duration_ms: 5000,
  created_at: '2026-05-16T10:37:00'
}

function testMappingRecords() {
  const mappedSummary = mapSummaryRecord(summary)
  assert.equal(mappedSummary.id, 'summary:1')
  assert.equal(mappedSummary.type, 'summary')
  assert.equal(mappedSummary.title, 'AI 总结')
  assert.equal(mappedSummary.content, summary.summary)
  assert.equal(mappedSummary.bookId, 12)
  assert.equal(mappedSummary.chapterId, 34)
  assert.deepEqual(mappedSummary.tags, ['人物：安祺、图书馆', '关键点：收到借阅证；进入轨道图书馆'])

  const mappedChat = mapChatRecord(chat)
  assert.equal(mappedChat.id, 'chat:2')
  assert.equal(mappedChat.type, 'chat')
  assert.equal(mappedChat.title, chat.question)
  assert.equal(mappedChat.content, chat.answer)
  assert.equal(mappedChat.provider, 'mock')

  const mappedCallLog = mapCallLogRecord(callLog)
  assert.equal(mappedCallLog.id, 'call:3')
  assert.equal(mappedCallLog.type, 'call')
  assert.equal(mappedCallLog.title, 'AI 调用：总结')
  assert.equal(mappedCallLog.content, '调用成功')
  assert.equal(mappedCallLog.provider, 'mock')
  assert.equal(mappedCallLog.status, 'success')
  assert.equal(mappedCallLog.callType, 'summary')
  assert.deepEqual(mappedCallLog.tags, ['状态：success', '模型：mock', '耗时：8ms'])

  const mappedFailedCall = mapCallLogRecord(failedCallLog)
  assert.equal(mappedFailedCall.title, 'AI 调用：问答')
  assert.equal(mappedFailedCall.content, 'AI provider 响应超时')
  assert.equal(mappedFailedCall.status, 'failed')
  assert.equal(mappedFailedCall.callType, 'chat')
  assert.equal(mappedFailedCall.errorCode, 'provider_timeout')
  assert.equal(mappedFailedCall.errorMessage, 'AI provider 响应超时')
  assert.ok(mappedFailedCall.tags.includes('错误：provider_timeout'))
}

function testBuildHistoryItemsSortsNewestFirst() {
  const items = buildAIHistoryItems([summary], [chat], [callLog])
  assert.deepEqual(items.map(item => item.id), ['call:3', 'chat:2', 'summary:1'])
}

function testFormatHistoryTime() {
  assert.equal(formatHistoryTime('2026-05-16T10:35:00', 'Asia/Shanghai'), '05-16 18:35')
  assert.equal(formatHistoryTime('2026-05-16T10:35:00Z', 'Asia/Shanghai'), '05-16 18:35')
  assert.equal(formatHistoryTime(''), '未知时间')
}

async function testLoadAIHistoryUsesBackendClient() {
  const calls = []
  const client = {
    getToken: () => 'token',
    listSummaries(params) {
      calls.push(['summaries', params])
      return Promise.resolve([summary])
    },
    listChats(params) {
      calls.push(['chats', params])
      return Promise.resolve([chat])
    },
    listAiCalls(params) {
      calls.push(['calls', params])
      return Promise.resolve([callLog])
    }
  }

  const items = await loadAIHistory(client, { book_id: 12 })

  assert.deepEqual(calls, [
    ['summaries', { book_id: 12 }],
    ['chats', { book_id: 12 }],
    ['calls', { book_id: 12 }]
  ])
  assert.deepEqual(items.map(item => item.id), ['call:3', 'chat:2', 'summary:1'])
}

async function testLoadAIHistoryAcceptsWrappedBackendResponses() {
  const client = {
    getToken: () => 'token',
    listSummaries() {
      return Promise.resolve({ summaries: [summary] })
    },
    listChats() {
      return Promise.resolve({ chats: [chat] })
    },
    listAiCalls() {
      return Promise.resolve({ calls: [callLog] })
    }
  }

  const items = await loadAIHistory(client)
  assert.deepEqual(items.map(item => item.id), ['call:3', 'chat:2', 'summary:1'])
}

testMappingRecords()
testBuildHistoryItemsSortsNewestFirst()
testFormatHistoryTime()
await testLoadAIHistoryUsesBackendClient()
await testLoadAIHistoryAcceptsWrappedBackendResponses()

const aiHistoryPage = readFileSync(new URL('../pages/aiHistory/aiHistory.vue', import.meta.url), 'utf8')
assert.match(aiHistoryPage, /setFilter\('success'\)/)
assert.match(aiHistoryPage, /setFilter\('failed'\)/)
assert.match(aiHistoryPage, /item.status === this.filter/)
assert.match(aiHistoryPage, /失败原因/)
assert.match(aiHistoryPage, /errorMessage/)

console.log('aiHistory tests passed')
