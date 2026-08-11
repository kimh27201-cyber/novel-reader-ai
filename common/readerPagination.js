const STRONG_BREAKS = /[。！？!?；;]/
const SOFT_BREAKS = /[，、,：:]/
const CLOSING_PUNCTUATION = /[”’」』】）〉》〕〗〙〛]/
const OPENING_PUNCTUATION = /[“‘「『【（〈《〔〖〘〚]/
const FORBIDDEN_PAGE_START = /[，。！？；：、,.!?;:）》】」』”’…—]/

export function normalizeChapterContent(content) {
  return String(content || '')
    .replace(/\r\n?/g, '\n')
    .trim()
}

function isParagraphBoundary(content, index) {
  return index <= 0 || content[index - 1] === '\n'
}

function findLastBoundary(content, start, end, minimum, matcher) {
  for (let index = end - 1; index >= minimum; index -= 1) {
    if (matcher(content[index])) return index + 1
  }
  return -1
}

function includeClosingPunctuation(content, boundary, maximum) {
  let end = boundary
  while (end < maximum && CLOSING_PUNCTUATION.test(content[end])) end += 1
  return end
}

function avoidBrokenPunctuation(content, start, boundary) {
  let end = boundary
  while (end > start + 1 && FORBIDDEN_PAGE_START.test(content[end])) end -= 1
  while (end > start + 1 && OPENING_PUNCTUATION.test(content[end - 1])) end -= 1
  return end
}

function balanceShortParagraphTail(content, start, maximumEnd, options = {}) {
  if (maximumEnd >= content.length || content[maximumEnd - 1] === '\n') return maximumEnd

  const nextParagraphBreak = content.indexOf('\n', maximumEnd)
  const paragraphEnd = nextParagraphBreak >= 0 ? nextParagraphBreak : content.length
  const tailLength = paragraphEnd - maximumEnd
  const charactersPerLine = Math.max(8, Number(options.charactersPerLine) || 18)
  const shortTailThreshold = Math.max(3, Math.round(charactersPerLine * 1.15))
  if (tailLength <= 0 || tailLength > shortTailThreshold) return maximumEnd

  const pageCapacity = maximumEnd - start
  const minimumParagraphLines = Math.max(1.25, Number(options.minimumParagraphLines) || 2)
  const desiredTailLength = Math.max(4, Math.round(charactersPerLine * minimumParagraphLines))
  const minimumBalanceRatio = Math.max(0.5, Math.min(0.8, Number(options.minimumBalanceRatio) || 0.58))
  let balancedEnd = paragraphEnd - desiredTailLength

  // If only the final two pages of a paragraph remain, an even split produces
  // a calmer ending than forcing one full page followed by a few characters.
  if (paragraphEnd - start <= pageCapacity * 2) {
    balancedEnd = start + Math.ceil((paragraphEnd - start) / 2)
  }

  const minimumEnd = start + Math.max(1, Math.floor(pageCapacity * minimumBalanceRatio))
  if (balancedEnd < minimumEnd || balancedEnd >= maximumEnd) return maximumEnd
  return balancedEnd
}

export function findSemanticPageBreak(content, start, maximumEnd, options = {}) {
  const length = Math.max(0, maximumEnd - start)
  if (!length) return start

  const minimumRatio = Math.max(0.55, Math.min(0.9, Number(options.minimumRatio) || 0.72))
  const minimum = Math.min(maximumEnd - 1, start + Math.floor(length * minimumRatio))
  const paragraphMinimumRatio = Math.max(
    minimumRatio,
    Math.min(0.92, Number(options.paragraphMinimumRatio) || 0.84)
  )
  const paragraphMinimum = Math.min(maximumEnd - 1, start + Math.floor(length * paragraphMinimumRatio))
  const boundaries = [
    { matcher: character => character === '\n', minimum: paragraphMinimum },
    { matcher: character => STRONG_BREAKS.test(character), minimum },
    { matcher: character => SOFT_BREAKS.test(character), minimum },
    { matcher: character => /\s/.test(character), minimum }
  ]

  for (const item of boundaries) {
    const boundary = findLastBoundary(content, start, maximumEnd, item.minimum, item.matcher)
    if (boundary <= start) continue
    const adjusted = includeClosingPunctuation(content, boundary, maximumEnd)
    if (OPENING_PUNCTUATION.test(content[adjusted - 1])) continue
    return avoidBrokenPunctuation(content, start, adjusted)
  }

  return avoidBrokenPunctuation(content, start, maximumEnd)
}

async function findMaximumFittingEnd(content, start, fits, options, cache) {
  const remaining = content.length - start
  const estimatedCharacters = Math.max(48, Number(options.estimatedCharacters) || 320)
  const candidateFits = async end => {
    const key = `${start}:${end}`
    if (!cache.has(key)) {
      cache.set(key, Promise.resolve(fits(content.slice(start, end), {
        start,
        end,
        continuesFromPrevious: !isParagraphBoundary(content, start)
      })))
    }
    return cache.get(key)
  }

  let low = start
  let high = Math.min(content.length, start + Math.min(remaining, estimatedCharacters))
  if (await candidateFits(high)) {
    low = high
    while (high < content.length) {
      const fittedLength = high - start
      high = Math.min(content.length, start + Math.max(fittedLength + 1, Math.ceil(fittedLength * 1.55)))
      if (await candidateFits(high)) low = high
      else break
    }
    if (low === content.length) return low
  }

  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2)
    if (await candidateFits(middle)) low = middle
    else high = middle
  }

  if (low === start && await candidateFits(start + 1)) return start + 1
  return low
}

export async function paginateContentByMeasurement(content, fits, options = {}) {
  if (typeof fits !== 'function') throw new TypeError('fits must be a function')

  const normalized = normalizeChapterContent(content)
  if (!normalized) {
    return {
      content: '',
      pages: [''],
      metadata: [{ start: 0, end: 0, continuesFromPrevious: false, continuesToNext: false }]
    }
  }

  const pages = []
  const metadata = []
  const cache = new Map()
  const maximumPages = Math.max(1, Number(options.maximumPages) || 10000)
  let start = 0
  let estimatedCharacters = Math.max(48, Number(options.estimatedCharacters) || 320)

  while (start < normalized.length && pages.length < maximumPages) {
    const maximumEnd = await findMaximumFittingEnd(normalized, start, fits, {
      ...options,
      estimatedCharacters
    }, cache)

    // A one-character page is the safe escape hatch for an invalid or extremely
    // small viewport. It prevents an infinite loop without discarding content.
    const safeMaximumEnd = Math.max(start + 1, maximumEnd)
    const balancedMaximumEnd = safeMaximumEnd >= normalized.length
      ? normalized.length
      : balanceShortParagraphTail(normalized, start, safeMaximumEnd, options)
    const end = balancedMaximumEnd >= normalized.length
      ? normalized.length
      : findSemanticPageBreak(normalized, start, balancedMaximumEnd, options)
    const safeEnd = Math.max(start + 1, end)

    pages.push(normalized.slice(start, safeEnd))
    metadata.push({
      start,
      end: safeEnd,
      continuesFromPrevious: !isParagraphBoundary(normalized, start),
      continuesToNext: safeEnd < normalized.length && normalized[safeEnd - 1] !== '\n'
    })
    estimatedCharacters = Math.max(48, Math.round((safeEnd - start) * 1.08))
    start = safeEnd
  }

  if (start < normalized.length) {
    pages.push(normalized.slice(start))
    metadata.push({
      start,
      end: normalized.length,
      continuesFromPrevious: !isParagraphBoundary(normalized, start),
      continuesToNext: false
    })
  }

  return { content: normalized, pages, metadata }
}

export function findPageIndexForOffset(metadata, offset, fallback = 0) {
  if (!Array.isArray(metadata) || !metadata.length) return Math.max(0, Number(fallback) || 0)
  const safeOffset = Math.max(0, Number(offset) || 0)
  const index = metadata.findIndex(item => safeOffset >= item.start && safeOffset < item.end)
  if (index >= 0) return index
  return safeOffset >= metadata[metadata.length - 1].end ? metadata.length - 1 : 0
}

export function getPageStartOffset(metadata, pageIndex) {
  if (!Array.isArray(metadata) || !metadata.length) return 0
  const index = Math.max(0, Math.min(Number(pageIndex) || 0, metadata.length - 1))
  return Math.max(0, Number(metadata[index].start) || 0)
}
