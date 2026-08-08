import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const repoRoot = resolve(import.meta.dirname, '..')
const bin = join(repoRoot, 'bin', 'specdev.js')
const roots = []

function tempProject() {
  const root = mkdtempSync(join(tmpdir(), 'specdev-assignment-unsupported-'))
  roots.push(root)
  git(root, ['init', '--quiet'])
  git(root, ['config', 'user.name', 'SpecDev Test'])
  git(root, ['config', 'user.email', 'specdev@example.invalid'])
  runJson(root, ['init', '--platform=none', '--json'])
  writeFileSync(
    join(root, '.specdev', 'project_notes', 'big_picture.md'),
    '# Project Big Picture\n\n## Overview\nFocused unsupported-close fixture with durable project context.\n\n## Tech Stack\nNode.js and JSON files with no external services.\n',
    'utf8'
  )
  mkdirSync(join(root, '.specdev', '.ripplegraph'), { recursive: true })
  writeFileSync(
    join(root, '.specdev', '.ripplegraph', 'current.json'),
    '{\n  "focusedRunId": null\n}',
    'utf8'
  )
  writeFileSync(join(root, 'baseline.txt'), 'baseline\n', 'utf8')
  commitAll(root, 'fixture baseline')
  return root
}

function createApprovedAssignment(root) {
  runJson(root, ['do', 'start an assignment'])
  const assignment = runJson(root, ['assignment', 'Investigate provider capability', '--json'])
  writeFileSync(
    join(root, assignment.path, 'brainstorm', 'contract.md'),
    `# Assignment contract

Kind: change

## Objective and context

Determine whether the fixture provider supports historical valuation.

## Scope and non-goals

- In scope: provider capability evidence.
- Non-goals: product delivery.

## Expected behavior

Record an attributable conclusion.

## Important decisions

Negative evidence is a valid terminal result.

## Constraints and invariants

Do not claim product delivery.

## Delegated and reserved authority

- Delegated: inspect evidence.
- Reserved for the user: declare unsupported.

## Risks and assumptions

Provider behavior may change later.

## Verification authority

- Focused tests are allowed after repository instructions are satisfied.

## Acceptance criteria

- AC-1: Written provider evidence supports the conclusion.
`,
    'utf8'
  )
  runJson(root, ['checkpoint', 'brainstorm', '--json'])
  runJson(root, ['approve', 'brainstorm', '--json'])
  const status = JSON.parse(readFileSync(join(root, assignment.path, 'status.json'), 'utf8'))
  return { ...assignment, run_id: status.run_id }
}

function run(root, args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  })
  assert.equal(
    result.status,
    expectedStatus,
    `${args.join(' ')} exited ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  )
  return result
}

function runJson(root, args, expectedStatus = 0) {
  return JSON.parse(run(root, args, expectedStatus).stdout)
}

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, `git ${args.join(' ')} failed:\n${result.stderr}`)
  return result.stdout.trim()
}

function commitAll(root, message) {
  git(root, ['add', '-A'])
  git(root, ['commit', '--quiet', '-m', message])
}

try {
  const root = tempProject()
  const assignment = createApprovedAssignment(root)
  const assignmentPath = join(root, assignment.path)
  const evidence = `${assignment.path}/investigation.md`
  writeFileSync(
    join(root, evidence),
    '# Provider investigation\n\nAuthenticated capability discovery exposes no historical valuation operation.\n',
    'utf8'
  )

  assert.match(
    runJson(root, ['assignment', 'close', assignment.id, '--outcome=unsupported', '--json'], 1)
      .error,
    /requires --reason/
  )
  assert.match(
    runJson(
      root,
      [
        'assignment',
        'close',
        assignment.id,
        '--outcome=unsupported',
        '--reason=no provider operation',
        '--json',
      ],
      1
    ).error,
    /requires attributable written evidence/
  )

  const processDir = join(root, '.specdev', 'processes')
  const markerDir = join(root, '.specdev', 'cache', 'processes')
  mkdirSync(processDir, { recursive: true })
  mkdirSync(markerDir, { recursive: true })
  writeFileSync(
    join(processDir, 'Attempt-999.yaml'),
    `id: Attempt-999\nkind: worker\nstatus: running\nworkspace: .\nstarted_at: 2026-08-08T00:00:00.000Z\nassignment: ${assignment.name}\n`,
    'utf8'
  )
  writeFileSync(
    join(markerDir, 'Attempt-999.json'),
    JSON.stringify({ attempt: 'Attempt-999', pid: process.pid, cwd: root }),
    'utf8'
  )
  assert.match(
    runJson(
      root,
      [
        'assignment',
        'close',
        assignment.id,
        '--outcome=unsupported',
        '--reason=no provider operation',
        `--evidence=${evidence}`,
        '--json',
      ],
      1
    ).error,
    /live or ambiguous Attempts/
  )
  rmSync(join(processDir, 'Attempt-999.yaml'))
  rmSync(join(markerDir, 'Attempt-999.json'))

  const discussionPath = join(root, '.specdev', 'discussions', 'D00099_concurrent', 'brainstorm')
  mkdirSync(discussionPath, { recursive: true })
  writeFileSync(join(discussionPath, 'proposal.md'), '# Concurrent discussion\n', 'utf8')
  writeFileSync(join(root, 'unrelated.txt'), 'leave me alone\n', 'utf8')

  const plan = runJson(
    root,
    [
      'assignment',
      'close',
      assignment.id,
      '--outcome=unsupported',
      '--reason=no provider operation',
      `--evidence=${evidence}`,
      '--json',
    ],
    1
  )
  assert.equal(plan.state, 'confirmation_required')
  assert.equal(plan.confirmation.decision, 'snapshot=owned')
  assert.match(plan.plan.head, /^[a-f0-9]{40}$/)
  assert.equal(plan.plan.contract.hash.length, 64)
  assert.deepEqual(
    plan.plan.evidence.map((item) => item.path),
    [evidence]
  )
  assert.ok(plan.plan.owned_paths.includes(evidence))
  assert.ok(plan.plan.owned_paths.includes('.specdev/.ripplegraph/current.json'))
  assert.ok(plan.plan.prospective_paths.includes('.specdev/.ripplegraph/current.json'))
  assert.ok(plan.plan.compacted_paths.some((path) => path.includes(assignment.run_id)))
  assert.equal(
    plan.plan.excluded_paths.find((item) => item.path === 'unrelated.txt').owner,
    'unattributed repository work'
  )
  assert.equal(
    plan.plan.excluded_paths.find((item) => item.path.endsWith('proposal.md')).owner,
    'Discussion D00099'
  )

  const preCloseHead = git(root, ['rev-parse', 'HEAD'])
  const statusBeforeStaleConfirmation = readFileSync(join(assignmentPath, 'status.json'), 'utf8')
  writeFileSync(join(root, evidence), '# Provider investigation\n\nEvidence changed.\n', 'utf8')
  const stale = runJson(
    root,
    [
      'assignment',
      'close',
      assignment.id,
      '--outcome=unsupported',
      '--reason=no provider operation',
      `--evidence=${evidence}`,
      '--snapshot=owned',
      '--json',
    ],
    1
  )
  assert.equal(stale.state, 'plan_changed')
  assert.equal(
    readFileSync(join(assignmentPath, 'status.json'), 'utf8'),
    statusBeforeStaleConfirmation
  )
  assert.equal(git(root, ['rev-parse', 'HEAD']), preCloseHead)
  assert.equal(existsSync(join(assignmentPath, 'unsupported.md')), false)

  const closed = runJson(root, [
    'assignment',
    'close',
    assignment.id,
    '--outcome=unsupported',
    '--reason=no provider operation',
    `--evidence=${evidence}`,
    '--snapshot=owned',
    '--json',
  ])
  assert.equal(closed.status, 'unsupported')
  assert.equal(closed.immutable, true)
  assert.equal(closed.repository.parent, preCloseHead)
  assert.equal(git(root, ['rev-parse', `${closed.repository.terminal_commit}^`]), preCloseHead)
  assert.equal(git(root, ['rev-list', '--count', `${preCloseHead}..HEAD`]), '1')
  const committedPaths = git(root, [
    'diff-tree',
    '--no-commit-id',
    '--name-only',
    '-r',
    closed.repository.terminal_commit,
  ]).split('\n')
  assert.deepEqual(committedPaths.sort(), [...closed.repository.committed_paths].sort())
  assert.equal(committedPaths.includes('.specdev/.ripplegraph/current.json'), false)
  assert.equal(committedPaths.includes('unrelated.txt'), false)
  assert.equal(
    committedPaths.some((path) => path.includes('D00099')),
    false
  )
  assert.match(
    git(root, ['show', '-s', '--format=%B', closed.repository.terminal_commit]),
    /SpecDev-Commit-Type: unsupported-terminal/
  )
  assert.equal(existsSync(join(assignmentPath, 'unsupported.md')), true)
  assert.equal(existsSync(join(root, '.specdev', '.ripplegraph', 'runs', assignment.run_id)), false)
  assert.equal(existsSync(join(root, '.specdev', '.current')), false)
  assert.equal(
    readFileSync(join(root, '.specdev', '.ripplegraph', 'current.json'), 'utf8'),
    '{\n  "focusedRunId": null\n}'
  )
  assert.equal(existsSync(join(root, 'unrelated.txt')), true)
  assert.equal(existsSync(join(discussionPath, 'proposal.md')), true)

  const status = runJson(root, ['status', '--json'])
  assert.equal(status.lifecycle, 'idle')
  assert.equal(status.focus, null)
  assert.equal(status.last_workflow.id, assignment.id)
  assert.equal(status.last_workflow.status, 'unsupported')
  assert.ok(status.dirty_owners.some((group) => group.owner === 'Discussion D00099'))
  const history = runJson(root, ['status', '--history', '--json'])
  assert.equal(history.assignment_history[0].id, assignment.id)

  const retry = runJson(root, [
    'assignment',
    'close',
    assignment.id,
    '--outcome=unsupported',
    '--json',
  ])
  assert.equal(retry.idempotent, true)
  assert.equal(retry.repository.terminal_commit, closed.repository.terminal_commit)
  assert.equal(git(root, ['rev-list', '--count', `${preCloseHead}..HEAD`]), '1')

  const successor = runJson(root, ['assignment', `--from-assignment=${assignment.id}`, '--json'])
  assert.notEqual(successor.id, assignment.id)
  assert.equal(successor.predecessor_assignment.disposition, 'unsupported')
  assert.equal(successor.predecessor_assignment.closure_commit, closed.repository.terminal_commit)
  const successorContract = readFileSync(
    join(root, successor.path, 'brainstorm', 'contract.md'),
    'utf8'
  )
  assert.match(successorContract, /Unsupported handoff \(historical, not current authority\)/)
  assert.match(successorContract, /new contract|not restored/)
  const sourceStatus = JSON.parse(readFileSync(join(assignmentPath, 'status.json'), 'utf8'))
  assert.equal(sourceStatus.status, 'unsupported')

  console.log('assignment unsupported tests passed')
} finally {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
}
