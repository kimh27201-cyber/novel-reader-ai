import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildStableSourceSeeds,
  validateAcceptanceWindowPair
} from '../common/sourceAcceptanceCohort.js'

const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const [key, ...rest] = value.replace(/^--/, '').split('=')
  return [key, rest.join('=') || 'true']
}))
const inputs = String(args.inputs || '').split(',').map(value => value.trim()).filter(Boolean)
if (inputs.length !== 2) throw new Error('请通过 --inputs=window-a.json,window-b.json 提供且只提供两个资格窗口')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const reports = await Promise.all(inputs.map(async input => JSON.parse(await readFile(path.resolve(root, input), 'utf8'))))
const combined = validateAcceptanceWindowPair(reports[0], reports[1], {
  minimumDenominator: Number(args.minimumDenominator || 20),
  minimumRate: Number(args.minimumRate || 80),
  minimumSeparationMs: Number(args.minimumSeparationHours || 24) * 60 * 60 * 1000
})
const output = path.resolve(root, args.output || 'docs/source-acceptance/yck-current-cohort-stage7-combined.json')
const result = {
  schemaVersion: 4,
  cohortKind: 'currentCohort',
  sourceReports: inputs,
  generatedAt: new Date().toISOString(),
  ...combined
}
result.stableSourceSeeds = buildStableSourceSeeds(result, reports)
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
if (args.seedsOutput) {
  const seedsOutput = path.resolve(root, args.seedsOutput)
  await writeFile(seedsOutput, `${JSON.stringify(result.stableSourceSeeds, null, 2)}\n`, 'utf8')
}
if (result.errors.length) throw new Error(`双窗口校验失败：${result.errors.join(', ')}`)
process.stdout.write(`${JSON.stringify({ output, gatePassed: result.gatePassed, windows: result.windows.length, stableSeeds: result.stableSourceSeeds.length })}\n`)
