import assert from 'node:assert/strict'

const { selectDiverseSourceCandidates } = await import('../common/bookSources.js')

const sources = [
  { id: 'a1', baseUrl: 'https://same.example/a' },
  { id: 'b1', baseUrl: 'https://other.example/a' },
  { id: 'a2', baseUrl: 'https://same.example/b' },
  { id: 'a3', baseUrl: 'https://same.example/c' },
  { id: 'c1', baseUrl: 'https://third.example/a' },
  { id: 'b2', baseUrl: 'https://other.example/b' }
]

const selected = selectDiverseSourceCandidates(sources, 5, 2)
assert.deepEqual(selected.map(source => source.id), ['a1', 'b1', 'a2', 'c1', 'b2'])
const hostCounts = selected.reduce((counts, source) => {
  const host = new URL(source.baseUrl).hostname
  counts[host] = Number(counts[host] || 0) + 1
  return counts
}, {})
assert.ok(Object.values(hostCounts).every(count => count <= 2))

console.log('sourceCandidateDiversity tests passed')
