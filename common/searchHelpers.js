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

export function buildSourceSelectState(source, keyword) {
  const sourceName = String((source && source.name) || '').trim()
  const word = sanitizeSearchKeyword(keyword)
  const shouldSearch = !!word && word !== sourceName
  return {
    sourceId: source && source.id,
    keyword: word,
    shouldSearch,
    toast: shouldSearch
      ? `已启用${sourceName}，开始搜索：${word}`
      : `已启用${sourceName}，请输入书名搜索`
  }
}
