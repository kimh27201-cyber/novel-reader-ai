import assert from 'node:assert/strict'

const {
  findPageIndexForOffset,
  findSemanticPageBreak,
  getPageStartOffset,
  normalizeChapterContent,
  paginateContentByMeasurement
} = await import('../common/readerPagination.js')

const source = [
  '第一段从清晨开始，人物沿着河岸前行。风很轻，远处的灯还没有熄灭。',
  '第二段承接前文，解释了他们为什么出发，也留下了下一段要回答的问题。',
  '第三段写道：“真正的答案还在前面。”随后故事继续向前。'
].join('\r\n')

const normalized = normalizeChapterContent(source)
const limit = 42
const measured = await paginateContentByMeasurement(
  source,
  async candidate => candidate.length <= limit,
  { estimatedCharacters: 36, minimumRatio: 0.68 }
)

assert.equal(measured.pages.join(''), normalized, '分页不能丢字或重复文字')
assert.ok(measured.pages.length > 2)
assert.ok(measured.pages.every(page => page.length <= limit), '每页都必须通过可视容量检测')
assert.equal(measured.metadata.length, measured.pages.length)
assert.equal(measured.metadata[0].start, 0)
assert.equal(measured.metadata.at(-1).end, normalized.length)

for (let index = 0; index < measured.metadata.length; index += 1) {
  const item = measured.metadata[index]
  assert.equal(measured.pages[index], normalized.slice(item.start, item.end))
  if (index > 0) assert.equal(item.start, measured.metadata[index - 1].end)
}

const quote = '他说：“这是一句完整的话。”然后才转身离开，走进夜色之中。'
const quoteBreak = findSemanticPageBreak(quote, 0, quote.indexOf('然后') + 2, { minimumRatio: 0.55 })
assert.equal(quote.slice(0, quoteBreak).endsWith('。”'), true, '右引号应跟随句末标点留在同一页')

const paragraphFill = `${'甲'.repeat(36)}。\n${'乙'.repeat(35)}。\n${'丙'.repeat(19)}。${'丁'.repeat(20)}`
const paragraphFillBreak = findSemanticPageBreak(paragraphFill, 0, 100, {
  minimumRatio: 0.72,
  paragraphMinimumRatio: 0.84
})
assert.ok(paragraphFillBreak > 90, '段落边界过早时应继续寻找更靠后的完整句末')

const middleOffset = measured.metadata[1].start + 1
assert.equal(findPageIndexForOffset(measured.metadata, middleOffset), 1)
assert.equal(getPageStartOffset(measured.metadata, 1), measured.metadata[1].start)
assert.equal(findPageIndexForOffset(measured.metadata, normalized.length + 50), measured.pages.length - 1)

const unbroken = '解'.repeat(130)
const forced = await paginateContentByMeasurement(unbroken, candidate => candidate.length <= 25)
assert.equal(forced.pages.join(''), unbroken)
assert.ok(forced.pages.every(page => page.length <= 25))
assert.ok(forced.pages.at(-1).length >= 12, '末页不应只剩下几个孤立字符')

const shortTail = '山'.repeat(47)
const balanced = await paginateContentByMeasurement(
  shortTail,
  candidate => candidate.length <= 42,
  { charactersPerLine: 12, minimumParagraphLines: 2 }
)
assert.equal(balanced.pages.join(''), shortTail)
assert.equal(balanced.pages.length, 2)
assert.ok(balanced.pages.every(page => page.length >= 20), '段落末尾应在相邻两页间平衡')

const punctuation = `这是需要强制换页的一段普通文字${'甲'.repeat(18)}，“后续内容仍然属于同一句。”`
const punctuationPages = await paginateContentByMeasurement(
  punctuation,
  candidate => candidate.length <= 24,
  { charactersPerLine: 12 }
)
assert.equal(punctuationPages.pages.join(''), punctuation)
assert.ok(punctuationPages.pages.slice(1).every(page => !/^[，。！？；：、）》】」』”’…—]/.test(page)))
assert.ok(punctuationPages.pages.slice(0, -1).every(page => !/[“‘「『【（〈《〔〖〘〚]$/.test(page)))

let measurementCount = 0
const longChapter = '长篇章节用于验证分页测量次数。'.repeat(1200)
const longResult = await paginateContentByMeasurement(longChapter, candidate => {
  measurementCount += 1
  return candidate.length <= 320
}, { estimatedCharacters: 300, charactersPerLine: 18 })
assert.equal(longResult.pages.join(''), longChapter)
assert.ok(measurementCount < 1000, `长章节测量次数过多：${measurementCount}`)

const empty = await paginateContentByMeasurement('', () => true)
assert.deepEqual(empty.pages, [''])

console.log('reader pagination tests passed')
