import assert from 'node:assert/strict'

globalThis.uni = {
  getStorageSync() { return undefined },
  setStorageSync() {},
  removeStorageSync() {}
}

const { hashSourceRuntimeConfig, matchesStableSourceSeed } = await import('../common/bookSources.js')

const source = {
  id: 'stable-source',
  sourceKey: 'source-key-stable',
  name: '稳定源',
  baseUrl: 'https://stable.example',
  enabled: false,
  raw: {
    bookSourceName: '稳定源',
    bookSourceUrl: 'https://stable.example',
    searchUrl: '/search?q={{key}}',
    ruleSearch: { bookList: '.book', name: 'a@text', bookUrl: 'a@href' }
  }
}
const configHash = hashSourceRuntimeConfig(source)
assert.equal(matchesStableSourceSeed(source, [{ sourceKey: source.sourceKey, configHash }]), true)
assert.equal(matchesStableSourceSeed({ ...source, raw: { ...source.raw, searchUrl: '/changed?q={{key}}' } }, [{ sourceKey: source.sourceKey, configHash }]), false)
assert.equal(source.enabled, false)

delete globalThis.uni
console.log('sourceAcceptanceSeeds tests passed')
