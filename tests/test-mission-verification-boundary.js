import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import fse from 'fs-extra'
import {
  assignmentContractTemplate,
  validateAssignmentContract,
  hashText,
} from '../src/utils/assignment-vnext.js'
import {
  declaredVerificationOwnership,
  validateVerificationMapping,
  recoverVerificationBoundary,
  boundaryVerificationReceipts,
} from '../src/utils/mission-verification-boundary.js'
import { buildStandaloneAssignmentCandidateReceipt } from '../src/utils/assignment-delivery.js'
import {
  missionChildFollowUp,
  readMission,
  readMissionQueue,
  writeMission,
} from '../src/utils/mission.js'
import { beginMissionImplementationChoice } from '../src/utils/mission-implementation.js'
import { deriveMissionExecutionPolicy } from '../src/utils/mission-execution.js'
import { stepGuidedNode, decideGuidedNode } from '../src/utils/engine-sync.js'
import { createAttemptRecord, updateAttemptRecord } from '../src/utils/process-record.js'

const bin = join(import.meta.dirname, '../bin/specdev.js')
const roots = []
function cli(root, args, expected = 0) {
  const result = spawnSync(process.execPath, [bin, ...args, '--json'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      CODEX_SANDBOX: '',
      PATH: `${join(root, '.specdev/cache/bin')}:${process.env.PATH}`,
    },
  })
  assert.equal(result.status, expected, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`)
  return JSON.parse(result.stdout)
}
const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
async function fixture({ legacy = true, final = 'node --version' } = {}) {
  const root = await fse.mkdtemp(join(tmpdir(), 'specdev-boundary-'))
  roots.push(root)
  cli(root, ['init'])
  git(root, ['init'])
  git(root, ['config', 'user.email', 'fixture@example.test'])
  git(root, ['config', 'user.name', 'Fixture'])
  await fse.writeFile(join(root, 'product.js'), 'export const ready = true\n')
  git(root, ['add', '.'])
  git(root, ['commit', '-m', 'fixture'])
  const specdevPath = join(root, '.specdev')
  await fse.outputFile(
    join(specdevPath, 'cache/bin/claude'),
    '#!/bin/sh\ncat >/dev/null\nprintf "%s\\n" "---" "verdict: approved" "material_divergence: false" "scope_divergence: none" "procedure_divergence: none" "evidence_integrity: complete" "user_reapproval_required: false" "---" "" "## Findings" "" "Focused child evidence satisfies the confirmed child boundary."\n',
    { mode: 0o755 }
  )
  await fse.writeFile(
    join(specdevPath, 'agents.yaml'),
    'worker:\n  provider: claude\n  model: fixture\n  timeout: 10s\nreviewer:\n  provider: claude\n  model: fixture\n  timeout: 10s\n'
  )
  await fse.writeFile(
    join(specdevPath, 'project_notes/big_picture.md'),
    '# Project Big Picture\n\n## Overview\n\nPortable conversion CLI fixture with Mission verification and focused acceptance.\n\n## Architecture\n\nNode CLI and a local workflow controller.\n'
  )
  const created = cli(root, ['mission', 'create', 'Portable single lab conversion'])
  const missionPath = join(root, created.path)
  let contract =
    assignmentContractTemplate({ description: 'Implement portable single lab conversion.' })
      .replaceAll('TODO', 'Preserve portable behavior.')
      .replace(
        '- AC-1: Preserve portable behavior.',
        '- AC-1: Portable behavior works.\n- AC-2: Final integrated verification passes.'
      ) +
    `\n## Mission execution shape\n\n- Initial child plan: single\n- Split reason: none\n\n## Verification ownership\n\n- Child acceptance: ${legacy ? 'AC-1, AC-2' : 'AC-1'}\n- Mission acceptance: ${legacy ? 'none' : 'AC-2'}\n\n## Final integrated verification\n\n- Command: \`${final}\`\n`
  if (legacy)
    contract = contract.replace(
      /## Verification ownership[\s\S]*?(?=## Final integrated verification)/,
      ''
    )
  await fse.writeFile(join(missionPath, 'brainstorm/contract.md'), contract)
  cli(root, ['mission', 'run', created.id])
  if (legacy) {
    // A newly approved Mission needs a declaration. Simulate the prior CLI's
    // already-recorded approval through the same lifecycle API, without editing checkpoints.
    const denied = cli(root, ['mission', 'run', created.id, '--approve'], 1)
    assert.match(denied.error, /explicit/)
    const approvedAt = new Date().toISOString()
    const approvedMission = await readMission(missionPath)
    const head = git(root, ['rev-parse', 'HEAD'])
    const decision = decideGuidedNode(root, 'approve-mission', {
      approved: true,
      contract_hash: hashText(contract),
      actor: 'user',
      approved_at: approvedAt,
      base_revision: head,
      branch: approvedMission.branch,
    })
    assert.equal(decision.synchronized, true)
    Object.assign(approvedMission, {
      approved_contract_hash: hashText(contract),
      approved_at: approvedAt,
      base_revision: head,
      base_branch: approvedMission.branch,
      approval_dirty_paths: [],
    })
    approvedMission.execution_policy = await deriveMissionExecutionPolicy({
      specdevPath,
      contractContent: contract,
      contractHash: hashText(contract),
      verificationCommand: final,
    })
    beginMissionImplementationChoice(approvedMission)
    await writeMission(missionPath, approvedMission)
  } else cli(root, ['mission', 'run', created.id, '--approve'])
  cli(root, ['mission', 'run', created.id, '--inline'])
  const mission = await readMission(missionPath)
  const queue = await readMissionQueue(missionPath)
  const child = queue.assignments[0]
  const assignmentPath = join(specdevPath, 'assignments', child.folder)
  const status = await fse.readJson(join(assignmentPath, 'status.json'))
  const revision = git(root, ['rev-parse', 'HEAD'])
  const receipts = [
    {
      command: 'node --check product.js',
      revision: `working-tree@${revision}`,
      scope: 'portable behavior AC-1',
      status: 'passed',
      duration_ms: 10,
      role: 'qualification',
    },
  ]
  await fse.outputFile(
    join(assignmentPath, 'design/plan.md'),
    '# Plan\n\nImplementation Guides: none\nReview Guides: none\n\n- T-1 covers AC-1' +
      (legacy ? ' and AC-2' : '') +
      '.\n'
  )
  await fse.outputJson(
    join(assignmentPath, 'implementation/progress.json'),
    {
      version: 1,
      tasks: [{ id: 'T-1', status: 'completed' }],
      owned_paths: [],
      selected_guides: { implementation: [], review: [] },
      verification: receipts,
      deviations: [],
      follow_up: 'none',
    },
    { spaces: 2 }
  )
  await fse.writeFile(
    join(assignmentPath, 'outcome.md'),
    '# Outcome\n\n## Delivered behavior\n\nPortable behavior.\n\n## Deviations\n\nNone.\n\n## Unresolved risks\n\nNone.\n\n| Acceptance | Evidence | Result |\n| --- | --- | --- |\n| AC-1 | Focused fixture | Passed |\n' +
      (legacy ? '| AC-2 | Controller pending | Blocked |\n' : '')
  )
  await fse.outputFile(
    join(assignmentPath, 'implementation/worker-result.md'),
    `---\nstatus: completed\nrevision: working-tree@${revision}\nfollow_up: none\n---\n\n## Changes\n\nPortable behavior.\n`
  )
  assert.equal(
    stepGuidedNode(root, 'design', { plan: 'fixture', attempt: 'inline-foreground' }).synchronized,
    true
  )
  assert.equal(
    stepGuidedNode(root, 'implementation', {
      progress: 'fixture',
      outcome: 'fixture',
      attempt: 'inline-foreground',
    }).synchronized,
    true
  )
  await fse.outputJson(join(assignmentPath, 'review/implementation-state.json'), {
    version: 2,
    stage: 'resolver',
    round: 2,
    primary_round: 2,
    history: [{ verdict: 'blocked' }],
  })
  await fse.writeFile(
    join(assignmentPath, 'review/implementation-verdict.md'),
    '---\nverdict: blocked\n---\n\nAC-2 awaits controller verification.\n'
  )
  const mapping = '.specdev/cache/boundary.json'
  await fse.outputJson(join(root, mapping), {
    child_acceptance: ['AC-1'],
    mission_acceptance: ['AC-2'],
    evidence: [{ index: 0, acceptance: ['AC-1'] }],
  })
  return {
    targetDir: root,
    specdevPath,
    missionPath,
    mission,
    assignmentPath,
    child,
    status,
    mapping,
    receipts,
    contract,
  }
}
const flagsFor = (value) => ({ child: value.child.id, mapping: value.mapping })
async function candidate(value) {
  return buildStandaloneAssignmentCandidateReceipt({
    targetDir: value.targetDir,
    assignmentPath: value.assignmentPath,
    assignmentStatus: value.status,
  })
}

try {
  assert.throws(
    () =>
      validateVerificationMapping({ child_acceptance: ['AC-1'], mission_acceptance: ['AC-1'] }, [
        'AC-1',
        'AC-2',
      ]),
    /partition/
  )
  assert.throws(
    () => declaredVerificationOwnership({ content: '', acceptanceIds: ['AC-1'] }),
    /explicit/
  )
  const fresh = await fixture({ legacy: false })
  assert.deepEqual((await validateAssignmentContract(fresh.assignmentPath)).acceptanceIds, ['AC-1'])
  assert.match(
    await fse.readFile(join(fresh.assignmentPath, 'brainstorm/contract.md'), 'utf8'),
    /Controller-owned parent criteria: AC-2/
  )
  assert.equal(
    (await candidate(fresh)).completeness,
    'incomplete',
    'qualification alone cannot authorize child acceptance'
  )

  const value = await fixture()
  const flags = flagsFor(value)
  const original = await fse.readFile(join(value.assignmentPath, 'brainstorm/contract.md'))
  const before = await candidate(value)
  assert(before.issues.includes('acceptance_not_passed'))
  assert(before.issues.includes('authoritative_verification_missing'))
  const preview = await recoverVerificationBoundary(value, flags)
  assert.equal(preview.status, 'awaiting_confirmation')
  assert.equal(
    await fse.pathExists(join(value.assignmentPath, 'verification-boundary.json')),
    false
  )
  await assert.rejects(
    () => recoverVerificationBoundary(value, { ...flags, child: '99999' }),
    /single full-scope/
  )
  await assert.rejects(
    () => recoverVerificationBoundary(value, { ...flags, confirm: 'bad' }),
    /Stale/
  )
  await fse.appendFile(join(value.assignmentPath, 'outcome.md'), '\nChanged evidence\n')
  await assert.rejects(
    () => recoverVerificationBoundary(value, { ...flags, confirm: preview.plan.digest }),
    /Stale/
  )
  await fse.writeFile(
    join(value.assignmentPath, 'outcome.md'),
    Buffer.from(preview.plan.artifacts['outcome.md'], 'base64')
  )
  const attempt = await createAttemptRecord(value.specdevPath, {
    kind: 'worker',
    mission: value.mission.id,
    assignment: value.child.folder,
    provider: 'claude',
    model: 'fixture',
  })
  await assert.rejects(() => recoverVerificationBoundary(value, flags), /Live or ambiguous/)
  await updateAttemptRecord(value.specdevPath, attempt.id, { status: 'completed' })
  const mappingPath = join(value.targetDir, value.mapping)
  const originalMapping = await fse.readJson(mappingPath)
  await fse.writeJson(mappingPath, { ...originalMapping, final_command: 'true' })
  await assert.rejects(() => recoverVerificationBoundary(value, flags), /cannot change scope/)
  await fse.writeJson(mappingPath, {
    ...originalMapping,
    evidence: [{ index: 99, acceptance: ['AC-1'] }],
  })
  await assert.rejects(() => recoverVerificationBoundary(value, flags), /passing focused evidence/)
  await fse.writeJson(mappingPath, originalMapping)
  await fse.appendFile(join(value.assignmentPath, 'brainstorm/contract.md'), '\nScope change\n')
  await assert.rejects(() => recoverVerificationBoundary(value, flags), /unchanged approved/)
  await fse.writeFile(join(value.assignmentPath, 'brainstorm/contract.md'), original)
  const newPreview = await recoverVerificationBoundary(value, flags)
  const move = fse.move
  let interrupted = false
  fse.move = async (source, destination, options) => {
    if (
      !interrupted &&
      destination === join(value.assignmentPath, 'verification-boundary.json') &&
      (await fse.readJson(source)).status === 'applied'
    ) {
      interrupted = true
      throw new Error('simulated interruption after lifecycle approval')
    }
    return move(source, destination, options)
  }
  try {
    await assert.rejects(
      () => recoverVerificationBoundary(value, { ...flags, confirm: newPreview.plan.digest }),
      /simulated interruption/
    )
  } finally {
    fse.move = move
  }
  await assert.rejects(() => validateAssignmentContract(value.assignmentPath), /pending/)
  await fse.appendFile(join(value.assignmentPath, 'outcome.md'), '\nUnconfirmed edit\n')
  await assert.rejects(
    () => recoverVerificationBoundary(value, { ...flags, confirm: newPreview.plan.digest }),
    /Evidence changed/
  )
  await fse.writeFile(
    join(value.assignmentPath, 'outcome.md'),
    Buffer.from(newPreview.plan.artifacts['outcome.md'], 'base64')
  )
  const confirmed = await recoverVerificationBoundary(value, {
    ...flags,
    confirm: newPreview.plan.digest,
  })
  assert.equal(confirmed.status, 'applied')
  assert.equal(
    (await recoverVerificationBoundary(value, { ...flags, confirm: newPreview.plan.digest }))
      .idempotent,
    true
  )
  assert.deepEqual(
    await fse.readFile(join(value.assignmentPath, 'brainstorm/contract.md')),
    original
  )
  assert.equal(
    (await readMission(value.missionPath)).approved_contract_hash,
    hashText(value.contract)
  )
  assert.equal(
    (await fse.readJson(join(value.assignmentPath, 'implementation/progress.json'))).verification[0]
      .role,
    'qualification'
  )
  assert.equal((await candidate(value)).completeness, 'complete')
  assert.equal(await missionChildFollowUp(value.specdevPath, value.child), 'none')
  assert.match(
    await fse.readFile(
      join(
        value.assignmentPath,
        'review/verification-boundary-history',
        newPreview.plan.digest,
        'review/implementation-verdict.md'
      ),
      'utf8'
    ),
    /blocked/
  )
  await fse.appendFile(join(value.targetDir, 'product.js'), '// changed candidate\n')
  assert((await candidate(value)).issues.includes('authoritative_verification_missing'))
  await fse.writeFile(join(value.targetDir, 'product.js'), 'export const ready = true\n')
  const later = [...value.receipts, { ...value.receipts[0], status: 'failed' }]
  assert.equal((await boundaryVerificationReceipts(value.assignmentPath, later)).length, 2)
  assert.equal(
    await fse.pathExists(join(value.missionPath, 'review/final-verification-attempts.json')),
    false
  )
  assert.equal(
    (await readMission(value.missionPath)).status,
    'running',
    'missing final evidence cannot complete the Mission'
  )
  const resumed = cli(value.targetDir, ['mission', 'run', value.mission.id])
  assert.equal(
    resumed.status,
    'completed',
    JSON.stringify(resumed) +
      '\n' +
      (await fse.readFile(join(value.missionPath, 'outcome.md'), 'utf8').catch(() => '')) +
      '\n' +
      JSON.stringify(await readMission(value.missionPath))
  )
  const finalReceipts = await fse.readJson(
    join(value.missionPath, 'review/final-verification-attempts.json')
  )
  assert(finalReceipts.some((receipt) => receipt.status === 'passed'))

  await fse.remove(join(value.targetDir, value.mapping))
  value.mission = await readMission(value.missionPath)
  assert.equal(
    (await recoverVerificationBoundary(value, { ...flags, confirm: newPreview.plan.digest }))
      .idempotent,
    true
  )
  assert.deepEqual((await validateAssignmentContract(value.assignmentPath)).acceptanceIds, ['AC-1'])

  // A failing controller command cannot complete the recovered Mission.
  const failing = await fixture({ final: 'node -e "process.exit(1)"' })
  const failingPreview = await recoverVerificationBoundary(failing, flagsFor(failing))
  await recoverVerificationBoundary(failing, {
    ...flagsFor(failing),
    confirm: failingPreview.plan.digest,
  })
  const result = cli(failing.targetDir, ['mission', 'run', failing.mission.id])
  const failedReceipts = await fse.readJson(
    join(failing.missionPath, 'review/final-verification-attempts.json')
  )
  assert(failedReceipts.some((receipt) => receipt.status === 'failed'))
  assert.notEqual(result.status, 'completed')
  assert.notEqual((await readMission(failing.missionPath)).status, 'completed')
  console.log('Mission verification boundary regressions passed')
} finally {
  for (const root of roots) await fse.remove(root)
}
