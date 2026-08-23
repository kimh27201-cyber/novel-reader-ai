import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { access, copyFile, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createStage13ReleaseState,
  getStage13ReleaseStatus,
  resumeStage13ReleaseFlow,
  runStage13ReleaseFlow
} from '../common/stage13ReleaseFlow.js'

const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const [key, ...rest] = value.replace(/^--/, '').split('=')
  return [key, rest.join('=') || 'true']
}))
const help = `阶段十三可恢复发布编排器

用法：node scripts/stage13_release_flow.mjs --action=<action> [options]

action:
  init | status | preflight-passed | record-prequalification | record-window-a
  resume | record-window-b | record-combined | retry | block | release-completed

options:
  --state=<path>       状态文件，默认 artifacts/stage13/release-state.json
  --report=<path>      当前动作使用的验收报告
  --reason=<code>      block 原因
  --force              允许 init 重建状态
  --now=<ISO time>     测试或恢复使用的时间
`
if (args.help === 'true' || !args.action) {
  process.stdout.write(help)
  process.exit(args.help === 'true' ? 0 : 1)
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const statePath = path.resolve(root, args.state || 'artifacts/stage13/release-state.json')
const runtimeFiles = [
  'common/bookSources.js',
  'common/headerUtils.js',
  'common/jsRuleSandbox.js',
  'common/sourceAcceptanceCohort.js',
  'common/sourceAcceptanceSeeds.js',
  'common/sourceContentSanitizer.js',
  'common/sourceCookieJar.js',
  'common/sourceEngine.js',
  'common/sourceErrors.js',
  'common/sourceMarket.js',
  'common/sourceSession.js',
  'common/sourceTransport.js',
  'scripts/node_legacy_charset.mjs',
  'scripts/source_import_benchmark.mjs'
]

async function exists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function atomicWrite(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  try {
    await rename(tempPath, filePath)
  } catch (error) {
    if (!['EPERM', 'EACCES', 'EEXIST'].includes(String(error && error.code || ''))) throw error
    await copyFile(tempPath, filePath)
    await unlink(tempPath).catch(() => {})
  }
}

async function runtimeIdentity() {
  const hash = createHash('sha256')
  for (const relative of runtimeFiles) {
    hash.update(relative)
    hash.update(await readFile(path.join(root, relative)))
  }
  let acceptanceCommit = ''
  try {
    acceptanceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  } catch {}
  return { acceptanceCommit, engineFingerprint: hash.digest('hex') }
}

async function loadReport() {
  if (!args.report) throw new Error('STAGE13_REPORT_REQUIRED')
  return JSON.parse(await readFile(path.resolve(root, args.report), 'utf8'))
}

const action = String(args.action)
const identity = await runtimeIdentity()
if (action === 'init') {
  if (await exists(statePath) && args.force !== 'true') throw new Error('STAGE13_STATE_ALREADY_EXISTS')
  const state = createStage13ReleaseState({ ...identity, now: args.now })
  await atomicWrite(statePath, state)
  process.stdout.write(`${JSON.stringify({ statePath, state, status: getStage13ReleaseStatus(state, { now: args.now }) })}\n`)
  process.exit(0)
}

const state = JSON.parse(await readFile(statePath, 'utf8'))
if (action === 'status') {
  process.stdout.write(`${JSON.stringify({ statePath, state, status: getStage13ReleaseStatus(state, { now: args.now }) }, null, 2)}\n`)
  process.exit(0)
}

let next = state
if (action === 'resume') {
  next = resumeStage13ReleaseFlow(state, { ...identity, now: args.now })
} else {
  const eventMap = {
    'preflight-passed': 'preflight_passed',
    'record-prequalification': 'prequalification_completed',
    'record-window-a': 'window_a_completed',
    'record-window-b': 'window_b_completed',
    'record-combined': 'combined',
    retry: 'retry',
    block: 'blocked',
    'release-completed': 'release_completed'
  }
  const type = eventMap[action]
  if (!type) throw new Error(`STAGE13_UNKNOWN_ACTION:${action}`)
  const needsReport = ['record-prequalification', 'record-window-a', 'record-window-b', 'record-combined'].includes(action)
  next = runStage13ReleaseFlow(state, {
    type,
    now: args.now,
    report: needsReport ? await loadReport() : undefined,
    reason: args.reason,
    ...identity
  })
}
await atomicWrite(statePath, next)
process.stdout.write(`${JSON.stringify({ statePath, state: next, status: getStage13ReleaseStatus(next, { now: args.now }) })}\n`)
