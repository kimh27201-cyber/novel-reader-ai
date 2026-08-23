import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, '$1'))
const script = path.join(root, 'scripts', 'source_import_benchmark.mjs')
const forbiddenOutput = path.join(root, 'artifacts', 'stage13', 'cli-dry-run-must-not-exist.json')
const help = execFileSync(process.execPath, [script, '--help'], { cwd: root, encoding: 'utf8' })
assert.match(help, /--checkpoint/)
assert.match(help, /--dryRun/)

const dryRun = JSON.parse(execFileSync(process.execPath, [
  script,
  '--dryRun',
  '--cohort=current',
  '--limit=200',
  '--flowLimit=200',
  `--output=${forbiddenOutput}`
], { cwd: root, encoding: 'utf8' }))
assert.equal(dryRun.dryRun, true)
assert.equal(dryRun.target, 200)
assert.equal(existsSync(forbiddenOutput), false)

console.log('sourceBenchmarkCli tests passed')
