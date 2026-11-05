import assert from 'node:assert/strict'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { startCallableCall } from 'ripplegraph'
import { installWorkspaceEngine } from '../src/utils/engine.js'

const root = mkdtempSync(join(tmpdir(), 'specdev-empty-calls-'))
const specdev = join(root, '.specdev')
const bin = resolve(import.meta.dirname, '../bin/specdev.js')
function run(args, expected = 0) {
  const result = spawnSync(process.execPath, [bin, ...args, '--json'], {
    cwd: root,
    encoding: 'utf8',
  })
  assert.equal(result.status, expected, result.stdout + result.stderr)
  return JSON.parse(result.stdout)
}
try {
  cpSync(resolve(import.meta.dirname, '../templates/.specdev'), specdev, { recursive: true })
  installWorkspaceEngine(root)
  startCallableCall({
    workflowRoot: specdev,
    graphId: 'discussion-lifecycle',
    callId: 'D10000',
    input: {
      id: 'D10000',
      path: 'discussion',
      description: 'preserve live call',
      start_revision: 'abc',
    },
  })
  const calls = join(specdev, '.ripplegraph/calls')
  const checkpoint = join(calls, 'D10000/checkpoint.json')
  const original = readFileSync(checkpoint)
  mkdirSync(join(calls, 'D00009/scratch'), { recursive: true })
  mkdirSync(join(calls, 'D00016'), { recursive: true })
  mkdirSync(join(calls, 'D00017/scratch'), { recursive: true })
  const evidence = join(calls, 'D00017/scratch/evidence.txt')
  writeFileSync(evidence, 'retain this evidence')
  const outside = join(root, 'outside')
  mkdirSync(outside)
  symlinkSync(outside, join(calls, 'D00018'))
  mkdirSync(join(calls, 'D00019'))
  symlinkSync(outside, join(calls, 'D00019/scratch'))
  const preview = run(['cleanup', '--empty-calls'])
  assert.deepEqual(
    preview.candidates.map((item) => item.path),
    ['.specdev/.ripplegraph/calls/D00009', '.specdev/.ripplegraph/calls/D00016']
  )
  assert.ok(existsSync(join(calls, 'D00009/scratch')), 'preview must not remove directories')
  assert.equal(preview.skipped.length, 4)

  // A file arriving after preview must prevent removal on apply.
  writeFileSync(join(calls, 'D00016/new-evidence.txt'), 'new evidence')
  const applied = run(['cleanup', '--empty-calls', '--apply'])
  assert.deepEqual(applied.removed, ['.specdev/.ripplegraph/calls/D00009'])
  assert.ok(existsSync(join(calls, 'D00016/new-evidence.txt')))
  assert.equal(readFileSync(evidence, 'utf8'), 'retain this evidence')
  assert.deepEqual(readFileSync(checkpoint), original)
  assert.ok(existsSync(outside))
  assert.deepEqual(run(['cleanup', '--empty-calls', '--apply']).removed, [])

  // Ambiguous Attempt state blocks all recovery, even for an empty candidate.
  mkdirSync(join(calls, 'D00020'))
  mkdirSync(join(specdev, 'processes'), { recursive: true })
  writeFileSync(join(specdev, 'processes/Attempt-99999.yaml'), 'invalid: [')
  assert.match(run(['cleanup', '--empty-calls', '--apply'], 1).error, /quiescent/)
  assert.ok(existsSync(join(calls, 'D00020')))
  rmSync(join(specdev, 'processes/Attempt-99999.yaml'))

  // Remove only fixture damage; verify the real status path after shell recovery.
  for (const id of ['D00016', 'D00017', 'D00018', 'D00019'])
    rmSync(join(calls, id), { recursive: true, force: true })
  assert.deepEqual(run(['cleanup', '--empty-calls', '--apply']).removed, [
    '.specdev/.ripplegraph/calls/D00020',
  ])
  assert.equal(run(['update', '--status']).status, 'ok')
  assert.equal(run(['cleanup']).status, 'preview', 'ordinary cleanup remains available')
  assert.match(run(['cleanup', '--empty-calls=false'], 1).error, /Usage/)
  console.log('Empty callable recovery checks passed')
} finally {
  rmSync(root, { recursive: true, force: true })
}
