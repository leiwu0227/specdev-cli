import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readCheckpoint, writeCheckpoint, suspendRun } from 'ripplegraph'
import { parse, stringify } from 'yaml'
import { createAttemptRecord, writeLocalProcessMarker } from '../src/utils/process-record.js'

const CLI = fileURLToPath(new URL('../bin/specdev.js', import.meta.url))
const roots = []
const git = (root, args) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
function run(root, args, expected = 0) {
  const result = spawnSync(process.execPath, [CLI, ...args, '--json'], {
    cwd: root,
    encoding: 'utf8',
  })
  assert.equal(result.status, expected, result.stderr + result.stdout)
  return JSON.parse(result.stdout)
}
function write(path, value) {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, value)
}
const json = (path) => JSON.parse(readFileSync(path, 'utf8'))
function snapshot(root) {
  const files = {}
  function visit(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'cache') continue
      const path = join(dir, entry.name)
      if (entry.isDirectory()) visit(path)
      else files[relative(root, path)] = readFileSync(path, 'utf8')
    }
  }
  visit(root)
  return files
}
function fixture({ child = true, paused = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'specdev-mission-closure-'))
  roots.push(root)
  git(root, ['init', '-b', 'main'])
  git(root, ['config', 'user.name', 'SpecDev Test'])
  git(root, ['config', 'user.email', 'specdev@example.test'])
  run(root, ['init', '--platform=none'])
  write(join(root, 'product.txt'), 'accepted delivery\n')
  git(root, ['add', '--all'])
  git(root, ['commit', '-m', 'initial'])
  const created = run(root, ['mission', 'create', 'Accepted delivery'])
  const missionPath = join(root, created.path)
  const specdev = join(root, '.specdev')
  const mission = parse(readFileSync(join(missionPath, 'mission.yaml'), 'utf8'))
  mission.status = 'blocked'
  mission.blocker = 'Verification failed; acceptance evidence is missing'
  mission.approved_contract_hash = 'a'.repeat(64)
  write(join(missionPath, 'mission.yaml'), stringify(mission))
  write(
    join(missionPath, 'review', 'verification.json'),
    JSON.stringify({ status: 'failed', missing: ['AC-2'] })
  )
  write(
    join(root, 'acceptance.md'),
    'I accept this delivery with limitations: the verification failed and AC-2 evidence is missing.\n'
  )
  let childPath
  if (child) {
    childPath = join(specdev, 'assignments', '00001_child')
    write(
      join(childPath, 'status.json'),
      JSON.stringify({
        id: '00001',
        mission: mission.id,
        run_id: mission.run_id,
        status: 'blocked',
      })
    )
    write(
      join(childPath, 'brainstorm', 'contract.md'),
      '# Approved child contract\nAC-1 and AC-2 remain required.\n'
    )
    write(
      join(childPath, 'implementation', 'progress.json'),
      JSON.stringify({
        verification: [{ command: 'false', status: 'failed' }],
        follow_up: 'required',
      })
    )
    write(join(childPath, 'outcome.md'), '# Outcome\n\n| AC-2 | missing evidence | Blocked |\n')
    write(
      join(missionPath, 'design', 'assignments.yaml'),
      stringify({
        version: 2,
        assignments: [
          { id: '00001', folder: '00001_child', status: 'running' },
          { id: '00002', status: 'pending' },
        ],
      })
    )
    const checkpoint = readCheckpoint(specdev, mission.run_id)
    checkpoint.position = { graph: 'assignment-lifecycle', node: 'implement' }
    checkpoint.stack = [
      {
        parent: { graph: 'mission-lifecycle', node: 'child-assignment', scope: '' },
        child: {
          kind: 'package',
          graphId: 'assignment-lifecycle',
          graphVersion: '1.0.0',
          packagePath: 'graphs/assignment-lifecycle',
        },
        scope: 'child-00001',
        enteredAt: new Date().toISOString(),
      },
    ]
    checkpoint.outputs['child-00001/verification'] = { status: 'failed' }
    writeCheckpoint(specdev, checkpoint)
  }
  if (paused) suspendRun({ workflowRoot: specdev, note: 'pause for acceptance' })
  git(root, ['add', '--all'])
  git(root, ['commit', '-m', 'accepted candidate with incomplete evidence'])
  const args = [
    'mission',
    'close',
    mission.id,
    '--outcome=accepted-with-limitations',
    '--evidence=acceptance.md',
  ]
  return { root, specdev, missionPath, mission, childPath, args }
}
try {
  {
    const f = fixture()
    const { root, missionPath, mission, specdev, childPath, args } = f
    const failedStart = run(root, ['adhoc', 'start', 'follow-on'], 1)
    assert.match(
      JSON.stringify(failedStart),
      /mission_boundary_conflict|mission_execution_boundary_established/
    )
    const before = snapshot(root)
    const plan = run(root, args)
    assert.equal(plan.status, 'confirmation_required')
    assert.equal(plan.mutated, false)
    assert.deepEqual(snapshot(root), before)
    assert.equal(run(root, args).plan.digest, plan.plan.digest)
    run(root, [...args, `--confirm=${'0'.repeat(64)}`], 1)
    assert.deepEqual(snapshot(root), before)
    const head = git(root, ['rev-parse', 'HEAD'])
    const checkpoint = readCheckpoint(specdev, mission.run_id)
    const closeArgs = [...args, `--confirm=${plan.plan.digest}`]
    const result = run(root, closeArgs)
    assert.equal(result.status, 'closed')
    assert.equal(result.disposition, 'accepted-with-limitations')
    assert.equal(result.verification, 'incomplete')
    assert.equal(result.delivery.verified, false)
    assert.equal(git(root, ['rev-parse', 'HEAD^']), head)
    assert.equal(result.repository.terminal_commit, git(root, ['rev-parse', 'HEAD']))
    assert.match(git(root, ['show', '-s', '--format=%B', 'HEAD']), /SpecDev-Commit-Type: closure/)
    assert.equal(json(join(childPath, 'status.json')).status, 'closed')
    assert.equal(json(join(childPath, 'status.json')).closure.source_status, 'blocked')
    const queue = parse(readFileSync(join(missionPath, 'design', 'assignments.yaml'), 'utf8'))
    assert.deepEqual(
      queue.assignments.map((child) => child.status),
      ['cancelled', 'cancelled']
    )
    const afterRun = readCheckpoint(specdev, mission.run_id)
    assert.equal(afterRun.status, 'abandoned')
    assert.deepEqual(afterRun.outputs, checkpoint.outputs)
    assert.deepEqual(afterRun.stack, checkpoint.stack)
    assert(!existsSync(join(specdev, '.current')))
    assert.equal(json(join(specdev, '.ripplegraph', 'current.json')).focusedRunId, null)
    for (const path of [
      'product.txt',
      'acceptance.md',
      `${relative(root, childPath)}/brainstorm/contract.md`,
      `${relative(root, childPath)}/implementation/progress.json`,
      `${relative(root, childPath)}/outcome.md`,
      `${relative(root, missionPath)}/review/verification.json`,
    ])
      assert.equal(readFileSync(join(root, path), 'utf8'), before[path])
    assert(!existsSync(join(childPath, 'review', 'missing-evidence.json')))
    const terminal = snapshot(root)
    for (const command of ['status', 'run']) {
      const status = run(root, ['mission', command, mission.id])
      assert.equal(status.status, 'closed')
      assert.equal(status.next_action, null)
      assert.equal(status.verification, 'incomplete')
    }
    assert.equal(run(root, closeArgs).idempotent, true)
    for (const command of [
      ['mission', 'abandon', mission.id, '--reason=changed mind'],
      ['mission', 'pause', mission.id],
      ['mission', 'migrate', mission.id],
      ['mission', 'checkpoint', mission.id],
      ['mission', 'handoff', mission.id, '--successor-assignment'],
      ['mission', 'adopt-successor', mission.id, '--assignment=00001'],
      ['mission', 'approve-divergence', mission.id],
      ['mission', 'reject-divergence', mission.id],
      ['focus', mission.id],
      ['focus', '00001'],
      ['reviewloop', 'mission', `--mission=${mission.id}`],
      ['implement', '--assignment=00001'],
      ['checkpoint', 'brainstorm', '--assignment=00001'],
    ])
      run(root, command, 1)
    assert.deepEqual(snapshot(root), terminal)
    assert.equal(run(root, ['adhoc', 'start', 'follow-on']).status, 'started')
  }
  for (const phase of ['authority-confirmed', 'terminal-written', 'run-closed', 'prepared']) {
    const f = fixture()
    const attempt = await createAttemptRecord(f.specdev, {
      kind: 'worker',
      assignment: '00001_child',
      workspace: '.',
    })
    await writeLocalProcessMarker(f.specdev, attempt.id, { pid: 2147483647, cwd: f.root })
    git(f.root, ['add', '--all'])
    git(f.root, ['commit', '-m', 'record stale worker'])
    const plan = run(f.root, f.args)
    const args = [...f.args, `--confirm=${plan.plan.digest}`]
    run(f.root, [...args, `--interrupt-after=${phase}`], 1)
    assert.equal(run(f.root, ['mission', 'status', f.mission.id]).status, 'closing')
    run(f.root, ['implement', '--assignment=00001'], 1)
    run(f.root, ['mission', 'abandon', f.mission.id, '--reason=do not bypass pending closure'], 1)
    assert.equal(run(f.root, args).status, 'closed')
    assert.equal(run(f.root, args).idempotent, true)
    const record = parse(readFileSync(join(f.specdev, 'processes', `${attempt.id}.yaml`), 'utf8'))
    assert.equal(record.status, 'interrupted')
    assert.equal(record.closure_plan, plan.plan.digest)
    assert.equal(run(f.root, ['adhoc', 'start', 'after recovered closure']).status, 'started')
  }
  {
    const f = fixture({ child: false, paused: true })
    const plan = run(f.root, f.args)
    assert.equal(run(f.root, [...f.args, `--confirm=${plan.plan.digest}`]).status, 'closed')
  }
  {
    const f = fixture()
    write(join(f.root, 'unrelated.txt'), 'staged unrelated work\n')
    git(f.root, ['add', 'unrelated.txt'])
    write(join(f.root, 'unrelated.txt'), 'later unstaged work\n')
    const index = git(f.root, ['diff', '--cached', '--', 'unrelated.txt'])
    const plan = run(f.root, f.args)
    const args = [...f.args, `--confirm=${plan.plan.digest}`]
    const result = run(f.root, args)
    assert(!result.repository.committed_paths.includes('unrelated.txt'))
    assert.equal(git(f.root, ['diff', '--cached', '--', 'unrelated.txt']), index)
    assert.equal(readFileSync(join(f.root, 'unrelated.txt'), 'utf8'), 'later unstaged work\n')
    // Retried closure must not clear later focus or rewrite the index.
    write(join(f.specdev, '.current'), 'kind: discussion\nid: D99999\n')
    const beforeRetry = snapshot(f.root)
    assert.equal(run(f.root, args).idempotent, true)
    assert.deepEqual(snapshot(f.root), beforeRetry)
    assert.equal(git(f.root, ['diff', '--cached', '--', 'unrelated.txt']), index)
  }
  for (const change of ['evidence', 'artifact', 'queue', 'product']) {
    const f = fixture()
    const plan = run(f.root, f.args)
    const path = {
      evidence: 'acceptance.md',
      artifact: relative(f.root, join(f.childPath, 'outcome.md')),
      queue: relative(f.root, join(f.missionPath, 'design', 'assignments.yaml')),
      product: 'product.txt',
    }[change]
    write(join(f.root, path), readFileSync(join(f.root, path), 'utf8') + '\n# changed\n')
    const before = snapshot(f.root)
    run(f.root, [...f.args, `--confirm=${plan.plan.digest}`], 1)
    assert.deepEqual(snapshot(f.root), before)
  }
  {
    const f = fixture()
    const before = snapshot(f.root)
    for (const extra of ['--outcome=completed', '--evidence=missing.md', '--evidence'])
      run(f.root, [...f.args, extra], 1)
    assert.deepEqual(snapshot(f.root), before)
    const attempt = await createAttemptRecord(f.specdev, {
      kind: 'mission-controller',
      mission: f.mission.id,
    })
    await writeLocalProcessMarker(f.specdev, attempt.id, { pid: process.pid, cwd: f.root })
    const live = snapshot(f.root)
    assert.match(run(f.root, f.args, 1).error, /Live or ambiguous/)
    assert.deepEqual(snapshot(f.root), live)
  }
  console.log('Mission closure tests passed')
} finally {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
}
