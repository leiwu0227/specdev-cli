import { createHash } from 'node:crypto'
import { execFile as execFileCallback } from 'node:child_process'
import { join } from 'node:path'
import { promisify } from 'node:util'
import fse from 'fs-extra'
import {
  appendTransition,
  nodeOutputKey,
  readCheckpoint,
  writeCheckpoint,
  writeNodeOutput,
} from 'ripplegraph'
import { resolveAssignmentSelector } from './assignment.js'
import {
  buildStandaloneAssignmentReceipt,
  validateStandaloneAssignmentReceipt,
} from './assignment-delivery.js'
import { validateAssignmentContract } from './assignment-vnext.js'
import { findCommitsByTrailer, gitStatusPaths, requireGitHead } from './git-delivery.js'
import { closeMissionGap, missionGapForSource, recordMissionSourceGap } from './mission-gaps.js'
import { readMissionQueue, writeMission, writeMissionQueue } from './mission.js'

const execFile = promisify(execFileCallback)

export async function planMissionSuccessorAdoption(context, selector, options = {}) {
  const { targetDir, specdevPath, missionPath, mission } = context
  if (!selector) throw new Error('Successor adoption requires --assignment=<id>')
  if (mission.status !== 'blocked') {
    throw new Error(`Mission ${mission.id} must be active and blocked before successor adoption`)
  }
  const sourceContract = await validateAssignmentContract(missionPath)
  if (!sourceContract.valid || sourceContract.hash !== mission.approved_contract_hash) {
    throw new Error('Mission approved contract identity is missing or changed')
  }
  const checkpoint = readCheckpoint(specdevPath, mission.run_id)
  const frame = checkpoint.stack.at(-1)
  if (
    checkpoint.status !== 'active' ||
    checkpoint.position.graph !== 'assignment-lifecycle' ||
    checkpoint.stack.length !== 1 ||
    frame?.parent.graph !== 'mission-lifecycle' ||
    frame.parent.node !== 'child-assignment'
  ) {
    throw new Error('Mission is not blocked inside one owned child Assignment')
  }

  const queue = await readMissionQueue(missionPath)
  const blockedChildren = (queue.assignments || []).filter((item) => item.status === 'running')
  if (blockedChildren.length !== 1) throw new Error('Mission queue must identify one running child')
  if ((queue.assignments || []).some((item) => item.status === 'pending')) {
    throw new Error('Successor adoption cannot skip pending Mission children')
  }
  const blockedChild = blockedChildren[0]
  if (!blockedChild.folder)
    throw new Error('Blocked Mission child has no durable Assignment folder')
  const blockedPath = join(specdevPath, 'assignments', blockedChild.folder)
  const blockedStatus = await fse.readJson(join(blockedPath, 'status.json')).catch(() => null)
  if (blockedStatus?.mission !== mission.id || blockedStatus?.id !== blockedChild.id) {
    throw new Error('Blocked child ownership does not match the Mission queue')
  }
  const blockedEvidence = await negativeEvidence(blockedPath)

  const successor = await resolveAssignmentSelector(specdevPath, String(selector))
  if (!successor || successor.ambiguous)
    throw new Error('Successor Assignment was not found uniquely')
  const successorStatus = await fse.readJson(join(successor.path, 'status.json')).catch(() => null)
  if (
    successorStatus?.status !== 'completed' ||
    successorStatus.mission ||
    !successorStatus.id ||
    !successorStatus.approved_at
  ) {
    throw new Error('Successor must be a terminal approved standalone Assignment')
  }
  const commits = await findCommitsByTrailer(targetDir, 'SpecDev-Assignment', successorStatus.id, {
    revision: 'HEAD',
  })
  if (commits.length !== 1) throw new Error('Successor delivery commit is missing or ambiguous')
  const deliveryCommit = commits[0]
  const head = await requireGitHead(targetDir)
  if (head !== deliveryCommit) {
    throw new Error('Successor delivery commit must be the current Mission candidate')
  }
  if (!(await isAncestor(targetDir, mission.base_revision, deliveryCommit))) {
    throw new Error('Successor delivery is not descended from the Mission base candidate')
  }

  const successorContract = await validateAssignmentContract(successor.path)
  if (!successorContract.valid) throw new Error('Successor contract is invalid')
  const successorReceipt = await buildStandaloneAssignmentReceipt({
    targetDir,
    assignmentPath: successor.path,
    assignmentStatus: successorStatus,
    delivery: {
      starting_git_commit_hash: successorStatus.git_boundary?.starting_git_commit_hash || null,
      ending_git_commit_hash: deliveryCommit,
      recovered: true,
    },
  })
  validateStandaloneAssignmentReceipt(successorReceipt)
  if (successorReceipt.completeness !== 'complete') {
    throw new Error(
      `Successor delivery evidence is incomplete: ${successorReceipt.issues.join(', ')}`
    )
  }
  if (
    successorReceipt.review.verdict !== 'approved' ||
    successorReceipt.review.divergence !== 'none' ||
    successorReceipt.review.evidence_integrity !== 'complete'
  ) {
    throw new Error('Successor review does not approve an unchanged complete candidate')
  }

  const command = String(queue.final_verification?.command || '').trim()
  if (!command || command !== authorizedCommand(sourceContract.content)) {
    throw new Error('Mission queue command does not exactly match its approved contract')
  }
  const authoritative = successorReceipt.verification.items.filter(
    (item) => item.role === 'authoritative_acceptance' && item.command === command
  )
  if (authoritative.length !== 1 || authoritative[0].status !== 'passed') {
    throw new Error(
      'Successor lacks one passing authoritative receipt for the exact Mission command'
    )
  }
  const rawProgress = await fse.readJson(join(successor.path, 'implementation', 'progress.json'))
  const rawEvidence = rawProgress.verification.filter(
    (item) => item.role === 'authoritative_acceptance' && item.command === command
  )
  const allowedBypasses = mission.execution_policy?.allowed_bypasses || []
  if (
    rawEvidence.length !== 1 ||
    rawEvidence[0].status !== 'passed' ||
    rawEvidence[0].policy_contract_hash !== mission.approved_contract_hash ||
    stableJson(rawEvidence[0].allowed_bypasses || []) !== stableJson(allowedBypasses) ||
    !String(rawEvidence[0].cleanup_identity || '').trim()
  ) {
    throw new Error(
      'Successor command environment-policy, bypass, or cleanup identity does not match the Mission'
    )
  }
  const allowedRevisions = new Set([
    deliveryCommit,
    successorStatus.git_boundary?.starting_git_commit_hash,
    `working-tree@${successorStatus.git_boundary?.starting_git_commit_hash}`,
  ])
  if (!allowedRevisions.has(rawEvidence[0].revision)) {
    throw new Error(
      'Successor authoritative receipt is not bound to the reviewed delivery candidate'
    )
  }

  const provenanceText = `${successorContract.content}\n${JSON.stringify(
    successorStatus.predecessor_mission || null
  )}`
  const durableProvenance =
    provenanceText.includes(mission.id) || provenanceText.includes(blockedChild.id)
  const legacyAuthority = String(options.legacyAuthority || '').trim()
  if (!durableProvenance && !legacyAuthority) {
    throw new Error(
      'Successor lacks durable predecessor provenance; supply explicit --legacy-authority=<reason>'
    )
  }

  const artifacts = await hashArtifacts(targetDir, {
    source_contract: join(missionPath, 'brainstorm', 'contract.md'),
    blocked_contract: join(blockedPath, 'brainstorm', 'contract.md'),
    blocked_status: join(blockedPath, 'status.json'),
    blocked_progress: join(blockedPath, 'implementation', 'progress.json'),
    blocked_outcome: join(blockedPath, 'outcome.md'),
    successor_contract: join(successor.path, 'brainstorm', 'contract.md'),
    successor_status: join(successor.path, 'status.json'),
    successor_progress: join(successor.path, 'implementation', 'progress.json'),
    successor_outcome: join(successor.path, 'outcome.md'),
    successor_verdict: join(successor.path, 'review', 'implementation-verdict.md'),
    successor_review_state: join(successor.path, 'review', 'implementation-state.json'),
    successor_candidate: join(successor.path, 'review', 'candidate-receipt.json'),
  })
  const dirtyPaths = await gitStatusPaths(targetDir)
  const includedPaths = [
    `${relativePath(targetDir, missionPath)}/mission.yaml`,
    `${relativePath(targetDir, missionPath)}/design/assignments.yaml`,
    `${relativePath(targetDir, missionPath)}/review/successor-adoption-${successorStatus.id}.json`,
    `${relativePath(targetDir, missionPath)}/review/final-verification.json`,
    `${relativePath(targetDir, missionPath)}/review/final-verification-attempts.json`,
    `.specdev/.ripplegraph/runs/${mission.run_id}/checkpoint.json`,
    `.specdev/.ripplegraph/runs/${mission.run_id}/transition-log.jsonl`,
  ]
  const plan = {
    version: 1,
    operation: 'mission-adopt-successor',
    mission: {
      id: mission.id,
      run_id: mission.run_id,
      contract_hash: mission.approved_contract_hash,
    },
    blocked_child: {
      id: blockedChild.id,
      folder: blockedChild.folder,
      failed_receipt: blockedEvidence,
      checkpoint_digest: digest(checkpoint),
      checkpoint_position: structuredClone(checkpoint.position),
      graph_packages: {
        root: structuredClone(checkpoint.graphSource),
        parent: structuredClone(frame.parent.graphSource || checkpoint.graphSource),
        child: structuredClone(frame.child),
      },
    },
    successor: {
      id: successorStatus.id,
      folder: successor.name,
      contract_hash: successorContract.hash,
      delivery_commit: deliveryCommit,
      candidate_identity: successorReceipt.review.candidate_identity,
      authoritative_evidence: structuredClone(rawEvidence[0]),
    },
    authority: {
      source: durableProvenance ? 'durable-predecessor-provenance' : 'explicit-legacy-operator',
      legacy_reason: legacyAuthority || null,
    },
    artifacts,
    transitions: [
      'preserve blocked child and failed receipt',
      'record successor supersession',
      'close the blocked-child gap',
      'return the nested graph to Mission final verification',
      'replay the adopted passing receipt on the next Mission run',
    ],
    included_paths: includedPaths,
    excluded_dirty_paths: dirtyPaths.filter((path) => !includedPaths.includes(path)),
  }
  plan.snapshot = digest(plan)
  return { plan, checkpoint, queue, blockedChild, successor, successorStatus }
}

export async function applyMissionSuccessorAdoption(context, selector, confirmation, options = {}) {
  const { specdevPath, missionPath, mission } = context
  if (!confirmation) throw new Error('Successor adoption requires an exact plan confirmation')
  const journalPath = join(
    specdevPath,
    'cache',
    'mission-adoptions',
    `${mission.id}-${confirmation}.json`
  )
  const existing = await fse.readJson(journalPath).catch(() => null)
  const plan =
    existing?.plan || (await planMissionSuccessorAdoption(context, selector, options)).plan
  if (confirmation !== plan.snapshot) {
    throw new Error(`Stale confirmation; rerun the read-only plan and confirm ${plan.snapshot}`)
  }
  if (existing) await validateJournalPlanInputs(context, selector, plan)
  if (existing?.status === 'completed') return { plan, journal: journalPath, idempotent: true }
  if (existing && existing.snapshot !== plan.snapshot) {
    throw new Error('Existing adoption journal belongs to a different snapshot')
  }
  await fse.ensureDir(join(specdevPath, 'cache', 'mission-adoptions'))
  let journal = existing || {
    version: 1,
    operation: plan.operation,
    mission: mission.id,
    snapshot: plan.snapshot,
    plan,
    status: 'prepared',
    write_progress: { record: false, mission: false, queue: false, checkpoint: false },
    prepared_at: new Date().toISOString(),
    confirmed_at: new Date().toISOString(),
  }
  await writeJsonAtomic(journalPath, journal)

  const recordPath = join(missionPath, 'review', `successor-adoption-${plan.successor.id}.json`)
  const record = {
    ...plan,
    disposition: 'supersedes-for-convergence',
    historical_evidence_preserved: true,
    confirmed_at: journal.confirmed_at,
  }
  if (!journal.write_progress.record) {
    await fse.ensureDir(join(missionPath, 'review'))
    await writeJsonAtomic(recordPath, record)
    interrupt(options.interruptAfter, 'record-written')
    journal = advanceJournal(journal, 'record')
    await writeJsonAtomic(journalPath, journal)
  } else {
    await assertJsonDigest(recordPath, digest(record), 'successor adoption record')
  }

  const receiptPath = join(missionPath, 'review', 'final-verification.json')
  const historyPath = join(missionPath, 'review', 'final-verification-attempts.json')
  const history = await fse.readJson(historyPath).catch(() => [])
  const adoptedReceipt = {
    id: `adopted-${plan.successor.id}`,
    command: plan.successor.authoritative_evidence.command,
    revision: plan.successor.delivery_commit,
    candidate_digest: plan.successor.candidate_identity,
    scope: plan.successor.authoritative_evidence.scope,
    status: 'passed',
    disposition: 'evidence-closed',
    policy_contract_hash: mission.approved_contract_hash,
    allowed_bypasses: plan.successor.authoritative_evidence.allowed_bypasses || [],
    executor: 'standalone-successor',
    executor_class: 'reviewed-standalone-assignment',
    route: 'successor-adoption',
    duration_ms: plan.successor.authoritative_evidence.duration_ms,
    cleanup_identity: plan.successor.authoritative_evidence.cleanup_identity,
    supersedes: plan.blocked_child.failed_receipt,
    adoption: relativePath(context.targetDir, recordPath),
    completed_at: record.confirmed_at,
  }
  if (!history.some((item) => item.id === adoptedReceipt.id)) history.push(adoptedReceipt)
  await writeJsonAtomic(historyPath, history)
  await writeJsonAtomic(receiptPath, adoptedReceipt)

  if (!journal.write_progress.mission) {
    const gap =
      missionGapForSource(mission, 'child', plan.blocked_child.id) ||
      recordMissionSourceGap(mission, {
        kind: 'child',
        sourceId: plan.blocked_child.id,
        signalId: `successor-adoption:${plan.snapshot}`,
        artifact: plan.blocked_child.failed_receipt,
      })
    closeMissionGap(mission, gap.id, {
      evidence: relativePath(context.targetDir, recordPath),
      authority: plan.successor.id,
      now: record.confirmed_at,
    })
    mission.status = 'paused'
    mission.convergence_disposition = 'needs_evidence'
    mission.successor_adoptions = [
      ...(mission.successor_adoptions || []).filter((item) => item.snapshot !== plan.snapshot),
      {
        successor: plan.successor.id,
        snapshot: plan.snapshot,
        record: relativePath(context.targetDir, recordPath),
      },
    ]
    mission.pending_transition = {
      node: 'final-verification',
      output: {
        passed: true,
        receipt: relativePath(context.targetDir, receiptPath),
        recoverable: false,
        disposition: 'evidence-closed',
      },
    }
    mission.next_action = `Resume with specdev mission run ${mission.id}; adopted evidence will be replayed without rerunning the command.`
    delete mission.blocker
    await writeMission(missionPath, mission)
    interrupt(options.interruptAfter, 'mission-written')
    journal = advanceJournal(journal, 'mission')
    await writeJsonAtomic(journalPath, journal)
  }

  if (!journal.write_progress.queue) {
    const queue = await readMissionQueue(missionPath)
    const child = queue.assignments.find((item) => item.id === plan.blocked_child.id)
    if (!child || !['running', 'completed'].includes(child.status)) {
      throw new Error('Blocked child queue state changed during adoption')
    }
    child.status = 'completed'
    child.follow_up = 'none'
    child.disposition = 'superseded-by-successor'
    child.superseded_by = plan.successor.id
    child.completed_at = child.completed_at || record.confirmed_at
    await writeMissionQueue(missionPath, queue)
    interrupt(options.interruptAfter, 'queue-written')
    journal = advanceJournal(journal, 'queue')
    await writeJsonAtomic(journalPath, journal)
  }

  if (!journal.write_progress.checkpoint) {
    const checkpoint = readCheckpoint(specdevPath, mission.run_id)
    const alreadyTransitioned =
      checkpoint.stack.length === 0 &&
      checkpoint.position.graph === 'mission-lifecycle' &&
      checkpoint.position.node === 'final-verification' &&
      checkpoint.outputs['child-assignment']?.successor === plan.successor.id
    if (alreadyTransitioned) {
      await ensureAdoptionTransition(context, checkpoint, plan, recordPath)
      journal = advanceJournal(journal, 'checkpoint')
      await writeJsonAtomic(journalPath, journal)
    } else if (digest(checkpoint) !== plan.blocked_child.checkpoint_digest) {
      throw new Error('Nested graph checkpoint changed after adoption planning')
    } else {
      const frame = checkpoint.stack.pop()
      const output = {
        approved: false,
        adopted: true,
        successor: plan.successor.id,
        evidence: relativePath(context.targetDir, recordPath),
      }
      const from = structuredClone(checkpoint.position)
      const artifact = writeNodeOutput(
        specdevPath,
        checkpoint.runId,
        frame.parent.node,
        output,
        frame.parent.scope
      )
      checkpoint.outputs[nodeOutputKey(frame.parent.scope, frame.parent.node)] = output
      checkpoint.position = { graph: 'mission-lifecycle', node: 'final-verification' }
      checkpoint.updatedAt = record.confirmed_at
      writeCheckpoint(specdevPath, checkpoint)
      interrupt(options.interruptAfter, 'checkpoint-written')
      appendTransition(specdevPath, checkpoint.runId, {
        ts: record.confirmed_at,
        op: 'reconcile',
        runId: checkpoint.runId,
        from,
        to: checkpoint.position,
        actor: 'specdev:mission-adopt-successor',
        input: { artifact, snapshot: plan.snapshot },
        output,
        validation: { ok: true },
        gateDecision: null,
        reason: 'confirmed reviewed standalone successor adoption',
        error: null,
      })
      interrupt(options.interruptAfter, 'transition-appended')
      journal = advanceJournal(journal, 'checkpoint')
      await writeJsonAtomic(journalPath, journal)
    }
  }

  journal = { ...journal, status: 'completed', completed_at: new Date().toISOString() }
  await writeJsonAtomic(journalPath, journal)
  return { plan, journal: journalPath, idempotent: false }
}

async function ensureAdoptionTransition(context, checkpoint, plan, recordPath) {
  const transitionPath = join(
    context.specdevPath,
    '.ripplegraph',
    'runs',
    checkpoint.runId,
    'transition-log.jsonl'
  )
  const entries = (await fse.readFile(transitionPath, 'utf8').catch(() => ''))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        throw new Error('Mission transition log is invalid during adoption recovery')
      }
    })
  if (
    entries.some(
      (entry) =>
        entry.actor === 'specdev:mission-adopt-successor' && entry.input?.snapshot === plan.snapshot
    )
  ) {
    return
  }
  const output = checkpoint.outputs['child-assignment']
  appendTransition(context.specdevPath, checkpoint.runId, {
    ts: checkpoint.updatedAt,
    op: 'reconcile',
    runId: checkpoint.runId,
    from: plan.blocked_child.checkpoint_position,
    to: checkpoint.position,
    actor: 'specdev:mission-adopt-successor',
    input: { artifact: 'artifacts/child-assignment/output.json', snapshot: plan.snapshot },
    output: output || {
      approved: false,
      adopted: true,
      successor: plan.successor.id,
      evidence: relativePath(context.targetDir, recordPath),
    },
    validation: { ok: true },
    gateDecision: null,
    reason: 'confirmed reviewed standalone successor adoption',
    error: null,
  })
}

async function negativeEvidence(assignmentPath) {
  const progress = await fse.readJson(join(assignmentPath, 'implementation', 'progress.json'))
  const failed = (progress.verification || []).filter((item) => item.status === 'failed')
  if (progress.follow_up !== 'required' || failed.length === 0) {
    throw new Error('Blocked child has no complete failed observation requiring follow-up')
  }
  return {
    progress: relativePathFromSpecdev(assignmentPath, 'implementation/progress.json'),
    command: failed.at(-1).command,
    revision: failed.at(-1).revision,
    digest: digest(failed.at(-1)),
  }
}

async function hashArtifacts(targetDir, paths) {
  const result = {}
  for (const [id, path] of Object.entries(paths)) {
    const bytes = await fse.readFile(path).catch(() => null)
    if (bytes === null) throw new Error(`Required adoption artifact is missing: ${id}`)
    result[id] = { path: relativePath(targetDir, path), sha256: sha256(bytes) }
  }
  return result
}

async function validateJournalPlanInputs(context, selector, plan) {
  const successor = await resolveAssignmentSelector(context.specdevPath, String(selector || ''))
  const status = successor
    ? await fse.readJson(join(successor.path, 'status.json')).catch(() => null)
    : null
  if (!successor || successor.ambiguous || status?.id !== plan.successor.id) {
    throw new Error('Retry successor selection differs from the prepared adoption plan')
  }
  if ((await requireGitHead(context.targetDir)) !== plan.successor.delivery_commit) {
    throw new Error('Current candidate changed after successor adoption was prepared')
  }
  for (const [id, artifact] of Object.entries(plan.artifacts || {})) {
    const path = join(context.targetDir, artifact.path)
    const bytes = await fse.readFile(path).catch(() => null)
    if (bytes === null || sha256(bytes) !== artifact.sha256) {
      throw new Error(`Prepared adoption artifact changed: ${id}`)
    }
  }
}

async function isAncestor(targetDir, ancestor, descendant) {
  if (!ancestor || !descendant) return false
  try {
    await execFile('git', ['merge-base', '--is-ancestor', ancestor, descendant], { cwd: targetDir })
    return true
  } catch {
    return false
  }
}

function advanceJournal(journal, key) {
  return {
    ...journal,
    status: `${key}-written`,
    updated_at: new Date().toISOString(),
    write_progress: { ...journal.write_progress, [key]: true },
  }
}

function interrupt(selected, boundary) {
  if (selected === boundary) {
    throw new Error(`Injected Mission successor adoption interruption after ${boundary}`)
  }
}

async function writeJsonAtomic(path, value) {
  const temporary = `${path}.tmp-${process.pid}`
  await fse.writeJson(temporary, value, { spaces: 2 })
  await fse.move(temporary, path, { overwrite: true })
}

async function assertJsonDigest(path, expected, label) {
  const value = await fse.readJson(path).catch(() => null)
  if (!value || digest(value) !== expected) throw new Error(`${label} changed during recovery`)
}

function relativePath(root, path) {
  return path.slice(root.length + 1).replaceAll('\\', '/')
}

function relativePathFromSpecdev(assignmentPath, suffix) {
  return `.specdev/assignments/${assignmentPath.split(/[/\\]/).at(-1)}/${suffix}`
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function authorizedCommand(content) {
  const matches = [...String(content || '').matchAll(/^\s*-\s+Command:\s*`([^`]+)`\s*$/gim)]
  return matches.length === 1 ? matches[0][1].trim() : ''
}

function digest(value) {
  return sha256(stableJson(value))
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}
