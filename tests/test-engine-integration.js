import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { suspendRun } from 'ripplegraph'

const repoRoot = resolve(import.meta.dirname, '..')
const bin = join(repoRoot, 'bin', 'specdev.js')
const roots = []

function tempProject(label) {
  const root = mkdtempSync(join(tmpdir(), `specdev-ripplegraph-${label}-`))
  roots.push(root)
  return root
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
  const result = run(root, args, expectedStatus)
  try {
    return JSON.parse(result.stdout)
  } catch (error) {
    throw new Error(`invalid JSON from ${args.join(' ')}: ${error.message}\n${result.stdout}`)
  }
}

function runGit(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, `git ${args.join(' ')} failed:\n${result.stderr}`)
}

function writeBigPicture(root) {
  writeFileSync(
    join(root, '.specdev', 'project_notes', 'big_picture.md'),
    '# Project Big Picture\n\n## Overview\nA test Node.js CLI with durable context for guided workflow integration.\n\n## Tech Stack\nNode.js and JSON files with no external services.\n',
    'utf8'
  )
}

function writeContract(path, objective = 'Exercise the graph lifecycle') {
  writeFileSync(
    join(path, 'brainstorm', 'contract.md'),
    `# Assignment contract\n\n## Objective and context\n\n${objective}\n\n## Scope and non-goals\n\n- In scope: graph integration\n- Non-goals: provider invocation\n\n## Expected behavior\n\nThe static workflow advances through one approval.\n\n## Important decisions\n\nUse semantic contract commands.\n\n## Constraints and invariants\n\nKeep state portable.\n\n## Delegated and reserved authority\n\n- Delegated: fixture artifact writes\n- Reserved for the user: contract approval\n\n## Risks and assumptions\n\nThe fixture uses a temporary repository.\n\n## Verification authority\n\n- Focused integration checks are allowed.\n\n## Acceptance criteria\n\n- AC-1: One contract approval reaches automatic Design.\n`,
    'utf8'
  )
}

function writeDiscussion(path) {
  mkdirSync(join(path, 'brainstorm'), { recursive: true })
  writeFileSync(
    join(path, 'brainstorm', 'proposal.md'),
    '# Proposal\n\nExplore a follow-up design without modifying product code.\n',
    'utf8'
  )
  writeFileSync(
    join(path, 'brainstorm', 'design.md'),
    '# Design\n\nCompare the bounded options and retain assumptions for later promotion.\n',
    'utf8'
  )
}

function writeTestAudit(path) {
  writeFileSync(
    join(path, 'audit.md'),
    `# Test Audit: graph lifecycle checks\n\n## Candidates\n\n| Test or exact range | Why it is redundant | Existing protection that remains | Estimated saving | Confidence |\n| --- | --- | --- | --- | --- |\n| tests/duplicate.js | Duplicates the integration path | tests/integration.js | one process launch | high |\n\n## Retained protection\n\nThe integration test retains the same observable contract.\n\n## Cost impact\n\nOne process launch is removed from each full run.\n\n## Confidence\n\nHigh, based on identical assertions and setup.\n`,
    'utf8'
  )
  mkdirSync(join(path, 'brainstorm'), { recursive: true })
  writeContract(path, 'Remove only the exact redundant test identified by the completed Test Audit')
  writeFileSync(
    join(path, 'assignment-contract.md'),
    readFileSync(join(path, 'brainstorm', 'contract.md'), 'utf8'),
    'utf8'
  )
  rmSync(join(path, 'brainstorm'), { recursive: true, force: true })
}

function writeMissionContract(path) {
  writeContract(path, 'Exercise sequential orchestration')
  const contractPath = join(path, 'brainstorm', 'contract.md')
  writeFileSync(
    contractPath,
    `${readFileSync(contractPath, 'utf8')}\n## Mission execution shape\n\n- Initial child plan: single\n- Split reason: none\n\n## Final integrated verification\n\n- Command: \`node --check package.json\`\n`,
    'utf8'
  )
}

function writeRecoveredDelivery(path) {
  mkdirSync(join(path, 'design'), { recursive: true })
  mkdirSync(join(path, 'implementation'), { recursive: true })
  writeFileSync(
    join(path, 'design', 'plan.md'),
    '# Plan\n\n**Implementation Guides:** []\n**Review Guides:** []\n\n## Tasks\n\n- T-1 covers AC-1.\n',
    'utf8'
  )
  writeFileSync(
    join(path, 'implementation', 'progress.json'),
    JSON.stringify({
      version: 1,
      tasks: [{ id: 'T-1', status: 'completed' }],
      selected_guides: { implementation: [], review: [] },
      verification: [],
      deviations: [],
      follow_up: 'none',
    }),
    'utf8'
  )
  writeFileSync(
    join(path, 'outcome.md'),
    '# Outcome\n\n| Acceptance | Evidence | Result |\n| --- | --- | --- |\n| AC-1 | Fixture inspection | Passed |\n',
    'utf8'
  )
  writeFileSync(
    join(path, 'implementation', 'worker-result.md'),
    '---\nstatus: completed\nfollow_up: none\n---\n\n## Changes\n\nRecovered fixture delivery.\n',
    'utf8'
  )
}

try {
  const root = tempProject('main')
  runGit(root, ['init', '--quiet'])
  const init = runJson(root, ['init', '--platform=none', '--json'])
  assert.equal(init.status, 'ok')
  assert.equal(init.guided_workflows, 6)
  assert.equal(existsSync(join(root, '.specdev', 'workflow.json')), true)
  assert.equal(existsSync(join(root, '.specdev', 'workflow.yaml')), false)
  assert.equal(existsSync(join(root, '.specdev', 'agents.yaml')), true)

  const registryPath = join(root, '.specdev', '.ripplegraph', 'registry.json')
  let registry = JSON.parse(readFileSync(registryPath, 'utf8'))
  assert.equal(Object.keys(registry.graphs).length, 7)
  assert.match(registry.graphs['assignment-lifecycle'].path, /assignment-lifecycle@2\.1\.1$/)
  assert.match(registry.graphs['mission-lifecycle'].path, /mission-lifecycle@1\.2\.0$/)
  assert.equal(registry.graphs['discussion-lifecycle'].kind, 'callable')

  assert.equal(runJson(root, ['next', '--json']).state, 'idle')
  const shimDir = join(root, 'test-bin')
  mkdirSync(shimDir)
  writeFileSync(join(shimDir, 'specdev'), `#!/bin/sh\nexec "${process.execPath}" "${bin}" "$@"\n`, {
    mode: 0o755,
  })
  const hookResult = spawnSync(
    'bash',
    [join(root, '.claude', 'hooks', 'specdev-session-start.sh')],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${shimDir}:${process.env.PATH}` },
    }
  )
  assert.equal(hookResult.status, 0, hookResult.stderr)
  const hookPayload = JSON.parse(hookResult.stdout)
  assert.match(hookPayload.hookSpecificOutput.additionalContext, /Workflow: none/)
  assert.match(hookPayload.hookSpecificOutput.additionalContext, /State: idle/)

  const orientation = runJson(root, ['do', 'project orientation'])
  assert.equal(orientation.workflow, 'Project orientation')
  suspendRun({ workflowRoot: join(root, '.specdev'), note: 'resume check' })
  assert.equal(runJson(root, ['do', 'project orientation']).workflow, 'Project orientation')
  run(root, ['start'])
  writeBigPicture(root)
  runJson(root, [
    'step',
    `--json=${JSON.stringify({ path: '.specdev/project_notes/big_picture.md', summary: 'Context recorded.' })}`,
  ])
  run(root, ['start'])
  assert.equal(runJson(root, ['next', '--json']).state, 'idle')

  runJson(root, ['do', 'start an assignment'])
  const assignment = runJson(root, [
    'assignment',
    'Exercise the graph lifecycle',
    '--slug=graph-lifecycle',
    '--json',
  ])
  const assignmentPath = join(root, assignment.path)
  writeContract(assignmentPath)
  const checkpoint = runJson(root, ['checkpoint', 'brainstorm', '--json'])
  assert.equal(checkpoint.status, 'pass')
  assert.match(checkpoint.contract_hash, /^[a-f0-9]{64}$/)
  assert.equal(runJson(root, ['next', '--json']).state, 'awaiting_decision')
  const bypassedApproval = runJson(
    root,
    [
      'decide',
      JSON.stringify({
        approved: true,
        contract_hash: checkpoint.contract_hash,
        actor: 'bypass',
        approved_at: new Date().toISOString(),
      }),
    ],
    1
  )
  assert.equal(bypassedApproval.state, 'semantic_command_required')
  writeFileSync(
    join(assignmentPath, 'brainstorm', 'contract.md'),
    `${readFileSync(join(assignmentPath, 'brainstorm', 'contract.md'), 'utf8')}\nClarification recorded after the first hash.\n`,
    'utf8'
  )
  const staleApproval = run(root, ['approve', 'brainstorm', '--json'], 1)
  assert.match(staleApproval.stderr, /changed after its hash was shown/)
  const refreshedCheckpoint = runJson(root, ['checkpoint', 'brainstorm', '--json'])
  assert.notEqual(refreshedCheckpoint.contract_hash, checkpoint.contract_hash)
  const approval = runJson(root, [
    'approve',
    'brainstorm',
    '--implementation-review=waived',
    '--json',
  ])
  assert.equal(approval.approved, true)
  assert.equal(approval.review_policy.implementation, 'waived')
  assert.equal(runJson(root, ['next', '--json']).phase, 'design')
  const bypassedDesign = runJson(
    root,
    ['step', `--json=${JSON.stringify({ plan: 'invalid', attempt: 'ATT-bypass' })}`],
    1
  )
  assert.equal(bypassedDesign.state, 'semantic_command_required')
  runJson(root, ['cancel', 'finish semantic-command fixture'])

  // A Discussion callable proceeds while another focused Assignment remains active.
  runJson(root, ['do', 'start an assignment'])
  const focusedAssignment = runJson(root, ['assignment', 'Leave this assignment focused', '--json'])
  const mismatched = run(root, ['checkpoint', 'brainstorm', `--assignment=${assignment.id}`], 1)
  assert.match(mismatched.stderr, new RegExp(`active Assignment is ${focusedAssignment.name}`))
  const discussion = runJson(root, ['discussion', 'Explore a follow-up design', '--json'])
  const discussionPath = join(root, discussion.path)
  writeDiscussion(discussionPath)
  const awaitingReview = runJson(root, ['discussion', discussion.id, '--json'])
  assert.equal(awaitingReview.status, 'awaiting_review')
  const discussionDone = runJson(root, ['discussion', discussion.id, '--complete', '--json'])
  assert.equal(discussionDone.status, 'completed')
  const completedDiscussionBrief = runJson(root, [
    'knowledge',
    'distill',
    `--discussion=${discussion.id}`,
    '--json',
  ])
  assert.equal(
    completedDiscussionBrief.unreferenced_sources.some(
      (source) =>
        source.path === `${discussion.path.replace(/^\.specdev\//, '')}/brainstorm/design.md`
    ),
    true
  )
  writeFileSync(
    join(discussionPath, 'brainstorm', 'design.md'),
    '# Design\n\nChanged after completion and therefore no longer promotable under the saved hash.\n',
    'utf8'
  )
  const changedPromotion = runJson(
    root,
    ['assignment', `--from-discussion=${discussion.id}`, '--json'],
    1
  )
  assert.match(changedPromotion.error, /changed after completion/)

  const audit = runJson(root, ['test-audit', 'graph lifecycle checks', '--json'])
  writeTestAudit(join(root, audit.path))
  assert.equal(runJson(root, ['test-audit', audit.id, '--json']).status, 'awaiting_completion')
  assert.equal(runJson(root, ['test-audit', audit.id, '--complete', '--json']).status, 'completed')
  assert.equal(runJson(root, ['next', '--json']).workflow, 'Assignment lifecycle')
  runJson(root, ['cancel', 'finish concurrency fixture'])

  const blockedAssignment = runJson(root, ['assignment', 'Preserve a blocked worker', '--json'])
  const blockedAssignmentPath = join(root, blockedAssignment.path)
  writeContract(blockedAssignmentPath, 'Preserve a blocked worker without an automatic retry')
  runJson(root, ['checkpoint', 'brainstorm', '--json'])
  runJson(root, ['approve', 'brainstorm', '--json'])
  mkdirSync(join(blockedAssignmentPath, 'implementation'), { recursive: true })
  writeFileSync(
    join(blockedAssignmentPath, 'implementation', 'worker-result.md'),
    '---\nstatus: blocked\nrevision: null\nfollow_up: required\n---\n\n## Changes\n\nWaiting for user authority.\n',
    'utf8'
  )
  const firstBlocked = runJson(root, ['implement', '--json'], 1)
  const repeatedBlocked = runJson(root, ['implement', '--json'], 1)
  assert.equal(firstBlocked.status, 'blocked')
  assert.equal(repeatedBlocked.status, 'blocked')
  assert.match(repeatedBlocked.next_action, /without launching another worker/)
  assert.match(repeatedBlocked.next_action, /--retry-worker/)
  runJson(root, ['cancel', 'finish blocked worker fixture'])

  const promotedAudit = runJson(root, ['assignment', `--from-test-audit=${audit.id}`, '--json'])
  assert.equal(promotedAudit.review_policy.implementation, 'required')
  const promotedStatus = JSON.parse(
    readFileSync(join(root, promotedAudit.path, 'status.json'), 'utf8')
  )
  assert.equal(promotedStatus.source_test_audit.id, audit.id)
  assert.equal(
    /\bTODO\b/.test(
      readFileSync(join(root, promotedAudit.path, 'brainstorm', 'contract.md'), 'utf8')
    ),
    false
  )
  runJson(root, ['cancel', 'finish Test Audit promotion fixture'])

  const compactedAssignment = runJson(root, ['assignment', 'Compact completed runtime', '--json'])
  const compactedAssignmentPath = join(root, compactedAssignment.path)
  writeContract(compactedAssignmentPath, 'Compact completed workflow infrastructure')
  runJson(root, ['checkpoint', 'brainstorm', '--json'])
  runJson(root, ['approve', 'brainstorm', '--implementation-review=waived', '--json'])
  const compactedStatus = JSON.parse(
    readFileSync(join(compactedAssignmentPath, 'status.json'), 'utf8')
  )
  writeRecoveredDelivery(compactedAssignmentPath)
  const compacted = runJson(root, ['implement', '--json'])
  assert.equal(compacted.status, 'completed')
  assert.equal(compacted.runtime_compaction.compacted, true)
  assert.deepEqual(compacted.activity.provider_attempts, {
    total: 0,
    completed: 0,
    failed: 0,
    blocked: 0,
    interrupted: 0,
    running: 0,
  })
  const completedAssignmentStatus = JSON.parse(
    readFileSync(join(compactedAssignmentPath, 'status.json'), 'utf8')
  )
  assert.deepEqual(completedAssignmentStatus.activity, compacted.activity)
  assert.equal(
    existsSync(join(root, '.specdev', '.ripplegraph', 'runs', compactedStatus.run_id)),
    false
  )
  assert.equal(existsSync(join(root, '.specdev', '.current')), false)
  assert.equal(runJson(root, ['next', '--json']).state, 'idle')

  const distillationBrief = runJson(root, ['knowledge', 'distill', '--json'])
  assert.equal(
    distillationBrief.unreferenced_sources.some(
      (source) =>
        source.path === `${compactedAssignment.path}/outcome.md`.replace(/^\.specdev\//, '')
    ),
    true
  )
  assert.equal(
    distillationBrief.unreferenced_sources.some((source) => source.discussion === discussion.id),
    false
  )
  mkdirSync(join(root, '.specdev', 'knowledge', 'faq'), { recursive: true })
  writeFileSync(
    join(root, '.specdev', 'knowledge', 'faq', 'stale-electron.md'),
    '---\nkind: faq\nstatus: active\nverified_at: 2000-01-01\nreview_after: 2000-02-01\nkeywords: [staleelectron]\n---\n\n# Stale Electron FAQ\n\nOld staleelectron guidance.\n',
    'utf8'
  )
  assert.deepEqual(runJson(root, ['knowledge', 'search', 'staleelectron', '--json']).results, [])
  const staleKnowledge = runJson(root, [
    'knowledge',
    'search',
    'staleelectron',
    '--include-stale',
    '--json',
  ])
  assert.equal(staleKnowledge.results[0].freshness, 'stale')

  const mission = runJson(root, [
    'mission',
    'create',
    'Exercise sequential orchestration',
    '--json',
  ])
  assert.equal(mission.status, 'brainstorming')
  assert.match(mission.id, /^M\d{5}$/)
  assert.match(mission.path, new RegExp(`^\\.specdev/missions/${mission.id}_`))
  writeMissionContract(join(root, mission.path))
  const awaitingMissionApproval = runJson(root, ['mission', 'run', mission.id, '--json'])
  assert.equal(awaitingMissionApproval.status, 'awaiting_approval')
  const missionStatus = runJson(root, ['mission', 'status', mission.id, '--json'])
  assert.equal(missionStatus.mission, mission.id)
  assert.deepEqual(missionStatus.activity.provider_attempts, {
    total: 0,
    completed: 0,
    failed: 0,
    blocked: 0,
    interrupted: 0,
    running: 0,
  })
  runJson(root, ['cancel', 'finish mission fixture'])

  runJson(root, ['migrate', '--json'])
  runJson(root, [
    'step',
    `--json=${JSON.stringify({ inventory: '.specdev/migration/inventory.md', summary: 'No ambiguity.' })}`,
  ])
  runJson(root, [
    'step',
    `--json=${JSON.stringify({ plan: '.specdev/migration/layout-plan.md', summary: 'No moves needed.' })}`,
  ])
  assert.equal(runJson(root, ['decide', 'cancel']).state, 'completed')

  registry = JSON.parse(readFileSync(registryPath, 'utf8'))
  registry.graphs.stale = { ...registry.graphs['project-orientation'], id: 'stale' }
  writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8')
  const legacyScaffoldingPath = join(root, '.specdev', 'project_scaffolding')
  mkdirSync(legacyScaffoldingPath, { recursive: true })
  writeFileSync(join(legacyScaffoldingPath, '_README.md'), 'obsolete managed guidance\n', 'utf8')
  writeFileSync(join(legacyScaffoldingPath, 'custom.md'), '# User scaffolding\n', 'utf8')
  const legacyFeedbackPath = join(root, '.specdev', 'knowledge', '_workflow_feedback')
  mkdirSync(legacyFeedbackPath, { recursive: true })
  writeFileSync(join(legacyFeedbackPath, 'review-drag.md'), '# Review drag\n', 'utf8')
  const update = runJson(root, ['update', '--platform=none', '--json'])
  assert.equal(update.status, 'ok')
  assert.equal(existsSync(join(legacyScaffoldingPath, '_README.md')), false)
  assert.equal(
    readFileSync(join(legacyScaffoldingPath, 'custom.md'), 'utf8'),
    '# User scaffolding\n'
  )
  assert.equal(existsSync(legacyFeedbackPath), false)
  assert.equal(
    readFileSync(
      join(root, '.specdev', 'knowledge', 'workflow_feedback', 'review-drag.md'),
      'utf8'
    ),
    '# Review drag\n'
  )
  registry = JSON.parse(readFileSync(registryPath, 'utf8'))
  assert.deepEqual(Object.keys(registry.graphs).sort(), [
    'assignment-lifecycle',
    'discussion-lifecycle',
    'layout-migration',
    'mission-lifecycle',
    'project-orientation',
    'test-audit-lifecycle',
    'workspace-dispatcher',
  ])
  assert.equal(existsSync(join(root, '.specdev', 'workflows', 'catalog.json')), true)
  const stableRegistry = readFileSync(registryPath, 'utf8')
  assert.equal(runJson(root, ['update', '--platform=none', '--json']).status, 'ok')
  assert.equal(readFileSync(registryPath, 'utf8'), stableRegistry)

  console.log('Engine integration tests passed.')
} finally {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
}
