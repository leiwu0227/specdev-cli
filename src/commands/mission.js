import { spawn } from 'node:child_process'
import { execFile as execFileCallback } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import fse from 'fs-extra'
import { getState, listRuns, readCheckpoint, resumeRun, suspendRun } from 'ripplegraph'
import { parse as parseYaml } from 'yaml'
import { resolveAgentProfile } from '../utils/agent-profiles.js'
import { parseResultEnvelope } from '../utils/result-envelope.js'
import {
  ASSIGNMENT_KINDS,
  assignmentContractTemplate,
  contractPreview,
  discussionArtifactHash,
  gitSnapshot,
  relativeToRepo,
  validateContractPath,
  writeAssignmentStatus,
} from '../utils/assignment-vnext.js'
import { readGuidedCall } from '../utils/callable-sync.js'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'
import { writeCurrentFocus } from '../utils/current.js'
import { resolveDiscussionSelector } from '../utils/discussion.js'
import { decideGuidedNode, startGuidedRun, stepGuidedNode } from '../utils/engine-sync.js'
import { workflowRootFor } from '../utils/engine.js'
import { reserveEntityId } from '../utils/id-reservation.js'
import {
  assertMissionTransitionRecorded,
  bindReplannedQueueToGap,
  missionGapTransitionDisposition,
  normalizeMissionGapResolutionForGraph,
  readMission,
  readMissionQueue,
  resolveMissionSelector,
  validateAndReserveReplannedQueue,
  writeMission,
  writeMissionQueue,
} from '../utils/mission.js'
import {
  attemptActivitySummary,
  attemptLiveness,
  clearLocalProcessMarker,
  createAttemptRecord,
  listAttemptRecords,
  updateAttemptRecord,
  writeLocalProcessMarker,
} from '../utils/process-record.js'
import { productStateDigest, runSpawnedAgent } from '../utils/spawned-agent.js'
import {
  currentMissionWave,
  integratableMissionPrefix,
  MAX_PARALLEL_MISSION_CHILDREN,
  missionIntegrationRecoveryAction,
  missionQueueHasRemaining,
  missionWaveItems,
  missionWaveIsParallel,
  normalizeMissionWaves,
  validateMissionQueueStatuses,
} from '../utils/mission-waves.js'
import {
  createMissionChildDelivery,
  ensureMissionWorktree,
  listMissionWorktrees,
  missionChildBranch,
  removeMissionWorktree,
} from '../utils/mission-worktrees.js'
import { inspectMissionLanding, landMission } from '../utils/mission-landing.js'
import { assignmentCommand } from './assignment.js'
import { checkpointCommand } from './checkpoint.js'
import { implementCommand } from './implement.js'
import { reviewBrainstorm } from './reviewloop.js'
import {
  compactCompletedWorkflowRuntime,
  retireTransientArtifact,
} from '../utils/artifact-retention.js'
import { workspaceChangeSummaryLines } from '../utils/workspace-changes.js'
import {
  actionableMissionGap,
  adoptLegacyMissionReplan,
  advanceMissionGap,
  attachMissionGapAssignment,
  awaitMissionGapValidation,
  closeMissionGap,
  compactMissionGaps,
  failMissionGap,
  missionGap,
  missionGapForSource,
  openMissionGap,
  recordMissionSourceGap,
} from '../utils/mission-gaps.js'
import {
  initialAutomaticReviewState,
  recordArbitration,
  recordPrimaryReview,
  recordResolver,
} from '../utils/review-convergence.js'
import {
  assertReviewWaiverEvidence,
  validateDeliveryArtifacts,
} from '../utils/delivery-artifacts.js'

const execFile = promisify(execFileCallback)
const LOCAL_SPECDEV_BIN = fileURLToPath(new URL('../../bin/specdev.js', import.meta.url))

export async function missionCommand(positionalArgs = [], flags = {}) {
  const subcommand = positionalArgs[0]
  const rest = positionalArgs.slice(1)
  if (subcommand === 'child' && process.env.SPECDEV_PARALLEL_CHILD === '1') {
    return runParallelMissionChild(rest[0], rest[1], flags)
  }
  if (subcommand === 'create') return createMission(rest, flags)
  if (subcommand === 'run') return runMission(rest[0], flags)
  if (subcommand === 'status') return missionStatus(rest[0], flags)
  if (subcommand === 'land') return missionLand(rest[0], flags)
  if (subcommand === 'pause') return pauseMission(rest[0], flags)
  if (subcommand === 'checkpoint') return checkpointMission(rest[0], flags)
  console.error('Usage: specdev mission <create | run | status | land | pause | checkpoint>')
  process.exitCode = 1
}

async function createMission(args, flags) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)
  if (!(await gitSucceeds(targetDir, ['rev-parse', '--is-inside-work-tree']))) {
    return fail(flags, 'A Mission requires a Git worktree')
  }
  let source
  try {
    source = await resolveSourceDiscussion(targetDir, specdevPath, flags['from-discussion'], flags)
  } catch (error) {
    return fail(flags, error.message)
  }
  if (flags['from-discussion'] && !source) return null
  const objective = args.join(' ').trim() || (await objectiveFromDiscussion(source))
  if (!objective) return fail(flags, 'Usage: specdev mission create "<objective>"')

  let guided
  try {
    guided = startGuidedRun(targetDir, 'mission-lifecycle', {
      strict: true,
      expectedNode: 'create-mission',
    })
  } catch (error) {
    return fail(flags, error.message)
  }
  const id = await reserveEntityId(specdevPath, 'mission')
  const name = `${id}_${slugify(objective)}`
  const missionPath = join(specdevPath, 'missions', name)
  const git = await gitSnapshot(targetDir)
  const branch = `specdev/${id}-${slugify(objective).slice(0, 32)}`
  await fse.ensureDir(join(missionPath, 'brainstorm'))
  let contract = assignmentContractTemplate({
    description: objective,
    kind: 'mission',
    sourceDiscussion: source,
  }).replace('# Assignment contract', '# Mission contract')
  contract +=
    '\n## Mission execution shape\n\n- Initial child plan: single\n- Split reason: none\n\n<!-- Use planned only for a concrete context, dependency, decision, or independent verification/rollback boundary. -->\n\n## Final integrated verification\n\n- Command: `TODO`\n'
  await fse.writeFile(join(missionPath, 'brainstorm', 'contract.md'), contract, 'utf-8')
  await writeMission(missionPath, {
    version: 1,
    id,
    objective,
    status: 'brainstorming',
    run_id: guided.state.run.id,
    base_branch: git.branch,
    created_revision: git.revision,
    base_revision: null,
    branch,
    created_at: new Date().toISOString(),
    next_action: `Finish brainstorm/contract.md, including the exact final verification command, then run specdev mission run ${id}.`,
    ...(source ? { source_discussion: { id: source.id, hash: source.hash } } : {}),
  })
  await writeCurrentFocus(specdevPath, { kind: 'mission', id })
  const stepped = stepGuidedNode(targetDir, 'create-mission', {
    id,
    path: relativeToRepo(targetDir, missionPath),
    objective,
  })
  if (!stepped.synchronized)
    return fail(
      flags,
      `Could not record Mission ${id} creation; resume it with specdev mission run ${id}`
    )
  return emit(flags, {
    command: 'mission create',
    version: 1,
    status: 'brainstorming',
    id,
    name,
    path: relativeToRepo(targetDir, missionPath),
    branch,
    next_action: `Finish brainstorm/contract.md, including the exact final verification command, then run specdev mission run ${id}.`,
  })
}

async function runMission(selector, flags) {
  const context = await missionContext(selector, flags)
  if (!context) return null
  const { targetDir, specdevPath, missionPath, mission } = context
  if (mission.status === 'completed') {
    const landing = await missionLanding(context, { attempt: true })
    return emit(flags, {
      command: 'mission run',
      version: 1,
      status: 'completed',
      mission: mission.id,
      branch: mission.branch,
      base_branch: mission.base_branch,
      final_revision: landing.final_revision,
      landing,
      next_action: landingNextAction(mission, landing),
      outcome: relativeToRepo(targetDir, join(missionPath, 'outcome.md')),
    })
  }
  if (mission.status === 'failed') {
    return emit(flags, {
      command: 'mission run',
      version: 1,
      status: 'failed',
      mission: mission.id,
      disposition: mission.disposition || 'semantic-failure',
      outcome: relativeToRepo(targetDir, join(missionPath, 'outcome.md')),
    })
  }
  try {
    await focusMissionRun(context)
    await writeCurrentFocus(specdevPath, { kind: 'mission', id: mission.id })
    let graph = getState({ workflowRoot: workflowRootFor(targetDir) })
    if (graph.position?.node === 'create-mission') {
      const recovered = stepGuidedNode(targetDir, 'create-mission', {
        id: mission.id,
        path: relativeToRepo(targetDir, missionPath),
        objective: mission.objective,
      })
      if (!recovered.synchronized)
        throw new Error(`Could not recover Mission ${mission.id} creation`)
      graph = getState({ workflowRoot: workflowRootFor(targetDir) })
    }
    if (graph.position.node === 'brainstorm') {
      const contract = await validateMissionContract(missionPath)
      if (!contract.valid) return fail(flags, contract.errors.join('; '))
      stepGuidedNode(targetDir, 'brainstorm', {
        contract: relativeToRepo(targetDir, contract.path),
        contract_hash: contract.hash,
      })
      graph = getState({ workflowRoot: workflowRootFor(targetDir) })
    }
    if (graph.position.node === 'approve-mission') {
      const contract = await validateMissionContract(missionPath)
      if (!contract.valid) return fail(flags, contract.errors.join('; '))
      const git = await gitSnapshot(targetDir)
      if (!git.branch)
        return fail(
          flags,
          'Mission approval requires a named Git base branch; switch from detached HEAD first'
        )
      const checkpointed = graph.context?.previous?.find(
        (entry) => entry.id === 'brainstorm'
      )?.output
      let recheckpointed = false
      if (checkpointed?.contract_hash !== contract.hash) {
        const reset = decideGuidedNode(targetDir, 'approve-mission', {
          approved: false,
          contract_hash: checkpointed?.contract_hash || contract.hash,
          actor: 'contract-recheckpoint',
          approved_at: new Date().toISOString(),
          base_revision: git.revision || 'unborn',
          branch: mission.branch,
        })
        if (!reset.synchronized)
          throw new Error(
            'Could not return the Mission contract to Brainstorm for re-checkpointing'
          )
        const refreshed = stepGuidedNode(targetDir, 'brainstorm', {
          contract: relativeToRepo(targetDir, contract.path),
          contract_hash: contract.hash,
        })
        if (!refreshed.synchronized)
          throw new Error('Could not checkpoint the changed Mission contract')
        graph = getState({ workflowRoot: workflowRootFor(targetDir) })
        recheckpointed = true
      }
      const reviewRecord = await readMissionBrainstormReview(missionPath)
      const review = reviewRecord?.contract_hash === contract.hash ? reviewRecord : null
      const staleReview = Boolean(reviewRecord && !review)
      if (!flags.approve || recheckpointed) {
        mission.status = 'awaiting_approval'
        mission.next_action = `After explicit user agreement, run specdev mission run ${mission.id} --approve.`
        delete mission.blocker
        await writeMission(missionPath, mission)
        return emit(flags, {
          command: 'mission run',
          version: 1,
          status: 'awaiting_approval',
          mission: mission.id,
          contract: relativeToRepo(targetDir, contract.path),
          contract_hash: contract.hash,
          contract_preview: contractPreview(contract.content),
          branch: mission.branch,
          dirty_paths: git.dirty_paths,
          review: review
            ? {
                verdict: review.result.frontmatter.verdict,
                material_divergence: review.result.frontmatter.material_divergence ?? null,
                stale: false,
              }
            : staleReview
              ? { stale: true, reviewed_contract_hash: reviewRecord.contract_hash }
              : null,
          next_action: mission.next_action,
        })
      }
      if (review && review.result.frontmatter.verdict !== 'approved' && !flags['override-review']) {
        return fail(
          flags,
          'The current Mission Brainstorm review is not approved. Address it and rerun review, or explicitly use --override-review.'
        )
      }
      mission.base_branch = git.branch
      await establishMissionBranch(targetDir, mission)
      const decision = decideGuidedNode(targetDir, 'approve-mission', {
        approved: true,
        contract_hash: contract.hash,
        actor: 'user',
        approved_at: new Date().toISOString(),
        review_override: Boolean(flags['override-review']),
        base_revision: git.revision || 'unborn',
        branch: mission.branch,
      })
      if (!decision.synchronized)
        throw new Error('Could not record Mission approval in the focused workflow')
      mission.status = 'running'
      mission.approved_contract_hash = contract.hash
      mission.base_revision = git.revision || 'unborn'
      mission.approved_at = new Date().toISOString()
      mission.next_action = `Continue the foreground controller with specdev mission run ${mission.id}.`
      delete mission.blocker
      await writeMission(missionPath, mission)
      await retireTransientArtifact(
        targetDir,
        specdevPath,
        join(missionPath, 'review', 'brainstorm-baseline.md')
      )
    }

    if (graph.position.node !== 'approve-mission') {
      const contract = await validateMissionContract(missionPath)
      if (!contract.valid || contract.hash !== mission.approved_contract_hash) {
        throw new Error(
          'Mission contract changed after approval; restore the approved contract or create a new Mission for changed authority'
        )
      }
      await establishMissionBranch(targetDir, mission)
      if (mission.status === 'paused' || mission.status === 'blocked') {
        mission.status = 'running'
        delete mission.blocker
        mission.next_action = `Mission ${mission.id} is running in the foreground.`
        await writeMission(missionPath, mission)
      }
    }

    graph = getState({ workflowRoot: workflowRootFor(targetDir) })
    if (
      graph.position?.node === 'design' &&
      !(await fse.pathExists(join(missionPath, 'design', 'assignments.yaml'))) &&
      !(await latestCheckpointRevision(targetDir, mission.branch, mission.id))
    ) {
      await withSuppressedOutput(() =>
        checkpointMission(mission.id, { target: targetDir, json: true })
      )
      Object.assign(mission, await readMission(missionPath))
    }

    const controller = await claimMissionController(context, flags)
    if (!controller) return null
    try {
      const payload = await driveMission({
        ...context,
        mission,
        flags,
        controller,
      })
      if (payload?.status !== 'completed') {
        await updateAttemptRecord(specdevPath, controller.id, {
          status: payload?.status === 'failed' ? 'failed' : 'blocked',
        })
      }
      return payload
    } catch (error) {
      if (mission.status === 'completed') {
        return fail(
          flags,
          `Mission delivery completed but its completion checkpoint failed: ${error.message}. Retry with specdev mission checkpoint ${mission.id}`
        )
      }
      await updateAttemptRecord(specdevPath, controller.id, {
        status: 'blocked',
        error: error.message,
      })
      mission.status = 'blocked'
      mission.blocker = error.message
      mission.next_action = `Resolve the blocker, then run specdev mission run ${mission.id}.`
      mission.updated_at = new Date().toISOString()
      await writeMission(missionPath, mission)
      return fail(flags, error.message)
    } finally {
      await clearLocalProcessMarker(specdevPath, controller.id)
    }
  } catch (error) {
    return fail(flags, error.message)
  }
}

async function driveMission(context) {
  const { targetDir, specdevPath, missionPath, mission, flags } = context
  while (true) {
    await assertApprovedMissionContract(missionPath, mission)
    const graph = getState({ workflowRoot: workflowRootFor(targetDir) })
    const node = graph.position?.node
    if (mission.pending_transition?.node === node) {
      await replayMissionTransition(context)
      continue
    }
    if (mission.pending_transition) {
      delete mission.pending_transition
      await writeMission(missionPath, mission)
    }
    if (graph.position?.graph === 'assignment-lifecycle') {
      await runMissionChild(context, graph)
      continue
    }
    if (node === 'design') {
      await designMission(context)
      continue
    }
    if (node === 'execute-wave') {
      const wave = await executeParallelMissionWave(context)
      const stepped = stepGuidedNode(targetDir, 'execute-wave', {
        wave: wave.number,
        completed: wave.children,
      })
      if (!stepped.synchronized) throw new Error(`Could not record Mission wave ${wave.number}`)
      mission.completed_wave = wave.number
      await writeMission(missionPath, mission)
      continue
    }
    if (node === 'advance-wave') {
      const queue = await readMissionQueue(missionPath)
      const wave = Number(mission.completed_wave)
      const completed = queue.assignments.filter((item) => item.wave === wave)
      if (!Number.isSafeInteger(wave) || completed.length === 0) {
        throw new Error('Mission has no completed parallel wave to advance')
      }
      const remaining = missionQueueHasRemaining(queue)
      for (const child of completed) {
        await recordMissionChildGap(context, child)
      }
      delete mission.completed_wave
      await writeMission(missionPath, mission)
      const gap = actionableMissionGap(mission)
      await durableMissionStep(context, 'advance-wave', {
        remaining,
        completed: `wave-${wave}`,
        follow_up_required: Boolean(gap),
        gap_open: Boolean(gap),
        ...(gap ? { gap_id: gap.id } : {}),
        parallel: remaining ? missionWaveIsParallel(queue) : false,
      })
      continue
    }
    if (node === 'advance-queue') {
      const queue = await readMissionQueue(missionPath)
      const running = queue.assignments.find((item) => item.status === 'running')
      if (!running) throw new Error('Mission queue has no running child to advance')
      running.status = queue.design_mode === 'single' ? 'completed' : 'integrated'
      running.outcome = `.specdev/assignments/${running.folder}/outcome.md`
      running.completed_at = new Date().toISOString()
      running.follow_up = await childFollowUp(specdevPath, running)
      await writeMissionQueue(missionPath, queue)
      const remaining = missionQueueHasRemaining(queue)
      await recordMissionChildGap(context, running)
      const gap = actionableMissionGap(mission)
      await writeMission(missionPath, mission)
      await durableMissionStep(context, 'advance-queue', {
        remaining,
        completed: running.id,
        follow_up_required: Boolean(gap),
        gap_open: Boolean(gap),
        ...(gap ? { gap_id: gap.id } : {}),
        parallel: remaining ? missionWaveIsParallel(queue) : false,
      })
      continue
    }
    if (node === 'mission-review') {
      const review = await reviewMission(context)
      if (review.disposition === 'approved' || review.disposition === 'nonblocking-override') {
        closeValidatingGap(mission, 'mission-review', 'convergence', review.verdict)
        await writeMission(missionPath, mission)
        await durableMissionStep(context, 'mission-review', {
          approved: true,
          verdict: review.verdict,
          attempt: review.attempt,
          disposition: review.disposition,
        })
        continue
      }
      if (review.disposition === 'repair' || review.disposition === 'resolver') {
        const gap = recordMissionSourceGap(mission, {
          kind: 'mission-review',
          sourceId: 'convergence',
          signalId: `mission-review:${review.attempt}`,
          artifact: review.verdict,
        })
        if (review.disposition === 'resolver' && gap.stage === 'resolution') {
          advanceMissionGap(mission, gap.id, {
            signalId: `mission-review:${review.attempt}:resolver`,
            artifact: review.verdict,
          })
        }
        await writeMission(missionPath, mission)
        await durableMissionStep(context, 'mission-review', {
          approved: false,
          verdict: review.verdict,
          attempt: review.attempt,
          disposition: 'repair',
        })
        continue
      }
      const reviewGap =
        missionGapForSource(mission, 'mission-review', 'convergence') ||
        recordMissionSourceGap(mission, {
          kind: 'mission-review',
          sourceId: 'convergence',
          signalId: `mission-review:${review.attempt}:failure`,
          artifact: review.verdict,
        })
      failMissionGap(mission, reviewGap.id, 'semantic-failure', {
        reason: 'Mission convergence review found an objective failure.',
        evidence: review.verdict,
      })
      await writeMission(missionPath, mission)
      await durableMissionStep(context, 'mission-review', {
        approved: false,
        verdict: review.verdict,
        attempt: review.attempt,
        disposition: missionGapTransitionDisposition(graph, 'semantic-failure'),
      })
      await completeMissionFailure(
        context,
        'Mission convergence review found an objective failure.',
        'semantic-failure'
      )
      return emit(flags, {
        command: 'mission run',
        version: 1,
        status: 'failed',
        mission: mission.id,
        disposition: 'semantic-failure',
        outcome: relativeToRepo(targetDir, join(missionPath, 'outcome.md')),
      })
    }
    if (node === 'replan' || node === 'resolve-gap') {
      const gapResolution = await resolveMissionGap(context)
      const resolved = normalizeMissionGapResolutionForGraph(graph, gapResolution)
      if (resolved !== gapResolution) {
        failMissionGap(mission, resolved.gap.id, resolved.disposition, {
          reason: resolved.error,
          evidence: resolved.attempt?.id || null,
        })
        await writeMission(missionPath, mission)
      }
      const resolutionQueue = await readMissionQueue(missionPath)
      const remaining = missionQueueHasRemaining(resolutionQueue)
      const nextGap = actionableMissionGap(mission)
      const transitionDisposition = missionGapTransitionDisposition(graph, resolved.disposition)
      await durableMissionStep(context, node, {
        queue: relativeToRepo(targetDir, join(missionPath, 'design', 'assignments.yaml')),
        reason: resolved.reason,
        gap_id: resolved.gap.id,
        stage: resolved.stage,
        attempt: resolved.attempt?.id || 'none',
        disposition: transitionDisposition,
        gap_open: Boolean(nextGap),
        remaining,
        parallel: remaining ? missionWaveIsParallel(resolutionQueue) : false,
      })
      if (
        ['semantic-failure', 'authority-failure', 'infrastructure-failure'].includes(
          resolved.disposition
        )
      ) {
        await completeMissionFailure(
          context,
          resolved.error || 'Mission gap resolution failed.',
          resolved.disposition
        )
        return emit(flags, {
          command: 'mission run',
          version: 1,
          status: 'failed',
          mission: mission.id,
          disposition: resolved.disposition,
          outcome: relativeToRepo(targetDir, join(missionPath, 'outcome.md')),
        })
      }
      continue
    }
    if (node === 'final-verification') {
      const result = await runFinalVerification(context)
      let verificationGap = missionGapForSource(mission, 'final-verification', 'authorized-command')
      if (result.passed && verificationGap) {
        closeMissionGap(mission, verificationGap.id, {
          evidence: relativeToRepo(targetDir, result.path),
        })
        await writeMission(missionPath, mission)
      }
      if (!result.passed) {
        verificationGap = recordMissionSourceGap(mission, {
          kind: 'final-verification',
          sourceId: 'authorized-command',
          signalId: `final-verification:${result.receipt.completed_at}`,
          artifact: relativeToRepo(targetDir, result.path),
        })
        await writeMission(missionPath, mission)
      }
      await durableMissionStep(context, 'final-verification', {
        passed: result.passed,
        receipt: relativeToRepo(targetDir, result.path),
        recoverable: !result.passed,
        disposition: result.passed ? 'evidence-closed' : 'gap-open',
      })
      if (!result.passed) continue
      await completeMission(context)
      await updateAttemptRecord(specdevPath, context.controller.id, { status: 'completed' })
      const runtime = await compactCompletedWorkflowRuntime(specdevPath, {
        runId: mission.run_id,
        attemptFilter: { mission: mission.id },
        focus: { kind: 'mission', id: mission.id },
      })
      const checkpoint = await withSuppressedOutput(() =>
        checkpointMission(
          mission.id,
          {
            target: targetDir,
            json: true,
          },
          { commitType: 'completion' }
        )
      )
      if (!checkpoint || checkpoint.status !== 'ok' || !checkpoint.revision) {
        throw new Error(checkpoint?.error || 'Mission completion checkpoint failed')
      }
      mission.final_revision = checkpoint.revision
      const landing = await missionLanding(context, {
        attempt: true,
        finalRevision: checkpoint.revision,
      })
      const finalGit = await gitSnapshot(targetDir)
      mission.final_dirty_paths = finalGit.dirty_paths
      return emit(flags, {
        command: 'mission run',
        version: 1,
        status: 'completed',
        mission: mission.id,
        branch: mission.branch,
        base_branch: mission.base_branch,
        final_revision: mission.final_revision,
        dirty_paths: mission.final_dirty_paths || [],
        checked_out_branch: finalGit.branch,
        landing,
        next_action: landingNextAction(mission, landing),
        outcome: relativeToRepo(targetDir, join(missionPath, 'outcome.md')),
        runtime_compaction: runtime,
      })
    }
    if (graph.status === 'completed' || graph.run?.status === 'completed') {
      return emit(flags, {
        command: 'mission run',
        version: 1,
        status: 'completed',
        mission: mission.id,
      })
    }
    throw new Error(`Mission controller cannot handle workflow node: ${node}`)
  }
}

async function durableMissionStep(context, node, output) {
  const { targetDir, missionPath, mission } = context
  mission.pending_transition = { node, output }
  await writeMission(missionPath, mission)
  const stepped = stepGuidedNode(targetDir, node, output)
  assertMissionTransitionRecorded(stepped, node)
  delete mission.pending_transition
  await writeMission(missionPath, mission)
  return stepped
}

async function replayMissionTransition(context) {
  const { targetDir, missionPath, mission } = context
  const transition = mission.pending_transition
  const stepped = stepGuidedNode(targetDir, transition.node, transition.output)
  assertMissionTransitionRecorded(stepped, transition.node, 'replay')
  delete mission.pending_transition
  await writeMission(missionPath, mission)
  return stepped
}

async function designMission(context) {
  const { targetDir, specdevPath, missionPath, mission } = context
  const queuePath = join(missionPath, 'design', 'assignments.yaml')
  const contract = await validateMissionContract(missionPath)
  if (contract.executionShape === 'single') {
    const queue = {
      version: 2,
      design_mode: 'single',
      assignments: [
        {
          id: await reserveEntityId(specdevPath, 'assignment'),
          title: mission.objective,
          kind: 'change',
          wave: 1,
          status: 'pending',
        },
      ],
      final_verification: {
        command: authorizedVerificationCommand(contract.content),
        scope: 'integrated',
      },
    }
    await writeMissionQueue(missionPath, queue)
    stepGuidedNode(targetDir, 'design', {
      queue: relativeToRepo(targetDir, queuePath),
      attempt: 'host-derived-single-child',
      parallel: false,
    })
    return
  }

  const profile = withoutNetwork(await resolveAgentProfile(specdevPath, 'worker'))
  const resultPath = join(missionPath, 'design', 'worker-result.md')
  const recovered = await recoverCompletedDesignResult({
    targetDir,
    specdevPath,
    mission,
    queuePath,
    resultPath,
  })
  const result =
    recovered ||
    (await runSpawnedAgent({
      targetDir,
      specdevPath,
      role: 'worker',
      profile,
      mission: mission.id,
      resultPath,
      resultKind: 'worker',
      prompt: [
        'Design a static-wave Mission plan. Do not modify product code.',
        `Approved Mission contract: ${relativeToRepo(targetDir, join(missionPath, 'brainstorm', 'contract.md'))}`,
        `Write ${relativeToRepo(targetDir, queuePath)} as YAML with version: 2, an ordered assignments list containing only title, kind, wave, status: pending, and a final_verification mapping with the exact contract-authorized command and scope.`,
        `Every kind must be one of: ${ASSIGNMENT_KINDS.join(', ')}.`,
        'Start by trying to express the entire Mission as one Assignment. Split only for a worker/reviewer context limit, an information dependency, an intermediate user/operational decision, or meaningfully independent verification/rollback.',
        'File count, architectural layers, and the existence of several implementation Tasks are not split reasons. When uncertain, write one Assignment.',
        "Use dense positive wave numbers beginning at 1. Put children in the same wave only when neither requires the other's output, decision, artifact, or intermediate verification.",
        'Parallel speed alone is not a split reason. Do not predict file ownership, assign IDs, add dependency edges, create a graph, or invoke agents.',
      ]
        .filter(Boolean)
        .join('\n'),
    }))
  if (result.status !== 'completed' || result.result.frontmatter.status !== 'completed') {
    throw new Error(result.error || 'Mission Design worker blocked')
  }
  const queue = await validateAndReserveQueue(specdevPath, missionPath)
  await writeMissionQueue(missionPath, queue)
  stepGuidedNode(targetDir, 'design', {
    queue: relativeToRepo(targetDir, queuePath),
    attempt: result.attempt.id,
    parallel: missionWaveIsParallel(queue),
  })
  await retireTransientArtifact(targetDir, specdevPath, resultPath)
}

async function runMissionChild(context, options = {}) {
  const { targetDir, specdevPath, missionPath, mission } = context
  const queue = await readMissionQueue(missionPath)
  let child = options.childId
    ? queue.assignments.find((item) => item.id === options.childId)
    : queue.assignments.find((item) => item.status === 'running')
  if (!child) {
    child = queue.assignments.find((item) => item.status === 'pending')
    if (!child) throw new Error('Mission child graph entered with no pending Assignment')
  }
  if (child.status === 'pending') {
    child.status = 'running'
    child.started_at = new Date().toISOString()
    await writeMissionQueue(missionPath, queue)
  }
  let graph = getState({ workflowRoot: workflowRootFor(targetDir) })
  if (!child.folder && graph.position.node !== 'create-assignment') {
    const recovered = await findAssignmentFolder(specdevPath, child.id)
    child.folder = recovered.name
    await writeMissionQueue(missionPath, queue)
  }
  if (graph.position.node === 'create-assignment') {
    const existing = await findAssignmentFolder(specdevPath, child.id, { allowMissing: true })
    if (existing) {
      const status = await fse.readJson(join(existing.path, 'status.json')).catch(() => null)
      if (status?.id !== child.id || status?.mission !== mission.id) {
        throw new Error(
          `Existing child Assignment ${child.id} does not belong to Mission ${mission.id}`
        )
      }
      const recovered = stepGuidedNode(targetDir, 'create-assignment', {
        id: child.id,
        name: existing.name,
        path: relativeToRepo(targetDir, existing.path),
        description: child.title,
      })
      if (!recovered.synchronized)
        throw new Error(`Could not recover child Assignment ${child.id} creation`)
    } else {
      await withSuppressedOutput(() =>
        assignmentCommand([child.title], {
          target: targetDir,
          mission: mission.id,
          id: child.id,
          kind: child.kind || 'change',
          slug: slugify(child.title),
          json: true,
          'brainstorm-review':
            queue.design_mode === 'single' && queue.assignments.length === 1
              ? 'optional'
              : 'required',
          'implementation-review': 'required',
        })
      )
    }
    const resolved = existing || (await findAssignmentFolder(specdevPath, child.id))
    child.folder = resolved.name
    await writeMissionQueue(missionPath, queue)
  }
  const assignmentPath = join(specdevPath, 'assignments', child.folder)
  graph = getState({ workflowRoot: workflowRootFor(targetDir) })
  const singleFullScope = queue.design_mode === 'single' && queue.assignments.length === 1
  if (graph.position.node === 'brainstorm') {
    if (singleFullScope) await deriveSingleChildContract(context, child, assignmentPath)
    else await authorChildContract(context, child, assignmentPath)
    const contract = await validateContractPath(join(assignmentPath, 'brainstorm', 'contract.md'))
    if (!contract.valid)
      throw new Error(`Child ${child.id} contract invalid: ${contract.errors.join('; ')}`)
    stepGuidedNode(targetDir, 'brainstorm', {
      contract: relativeToRepo(targetDir, contract.path),
      contract_hash: contract.hash,
    })
  }
  graph = getState({ workflowRoot: workflowRootFor(targetDir) })
  if (graph.position.node === 'approve-contract') {
    if (!singleFullScope) {
      const review = await withSuppressedOutput(() =>
        reviewBrainstorm({ target: targetDir, assignment: child.id, json: true })
      )
      if (!review)
        throw new Error(`Child ${child.id} Brainstorm review did not produce a durable verdict`)
      if (review.status !== 'approved') {
        throw new Error(`Child ${child.id} Brainstorm review reached objective terminal failure`)
      }
    }
    await assertApprovedMissionContract(missionPath, mission)
    if (!singleFullScope) {
      await withSuppressedOutput(() =>
        checkpointCommand(['brainstorm'], {
          target: targetDir,
          assignment: child.id,
          json: true,
        })
      )
      graph = getState({ workflowRoot: workflowRootFor(targetDir) })
      if (graph.position.node !== 'approve-contract') {
        throw new Error(`Child ${child.id} did not return to contract approval after checkpointing`)
      }
    }
    const contract = await validateContractPath(join(assignmentPath, 'brainstorm', 'contract.md'))
    const approvedAt = new Date().toISOString()
    const reviewPolicy = {
      brainstorm: singleFullScope ? 'optional' : 'required',
      implementation: 'required',
    }
    const approval = decideGuidedNode(targetDir, 'approve-contract', {
      approved: true,
      contract_hash: contract.hash,
      actor: `mission:${mission.id}`,
      approved_at: approvedAt,
      revision: (await gitSnapshot(targetDir)).revision || 'unborn',
      review_override: false,
      review_policy: reviewPolicy,
    })
    if (!approval.synchronized)
      throw new Error(`Could not record Mission approval for child ${child.id}`)
    await writeAssignmentStatus(assignmentPath, {
      review_policy: reviewPolicy,
      review_policy_frozen_at: approvedAt,
    })
    await retireTransientArtifact(
      targetDir,
      specdevPath,
      join(assignmentPath, 'review', 'brainstorm-baseline.md')
    )
    await retireTransientArtifact(
      targetDir,
      specdevPath,
      join(assignmentPath, 'review', 'brainstorm-author-result.md')
    )
    await retireTransientArtifact(
      targetDir,
      specdevPath,
      join(assignmentPath, 'review', 'brainstorm-revision-result.md')
    )
  }
  let result
  try {
    result = await withSuppressedOutput(() =>
      implementCommand([], { target: targetDir, assignment: child.id, json: true })
    )
  } finally {
    if (!options.parallelRoot) {
      await writeCurrentFocus(specdevPath, { kind: 'mission', id: mission.id })
    }
  }
  if (result?.status !== 'approved' && result?.status !== 'completed') {
    const status = await fse.readJson(join(assignmentPath, 'status.json')).catch(() => null)
    if (status?.status !== 'completed') {
      throw new Error(result?.error || `Child ${child.id} implementation blocked`)
    }
  }
  return { child, assignmentPath, result }
}

async function runParallelMissionChild(selector, childId, flags) {
  const context = await missionContext(selector, flags)
  if (!context) return null
  const { targetDir, specdevPath, missionPath, mission } = context
  const queue = await readMissionQueue(missionPath)
  const child = queue?.assignments?.find((item) => item.id === childId)
  if (!child) return fail(flags, `Mission child not found: ${childId}`)
  if (queue.design_mode === 'single' || queue.assignments.length < 2) {
    return fail(flags, 'The internal parallel child command requires a planned multi-child Mission')
  }

  try {
    await assertApprovedMissionContract(missionPath, mission)
    const workflowRoot = workflowRootFor(targetDir)
    let graph = getState({ workflowRoot })
    const existing = await findAssignmentFolder(specdevPath, child.id, { allowMissing: true })
    if (!existing) {
      if (graph.status === 'ok' && graph.run?.status === 'active') {
        suspendRun({ workflowRoot, note: `parallel Mission child ${child.id}` })
      }
      const created = await withSuppressedOutput(() =>
        assignmentCommand([child.title], {
          target: targetDir,
          mission: mission.id,
          id: child.id,
          kind: child.kind || 'change',
          slug: slugify(child.title),
          json: true,
          'mission-root': true,
          'brainstorm-review': 'required',
          'implementation-review': 'required',
        })
      )
      if (!created) throw new Error(`Could not create parallel child Assignment ${child.id}`)
    } else {
      const status = await fse.readJson(join(existing.path, 'status.json')).catch(() => null)
      if (status?.mission !== mission.id || status?.id !== child.id) {
        throw new Error(`Existing Assignment ${child.id} does not belong to Mission ${mission.id}`)
      }
      graph = getState({ workflowRoot })
      if (graph.run?.id !== status.run_id && graph.run?.status === 'active') {
        suspendRun({ workflowRoot, note: `resume parallel Mission child ${child.id}` })
      }
      const run = listRuns({ workflowRoot }).runs.find(
        (candidate) => candidate.id === status.run_id
      )
      if (run?.status === 'suspended') {
        resumeRun({ workflowRoot, runId: status.run_id })
      }
      await writeCurrentFocus(specdevPath, { kind: 'assignment', id: child.id })
    }

    const delivered = await runMissionChild(context, { childId: child.id, parallelRoot: true })
    return emit(flags, {
      command: 'mission child',
      version: 1,
      status: 'completed',
      mission: mission.id,
      assignment: child.id,
      folder: delivered.child.folder,
      outcome: relativeToRepo(targetDir, join(delivered.assignmentPath, 'outcome.md')),
    })
  } catch (error) {
    return fail(flags, error.message)
  }
}

async function executeParallelMissionWave(context) {
  const { targetDir, specdevPath, missionPath, mission } = context
  let queue = await readMissionQueue(missionPath)
  validateMissionQueueStatuses(queue)
  normalizeMissionWaves(queue.assignments)
  const waveNumber = currentMissionWave(queue)
  const waveItems = missionWaveItems(queue, waveNumber)
  if (!waveNumber) throw new Error('Parallel Mission execution has no active wave')
  if (waveItems.length === 1) {
    return executeMissionWaveSequentialFallback(context, queue, waveNumber)
  }
  if (waveItems.length === 0) throw new Error(`Mission wave ${waveNumber} has no executable child`)

  let baseRevision = waveItems.map((item) => item.base_revision).find(Boolean)
  if (!baseRevision) {
    const snapshot = await gitSnapshot(targetDir)
    const productChanges = snapshot.dirty_paths.filter((path) => !path.startsWith('.specdev/'))
    if (productChanges.length > 0) {
      throw new Error(
        `Cannot start a parallel Mission wave while the main worktree has product changes: ${productChanges.join(', ')}`
      )
    }
    const checkpoint = await withSuppressedOutput(() =>
      checkpointMission(mission.id, { target: targetDir, json: true })
    )
    if (!checkpoint?.revision) throw new Error('Could not create the parallel wave base checkpoint')
    baseRevision = checkpoint.revision
    for (const item of waveItems) {
      item.base_revision = baseRevision
      item.branch = missionChildBranch(mission.id, item.id)
    }
    await writeMissionQueue(missionPath, queue)
  }
  if (waveItems.some((item) => item.base_revision !== baseRevision)) {
    throw new Error(`Mission wave ${waveNumber} has inconsistent base revisions`)
  }

  const active = new Map()
  let blocker = null
  let launched = false
  while (true) {
    queue = await readMissionQueue(missionPath)
    await integrateCompletedMissionChildren(context, queue, waveNumber)
    queue = await readMissionQueue(missionPath)
    await releaseIntegratedMissionWorktrees(context, queue, waveNumber)
    const currentItems = queue.assignments.filter((item) => item.wave === waveNumber)
    if (currentItems.every((item) => ['integrated', 'cancelled'].includes(item.status))) break

    const launchable = currentItems.filter((item) => {
      const retryableBlocker =
        item.status === 'blocked' && !String(item.blocker || '').startsWith('integration ')
      return (
        (['pending', 'running'].includes(item.status) || retryableBlocker) && !active.has(item.id)
      )
    })
    while (!blocker && active.size < MAX_PARALLEL_MISSION_CHILDREN && launchable.length > 0) {
      const child = launchable.shift()
      let worktree
      try {
        worktree = await leaseMissionChildWorktree(context, child, active)
      } catch (error) {
        if (!launched && active.size === 0) {
          process.stderr.write(
            `SpecDev wave ${waveNumber}: worktree parallelism unavailable; continuing sequentially (${error.message}).\n`
          )
          return executeMissionWaveSequentialFallback(context, queue, waveNumber)
        }
        child.status = 'blocked'
        child.blocker = `worktree_setup: ${error.message}`
        await writeMissionQueue(missionPath, queue)
        blocker = child.blocker
        continue
      }
      child.status = 'running'
      child.started_at ||= new Date().toISOString()
      child.branch ||= missionChildBranch(mission.id, child.id)
      delete child.blocker
      await writeMissionQueue(missionPath, queue)
      try {
        const execution = await launchMissionChildProcess(context, child, worktree)
        active.set(child.id, { ...execution, child, worktree })
        launched = true
      } catch (error) {
        child.status = 'blocked'
        child.blocker = `launch: ${error.message}`
        await writeMissionQueue(missionPath, queue)
        blocker = child.blocker
      }
    }

    if (active.size === 0) {
      if (blocker) break
      const unresolved = currentItems.find(
        (item) => !['integrated', 'cancelled'].includes(item.status)
      )
      if (unresolved?.status === 'completed') {
        await integrateCompletedMissionChildren(context, queue, waveNumber)
        continue
      }
      throw new Error(`Mission wave ${waveNumber} cannot make progress`)
    }

    const settled = await Promise.race(
      [...active.entries()].map(([id, execution]) =>
        execution.promise.then((result) => ({ id, execution, result }))
      )
    )
    active.delete(settled.id)
    queue = await readMissionQueue(missionPath)
    const child = queue.assignments.find((item) => item.id === settled.id)
    try {
      if (settled.result.exitCode !== 0) {
        throw new Error(
          settled.result.error || `child command exited with status ${settled.result.exitCode}`
        )
      }
      const resolved = await findAssignmentFolder(
        join(settled.execution.worktree.path, '.specdev'),
        child.id
      )
      const status = await fse.readJson(join(resolved.path, 'status.json')).catch(() => null)
      if (status?.status !== 'completed') {
        throw new Error(`Child ${child.id} exited without a completed Assignment status`)
      }
      const delivery = await createMissionChildDelivery({
        worktreePath: settled.execution.worktree.path,
        missionPath: join(
          settled.execution.worktree.path,
          '.specdev',
          'missions',
          basename(missionPath)
        ),
        missionId: mission.id,
        childId: child.id,
        wave: waveNumber,
      })
      child.folder = resolved.name
      child.outcome = `.specdev/assignments/${resolved.name}/outcome.md`
      child.delivery_revision = delivery
      child.completed_at = new Date().toISOString()
      child.status = 'completed'
      delete child.blocker
      await writeMissionQueue(missionPath, queue)
      try {
        await removeMissionWorktree({
          projectRoot: targetDir,
          specdevPath,
          worktreePath: settled.execution.worktree.path,
        })
      } catch (error) {
        process.stderr.write(
          `SpecDev ${child.id}: delivery is safe, but its worktree remains: ${error.message}\n`
        )
      }
    } catch (error) {
      child.status = 'blocked'
      child.blocker = `execution: ${error.message}`
      await writeMissionQueue(missionPath, queue)
      blocker ||= child.blocker
    }
  }

  queue = await readMissionQueue(missionPath)
  await integrateCompletedMissionChildren(context, queue, waveNumber)
  queue = await readMissionQueue(missionPath)
  const finalItems = queue.assignments.filter((item) => item.wave === waveNumber)
  const finalBlocker = finalItems.find((item) => item.status === 'blocked')
  if (finalBlocker) {
    throw new Error(`Parallel child ${finalBlocker.id} blocked: ${finalBlocker.blocker}`)
  }
  if (!launched && !finalItems.every((item) => ['integrated', 'cancelled'].includes(item.status))) {
    throw new Error(`Mission wave ${waveNumber} did not launch or recover any child`)
  }
  if (!finalItems.every((item) => ['integrated', 'cancelled'].includes(item.status))) {
    throw new Error(`Mission wave ${waveNumber} is incomplete after child execution`)
  }
  return { number: waveNumber, children: finalItems.map((item) => item.id) }
}

async function executeMissionWaveSequentialFallback(context, queue, waveNumber) {
  const { targetDir, specdevPath, missionPath, mission } = context
  const children = queue.assignments.filter((item) => item.wave === waveNumber)
  for (const child of children) {
    if (['integrated', 'cancelled'].includes(child.status)) continue
    const workflowRoot = workflowRootFor(targetDir)
    const current = getState({ workflowRoot })
    if (current.status === 'ok' && current.run?.status === 'active') {
      suspendRun({ workflowRoot, note: `sequential fallback child ${child.id}` })
    }
    const existing = await findAssignmentFolder(specdevPath, child.id, { allowMissing: true })
    let existingStatus = null
    if (!existing) {
      const created = await withSuppressedOutput(() =>
        assignmentCommand([child.title], {
          target: targetDir,
          mission: mission.id,
          id: child.id,
          kind: child.kind || 'change',
          slug: slugify(child.title),
          json: true,
          'mission-root': true,
          'internal-mission-child': true,
          'brainstorm-review': 'required',
          'implementation-review': 'required',
        })
      )
      if (!created) throw new Error(`Could not create fallback child Assignment ${child.id}`)
    } else {
      existingStatus = await fse.readJson(join(existing.path, 'status.json')).catch(() => null)
      const run = listRuns({ workflowRoot }).runs.find(
        (candidate) => candidate.id === existingStatus?.run_id
      )
      if (run?.status === 'suspended') {
        resumeRun({ workflowRoot, runId: existingStatus.run_id })
      }
    }
    child.status = 'running'
    child.started_at ||= new Date().toISOString()
    await writeMissionQueue(missionPath, queue)
    const delivered =
      existingStatus?.status === 'completed'
        ? { child: { ...child, folder: existing.name }, assignmentPath: existing.path }
        : await runMissionChild(context, { childId: child.id, parallelRoot: true })
    const refreshed = await readMissionQueue(missionPath)
    const item = refreshed.assignments.find((candidate) => candidate.id === child.id)
    item.folder = delivered.child.folder
    item.outcome = `.specdev/assignments/${delivered.child.folder}/outcome.md`
    item.follow_up = await childFollowUp(specdevPath, item)
    item.status = 'integrated'
    item.completed_at = new Date().toISOString()
    item.integrated_at = item.completed_at
    item.execution = 'sequential-fallback'
    await writeMissionQueue(missionPath, refreshed)
    const missionRun = listRuns({ workflowRoot }).runs.find(
      (candidate) => candidate.id === mission.run_id
    )
    if (missionRun?.status === 'suspended') resumeRun({ workflowRoot, runId: mission.run_id })
    await writeCurrentFocus(specdevPath, { kind: 'mission', id: mission.id })
    const checkpoint = await withSuppressedOutput(() =>
      checkpointMission(
        mission.id,
        { target: targetDir, json: true },
        { commitType: 'integration', assignmentId: child.id }
      )
    )
    if (!checkpoint?.revision) {
      throw new Error(`Could not checkpoint sequential fallback child ${child.id}`)
    }
    queue = refreshed
  }
  return { number: waveNumber, children: children.map((item) => item.id), fallback: true }
}

async function leaseMissionChildWorktree(context, child, active) {
  const { targetDir, specdevPath, mission } = context
  const branch = child.branch || missionChildBranch(mission.id, child.id)
  const registered = await listMissionWorktrees(targetDir, specdevPath)
  const recovered = registered.find((item) => item.branch === branch)
  let slot
  if (recovered) {
    slot = recovered.worktree.split('/').at(-1)
  } else {
    const occupied = new Set([
      ...registered.map((item) => item.worktree.split('/').at(-1)),
      ...[...active.values()].map((item) => item.worktree.path.split('/').at(-1)),
    ])
    slot = Array.from(
      { length: MAX_PARALLEL_MISSION_CHILDREN },
      (_, index) => `slot-${String(index + 1).padStart(2, '0')}`
    ).find((candidate) => !occupied.has(candidate))
  }
  if (!slot) throw new Error('No safe Mission worktree slot is available')
  return ensureMissionWorktree({
    projectRoot: targetDir,
    specdevPath,
    slot,
    branch,
    baseRevision: child.base_revision,
  })
}

async function releaseIntegratedMissionWorktrees(context, queue, waveNumber) {
  const { targetDir, specdevPath, mission } = context
  const registered = await listMissionWorktrees(targetDir, specdevPath)
  for (const child of queue.assignments.filter(
    (item) => item.wave === waveNumber && item.status === 'integrated' && item.branch
  )) {
    const worktree = registered.find((item) => item.branch === child.branch)
    if (worktree) {
      try {
        await removeMissionWorktree({
          projectRoot: targetDir,
          specdevPath,
          worktreePath: worktree.worktree,
        })
      } catch (error) {
        process.stderr.write(
          `SpecDev ${child.id}: integrated delivery is safe, but its worktree remains: ${error.message}\n`
        )
        continue
      }
    }
    const integration = await missionChildIntegrationRevision(targetDir, mission, child)
    if (
      integration &&
      (await gitSucceeds(targetDir, [
        'show-ref',
        '--verify',
        '--quiet',
        `refs/heads/${child.branch}`,
      ]))
    ) {
      try {
        await execFile('git', ['branch', '-D', child.branch], { cwd: targetDir })
      } catch (error) {
        process.stderr.write(
          `SpecDev ${child.id}: integrated delivery is safe, but its local branch remains: ${error.message}\n`
        )
      }
    }
  }
}

async function launchMissionChildProcess(context, child, worktree) {
  const { targetDir, specdevPath, mission } = context
  const previous = (
    await listAttemptRecords(specdevPath, {
      kind: 'mission-child',
      mission: mission.id,
      assignment: child.id,
      status: 'running',
    })
  ).at(-1)
  if (previous && (await attemptLiveness(specdevPath, previous.id)).state === 'live_local') {
    process.stderr.write(`SpecDev ${child.id}: reattaching to live child ${previous.id}.\n`)
    return {
      worktree,
      promise: waitForExistingMissionChild(specdevPath, previous, worktree.path, child.id),
    }
  }
  if (previous) {
    await updateAttemptRecord(specdevPath, previous.id, {
      status: 'interrupted',
      error: 'recovered by a new Mission controller',
    })
    await clearLocalProcessMarker(specdevPath, previous.id)
  }

  const attempt = await createAttemptRecord(specdevPath, {
    kind: 'mission-child',
    mission: mission.id,
    assignment: child.id,
    workspace: worktree.relativePath,
    base_revision: child.base_revision,
  })
  const logDir = join(specdevPath, 'cache', 'missions', mission.id, `wave-${child.wave}`)
  await fse.ensureDir(logDir)
  const stdoutLog = createWriteStream(join(logDir, `${child.id}.stdout.log`), { flags: 'a' })
  const stderrLog = createWriteStream(join(logDir, `${child.id}.stderr.log`), { flags: 'a' })
  const processChild = spawn(
    process.execPath,
    [
      LOCAL_SPECDEV_BIN,
      'mission',
      'child',
      mission.id,
      child.id,
      `--target=${worktree.path}`,
      '--json',
    ],
    {
      cwd: worktree.path,
      env: {
        ...process.env,
        SPECDEV_PARALLEL_CHILD: '1',
        SPECDEV_ATTEMPT_NAMESPACE: child.id,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  )
  await writeLocalProcessMarker(specdevPath, attempt.id, {
    pid: processChild.pid,
    cwd: worktree.path,
  })
  process.stderr.write(
    `SpecDev ${child.id}: parallel Assignment started in ${worktree.relativePath}.\n`
  )
  processChild.stdout.pipe(stdoutLog)
  processChild.stderr.on('data', (chunk) => {
    stderrLog.write(chunk)
    if (process.env.SPECDEV_AGENT_STREAM === '1') process.stderr.write(`[${child.id}] ${chunk}`)
  })
  const promise = new Promise((resolvePromise) => {
    let settled = false
    processChild.on('error', async (error) => {
      if (settled) return
      settled = true
      stdoutLog.end()
      stderrLog.end()
      await clearLocalProcessMarker(specdevPath, attempt.id)
      await updateAttemptRecord(specdevPath, attempt.id, {
        status: 'failed',
        error: error.message,
      })
      resolvePromise({ exitCode: 1, error: error.message })
    })
    processChild.on('close', async (code) => {
      if (settled) return
      settled = true
      stdoutLog.end()
      stderrLog.end()
      await clearLocalProcessMarker(specdevPath, attempt.id)
      await updateAttemptRecord(specdevPath, attempt.id, {
        status: code === 0 ? 'completed' : 'failed',
        ...(code === 0 ? {} : { error: `child command exited with status ${code ?? 1}` }),
      })
      process.stderr.write(
        `SpecDev ${child.id}: parallel Assignment ${code === 0 ? 'finished' : 'failed'}.\n`
      )
      resolvePromise({
        exitCode: code ?? 1,
        ...(code === 0 ? {} : { error: `child command exited with status ${code ?? 1}` }),
      })
    })
  })
  return { attempt, worktree, promise }
}

async function waitForExistingMissionChild(specdevPath, attempt, worktreePath, childId) {
  while ((await attemptLiveness(specdevPath, attempt.id)).state === 'live_local') {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000))
  }
  const resolved = await findAssignmentFolder(join(worktreePath, '.specdev'), childId, {
    allowMissing: true,
  })
  const status = resolved
    ? await fse.readJson(join(resolved.path, 'status.json')).catch(() => null)
    : null
  await updateAttemptRecord(specdevPath, attempt.id, {
    status: status?.status === 'completed' ? 'completed' : 'interrupted',
    ...(status?.status === 'completed'
      ? {}
      : { error: 'live child ended without a completed Assignment status' }),
  })
  return status?.status === 'completed'
    ? { exitCode: 0 }
    : { exitCode: 1, error: 'live child ended without a completed Assignment status' }
}

async function integrateCompletedMissionChildren(context, queue, waveNumber) {
  const { targetDir, missionPath, mission } = context
  await reconcileMissionWaveIntegrations(context, queue, waveNumber)
  for (const child of integratableMissionPrefix(queue, waveNumber)) {
    if (!child.delivery_revision) {
      throw new Error(`Completed child ${child.id} has no delivery revision`)
    }
    const existingRevision = await missionChildIntegrationRevision(targetDir, mission, child)
    if (existingRevision) {
      await recordIntegratedMissionChild(context, queue, child, existingRevision)
      continue
    }
    const snapshot = await gitSnapshot(targetDir)
    const productChanges = snapshot.dirty_paths.filter((path) => !path.startsWith('.specdev/'))
    if (productChanges.length > 0) {
      throw new Error(
        `Cannot integrate child ${child.id} while the Mission worktree has product changes: ${productChanges.join(', ')}`
      )
    }
    const stagedPaths = await gitOutputLines(targetDir, ['diff', '--cached', '--name-only'])
    if (stagedPaths.length > 0) {
      throw new Error(
        `Cannot integrate child ${child.id} while unrelated paths are staged: ${stagedPaths.join(', ')}`
      )
    }
    await beginMissionChildIntegration(context, queue, child, waveNumber)
    try {
      await execFile('git', ['cherry-pick', '--no-commit', child.delivery_revision], {
        cwd: targetDir,
      })
    } catch (error) {
      child.status = 'blocked'
      const conflict = Boolean(await gitRevision(targetDir, 'CHERRY_PICK_HEAD'))
      child.blocker = conflict
        ? `integration conflict for ${child.delivery_revision}`
        : `integration failed for ${child.delivery_revision}: ${error.message}`
      await writeMissionQueue(missionPath, queue)
      throw new Error(
        conflict
          ? `Integration conflict for child ${child.id}; resolve and stage the files, then rerun the Mission, or abort the Git cherry-pick to retry`
          : `Integration failed for child ${child.id}: ${error.message}`
      )
    }
    child.integration.phase = 'committing'
    child.integration.updated_at = new Date().toISOString()
    await writeMissionQueue(missionPath, queue)
    await finishMissionChildIntegration(context, queue, child, waveNumber)
  }
}

async function reconcileMissionWaveIntegrations(context, queue, waveNumber) {
  const { targetDir, mission } = context
  const cherryPickHead = await gitRevision(targetDir, 'CHERRY_PICK_HEAD')
  if (cherryPickHead) {
    const child = queue.assignments.find(
      (item) =>
        item.wave === waveNumber &&
        item.delivery_revision === cherryPickHead &&
        String(item.blocker || '').startsWith('integration conflict')
    )
    if (!child) {
      throw new Error(
        'An unrelated Git cherry-pick is in progress; finish or abort it before resuming the Mission'
      )
    }
    const unmerged = await gitOutputLines(targetDir, ['diff', '--name-only', '--diff-filter=U'])
    if (unmerged.length > 0) {
      throw new Error(
        `Integration conflict for child ${child.id} is unresolved in: ${unmerged.join(', ')}. Resolve and stage those files, then rerun the Mission; or abort the cherry-pick to retry.`
      )
    }
    await finishMissionChildIntegration(context, queue, child, waveNumber)
  }

  const pendingCommit = queue.assignments.find(
    (item) =>
      item.wave === waveNumber &&
      item.delivery_revision &&
      item.status === 'blocked' &&
      String(item.blocker || '').startsWith('integration commit failed')
  )
  if (pendingCommit) {
    const unmerged = await gitOutputLines(targetDir, ['diff', '--name-only', '--diff-filter=U'])
    if (unmerged.length > 0) {
      throw new Error(
        `Integration for child ${pendingCommit.id} still has unresolved files: ${unmerged.join(', ')}`
      )
    }
    await finishMissionChildIntegration(context, queue, pendingCommit, waveNumber)
  }

  for (const child of queue.assignments.filter((item) => item.wave === waveNumber)) {
    if (!child.delivery_revision) continue
    const integratedRevision = await missionChildIntegrationRevision(targetDir, mission, child)
    if (integratedRevision) {
      await recordIntegratedMissionChild(context, queue, child, integratedRevision)
      continue
    }
    if (child.integration) {
      await recoverPendingMissionChildIntegration(context, queue, child, waveNumber)
      continue
    }
    if (child.status === 'blocked' && String(child.blocker || '').startsWith('integration ')) {
      child.status = 'completed'
      delete child.blocker
      await writeMissionQueue(context.missionPath, queue)
    }
  }
}

async function beginMissionChildIntegration(context, queue, child, waveNumber) {
  child.integration = {
    delivery_revision: child.delivery_revision,
    wave: waveNumber,
    phase: 'applying',
    started_at: new Date().toISOString(),
  }
  await writeMissionQueue(context.missionPath, queue)
}

async function recoverPendingMissionChildIntegration(context, queue, child, waveNumber) {
  const { targetDir, missionPath } = context
  if (
    child.integration.delivery_revision !== child.delivery_revision ||
    Number(child.integration.wave) !== Number(waveNumber)
  ) {
    throw new Error(`Child ${child.id} has inconsistent pending integration metadata`)
  }
  const unmerged = await gitOutputLines(targetDir, ['diff', '--name-only', '--diff-filter=U'])
  if (unmerged.length > 0) {
    throw new Error(
      `Integration for child ${child.id} still has unresolved files: ${unmerged.join(', ')}`
    )
  }
  const stagedPaths = await gitOutputLines(targetDir, ['diff', '--cached', '--name-only'])
  const action = await missionIntegrationRecoveryActionForIndex(context, child, stagedPaths)
  if (action === 'commit') {
    child.integration.phase = 'committing'
    child.integration.updated_at = new Date().toISOString()
    await writeMissionQueue(missionPath, queue)
    await finishMissionChildIntegration(context, queue, child, waveNumber)
    return
  }

  child.status = 'completed'
  delete child.blocker
  delete child.integrated_at
  delete child.integration_revision
  delete child.integration
  await writeMissionQueue(missionPath, queue)
}

async function missionIntegrationRecoveryActionForIndex(context, child, stagedPaths) {
  const { targetDir, missionPath } = context
  const missionPrefix = relativeToRepo(targetDir, missionPath)
  const deliveryPaths = await gitOutputLines(targetDir, [
    'diff-tree',
    '--no-commit-id',
    '--name-only',
    '-r',
    child.delivery_revision,
  ])
  try {
    return missionIntegrationRecoveryAction({
      phase: child.integration.phase,
      stagedPaths,
      deliveryPaths,
      missionPrefix,
    })
  } catch (error) {
    throw new Error(`Cannot recover integration for child ${child.id}: ${error.message}`)
  }
}

async function finishMissionChildIntegration(context, queue, child, waveNumber) {
  const { targetDir, mission, missionPath } = context
  child.integration = {
    ...child.integration,
    delivery_revision: child.delivery_revision,
    wave: waveNumber,
    phase: 'committing',
    started_at: child.integration?.started_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  await recordIntegratedMissionChild(context, queue, child)
  await execFile('git', ['add', '-A', '--', relativeToRepo(targetDir, missionPath)], {
    cwd: targetDir,
  })
  let integrationRevision
  try {
    await execFile(
      'git',
      [
        'commit',
        '-m',
        `specdev(${mission.id}): integrate ${child.id}`,
        '-m',
        `SpecDev-Mission: ${mission.id}\nSpecDev-Assignment: ${child.id}\nSpecDev-Wave: ${waveNumber}\nSpecDev-Delivery: ${child.delivery_revision}\nSpecDev-Commit-Type: integration`,
      ],
      { cwd: targetDir }
    )
    integrationRevision = await gitRevision(targetDir, 'HEAD')
  } catch (error) {
    child.status = 'blocked'
    child.blocker = `integration commit failed for ${child.delivery_revision}: ${error.message}`
    delete child.integrated_at
    delete child.integration_revision
    await writeMissionQueue(context.missionPath, queue)
    throw new Error(`Could not commit integration for child ${child.id}: ${error.message}`)
  }
  child.integration_revision = integrationRevision
  delete child.integration
  await writeMissionQueue(missionPath, queue)
}

async function recordIntegratedMissionChild(context, queue, child, integrationRevision = null) {
  const resolved = await findAssignmentFolder(context.specdevPath, child.id)
  child.folder = resolved.name
  child.outcome = `.specdev/assignments/${resolved.name}/outcome.md`
  child.follow_up = await childFollowUp(context.specdevPath, child)
  child.status = 'integrated'
  child.integrated_at ||= new Date().toISOString()
  if (integrationRevision) {
    child.integration_revision = integrationRevision
    delete child.integration
  }
  delete child.blocker
  await writeMissionQueue(context.missionPath, queue)
}

async function missionChildIntegrationRevision(targetDir, mission, child) {
  for (const message of [
    `SpecDev-Delivery: ${child.delivery_revision}`,
    `specdev(${mission.id}): deliver ${child.id}`,
  ]) {
    try {
      const { stdout } = await execFile(
        'git',
        ['log', 'HEAD', '-1', '--format=%H', '--fixed-strings', `--grep=${message}`],
        { cwd: targetDir }
      )
      if (stdout.trim()) return stdout.trim()
    } catch {
      // An unborn Mission branch cannot contain an integrated child.
    }
  }
  return null
}

async function gitRevision(cwd, ref) {
  try {
    const { stdout } = await execFile('git', ['rev-parse', '--verify', ref], { cwd })
    return stdout.trim() || null
  } catch {
    return null
  }
}

async function gitOutputLines(cwd, args) {
  const { stdout } = await execFile('git', args, { cwd })
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

async function authorChildContract(context, child, assignmentPath) {
  const { targetDir, specdevPath, missionPath, mission } = context
  const profile = withoutNetwork(await resolveAgentProfile(specdevPath, 'worker'))
  const result = await runSpawnedAgent({
    targetDir,
    specdevPath,
    role: 'worker',
    profile,
    mission: mission.id,
    assignment: child.id,
    resultPath: join(assignmentPath, 'review', 'brainstorm-author-result.md'),
    resultKind: 'worker',
    prompt: [
      'Write the child Assignment contract only; do not modify product code.',
      `Mission contract: ${relativeToRepo(targetDir, join(missionPath, 'brainstorm', 'contract.md'))}`,
      `Approved Mission contract hash: ${mission.approved_contract_hash}`,
      `Queue entry: ${child.title}`,
      child.gap_id ? `Durable Mission gap: ${child.gap_id}` : null,
      child.gap_id ? `Gap stage: ${child.gap_stage}` : null,
      child.gap_id
        ? `Gap source: ${missionGap(mission, child.gap_id)?.source?.key || 'unknown'}`
        : null,
      child.gap_id && missionGap(mission, child.gap_id)?.artifact
        ? `Gap evidence: ${missionGap(mission, child.gap_id).artifact}`
        : null,
      ...(await completedOutcomeLines(missionPath, child.id)),
      await optionalArtifactLine(
        targetDir,
        join(missionPath, 'review', 'mission-verdict.md'),
        'Latest Mission review findings'
      ),
      await optionalArtifactLine(
        targetDir,
        join(missionPath, 'review', 'final-verification.json'),
        'Latest integrated verification receipt'
      ),
      `Child contract to replace: ${relativeToRepo(targetDir, join(assignmentPath, 'brainstorm', 'contract.md'))}`,
      'Write a concise delta contract. Reference the Mission path and approved hash; inherit unchanged constraints, non-goals, behavior, and reserved authority instead of restating them.',
      'Keep every exact required Assignment heading: ## Objective and context; ## Scope and non-goals; ## Expected behavior; ## Important decisions; ## Constraints and invariants; ## Delegated and reserved authority; ## Risks and assumptions; ## Verification authority; and ## Acceptance criteria. Do not rename, combine, or omit these headings.',
      'Use one short paragraph or list under each heading. Put prerequisite outcome references in Objective and context or Risks and assumptions instead of creating another heading. Include only the child objective and scope, child-specific decisions and risks, focused verification authority, and the fewest independent observable acceptance criteria (normally 1-3 for a bounded child).',
      'Do not turn implementation tasks, file lists, repository conventions, or generic code quality into acceptance criteria. Keep the child wholly within Mission authority.',
    ]
      .filter(Boolean)
      .join('\n'),
  })
  if (result.status !== 'completed' || result.result.frontmatter.status !== 'completed') {
    throw new Error(result.error || `Child ${child.id} contract worker blocked`)
  }
}

async function deriveSingleChildContract(context, child, assignmentPath) {
  const { targetDir, missionPath, mission } = context
  const missionContractPath = join(missionPath, 'brainstorm', 'contract.md')
  const missionContract = await validateMissionContract(missionPath)
  const acceptance = contractSection(missionContract.content, 'Acceptance criteria')
  if (!acceptance.trim()) throw new Error('Mission contract has no reusable acceptance criteria')
  const parentPath = relativeToRepo(targetDir, missionContractPath)
  const content = `# Assignment contract\n\nKind: ${child.kind || 'change'}\n\nParent Mission contract: \`${parentPath}\`\nParent approved hash: \`${mission.approved_contract_hash}\`\n\n## Objective and context\n\nDeliver the complete approved Mission objective: ${mission.objective}\n\n## Scope and non-goals\n\nInherit the complete parent scope and non-goals without expansion.\n\n## Expected behavior\n\nInherit the parent behavior unchanged.\n\n## Important decisions\n\nNo child-specific decision; ordinary implementation details are delegated.\n\n## Constraints and invariants\n\nInherit the parent constraints and invariants unchanged.\n\n## Delegated and reserved authority\n\n- Delegated: implementation details within the approved parent authority.\n- Reserved for the user: parent-reserved decisions and any material contract change.\n\n## Risks and assumptions\n\nInherit the parent risks and assumptions; report material deviations in progress.json.\n\n## Verification authority\n\n- Focused tests for changed modules: allowed after repository instructions are satisfied.\n- Parent final verification: reserved for the Mission controller.\n- Full suite: prohibited unless this child contract is amended and reapproved.\n\n## Acceptance criteria\n\n${acceptance.trim()}\n`
  await fse.writeFile(join(assignmentPath, 'brainstorm', 'contract.md'), content, 'utf-8')
  await writeAssignmentStatus(assignmentPath, {
    contract_source: {
      type: 'mission-full-scope',
      mission: mission.id,
      parent_path: parentPath,
      parent_hash: mission.approved_contract_hash,
    },
  })
}

async function completedOutcomeLines(missionPath, currentChildId) {
  const queue = await readMissionQueue(missionPath)
  const paths = queue.assignments
    .filter(
      (item) =>
        item.id !== currentChildId &&
        ['completed', 'integrated'].includes(item.status) &&
        item.outcome
    )
    .map((item) => `- ${item.id}: ${item.outcome}`)
  return paths.length > 0 ? ['Completed prerequisite outcomes:', ...paths] : []
}

async function childFollowUp(specdevPath, child) {
  if (!child.folder) return 'none'
  const implementationPath = join(specdevPath, 'assignments', child.folder, 'implementation')
  const progress = await fse.readJson(join(implementationPath, 'progress.json')).catch(() => null)
  if (progress?.follow_up === 'required') return 'required'
  for (const name of ['worker-result.md', 'repair-result.md']) {
    const path = join(implementationPath, name)
    if (!(await fse.pathExists(path))) continue
    const result = parseResultEnvelope(await fse.readFile(path, 'utf-8'), 'worker')
    if (result.frontmatter.follow_up === 'required') return 'required'
  }
  if (progress?.verification?.some((receipt) => receipt.status === 'failed')) return 'required'
  const outcome = await fse
    .readFile(join(specdevPath, 'assignments', child.folder, 'outcome.md'), 'utf-8')
    .catch(() => '')
  if (/^\|[^\n]*\|\s*(Failed|Blocked)\s*\|\s*$/im.test(outcome)) return 'required'
  return 'none'
}

async function reviewMission(context) {
  const { targetDir, specdevPath, missionPath, mission } = context
  const reviewDir = join(missionPath, 'review')
  const statePath = join(reviewDir, 'mission-state.json')
  const verdictPath = join(reviewDir, 'mission-verdict.md')
  await fse.ensureDir(reviewDir)
  const reused = await reusableSingleChildReview(context)
  if (reused) {
    await fse.writeJson(
      statePath,
      {
        version: 2,
        mode: 'automatic',
        stage: 'complete',
        round: 0,
        status: 'approved',
        disposition: 'approved',
        evidence_reused: true,
        child: reused.child.id,
        attempt: reused.state.attempt,
        contract_hash: reused.state.contract_hash,
        candidate_digest: reused.state.candidate_digest,
        updated_at: new Date().toISOString(),
      },
      { spaces: 2 }
    )
    return {
      disposition: 'approved',
      verdict: relativeToRepo(targetDir, reused.verdictPath),
      attempt: reused.state.attempt,
    }
  }
  let state = initialAutomaticReviewState(await fse.readJson(statePath).catch(() => ({})))
  const profile = state.profile
    ? await resolveAgentProfile(specdevPath, 'reviewer', {
        ...state.profile,
        timeout: state.profile.timeout_ms,
      })
    : await resolveAgentProfile(specdevPath, 'reviewer')
  const arbitration = state.stage === 'arbiter'
  const result = await runSpawnedAgent({
    targetDir,
    specdevPath,
    role: 'reviewer',
    profile,
    mission: mission.id,
    resultPath: verdictPath,
    resultKind: 'reviewer',
    guides: [
      { id: 'specdev-review', version: '1', path: join(specdevPath, 'guides', 'review.md') },
    ],
    prompt: [
      arbitration
        ? 'Arbitrate Mission convergence in one final Attempt; do not modify tracked files.'
        : 'Review Mission convergence from existing evidence first; do not re-review every child from scratch and do not modify tracked files.',
      `Mission contract: ${relativeToRepo(targetDir, join(missionPath, 'brainstorm', 'contract.md'))}`,
      `Ordered queue and child outcomes: ${relativeToRepo(targetDir, join(missionPath, 'design', 'assignments.yaml'))}`,
      state.round > 0 ? `Previous findings: ${relativeToRepo(targetDir, verdictPath)}` : null,
      'Check acceptance coverage, integration seams, unresolved risks, and whether final verification is ready. Reuse receipts; never run the full suite.',
      arbitration
        ? 'Return approved for satisfied convergence, needs_changes only for a nonblocking disagreement eligible for strict host evidence validation, and blocked for objective acceptance, verification, authority, or safety failure.'
        : null,
    ]
      .filter(Boolean)
      .join('\n'),
  })
  if (result.status !== 'completed') throw new Error(result.error || 'Mission reviewer failed')
  const verdict = result.result.frontmatter.verdict
  const findings = await fse.readFile(verdictPath, 'utf-8')
  const candidateDigest = await productStateDigest(targetDir)
  const verdictRelative = relativeToRepo(targetDir, verdictPath)
  if (arbitration) {
    const arbitrationResult = recordArbitration(state, {
      verdict,
      attempt: result.attempt.id,
      candidateDigest,
      findings,
    })
    state = { ...arbitrationResult.state, profile }
    let disposition = arbitrationResult.disposition
    if (disposition === 'nonblocking-disagreement') {
      try {
        await assertMissionOverrideEvidence(specdevPath, missionPath)
        disposition = 'nonblocking-override'
        state = {
          ...state,
          status: 'approved',
          disposition,
          evidence_override: true,
        }
      } catch (error) {
        disposition = 'objective-failure'
        state = {
          ...state,
          stage: 'failed',
          status: 'failed',
          disposition,
          override_rejected: error.message,
        }
      }
    }
    await fse.writeJson(statePath, state, { spaces: 2 })
    return {
      disposition,
      verdict: verdictRelative,
      attempt: result.attempt.id,
    }
  }

  const primary = recordPrimaryReview(state, {
    verdict,
    attempt: result.attempt.id,
    candidateDigest,
    findings,
  })
  state = { ...primary.state, profile }
  await fse.writeJson(statePath, state, { spaces: 2 })
  return {
    disposition:
      primary.disposition === 'approved'
        ? 'approved'
        : primary.disposition === 'resolver'
          ? 'resolver'
          : 'repair',
    verdict: verdictRelative,
    attempt: result.attempt.id,
  }
}

async function assertMissionOverrideEvidence(specdevPath, missionPath) {
  const queue = await readMissionQueue(missionPath)
  for (const child of queue.assignments || []) {
    if (!['completed', 'integrated'].includes(child.status) || child.follow_up === 'required') {
      throw new Error(`Mission child ${child.id} is not a complete evidence-safe delivery`)
    }
    const assignmentPath = join(specdevPath, 'assignments', child.folder || '')
    const contract = await validateContractPath(join(assignmentPath, 'brainstorm', 'contract.md'))
    if (!contract.valid) throw new Error(`Mission child ${child.id} contract is invalid`)
    const delivery = await validateDeliveryArtifacts(
      specdevPath,
      assignmentPath,
      contract.acceptanceIds
    )
    assertReviewWaiverEvidence(delivery, contract.acceptanceIds)
  }
}

async function reusableSingleChildReview(context) {
  const { targetDir, specdevPath, missionPath, mission } = context
  const queue = await readMissionQueue(missionPath)
  if (
    queue?.design_mode !== 'single' ||
    queue.assignments?.length !== 1 ||
    mission.pending_replan ||
    mission.gaps?.items?.some((gap) => gap.status !== 'closed')
  )
    return null
  const child = queue.assignments[0]
  if (child.status !== 'completed' || child.follow_up === 'required' || !child.folder) return null
  const assignmentPath = join(specdevPath, 'assignments', child.folder)
  const assignmentStatus = await fse.readJson(join(assignmentPath, 'status.json')).catch(() => null)
  const state = await fse
    .readJson(join(assignmentPath, 'review', 'implementation-state.json'))
    .catch(() => null)
  const verdictPath = join(assignmentPath, 'review', 'implementation-verdict.md')
  if (
    assignmentStatus?.contract_source?.type !== 'mission-full-scope' ||
    assignmentStatus.contract_source.parent_hash !== mission.approved_contract_hash ||
    state?.status !== 'approved' ||
    state.policy_waiver ||
    !state.attempt ||
    !state.candidate_digest ||
    !(await fse.pathExists(verdictPath))
  )
    return null
  const contract = await validateContractPath(join(assignmentPath, 'brainstorm', 'contract.md'))
  if (!contract.valid || state.contract_hash !== contract.hash) return null
  const currentDigest = await productStateDigest(targetDir)
  if (!currentDigest || currentDigest !== state.candidate_digest) return null
  return { child, state, verdictPath }
}

async function recordMissionChildGap(context, child) {
  const { mission } = context
  const signalId = `child:${child.id}:${child.follow_up === 'required' ? 'follow-up' : 'complete'}`
  if (child.gap_id) {
    const gap = missionGap(mission, child.gap_id)
    if (!gap) throw new Error(`Mission child ${child.id} references unknown gap ${child.gap_id}`)
    if (child.follow_up === 'required') {
      advanceMissionGap(mission, gap.id, {
        signalId,
        artifact: child.outcome,
      })
    } else if (['mission-review', 'final-verification'].includes(gap.source.kind)) {
      awaitMissionGapValidation(mission, gap.id, { artifact: child.outcome })
    } else {
      closeMissionGap(mission, gap.id, { evidence: child.outcome })
    }
    return gap
  }
  if (child.follow_up !== 'required') return null
  return openMissionGap(mission, {
    kind: 'child',
    sourceId: child.id,
    signalId,
    artifact: child.outcome,
  }).gap
}

function closeValidatingGap(mission, kind, sourceId, evidence) {
  const gap = missionGapForSource(mission, kind, sourceId)
  if (gap?.status === 'validating') closeMissionGap(mission, gap.id, { evidence })
}

async function adoptLegacyPendingReplan(context) {
  const { missionPath, mission } = context
  if (adoptLegacyMissionReplan(mission)) await writeMission(missionPath, mission)
}

async function resolveMissionGap(context) {
  const { targetDir, specdevPath, missionPath, mission } = context
  const original = await readMissionQueue(missionPath)
  await adoptLegacyPendingReplan(context)
  const gap = actionableMissionGap(mission)
  if (!gap) throw new Error('Mission gap resolution has no actionable durable gap')
  const stage = gap.stage
  if (stage === 'arbiter') return arbitrateMissionGap(context, gap)

  const profile = withoutNetwork(await resolveAgentProfile(specdevPath, 'worker'))
  const resultPath = join(missionPath, 'design', `${gap.id}-${stage}-result.md`)
  const result = await runSpawnedAgent({
    targetDir,
    specdevPath,
    role: 'worker',
    profile,
    mission: mission.id,
    resultPath,
    resultKind: 'worker',
    prompt: [
      stage === 'resolver'
        ? 'Act as the resolver for one durable Mission gap. Add one final focused resolution Assignment to the remaining queue; do not modify product code.'
        : 'Add one focused resolution Assignment for one durable Mission gap; do not modify product code.',
      `Approved Mission contract: ${relativeToRepo(targetDir, join(missionPath, 'brainstorm', 'contract.md'))}`,
      `Queue to edit in place: ${relativeToRepo(targetDir, join(missionPath, 'design', 'assignments.yaml'))}`,
      `Gap: ${gap.id}`,
      `Stable source: ${gap.source.key}`,
      `Resolution stage: ${stage}`,
      gap.artifact ? `Trigger artifact: ${gap.artifact}` : null,
      'Preserve every completed, integrated, or running entry exactly. Existing pending entries may change title or kind but must retain their IDs. New entries must omit IDs and use status: pending; SpecDev allocates identity and appends sequential repair waves.',
      `Every kind must be one of: ${ASSIGNMENT_KINDS.join(', ')}.`,
      'Preserve final_verification exactly. Keep the resolution sequential and small. Do not broaden approved scope, behavior, constraints, reserved authority, or verification authority. If the gap cannot be resolved inside that authority, return blocked without changing the queue.',
    ]
      .filter(Boolean)
      .join('\n'),
  })
  if (result.status !== 'completed') {
    await writeMissionQueue(missionPath, original)
    failMissionGap(mission, gap.id, 'infrastructure-failure', {
      reason: result.error || 'Mission gap resolution provider failed.',
      evidence: result.attempt?.id || null,
    })
    await writeMission(missionPath, mission)
    return {
      reason: gap.source.key,
      gap,
      stage,
      disposition: 'infrastructure-failure',
      attempt: result.attempt,
      error: result.error || 'Mission gap resolution provider failed.',
    }
  }
  if (result.result.frontmatter.status !== 'completed') {
    await writeMissionQueue(missionPath, original)
    failMissionGap(mission, gap.id, 'authority-failure', {
      reason: 'Mission gap cannot be resolved inside approved authority.',
      evidence: result.attempt.id,
    })
    await writeMission(missionPath, mission)
    return {
      reason: gap.source.key,
      gap,
      stage,
      disposition: 'authority-failure',
      attempt: result.attempt,
      error: 'Mission gap cannot be resolved inside approved authority.',
    }
  }

  let revised
  try {
    revised = await validateAndReserveReplannedQueue(
      specdevPath,
      original,
      await readMissionQueue(missionPath)
    )
  } catch (error) {
    await writeMissionQueue(missionPath, original)
    throw error
  }
  let added
  try {
    added = bindReplannedQueueToGap(original, revised, { gapId: gap.id, stage })
  } catch (error) {
    await writeMissionQueue(missionPath, original)
    throw error
  }
  await writeMissionQueue(missionPath, revised)
  attachMissionGapAssignment(mission, gap.id, added.id, { stage })
  if (gap.source.kind === 'mission-review' && stage === 'resolver') {
    const reviewStatePath = join(missionPath, 'review', 'mission-state.json')
    const reviewState = await fse.readJson(reviewStatePath).catch(() => ({}))
    await fse.writeJson(
      reviewStatePath,
      recordResolver(reviewState, {
        attempt: result.attempt.id,
        status: result.result.frontmatter.status,
      }),
      { spaces: 2 }
    )
  }
  delete mission.pending_gap
  delete mission.pending_replan
  delete mission.replan_attempts
  await writeMission(missionPath, mission)
  await retireTransientArtifact(targetDir, specdevPath, resultPath)
  return {
    reason: gap.source.key,
    gap,
    stage,
    disposition: 'resolution-added',
    attempt: result.attempt,
  }
}

async function arbitrateMissionGap(context, gap) {
  const { targetDir, specdevPath, missionPath, mission } = context
  const profile = withoutNetwork(await resolveAgentProfile(specdevPath, 'reviewer'))
  const resultPath = join(missionPath, 'review', `${gap.id}-arbiter-result.md`)
  const result = await runSpawnedAgent({
    targetDir,
    specdevPath,
    role: 'reviewer',
    profile,
    mission: mission.id,
    resultPath,
    resultKind: 'reviewer',
    prompt: [
      'Arbitrate one unresolved Mission gap in a final read-only Attempt. Do not modify tracked files or expand Mission authority.',
      `Mission contract: ${relativeToRepo(targetDir, join(missionPath, 'brainstorm', 'contract.md'))}`,
      `Mission queue: ${relativeToRepo(targetDir, join(missionPath, 'design', 'assignments.yaml'))}`,
      `Gap: ${gap.id}`,
      `Stable source: ${gap.source.key}`,
      gap.artifact ? `Latest evidence: ${gap.artifact}` : null,
      'Return approved only when existing acceptance or verification evidence safely closes the gap. Return needs_changes when evidence proves a semantic objective failure. Return blocked when closure would require authority outside the approved Mission.',
    ]
      .filter(Boolean)
      .join('\n'),
  })
  if (result.status !== 'completed') {
    failMissionGap(mission, gap.id, 'infrastructure-failure', {
      reason: result.error || 'Mission gap arbiter provider failed.',
      evidence: result.attempt?.id || null,
    })
    await writeMission(missionPath, mission)
    return {
      reason: gap.source.key,
      gap,
      stage: 'arbiter',
      disposition: 'infrastructure-failure',
      attempt: result.attempt,
      error: result.error || 'Mission gap arbiter provider failed.',
    }
  }

  const verdict = result.result.frontmatter.verdict
  if (verdict === 'approved') {
    closeMissionGap(mission, gap.id, { evidence: relativeToRepo(targetDir, resultPath) })
    await writeMission(missionPath, mission)
    return {
      reason: gap.source.key,
      gap,
      stage: 'arbiter',
      disposition: 'evidence-closed',
      attempt: result.attempt,
    }
  }
  const disposition = verdict === 'needs_changes' ? 'semantic-failure' : 'authority-failure'
  const error =
    disposition === 'semantic-failure'
      ? `Mission gap ${gap.id} has an arbitrated objective failure.`
      : `Mission gap ${gap.id} cannot be closed inside approved authority.`
  failMissionGap(mission, gap.id, disposition, {
    reason: error,
    evidence: relativeToRepo(targetDir, resultPath),
  })
  await writeMission(missionPath, mission)
  return {
    reason: gap.source.key,
    gap,
    stage: 'arbiter',
    disposition,
    attempt: result.attempt,
    error,
  }
}

async function runFinalVerification(context) {
  const { targetDir, missionPath, flags } = context
  const contract = await validateMissionContract(missionPath)
  const queue = await readMissionQueue(missionPath)
  const command = String(queue.final_verification?.command || '').trim()
  const authorized = authorizedVerificationCommand(contract.content)
  if (!command || command !== authorized) {
    throw new Error(
      'Mission final verification must exactly match the command approved in the Mission contract'
    )
  }
  const started = Date.now()
  const snapshot = await gitSnapshot(targetDir)
  const revision = candidateRevision(snapshot)
  const exitCode = await runForegroundShell(command, targetDir, { json: Boolean(flags.json) })
  const receipt = {
    command,
    revision,
    scope: queue.final_verification?.scope || 'integrated',
    status: exitCode === 0 ? 'passed' : 'failed',
    duration_ms: Date.now() - started,
    completed_at: new Date().toISOString(),
  }
  const path = join(missionPath, 'review', 'final-verification.json')
  await fse.writeJson(path, receipt, { spaces: 2 })
  return { passed: exitCode === 0, path, receipt }
}

async function completeMission(context) {
  const { specdevPath, missionPath, mission } = context
  const queue = await readMissionQueue(missionPath)
  const lines = queue.assignments.map((item) => `- ${item.id}: ${item.title} — ${item.status}`)
  mission.status = 'completed'
  mission.completed_at = new Date().toISOString()
  const activity = await missionActivitySummary(specdevPath, mission)
  const gaps = compactMissionGaps(mission)
  await fse.writeFile(
    join(missionPath, 'outcome.md'),
    `# Mission outcome\n\n## Objective\n\n${mission.objective}\n\n## Base\n\n- Branch: ${mission.base_branch || 'unknown'}\n- Revision: ${mission.base_revision || 'unborn'}\n\n## Assignments\n\n${lines.join('\n')}\n\n## Gap convergence\n\n- Opened: ${gaps.opened}\n- Evidence-closed: ${gaps.closed}\n- Failed: ${gaps.failed}\n\n## Activity\n\n- Orchestration Attempts: ${activity.orchestration_attempt_count}\n- Provider agent Attempts: ${formatProviderAttemptOutcomes(activity.provider_attempts)}\n- Elapsed: ${formatDuration(activity.elapsed_ms)}\n- Provider-reported tokens: ${activity.provider_reported_tokens ?? 'not reported'}\n\n## Delivery\n\nFinal verification passed. The Mission completion commit on branch \`${mission.branch}\` is the durable final checkpoint. Landing onto \`${mission.base_branch}\` is derived separately and is always fast-forward-only.\n`,
    'utf-8'
  )
  mission.activity = activity
  mission.gap_summary = gaps
  delete mission.gaps
  mission.next_action = null
  delete mission.blocker
  delete mission.final_revision
  delete mission.final_dirty_paths
  await writeMission(missionPath, mission)
  await fse.writeJson(
    join(missionPath, 'status.json'),
    { version: 1, status: 'completed', completed_at: mission.completed_at },
    { spaces: 2 }
  )
}

async function completeMissionFailure(context, reason, disposition = 'semantic-failure') {
  const { missionPath, mission } = context
  const queue = await readMissionQueue(missionPath)
  const lines = (queue.assignments || []).map(
    (item) => `- ${item.id}: ${item.title} — ${item.status}`
  )
  const gaps = compactMissionGaps(mission)
  mission.status = 'failed'
  mission.disposition = disposition
  mission.gap_summary = gaps
  mission.failed_at = new Date().toISOString()
  mission.blocker = reason
  mission.next_action = null
  await writeMission(missionPath, mission)
  await fse.writeJson(
    join(missionPath, 'status.json'),
    {
      version: 1,
      status: 'failed',
      failed_at: mission.failed_at,
      disposition,
      reason,
    },
    { spaces: 2 }
  )
  await fse.writeFile(
    join(missionPath, 'outcome.md'),
    `# Mission outcome\n\n## Objective\n\n${mission.objective}\n\n## Assignments\n\n${lines.join('\n') || '- none'}\n\n## Gap convergence\n\n- Opened: ${gaps.opened}\n- Evidence-closed: ${gaps.closed}\n- Failed: ${gaps.failed}\n\n## Delivery\n\n${formatMissionFailure(disposition)}: ${reason}\n`,
    'utf-8'
  )
}

async function validateAndReserveQueue(specdevPath, missionPath) {
  const queue = await readMissionQueue(missionPath)
  if (!queue || !Array.isArray(queue.assignments) || queue.assignments.length === 0) {
    throw new Error('Mission Design requires a non-empty assignments list')
  }
  for (const item of queue.assignments) {
    if (!String(item.title || '').trim())
      throw new Error('Every Mission queue item requires a title')
    if (!ASSIGNMENT_KINDS.includes(item.kind || 'change')) {
      throw new Error(
        `Invalid Mission Assignment kind: ${item.kind}. Valid kinds: ${ASSIGNMENT_KINDS.join(', ')}`
      )
    }
    if (item.status !== 'pending')
      throw new Error('Every new Mission queue item requires status: pending')
  }
  const command = String(queue.final_verification?.command || '').trim()
  if (!command) throw new Error('Mission Design requires final_verification.command')
  const contract = await validateMissionContract(missionPath)
  if (!contract.valid || command !== authorizedVerificationCommand(contract.content)) {
    throw new Error(
      'Mission Design final_verification.command must exactly match the approved Mission contract'
    )
  }

  const suppliedIds = queue.assignments.filter((item) => item.id).map((item) => String(item.id))
  if (suppliedIds.length > 0 && suppliedIds.length !== queue.assignments.length) {
    throw new Error('Mission Design queue contains a partially reserved Assignment ID set')
  }
  if (
    new Set(suppliedIds).size !== suppliedIds.length ||
    suppliedIds.some((id) => !/^\d{5}$/.test(id))
  ) {
    throw new Error('Mission Design queue contains invalid or duplicate reserved Assignment IDs')
  }

  const assignments = []
  for (const item of normalizeMissionWaves(queue.assignments)) {
    assignments.push({
      id: item.id ? String(item.id) : await reserveEntityId(specdevPath, 'assignment'),
      title: String(item.title).trim(),
      kind: item.kind || 'change',
      wave: item.wave,
      status: 'pending',
    })
  }
  return {
    version: 2,
    design_mode: 'planned',
    assignments,
    final_verification: {
      command,
      scope: String(queue.final_verification?.scope || 'integrated').trim() || 'integrated',
    },
  }
}

async function recoverCompletedDesignResult({
  targetDir,
  specdevPath,
  mission,
  queuePath,
  resultPath,
}) {
  if (!(await fse.pathExists(queuePath)) || !(await fse.pathExists(resultPath))) return null
  let result
  try {
    result = parseResultEnvelope(await fse.readFile(resultPath, 'utf-8'), 'worker')
  } catch {
    return null
  }
  if (result.frontmatter.status !== 'completed') return null
  const expectedPath = relativeToRepo(targetDir, resultPath)
  const attempts = await listAttemptRecords(specdevPath, { kind: 'worker', mission: mission.id })
  const attempt = attempts
    .reverse()
    .find((candidate) => candidate.status === 'completed' && candidate.result_path === expectedPath)
  return attempt ? { status: 'completed', result, attempt, recovered: true } : null
}

async function readMissionBrainstormReview(missionPath) {
  const verdictPath = join(missionPath, 'review', 'brainstorm-verdict.md')
  const statePath = join(missionPath, 'review', 'brainstorm-state.json')
  if (!(await fse.pathExists(verdictPath)) || !(await fse.pathExists(statePath))) return null
  try {
    return {
      result: parseResultEnvelope(await fse.readFile(verdictPath, 'utf-8'), 'reviewer'),
      contract_hash: (await fse.readJson(statePath)).contract_hash || null,
    }
  } catch (error) {
    throw new Error(`invalid Mission Brainstorm review verdict: ${error.message}`)
  }
}

async function validateMissionContract(missionPath) {
  const result = await validateContractPath(join(missionPath, 'brainstorm', 'contract.md'))
  if (result.valid && !authorizedVerificationCommand(result.content)) {
    result.valid = false
    result.errors.push('Final integrated verification requires exactly one `- Command: `...`` line')
  }
  if (result.valid) {
    const executionShape = missionExecutionShape(result.content)
    if (!executionShape) {
      result.valid = false
      result.errors.push(
        'Mission execution shape requires exactly one `- Initial child plan: single|planned` line'
      )
    } else if (executionShape === 'planned' && !missionSplitReason(result.content)) {
      result.valid = false
      result.errors.push('A planned Mission requires a concrete Split reason')
    } else {
      result.executionShape = executionShape
    }
  }
  return result
}

function missionExecutionShape(content) {
  const values = [
    ...String(content || '').matchAll(/^\s*-\s+Initial child plan:\s*(single|planned)\s*$/gim),
  ].map((match) => match[1].toLowerCase())
  return values.length === 1 ? values[0] : ''
}

function missionSplitReason(content) {
  const reason =
    String(content || '')
      .match(/^\s*-\s+Split reason:\s*(.+)\s*$/im)?.[1]
      ?.trim() || ''
  return reason && reason.toLowerCase() !== 'none' ? reason : ''
}

function contractSection(content, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return (
    String(content || '').match(
      new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'mi')
    )?.[1] || ''
  )
}

async function assertApprovedMissionContract(missionPath, mission) {
  const contract = await validateMissionContract(missionPath)
  if (!contract.valid || contract.hash !== mission.approved_contract_hash) {
    throw new Error(
      'Mission contract changed after approval; restore the approved contract or create a new Mission for changed authority'
    )
  }
  return contract
}

function authorizedVerificationCommand(content) {
  const commands = [...String(content || '').matchAll(/^\s*-\s+Command:\s+`([^`]+)`\s*$/gim)]
    .map((match) => match[1].trim())
    .filter(Boolean)
  return commands.length === 1 ? commands[0] : ''
}

async function establishMissionBranch(targetDir, mission) {
  const git = await gitSnapshot(targetDir)
  if (git.branch === mission.branch) return
  const localExists = await gitSucceeds(targetDir, [
    'show-ref',
    '--verify',
    '--quiet',
    `refs/heads/${mission.branch}`,
  ])
  const remoteBranch = `origin/${mission.branch}`
  const remoteExists = await gitSucceeds(targetDir, [
    'show-ref',
    '--verify',
    '--quiet',
    `refs/remotes/${remoteBranch}`,
  ])
  if (localExists) {
    if (git.dirty_paths.length > 0)
      throw new Error(`Wrong branch with a dirty worktree. Switch to ${mission.branch} manually.`)
    await execFile('git', ['switch', mission.branch], { cwd: targetDir })
  } else if (remoteExists) {
    if (git.dirty_paths.length > 0)
      throw new Error(`Wrong branch with a dirty worktree. Switch to ${mission.branch} manually.`)
    await execFile('git', ['switch', '--track', '-c', mission.branch, remoteBranch], {
      cwd: targetDir,
    })
  } else {
    await execFile('git', ['switch', '-c', mission.branch], { cwd: targetDir })
  }
}

async function focusMissionRun({ targetDir, mission }) {
  const workflowRoot = workflowRootFor(targetDir)
  const current = getState({ workflowRoot })
  if (current.status === 'ok' && current.run?.status === 'active') {
    if (current.run.id === mission.run_id) return
    if (!(await isMissionOwnedAssignmentRun(targetDir, mission, current.run.id))) {
      throw new Error('Another focused workflow is active; finish or suspend it first')
    }
    suspendRun({ workflowRoot, note: `resume Mission controller ${mission.id}` })
  }
  const run = listRuns({ workflowRoot }).runs.find((candidate) => candidate.id === mission.run_id)
  if (!run) throw new Error(`Mission RippleGraph run not found: ${mission.run_id}`)
  if (run.status !== 'suspended') throw new Error(`Mission run is not resumable: ${run.status}`)
  resumeRun({ workflowRoot, runId: mission.run_id })
}

async function isMissionOwnedAssignmentRun(targetDir, mission, runId) {
  const specdevPath = join(targetDir, '.specdev')
  const resolved = await resolveMissionSelector(specdevPath, mission.id)
  if (!resolved || resolved.ambiguous) return false
  const queue = await readMissionQueue(resolved.path).catch(() => null)
  for (const child of queue?.assignments || []) {
    const assignment = await findAssignmentFolder(specdevPath, child.id, { allowMissing: true })
    if (!assignment) continue
    const status = await fse.readJson(join(assignment.path, 'status.json')).catch(() => null)
    if (status?.mission === mission.id && status.run_id === runId) return true
  }
  return false
}

async function claimMissionController(context, flags) {
  const { specdevPath, missionPath, mission, targetDir } = context
  const running = await listAttemptRecords(specdevPath, {
    kind: 'mission-controller',
    mission: mission.id,
    status: 'running',
  })
  for (const record of running) {
    const liveness = await attemptLiveness(specdevPath, record.id)
    if (liveness.state === 'live_local')
      return fail(flags, `Mission ${mission.id} already has a live local controller`)
    if (!flags.takeover)
      return fail(
        flags,
        `Mission ${mission.id} has an interrupted/ambiguous controller ${record.id}; rerun with --takeover`
      )
    await updateAttemptRecord(specdevPath, record.id, {
      status: 'interrupted',
      error: 'explicit takeover',
    })
    await clearLocalProcessMarker(specdevPath, record.id)
  }
  const attempt = await createAttemptRecord(specdevPath, {
    kind: 'mission-controller',
    mission: mission.id,
    workspace: '.',
    base_revision: (await gitSnapshot(targetDir)).revision,
  })
  mission.status = 'running'
  mission.next_action = `Mission ${mission.id} is running in the foreground.`
  delete mission.blocker
  mission.updated_at = new Date().toISOString()
  await writeMission(missionPath, mission)
  await writeLocalProcessMarker(specdevPath, attempt.id)
  return attempt
}

async function pauseMission(selector, flags) {
  const context = await missionContext(selector, flags)
  if (!context) return null
  const running = await listAttemptRecords(context.specdevPath, {
    kind: 'mission-controller',
    mission: context.mission.id,
    status: 'running',
  })
  for (const record of running) {
    if ((await attemptLiveness(context.specdevPath, record.id)).state === 'live_local') {
      return fail(flags, 'Stop the foreground Mission controller before pausing it')
    }
    await updateAttemptRecord(context.specdevPath, record.id, {
      status: 'interrupted',
      error: 'mission paused',
    })
    await clearLocalProcessMarker(context.specdevPath, record.id)
  }
  const state = getState({ workflowRoot: workflowRootFor(context.targetDir) })
  if (state.status === 'ok' && state.run?.id === context.mission.run_id) {
    suspendRun({ workflowRoot: workflowRootFor(context.targetDir), note: 'paused by user' })
  }
  context.mission.status = 'paused'
  context.mission.next_action = `Resume with specdev mission run ${context.mission.id}.`
  delete context.mission.blocker
  await writeMission(context.missionPath, context.mission)
  return emit(flags, {
    command: 'mission pause',
    version: 1,
    status: 'paused',
    mission: context.mission.id,
    next_action: context.mission.next_action,
  })
}

async function missionLand(selector, flags) {
  const context = await missionContext(selector, flags, { recoverCompleted: true })
  if (!context) return null
  if (context.mission.status !== 'completed') {
    return fail(flags, `Mission ${context.mission.id} must be completed before it can land`)
  }
  const landing = await missionLanding(context, { attempt: true })
  return emit(flags, {
    command: 'mission land',
    version: 1,
    status: landing.status,
    mission: context.mission.id,
    branch: context.mission.branch,
    base_branch: context.mission.base_branch,
    final_revision: landing.final_revision,
    checked_out_branch: landing.checked_out_branch,
    dirty_paths: landing.dirty_paths || [],
    landing,
    next_action: landingNextAction(context.mission, landing),
  })
}

async function missionStatus(selector, flags) {
  const context = await missionContext(selector, flags, { recoverCompleted: true })
  if (!context) return null
  const queue = await readMissionQueue(context.missionPath).catch(() => null)
  const assignments = queue?.assignments || []
  const phase = readMissionPhase(context.specdevPath, context.mission.run_id)
  const runningAttempts = await listAttemptRecords(context.specdevPath, {
    kind: 'mission-controller',
    mission: context.mission.id,
    status: 'running',
  })
  const controllerStates = await Promise.all(
    runningAttempts.map(async (record) => ({
      id: record.id,
      liveness: await attemptLiveness(context.specdevPath, record.id),
    }))
  )
  const liveController = controllerStates.find((item) => item.liveness.state === 'live_local')
  const interruptedController = liveController ? null : controllerStates.at(-1) || null
  const effectiveStatus =
    interruptedController && context.mission.status === 'running'
      ? 'interrupted'
      : context.mission.status
  const blocker =
    context.mission.blocker ||
    (interruptedController
      ? `Controller ${interruptedController.id} is ${interruptedController.liveness.state}; inspect it before takeover.`
      : null)
  const lastChild =
    [...assignments].reverse().find((item) => ['completed', 'integrated'].includes(item.status)) ||
    null
  const currentGit = await gitSnapshot(context.targetDir)
  const lastCheckpoint = context.mission.last_checkpoint
    ? {
        ...context.mission.last_checkpoint,
        revision: await latestCheckpointRevision(
          context.targetDir,
          context.mission.branch,
          context.mission.id
        ),
      }
    : null
  const activity = await missionActivitySummary(context.specdevPath, context.mission)
  const landing =
    context.mission.status === 'completed'
      ? await missionLanding(context, { attempt: false })
      : null
  const nextAction =
    landingNextAction(context.mission, landing) ||
    missionNextAction(context.mission, phase, Boolean(liveController), interruptedController)
  return emit(flags, {
    command: 'mission status',
    version: 1,
    status: effectiveStatus,
    mission: context.mission.id,
    phase,
    branch: context.mission.branch,
    revision:
      (await gitBranchRevision(context.targetDir, context.mission.branch)) || currentGit.revision,
    checked_out_branch: currentGit.branch,
    dirty_paths: currentGit.dirty_paths,
    current_child: assignments.find((item) => item.status === 'running')?.id || null,
    current_children: assignments
      .filter((item) => item.status === 'running')
      .map((item) => item.id),
    current_wave: currentMissionWave(queue),
    last_child: lastChild?.id || null,
    counts: Object.fromEntries(
      ['pending', 'running', 'completed', 'integrated', 'blocked', 'cancelled'].map((status) => [
        status,
        assignments.filter((item) => item.status === status).length,
      ])
    ),
    controller: liveController
      ? { attempt: liveController.id, state: 'live_local' }
      : interruptedController
        ? { attempt: interruptedController.id, state: interruptedController.liveness.state }
        : null,
    last_checkpoint: lastCheckpoint,
    activity,
    landing,
    blocker,
    next_action: nextAction,
    outcome: (await fse.pathExists(join(context.missionPath, 'outcome.md')))
      ? relativeToRepo(context.targetDir, join(context.missionPath, 'outcome.md'))
      : null,
  })
}

async function checkpointMission(selector, flags, metadata = {}) {
  const context = await missionContext(selector, flags)
  if (!context) return null
  const git = await gitSnapshot(context.targetDir)
  if (git.branch !== context.mission.branch)
    return fail(flags, `Mission checkpoint requires branch ${context.mission.branch}`)
  await execFile('git', ['add', '-A'], { cwd: context.targetDir })
  await unstageIncompleteDiscussions(context)
  await unstageIncompleteTestAudits(context)
  const hasChanges = !(await gitSucceeds(context.targetDir, ['diff', '--cached', '--quiet']))
  if (hasChanges) {
    context.mission.last_checkpoint = {
      base_revision: git.revision || 'unborn',
      push_requested: Boolean(flags.push),
      created_at: new Date().toISOString(),
    }
    await writeMission(context.missionPath, context.mission)
    await execFile(
      'git',
      ['add', '--', relativeToRepo(context.targetDir, join(context.missionPath, 'mission.yaml'))],
      { cwd: context.targetDir }
    )
    const trailers = [
      `SpecDev-Mission: ${context.mission.id}`,
      metadata.assignmentId ? `SpecDev-Assignment: ${metadata.assignmentId}` : null,
      `SpecDev-Commit-Type: ${metadata.commitType || 'checkpoint'}`,
    ]
      .filter(Boolean)
      .join('\n')
    await execFile(
      'git',
      ['commit', '-m', `specdev: checkpoint ${context.mission.id}`, '-m', trailers],
      { cwd: context.targetDir }
    )
  }
  if (flags.push) {
    await execFile('git', ['push', '-u', 'origin', context.mission.branch], {
      cwd: context.targetDir,
    })
  }
  const revision = (await gitSnapshot(context.targetDir)).revision
  return emit(flags, {
    command: 'mission checkpoint',
    version: 1,
    status: 'ok',
    mission: context.mission.id,
    committed: hasChanges,
    pushed: Boolean(flags.push),
    revision,
  })
}

function readMissionPhase(specdevPath, runId) {
  if (!runId) return null
  try {
    return readCheckpoint(specdevPath, runId).position?.node || null
  } catch {
    return null
  }
}

async function unstageIncompleteDiscussions(context) {
  const root = join(context.specdevPath, 'discussions')
  if (!(await fse.pathExists(root))) return
  const hasHead = await gitSucceeds(context.targetDir, ['rev-parse', '--verify', 'HEAD'])
  for (const entry of await fse.readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const id = entry.name.match(/^D\d{4,5}/)?.[0]
    if (!id) continue
    let completed = false
    try {
      const call = readGuidedCall(context.targetDir, id)
      completed = call.synchronized && call.state.status === 'completed'
    } catch {
      // A folder without a readable callable checkpoint is incomplete.
    }
    if (completed) continue
    const path = `.specdev/discussions/${entry.name}`
    if (hasHead) {
      await execFile('git', ['restore', '--staged', '--', path], { cwd: context.targetDir })
    } else {
      await execFile('git', ['rm', '--cached', '-r', '--ignore-unmatch', '--', path], {
        cwd: context.targetDir,
      })
    }
  }
}

async function unstageIncompleteTestAudits(context) {
  const root = join(context.specdevPath, 'test-audits')
  if (!(await fse.pathExists(root))) return
  const hasHead = await gitSucceeds(context.targetDir, ['rev-parse', '--verify', 'HEAD'])
  for (const entry of await fse.readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const id = entry.name.match(/^TA\d{5}/)?.[0]
    if (!id) continue
    let completed = false
    try {
      const call = readGuidedCall(context.targetDir, id)
      completed = call.synchronized && call.state.status === 'completed'
    } catch {
      // A folder without a readable callable checkpoint is incomplete.
    }
    if (completed) continue
    const path = `.specdev/test-audits/${entry.name}`
    if (hasHead)
      await execFile('git', ['restore', '--staged', '--', path], { cwd: context.targetDir })
    else
      await execFile('git', ['rm', '--cached', '-r', '--ignore-unmatch', '--', path], {
        cwd: context.targetDir,
      })
  }
}

async function missionContext(selector, flags, { recoverCompleted = false } = {}) {
  if (!selector) return fail(flags, 'Mission ID is required')
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)
  const resolved = await resolveMissionSelector(specdevPath, selector)
  if (resolved && !resolved.ambiguous) {
    const mission = await readMission(resolved.path)
    return { targetDir, specdevPath, missionPath: resolved.path, mission }
  }
  const recovered = recoverCompleted
    ? await recoverCompletedMissionContext(targetDir, specdevPath, selector)
    : null
  if (!recovered || recovered.ambiguous || resolved?.ambiguous)
    return fail(flags, `Mission not found or ambiguous: ${selector}`)
  return recovered
}

async function recoverCompletedMissionContext(targetDir, specdevPath, selector) {
  const wanted = String(selector || '').trim()
  if (!/^M\d{5}(?:_[^/\\]+)?$/.test(wanted)) return null
  const missionId = wanted.slice(0, 6)
  let revisions
  try {
    const { stdout } = await execFile(
      'git',
      ['log', '--all', '--format=%H', '--fixed-strings', `--grep=SpecDev-Mission: ${missionId}`],
      { cwd: targetDir }
    )
    revisions = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^[0-9a-f]{40,64}$/.test(line))
  } catch {
    return null
  }

  for (const revision of revisions) {
    const { stdout: message } = await execFile('git', ['show', '-s', '--format=%B', revision], {
      cwd: targetDir,
    })
    const trailers = message.split(/\r?\n/).map((line) => line.trim())
    if (
      !trailers.includes(`SpecDev-Mission: ${missionId}`) ||
      !trailers.includes('SpecDev-Commit-Type: completion')
    ) {
      continue
    }

    const { stdout: tree } = await execFile(
      'git',
      ['ls-tree', '-r', '--name-only', revision, '--', '.specdev/missions'],
      { cwd: targetDir }
    )
    const names = tree
      .split(/\r?\n/)
      .map((path) => path.match(/^\.specdev\/missions\/(M\d{5}_[^/\\]+)\/mission\.yaml$/)?.[1])
      .filter(
        (name) =>
          name && name.startsWith(`${missionId}_`) && (!wanted.includes('_') || name === wanted)
      )
    if (names.length > 1) return { ambiguous: true }
    if (names.length === 0) continue

    const name = names[0]
    const repoPath = `.specdev/missions/${name}/mission.yaml`
    try {
      const { stdout } = await execFile('git', ['show', `${revision}:${repoPath}`], {
        cwd: targetDir,
      })
      const mission = parseYaml(stdout)
      if (
        !mission ||
        mission.id !== missionId ||
        mission.status !== 'completed' ||
        typeof mission.branch !== 'string'
      ) {
        continue
      }
      return {
        targetDir,
        specdevPath,
        missionPath: join(specdevPath, 'missions', name),
        mission: { ...mission, final_revision: revision },
      }
    } catch {
      // Ignore malformed or unreadable historical Mission records.
    }
  }
  return null
}

async function resolveSourceDiscussion(targetDir, specdevPath, selector, flags) {
  if (!selector) return null
  const resolved = await resolveDiscussionSelector(specdevPath, String(selector))
  if (!resolved || resolved.error) {
    fail(flags, `Discussion not found: ${selector}`)
    return null
  }
  const id = resolved.name.match(/^D\d{4,5}/)?.[0]
  const call = readGuidedCall(targetDir, id)
  if (!call.synchronized || call.state.status !== 'completed') {
    fail(flags, `Discussion ${id} must be completed before promotion`)
    return null
  }
  const completedHash = call.state.output?.artifact_hash
  const currentHash = await discussionArtifactHash(resolved.path)
  if (!completedHash || completedHash !== currentHash) {
    fail(
      flags,
      `Discussion ${id} changed after completion; restore its completed artifacts or create a new Discussion`
    )
    return null
  }
  return {
    id,
    path: resolved.path,
    repoPath: relativeToRepo(targetDir, resolved.path),
    hash: currentHash,
  }
}

async function objectiveFromDiscussion(source) {
  if (!source) return ''
  const content = await fse.readFile(join(source.path, 'brainstorm', 'proposal.md'))
  return (
    String(content)
      .match(/^#\s+(.+)$/m)?.[1]
      ?.trim() || `Promote discussion ${source.id}`
  )
}

async function findAssignmentFolder(specdevPath, id, { allowMissing = false } = {}) {
  const root = join(specdevPath, 'assignments')
  if (!(await fse.pathExists(root))) {
    if (allowMissing) return null
    throw new Error(`Could not resolve child Assignment ${id}`)
  }
  const entries = await fse.readdir(root, { withFileTypes: true })
  const matches = entries.filter((entry) => entry.isDirectory() && entry.name.startsWith(`${id}_`))
  if (matches.length === 0 && allowMissing) return null
  if (matches.length !== 1) throw new Error(`Could not resolve child Assignment ${id}`)
  return { name: matches[0].name, path: join(root, matches[0].name) }
}

async function optionalArtifactLine(targetDir, path, label) {
  return (await fse.pathExists(path)) ? `${label}: ${relativeToRepo(targetDir, path)}` : null
}

function runForegroundShell(command, cwd, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('/bin/sh', ['-lc', command], {
      cwd,
      stdio: options.json ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    })
    if (options.json) {
      child.stdout.pipe(process.stderr)
      child.stderr.pipe(process.stderr)
    }
    child.on('error', reject)
    child.on('close', (code) => resolvePromise(code ?? 1))
  })
}

async function gitSucceeds(cwd, args) {
  try {
    await execFile('git', args, { cwd })
    return true
  } catch {
    return false
  }
}

async function gitBranchRevision(cwd, branch) {
  try {
    const { stdout } = await execFile('git', ['rev-parse', branch], { cwd })
    return stdout.trim() || null
  } catch {
    return null
  }
}

async function latestCheckpointRevision(cwd, branch, missionId) {
  try {
    const { stdout } = await execFile(
      'git',
      [
        'log',
        `refs/heads/${branch}`,
        '-1',
        '--format=%H',
        '--fixed-strings',
        `--grep=specdev: checkpoint ${missionId}`,
      ],
      { cwd }
    )
    return stdout.trim() || null
  } catch {
    return null
  }
}

async function missionLanding(context, { attempt, finalRevision = null } = {}) {
  const revision =
    finalRevision ||
    context.mission.final_revision ||
    (await latestMissionCompletionRevision(
      context.targetDir,
      context.mission.branch,
      context.mission.id
    ))
  const options = { finalRevision: revision }
  return attempt
    ? landMission(context.targetDir, context.mission, options)
    : inspectMissionLanding(context.targetDir, context.mission, options)
}

async function latestMissionCompletionRevision(cwd, branch, missionId) {
  try {
    const { stdout } = await execFile(
      'git',
      [
        'log',
        `refs/heads/${branch}`,
        '--format=%H',
        '--fixed-strings',
        `--grep=SpecDev-Mission: ${missionId}`,
      ],
      { cwd }
    )
    for (const revision of stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)) {
      const { stdout: message } = await execFile('git', ['show', '-s', '--format=%B', revision], {
        cwd,
      })
      const lines = message.split(/\r?\n/).map((line) => line.trim())
      if (
        lines.includes(`SpecDev-Mission: ${missionId}`) &&
        lines.includes('SpecDev-Commit-Type: completion')
      ) {
        return revision
      }
    }
  } catch {
    // A missing local Mission branch is reported by the landing classifier.
  }
  return null
}

async function withSuppressedOutput(callback) {
  const previousLog = console.log
  const previousError = console.error
  const previousExit = process.exitCode
  const output = []
  console.log = (...args) => output.push(args.join(' '))
  console.error = (...args) => output.push(args.join(' '))
  process.exitCode = undefined
  try {
    const result = await callback()
    return result
  } finally {
    console.log = previousLog
    console.error = previousError
    process.exitCode = previousExit
  }
}

function slugify(value) {
  return (
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'mission'
  )
}

function withoutNetwork(profile) {
  return profile.network ? { ...profile, network: false } : profile
}

function candidateRevision(snapshot) {
  const revision = snapshot.revision || 'unborn'
  return snapshot.dirty_paths.length > 0 ? `working-tree@${revision}` : revision
}

function formatMissionFailure(disposition) {
  if (disposition === 'authority-failure') return 'Authority terminal failure'
  if (disposition === 'infrastructure-failure') return 'Infrastructure terminal failure'
  return 'Semantic terminal failure'
}

function missionNextAction(mission, phase, liveController, interruptedController = null) {
  if (mission.status === 'completed') return null
  if (liveController) return `Mission ${mission.id} is running in the foreground.`
  if (interruptedController)
    return `Inspect ${interruptedController.id}, then run specdev mission run ${mission.id} --takeover.`
  if (mission.status === 'blocked')
    return mission.next_action || `Resolve the blocker, then run specdev mission run ${mission.id}.`
  if (mission.status === 'paused') return `Resume with specdev mission run ${mission.id}.`
  if (phase === 'approve-mission' || mission.status === 'awaiting_approval') {
    return `After explicit user agreement, run specdev mission run ${mission.id} --approve.`
  }
  if (phase === 'brainstorm')
    return `Finish the Mission contract, then run specdev mission run ${mission.id}.`
  return mission.next_action || `Run specdev mission run ${mission.id}.`
}

function landingNextAction(mission, landing) {
  if (!landing || landing.status !== 'pending') return null
  return `Inspect landing reason ${landing.reason}, then run specdev mission land ${mission.id}.`
}

async function missionActivitySummary(specdevPath, mission) {
  if (mission.status === 'completed' && mission.activity) return mission.activity
  return attemptActivitySummary(
    specdevPath,
    { mission: mission.id },
    {
      startedAt: mission.approved_at || mission.created_at,
      endedAt: mission.completed_at,
    }
  )
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.round((Number(milliseconds) || 0) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours ? `${hours}h` : null, minutes ? `${minutes}m` : null, `${seconds}s`]
    .filter(Boolean)
    .join(' ')
}

function formatProviderAttemptOutcomes(attempts = {}) {
  const outcomes = ['completed', 'failed', 'blocked', 'interrupted', 'running']
    .filter((status) => Number(attempts[status]) > 0)
    .map((status) => `${attempts[status]} ${status}`)
  return `${attempts.total || 0} total${outcomes.length > 0 ? ` (${outcomes.join(', ')})` : ''}`
}

function emit(flags, payload) {
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else {
    console.log(`Mission ${payload.mission || payload.id}: ${payload.status}`)
    if (payload.path) console.log(`Path: ${payload.path}`)
    if (payload.contract) console.log(`Contract: ${payload.contract}`)
    if (payload.phase) console.log(`Phase: ${payload.phase}`)
    if (payload.branch) console.log(`Branch: ${payload.branch}`)
    if (payload.contract_hash) console.log(`Contract hash: ${payload.contract_hash}`)
    if (payload.contract_preview?.length > 0) {
      console.log('Contract preview:')
      for (const line of payload.contract_preview) console.log(`  - ${line}`)
    }
    if (payload.review?.verdict) console.log(`Review verdict: ${payload.review.verdict}`)
    if (payload.review?.stale)
      console.log(
        `Review note: the saved verdict covered older contract hash ${payload.review.reviewed_contract_hash}`
      )
    for (const line of workspaceChangeSummaryLines(payload.dirty_paths)) console.log(line)
    if (payload.base_branch) console.log(`Base branch: ${payload.base_branch}`)
    if (payload.final_revision) console.log(`Final revision: ${payload.final_revision}`)
    if (payload.landing) {
      console.log(`Landing: ${payload.landing.status} (${payload.landing.reason})`)
      if (payload.landing.detail) console.log(`Landing detail: ${payload.landing.detail}`)
      if (payload.landing.choices?.length > 0) {
        console.log('Landing choices:')
        for (const choice of payload.landing.choices) {
          console.log(`  - ${choice.action}: ${choice.command || 'leave Git state unchanged'}`)
        }
      }
    }
    if (payload.blocker) console.log(`Blocker: ${payload.blocker}`)
    if (payload.last_checkpoint)
      console.log(
        `Last checkpoint: ${payload.last_checkpoint.revision || payload.last_checkpoint.created_at || payload.last_checkpoint.base_revision}`
      )
    if (payload.activity) {
      console.log(`Orchestration Attempts: ${payload.activity.orchestration_attempt_count}`)
      console.log(
        `Provider agent Attempts: ${formatProviderAttemptOutcomes(payload.activity.provider_attempts)}`
      )
      console.log(`Elapsed: ${formatDuration(payload.activity.elapsed_ms)}`)
      if (payload.activity.provider_reported_tokens !== null)
        console.log(`Provider-reported tokens: ${payload.activity.provider_reported_tokens}`)
    }
    if (payload.next_action) console.log(`Next: ${payload.next_action}`)
  }
  return payload
}

function fail(flags, message) {
  if (flags?.json)
    console.log(JSON.stringify({ command: 'mission', version: 1, status: 'error', error: message }))
  else console.error(message)
  process.exitCode = 1
  return null
}
