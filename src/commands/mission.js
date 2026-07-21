import { spawn } from 'node:child_process'
import { execFile as execFileCallback } from 'node:child_process'
import { join } from 'node:path'
import { promisify } from 'node:util'
import fse from 'fs-extra'
import { getState, listRuns, resumeRun, suspendRun } from 'ripplegraph'
import { resolveAgentProfile } from '../utils/agent-profiles.js'
import { parseResultEnvelope } from '../utils/result-envelope.js'
import {
  ASSIGNMENT_KINDS,
  assignmentContractTemplate,
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
import { assignmentCommand } from './assignment.js'
import { checkpointCommand } from './checkpoint.js'
import { implementCommand } from './implement.js'
import { reviewBrainstorm } from './reviewloop.js'
import {
  compactCompletedWorkflowRuntime,
  retireTransientArtifact,
} from '../utils/artifact-retention.js'
import { workspaceChangeSummaryLines } from '../utils/workspace-changes.js'

const execFile = promisify(execFileCallback)

export async function missionCommand(positionalArgs = [], flags = {}) {
  const subcommand = positionalArgs[0]
  const rest = positionalArgs.slice(1)
  if (subcommand === 'create') return createMission(rest, flags)
  if (subcommand === 'run') return runMission(rest[0], flags)
  if (subcommand === 'status') return missionStatus(rest[0], flags)
  if (subcommand === 'pause') return pauseMission(rest[0], flags)
  if (subcommand === 'checkpoint') return checkpointMission(rest[0], flags)
  console.error('Usage: specdev mission <create | run | status | pause | checkpoint>')
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
    return emit(flags, {
      command: 'mission run',
      version: 1,
      status: 'completed',
      mission: mission.id,
      branch: mission.branch,
      base_branch: mission.base_branch,
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
    const childReviewOverrideRequested =
      Boolean(flags['override-review']) &&
      graph.position?.graph === 'assignment-lifecycle' &&
      graph.position?.node === 'approve-contract'
    const childReviewOverrideId = childReviewOverrideRequested
      ? (await readMissionQueue(missionPath))?.assignments?.find(
          (item) => item.status === 'running'
        )?.id || null
      : null
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
          contract_hash: contract.hash,
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
        childReviewOverrideId,
        controller,
      })
      if (payload?.status !== 'completed') {
        await updateAttemptRecord(specdevPath, controller.id, { status: 'blocked' })
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
    if (graph.position?.graph === 'assignment-lifecycle') {
      await runMissionChild(context, graph)
      continue
    }
    if (node === 'design') {
      await designMission(context)
      continue
    }
    if (node === 'advance-queue') {
      const queue = await readMissionQueue(missionPath)
      const running = queue.assignments.find((item) => item.status === 'running')
      if (!running) throw new Error('Mission queue has no running child to advance')
      running.status = 'completed'
      running.outcome = `.specdev/assignments/${running.folder}/outcome.md`
      running.completed_at = new Date().toISOString()
      running.follow_up = await childFollowUp(specdevPath, running)
      await writeMissionQueue(missionPath, queue)
      const remaining = queue.assignments.some((item) => item.status === 'pending')
      const followUpRequired = running.follow_up === 'required'
      if (followUpRequired) {
        mission.pending_replan = {
          reason: 'child_follow_up',
          child: running.id,
          artifact: running.outcome,
          created_at: new Date().toISOString(),
        }
        await writeMission(missionPath, mission)
      }
      stepGuidedNode(targetDir, 'advance-queue', {
        remaining,
        completed: running.id,
        follow_up_required: followUpRequired,
      })
      continue
    }
    if (node === 'mission-review') {
      const approved = await reviewMission(context)
      if (!approved) {
        const reviewState = await fse.readJson(join(missionPath, 'review', 'mission-state.json'))
        if (reviewState.round >= 2)
          throw new Error(
            'Mission review failed its verification rerun; user direction is required'
          )
        mission.pending_replan = {
          reason: 'mission_review',
          artifact: relativeToRepo(targetDir, join(missionPath, 'review', 'mission-verdict.md')),
          created_at: new Date().toISOString(),
        }
        await writeMission(missionPath, mission)
        stepGuidedNode(targetDir, 'mission-review', {
          approved: false,
          verdict:
            '.specdev/' +
            relativeToRepo(specdevPath, join(missionPath, 'review', 'mission-verdict.md')),
          attempt: reviewState.attempt,
        })
        continue
      }
      continue
    }
    if (node === 'replan') {
      const replanned = await replanMission(context)
      stepGuidedNode(targetDir, 'replan', {
        queue: relativeToRepo(targetDir, join(missionPath, 'design', 'assignments.yaml')),
        reason: replanned.reason,
        attempt: replanned.attempt.id,
      })
      continue
    }
    if (node === 'final-verification') {
      const result = await runFinalVerification(context)
      stepGuidedNode(targetDir, 'final-verification', {
        passed: result.passed,
        receipt: relativeToRepo(targetDir, result.path),
      })
      if (!result.passed) {
        mission.verification_failures = (mission.verification_failures || 0) + 1
        mission.pending_replan = {
          reason: 'final_verification',
          artifact: relativeToRepo(targetDir, result.path),
          created_at: new Date().toISOString(),
        }
        await writeMission(missionPath, mission)
        if (mission.verification_failures > 1)
          throw new Error('Final verification failed again; user direction is required')
        continue
      }
      await completeMission(context)
      await updateAttemptRecord(specdevPath, context.controller.id, { status: 'completed' })
      const runtime = await compactCompletedWorkflowRuntime(specdevPath, {
        runId: mission.run_id,
        attemptFilter: { mission: mission.id },
        focus: { kind: 'mission', id: mission.id },
      })
      const checkpoint = await withSuppressedOutput(() =>
        checkpointMission(mission.id, {
          target: targetDir,
          json: true,
        })
      )
      if (!checkpoint || checkpoint.status !== 'ok' || !checkpoint.revision) {
        throw new Error(checkpoint?.error || 'Mission completion checkpoint failed')
      }
      mission.final_revision = checkpoint.revision
      mission.final_dirty_paths = (await gitSnapshot(targetDir)).dirty_paths
      return emit(flags, {
        command: 'mission run',
        version: 1,
        status: 'completed',
        mission: mission.id,
        branch: mission.branch,
        base_branch: mission.base_branch,
        final_revision: mission.final_revision,
        dirty_paths: mission.final_dirty_paths || [],
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

async function designMission(context) {
  const { targetDir, specdevPath, missionPath, mission } = context
  const queuePath = join(missionPath, 'design', 'assignments.yaml')
  const contract = await validateMissionContract(missionPath)
  if (contract.executionShape === 'single') {
    const queue = {
      version: 1,
      design_mode: 'single',
      assignments: [
        {
          id: await reserveEntityId(specdevPath, 'assignment'),
          title: mission.objective,
          kind: 'change',
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
        'Design a sequential Mission plan. Do not modify product code.',
        `Approved Mission contract: ${relativeToRepo(targetDir, join(missionPath, 'brainstorm', 'contract.md'))}`,
        `Write ${relativeToRepo(targetDir, queuePath)} as YAML with version: 1, an ordered assignments list containing only title, kind, status: pending, and a final_verification mapping with the exact contract-authorized command and scope.`,
        `Every kind must be one of: ${ASSIGNMENT_KINDS.join(', ')}.`,
        'Start by trying to express the entire Mission as one Assignment. Split only for a worker/reviewer context limit, an information dependency, an intermediate user/operational decision, or meaningfully independent verification/rollback.',
        'File count, architectural layers, and the existence of several implementation Tasks are not split reasons. When uncertain, write one Assignment.',
        'Do not assign IDs, add dependencies, create a graph, or invoke agents.',
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
  })
  await retireTransientArtifact(targetDir, specdevPath, resultPath)
}

async function runMissionChild(context) {
  const { targetDir, specdevPath, missionPath, mission, childReviewOverrideId } = context
  const queue = await readMissionQueue(missionPath)
  let child = queue.assignments.find((item) => item.status === 'running')
  if (!child) {
    child = queue.assignments.find((item) => item.status === 'pending')
    if (!child) throw new Error('Mission child graph entered with no pending Assignment')
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
  const childReviewOverride = childReviewOverrideId === child.id
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
      const savedReview = await fse
        .readJson(join(assignmentPath, 'review', 'brainstorm-state.json'))
        .catch(() => null)
      let review
      if (savedReview?.status === 'blocked') {
        review = {
          status: 'blocked',
          material_divergence: savedReview.material_divergence ?? false,
        }
      } else if (savedReview?.status === 'needs_changes') {
        await reviseChildContract(context, child, assignmentPath)
        review = await withSuppressedOutput(() =>
          reviewBrainstorm({ target: targetDir, assignment: child.id, json: true })
        )
      } else {
        review = await withSuppressedOutput(() =>
          reviewBrainstorm({ target: targetDir, assignment: child.id, json: true })
        )
      }
      if (review?.status === 'needs_changes') {
        await reviseChildContract(context, child, assignmentPath)
        review = await withSuppressedOutput(() =>
          reviewBrainstorm({ target: targetDir, assignment: child.id, json: true })
        )
      }
      if (!review)
        throw new Error(`Child ${child.id} Brainstorm review did not produce a durable verdict`)
      if (review?.status !== 'approved' && !childReviewOverride) {
        throw new Error(
          `Child ${child.id} Brainstorm review blocked; after explicit user direction, rerun with --override-review`
        )
      }
      if (review?.material_divergence === true && !childReviewOverride) {
        throw new Error(
          `Child ${child.id} Brainstorm materially diverges from its reviewed baseline; after explicit user direction, rerun with --override-review`
        )
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
      review_override: childReviewOverride,
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
    await writeCurrentFocus(specdevPath, { kind: 'mission', id: mission.id })
  }
  if (result?.status !== 'approved' && result?.status !== 'completed') {
    const status = await fse.readJson(join(assignmentPath, 'status.json')).catch(() => null)
    if (status?.status !== 'completed') {
      throw new Error(result?.error || `Child ${child.id} implementation blocked`)
    }
  }
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
      'Use one short paragraph or list per required section. Include only the child objective and scope, prerequisite outcome references, child-specific decisions and risks, focused verification authority, and the fewest independent observable acceptance criteria (normally 1-3 for a bounded child).',
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
    .filter((item) => item.id !== currentChildId && item.status === 'completed' && item.outcome)
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

async function reviseChildContract(context, child, assignmentPath) {
  const { targetDir, specdevPath, mission } = context
  const profile = withoutNetwork(await resolveAgentProfile(specdevPath, 'worker'))
  const result = await runSpawnedAgent({
    targetDir,
    specdevPath,
    role: 'worker',
    profile,
    mission: mission.id,
    assignment: child.id,
    resultPath: join(assignmentPath, 'review', 'brainstorm-revision-result.md'),
    resultKind: 'worker',
    prompt: [
      'Revise only the child Assignment contract in response to the reviewer; do not modify product code.',
      `Contract: ${relativeToRepo(targetDir, join(assignmentPath, 'brainstorm', 'contract.md'))}`,
      `Findings: ${relativeToRepo(targetDir, join(assignmentPath, 'review', 'brainstorm-verdict.md'))}`,
      'Stay within approved Mission authority. If findings require material Mission authority changes, return blocked.',
    ].join('\n'),
  })
  if (result.status !== 'completed' || result.result.frontmatter.status !== 'completed') {
    throw new Error(result.error || `Child ${child.id} contract revision blocked`)
  }
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
        version: 1,
        round: 0,
        status: 'approved',
        evidence_reused: true,
        child: reused.child.id,
        attempt: reused.state.attempt,
        contract_hash: reused.state.contract_hash,
        candidate_digest: reused.state.candidate_digest,
        updated_at: new Date().toISOString(),
      },
      { spaces: 2 }
    )
    stepGuidedNode(targetDir, 'mission-review', {
      approved: true,
      verdict: relativeToRepo(targetDir, reused.verdictPath),
      attempt: reused.state.attempt,
    })
    return true
  }
  const state = await fse.readJson(statePath).catch(() => ({ version: 1, round: 0 }))
  const profile = state.profile
    ? await resolveAgentProfile(specdevPath, 'reviewer', {
        ...state.profile,
        timeout: state.profile.timeout_ms,
      })
    : await resolveAgentProfile(specdevPath, 'reviewer')
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
      'Review Mission convergence from existing evidence first; do not re-review every child from scratch and do not modify tracked files.',
      `Mission contract: ${relativeToRepo(targetDir, join(missionPath, 'brainstorm', 'contract.md'))}`,
      `Ordered queue and child outcomes: ${relativeToRepo(targetDir, join(missionPath, 'design', 'assignments.yaml'))}`,
      state.round > 0 ? `Previous findings: ${relativeToRepo(targetDir, verdictPath)}` : null,
      'Check acceptance coverage, integration seams, unresolved risks, and whether final verification is ready. Reuse receipts; never run the full suite.',
    ]
      .filter(Boolean)
      .join('\n'),
  })
  if (result.status !== 'completed') throw new Error(result.error || 'Mission reviewer failed')
  const verdict = result.result.frontmatter.verdict
  const approved = verdict === 'approved'
  const nextState = {
    version: 1,
    round: state.round + 1,
    status: approved ? 'approved' : verdict === 'blocked' ? 'blocked' : 'needs_changes',
    profile,
    attempt: result.attempt.id,
    updated_at: new Date().toISOString(),
  }
  await fse.writeJson(statePath, nextState, { spaces: 2 })
  if (verdict === 'blocked')
    throw new Error('Mission reviewer is blocked; user direction is required')
  if (approved) {
    stepGuidedNode(targetDir, 'mission-review', {
      approved: true,
      verdict: relativeToRepo(targetDir, verdictPath),
      attempt: result.attempt.id,
    })
  }
  return approved
}

async function reusableSingleChildReview(context) {
  const { targetDir, specdevPath, missionPath, mission } = context
  const queue = await readMissionQueue(missionPath)
  if (queue?.design_mode !== 'single' || queue.assignments?.length !== 1 || mission.pending_replan)
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

async function replanMission(context) {
  const { targetDir, specdevPath, missionPath, mission } = context
  const original = await readMissionQueue(missionPath)
  const trigger = mission.pending_replan || { reason: 'mission_convergence', artifact: null }
  const profile = withoutNetwork(await resolveAgentProfile(specdevPath, 'worker'))
  const resultPath = join(missionPath, 'design', `replan-${Date.now()}-result.md`)
  const result = await runSpawnedAgent({
    targetDir,
    specdevPath,
    role: 'worker',
    profile,
    mission: mission.id,
    resultPath,
    resultKind: 'worker',
    prompt: [
      'Replan only the remaining sequential Mission queue; do not modify product code.',
      `Approved Mission contract: ${relativeToRepo(targetDir, join(missionPath, 'brainstorm', 'contract.md'))}`,
      `Queue to edit in place: ${relativeToRepo(targetDir, join(missionPath, 'design', 'assignments.yaml'))}`,
      `Trigger: ${trigger.reason}`,
      trigger.artifact ? `Trigger artifact: ${trigger.artifact}` : null,
      'Preserve every completed or running entry exactly. Existing pending entries may change title or kind but must retain their IDs. New entries must omit IDs and use status: pending; SpecDev allocates identity.',
      `Every kind must be one of: ${ASSIGNMENT_KINDS.join(', ')}.`,
      'Preserve final_verification exactly. Keep the plan sequential and small. If the needed route changes approved scope, behavior, constraints, or reserved authority, return blocked without changing the queue.',
    ]
      .filter(Boolean)
      .join('\n'),
  })
  if (result.status !== 'completed' || result.result.frontmatter.status !== 'completed') {
    await writeMissionQueue(missionPath, original)
    throw new Error(result.error || 'Mission replanning requires user direction')
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
  await writeMissionQueue(missionPath, revised)
  delete mission.pending_replan
  await writeMission(missionPath, mission)
  await retireTransientArtifact(targetDir, specdevPath, resultPath)
  return { reason: trigger.reason, attempt: result.attempt }
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
  await fse.writeFile(
    join(missionPath, 'outcome.md'),
    `# Mission outcome\n\n## Objective\n\n${mission.objective}\n\n## Base\n\n- Branch: ${mission.base_branch || 'unknown'}\n- Revision: ${mission.base_revision || 'unborn'}\n\n## Assignments\n\n${lines.join('\n')}\n\n## Activity\n\n- Orchestration Attempts: ${activity.orchestration_attempt_count}\n- Provider agent Attempts: ${formatProviderAttemptOutcomes(activity.provider_attempts)}\n- Elapsed: ${formatDuration(activity.elapsed_ms)}\n- Provider-reported tokens: ${activity.provider_reported_tokens ?? 'not reported'}\n\n## Delivery\n\nFinal verification passed. The Mission completion commit on branch \`${mission.branch}\` is the durable final checkpoint.\n`,
    'utf-8'
  )
  mission.activity = activity
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
  for (const item of queue.assignments) {
    assignments.push({
      id: item.id ? String(item.id) : await reserveEntityId(specdevPath, 'assignment'),
      title: String(item.title).trim(),
      kind: item.kind || 'change',
      status: 'pending',
    })
  }
  return {
    version: 1,
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
    if (current.run.id !== mission.run_id)
      throw new Error('Another focused workflow is active; finish or suspend it first')
    return
  }
  const run = listRuns({ workflowRoot }).runs.find((candidate) => candidate.id === mission.run_id)
  if (!run) throw new Error(`Mission RippleGraph run not found: ${mission.run_id}`)
  if (run.status !== 'suspended') throw new Error(`Mission run is not resumable: ${run.status}`)
  resumeRun({ workflowRoot, runId: mission.run_id })
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

async function missionStatus(selector, flags) {
  const context = await missionContext(selector, flags)
  if (!context) return null
  const queue = await readMissionQueue(context.missionPath).catch(() => null)
  const assignments = queue?.assignments || []
  const graph = listRuns({ workflowRoot: workflowRootFor(context.targetDir) }).runs.find(
    (run) => run.id === context.mission.run_id
  )
  const phase = graph?.position?.node || null
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
  const nextAction = missionNextAction(
    context.mission,
    phase,
    Boolean(liveController),
    interruptedController
  )
  const lastChild = [...assignments].reverse().find((item) => item.status === 'completed') || null
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
    last_child: lastChild?.id || null,
    counts: Object.fromEntries(
      ['pending', 'running', 'completed', 'blocked', 'cancelled'].map((status) => [
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
    blocker,
    next_action: nextAction,
    outcome: (await fse.pathExists(join(context.missionPath, 'outcome.md')))
      ? relativeToRepo(context.targetDir, join(context.missionPath, 'outcome.md'))
      : null,
  })
}

async function checkpointMission(selector, flags) {
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
    await execFile('git', ['commit', '-m', `specdev: checkpoint ${context.mission.id}`], {
      cwd: context.targetDir,
    })
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

async function missionContext(selector, flags) {
  if (!selector) return fail(flags, 'Mission ID is required')
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)
  const resolved = await resolveMissionSelector(specdevPath, selector)
  if (!resolved || resolved.ambiguous)
    return fail(flags, `Mission not found or ambiguous: ${selector}`)
  const mission = await readMission(resolved.path)
  return { targetDir, specdevPath, missionPath: resolved.path, mission }
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
        branch,
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
    if (payload.phase) console.log(`Phase: ${payload.phase}`)
    if (payload.branch) console.log(`Branch: ${payload.branch}`)
    if (payload.contract_hash) console.log(`Contract hash: ${payload.contract_hash}`)
    if (payload.review?.verdict) console.log(`Review verdict: ${payload.review.verdict}`)
    if (payload.review?.stale)
      console.log(
        `Review note: the saved verdict covered older contract hash ${payload.review.reviewed_contract_hash}`
      )
    for (const line of workspaceChangeSummaryLines(payload.dirty_paths)) console.log(line)
    if (payload.base_branch) console.log(`Base branch: ${payload.base_branch}`)
    if (payload.final_revision) console.log(`Final revision: ${payload.final_revision}`)
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
