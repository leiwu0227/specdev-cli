import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { stepGuidedNode } from '../src/utils/engine-sync.js'
import { missionChildDisposition, missionChildFollowUp } from '../src/utils/mission.js'

const repoRoot = resolve(import.meta.dirname, '..')
const bin = join(repoRoot, 'bin', 'specdev.js')
const root = mkdtempSync(join(tmpdir(), 'specdev-reviewloop-modes-'))
const fakeBin = join(root, 'fake-bin')

function run(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      CODEX_SANDBOX: '',
      NO_COLOR: '1',
      PATH: `${fakeBin}:${process.env.PATH}`,
    },
  })
  assert.equal(
    result.status,
    expectedStatus,
    `${args.join(' ')} exited ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  )
  return result
}

function runJson(args, expectedStatus = 0) {
  const result = run(args, expectedStatus)
  return JSON.parse(result.stdout)
}

function writeContract(path, objective) {
  writeFileSync(
    join(path, 'brainstorm', 'contract.md'),
    `# Assignment contract

## Objective and context

${objective}

## Scope and non-goals

- In scope: review command behavior
- Non-goals: product implementation

## Expected behavior

The selected review mode completes its bounded command path.

## Important decisions

Use a deterministic fake reviewer.

## Constraints and invariants

Keep user approval reserved.

## Delegated and reserved authority

- Delegated: focused review execution
- Reserved for the user: contract approval

## Risks and assumptions

The fake provider returns a strict review envelope.

## Verification authority

- Focused command checks are allowed.

## Acceptance criteria

- AC-1: The review command returns a structured result.
`,
    'utf8'
  )
}

function writeMissionContract(path) {
  writeContract(path, 'Exercise interactive Mission Brainstorm review')
  const contractPath = join(path, 'brainstorm', 'contract.md')
  writeFileSync(
    contractPath,
    `${readFileSync(contractPath, 'utf8')}

## Mission execution shape

- Initial child plan: single
- Split reason: none

## Final integrated verification

- Command: \`node --check package.json\`
`,
    'utf8'
  )
}

function writeDiscussion(path) {
  writeFileSync(
    join(path, 'brainstorm', 'proposal.md'),
    '# Proposal\n\nInspect the bounded review command behavior without changing product code.\n',
    'utf8'
  )
  writeFileSync(
    join(path, 'brainstorm', 'design.md'),
    '# Design\n\nUse a deterministic fake reviewer for two explicit invocations.\n',
    'utf8'
  )
}

function writeImplementationDelivery(path) {
  mkdirSync(join(path, 'design'), { recursive: true })
  mkdirSync(join(path, 'implementation'), { recursive: true })
  writeFileSync(
    join(path, 'design', 'plan.md'),
    '# Implementation plan\n\n**Implementation Guides:** []\n\n**Review Guides:** []\n\n## Tasks\n\n1. **T-1 — Exercise repair convergence (AC-1).** Preserve the invalid artifact for the bounded-repair fixture.\n',
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
            command: 'node focused-repair-check.js',
            revision: 'working-tree@fixture',
            scope: 'AC-1 bounded repair fixture',
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
    '# Outcome\n\n## Delivered behavior\n\nFixture delivery.\n\n## Deviations\n\nNone.\n\n## Unresolved risks\n\nNone.\n\n| Acceptance | Evidence | Result |\n| --- | --- | --- |\n| AC-1 | Focused fixture. | Passed |\n',
    'utf8'
  )
}

function mutateDuringNextReview(relativePath) {
  writeFileSync(join(root, '.git', 'specdev-review-mutation'), relativePath, 'utf8')
}

try {
  mkdirSync(fakeBin)
  const fakeClaude = join(fakeBin, 'claude')
  writeFileSync(
    fakeClaude,
    `#!/bin/sh
prompt=$(cat)
case "$prompt" in
  *"Continue the existing Assignment"*)
    repair_count_file="${root}.repair-count"
    repair_count=0
    if [ -f "$repair_count_file" ]; then repair_count=$(cat "$repair_count_file"); fi
    repair_count=$((repair_count + 1))
    printf '%s' "$repair_count" >"$repair_count_file"
    printf '%s\n' '---' 'status: completed' 'revision: null' 'follow_up: none' '---' '' '## Changes' '' 'Preserved the fixture artifacts without repairing them.'
    exit 0
    ;;
  *"evidence-only-follow-up"*)
    printf '%s\n' '---' 'verdict: approved' 'material_divergence: false' 'scope_divergence: none' 'procedure_divergence: none' 'evidence_integrity: complete' 'user_reapproval_required: false' '---' '' '## Findings' '' 'The authorized negative observation is complete and requires bounded follow-up.'
    exit 0
    ;;
esac
count_file="${root}.review-count"
count=0
if [ -f "$count_file" ]; then count=$(cat "$count_file"); fi
count=$((count + 1))
printf '%s' "$count" >"$count_file"
mutation_file="${root}/.git/specdev-review-mutation"
if [ -f "$mutation_file" ]; then
  mutation_path=$(cat "$mutation_file")
  printf '%s\n' 'review-time mutation' >>"${root}/$mutation_path"
  rm "$mutation_file"
fi
if [ "$count" -le 2 ]; then
  printf '%s\n' '---' 'verdict: needs_changes' 'material_divergence: false' '---' '' '## Findings' '' 'Focused fixture finding.'
else
  printf '%s\n' '---' 'verdict: approved' 'material_divergence: false' '---' '' '## Findings' '' 'No blocking findings.'
fi
`
  )
  chmodSync(fakeClaude, 0o755)

  spawnSync('git', ['init', '--quiet'], { cwd: root, encoding: 'utf8' })
  runJson(['init', '--platform=none', '--json'])
  writeFileSync(
    join(root, '.specdev', 'project_notes', 'big_picture.md'),
    '# Project Big Picture\n\n## Overview\n\nA focused temporary repository that exercises interactive and automatic reviewloop command paths.\n\n## Architecture\n\nSpecDev manages the workflow artifacts and Node.js runs the CLI regression fixture.\n',
    'utf8'
  )
  writeFileSync(
    join(root, '.specdev', 'agents.yaml'),
    'worker:\n  provider: claude\n  model: fixture\n  effort: low\n  timeout: 10s\nreviewer:\n  provider: claude\n  model: fixture\n  effort: low\n  timeout: 10s\n',
    'utf8'
  )

  runJson(['do', 'start an assignment'])
  const topLevel = runJson([
    'assignment',
    'Exercise interactive Assignment review',
    '--slug=interactive-review',
    '--json',
  ])
  writeContract(join(root, topLevel.path), 'Exercise interactive Assignment Brainstorm review')
  const unrelatedDiscussionPath = join(
    root,
    '.specdev',
    'discussions',
    'D90000_concurrent',
    'brainstorm'
  )
  mkdirSync(unrelatedDiscussionPath, { recursive: true })
  writeFileSync(join(unrelatedDiscussionPath, 'proposal.md'), '# Concurrent proposal\n', 'utf8')
  mutateDuringNextReview('.specdev/discussions/D90000_concurrent/brainstorm/proposal.md')
  const first = runJson(['reviewloop', 'brainstorm', '--json'], 1)
  const second = runJson(['reviewloop', 'brainstorm', '--json'], 1)
  assert.equal(first.round, 1, JSON.stringify(first))
  assert.equal(second.round, 2, JSON.stringify(second))
  assert.match(second.next_action, /rerun specdev reviewloop brainstorm/)
  mutateDuringNextReview('review-product-mutation.txt')
  const assignmentProductMutation = runJson(['reviewloop', 'brainstorm', '--json'], 1)
  assert.match(assignmentProductMutation.error, /Reviewer modified/)
  rmSync(join(root, 'review-product-mutation.txt'), { force: true })
  runJson(['cancel', 'finish interactive Assignment fixture'])

  const discussion = runJson(['discussion', 'Exercise interactive Discussion review', '--json'])
  writeDiscussion(join(root, discussion.path))
  runJson(['discussion', discussion.id, '--json'])
  mutateDuringNextReview('.specdev/discussions/D90000_concurrent/brainstorm/proposal.md')
  const firstDiscussion = runJson([
    'reviewloop',
    'discussion',
    `--discussion=${discussion.id}`,
    '--json',
  ])
  const secondDiscussion = runJson([
    'reviewloop',
    'discussion',
    `--discussion=${discussion.id}`,
    '--json',
  ])
  assert.equal(firstDiscussion.round, 1)
  assert.equal(secondDiscussion.round, 2)
  mutateDuringNextReview(`${discussion.path}/brainstorm/proposal.md`)
  const activeDiscussionMutation = runJson(
    ['reviewloop', 'discussion', `--discussion=${discussion.id}`, '--json'],
    1
  )
  assert.match(activeDiscussionMutation.error, /Reviewer modified/)
  writeDiscussion(join(root, discussion.path))
  mutateDuringNextReview('discussion-review-product-mutation.txt')
  const discussionProductMutation = runJson(
    ['reviewloop', 'discussion', `--discussion=${discussion.id}`, '--json'],
    1
  )
  assert.match(discussionProductMutation.error, /Reviewer modified/)
  rmSync(join(root, 'discussion-review-product-mutation.txt'), { force: true })

  const mission = runJson(['mission', 'create', 'Exercise interactive Mission review', '--json'])
  const missionPath = join(root, mission.path)
  writeMissionContract(missionPath)
  const unrelatedAuditPath = join(root, '.specdev', 'test-audits', 'TA99999_concurrent')
  mkdirSync(unrelatedAuditPath, { recursive: true })
  writeFileSync(join(unrelatedAuditPath, 'audit.md'), '# Concurrent audit\n', 'utf8')
  mutateDuringNextReview('.specdev/test-audits/TA99999_concurrent/audit.md')
  const missionReview = runJson(['reviewloop', 'mission', `--mission=${mission.id}`, '--json'])
  assert.equal(missionReview.status, 'approved')
  assert.equal(missionReview.phase, 'mission')
  runJson(['cancel', 'finish interactive Mission fixture'])

  runJson(['do', 'start an assignment'])
  const child = runJson([
    'assignment',
    'Exercise automatic Mission child review',
    '--slug=automatic-child-review',
    '--json',
  ])
  const childPath = join(root, child.path)
  writeContract(childPath, 'Exercise automatic Mission-child Brainstorm review')
  const statusPath = join(childPath, 'status.json')
  const status = JSON.parse(readFileSync(statusPath, 'utf8'))
  writeFileSync(
    statusPath,
    `${JSON.stringify({ ...status, mission: mission.id }, null, 2)}\n`,
    'utf8'
  )
  const childReview = runJson(['reviewloop', 'brainstorm', '--json'])
  assert.equal(childReview.status, 'approved')
  assert.equal(childReview.phase, 'brainstorm')
  const childState = JSON.parse(
    readFileSync(join(childPath, 'review', 'brainstorm-state.json'), 'utf8')
  )
  assert.equal(childState.mode, 'automatic')
  assert.equal(childState.stage, 'complete')

  runJson(['cancel', 'finish automatic Mission child fixture'])

  runJson(['do', 'start an assignment'])
  const evidenceOnly = runJson([
    'assignment',
    'Review an evidence-only Mission child with required follow-up',
    '--slug=evidence-only-follow-up',
    '--json',
  ])
  const evidenceOnlyPath = join(root, evidenceOnly.path)
  writeContract(evidenceOnlyPath, 'Review an authorized negative observation')
  const evidenceOnlyContractPath = join(evidenceOnlyPath, 'brainstorm', 'contract.md')
  writeFileSync(
    evidenceOnlyContractPath,
    readFileSync(evidenceOnlyContractPath, 'utf8')
      .replace(
        'The selected review mode completes its bounded command path.',
        'The evidence-only child records the authorized observation regardless of outcome.'
      )
      .replace(
        'The review command returns a structured result.',
        'The authorized observation is recorded and a negative outcome requires follow-up.'
      ),
    'utf8'
  )
  runJson(['checkpoint', 'brainstorm', '--json'])
  runJson(['approve', 'brainstorm', '--json'])
  writeImplementationDelivery(evidenceOnlyPath)
  const evidenceOnlyProgressPath = join(
    evidenceOnlyPath,
    'implementation',
    'progress.json'
  )
  const evidenceOnlyProgress = JSON.parse(readFileSync(evidenceOnlyProgressPath, 'utf8'))
  evidenceOnlyProgress.verification[0].status = 'failed'
  evidenceOnlyProgress.follow_up = 'required'
  writeFileSync(
    evidenceOnlyProgressPath,
    `${JSON.stringify(evidenceOnlyProgress, null, 2)}\n`,
    'utf8'
  )
  writeFileSync(
    join(evidenceOnlyPath, 'outcome.md'),
    '# Outcome\n\n## Delivered behavior\n\nAuthorized negative observation recorded.\n\n## Deviations\n\nNone.\n\n## Unresolved risks\n\nBounded follow-up is required.\n\n| Acceptance | Evidence | Result |\n| --- | --- | --- |\n| AC-1 | Focused negative observation. | Failed |\n',
    'utf8'
  )
  const evidenceOnlyStatusPath = join(evidenceOnlyPath, 'status.json')
  const evidenceOnlyStatus = JSON.parse(readFileSync(evidenceOnlyStatusPath, 'utf8'))
  writeFileSync(
    evidenceOnlyStatusPath,
    `${JSON.stringify({ ...evidenceOnlyStatus, mission: mission.id }, null, 2)}\n`,
    'utf8'
  )
  stepGuidedNode(root, 'design', {
    plan: `${evidenceOnly.path}/design/plan.md`,
    attempt: 'fixture-worker',
  })
  stepGuidedNode(root, 'implementation', {
    progress: `${evidenceOnly.path}/implementation/progress.json`,
    outcome: `${evidenceOnly.path}/outcome.md`,
    attempt: 'fixture-worker',
  })
  const evidenceOnlyReview = runJson(['reviewloop', 'implementation', '--json'])
  assert.equal(evidenceOnlyReview.status, 'approved')
  assert.equal(evidenceOnlyReview.disposition, 'approved')
  const reviewedEvidenceOnlyStatus = JSON.parse(readFileSync(evidenceOnlyStatusPath, 'utf8'))
  assert.equal(reviewedEvidenceOnlyStatus.status, 'completed')
  const evidenceOnlyChild = {
    folder: evidenceOnly.path.split('/').at(-1),
    execution: 'evidence-only',
  }
  evidenceOnlyChild.follow_up = await missionChildFollowUp(
    join(root, '.specdev'),
    evidenceOnlyChild
  )
  assert.equal(evidenceOnlyChild.follow_up, 'required')
  assert.equal(missionChildDisposition(evidenceOnlyChild), 'completed-with-follow-up')

  runJson(['do', 'start an assignment'])
  const boundedRepair = runJson([
    'assignment',
    'Bound artifact preflight repair',
    '--slug=bounded-artifact-repair',
    '--json',
  ])
  const boundedRepairPath = join(root, boundedRepair.path)
  writeContract(boundedRepairPath, 'Bound repeated artifact-preflight repair')
  runJson(['checkpoint', 'brainstorm', '--json'])
  runJson(['approve', 'brainstorm', '--json'])
  writeImplementationDelivery(boundedRepairPath)
  stepGuidedNode(root, 'design', {
    plan: `${boundedRepair.path}/design/plan.md`,
    attempt: 'fixture-worker',
  })
  stepGuidedNode(root, 'implementation', {
    progress: `${boundedRepair.path}/implementation/progress.json`,
    outcome: `${boundedRepair.path}/outcome.md`,
    attempt: 'fixture-worker',
  })
  writeFileSync(join(boundedRepairPath, 'outcome.md'), '# Outcome\n\nInvalid fixture.\n', 'utf8')
  const exhaustedRepair = runJson(['reviewloop', 'implementation', '--json'], 1)
  assert.match(exhaustedRepair.error, /awaits manual artifact repair after 1 automatic repair Attempt/)
  assert.equal(readFileSync(`${root}.repair-count`, 'utf8'), '1')
  const repairState = JSON.parse(
    readFileSync(join(boundedRepairPath, 'review', 'implementation-state.json'), 'utf8')
  )
  assert.equal(repairState.status, 'artifact_repair')
  assert.equal(repairState.disposition, 'blocked')
  assert.equal(repairState.artifact_repair_round, 2)
  assert.equal(repairState.artifact_repair_limit, 1)
  const repeatedRepair = runJson(['reviewloop', 'implementation', '--json'], 1)
  assert.match(repeatedRepair.error, /no replacement worker was launched/)
  assert.equal(readFileSync(`${root}.repair-count`, 'utf8'), '1')

  console.log('reviewloop mode command tests passed')
} finally {
  rmSync(root, { recursive: true, force: true })
  rmSync(`${root}.review-count`, { force: true })
  rmSync(`${root}.repair-count`, { force: true })
}
