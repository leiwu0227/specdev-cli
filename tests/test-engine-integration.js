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

function gitText(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, `git ${args.join(' ')} failed:\n${result.stderr}`)
  return result.stdout.trim()
}

function configureGit(root) {
  runGit(root, ['config', 'user.name', 'SpecDev Test'])
  runGit(root, ['config', 'user.email', 'specdev@example.test'])
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
      verification: [
        {
          command: 'node focused-recovery-check.js',
          revision: 'working-tree@fixture',
          scope: 'AC-1 recovery fixture',
          status: 'passed',
          duration_ms: 1,
          role: 'authoritative_acceptance',
        },
      ],
      deviations: [],
      follow_up: 'none',
    }),
    'utf8'
  )
  writeFileSync(
    join(path, 'outcome.md'),
    '# Outcome\n\n## Delivered behavior\n\nRecovered fixture.\n\n## Deviations\n\nNone.\n\n## Unresolved risks\n\nNone.\n\n| Acceptance | Evidence | Result |\n| --- | --- | --- |\n| AC-1 | Fixture inspection | Passed |\n',
    'utf8'
  )
  writeFileSync(
    join(path, 'implementation', 'worker-result.md'),
    '---\nstatus: completed\nfollow_up: none\n---\n\n## Changes\n\nRecovered fixture delivery.\n',
    'utf8'
  )
}

try {
  const adhocRoot = tempProject('adhoc')
  runGit(adhocRoot, ['init', '--quiet'])
  configureGit(adhocRoot)
  runJson(adhocRoot, ['init', '--platform=none', '--json'])
  writeFileSync(join(adhocRoot, 'README.md'), '# Adhoc fixture\n', 'utf8')
  writeFileSync(join(adhocRoot, 'rename source.txt'), 'rename this path\n', 'utf8')
  writeFileSync(join(adhocRoot, 'delete me.txt'), 'delete this path\n', 'utf8')
  runGit(adhocRoot, ['add', '--all'])
  runGit(adhocRoot, ['commit', '--quiet', '-m', 'initial fixture'])
  const adhocStartRevision = gitText(adhocRoot, ['rev-parse', 'HEAD'])

  const adhocDiscussionRelative = '.specdev/discussions/D99998_concurrent/brainstorm/proposal.md'
  const adhocAuditRelative = '.specdev/test-audits/TA99998_concurrent/audit.md'
  const adhocCallRelative = '.specdev/.ripplegraph/calls/D99998/checkpoint.json'
  mkdirSync(join(adhocRoot, '.specdev', 'discussions', 'D99998_concurrent', 'brainstorm'), {
    recursive: true,
  })
  mkdirSync(join(adhocRoot, '.specdev', 'test-audits', 'TA99998_concurrent'), {
    recursive: true,
  })
  mkdirSync(join(adhocRoot, '.specdev', '.ripplegraph', 'calls', 'D99998'), {
    recursive: true,
  })
  writeFileSync(join(adhocRoot, adhocDiscussionRelative), '# Concurrent proposal\n', 'utf8')
  writeFileSync(join(adhocRoot, adhocAuditRelative), '# Concurrent audit\n', 'utf8')
  writeFileSync(join(adhocRoot, adhocCallRelative), '{"status":"active"}\n', 'utf8')
  writeFileSync(join(adhocRoot, 'existing.txt'), 'adopt this change\n', 'utf8')
  mkdirSync(join(adhocRoot, 'untracked bundle', 'nested'), { recursive: true })
  writeFileSync(join(adhocRoot, 'untracked bundle', 'first.txt'), 'first\n', 'utf8')
  writeFileSync(
    join(adhocRoot, 'untracked bundle', 'nested', 'file with spaces.txt'),
    'second\n',
    'utf8'
  )
  runGit(adhocRoot, ['mv', 'rename source.txt', 'renamed destination.txt'])
  rmSync(join(adhocRoot, 'delete me.txt'))
  runGit(adhocRoot, ['add', 'existing.txt'])
  const callerIndexBeforeRefusal = gitText(adhocRoot, ['diff', '--cached', '--raw'])
  const dirtyAdhoc = runJson(adhocRoot, ['adhoc', 'start', 'Repair one help message', '--json'], 1)
  assert.equal(dirtyAdhoc.state, 'dirty_worktree')
  assert.equal(dirtyAdhoc.working_tree.count, 6)
  assert(dirtyAdhoc.worktree.product_dirty.paths.includes('existing.txt'))
  assert(dirtyAdhoc.worktree.product_dirty.paths.includes('rename source.txt'))
  assert(dirtyAdhoc.worktree.product_dirty.paths.includes('renamed destination.txt'))
  assert(dirtyAdhoc.worktree.product_dirty.paths.includes('delete me.txt'))
  assert(dirtyAdhoc.worktree.product_dirty.paths.includes('untracked bundle/first.txt'))
  assert(
    dirtyAdhoc.worktree.product_dirty.paths.includes('untracked bundle/nested/file with spaces.txt')
  )
  assert.deepEqual(dirtyAdhoc.worktree.preserved_workflow_state.paths, [
    adhocCallRelative,
    adhocDiscussionRelative,
    adhocAuditRelative,
  ])
  assert.equal(
    dirtyAdhoc.worktree.applied_policy,
    'preserve_concurrent_discussion_and_test_audit_state'
  )
  assert.equal(dirtyAdhoc.worktree.decision, 'blocked')
  const dirtyAdhocHuman = run(adhocRoot, ['adhoc', 'start', 'Repair one help message'], 1)
  assert.match(dirtyAdhocHuman.stderr, /Worktree product paths: 6/)
  assert.match(dirtyAdhocHuman.stderr, /Worktree independent workflow paths: 3 \(preserved\)/)
  assert.match(dirtyAdhocHuman.stderr, /Worktree decision: blocked/)
  const rejectedAdoption = runJson(
    adhocRoot,
    ['adhoc', 'start', 'Repair one help message', '--adopt-dirty', '--json'],
    1
  )
  assert.equal(rejectedAdoption.state, 'adoption_rejected')
  assert.deepEqual(
    rejectedAdoption.rejected_paths.map((item) => item.path),
    [adhocCallRelative, adhocDiscussionRelative, adhocAuditRelative]
  )
  assert.deepEqual(
    rejectedAdoption.rejected_paths.map((item) => item.owner),
    ['Discussion D99998', 'Discussion D99998', 'Test Audit TA99998']
  )
  assert.equal(existsSync(join(adhocRoot, '.specdev', 'cache', 'adhoc.json')), false)
  assert.equal(gitText(adhocRoot, ['diff', '--cached', '--raw']), callerIndexBeforeRefusal)
  rmSync(join(adhocRoot, '.specdev', 'discussions', 'D99998_concurrent'), {
    recursive: true,
    force: true,
  })
  rmSync(join(adhocRoot, '.specdev', 'test-audits', 'TA99998_concurrent'), {
    recursive: true,
    force: true,
  })
  rmSync(join(adhocRoot, '.specdev', '.ripplegraph', 'calls', 'D99998'), {
    recursive: true,
    force: true,
  })
  const adhoc = runJson(adhocRoot, [
    'adhoc',
    'start',
    'Repair one help message',
    '--adopt-dirty',
    '--json',
  ])
  assert.match(adhoc.id, /^AH-\d{8}T\d{9}Z-[a-f0-9]{4}$/)
  assert.equal(adhoc.starting_worktree, 'adopted')
  assert.equal(adhoc.adoption_manifest.version, 1)
  assert.equal(adhoc.adoption_manifest.starting_revision, adhocStartRevision)
  assert.equal(adhoc.adoption_manifest.paths.length, 6)
  assert.deepEqual(
    adhoc.adoption_manifest.paths.map((entry) => entry.path),
    adhoc.worktree.adopted.paths
  )
  assert(
    adhoc.adoption_manifest.paths.some(
      (entry) =>
        entry.path === 'untracked bundle/nested/file with spaces.txt' && entry.status === '??'
    )
  )
  assert(
    adhoc.adoption_manifest.paths.some(
      (entry) => entry.path === 'rename source.txt' && entry.role === 'source'
    )
  )
  assert.equal(adhoc.worktree.decision, 'allowed')
  const activeStatus = runJson(adhocRoot, ['adhoc', 'status', '--json'])
  assert.equal(activeStatus.status, 'active')
  assert.deepEqual(activeStatus.adoption_manifest, adhoc.adoption_manifest)
  const activeAdhocPath = join(adhocRoot, '.specdev', 'cache', 'adhoc.json')
  const exactActiveState = JSON.parse(readFileSync(activeAdhocPath, 'utf8'))
  const legacyActiveState = { ...exactActiveState }
  delete legacyActiveState.adoption_manifest
  writeFileSync(activeAdhocPath, JSON.stringify(legacyActiveState, null, 2), 'utf8')
  const legacyRefusal = runJson(
    adhocRoot,
    [
      'adhoc',
      'finish',
      '--outcome=Corrected the help text',
      '--verification=Inspected the bounded fixture',
      '--json',
    ],
    1
  )
  assert.equal(legacyRefusal.state, 'legacy_adoption_manifest_missing')
  assert.equal(existsSync(activeAdhocPath), true)
  writeFileSync(activeAdhocPath, JSON.stringify(exactActiveState, null, 2), 'utf8')
  rmSync(join(adhocRoot, 'untracked bundle', 'first.txt'))
  const indexBeforeMissingRefusal = gitText(adhocRoot, ['diff', '--cached', '--raw'])
  const missingAdopted = runJson(
    adhocRoot,
    [
      'adhoc',
      'finish',
      '--outcome=Corrected the help text',
      '--verification=Inspected the bounded fixture',
      '--json',
    ],
    1
  )
  assert.equal(missingAdopted.state, 'adopted_paths_missing')
  assert.equal(missingAdopted.rejected_paths[0].path, 'untracked bundle/first.txt')
  assert.equal(gitText(adhocRoot, ['diff', '--cached', '--raw']), indexBeforeMissingRefusal)
  writeFileSync(join(adhocRoot, 'untracked bundle', 'first.txt'), 'first\n', 'utf8')
  writeFileSync(join(adhocRoot, 'help.txt'), 'corrected help\n', 'utf8')
  mkdirSync(join(adhocRoot, '.specdev', 'discussions', 'D99998_concurrent', 'brainstorm'), {
    recursive: true,
  })
  mkdirSync(join(adhocRoot, '.specdev', 'test-audits', 'TA99998_concurrent'), {
    recursive: true,
  })
  mkdirSync(join(adhocRoot, '.specdev', '.ripplegraph', 'calls', 'D99998'), {
    recursive: true,
  })
  writeFileSync(join(adhocRoot, adhocDiscussionRelative), '# Concurrent proposal\n', 'utf8')
  writeFileSync(join(adhocRoot, adhocAuditRelative), '# Concurrent audit\n', 'utf8')
  writeFileSync(join(adhocRoot, adhocCallRelative), '{"status":"active"}\n', 'utf8')
  runGit(adhocRoot, ['add', '--', adhocDiscussionRelative, adhocCallRelative])
  const failedVerification = runJson(
    adhocRoot,
    [
      'adhoc',
      'verify',
      '--label=rendered help',
      '--annotation=expected red run',
      '--json',
      '--',
      process.execPath,
      '-e',
      'console.error("not corrected"); process.exit(3)',
    ],
    1
  )
  assert.equal(failedVerification.verification.status, 'failed')
  assert.equal(failedVerification.verification.exit_status, 3)
  assert.match(failedVerification.verification.tested_revision, /^working-tree@/)
  assert.match(failedVerification.verification.output.text, /not corrected/)
  const passingVerification = runJson(adhocRoot, [
    'adhoc',
    'verify',
    '--label=rendered help',
    '--json',
    '--',
    process.execPath,
    '-e',
    'console.log("corrected")',
  ])
  assert.equal(passingVerification.verification.status, 'passed')
  assert.equal(passingVerification.acceptance_evidence.length, 1)
  assert.equal(passingVerification.acceptance_evidence[0].status, 'passed')
  const activeBeforeDelivery = JSON.parse(readFileSync(activeAdhocPath, 'utf8'))
  const adhocFinished = runJson(adhocRoot, [
    'adhoc',
    'finish',
    '--outcome=Corrected the help text',
    '--json',
  ])
  assert.equal(adhocFinished.status, 'completed')
  assert.equal(adhocFinished.starting_git_commit_hash, adhocStartRevision)
  assert.equal(adhocFinished.ending_git_commit_hash, gitText(adhocRoot, ['rev-parse', 'HEAD']))
  assert.equal(adhocFinished.delivery_commit, adhocFinished.ending_git_commit_hash)
  assert.equal(adhocFinished.verification.attempts.length, 2)
  assert.equal(adhocFinished.verification.acceptance_evidence.length, 1)
  assert.equal(adhocFinished.product_worktree_clean, true)
  assert.deepEqual(adhocFinished.remaining_worktree.product_dirty.paths, [])
  assert.deepEqual(adhocFinished.remaining_worktree.preserved_workflow_state.paths, [
    adhocCallRelative,
    adhocDiscussionRelative,
    adhocAuditRelative,
  ])
  assert(adhocFinished.committed_paths.product.includes('existing.txt'))
  assert(adhocFinished.committed_paths.product.includes('help.txt'))
  assert(adhocFinished.committed_paths.product.includes('delete me.txt'))
  assert(adhocFinished.committed_paths.product.includes('rename source.txt'))
  assert(adhocFinished.committed_paths.product.includes('renamed destination.txt'))
  assert(adhocFinished.committed_paths.product.includes('untracked bundle/first.txt'))
  assert(
    adhocFinished.committed_paths.product.includes('untracked bundle/nested/file with spaces.txt')
  )
  assert.deepEqual(adhocFinished.committed_paths.receipt, [adhocFinished.receipt])
  assert.deepEqual(adhocFinished.path_facts.requested, adhoc.worktree.adopted.paths)
  assert.deepEqual(adhocFinished.path_facts.remaining, [])
  assert.match(
    gitText(adhocRoot, ['log', '-1', '--format=%B']),
    new RegExp(`SpecDev-Adhoc: ${adhoc.id}`)
  )
  assert.match(gitText(adhocRoot, ['log', '-1', '--format=%B']), /SpecDev-Commit-Type: delivery/)
  const adhocCommittedPaths = gitText(adhocRoot, [
    'show',
    '--name-only',
    '--format=',
    'HEAD',
  ]).split('\n')
  assert.equal(adhocCommittedPaths.includes(adhocDiscussionRelative), false)
  assert.equal(adhocCommittedPaths.includes(adhocAuditRelative), false)
  assert.equal(adhocCommittedPaths.includes(adhocCallRelative), false)
  const adhocRemainingPaths = gitText(adhocRoot, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  ])
  assert.match(adhocRemainingPaths, new RegExp(adhocDiscussionRelative.replaceAll('/', '\\/')))
  assert.match(adhocRemainingPaths, new RegExp(adhocAuditRelative.replaceAll('/', '\\/')))
  assert.match(adhocRemainingPaths, new RegExp(adhocCallRelative.replaceAll('/', '\\/')))
  assert.equal(
    gitText(adhocRoot, ['diff', '--cached', '--name-only']).includes(adhocDiscussionRelative),
    true
  )
  const adhocReceipt = readFileSync(join(adhocRoot, adhocFinished.receipt), 'utf8')
  assert.match(adhocReceipt, /## Verification attempt history/)
  assert.match(adhocReceipt, /rendered help: failed/)
  assert.match(adhocReceipt, /rendered help: passed/)
  assert.match(adhocReceipt, /## Current acceptance evidence/)
  assert.match(adhocReceipt, /## Structured verification/)
  assert.match(adhocReceipt, /"attempt_history"/)
  assert.match(adhocReceipt, /## Delivery path facts/)
  assert.match(adhocReceipt, /untracked bundle\/nested\/file with spaces\.txt/)
  const activeForRecovery = {
    ...activeBeforeDelivery,
    outcome: 'Corrected the help text',
    completed_at: new Date().toISOString(),
    delivery_candidate: {
      version: 1,
      starting_revision: adhocStartRevision,
      product_paths: adhocFinished.committed_paths.product,
      receipt_path: adhocFinished.receipt,
    },
  }
  writeFileSync(activeAdhocPath, JSON.stringify(activeForRecovery, null, 2), 'utf8')
  writeFileSync(join(adhocRoot, 'existing.txt'), 'post-commit owned delta\n', 'utf8')
  const blockedRecovery = runJson(adhocRoot, ['adhoc', 'finish', '--json'], 1)
  assert.equal(blockedRecovery.state, 'remaining_owned_delta')
  assert.deepEqual(blockedRecovery.path_facts.remaining, ['existing.txt'])
  assert.equal(existsSync(activeAdhocPath), true)
  runGit(adhocRoot, ['restore', '--worktree', '--', 'existing.txt'])
  const recoveredHuman = run(adhocRoot, ['adhoc', 'finish'])
  assert.match(recoveredHuman.stdout, /Adhoc .*: completed/)
  assert.match(recoveredHuman.stdout, /Delivery subject: specdev\(adhoc\): Repair one help message/)
  assert.match(recoveredHuman.stdout, /Remaining independent workflow paths: 3 \(preserved\)/)
  assert.match(recoveredHuman.stdout, /Product worktree clean: yes/)
  writeFileSync(activeAdhocPath, JSON.stringify(activeForRecovery, null, 2), 'utf8')
  const recoveredJson = runJson(adhocRoot, ['adhoc', 'finish', '--json'])
  assert.equal(recoveredJson.recovered, true)
  assert.deepEqual(recoveredJson.remaining_worktree, adhocFinished.remaining_worktree)
  const shownAdhoc = runJson(adhocRoot, ['adhoc', 'show', adhoc.id, '--json'])
  assert.equal(shownAdhoc.starting_git_commit_hash, adhocStartRevision)
  assert.equal(shownAdhoc.ending_git_commit_hash, adhocFinished.ending_git_commit_hash)
  assert.equal(runJson(adhocRoot, ['adhoc', 'status', '--json']).status, 'idle')

  const longScope =
    'Keep artifact preview header actions and close control reachable on narrow mobile layouts while preserving native desktop behavior'
  const secondAdhoc = runJson(adhocRoot, ['adhoc', 'start', longScope, '--json'])
  writeFileSync(join(adhocRoot, 'second.txt'), 'second delivery\n', 'utf8')
  const secondFinished = runJson(adhocRoot, [
    'adhoc',
    'finish',
    '--outcome=Kept preview actions reachable',
    '--verification=Inspected the bounded fixture',
    '--json',
  ])
  assert.equal(secondFinished.verification.manual, 'Inspected the bounded fixture')
  assert.equal(secondFinished.delivery_subject.length <= 'specdev(adhoc): '.length + 68, true)
  assert.doesNotMatch(
    secondFinished.delivery_subject,
    /\b(?:and|as|at|by|for|from|in|of|on|or|the|to|using|while|with)$/i
  )
  assert.equal(
    gitText(adhocRoot, ['rev-parse', `${secondFinished.delivery_commit}^`]),
    adhocFinished.delivery_commit
  )
  assert.notEqual(secondAdhoc.id, adhoc.id)

  const thirdAdhoc = runJson(adhocRoot, [
    'adhoc',
    'start',
    'Preserve this complete receipt scope even though the delivery log needs a concise operator title',
    '--title=Concise operator title',
    '--json',
  ])
  assert.equal(thirdAdhoc.title, 'Concise operator title')
  writeFileSync(join(adhocRoot, 'third.txt'), 'third delivery\n', 'utf8')
  const thirdFinished = runJson(adhocRoot, [
    'adhoc',
    'finish',
    '--outcome=Used an independent title',
    '--verification=Inspected the title fixture',
    '--json',
  ])
  assert.equal(thirdFinished.delivery_subject, 'specdev(adhoc): Concise operator title')
  assert.equal(
    gitText(adhocRoot, ['rev-parse', `${thirdFinished.delivery_commit}^`]),
    secondFinished.delivery_commit
  )

  const assignmentAdhocRoot = tempProject('assignment-adhoc')
  runGit(assignmentAdhocRoot, ['init', '--quiet'])
  configureGit(assignmentAdhocRoot)
  runJson(assignmentAdhocRoot, ['init', '--platform=none', '--json'])
  writeBigPicture(assignmentAdhocRoot)
  writeFileSync(join(assignmentAdhocRoot, 'README.md'), '# Assignment Adhoc fixture\n', 'utf8')
  runGit(assignmentAdhocRoot, ['add', '--all'])
  runGit(assignmentAdhocRoot, ['commit', '--quiet', '-m', 'initialize coexistence fixture'])
  const coexistenceBase = gitText(assignmentAdhocRoot, ['rev-parse', 'HEAD'])
  const preservedAssignment = runJson(assignmentAdhocRoot, [
    'assignment',
    'Preserve this active assignment through a bounded detour',
    '--slug=preserved-through-adhoc',
    '--json',
  ])
  const preservedAssignmentPath = join(assignmentAdhocRoot, preservedAssignment.path)
  writeContract(preservedAssignmentPath, 'Preserve this active Assignment through Adhoc')
  runJson(assignmentAdhocRoot, ['checkpoint', 'brainstorm', '--json'])
  runJson(assignmentAdhocRoot, ['approve', 'brainstorm', '--json'])
  const preservedStatusPath = join(preservedAssignmentPath, 'status.json')
  const preservedStatus = JSON.parse(readFileSync(preservedStatusPath, 'utf8'))
  assert.equal(preservedStatus.git_boundary, undefined)
  const preservedRunPath = join(
    assignmentAdhocRoot,
    '.specdev',
    '.ripplegraph',
    'runs',
    preservedStatus.run_id,
    'checkpoint.json'
  )
  const preservedBefore = {
    focus: readFileSync(join(assignmentAdhocRoot, '.specdev', '.current'), 'utf8'),
    current: readFileSync(
      join(assignmentAdhocRoot, '.specdev', '.ripplegraph', 'current.json'),
      'utf8'
    ),
    status: readFileSync(preservedStatusPath, 'utf8'),
    run: readFileSync(preservedRunPath, 'utf8'),
  }

  const coexistence = runJson(assignmentAdhocRoot, [
    'adhoc',
    'start',
    'Correct one detached help example',
    '--json',
  ])
  assert.equal(coexistence.status, 'started')
  assert.equal(coexistence.assignment_coexistence.id, preservedAssignment.id)
  assert.equal(coexistence.assignment_coexistence.run_id, preservedStatus.run_id)
  assert.equal(coexistence.worktree.product_dirty.count, 0)
  assert(coexistence.worktree.preserved_workflow_state.paths.includes('.specdev/.current'))
  assert(
    coexistence.worktree.preserved_workflow_state.paths.some((path) =>
      path.startsWith(preservedAssignment.path)
    )
  )
  const guardedNext = runJson(assignmentAdhocRoot, ['next', '--json'], 1)
  assert.equal(guardedNext.state, 'adhoc_detour_active')
  assert.equal(guardedNext.assignment.id, preservedAssignment.id)
  writeFileSync(join(assignmentAdhocRoot, 'detour.txt'), 'bounded detour\n', 'utf8')
  const coexistenceFinished = runJson(assignmentAdhocRoot, [
    'adhoc',
    'finish',
    '--outcome=Corrected the detached help example',
    '--verification=Inspected the focused coexistence fixture',
    '--json',
  ])
  assert.equal(coexistenceFinished.status, 'completed')
  assert.equal(coexistenceFinished.assignment_coexistence.id, preservedAssignment.id)
  const coexistenceCommittedPaths = gitText(assignmentAdhocRoot, [
    'diff-tree',
    '--no-commit-id',
    '--name-only',
    '-r',
    coexistenceFinished.delivery_commit,
  ]).split('\n')
  assert(coexistenceCommittedPaths.includes('detour.txt'))
  assert(coexistenceCommittedPaths.includes(coexistenceFinished.receipt))
  assert.equal(
    coexistenceCommittedPaths.some((path) => path.startsWith('.specdev/assignments/')),
    false
  )
  assert.equal(coexistenceCommittedPaths.includes('.specdev/.current'), false)
  assert.equal(
    readFileSync(join(assignmentAdhocRoot, '.specdev', '.current'), 'utf8'),
    preservedBefore.focus
  )
  assert.equal(
    readFileSync(join(assignmentAdhocRoot, '.specdev', '.ripplegraph', 'current.json'), 'utf8'),
    preservedBefore.current
  )
  assert.equal(readFileSync(preservedStatusPath, 'utf8'), preservedBefore.status)
  assert.equal(readFileSync(preservedRunPath, 'utf8'), preservedBefore.run)
  assert.equal(existsSync(join(preservedAssignmentPath, 'shelved.md')), false)
  assert.equal(runJson(assignmentAdhocRoot, ['next', '--json']).phase, 'design')

  const cancelledDetour = runJson(assignmentAdhocRoot, [
    'adhoc',
    'start',
    'Try then cancel a second detached edit',
    '--json',
  ])
  writeFileSync(join(assignmentAdhocRoot, 'cancelled-detour.txt'), 'left untouched\n', 'utf8')
  const cancelled = runJson(assignmentAdhocRoot, ['adhoc', 'cancel', '--json'])
  assert.equal(cancelled.id, cancelledDetour.id)
  assert.equal(cancelled.assignment_coexistence.id, preservedAssignment.id)
  assert.equal(existsSync(join(assignmentAdhocRoot, 'cancelled-detour.txt')), true)
  assert.equal(readFileSync(preservedStatusPath, 'utf8'), preservedBefore.status)
  rmSync(join(assignmentAdhocRoot, 'cancelled-detour.txt'))

  writeFileSync(
    join(assignmentAdhocRoot, 'ambiguous-product.txt'),
    'unowned product work\n',
    'utf8'
  )
  const dirtyAssignmentBlock = runJson(
    assignmentAdhocRoot,
    ['adhoc', 'start', 'Do not absorb Assignment work', '--adopt-dirty', '--json'],
    1
  )
  assert.equal(dirtyAssignmentBlock.state, 'assignment_dirty_product_conflict')
  assert.equal(existsSync(join(assignmentAdhocRoot, '.specdev', 'cache', 'adhoc.json')), false)
  rmSync(join(assignmentAdhocRoot, 'ambiguous-product.txt'))

  const attemptId = 'Attempt-99999'
  const attemptPath = join(assignmentAdhocRoot, '.specdev', 'processes', `${attemptId}.yaml`)
  const markerPath = join(
    assignmentAdhocRoot,
    '.specdev',
    'cache',
    'processes',
    `${attemptId}.json`
  )
  mkdirSync(join(assignmentAdhocRoot, '.specdev', 'processes'), { recursive: true })
  writeFileSync(
    attemptPath,
    `id: ${attemptId}\nkind: worker\nstatus: running\nworkspace: .\nstarted_at: 2026-08-21T00:00:00.000Z\nassignment: ${preservedAssignment.name}\n`,
    'utf8'
  )
  mkdirSync(join(assignmentAdhocRoot, '.specdev', 'cache', 'processes'), { recursive: true })
  writeFileSync(markerPath, JSON.stringify({ attempt: attemptId, pid: process.pid }), 'utf8')
  const liveAttemptBlock = runJson(
    assignmentAdhocRoot,
    ['adhoc', 'start', 'Do not overlap a live worker', '--json'],
    1
  )
  assert.equal(liveAttemptBlock.state, 'assignment_attempt_conflict')
  assert.equal(liveAttemptBlock.conflicts[0].reason, 'live_attempt')
  rmSync(markerPath)
  const ambiguousAttemptBlock = runJson(
    assignmentAdhocRoot,
    ['adhoc', 'start', 'Do not overlap an ambiguous worker', '--json'],
    1
  )
  assert.equal(ambiguousAttemptBlock.conflicts[0].reason, 'ambiguous_running_attempt')
  rmSync(attemptPath)

  const boundaryStatus = {
    ...preservedStatus,
    git_boundary: {
      version: 1,
      starting_git_commit_hash: coexistenceFinished.delivery_commit,
      starting_branch: 'main',
      starting_worktree: 'clean',
      adopted_path_count: 0,
      established_at: new Date().toISOString(),
    },
  }
  writeFileSync(preservedStatusPath, `${JSON.stringify(boundaryStatus, null, 2)}\n`, 'utf8')
  const boundaryBlock = runJson(
    assignmentAdhocRoot,
    ['adhoc', 'start', 'Do not rebase implementation', '--json'],
    1
  )
  assert.equal(boundaryBlock.state, 'assignment_boundary_conflict')
  assert.equal(boundaryBlock.conflicts[0].boundary, coexistenceFinished.delivery_commit)
  writeFileSync(preservedStatusPath, preservedBefore.status, 'utf8')

  writeFileSync(
    join(assignmentAdhocRoot, '.specdev', '.ripplegraph', 'current.json'),
    `${JSON.stringify({ focusedRunId: 'assignment-lifecycle-uncertain' }, null, 2)}\n`,
    'utf8'
  )
  const uncertainBlock = runJson(
    assignmentAdhocRoot,
    ['adhoc', 'start', 'Do not guess workflow ownership', '--json'],
    1
  )
  assert.equal(uncertainBlock.state, 'assignment_state_ambiguous')
  assert.match(uncertainBlock.conflicts[0].problem, /ownership disagree/)
  writeFileSync(
    join(assignmentAdhocRoot, '.specdev', '.ripplegraph', 'current.json'),
    preservedBefore.current,
    'utf8'
  )
  assert.equal(
    gitText(assignmentAdhocRoot, ['rev-parse', `${coexistenceFinished.delivery_commit}^`]),
    coexistenceBase
  )

  const root = tempProject('main')
  runGit(root, ['init', '--quiet'])
  configureGit(root)
  const init = runJson(root, ['init', '--platform=none', '--json'])
  assert.equal(init.status, 'ok')
  assert.equal(init.guided_workflows, 7)
  assert.equal(existsSync(join(root, '.specdev', 'workflow.json')), true)
  assert.equal(existsSync(join(root, '.specdev', 'workflow.yaml')), false)
  assert.equal(existsSync(join(root, '.specdev', 'agents.yaml')), true)
  assert.equal(
    existsSync(join(root, '.specdev', 'knowledge', 'workflow', 'adhoc-history.md')),
    true
  )

  const registryPath = join(root, '.specdev', '.ripplegraph', 'registry.json')
  let registry = JSON.parse(readFileSync(registryPath, 'utf8'))
  assert.equal(Object.keys(registry.graphs).length, 8)
  assert.match(registry.graphs['assignment-lifecycle'].path, /assignment-lifecycle@2\.3\.0$/)
  assert.match(registry.graphs['mission-lifecycle'].path, /mission-lifecycle@1\.5\.0$/)
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
  assert.match(hookPayload.hookSpecificOutput.additionalContext, /Classify the user request/)
  assert.match(hookPayload.hookSpecificOutput.additionalContext, /Never silently create/)
  rmSync(shimDir, { recursive: true, force: true })

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
  runGit(root, ['add', '--all'])
  runGit(root, ['commit', '--quiet', '-m', 'initialize SpecDev fixture'])

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
  assert.deepEqual(checkpoint.contract_preview, [
    'Objective: Exercise the graph lifecycle',
    'In scope: graph integration',
    'Acceptance AC-1: One contract approval reaches automatic Design.',
  ])
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
    ['step', `--json=${JSON.stringify({ plan: 'invalid', attempt: 'Attempt-bypass' })}`],
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
  const compactedStartRevision = gitText(root, ['rev-parse', 'HEAD'])
  writeRecoveredDelivery(compactedAssignmentPath)
  const assignmentDiscussionRelative =
    '.specdev/discussions/D99997_concurrent/brainstorm/proposal.md'
  const assignmentAuditRelative = '.specdev/test-audits/TA99997_concurrent/audit.md'
  mkdirSync(join(root, '.specdev', 'discussions', 'D99997_concurrent', 'brainstorm'), {
    recursive: true,
  })
  mkdirSync(join(root, '.specdev', 'test-audits', 'TA99997_concurrent'), {
    recursive: true,
  })
  writeFileSync(join(root, assignmentDiscussionRelative), '# Concurrent proposal\n', 'utf8')
  writeFileSync(join(root, assignmentAuditRelative), '# Concurrent audit\n', 'utf8')
  writeFileSync(join(root, 'adopted-product.txt'), 'existing approved product work\n', 'utf8')
  const dirtyBoundary = runJson(root, ['implement', '--json'], 1)
  assert.equal(dirtyBoundary.state, 'dirty_worktree')
  assert.deepEqual(dirtyBoundary.working_tree.preview, ['adopted-product.txt'])
  const failOnceMarker = join(root, '.git', 'specdev-fail-once')
  writeFileSync(failOnceMarker, 'fail the first delivery commit\n', 'utf8')
  writeFileSync(
    join(root, '.git', 'hooks', 'pre-commit'),
    '#!/bin/sh\nif [ -f .git/specdev-fail-once ]; then rm .git/specdev-fail-once; exit 1; fi\n',
    { mode: 0o755 }
  )
  const failedDelivery = runJson(root, ['implement', '--adopt-dirty', '--json'], 1)
  assert.equal(failedDelivery.status, 'error')
  assert.match(failedDelivery.error, /Git command failed/)
  const assignmentStagedAfterFailure = gitText(root, ['diff', '--cached', '--name-only'])
  assert.doesNotMatch(assignmentStagedAfterFailure, /D99997_concurrent/)
  assert.doesNotMatch(assignmentStagedAfterFailure, /TA99997_concurrent/)
  const compacted = runJson(root, ['implement', '--json'])
  assert.equal(compacted.status, 'completed')
  assert.equal(compacted.recovered, true)
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
  assert.equal(compacted.delivery.starting_git_commit_hash, compactedStartRevision)
  assert.equal(compacted.delivery.ending_git_commit_hash, gitText(root, ['rev-parse', 'HEAD']))
  const assignmentCommit = gitText(root, ['log', '-1', '--format=%B'])
  assert.match(assignmentCommit, new RegExp(`SpecDev-Assignment: ${compactedAssignment.id}`))
  assert.match(assignmentCommit, /SpecDev-Commit-Type: delivery/)
  const assignmentCommittedPaths = gitText(root, ['show', '--name-only', '--format=', 'HEAD'])
  assert.doesNotMatch(assignmentCommittedPaths, /D99997_concurrent/)
  assert.doesNotMatch(assignmentCommittedPaths, /TA99997_concurrent/)
  const assignmentRemainingPaths = gitText(root, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  ])
  assert.match(assignmentRemainingPaths, /D99997_concurrent/)
  assert.match(assignmentRemainingPaths, /TA99997_concurrent/)

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
  assert.deepEqual(awaitingMissionApproval.contract_preview, [
    'Objective: Exercise sequential orchestration',
    'In scope: graph integration',
    'Acceptance AC-1: One contract approval reaches automatic Design.',
  ])
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
    'update-completion',
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
