// 由修复后资格窗口 A/B 共同通过后生成。门槛未通过时保持为空，
// 不用历史单次成功结果冒充双窗口稳定来源。
export const STABLE_SOURCE_SEEDS = Object.freeze([])

export function buildStableSourceSeedMap(seeds = STABLE_SOURCE_SEEDS) {
  const map = new Map()
  ;(Array.isArray(seeds) ? seeds : []).forEach(seed => {
    const sourceKey = String(seed && seed.sourceKey || '')
    const configHash = String(seed && seed.configHash || '')
    if (!sourceKey || !configHash) return
    map.set(`${sourceKey}\n${configHash}`, seed)
  })
  return map
}

export default STABLE_SOURCE_SEEDS
