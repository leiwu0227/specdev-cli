import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildMissionReapproval,
  decideMissionReapproval,
  inspectMissionReapproval,
  missionReapprovalPreview,
  readMissionReapproval,
} from '../src/utils/mission-reapproval.js'
import {
  buildStandaloneAssignmentCandidateReceipt,
  writeStandaloneAssignmentCandidateReceipt,
} from '../src/utils/assignment-delivery.js'

const root = mkdtempSync(join(tmpdir(), 'specdev-user-reapproval-'))
try {
  execFileSync('git', ['init', '--quiet'], { cwd: root })
  execFileSync('git', ['config', 'user.name', 'SpecDev Test'], { cwd: root })
  execFileSync('git', ['config', 'user.email', 'specdev@example.invalid'], { cwd: root })
  writeFileSync(join(root, 'product.txt'), 'reviewed candidate\n')
  execFileSync('git', ['add', 'product.txt'], { cwd: root })
  execFileSync('git', ['commit', '--quiet', '-m', 'fixture'], { cwd: root })

  const missionPath = join(root, '.specdev', 'missions', 'M00001_fixture')
  const assignmentPath = join(root, '.specdev', 'assignments', '00001_fixture')
  for (const path of [
    join(missionPath, 'review'),
    join(assignmentPath, 'brainstorm'),
    join(assignmentPath, 'design'),
    join(assignmentPath, 'implementation'),
    join(assignmentPath, 'review'),
  ]) {
    mkdirSync(path, { recursive: true })
  }
  writeFileSync(
    join(assignmentPath, 'brainstorm', 'contract.md'),
    `# Assignment contract

Kind: change

## Objective and context

Exercise the user-reapproval identity.

## Scope and non-goals

- In scope: the fixture
- Non-goals: unrelated behavior

## Expected behavior

The exact reviewed candidate can be approved once.

## Important decisions

Bind every reviewed identity field.

## Constraints and invariants

Stale identities fail closed.

## Delegated and reserved authority

- Delegated: fixture creation
- Reserved for the user: approval

## Risks and assumptions

None.

## Verification authority

Focused fixture only.

## Acceptance criteria

- AC-1: The identity is exact.
`
  )
  writeFileSync(join(assignmentPath, 'design', 'plan.md'), '# Plan\n\n## Tasks\n\n1. T-1 (AC-1).\n')
  writeFileSync(
    join(assignmentPath, 'implementation', 'progress.json'),
    JSON.stringify({
      version: 1,
      tasks: [{ id: 'T-1', status: 'completed' }],
      selected_guides: { implementation: [], review: [] },
      verification: [
        {
          command: 'fixture-check',
          revision: 'working-tree@fixture',
          scope: 'AC-1',
          status: 'passed',
          duration_ms: 1,
          role: 'authoritative_acceptance',
        },
      ],
      deviations: [],
      follow_up: 'none',
    })
  )
  writeFileSync(
    join(assignmentPath, 'outcome.md'),
    '# Outcome\n\n## Delivered behavior\n\nExact identity.\n\n## Deviations\n\nNone.\n\n## Unresolved risks\n\nNone.\n\n| Acceptance | Evidence | Result |\n| --- | --- | --- |\n| AC-1 | Fixture evidence. | Passed |\n'
  )
  const verdictPath = join(assignmentPath, 'review', 'implementation-verdict.md')
  writeFileSync(
    verdictPath,
    '---\nverdict: approved\nmaterial_divergence: true\nscope_divergence: clarifying\nprocedure_divergence: disclosed\nevidence_integrity: complete\nuser_reapproval_required: true\n---\n\n## Findings\n\nOne disclosed authority divergence.\n'
  )
  const assignmentStatus = { id: '00001', mission: 'M00001' }
  const candidateReceipt = await buildStandaloneAssignmentCandidateReceipt({
    targetDir: root,
    assignmentPath,
    assignmentStatus,
  })
  assert.equal(candidateReceipt.completeness, 'complete')
  await writeStandaloneAssignmentCandidateReceipt(assignmentPath, candidateReceipt)
  const pending = await buildMissionReapproval({
    targetDir: root,
    missionPath,
    mission: { id: 'M00001' },
    child: '00001',
    assignmentPath,
    assignmentStatus,
    candidateReceipt,
    verdictPath,
    reviewState: {
      attempt: 'Attempt-00001',
      candidate_digest: 'a'.repeat(64),
    },
  })
  const preview = missionReapprovalPreview(pending.record)
  assert.equal(preview.child, '00001')
  assert.equal(preview.candidate_receipt_identity, candidateReceipt.identity)
  assert.equal(preview.disclosed_divergences.length, 5)

  const inspection = await inspectMissionReapproval({
    targetDir: root,
    missionPath,
    mission: { id: 'M00001' },
    assignmentPath,
    assignmentStatus,
    pending: {
      child: '00001',
      identity: pending.record.identity,
      artifact: pending.path.slice(root.length + 1),
    },
  })
  assert.equal(inspection.stale, false)

  const approved = await decideMissionReapproval({
    path: pending.path,
    record: pending.record,
    decision: 'approve',
    actor: 'user',
  })
  assert.equal(approved.record.status, 'approved')
  const reloaded = await readMissionReapproval(missionPath, '00001', pending.record.identity)
  const repeated = await decideMissionReapproval({
    path: reloaded.path,
    record: reloaded.record,
    decision: 'approve',
    actor: 'user',
  })
  assert.equal(repeated.idempotent, true)
  assert.equal(readFileSync(reloaded.path, 'utf8'), readFileSync(pending.path, 'utf8'))

  writeFileSync(join(root, 'product.txt'), 'changed after review\n')
  const stale = await inspectMissionReapproval({
    targetDir: root,
    missionPath,
    mission: { id: 'M00001' },
    assignmentPath,
    assignmentStatus,
    pending: {
      child: '00001',
      identity: pending.record.identity,
      artifact: pending.path.slice(root.length + 1),
    },
  })
  assert.equal(stale.stale, true)
  assert.ok(stale.stale_fields.includes('candidate_receipt_identity'))
} finally {
  rmSync(root, { recursive: true, force: true })
}

console.log('Mission user-reapproval tests passed.')
