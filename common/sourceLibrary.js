export const ALL_SOURCE_GROUP = '全部分组'
export const UNGROUPED_SOURCE_GROUP = '未分组'

function cleanText(value) {
  return String(value == null ? '' : value).trim()
}

function fallbackName(source = {}) {
  const raw = source.raw || source
  const directName = cleanText(source.name || raw.bookSourceName || raw.name || raw.sourceName)
  if (directName) return directName

  const url = cleanText(source.baseUrl || raw.bookSourceUrl || raw.sourceUrl || raw.baseUrl)
  if (!url) return '未命名书源'
  try {
    const parsed = new URL(url)
    return parsed.hostname || url
  } catch (error) {
    return url.replace(/^https?:\/\//i, '').split(/[/?#]/)[0] || '未命名书源'
  }
}

function normalizeGroup(source = {}) {
  const raw = source.raw || source
  return cleanText(source.group || raw.bookSourceGroup || raw.group) || UNGROUPED_SOURCE_GROUP
}

export function normalizeLibrarySources(sources = []) {
  return (Array.isArray(sources) ? sources : [])
    .filter(Boolean)
    .map(source => {
      const raw = source.raw || source
      return {
        ...source,
        name: fallbackName(source),
        baseUrl: cleanText(source.baseUrl || raw.bookSourceUrl || raw.sourceUrl || raw.baseUrl),
        group: normalizeGroup(source),
        enabled: source.enabled !== false
      }
    })
}

export function getLibrarySourceGroups(sources = []) {
  const groups = normalizeLibrarySources(sources).map(source => source.group || UNGROUPED_SOURCE_GROUP)
  return [ALL_SOURCE_GROUP, ...Array.from(new Set(groups))]
}

export function filterLibrarySources(sources = [], options = {}) {
  const keyword = cleanText(options.keyword).toLowerCase()
  const sourceFilter = cleanText(options.sourceFilter || options.filter || 'all') || 'all'
  const sourceGroupFilter = cleanText(options.sourceGroupFilter || ALL_SOURCE_GROUP) || ALL_SOURCE_GROUP
  const diagnostics = typeof options.getDiagnostics === 'function' ? options.getDiagnostics : null

  return normalizeLibrarySources(sources).filter(source => {
    if (sourceFilter === 'enabled' && source.enabled === false) return false
    if (sourceFilter === 'disabled' && source.enabled !== false) return false
    if (sourceFilter === 'incompatible' && diagnostics && diagnostics(source).compatible) return false
    if (sourceGroupFilter !== ALL_SOURCE_GROUP && normalizeGroup(source) !== sourceGroupFilter) return false
    if (!keyword) return true
    return [
      source.name,
      source.group,
      source.baseUrl,
      source.compatibility,
      source.id
    ].some(value => cleanText(value).toLowerCase().includes(keyword))
  })
}
