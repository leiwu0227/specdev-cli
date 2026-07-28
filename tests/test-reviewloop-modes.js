import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

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

function mutateDuringNextReview(relativePath) {
  writeFileSync(join(root, '.git', 'specdev-review-mutation'), relativePath, 'utf8')
}

try {
  mkdirSync(fakeBin)
  const fakeClaude = join(fakeBin, 'claude')
  writeFileSync(
    fakeClaude,
    `#!/bin/sh
cat >/dev/null
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

  console.log('reviewloop mode command tests passed')
} finally {
  rmSync(root, { recursive: true, force: true })
  rmSync(`${root}.review-count`, { force: true })
}
