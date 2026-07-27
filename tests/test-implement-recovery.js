import assert from 'node:assert/strict'
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const repoRoot = resolve(import.meta.dirname, '..')
const bin = join(repoRoot, 'bin', 'specdev.js')
const roots = []

function run(root, args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      CODEX_SANDBOX: '',
      NO_COLOR: '1',
      PATH: `${join(root, 'fake-bin')}:${process.env.PATH}`,
    },
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

function runGit(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, `git ${args.join(' ')} failed:\n${result.stderr}`)
}

function writeContract(path) {
  writeFileSync(
    join(path, 'brainstorm', 'contract.md'),
    `# Assignment contract

## Objective and context

Exercise preserved implementation-worker recovery.

## Scope and non-goals

- In scope: recovery classification and provider-attempt counts
- Non-goals: implementation review behavior

## Expected behavior

SpecDev reuses valid preserved delivery and blocks invalid preserved delivery.

## Important decisions

Only explicit retry authority replaces a preserved worker result.

## Constraints and invariants

Recovery does not move the graph or create an Attempt unless authorized.

## Delegated and reserved authority

- Delegated: fixture artifact contents
- Reserved for the user: provider retry authority

## Risks and assumptions

The fake provider returns a strict completed result.

## Verification authority

- Focused command checks are allowed.

## Acceptance criteria

- AC-1: Valid completed artifacts advance without a provider Attempt.
- AC-2: Non-reusable preserved results block without a provider Attempt.
- AC-3: Explicit retry and absent-result paths launch one provider Attempt.
`,
    'utf8'
  )
}

function writeDelivery(path) {
  mkdirSync(join(path, 'design'), { recursive: true })
  mkdirSync(join(path, 'implementation'), { recursive: true })
  writeFileSync(
    join(path, 'design', 'plan.md'),
    `# Plan

**Implementation Guides:** []
**Review Guides:** []

## Tasks

1. T-1 covers AC-1, AC-2, and AC-3.
`,
    'utf8'
  )
  writeFileSync(
    join(path, 'implementation', 'progress.json'),
    `${JSON.stringify(
      {
        version: 1,
        tasks: [{ id: 'T-1', status: 'completed' }],
        selected_guides: { implementation: [], review: [] },
        verification: [],
        deviations: [],
        follow_up: 'none',
      },
      null,
      2
    )}\n`,
    'utf8'
  )
  writeFileSync(
    join(path, 'outcome.md'),
    `# Outcome

| Acceptance | Evidence | Result |
| --- | --- | --- |
| AC-1 | Focused fixture | Passed |
| AC-2 | Focused fixture | Passed |
| AC-3 | Focused fixture | Passed |
`,
    'utf8'
  )
}

function writeWorkerResult(path, content) {
  mkdirSync(join(path, 'implementation'), { recursive: true })
  writeFileSync(join(path, 'implementation', 'worker-result.md'), content, 'utf8')
}

function attemptCount(root) {
  const processes = join(root, '.specdev', 'processes')
  return existsSync(processes)
    ? readdirSync(processes).filter((name) => name.endsWith('.yaml')).length
    : 0
}

function completedResult() {
  return `---
status: completed
revision: null
follow_up: none
---

## Changes

Completed the focused recovery fixture.
`
}

function blockedResult() {
  return `---
status: blocked
revision: null
follow_up: required
---

## Changes

Preserved work requires user resolution.
`
}

function createFixture(label) {
  const root = mkdtempSync(join(tmpdir(), `specdev-implement-recovery-${label}-`))
  roots.push(root)
  const fakeBin = join(root, 'fake-bin')
  mkdirSync(fakeBin)
  const fakeClaude = join(fakeBin, 'claude')
  writeFileSync(
    fakeClaude,
    `#!/bin/sh
cat >/dev/null
count_file="${root}/.fake-worker-count"
count=0
if [ -f "$count_file" ]; then count=$(cat "$count_file"); fi
count=$((count + 1))
printf '%s' "$count" >"$count_file"
printf '%s\\n' '---' 'status: completed' 'revision: null' 'follow_up: none' '---' '' '## Changes' '' 'Fake worker completed the recovery fixture.'
`,
    'utf8'
  )
  chmodSync(fakeClaude, 0o755)

  runGit(root, ['init', '--quiet'])
  runGit(root, ['config', 'user.name', 'SpecDev Test'])
  runGit(root, ['config', 'user.email', 'specdev@example.test'])
  runJson(root, ['init', '--platform=none', '--json'])
  writeFileSync(
    join(root, '.specdev', 'project_notes', 'big_picture.md'),
    '# Project Big Picture\n\n## Overview\n\nA temporary repository for focused recovery checks.\n\n## Architecture\n\nSpecDev drives isolated Node.js CLI fixtures with a fake provider.\n',
    'utf8'
  )
  writeFileSync(
    join(root, '.specdev', 'agents.yaml'),
    'worker:\n  provider: claude\n  model: fixture\n  effort: low\n  timeout: 10s\nreviewer:\n  provider: claude\n  model: fixture\n  effort: low\n  timeout: 10s\n',
    'utf8'
  )
  runGit(root, ['add', '--all'])
  runGit(root, ['commit', '--quiet', '-m', 'initialize recovery fixture'])

  const assignment = runJson(root, [
    'assignment',
    `Exercise ${label} recovery`,
    `--slug=${label}-recovery`,
    '--json',
  ])
  const assignmentPath = join(root, assignment.path)
  writeContract(assignmentPath)
  runJson(root, ['checkpoint', 'brainstorm', '--json'])
  runJson(root, ['approve', 'brainstorm', '--implementation-review=waived', '--json'])
  assert.equal(runJson(root, ['next', '--json']).phase, 'design')
  return { root, assignmentPath }
}

function assertPreservedBlock({ root, assignmentPath, expectedRecovery, diagnostic }) {
  const resultPath = join(assignmentPath, 'implementation', 'worker-result.md')
  const preserved = readFileSync(resultPath, 'utf8')
  const blocked = runJson(root, ['implement', '--json'], 1)
  assert.equal(blocked.status, 'blocked')
  assert.equal(blocked.recovery, expectedRecovery)
  assert.match(blocked.diagnostic, diagnostic)
  assert.match(blocked.next_action, /rerun specdev implement/)
  assert.match(blocked.next_action, /specdev implement --retry-worker/)
  assert.equal(readFileSync(resultPath, 'utf8'), preserved)
  assert.equal(runJson(root, ['next', '--json']).phase, 'design')
  assert.equal(attemptCount(root), 0)
  assert.equal(existsSync(join(root, '.fake-worker-count')), false)
}

try {
  const blocked = createFixture('blocked')
  writeWorkerResult(blocked.assignmentPath, blockedResult())
  assertPreservedBlock({
    ...blocked,
    expectedRecovery: 'blocked',
    diagnostic: /reports status: blocked/,
  })

  const malformed = createFixture('malformed')
  writeWorkerResult(malformed.assignmentPath, 'not a result envelope\n')
  assertPreservedBlock({
    ...malformed,
    expectedRecovery: 'malformed',
    diagnostic: /must start with YAML frontmatter/,
  })

  const invalid = createFixture('invalid')
  writeWorkerResult(invalid.assignmentPath, completedResult())
  assertPreservedBlock({
    ...invalid,
    expectedRecovery: 'invalid',
    diagnostic: /design[/\\]plan\.md/,
  })

  const completed = createFixture('completed')
  writeDelivery(completed.assignmentPath)
  writeWorkerResult(completed.assignmentPath, completedResult())
  const recovered = runJson(completed.root, ['implement', '--json'])
  assert.equal(recovered.status, 'completed')
  assert.equal(recovered.activity.provider_attempts.total, 0)
  assert.equal(existsSync(join(completed.root, '.fake-worker-count')), false)

  const retried = createFixture('retry')
  writeDelivery(retried.assignmentPath)
  writeWorkerResult(retried.assignmentPath, 'not a result envelope\n')
  const replacement = runJson(retried.root, ['implement', '--retry-worker', '--json'])
  assert.equal(replacement.status, 'completed')
  assert.equal(replacement.activity.provider_attempts.total, 1)
  assert.equal(readFileSync(join(retried.root, '.fake-worker-count'), 'utf8'), '1')

  const absent = createFixture('absent')
  writeDelivery(absent.assignmentPath)
  const initial = runJson(absent.root, ['implement', '--json'])
  assert.equal(initial.status, 'completed')
  assert.equal(initial.activity.provider_attempts.total, 1)
  assert.equal(readFileSync(join(absent.root, '.fake-worker-count'), 'utf8'), '1')

  console.log('implement recovery tests passed')
} finally {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
}
