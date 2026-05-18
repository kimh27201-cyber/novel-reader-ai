export const demoSearchKeywords = [
  '星轨图书馆',
  '斗破苍穹',
  '剑来',
  '诡秘之主',
  '庆余年',
  '凡人修仙传'
]

export function sanitizeSearchKeyword(value) {
  return String(value || '').replace(/^[^\u4e00-\u9fa5A-Za-z0-9]+/, '').trim()
}

export function buildSourceToggleState(source) {
  const sourceName = String((source && source.name) || '').trim()
  const nextEnabled = !(source && source.enabled)
  return {
    sourceId: source && source.id,
    nextEnabled,
    toast: `${nextEnabled ? '已启用' : '已停用'}${sourceName}`
  }
}
