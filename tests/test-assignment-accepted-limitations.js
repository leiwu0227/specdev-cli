import fse from 'fs-extra'
import { closeAcceptedAssignment } from '../src/commands/assignment-accepted-close.js'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const repoRoot = resolve(import.meta.dirname, '..')
const bin = join(repoRoot, 'bin', 'specdev.js')
const roots = []

function tempProject() {
  const root = mkdtempSync(join(tmpdir(), 'specdev-assignment-accepted-'))
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

function candidate() {
  const root = tempProject()
  const assignment = createApprovedAssignment(root)
  runJson(root, ['implement', '--json'])
  const path = join(root, assignment.path)
  mkdirSync(join(path, 'implementation'), { recursive: true })
  mkdirSync(join(path, 'design'), { recursive: true })
  writeFileSync(
    join(path, 'design/plan.md'),
    '# Plan\n\n**Implementation Guides:** []\n**Review Guides:** []\n\n## Tasks\n\n1. T-1 covers AC-1.\n'
  )
  writeFileSync(
    join(path, 'implementation/progress.json'),
    JSON.stringify({
      version: 1,
      tasks: [{ id: 'T-1', status: 'completed' }],
      selected_guides: { implementation: [], review: [] },
      verification: [
        {
          command: 'node fixture.js',
          revision: 'working-tree@fixture',
          scope: 'fixture',
          status: 'failed',
          duration_ms: 1,
          role: 'authoritative_acceptance',
        },
      ],
      deviations: [],
      follow_up: 'none',
    })
  )
  writeFileSync(
    join(path, 'implementation/worker-result.md'),
    '---\nstatus: completed\nrevision: null\nfollow_up: none\n---\n\n## Changes\n\nPartial delivery.\n'
  )
  writeFileSync(
    join(path, 'outcome.md'),
    '# Outcome\n\n## Delivered behavior\n\nPartial result.\n\n## Deviations\n\nNone.\n\n## Unresolved risks\n\nVerification failed.\n\n| Acceptance | Evidence | Result |\n| --- | --- | --- |\n| AC-1 | fixture | Blocked |\n'
  )
  writeFileSync(join(root, 'baseline.txt'), 'partial delivery\n')
  const evidence = `${assignment.path}/acceptance.md`
  writeFileSync(
    join(root, evidence),
    'The user explicitly accepts this delivery with failed AC-1 verification and no independent implementation review.\n'
  )
  const args = [
    'assignment',
    'close',
    assignment.id,
    '--outcome=accepted-with-limitations',
    `--evidence=${evidence}`,
    '--json',
  ]
  return { root, assignment, path, args }
}
try {
  const { root, assignment, path, args } = candidate()
  const preflight = runJson(root, ['implement', '--json'])
  assert(
    preflight.candidate_preflight?.issues.includes('acceptance_not_passed'),
    JSON.stringify(preflight)
  )
  const preserved = [
    'brainstorm/contract.md',
    'outcome.md',
    'implementation/progress.json',
    'implementation/worker-result.md',
  ].map((p) => [p, readFileSync(join(path, p), 'utf8')])
  const before = git(root, ['status', '--porcelain'])
  const plan = runJson(root, args).plan
  assert.equal(git(root, ['status', '--porcelain']), before)
  assert.equal(plan.candidate.completeness, 'incomplete')
  writeFileSync(join(root, 'baseline.txt'), 'different bytes\n')
  assert.match(runJson(root, [...args, `--confirm=${plan.digest}`], 1).error, /Stale/)
  writeFileSync(join(root, 'baseline.txt'), 'partial delivery\n')
  const contract = join(path, 'brainstorm/contract.md'),
    contractBytes = readFileSync(contract)
  writeFileSync(contract, Buffer.concat([contractBytes, Buffer.from('\nChanged contract.\n')]))
  assert.match(runJson(root, [...args, `--confirm=${plan.digest}`], 1).error, /contract|approval/i)
  writeFileSync(contract, contractBytes)
  const statusPath = join(path, 'status.json'),
    source = JSON.parse(readFileSync(statusPath))
  writeFileSync(statusPath, JSON.stringify({ ...source, mission: { id: 'M99999' } }))
  assert.match(runJson(root, args, 1).error, /Mission children/)
  writeFileSync(statusPath, JSON.stringify(source, null, 2) + '\n')
  const processes = join(root, '.specdev/processes')
  mkdirSync(processes, { recursive: true })
  const attempt = join(processes, 'Attempt-999.yaml')
  writeFileSync(
    attempt,
    `id: Attempt-999\nkind: worker\nstatus: running\nworkspace: .\nassignment: ${assignment.id}\n`
  )
  assert.match(runJson(root, args, 1).error, /live|unverified|Attempt/i)
  const markerDir = join(root, '.specdev/cache/processes')
  mkdirSync(markerDir, { recursive: true })
  const markerPath = join(markerDir, 'Attempt-999.json')
  writeFileSync(markerPath, JSON.stringify({ attempt: 'Attempt-999', pid: process.pid, cwd: root }))
  assert.match(runJson(root, args, 1).error, /live|Attempt/i)
  writeFileSync(markerPath, JSON.stringify({ attempt: 'Attempt-999', pid: 2147483647, cwd: root }))
  const focusPath = join(root, '.specdev/.current'),
    focusBytes = readFileSync(focusPath)
  writeFileSync(focusPath, 'kind: assignment\nid: "99999"\n')
  assert.match(runJson(root, args, 1).error, /focus|active/i)
  writeFileSync(focusPath, focusBytes)
  const notePath = join(root, plan.evidence_source),
    noteBytes = readFileSync(notePath)
  writeFileSync(notePath, 'Different acceptance limitations.\n')
  assert.match(runJson(root, [...args, '--confirm=' + plan.digest], 1).error, /Stale/)
  writeFileSync(notePath, noteBytes)
  const unrelated = join(root, '.specdev/project_notes/thoughts/unrelated.md')
  mkdirSync(join(root, '.specdev/project_notes/thoughts'), { recursive: true })
  writeFileSync(unrelated, 'Unrelated note\n')
  const currentPlan = runJson(root, args).plan
  const logPath = join(root, `.specdev/.ripplegraph/runs/${assignment.run_id}/transition-log.jsonl`)
  const logBefore = readFileSync(logPath, 'utf8')
  const closed = runJson(root, [...args, `--confirm=${currentPlan.digest}`])
  assert.equal(closed.status, 'closed')
  assert.match(readFileSync(attempt, 'utf8'), /status: interrupted/)
  assert.equal(closed.verification, 'incomplete')
  assert.equal(closed.review, 'not_claimed')
  for (const [p, bytes] of preserved) assert.equal(readFileSync(join(path, p), 'utf8'), bytes)
  assert(readFileSync(logPath, 'utf8').startsWith(logBefore))
  assert.equal(readFileSync(unrelated, 'utf8'), 'Unrelated note\n')
  assert(
    !closed.repository.committed_paths.includes('.specdev/project_notes/thoughts/unrelated.md')
  )
  assert.equal(readFileSync(join(root, 'baseline.txt'), 'utf8'), 'partial delivery\n')
  assert.equal(
    runJson(root, [...args, `--confirm=${currentPlan.digest}`]).repository.terminal_commit,
    closed.repository.terminal_commit
  )
  run(root, ['focus', assignment.id], 1)
  run(root, ['assignment', 'shelf', assignment.id, '--reason=later'], 1)
  rmSync(unrelated)
  const adhoc = runJson(root, ['adhoc', 'start', 'Follow-up bounded change', '--json'])
  assert.equal(adhoc.status, 'started')
  runJson(root, ['adhoc', 'cancel', '--json'])
  assert.equal(
    runJson(root, [...args, `--confirm=${currentPlan.digest}`]).repository.terminal_commit,
    closed.repository.terminal_commit
  )
  for (const phase of ['artifact', 'focus']) {
    const fixture = candidate()
    const preview = runJson(fixture.root, fixture.args).plan
    const method = phase === 'artifact' ? 'writeFile' : 'remove'
    const original = fse[method]
    const log = console.log
    try {
      fse[method] = async (...input) => {
        if (String(input[0]).endsWith(phase === 'artifact' ? '/closure.md' : '/.current'))
          throw new Error('Simulated I/O interruption')
        return original(...input)
      }
      console.log = () => {}
      const result = await closeAcceptedAssignment(
        fixture.root,
        join(fixture.root, '.specdev'),
        fixture.assignment.id,
        { json: true, evidence: preview.evidence_source, confirm: preview.digest }
      )
      assert.match(result.error, /Simulated/)
    } finally {
      fse[method] = original
      console.log = log
      process.exitCode = 0
    }
    assert.equal(JSON.parse(readFileSync(join(fixture.path, 'status.json'))).status, 'closing')
    for (const command of [
      ['implement'],
      ['approve', 'brainstorm'],
      ['checkpoint', 'brainstorm'],
      ['reviewloop', 'implementation'],
    ])
      run(fixture.root, [...command, '--assignment=' + fixture.assignment.id], 1)
    const progressPath = join(fixture.path, 'implementation/progress.json')
    const progressBytes = readFileSync(progressPath)
    writeFileSync(progressPath, Buffer.concat([progressBytes, Buffer.from(' ')]))
    assert.match(
      runJson(fixture.root, [...fixture.args, '--confirm=' + preview.digest], 1).error,
      /changed/
    )
    writeFileSync(progressPath, progressBytes)
    const recovered = runJson(fixture.root, [...fixture.args, '--confirm=' + preview.digest])
    assert.equal(recovered.status, 'closed')
  }
  const complete = candidate()
  const progressPath = join(complete.path, 'implementation/progress.json')
  const progress = JSON.parse(readFileSync(progressPath))
  progress.verification[0].status = 'passed'
  writeFileSync(progressPath, JSON.stringify(progress))
  const outcomePath = join(complete.path, 'outcome.md')
  writeFileSync(
    outcomePath,
    readFileSync(outcomePath, 'utf8')
      .replace('Verification failed.', 'None.')
      .replace('| Blocked |', '| Passed |')
  )
  assert.match(runJson(complete.root, complete.args, 1).error, /complete/)
  console.log('Assignment accepted-with-limitations checks passed')
} finally {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
}
