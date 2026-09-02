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

function gitText(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, `git ${args.join(' ')} failed:\n${result.stderr}`)
  return result.stdout.trim()
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
        verification: [
          {
            command: 'node focused-receipt.js',
            revision: 'working-tree@fixture',
            scope: 'focused receipt fixture',
            status: 'passed',
            duration_ms: 1,
            role: 'authoritative_acceptance',
          },
        ],
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

## Delivered behavior

Completed the focused fixture.

## Deviations

None.

## Unresolved risks

None.

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

function reviewerCount(root) {
  const path = `${root}.fake-reviewer-count`
  return existsSync(path) ? Number(readFileSync(path, 'utf8')) : 0
}

function createFixture(label, implementationMode = 'spawned', implementationReview = 'waived') {
  const root = mkdtempSync(join(tmpdir(), `specdev-implement-recovery-${label}-`))
  roots.push(root)
  const fakeBin = join(root, 'fake-bin')
  mkdirSync(fakeBin)
  const fakeClaude = join(fakeBin, 'claude')
  writeFileSync(
    fakeClaude,
    `#!/bin/sh
prompt=$(cat)
case "$prompt" in
  *"Choose exactly one verdict"*)
    reviewer_file="${root}.fake-reviewer-count"
    reviewer_count=0
    if [ -f "$reviewer_file" ]; then reviewer_count=$(cat "$reviewer_file"); fi
    reviewer_count=$((reviewer_count + 1))
    printf '%s' "$reviewer_count" >"$reviewer_file"
    printf '%s\n' '---' 'verdict: approved' 'material_divergence: false' 'scope_divergence: none' 'procedure_divergence: none' 'evidence_integrity: complete' 'user_reapproval_required: false' '---' '' '## Findings' '' 'No blocking findings in the focused fixture.'
    exit 0
    ;;
esac
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
    `implementation:\n  mode: ${implementationMode}\nworker:\n  provider: claude\n  model: fixture\n  effort: low\n  timeout: 10s\nreviewer:\n  provider: claude\n  model: fixture\n  effort: low\n  timeout: 10s\n`,
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
  runJson(root, [
    'approve',
    'brainstorm',
    `--implementation-review=${implementationReview}`,
    '--json',
  ])
  assert.equal(runJson(root, ['next', '--json']).phase, 'design')
  return { root, assignmentPath, assignment: assignment.path.split('/').pop() }
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
  const conflicting = createFixture('conflicting', 'inline')
  const conflict = runJson(conflicting.root, ['implement', '--spawned', '--json'], 1)
  assert.equal(conflict.status, 'error')
  assert.match(conflict.error, /implementation\.mode=inline conflicts with explicit --spawned/)
  const conflictingStatus = JSON.parse(
    readFileSync(join(conflicting.assignmentPath, 'status.json'), 'utf8')
  )
  assert.equal(conflictingStatus.git_boundary, undefined)
  assert.equal(conflictingStatus.implementation_execution, undefined)

  const inline = createFixture('inline', 'auto')
  const inlineAction = runJson(inline.root, ['implement', '--json'])
  assert.equal(inlineAction.status, 'action_required')
  assert.equal(inlineAction.implementation_execution.configured_mode, 'auto')
  assert.equal(inlineAction.implementation_execution.effective_mode, 'inline')
  assert.equal(inlineAction.implementation_execution.source, 'auto-default')
  assert.equal(inlineAction.implementation_execution.current_owner, 'foreground-agent')
  assert.match(inlineAction.implementation_execution.recovery_action, /foreground agent/)
  assert.equal(inlineAction.foreground.owner, 'foreground-agent')
  assert.match(inlineAction.foreground.obligations.result, /worker-result\.md$/)
  assert.equal(attemptCount(inline.root), 0)
  assert.equal(existsSync(join(inline.root, '.fake-worker-count')), false)

  const inlineStatus = runJson(inline.root, ['status', '--json'])
  assert.equal(inlineStatus.assignment_execution.effective_mode, 'inline')
  assert.equal(inlineStatus.assignment_execution.current_owner, 'foreground-agent')
  const inlineNext = runJson(inline.root, ['next', '--json'])
  assert.equal(inlineNext.assignment_execution.effective_mode, 'inline')
  assert.match(inlineNext.assignment_execution.recovery_action, /foreground agent/)
  const frozenSwitch = runJson(inline.root, ['implement', '--spawned', '--json'], 1)
  assert.match(frozenSwitch.error, /frozen as inline/)

  writeDelivery(inline.assignmentPath)
  const inlineProgressPath = join(inline.assignmentPath, 'implementation', 'progress.json')
  const inlineProgress = JSON.parse(readFileSync(inlineProgressPath, 'utf8'))
  inlineProgress.verification.unshift({
    ...inlineProgress.verification[0],
    scope: 'retained failed authoritative attempt',
    status: 'failed',
  })
  writeFileSync(inlineProgressPath, `${JSON.stringify(inlineProgress, null, 2)}\n`, 'utf8')
  writeWorkerResult(inline.assignmentPath, completedResult())
  mkdirSync(join(inline.root, 'src'))
  writeFileSync(join(inline.root, 'src', 'inline.js'), 'export const inline = true\n', 'utf8')
  const inlineCompleted = runJson(inline.root, ['implement', '--json'])
  assert.equal(inlineCompleted.status, 'completed')
  assert.equal(inlineCompleted.activity.provider_attempts.total, 0)
  assert.equal(inlineCompleted.implementation_execution.effective_mode, 'inline')
  assert.equal(inlineCompleted.receipt.implementation_execution.effective_mode, 'inline')
  assert.equal(inlineCompleted.receipt.verification.raw.total, 2)
  assert.equal(inlineCompleted.receipt.verification.effective.total, 1)
  assert.equal(inlineCompleted.receipt.verification.superseded, 1)
  assert.equal(existsSync(join(inline.root, '.fake-worker-count')), false)

  const explicitSpawned = createFixture('explicit-spawned', 'auto')
  writeDelivery(explicitSpawned.assignmentPath)
  const explicitSpawnedRun = runJson(explicitSpawned.root, [
    'implement',
    '--spawned',
    '--execution-reason=Unattended fixture automation',
    '--json',
  ])
  assert.equal(explicitSpawnedRun.status, 'completed')
  assert.equal(explicitSpawnedRun.activity.provider_attempts.total, 1)
  assert.equal(explicitSpawnedRun.implementation_execution.effective_mode, 'spawned')
  assert.equal(explicitSpawnedRun.implementation_execution.source, 'command')
  assert.equal(explicitSpawnedRun.implementation_execution.reason, 'Unattended fixture automation')
  assert.equal(readFileSync(join(explicitSpawned.root, '.fake-worker-count'), 'utf8'), '1')

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
  mkdirSync(join(completed.root, 'src'))
  writeFileSync(join(completed.root, 'src', 'receipt.js'), 'export const receipt = true\n', 'utf8')
  const recovered = runJson(completed.root, ['implement', '--adopt-dirty', '--json'])
  assert.equal(recovered.status, 'completed')
  assert.equal(recovered.activity.provider_attempts.total, 0)
  assert.equal(existsSync(join(completed.root, '.fake-worker-count')), false)
  assert.equal(recovered.receipt.completeness, 'complete')
  assert.equal(recovered.receipt.contract.review_identity_matches, true)
  assert.equal(recovered.receipt.review.verdict, 'approved')
  assert.equal(recovered.receipt.review.divergence, 'none')
  assert.equal(recovered.receipt.delivery.commit, recovered.delivery.ending_git_commit_hash)
  assert.equal(recovered.receipt.delivery.matching_commit_count, 1)
  assert.deepEqual(recovered.receipt.acceptance.counts, {
    passed: 3,
    failed: 0,
    blocked: 0,
    missing: 0,
  })
  assert.deepEqual(recovered.receipt.verification.counts, {
    passed: 1,
    failed: 0,
    skipped: 0,
    missing: 0,
  })
  assert.deepEqual(recovered.receipt.changed_project_paths.groups, [
    { name: 'src', count: 1, paths: ['src/receipt.js'], omitted: 0 },
  ])
  assert.equal(recovered.receipt.unresolved_risks.status, 'none')
  assert.equal(recovered.receipt.worktree.clean, true)
  const deliveredHead = gitText(completed.root, ['rev-parse', 'HEAD'])
  const deliveredCommitCount = gitText(completed.root, ['rev-list', '--count', 'HEAD'])

  const resumed = runJson(completed.root, [
    'implement',
    `--assignment=${completed.assignment}`,
    '--json',
  ])
  assert.equal(resumed.status, 'completed')
  assert.equal(resumed.recovered, true)
  assert.equal(resumed.delivery.recovered, true)
  assert.deepEqual(resumed.receipt, recovered.receipt)
  assert.equal(gitText(completed.root, ['rev-parse', 'HEAD']), deliveredHead)
  assert.equal(gitText(completed.root, ['rev-list', '--count', 'HEAD']), deliveredCommitCount)
  assert.equal(existsSync(join(completed.root, '.fake-worker-count')), false)

  const human = run(completed.root, ['implement', `--assignment=${completed.assignment}`]).stdout
  assert.match(human, /Assignment complete:/)
  assert.match(human, /Delivery receipt:/)
  assert.match(human, /Evidence: complete/)
  assert.match(human, new RegExp(`Delivery commit: ${deliveredHead}`))
  assert.match(human, /Acceptance: 3 passed, 0 failed, 0 blocked, 0 missing/)
  assert.match(human, /Verification: 1 passed, 0 failed, 0 skipped, 0 missing/)
  assert.match(human, /src \(1\): src\/receipt\.js/)
  assert.match(human, /Worktree: clean/)

  runGit(completed.root, [
    'commit',
    '--quiet',
    '--allow-empty',
    '-m',
    'duplicate delivery evidence fixture',
    '-m',
    `SpecDev-Assignment: ${recovered.receipt.assignment.id}\nSpecDev-Commit-Type: delivery`,
  ])
  const ambiguousHead = gitText(completed.root, ['rev-parse', 'HEAD'])
  const ambiguousCommitCount = gitText(completed.root, ['rev-list', '--count', 'HEAD'])
  const ambiguous = runJson(
    completed.root,
    ['implement', `--assignment=${completed.assignment}`, '--json'],
    1
  )
  assert.equal(ambiguous.status, 'blocked')
  assert.equal(ambiguous.recovery, 'artifact_repair')
  assert.equal(ambiguous.receipt.completeness, 'incomplete')
  assert.equal(ambiguous.receipt.delivery.matching_commit_count, 2)
  assert(ambiguous.receipt.issues.includes('ambiguous_delivery_commit'))
  assert(ambiguous.receipt.issues.includes('ambiguous_git_delivery_boundary'))
  assert.equal(ambiguous.receipt.delivery.commit, ambiguousHead)
  assert.equal(gitText(completed.root, ['rev-list', '--count', 'HEAD']), ambiguousCommitCount)
  assert.equal(existsSync(join(completed.root, '.fake-worker-count')), false)

  rmSync(join(completed.assignmentPath, 'implementation', 'progress.json'))
  const incomplete = runJson(
    completed.root,
    ['implement', `--assignment=${completed.assignment}`, '--json'],
    1
  )
  assert.equal(incomplete.status, 'blocked')
  assert.equal(incomplete.recovery, 'artifact_repair')
  assert.equal(incomplete.receipt.completeness, 'incomplete')
  assert.equal(incomplete.receipt.artifacts.progress.exists, false)
  assert.equal(incomplete.receipt.verification.counts.missing, 1)
  assert(incomplete.receipt.issues.includes('missing_artifact:progress'))
  assert(incomplete.receipt.issues.includes('verification_evidence_missing'))
  assert.equal(incomplete.receipt.delivery.commit, ambiguousHead)
  assert.equal(gitText(completed.root, ['rev-list', '--count', 'HEAD']), ambiguousCommitCount)
  assert.equal(existsSync(join(completed.root, '.fake-worker-count')), false)

  writeDelivery(completed.assignmentPath)
  const nonPassingProgressPath = join(completed.assignmentPath, 'implementation', 'progress.json')
  const nonPassingProgress = JSON.parse(readFileSync(nonPassingProgressPath, 'utf8'))
  nonPassingProgress.verification = [
    { ...nonPassingProgress.verification[0], status: 'failed' },
    {
      ...nonPassingProgress.verification[0],
      command: 'node optional-receipt.js',
      status: 'skipped',
    },
  ]
  writeFileSync(nonPassingProgressPath, `${JSON.stringify(nonPassingProgress, null, 2)}\n`, 'utf8')
  const nonPassingOutcomePath = join(completed.assignmentPath, 'outcome.md')
  writeFileSync(
    nonPassingOutcomePath,
    readFileSync(nonPassingOutcomePath, 'utf8')
      .replace('None.\n\n| Acceptance', '- Manual follow-up remains.\n\n| Acceptance')
      .replace('| AC-1 | Focused fixture | Passed |', '| AC-1 | Focused fixture | Blocked |')
      .replace('| AC-2 | Focused fixture | Passed |', '| AC-2 | Focused fixture | Failed |'),
    'utf8'
  )
  const nonPassing = runJson(
    completed.root,
    ['implement', `--assignment=${completed.assignment}`, '--json'],
    1
  )
  assert.equal(nonPassing.status, 'blocked')
  assert.equal(nonPassing.recovery, 'artifact_repair')
  assert.equal(nonPassing.receipt.completeness, 'incomplete')
  assert.equal(nonPassing.receipt.acceptance.counts.blocked, 1)
  assert.equal(nonPassing.receipt.acceptance.counts.failed, 1)
  assert.equal(nonPassing.receipt.verification.counts.failed, 1)
  assert.equal(nonPassing.receipt.verification.counts.skipped, 1)
  assert.equal(nonPassing.receipt.unresolved_risks.status, 'present')
  assert.deepEqual(nonPassing.receipt.unresolved_risks.items, ['Manual follow-up remains.'])
  assert.equal(gitText(completed.root, ['rev-list', '--count', 'HEAD']), ambiguousCommitCount)
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

  const repairRouting = createFixture('inline-repair', 'auto', 'required')
  assert.equal(runJson(repairRouting.root, ['implement', '--json']).status, 'action_required')
  writeDelivery(repairRouting.assignmentPath)
  writeWorkerResult(repairRouting.assignmentPath, completedResult())
  mkdirSync(join(repairRouting.root, 'src'))
  writeFileSync(
    join(repairRouting.root, 'src', 'repair.js'),
    'export const repair = true\n',
    'utf8'
  )
  const repairOutcomePath = join(repairRouting.assignmentPath, 'outcome.md')
  writeFileSync(
    repairOutcomePath,
    readFileSync(repairOutcomePath, 'utf8').replace(
      '| AC-3 | Focused fixture | Passed |',
      '| AC-3 | Focused fixture | Blocked |'
    ),
    'utf8'
  )
  const inlineRepair = runJson(repairRouting.root, ['implement', '--json'])
  assert.equal(inlineRepair.command, 'implement')
  assert.equal(inlineRepair.status, 'action_required')
  assert.equal(inlineRepair.recovery, 'candidate_preflight_failed')
  assert.equal(inlineRepair.stage, 'implementation')
  assert.equal(inlineRepair.implementation_execution.effective_mode, 'inline')
  assert.equal(inlineRepair.implementation_execution.current_owner, 'foreground-agent')
  assert.equal(inlineRepair.foreground.action, 'repair-preserved-inline-delivery')
  assert.match(
    inlineRepair.foreground.issue,
    /Candidate preflight failed before implementation review/
  )
  assert(inlineRepair.candidate_preflight.issues.includes('acceptance_not_passed'))
  assert.equal(runJson(repairRouting.root, ['next', '--json']).phase, 'implementation')
  assert.equal(
    existsSync(join(repairRouting.assignmentPath, 'review', 'candidate-receipt.json')),
    false
  )
  assert.equal(
    existsSync(join(repairRouting.assignmentPath, 'review', 'implementation-verdict.md')),
    false
  )
  assert.equal(
    existsSync(join(repairRouting.assignmentPath, 'review', 'implementation-state.json')),
    false
  )
  assert.equal(attemptCount(repairRouting.root), 0)
  assert.equal(reviewerCount(repairRouting.root), 0)

  writeFileSync(
    repairOutcomePath,
    readFileSync(repairOutcomePath, 'utf8').replace(
      '| AC-3 | Focused fixture | Blocked |',
      '| AC-3 | Focused fixture | Passed |'
    ),
    'utf8'
  )
  const repairedInline = runJson(repairRouting.root, ['implement', '--json'])
  assert.equal(repairedInline.status, 'approved')
  assert.equal(repairedInline.receipt.completeness, 'complete')
  assert.equal(existsSync(join(repairRouting.root, '.fake-worker-count')), false)
  assert.equal(reviewerCount(repairRouting.root), 1)

  const spawnedPreflight = createFixture('spawned-preflight', 'spawned', 'required')
  writeDelivery(spawnedPreflight.assignmentPath)
  const spawnedOutcomePath = join(spawnedPreflight.assignmentPath, 'outcome.md')
  writeFileSync(
    spawnedOutcomePath,
    readFileSync(spawnedOutcomePath, 'utf8').replace(
      '| AC-3 | Focused fixture | Passed |',
      '| AC-3 | Focused fixture | Blocked |'
    ),
    'utf8'
  )
  const spawnedBlocked = runJson(spawnedPreflight.root, ['implement', '--json'], 1)
  assert.equal(spawnedBlocked.status, 'blocked')
  assert.equal(spawnedBlocked.recovery, 'candidate_preflight_failed')
  assert.equal(spawnedBlocked.stage, 'implementation')
  assert.equal(runJson(spawnedPreflight.root, ['next', '--json']).phase, 'implementation')
  assert.equal(readFileSync(join(spawnedPreflight.root, '.fake-worker-count'), 'utf8'), '1')
  assert.equal(reviewerCount(spawnedPreflight.root), 0)
  assert.equal(
    existsSync(join(spawnedPreflight.assignmentPath, 'implementation', 'worker-result.md')),
    true
  )
  assert.equal(
    existsSync(join(spawnedPreflight.assignmentPath, 'review', 'implementation-state.json')),
    false
  )

  writeFileSync(
    spawnedOutcomePath,
    readFileSync(spawnedOutcomePath, 'utf8').replace(
      '| AC-3 | Focused fixture | Blocked |',
      '| AC-3 | Focused fixture | Passed |'
    ),
    'utf8'
  )
  const spawnedRepaired = runJson(spawnedPreflight.root, ['implement', '--json'])
  assert.equal(spawnedRepaired.status, 'approved')
  assert.equal(readFileSync(join(spawnedPreflight.root, '.fake-worker-count'), 'utf8'), '1')
  assert.equal(reviewerCount(spawnedPreflight.root), 1)

  const resolverRouting = createFixture('inline-resolver', 'auto', 'required')
  assert.equal(runJson(resolverRouting.root, ['implement', '--json']).status, 'action_required')
  writeDelivery(resolverRouting.assignmentPath)
  writeWorkerResult(resolverRouting.assignmentPath, completedResult())
  mkdirSync(join(resolverRouting.root, 'src'))
  writeFileSync(
    join(resolverRouting.root, 'src', 'resolver.js'),
    'export const resolver = true\n',
    'utf8'
  )
  mkdirSync(join(resolverRouting.assignmentPath, 'review'), { recursive: true })
  writeFileSync(
    join(resolverRouting.assignmentPath, 'review', 'implementation-state.json'),
    `${JSON.stringify(
      {
        version: 2,
        mode: 'automatic',
        stage: 'resolver',
        round: 2,
        primary_round: 2,
        history: [],
      },
      null,
      2
    )}\n`,
    'utf8'
  )
  const inlineResolver = runJson(resolverRouting.root, ['implement', '--json'])
  assert.equal(inlineResolver.status, 'action_required')
  assert.equal(inlineResolver.implementation_execution.effective_mode, 'inline')
  assert.equal(inlineResolver.implementation_execution.current_owner, 'foreground-agent')
  assert.match(inlineResolver.foreground.obligations.result, /resolver-result\.md$/)
  assert.equal(attemptCount(resolverRouting.root), 0)
  assert.equal(reviewerCount(resolverRouting.root), 0)

  writeFileSync(
    join(resolverRouting.assignmentPath, 'implementation', 'resolver-result.md'),
    completedResult(),
    'utf8'
  )
  const resolvedInline = runJson(resolverRouting.root, ['implement', '--json'])
  assert.equal(resolvedInline.status, 'approved')
  assert.equal(
    existsSync(join(resolverRouting.assignmentPath, 'implementation', 'resolver-result.md')),
    false
  )
  assert.equal(existsSync(join(resolverRouting.root, '.fake-worker-count')), false)
  assert.equal(reviewerCount(resolverRouting.root), 1)

  console.log('implement recovery tests passed')
} finally {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true })
    rmSync(`${root}.fake-reviewer-count`, { force: true })
  }
}
