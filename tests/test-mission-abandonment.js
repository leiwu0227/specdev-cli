import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { createAttemptRecord, writeLocalProcessMarker } from '../src/utils/process-record.js'

const CLI = fileURLToPath(new URL('../bin/specdev.js', import.meta.url))
const roots = []

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

function run(root, args, expected = 0) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd: root,
    encoding: 'utf8',
  })
  assert.equal(result.status, expected, result.stderr || result.stdout)
  return result
}

function runJson(root, args, expected = 0) {
  const result = run(root, [...args, '--json'], expected)
  return JSON.parse(result.stdout)
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'specdev-mission-abandonment-'))
  roots.push(root)
  git(root, ['init', '-b', 'main'])
  git(root, ['config', 'user.name', 'SpecDev Test'])
  git(root, ['config', 'user.email', 'specdev@example.test'])
  writeFileSync(join(root, 'base.txt'), 'base\n')
  git(root, ['add', 'base.txt'])
  git(root, ['commit', '-m', 'base'])
  runJson(root, ['init'])
  git(root, ['add', '--all'])
  git(root, ['commit', '-m', 'initialize specdev'])

  const created = runJson(root, ['mission', 'create', 'Retire obsolete objective'])
  const missionPath = join(root, created.path)
  const mission = parseYaml(readFileSync(join(missionPath, 'mission.yaml'), 'utf8'))
  git(root, ['add', '--all'])
  git(root, ['commit', '-m', 'record mission'])
  git(root, ['switch', '-c', mission.branch])
  return { root, missionPath, mission, created, parent: git(root, ['rev-parse', 'HEAD']) }
}

function durableSnapshot(root) {
  const hash = createHash('sha256')
  const specdevPath = join(root, '.specdev')
  const visit = (directory) => {
    for (const name of readdirSync(directory).sort()) {
      if (directory === specdevPath && ['cache', 'worktrees'].includes(name)) continue
      const path = join(directory, name)
      const info = statSync(path)
      if (info.isDirectory()) visit(path)
      else {
        hash.update(relative(root, path))
        hash.update('\0')
        hash.update(readFileSync(path))
        hash.update('\0')
      }
    }
  }
  visit(specdevPath)
  return hash.digest('hex')
}

function prepareChildWorktree(context) {
  const { root, missionPath, mission } = context
  const baseRevision = git(root, ['rev-parse', 'HEAD'])
  const childBranch = `specdev/${mission.id}/00001`
  git(root, ['branch', childBranch, baseRevision])
  mkdirSync(join(missionPath, 'design'), { recursive: true })
  writeFileSync(
    join(missionPath, 'design', 'assignments.yaml'),
    stringifyYaml({
      version: 2,
      design_mode: 'planned',
      assignments: [
        {
          id: '00001',
          title: 'Retained child',
          status: 'pending',
          branch: childBranch,
          base_revision: baseRevision,
        },
      ],
    })
  )
  git(root, ['add', '--all'])
  git(root, ['commit', '-m', 'record retained child'])
  const worktreePath = join(root, '.specdev', 'worktrees', 'slot-01')
  mkdirSync(join(root, '.specdev', 'worktrees'), { recursive: true })
  git(root, ['worktree', 'add', worktreePath, childBranch])
  return { childBranch, worktreePath, childRevision: git(root, ['rev-parse', childBranch]) }
}

try {
  {
    const context = fixture()
    const { root, missionPath, mission, parent } = context
    const before = durableSnapshot(root)
    const planned = runJson(root, [
      'mission',
      'abandon',
      mission.id,
      '--reason=objective is no longer wanted',
    ])
    assert.equal(planned.status, 'confirmation_required')
    assert.equal(planned.mutated, false)
    assert.match(planned.plan.digest, /^[a-f0-9]{64}$/)
    assert.equal(durableSnapshot(root), before)
    assert.equal(git(root, ['status', '--porcelain=v1', '--untracked-files=all']), '')
    assert.equal(
      existsSync(join(root, '.specdev', 'cache', 'mission-abandon', `${mission.id}.json`)),
      false
    )
    const repeatedPlan = runJson(root, [
      'mission',
      'abandon',
      mission.id,
      '--reason=objective is no longer wanted',
    ])
    assert.equal(repeatedPlan.plan.digest, planned.plan.digest)

    const abandoned = runJson(root, [
      'mission',
      'abandon',
      mission.id,
      '--reason=objective is no longer wanted',
      `--confirm=${planned.plan.digest}`,
    ])
    assert.equal(abandoned.status, 'abandoned')
    assert.equal(abandoned.reason, 'objective is no longer wanted')
    assert.equal(abandoned.repository.parent, parent)
    assert.equal(abandoned.delivery, null)
    assert.equal(abandoned.landing, null)
    assert.equal(existsSync(join(missionPath, 'abandoned.md')), true)
    assert.equal(existsSync(join(root, '.specdev', '.ripplegraph', 'runs', mission.run_id)), false)
    assert.equal(existsSync(join(root, '.specdev', '.current')), false)
    assert.equal(git(root, ['status', '--porcelain=v1', '--untracked-files=all']), '')
    assert.equal(git(root, ['rev-parse', 'main']), parent)
    const message = git(root, ['show', '-s', '--format=%B', 'HEAD'])
    assert.match(message, new RegExp(`SpecDev-Mission: ${mission.id}`))
    assert.match(message, /SpecDev-Commit-Type: abandonment/)
    assert.match(message, new RegExp(`SpecDev-Abandonment-Plan: ${planned.plan.digest}`))

    const status = runJson(root, ['mission', 'status', mission.id])
    assert.equal(status.status, 'abandoned')
    assert.equal(status.abandonment.reason, 'objective is no longer wanted')
    assert.equal(status.abandonment.terminal_commit, abandoned.repository.terminal_commit)
    assert.equal(status.delivery, null)
    assert.equal(status.landing, null)
    assert.equal(status.next_action, null)
    const runStatus = runJson(root, ['mission', 'run', mission.id])
    assert.equal(runStatus.status, 'abandoned')
    assert.equal(runStatus.delivery, null)

    const terminalHead = git(root, ['rev-parse', 'HEAD'])
    const retry = runJson(root, [
      'mission',
      'abandon',
      mission.id,
      '--reason=objective is no longer wanted',
      `--confirm=${planned.plan.digest}`,
    ])
    assert.equal(retry.idempotent, true)
    assert.equal(git(root, ['rev-parse', 'HEAD']), terminalHead)
    assert.match(
      runJson(root, ['mission', 'abandon', mission.id, '--reason=a conflicting reason'], 1).error,
      /differs from the immutable abandonment/
    )

    const guarded = [
      ['mission', 'pause', mission.id],
      ['mission', 'migrate', mission.id],
      ['mission', 'checkpoint', mission.id],
      ['mission', 'land', mission.id],
      ['mission', 'handoff', mission.id, '--successor-assignment'],
      ['mission', 'adopt-successor', mission.id, '--assignment=00001'],
      [
        'mission',
        'approve-divergence',
        mission.id,
        '--child=00001',
        `--identity=${'a'.repeat(64)}`,
      ],
      [
        'mission',
        'reject-divergence',
        mission.id,
        '--child=00001',
        `--identity=${'a'.repeat(64)}`,
        '--reason=no',
      ],
      ['reviewloop', 'mission', `--mission=${mission.id}`],
      ['focus', mission.id],
    ]
    for (const args of guarded) {
      assert.match(runJson(root, args, 1).error, /abandoned and immutable/)
      assert.equal(git(root, ['rev-parse', 'HEAD']), terminalHead)
    }
  }

  {
    const { root, mission } = fixture()
    const planned = runJson(root, ['mission', 'abandon', mission.id, '--reason=stale plan'])
    writeFileSync(join(root, 'later.txt'), 'later\n')
    git(root, ['add', 'later.txt'])
    git(root, ['commit', '-m', 'advance mission branch'])
    const changed = runJson(root, [
      'mission',
      'abandon',
      mission.id,
      '--reason=stale plan',
      `--confirm=${planned.plan.digest}`,
    ])
    assert.equal(changed.status, 'plan_changed')
    assert.equal(changed.mutated, false)
    assert.notEqual(changed.plan.digest, planned.plan.digest)
  }

  {
    const { root, mission } = fixture()
    writeFileSync(join(root, 'dirty.txt'), 'dirty\n')
    const dirty = runJson(root, ['mission', 'abandon', mission.id, '--reason=dirty refusal'], 1)
    assert.match(dirty.error, /requires a clean main worktree/)
    assert.equal(existsSync(join(root, '.specdev', 'cache', 'mission-abandon')), false)
  }

  {
    const { root, mission } = fixture()
    git(root, ['switch', 'main'])
    const wrong = runJson(
      root,
      ['mission', 'abandon', mission.id, '--reason=wrong branch refusal'],
      1
    )
    assert.match(wrong.error, /requires checked-out branch/)
  }

  {
    const { root, mission } = fixture()
    const attempt = await createAttemptRecord(join(root, '.specdev'), {
      kind: 'mission-controller',
      mission: mission.id,
      workspace: '.',
    })
    git(root, ['add', '--all'])
    git(root, ['commit', '-m', 'record live controller'])
    await writeLocalProcessMarker(join(root, '.specdev'), attempt.id, {
      pid: process.pid,
      cwd: root,
    })
    const live = runJson(root, ['mission', 'abandon', mission.id, '--reason=live refusal'], 1)
    assert.match(live.error, /live or ambiguous Attempts/)
    assert.match(live.error, /live_local/)
  }

  {
    const context = fixture()
    const { root, mission } = context
    const child = prepareChildWorktree(context)
    const planned = runJson(root, ['mission', 'abandon', mission.id, '--reason=retain child work'])
    assert.equal(planned.plan.retained.child_worktrees.length, 1)
    const abandoned = runJson(root, [
      'mission',
      'abandon',
      mission.id,
      '--reason=retain child work',
      `--confirm=${planned.plan.digest}`,
    ])
    assert.equal(existsSync(child.worktreePath), true)
    assert.equal(git(root, ['rev-parse', child.childBranch]), child.childRevision)
    assert.match(git(root, ['worktree', 'list', '--porcelain']), /slot-01/)
    assert.equal(abandoned.retained.child_worktrees[0].revision, child.childRevision)
  }

  {
    const context = fixture()
    const { root, mission } = context
    const child = prepareChildWorktree(context)
    writeFileSync(join(child.worktreePath, 'dirty-child.txt'), 'dirty\n')
    const dirty = runJson(
      root,
      ['mission', 'abandon', mission.id, '--reason=dirty child refusal'],
      1
    )
    assert.match(dirty.error, /child worktree .* is dirty/)
  }

  for (const boundary of ['terminal-written', 'prepared']) {
    const { root, mission } = fixture()
    const planned = runJson(root, [
      'mission',
      'abandon',
      mission.id,
      `--reason=recover ${boundary}`,
    ])
    const interrupted = runJson(
      root,
      [
        'mission',
        'abandon',
        mission.id,
        `--reason=recover ${boundary}`,
        `--confirm=${planned.plan.digest}`,
        `--interrupt-after=${boundary}`,
      ],
      1
    )
    assert.match(interrupted.error, /simulated interruption/)
    const recovered = runJson(root, [
      'mission',
      'abandon',
      mission.id,
      `--reason=recover ${boundary}`,
      `--confirm=${planned.plan.digest}`,
    ])
    assert.equal(recovered.status, 'abandoned')
    assert.equal(existsSync(join(root, '.specdev', '.ripplegraph', 'runs', mission.run_id)), false)
    assert.equal(git(root, ['status', '--porcelain=v1', '--untracked-files=all']), '')
  }

  console.log('Mission abandonment tests passed.')
} finally {
  for (const root of roots) {
    const worktreePath = join(root, '.specdev', 'worktrees', 'slot-01')
    if (existsSync(worktreePath)) {
      try {
        git(root, ['worktree', 'remove', '--force', worktreePath])
      } catch {
        // A failed assertion may leave incomplete worktree metadata.
      }
    }
    rmSync(root, { recursive: true, force: true })
  }
}
