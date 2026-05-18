import apiClient from './apiClient.js'
import { ensureBackendToken } from './backendLibrary.js'

function safeList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

export function formatHistoryTime(value) {
  if (!value) return '未知时间'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未知时间'
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

export function mapSummaryRecord(record) {
  const characters = safeList(record.characters)
  const keyPoints = safeList(record.key_points)
  return {
    id: `summary:${record.id}`,
    rawId: record.id,
    type: 'summary',
    title: 'AI 总结',
    content: record.summary || '',
    provider: record.provider || 'unknown',
    bookId: record.book_id,
    chapterId: record.chapter_id,
    createdAt: record.created_at,
    displayTime: formatHistoryTime(record.created_at),
    tags: [
      characters.length ? `人物：${characters.join('、')}` : '',
      keyPoints.length ? `关键点：${keyPoints.join('；')}` : ''
    ].filter(Boolean)
  }
}

export function mapChatRecord(record) {
  return {
    id: `chat:${record.id}`,
    rawId: record.id,
    type: 'chat',
    title: record.question || 'AI 问答',
    content: record.answer || '',
    provider: record.provider || 'unknown',
    bookId: record.book_id,
    chapterId: record.chapter_id,
    createdAt: record.created_at,
    displayTime: formatHistoryTime(record.created_at),
    tags: []
  }
}

function callTypeLabel(value) {
  return value === 'summary' ? '总结' : value === 'chat' ? '问答' : '未知'
}

export function mapCallLogRecord(record) {
  const success = record.status === 'success'
  return {
    id: `call:${record.id}`,
    rawId: record.id,
    type: 'call',
    title: `AI 调用：${callTypeLabel(record.call_type)}`,
    content: success ? '调用成功' : (record.error_message || '调用失败'),
    provider: record.provider || 'unknown',
    bookId: record.book_id,
    chapterId: record.chapter_id,
    createdAt: record.created_at,
    displayTime: formatHistoryTime(record.created_at),
    tags: [
      record.status ? `状态：${record.status}` : '',
      record.model ? `模型：${record.model}` : '',
      record.duration_ms !== undefined && record.duration_ms !== null ? `耗时：${record.duration_ms}ms` : '',
      record.error_code ? `错误：${record.error_code}` : ''
    ].filter(Boolean)
  }
}

export function buildAIHistoryItems(summaries = [], chats = [], callLogs = []) {
  return [
    ...summaries.map(mapSummaryRecord),
    ...chats.map(mapChatRecord),
    ...callLogs.map(mapCallLogRecord)
  ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

export async function loadAIHistory(client = apiClient, filters = {}) {
  ensureBackendToken(client)
  const [summaries, chats, callLogs] = await Promise.all([
    client.listSummaries(filters),
    client.listChats(filters),
    client.listAiCalls(filters)
  ])
  return buildAIHistoryItems(summaries || [], chats || [], callLogs || [])
}
