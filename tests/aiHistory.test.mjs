import assert from 'node:assert/strict'
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
  assert.deepEqual(mappedCallLog.tags, ['状态：success', '模型：mock', '耗时：8ms'])
}

function testBuildHistoryItemsSortsNewestFirst() {
  const items = buildAIHistoryItems([summary], [chat], [callLog])
  assert.deepEqual(items.map(item => item.id), ['call:3', 'chat:2', 'summary:1'])
}

function testFormatHistoryTime() {
  assert.equal(formatHistoryTime('2026-05-16T10:35:00'), '05-16 10:35')
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

testMappingRecords()
testBuildHistoryItemsSortsNewestFirst()
testFormatHistoryTime()
await testLoadAIHistoryUsesBackendClient()

console.log('aiHistory tests passed')
