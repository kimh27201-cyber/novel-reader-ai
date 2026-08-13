import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { combineAcceptanceWindows } from '../common/sourceAcceptanceCohort.js'

const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const [key, ...rest] = value.replace(/^--/, '').split('=')
  return [key, rest.join('=') || 'true']
}))
const inputs = String(args.inputs || '').split(',').map(value => value.trim()).filter(Boolean)
if (inputs.length < 2) throw new Error('请通过 --inputs=window1.json,window2.json 提供至少两个时间窗口')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const reports = await Promise.all(inputs.map(async input => JSON.parse(await readFile(path.resolve(root, input), 'utf8'))))
const manifests = reports.map(report => JSON.stringify((report.currentCohort && report.currentCohort.blocks) || []))
if (new Set(manifests).size !== 1) throw new Error('两个时间窗口的 currentCohort 清单不一致，不能合并验收')
const combined = combineAcceptanceWindows(reports, {
  minimumDenominator: Number(args.minimumDenominator || 20),
  minimumRate: Number(args.minimumRate || 80),
  minimumSeparationMs: Number(args.minimumSeparationHours || 24) * 60 * 60 * 1000
})
const output = path.resolve(root, args.output || 'docs/source-acceptance/yck-current-cohort-stage7-combined.json')
const result = {
  schemaVersion: 3,
  cohortKind: 'currentCohort',
  sourceReports: inputs,
  generatedAt: new Date().toISOString(),
  ...combined
}
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
process.stdout.write(`${JSON.stringify({ output, gatePassed: result.gatePassed, windows: result.windows.length })}\n`)
