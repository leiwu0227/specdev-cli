import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { join, relative, resolve, sep } from 'node:path'
import Ajv from 'ajv'
import fse from 'fs-extra'
import { loadGraphPackage, readCheckpoint, writeCheckpoint } from 'ripplegraph'
import { parse, stringify } from 'yaml'
import { parseResultEnvelope } from './result-envelope.js'
import { readAttemptRecord } from './process-record.js'

const GRAPH_ID = 'mission-lifecycle'
const SOURCE_VERSION = '1.3.0'
const TARGET_VERSION = '1.4.0'
const MIGRATION_ID = `${GRAPH_ID}@${SOURCE_VERSION}-to-${TARGET_VERSION}`
const TARGET_PACKAGE_PATH = `workflows/${GRAPH_ID}@${TARGET_VERSION}`
const JOURNAL_NAME = 'mission-migration.json'
const ROOT_NODE_MAP = Object.freeze({ replan: 'resolve-gap' })
const TERMINAL_FAILURE_PREFIX = 'Pinned Mission graph cannot route evidence closure for gap '
const TERMINAL_FAILURE_SUFFIX = '; ending with an explicit infrastructure failure.'

export class MissionMigrationError extends Error {
  constructor(message, code = 'invalid-migration-state') {
    super(message)
    this.name = 'MissionMigrationError'
    this.code = code
  }
}

export class MissionMigrationInterruptionError extends Error {
  constructor(boundary) {
    super(`Injected Mission migration interruption after ${boundary}`)
    this.name = 'MissionMigrationInterruptionError'
    this.boundary = boundary
  }
}

export function readMissionMigrationJournal(specdevPath, runId) {
  const path = missionMigrationJournalPath(specdevPath, runId)
  if (!fse.existsSync(path)) return null
  try {
    const journal = fse.readJsonSync(path)
    return journal && typeof journal === 'object' && !Array.isArray(journal) ? journal : null
  } catch (error) {
    throw new MissionMigrationError(`Cannot read Mission migration journal: ${error.message}`)
  }
}

export async function readRecoveredTerminalVerification({ specdevPath, missionPath, mission }) {
  if (mission.terminal_recovery?.kind !== 'terminal-evidence-closure') return null
  const journal = readMissionMigrationJournal(specdevPath, mission.run_id)
  if (!journal || journal.status !== 'completed' || !journal.recovery) {
    throw terminalRecoveryError('The recovered Mission has no completed migration journal.')
  }
  validateJournal(journal, mission)
  if (mission.terminal_recovery.gap_id !== journal.recovery.gap_id) {
    throw terminalRecoveryError('The recovered Mission gap identity diverges from its journal.')
  }
  const arbiterPath = join(missionPath, 'review', `${journal.recovery.gap_id}-arbiter-result.md`)
  const receiptPath = join(missionPath, 'review', 'final-verification.json')
  const queue = await readYamlFile(join(missionPath, 'design', 'assignments.yaml'), 'Mission queue')
  const arbiterMarkdown = await readTextFile(arbiterPath, 'Terminal recovery arbiter result')
  const receiptBytes = await readTextFile(receiptPath, 'Terminal recovery verification receipt')
  const receipt = await readJsonFile(receiptPath, 'Terminal recovery verification receipt')
  if (
    journal.recovery.arbiter_result !== repoArtifactPath(specdevPath, arbiterPath) ||
    journal.recovery.verification_receipt !== repoArtifactPath(specdevPath, receiptPath) ||
    contentDigest(arbiterMarkdown) !== journal.recovery.arbiter_digest ||
    contentDigest(receiptBytes) !== journal.recovery.verification_digest ||
    receipt.status !== 'passed' ||
    receipt.command !== queue.final_verification?.command ||
    journal.recovery.verification_output?.receipt !== repoArtifactPath(specdevPath, receiptPath)
  ) {
    throw terminalRecoveryError('Recovered terminal evidence changed before Mission completion.')
  }
  let arbiter
  try {
    arbiter = parseResultEnvelope(arbiterMarkdown, 'reviewer')
  } catch (error) {
    throw terminalRecoveryError(`Recovered arbiter result is invalid: ${error.message}`)
  }
  if (arbiter.frontmatter.verdict !== 'approved') {
    throw terminalRecoveryError('Recovered arbiter evidence no longer records positive closure.')
  }
  return structuredClone(journal.recovery.verification_output)
}

export async function migrateActiveMission({
  specdevPath,
  missionPath,
  mission,
  interruptAfter = null,
  now = () => new Date().toISOString(),
}) {
  const journalPath = missionMigrationJournalPath(specdevPath, mission.run_id)
  const existingJournal = readMissionMigrationJournal(specdevPath, mission.run_id)
  const currentCheckpoint = readCheckpoint(specdevPath, mission.run_id)
  const currentMission = await readMissionFile(missionPath)

  if (existingJournal?.status === 'completed') {
    validateJournal(existingJournal, mission)
    if (
      digest(currentMission) !== existingJournal.target.mission_digest ||
      digest(currentCheckpoint) !== existingJournal.target.checkpoint_digest ||
      pinnedVersion(currentCheckpoint) !== TARGET_VERSION
    ) {
      throw new MissionMigrationError(
        'Completed Mission migration journal diverges from the durable Mission or checkpoint.'
      )
    }
    if (existingJournal.target.status_digest) {
      const currentStatus = await readJsonFile(
        join(missionPath, 'status.json'),
        'Mission status record'
      )
      if (digest(currentStatus) !== existingJournal.target.status_digest) {
        throw new MissionMigrationError(
          'Completed Mission migration journal diverges from the durable status record.'
        )
      }
    }
    return alreadyMigratedResult(currentMission, currentCheckpoint, journalPath, existingJournal)
  }
  if (!existingJournal && pinnedVersion(currentCheckpoint) === TARGET_VERSION) {
    validateMissionIdentity(currentMission, currentCheckpoint)
    const targetPackage = loadPinnedPackage(specdevPath, TARGET_PACKAGE_PATH, TARGET_VERSION)
    validateDurablePosition(specdevPath, currentCheckpoint, targetPackage.manifest)
    return alreadyMigratedResult(currentMission, currentCheckpoint, journalPath)
  }

  const plan = await planMigration({
    specdevPath,
    missionPath,
    mission,
    checkpoint: currentCheckpoint,
    journal: existingJournal,
  })
  let journal = existingJournal
  const resumed = Boolean(journal)

  if (!journal) {
    const timestamp = now()
    journal = {
      version: 1,
      migration: MIGRATION_ID,
      mission: mission.id,
      run_id: mission.run_id,
      status: 'prepared',
      from: graphIdentity(plan.sourceCheckpoint.graphSource),
      to: graphIdentity(plan.targetCheckpoint.graphSource),
      reason: plan.recovery
        ? 'Explicit terminal evidence-closure compatibility recovery requested by the operator.'
        : 'Explicit active Mission lifecycle migration requested by the operator.',
      created_at: timestamp,
      updated_at: timestamp,
      source: {
        mission_digest: digest(plan.sourceMission),
        checkpoint_digest: digest(plan.sourceCheckpoint),
        queue_digest: plan.queueDigest,
      },
      target: {
        mission_digest: digest(plan.targetMission),
        checkpoint_digest: digest(plan.targetCheckpoint),
      },
      write_progress: {
        journal_prepared: true,
        mission_updated: false,
        checkpoint_updated: false,
        completed: false,
      },
      ...(plan.recovery
        ? {
            recovery: plan.recovery,
            source: {
              mission_digest: digest(plan.sourceMission),
              checkpoint_digest: digest(plan.sourceCheckpoint),
              status_digest: digest(plan.sourceStatus),
              queue_digest: plan.queueDigest,
            },
            target: {
              mission_digest: digest(plan.targetMission),
              checkpoint_digest: digest(plan.targetCheckpoint),
              status_digest: digest(plan.targetStatus),
            },
            write_progress: {
              journal_prepared: true,
              mission_updated: false,
              status_updated: false,
              checkpoint_updated: false,
              completed: false,
            },
          }
        : {}),
    }
    await writeJsonAtomic(journalPath, journal)
    interrupt(interruptAfter, 'journal-prepared')
  }

  if (
    plan.queueDigest !== journal.source.queue_digest ||
    digest(plan.targetMission) !== journal.target.mission_digest ||
    digest(plan.targetCheckpoint) !== journal.target.checkpoint_digest ||
    (journal.target.status_digest && digest(plan.targetStatus) !== journal.target.status_digest)
  ) {
    throw new MissionMigrationError(
      'Mission migration inputs diverged from the prepared queue or target mapping; inspect them before retrying.'
    )
  }

  assertRecoverableDigest(
    'Mission record',
    digest(plan.currentMission),
    journal.source.mission_digest,
    journal.target.mission_digest
  )
  if (digest(plan.currentMission) !== journal.target.mission_digest) {
    await writeYamlAtomic(join(missionPath, 'mission.yaml'), plan.targetMission)
  }
  interrupt(interruptAfter, 'mission-written')

  journal = updateJournal(journal, now(), {
    status: 'mission-written',
    mission_updated: true,
  })
  await writeJsonAtomic(journalPath, journal)
  interrupt(interruptAfter, 'mission-progress-recorded')

  if (plan.targetStatus) {
    assertRecoverableDigest(
      'Mission status record',
      digest(plan.currentStatus),
      journal.source.status_digest,
      journal.target.status_digest
    )
    if (digest(plan.currentStatus) !== journal.target.status_digest) {
      await writeJsonAtomic(join(missionPath, 'status.json'), plan.targetStatus)
    }
    interrupt(interruptAfter, 'status-written')

    journal = updateJournal(journal, now(), {
      status: 'status-written',
      status_updated: true,
    })
    await writeJsonAtomic(journalPath, journal)
    interrupt(interruptAfter, 'status-progress-recorded')
  }

  assertRecoverableDigest(
    'RippleGraph checkpoint',
    digest(plan.currentCheckpoint),
    journal.source.checkpoint_digest,
    journal.target.checkpoint_digest
  )
  if (digest(plan.currentCheckpoint) !== journal.target.checkpoint_digest) {
    writeCheckpoint(specdevPath, plan.targetCheckpoint)
  }
  interrupt(interruptAfter, 'checkpoint-written')

  journal = updateJournal(journal, now(), {
    status: 'checkpoint-written',
    checkpoint_updated: true,
  })
  await writeJsonAtomic(journalPath, journal)
  interrupt(interruptAfter, 'checkpoint-progress-recorded')

  journal = updateJournal(journal, now(), {
    status: 'completed',
    completed: true,
    completed_at: now(),
  })
  await writeJsonAtomic(journalPath, journal)
  interrupt(interruptAfter, 'journal-completed')

  return {
    status: 'migrated',
    mission: mission.id,
    run_id: mission.run_id,
    from: journal.from,
    to: journal.to,
    resumed,
    already_migrated: false,
    evidence_transition_reused: plan.evidenceTransitionReused,
    terminal_recovery: Boolean(plan.recovery),
    journal: journalPath,
  }
}

async function planMigration({ specdevPath, missionPath, mission, checkpoint, journal }) {
  const currentMission = await readMissionFile(missionPath)
  if (currentMission.id !== mission.id || currentMission.run_id !== mission.run_id) {
    throw new MissionMigrationError('Mission record changed while migration was being prepared.')
  }
  const queuePath = join(missionPath, 'design', 'assignments.yaml')
  const queue = await readYamlFile(queuePath, 'Mission queue')
  validateQueueAndGaps(currentMission, queue)
  const targetPackage = loadPinnedPackage(specdevPath, TARGET_PACKAGE_PATH, TARGET_VERSION)
  if (journal) validateJournal(journal, mission)
  if (journal?.recovery) {
    return resumeTerminalRecoveryPlan({
      specdevPath,
      missionPath,
      currentMission,
      checkpoint,
      queue,
      targetGraph: targetPackage.manifest,
      journal,
    })
  }
  if (currentMission.status === 'failed' || checkpoint.status === 'completed') {
    return planTerminalRecovery({
      specdevPath,
      missionPath,
      currentMission,
      checkpoint,
      queue,
      targetGraph: targetPackage.manifest,
    })
  }

  validateMissionIdentity(currentMission, checkpoint)

  const checkpointVersion = pinnedVersion(checkpoint)
  if (![SOURCE_VERSION, TARGET_VERSION].includes(checkpointVersion)) {
    throw new MissionMigrationError(
      `Unsupported Mission migration source ${GRAPH_ID}@${checkpointVersion || 'unknown'}; only ${GRAPH_ID}@${SOURCE_VERSION} can migrate to @${TARGET_VERSION}.`,
      'unsupported-version'
    )
  }
  if (checkpointVersion === TARGET_VERSION && !journal) {
    throw new MissionMigrationError(
      `Mission ${mission.id} is already pinned to ${GRAPH_ID}@${TARGET_VERSION}.`
    )
  }
  const rootPackage =
    checkpointVersion === SOURCE_VERSION
      ? loadSourcePackage(specdevPath, checkpoint.graphSource)
      : targetPackage
  validateDurablePosition(specdevPath, checkpoint, rootPackage.manifest)

  const missionMapping = mapMissionRecord(currentMission, checkpoint, targetPackage.manifest, {
    allowMappedTransition: Boolean(
      journal && digest(currentMission) === journal.target.mission_digest
    ),
  })
  const targetCheckpoint = mapCheckpoint(checkpoint, targetPackage.manifest)
  validateMappedPosition(targetCheckpoint, targetPackage.manifest)

  return {
    currentMission,
    currentCheckpoint: checkpoint,
    sourceMission: missionMapping.sourceMission,
    sourceCheckpoint:
      checkpointVersion === SOURCE_VERSION ? checkpoint : reverseCheckpoint(checkpoint),
    targetMission: missionMapping.targetMission,
    targetCheckpoint,
    evidenceTransitionReused: missionMapping.evidenceTransitionReused,
    queueDigest: digest(queue),
  }
}

function validateMissionIdentity(mission, checkpoint) {
  validateMissionAuthority(mission, checkpoint)
  if (!mission || typeof mission !== 'object')
    throw new MissionMigrationError('Mission is missing.')
  if (['completed', 'failed'].includes(mission.status)) {
    throw new MissionMigrationError(
      `Mission ${mission.id} is terminal (${mission.status}); active migration only accepts non-terminal Missions.`,
      'terminal-mission'
    )
  }
  if (!['active', 'suspended'].includes(checkpoint.status)) {
    throw new MissionMigrationError(
      `Mission run ${checkpoint.runId} is ${checkpoint.status}; active migration requires an active or suspended run.`
    )
  }
}

function validateMissionAuthority(mission, checkpoint) {
  if (!mission || typeof mission !== 'object')
    throw new MissionMigrationError('Mission is missing.')
  if (!mission.id || !mission.run_id) {
    throw new MissionMigrationError('Mission identity and run_id are required for migration.')
  }
  if (checkpoint.runId !== mission.run_id || checkpoint.rootGraph !== GRAPH_ID) {
    throw new MissionMigrationError('Mission identity does not match its durable RippleGraph run.')
  }
  if (!mission.approved_contract_hash || !mission.approved_at) {
    throw new MissionMigrationError('Mission approval authority is incomplete.')
  }
}

async function planTerminalRecovery({
  specdevPath,
  missionPath,
  currentMission,
  checkpoint,
  queue,
  targetGraph,
}) {
  validateMissionAuthority(currentMission, checkpoint)
  if (pinnedVersion(checkpoint) !== SOURCE_VERSION) {
    throw terminalRecoveryError(
      `Terminal recovery only accepts ${GRAPH_ID}@${SOURCE_VERSION}; this run is pinned to @${pinnedVersion(checkpoint) || 'unknown'}.`
    )
  }
  const sourcePackage = loadSourcePackage(specdevPath, checkpoint.graphSource)
  validateDurablePosition(specdevPath, checkpoint, sourcePackage.manifest)
  if (
    currentMission.status !== 'failed' ||
    currentMission.disposition !== 'infrastructure-failure'
  ) {
    throw terminalRecoveryError(
      `Mission ${currentMission.id} is not the historical infrastructure-failure candidate.`
    )
  }
  if (
    checkpoint.status !== 'completed' ||
    checkpoint.position?.graph !== GRAPH_ID ||
    checkpoint.position?.node !== 'failed' ||
    checkpoint.stack?.length !== 0
  ) {
    throw terminalRecoveryError(
      'The durable run is not the exact terminal failed position required for recovery.'
    )
  }

  const failureReason = String(currentMission.blocker || '')
  const gapId = terminalFailureGapId(failureReason)
  if (!gapId) {
    throw terminalRecoveryError(
      'The Mission blocker does not match the historical pinned-graph evidence-closure signature.'
    )
  }
  const gaps = currentMission.gaps?.items || []
  const matches = gaps.filter((gap) => gap?.id === gapId)
  if (matches.length !== 1) {
    throw terminalRecoveryError(
      `The recovery signature references gap ${gapId}, but the durable gap identity is missing or ambiguous.`
    )
  }
  const gap = matches[0]
  if (
    gap.status !== 'failed' ||
    gap.stage !== 'arbiter' ||
    gap.disposition !== 'infrastructure-failure' ||
    gap.reason !== failureReason ||
    !gap.source?.key
  ) {
    throw terminalRecoveryError(
      `Gap ${gapId} does not carry the exact terminal evidence-closure fallback state.`
    )
  }
  if (
    (queue.assignments || []).some((item) => !['completed', 'integrated'].includes(item.status))
  ) {
    throw terminalRecoveryError(
      'Terminal recovery requires every queued Assignment to be completed or integrated.'
    )
  }

  const legacyOutput = checkpoint.outputs?.replan
  if (
    !legacyOutput ||
    checkpoint.finalOutput === undefined ||
    !isDeepStrictEqual(checkpoint.finalOutput, legacyOutput) ||
    legacyOutput.disposition !== 'objective-failure' ||
    legacyOutput.gap_id !== gapId ||
    legacyOutput.stage !== 'arbiter' ||
    legacyOutput.reason !== gap.source.key ||
    legacyOutput.attempt !== gap.evidence ||
    legacyOutput.gap_open !== false ||
    legacyOutput.remaining !== false
  ) {
    throw terminalRecoveryError(
      `The terminal replan transition does not match gap ${gapId} and its historical fallback signature.`
    )
  }

  const runPath = join(specdevPath, '.ripplegraph', 'runs', currentMission.run_id)
  const legacyArtifact = await readJsonFile(
    join(runPath, 'artifacts', 'replan', 'output.json'),
    'Terminal replan artifact'
  )
  if (!isDeepStrictEqual(legacyArtifact, legacyOutput)) {
    throw terminalRecoveryError('The terminal replan artifact diverges from the checkpoint output.')
  }
  await validateTerminalTransitionLog(runPath, currentMission.run_id)

  const attemptId = String(gap.evidence || '')
  const arbiterPath = join(missionPath, 'review', `${gapId}-arbiter-result.md`)
  const arbiterRelative = repoArtifactPath(specdevPath, arbiterPath)
  const attempt = await readAttemptRecord(specdevPath, attemptId)
  if (
    !attempt ||
    attempt.id !== attemptId ||
    attempt.kind !== 'reviewer' ||
    attempt.status !== 'completed' ||
    attempt.mission !== currentMission.id ||
    !attempt.provider ||
    attempt.result_path !== arbiterRelative
  ) {
    throw terminalRecoveryError(
      `Gap ${gapId} does not reference one completed Mission arbiter Attempt and result.`
    )
  }
  const arbiterMarkdown = await readTextFile(arbiterPath, `Gap ${gapId} arbiter result`)
  let arbiter
  try {
    arbiter = parseResultEnvelope(arbiterMarkdown, 'reviewer')
  } catch (error) {
    throw terminalRecoveryError(`Gap ${gapId} arbiter result is invalid: ${error.message}`)
  }
  if (arbiter.frontmatter.verdict !== 'approved') {
    throw terminalRecoveryError(`Gap ${gapId} lacks durable positive arbiter closure evidence.`)
  }

  const receiptPath = join(missionPath, 'review', 'final-verification.json')
  const receipt = await readJsonFile(receiptPath, 'Mission final-verification receipt')
  if (
    receipt.status !== 'passed' ||
    !receipt.command ||
    receipt.command !== queue.final_verification?.command ||
    !receipt.revision ||
    !Number.isFinite(Number(receipt.duration_ms))
  ) {
    throw terminalRecoveryError(
      'The terminal candidate lacks a passed final-verification receipt matching the approved queue command.'
    )
  }

  const statusPath = join(missionPath, 'status.json')
  const sourceStatus = await readJsonFile(statusPath, 'Mission status record')
  if (
    sourceStatus.status !== 'failed' ||
    sourceStatus.disposition !== 'infrastructure-failure' ||
    sourceStatus.reason !== failureReason
  ) {
    throw terminalRecoveryError(
      'The durable Mission status record does not match the terminal recovery signature.'
    )
  }

  const resolutionOutput = recoveredResolutionOutput(legacyOutput)
  const verificationOutput = {
    passed: true,
    receipt: repoArtifactPath(specdevPath, receiptPath),
    recoverable: false,
    disposition: 'evidence-closed',
  }
  const reviewOutput = {
    approved: true,
    verdict: arbiterRelative,
    attempt: attemptId,
    disposition: 'approved',
  }
  validateTargetOutput(targetGraph, 'resolve-gap', resolutionOutput)
  validateTargetOutput(targetGraph, 'mission-review', reviewOutput)
  validateTargetOutput(targetGraph, 'final-verification', verificationOutput)
  const recovery = {
    kind: 'terminal-evidence-closure',
    gap_id: gapId,
    attempt: attemptId,
    closed_at: attempt.ended_at || gap.updated_at || currentMission.failed_at,
    failure_reason: failureReason,
    arbiter_result: arbiterRelative,
    arbiter_digest: contentDigest(arbiterMarkdown),
    verification_receipt: verificationOutput.receipt,
    verification_digest: contentDigest(await fse.readFile(receiptPath, 'utf8')),
    resolution_output: resolutionOutput,
    review_output: reviewOutput,
    verification_output: verificationOutput,
  }
  const targetMission = recoverTerminalMission(currentMission, recovery)
  const targetCheckpoint = recoverTerminalCheckpoint(checkpoint, targetGraph, recovery)
  const targetStatus = { version: 1, status: 'paused' }
  validateMappedPosition(targetCheckpoint, targetGraph)

  return {
    currentMission,
    currentCheckpoint: checkpoint,
    currentStatus: sourceStatus,
    sourceMission: currentMission,
    sourceCheckpoint: checkpoint,
    sourceStatus,
    targetMission,
    targetCheckpoint,
    targetStatus,
    evidenceTransitionReused: true,
    queueDigest: digest(queue),
    recovery,
  }
}

async function resumeTerminalRecoveryPlan({
  specdevPath,
  missionPath,
  currentMission,
  checkpoint,
  queue,
  targetGraph,
  journal,
}) {
  const statusPath = join(missionPath, 'status.json')
  const currentStatus = await readJsonFile(statusPath, 'Mission status record')
  assertRecoverableDigest(
    'Mission record',
    digest(currentMission),
    journal.source.mission_digest,
    journal.target.mission_digest
  )
  assertRecoverableDigest(
    'RippleGraph checkpoint',
    digest(checkpoint),
    journal.source.checkpoint_digest,
    journal.target.checkpoint_digest
  )
  assertRecoverableDigest(
    'Mission status record',
    digest(currentStatus),
    journal.source.status_digest,
    journal.target.status_digest
  )
  if (digest(queue) !== journal.source.queue_digest) {
    throw terminalRecoveryError('The Mission queue changed after terminal recovery was prepared.')
  }
  const arbiterPath = join(missionPath, 'review', `${journal.recovery.gap_id}-arbiter-result.md`)
  const receiptPath = join(missionPath, 'review', 'final-verification.json')
  if (
    journal.recovery.arbiter_result !== repoArtifactPath(specdevPath, arbiterPath) ||
    journal.recovery.verification_receipt !== repoArtifactPath(specdevPath, receiptPath) ||
    terminalFailureGapId(journal.recovery.failure_reason) !== journal.recovery.gap_id ||
    journal.recovery.resolution_output?.gap_id !== journal.recovery.gap_id ||
    journal.recovery.resolution_output?.attempt !== journal.recovery.attempt ||
    journal.recovery.review_output?.attempt !== journal.recovery.attempt ||
    journal.recovery.review_output?.verdict !== journal.recovery.arbiter_result
  ) {
    throw terminalRecoveryError(
      'The prepared terminal recovery identity or evidence paths changed.'
    )
  }
  const arbiterMarkdown = await readTextFile(arbiterPath, 'Terminal recovery arbiter result')
  const receiptBytes = await readTextFile(receiptPath, 'Terminal recovery verification receipt')
  if (
    contentDigest(arbiterMarkdown) !== journal.recovery.arbiter_digest ||
    contentDigest(receiptBytes) !== journal.recovery.verification_digest
  ) {
    throw terminalRecoveryError(
      'Terminal recovery evidence changed after the migration journal was prepared.'
    )
  }

  const targetMission =
    digest(currentMission) === journal.target.mission_digest
      ? currentMission
      : recoverTerminalMission(currentMission, journal.recovery)
  const targetCheckpoint =
    digest(checkpoint) === journal.target.checkpoint_digest
      ? checkpoint
      : recoverTerminalCheckpoint(checkpoint, targetGraph, journal.recovery)
  const targetStatus =
    digest(currentStatus) === journal.target.status_digest
      ? currentStatus
      : { version: 1, status: 'paused' }
  return {
    currentMission,
    currentCheckpoint: checkpoint,
    currentStatus,
    sourceMission: currentMission,
    sourceCheckpoint: checkpoint,
    sourceStatus: currentStatus,
    targetMission,
    targetCheckpoint,
    targetStatus,
    evidenceTransitionReused: true,
    queueDigest: digest(queue),
    recovery: journal.recovery,
  }
}

function recoverTerminalMission(source, recovery) {
  const target = structuredClone(source)
  const gap = target.gaps?.items?.find((item) => item.id === recovery.gap_id)
  if (!gap) throw terminalRecoveryError(`Recovery gap ${recovery.gap_id} is missing.`)
  target.status = 'paused'
  target.next_action = `Resume with specdev mission run ${target.id}.`
  delete target.disposition
  delete target.blocker
  delete target.failed_at
  delete target.gap_summary
  gap.status = 'closed'
  gap.disposition = 'evidence-closed'
  gap.evidence = recovery.arbiter_result
  gap.closed_at = recovery.closed_at
  gap.updated_at = gap.closed_at
  delete gap.reason
  delete gap.failed_at
  target.pending_transition = {
    node: 'mission-review',
    output: structuredClone(recovery.review_output),
  }
  target.terminal_recovery = {
    kind: recovery.kind,
    gap_id: recovery.gap_id,
  }
  return target
}

function recoverTerminalCheckpoint(source, targetGraph, recovery) {
  const target = structuredClone(source)
  target.graphSource = targetGraphSource(targetGraph)
  target.status = 'suspended'
  target.position = { graph: GRAPH_ID, node: 'mission-review' }
  target.outputs['resolve-gap'] = structuredClone(recovery.resolution_output)
  target.resumeNote = 'terminal evidence-closure compatibility recovery'
  delete target.finalOutput
  return target
}

function recoveredResolutionOutput(output) {
  return {
    queue: output.queue,
    reason: output.reason,
    gap_id: output.gap_id,
    stage: output.stage,
    attempt: output.attempt,
    disposition: 'evidence-closed',
    gap_open: false,
    remaining: false,
    parallel: false,
  }
}

function terminalFailureGapId(reason) {
  if (!reason.startsWith(TERMINAL_FAILURE_PREFIX) || !reason.endsWith(TERMINAL_FAILURE_SUFFIX)) {
    return null
  }
  const gapId = reason.slice(TERMINAL_FAILURE_PREFIX.length, -TERMINAL_FAILURE_SUFFIX.length)
  return /^gap-[a-z0-9-]+$/.test(gapId) ? gapId : null
}

async function validateTerminalTransitionLog(runPath, runId) {
  const content = await readTextFile(
    join(runPath, 'transition-log.jsonl'),
    'Mission transition log'
  )
  let entries
  try {
    entries = content
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  } catch (error) {
    throw terminalRecoveryError(`Mission transition log is invalid: ${error.message}`)
  }
  const matches = entries.filter(
    (entry) =>
      entry.runId === runId &&
      entry.op === 'step' &&
      entry.from?.graph === GRAPH_ID &&
      entry.from?.node === 'replan' &&
      entry.to?.graph === GRAPH_ID &&
      entry.to?.node === 'failed' &&
      entry.validation?.ok === true &&
      entry.output?.artifact === 'artifacts/replan/output.json'
  )
  if (matches.length !== 1) {
    throw terminalRecoveryError(
      'The transition log does not contain one exact successful replan-to-failed fallback.'
    )
  }
}

function repoArtifactPath(specdevPath, absolutePath) {
  return `.specdev/${relative(specdevPath, absolutePath).replaceAll('\\', '/')}`
}

function terminalRecoveryError(message) {
  return new MissionMigrationError(
    `${message} Terminal Mission recovery was rejected without mutation; inspect the recorded failure, gap, arbiter result, verification receipt, and pinned run.`,
    'terminal-recovery-rejected'
  )
}

function validateQueueAndGaps(mission, queue) {
  if (!queue || !Array.isArray(queue.assignments)) {
    throw new MissionMigrationError('Mission queue must contain an assignments list.')
  }
  const ids = queue.assignments.map((item) => String(item?.id || '').trim())
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
    throw new MissionMigrationError('Mission queue has missing or duplicate Assignment identities.')
  }
  const gaps = mission.gaps
  if (gaps !== undefined) {
    if (
      gaps?.version !== 1 ||
      !Array.isArray(gaps.items) ||
      !Array.isArray(gaps.processed_signals)
    ) {
      throw new MissionMigrationError('Mission gap state is incomplete or unsupported.')
    }
    const gapIds = gaps.items.map((gap) => String(gap?.id || '').trim())
    if (gapIds.some((id) => !id) || new Set(gapIds).size !== gapIds.length) {
      throw new MissionMigrationError('Mission gap state has missing or duplicate identities.')
    }
    const knownGaps = new Set(gapIds)
    for (const item of queue.assignments) {
      if (item.gap_id && !knownGaps.has(item.gap_id)) {
        throw new MissionMigrationError(
          `Mission queue Assignment ${item.id} references unknown gap ${item.gap_id}.`
        )
      }
    }
  }
}

function mapMissionRecord(
  mission,
  checkpoint,
  targetGraph,
  { allowMappedTransition = false } = {}
) {
  const sourceMission = structuredClone(mission)
  const targetMission = structuredClone(mission)
  const transition = targetMission.pending_transition
  let evidenceTransitionReused = false
  if (transition) {
    if (!transition.node || !transition.output || typeof transition.output !== 'object') {
      throw new MissionMigrationError('Mission pending transition is incomplete.')
    }
    const sourcePhase = rootMissionPhase(checkpoint)
    const expectedPhase = allowMappedTransition ? mapRootNode(sourcePhase) : sourcePhase
    if (transition.node !== expectedPhase) {
      throw new MissionMigrationError(
        `Mission pending transition ${transition.node} diverges from durable phase ${expectedPhase}.`
      )
    }
    transition.node = mapRootNode(transition.node)
    transition.output = mapPendingOutput(transition.node, transition.output)
    validateTargetOutput(targetGraph, transition.node, transition.output)
    evidenceTransitionReused = transition.output.disposition === 'evidence-closed'
  }

  const targetPhase = mapRootNode(rootMissionPhase(checkpoint))
  if (targetPhase === 'resolve-gap' && !transition) {
    const hasLegacyTrigger = Boolean(targetMission.pending_replan)
    const actionable = (targetMission.gaps?.items || []).filter(
      (gap) => gap.status === 'open' && ['resolution', 'resolver', 'arbiter'].includes(gap.stage)
    )
    if (!hasLegacyTrigger && actionable.length !== 1) {
      throw new MissionMigrationError(
        'Pinned replan state has no single actionable durable gap or legacy replan trigger; migration cannot infer a resolve-gap position.'
      )
    }
  }
  return { sourceMission, targetMission, evidenceTransitionReused }
}

function mapPendingOutput(node, output) {
  const mapped = structuredClone(output)
  if (['advance-queue', 'advance-wave'].includes(node) && mapped.gap_open === undefined) {
    mapped.gap_open = Boolean(mapped.follow_up_required)
  }
  if (node === 'mission-review' && mapped.disposition === 'objective-failure') {
    mapped.disposition = 'semantic-failure'
  }
  return mapped
}

function mapCheckpoint(checkpoint, targetGraph) {
  const mapped = structuredClone(checkpoint)
  mapped.graphSource = targetGraphSource(targetGraph)
  if (mapped.position.graph === GRAPH_ID) mapped.position.node = mapRootNode(mapped.position.node)
  for (const frame of mapped.stack || []) {
    if (frame.parent.graph !== GRAPH_ID) continue
    frame.parent.node = mapRootNode(frame.parent.node)
    frame.parent.graphSource = targetGraphSource(targetGraph)
  }
  return mapped
}

function reverseCheckpoint(checkpoint) {
  const reversed = structuredClone(checkpoint)
  reversed.graphSource = sourceGraphSource()
  if (reversed.position.graph === GRAPH_ID && reversed.position.node === 'resolve-gap') {
    reversed.position.node = 'replan'
  }
  for (const frame of reversed.stack || []) {
    if (frame.parent.graph !== GRAPH_ID) continue
    if (frame.parent.node === 'resolve-gap') frame.parent.node = 'replan'
    frame.parent.graphSource = sourceGraphSource()
  }
  return reversed
}

function validateMappedPosition(checkpoint, targetGraph) {
  const rootPhase = rootMissionPhase(checkpoint)
  if (!targetGraph.nodes?.[rootPhase]) {
    throw new MissionMigrationError(
      `Mission phase ${rootPhase || 'unknown'} has no exact ${GRAPH_ID}@${TARGET_VERSION} mapping.`
    )
  }
  for (const frame of checkpoint.stack || []) {
    if (frame.parent.graph === GRAPH_ID && !targetGraph.nodes?.[frame.parent.node]) {
      throw new MissionMigrationError(
        `Mission stack phase ${frame.parent.node} has no exact ${GRAPH_ID}@${TARGET_VERSION} mapping.`
      )
    }
  }
}

function validateDurablePosition(specdevPath, checkpoint, rootGraph) {
  let activeGraph = rootGraph
  for (const frame of checkpoint.stack || []) {
    if (
      frame.parent.graph !== activeGraph.id ||
      !activeGraph.nodes?.[frame.parent.node] ||
      frame.child.graphId === GRAPH_ID
    ) {
      throw new MissionMigrationError(
        `Mission stack position ${frame.parent.graph}/${frame.parent.node} is incomplete or ambiguous.`
      )
    }
    activeGraph = loadGraphSourcePackage(
      specdevPath,
      frame.child,
      `Mission child graph ${frame.child.graphId}@${frame.child.graphVersion}`
    ).manifest
  }
  if (
    checkpoint.position.graph !== activeGraph.id ||
    !activeGraph.nodes?.[checkpoint.position.node]
  ) {
    throw new MissionMigrationError(
      `Durable position ${checkpoint.position.graph}/${checkpoint.position.node} is not present in its pinned graph package.`
    )
  }
}

function validateTargetOutput(graph, node, output) {
  const schema = graph.nodes?.[node]?.outputSchema
  if (!schema) throw new MissionMigrationError(`Target Mission node ${node} has no output schema.`)
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema)
  if (validate(output)) return
  const detail = (validate.errors || [])
    .map((error) => `${error.instancePath || '<output>'} ${error.message}`)
    .join('; ')
  throw new MissionMigrationError(
    `Mission pending transition cannot map exactly to ${node}: ${detail || 'schema mismatch'}.`
  )
}

function loadSourcePackage(specdevPath, source) {
  if (
    source?.kind !== 'package' ||
    source.graphId !== GRAPH_ID ||
    source.graphVersion !== SOURCE_VERSION ||
    !source.packagePath
  ) {
    throw new MissionMigrationError(`Pinned run does not identify ${GRAPH_ID}@${SOURCE_VERSION}.`)
  }
  return loadPinnedPackage(specdevPath, source.packagePath, SOURCE_VERSION)
}

function loadPinnedPackage(specdevPath, packagePath, expectedVersion) {
  const workflowRoot = resolve(specdevPath)
  const packageRoot = resolve(workflowRoot, packagePath)
  if (packageRoot !== workflowRoot && !packageRoot.startsWith(`${workflowRoot}${sep}`)) {
    throw new MissionMigrationError(
      `Pinned graph package path escapes the workflow root: ${packagePath}`
    )
  }
  let loaded
  try {
    loaded = loadGraphPackage(packageRoot)
  } catch (error) {
    throw new MissionMigrationError(
      `Cannot load ${GRAPH_ID}@${expectedVersion} graph package: ${error.message}`
    )
  }
  if (loaded.manifest.id !== GRAPH_ID || loaded.manifest.version !== expectedVersion) {
    throw new MissionMigrationError(
      `Graph package metadata does not match ${GRAPH_ID}@${expectedVersion}.`
    )
  }
  return loaded
}

function loadGraphSourcePackage(specdevPath, source, label) {
  if (
    source?.kind !== 'package' ||
    !source.graphId ||
    !source.graphVersion ||
    !source.packagePath
  ) {
    throw new MissionMigrationError(`${label} metadata is incomplete.`)
  }
  const workflowRoot = resolve(specdevPath)
  const packageRoot = resolve(workflowRoot, source.packagePath)
  if (packageRoot !== workflowRoot && !packageRoot.startsWith(`${workflowRoot}${sep}`)) {
    throw new MissionMigrationError(`${label} package path escapes the workflow root.`)
  }
  let loaded
  try {
    loaded = loadGraphPackage(packageRoot)
  } catch (error) {
    throw new MissionMigrationError(`Cannot load ${label}: ${error.message}`)
  }
  if (loaded.manifest.id !== source.graphId || loaded.manifest.version !== source.graphVersion) {
    throw new MissionMigrationError(`${label} metadata does not match its package.`)
  }
  return loaded
}

function validateJournal(journal, mission) {
  if (
    journal.version !== 1 ||
    journal.migration !== MIGRATION_ID ||
    journal.mission !== mission.id ||
    journal.run_id !== mission.run_id ||
    !journal.source ||
    !journal.target ||
    !journal.write_progress
  ) {
    throw new MissionMigrationError(
      'Mission migration journal is incomplete or belongs to another run.'
    )
  }
  if (
    journal.recovery &&
    (journal.recovery.kind !== 'terminal-evidence-closure' ||
      !journal.recovery.gap_id ||
      !journal.recovery.attempt ||
      !journal.recovery.closed_at ||
      !journal.recovery.arbiter_result ||
      !journal.recovery.arbiter_digest ||
      !journal.recovery.verification_receipt ||
      !journal.recovery.verification_digest ||
      !journal.recovery.resolution_output ||
      !journal.recovery.review_output ||
      !journal.recovery.verification_output ||
      !journal.source.status_digest ||
      !journal.target.status_digest)
  ) {
    throw new MissionMigrationError('Mission terminal recovery journal is incomplete.')
  }
}

function updateJournal(journal, timestamp, { status, completed_at, ...progress }) {
  return {
    ...journal,
    status,
    updated_at: timestamp,
    ...(completed_at ? { completed_at } : {}),
    write_progress: { ...journal.write_progress, ...progress },
  }
}

function alreadyMigratedResult(mission, checkpoint, journalPath, journal = null) {
  return {
    status: 'migrated',
    mission: mission.id,
    run_id: mission.run_id,
    from: journal?.from || graphIdentity(checkpoint.graphSource),
    to: journal?.to || graphIdentity(checkpoint.graphSource),
    resumed: false,
    already_migrated: true,
    evidence_transition_reused: Boolean(journal?.recovery),
    terminal_recovery: Boolean(journal?.recovery),
    journal: fse.existsSync(journalPath) ? journalPath : null,
  }
}

function assertRecoverableDigest(label, actual, source, target) {
  if (actual !== source && actual !== target) {
    throw new MissionMigrationError(
      `${label} diverged from both the prepared source and target state; inspect it before retrying.`
    )
  }
}

function pinnedVersion(checkpoint) {
  return checkpoint?.graphSource?.graphId === GRAPH_ID ? checkpoint.graphSource.graphVersion : null
}

function rootMissionPhase(checkpoint) {
  if (checkpoint.position?.graph === GRAPH_ID) return checkpoint.position.node || null
  return checkpoint.stack?.[0]?.parent?.node || null
}

function mapRootNode(node) {
  return ROOT_NODE_MAP[node] || node
}

function targetGraphSource(graph) {
  return {
    kind: 'package',
    graphId: GRAPH_ID,
    graphVersion: TARGET_VERSION,
    packagePath: TARGET_PACKAGE_PATH,
  }
}

function sourceGraphSource() {
  return {
    kind: 'package',
    graphId: GRAPH_ID,
    graphVersion: SOURCE_VERSION,
    packagePath: `workflows/${GRAPH_ID}@${SOURCE_VERSION}`,
  }
}

function graphIdentity(source) {
  return {
    id: source.graphId,
    version: source.graphVersion,
    package_path: source.packagePath,
  }
}

function missionMigrationJournalPath(specdevPath, runId) {
  return join(specdevPath, '.ripplegraph', 'runs', runId, JOURNAL_NAME)
}

async function readMissionFile(missionPath) {
  return readYamlFile(join(missionPath, 'mission.yaml'), 'Mission record')
}

async function readYamlFile(path, label) {
  if (!(await fse.pathExists(path))) throw new MissionMigrationError(`${label} is missing.`)
  let value
  try {
    value = parse(await fse.readFile(path, 'utf8'))
  } catch (error) {
    throw new MissionMigrationError(`${label} is unreadable: ${error.message}`)
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MissionMigrationError(`${label} must be a YAML mapping.`)
  }
  return value
}

async function readJsonFile(path, label) {
  if (!(await fse.pathExists(path))) throw terminalRecoveryError(`${label} is missing.`)
  try {
    const value = await fse.readJson(path)
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('must be a JSON object')
    }
    return value
  } catch (error) {
    if (error instanceof MissionMigrationError) throw error
    throw terminalRecoveryError(`${label} is unreadable: ${error.message}`)
  }
}

async function readTextFile(path, label) {
  if (!(await fse.pathExists(path))) throw terminalRecoveryError(`${label} is missing.`)
  try {
    return await fse.readFile(path, 'utf8')
  } catch (error) {
    throw terminalRecoveryError(`${label} is unreadable: ${error.message}`)
  }
}

async function writeYamlAtomic(path, value) {
  const temporary = `${path}.tmp-${process.pid}`
  await fse.writeFile(temporary, stringify(value, { lineWidth: 0 }), 'utf8')
  await fse.move(temporary, path, { overwrite: true })
}

async function writeJsonAtomic(path, value) {
  const temporary = `${path}.tmp-${process.pid}`
  await fse.writeJson(temporary, value, { spaces: 2 })
  await fse.move(temporary, path, { overwrite: true })
}

function digest(value) {
  return createHash('sha256')
    .update(JSON.stringify(sortValue(value)))
    .digest('hex')
}

function contentDigest(value) {
  return createHash('sha256').update(String(value)).digest('hex')
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortValue(value[key])])
  )
}

function interrupt(expected, boundary) {
  if (expected === boundary) throw new MissionMigrationInterruptionError(boundary)
}
