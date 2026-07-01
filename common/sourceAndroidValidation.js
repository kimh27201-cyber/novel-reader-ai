function normalizeItems(checklist) {
  return Array.isArray(checklist) ? checklist.filter(Boolean) : []
}

function normalizeSummary(summary = {}, items = []) {
  return {
    total: Number(summary.total || items.length || 0),
    readyCount: Number(summary.readyCount || 0),
    actionCount: Number(summary.actionCount || 0),
    waitingCount: Number(summary.waitingCount || 0),
    skippedCount: Number(summary.skippedCount || 0),
    completeCount: Number(summary.completeCount || 0),
    status: summary.status || '',
    statusText: summary.statusText || '',
    nextAction: summary.nextAction || ''
  }
}

function statusText(status) {
  if (status === 'blocked') return '存在阻塞项'
  if (status === 'complete') return '证据已完整'
  return '可进入手机验证'
}

function nextActionFor(status, blockers, pending) {
  if (status === 'blocked') {
    const item = blockers[0]
    return item ? `先处理 ${item.title}：${item.detail}` : '先处理当前阻塞项。'
  }
  if (status === 'phone-required') {
    const item = pending[0]
    return item ? `连接手机后执行 ${item.title}：${item.detail}` : '连接手机后按清单继续验证。'
  }
  return '当前 Android 验证证据已完整，可进入里程碑包验收归档。'
}

export function buildAndroidPhonePreflight(options = {}) {
  const items = normalizeItems(options.checklist)
  const blockers = items.filter(item => item.state === 'action')
  const pending = items.filter(item => item.state === 'waiting')
  const completed = items.filter(item => item.state === 'ready' || item.state === 'skipped')
  const status = blockers.length ? 'blocked' : (pending.length ? 'phone-required' : 'complete')

  return {
    sourceId: options.sourceId || '',
    sourceName: options.sourceName || '',
    platform: options.platform || '',
    status,
    statusText: statusText(status),
    readyForPhone: blockers.length === 0,
    summary: normalizeSummary(options.summary, items),
    blockers: blockers.map(item => ({
      key: item.key,
      title: item.title,
      detail: item.detail,
      state: item.state,
      label: item.label
    })),
    pending: pending.map(item => ({
      key: item.key,
      title: item.title,
      detail: item.detail,
      state: item.state,
      label: item.label
    })),
    completed: completed.map(item => ({
      key: item.key,
      title: item.title,
      state: item.state,
      label: item.label
    })),
    phoneSteps: items.map((item, index) => ({
      order: index + 1,
      key: item.key,
      title: item.title,
      state: item.state,
      label: item.label,
      detail: item.detail,
      requiresPhone: item.state === 'waiting'
    })),
    nextAction: nextActionFor(status, blockers, pending)
  }
}
