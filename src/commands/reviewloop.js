import { execFile as execFileCallback } from 'node:child_process'
import { join } from 'node:path'
import { promisify } from 'node:util'
import fse from 'fs-extra'
import { getState, recordSideChannelAction } from 'ripplegraph'
import { resolveAgentProfile } from '../utils/agent-profiles.js'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { resolveTargetDir } from '../utils/command-context.js'
import { resolveDiscussionSelector } from '../utils/discussion.js'
import {
  assertApprovedContract,
  assertCurrentAssignmentPath,
  checkpointedContractFor,
  contractPreview,
  currentAssignmentNode,
  hashText,
  relativeToRepo,
  validateContractPath,
  validateAssignmentContract,
  writeAssignmentStatus,
} from '../utils/assignment-vnext.js'
import { stepGuidedNode } from '../utils/engine-sync.js'
import {
  assertReviewWaiverEvidence,
  validateDeliveryArtifacts,
} from '../utils/delivery-artifacts.js'
import { workflowRootFor } from '../utils/engine.js'
import { resolveGuides } from '../utils/guides.js'
import { productStateDigest, runSpawnedAgent } from '../utils/spawned-agent.js'
import { readGuidedCall } from '../utils/callable-sync.js'
import { readMission, resolveMissionSelector } from '../utils/mission.js'
import { retireTransientArtifact } from '../utils/artifact-retention.js'
import {
  buildStandaloneAssignmentCandidateReceipt,
  completeStandaloneAssignmentDelivery,
  formatStandaloneAssignmentReceipt,
  writeStandaloneAssignmentCandidateReceipt,
} from '../utils/assignment-delivery.js'
import {
  AUTOMATIC_ARTIFACT_REPAIR_LIMIT,
  initialAutomaticReviewState,
  recordArtifactRepair,
  recordArbitration,
  recordPrimaryReview,
  recordResolver,
  reviewExecutionMode,
} from '../utils/review-convergence.js'

const execFile = promisify(execFileCallback)

export async function reviewloopCommand(positionalArgs = [], flags = {}) {
  if (flags.autocontinue || flags.reviewer) {
    console.error(
      '--autocontinue and --reviewer were removed. Configure .specdev/agents.yaml or use diagnostic --provider/--model/--effort overrides.'
    )
    process.exitCode = 1
    return
  }
  const phase = positionalArgs[0]
  if (phase === 'brainstorm') return reviewBrainstorm(flags)
  if (phase === 'implementation') return reviewImplementation(flags)
  if (phase === 'discussion') return reviewDiscussion(flags)
  if (phase === 'mission') return reviewMissionBrainstorm(flags)
  console.error('Usage: specdev reviewloop <brainstorm | implementation | discussion | mission>')
  process.exitCode = 1
}

export async function reviewMissionBrainstorm(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  const selector = String(flags.mission || '').trim()
  if (!selector) return fail(flags, 'Mission review requires --mission=M00001')
  const resolved = await resolveMissionSelector(specdevPath, selector)
  if (!resolved || resolved.ambiguous)
    return fail(flags, `Mission not found or ambiguous: ${selector}`)
  const mission = await readMission(resolved.path)
  const graph = getState({ workflowRoot: workflowRootFor(targetDir) })
  if (
    graph.status !== 'ok' ||
    graph.run?.id !== mission.run_id ||
    !['brainstorm', 'approve-mission'].includes(graph.position?.node)
  ) {
    return fail(
      flags,
      'Mission Brainstorm review requires that Mission to be focused before approval'
    )
  }

  const contract = await validateContractPath(join(resolved.path, 'brainstorm', 'contract.md'))
  if (!contract.valid)
    return fail(flags, `Mission contract is not ready: ${contract.errors.join('; ')}`)
  const finalCommands = [...contract.content.matchAll(/^\s*-\s+Command:\s+`[^`]+`\s*$/gim)]
  if (finalCommands.length !== 1) {
    return fail(
      flags,
      'Mission contract requires exactly one Final integrated verification command'
    )
  }

  const reviewDir = join(resolved.path, 'review')
  const baselinePath = join(reviewDir, 'brainstorm-baseline.md')
  const verdictPath = join(reviewDir, 'brainstorm-verdict.md')
  const statePath = join(reviewDir, 'brainstorm-state.json')
  await fse.ensureDir(reviewDir)
  let reviewState = await readJsonIfPresent(statePath)
  if (
    reviewState?.status === 'approved' &&
    reviewState.contract_hash === contract.hash &&
    (await fse.pathExists(verdictPath)) &&
    (await fse.pathExists(baselinePath))
  ) {
    const divergence = await contractDiff(baselinePath, contract.path)
    const checkpointed = graph.context?.previous?.find((entry) => entry.id === 'brainstorm')?.output
    const payload = missionBrainstormPayload({
      targetDir,
      mission,
      contract,
      verdictPath,
      round: reviewState.round,
      materialDivergence: reviewState.material_divergence ?? false,
      divergence,
      status: 'approved',
      requiresCheckpoint: checkpointed?.contract_hash !== contract.hash,
    })
    emit(flags, payload)
    return payload
  }
  if (!reviewState || !(await fse.pathExists(baselinePath))) {
    await fse.copy(contract.path, baselinePath, { overwrite: true })
    reviewState = { version: 1, round: 0, status: 'started' }
  } else if (reviewState.status === 'approved') {
    reviewState = { ...reviewState, round: 0, status: 'started' }
  }

  const profile = await reviewProfile(specdevPath, flags, reviewState.profile)
  const guideIds = guideIdsFromFlags(flags, reviewState.guide_ids)
  const guides = await withCommonReviewGuide(
    specdevPath,
    await resolveGuides(specdevPath, guideIds, { phase: 'mission' })
  )
  const round = reviewState.round + 1
  const result = await runSpawnedAgent({
    targetDir,
    specdevPath,
    role: 'reviewer',
    profile,
    mission: mission.id,
    resultPath: verdictPath,
    resultKind: 'reviewer',
    guides,
    prompt: [
      'Review the Mission contract before approval. Do not modify tracked or untracked repository files.',
      `Contract: ${relativeToRepo(targetDir, contract.path)}`,
      `Frozen baseline: ${relativeToRepo(targetDir, baselinePath)}`,
      round > 1 ? `Previous verdict: ${relativeToRepo(targetDir, verdictPath)}` : null,
      'Check authority boundaries, Mission-level acceptance, decomposition feasibility, and whether the one exact integrated verification command is proportionate.',
      'Classify material_divergence as true only when scope, behavior, constraints, authority, acceptance meaning, or final verification materially changed from the frozen baseline.',
      'Decide verdict and material_divergence independently. Divergence is informational for the user approval gate, not a defect: approve a sound current contract with material_divergence: true when no blocking finding remains, and never request changes solely because it differs from the baseline.',
      'Never run the full suite. A narrow dry check is allowed only when repository instructions permit it.',
    ]
      .filter(Boolean)
      .join('\n'),
  })
  if (result.status !== 'completed') return fail(flags, result.error || 'Mission reviewer failed')

  const verdict = result.result.frontmatter
  const blocked = verdict.verdict === 'blocked'
  reviewState = {
    version: 1,
    round,
    status: verdict.verdict === 'approved' ? 'approved' : blocked ? 'blocked' : 'needs_changes',
    profile,
    guide_ids: guideIds,
    baseline_hash: hashText(await fse.readFile(baselinePath, 'utf-8')),
    contract_hash: contract.hash,
    material_divergence: verdict.material_divergence ?? false,
    attempt: result.attempt.id,
    updated_at: new Date().toISOString(),
  }
  await writeJsonAtomic(statePath, reviewState)
  try {
    recordSideChannelAction({
      workflowRoot: workflowRootFor(targetDir),
      actionId: 'mission-brainstorm-review',
      status: verdict.verdict === 'approved' ? 'completed' : 'failed',
      output: {
        verdict: verdict.verdict,
        attempt: result.attempt.id,
        contract_hash: contract.hash,
      },
    })
  } catch {
    // The durable result remains authoritative for an older pinned graph.
  }

  const divergence = await contractDiff(baselinePath, contract.path)
  const checkpointed = graph.context?.previous?.find((entry) => entry.id === 'brainstorm')?.output
  const payload = missionBrainstormPayload({
    targetDir,
    mission,
    contract,
    verdictPath,
    round,
    materialDivergence: verdict.material_divergence ?? false,
    divergence,
    status: verdict.verdict === 'approved' ? 'approved' : reviewState.status,
    canRerun: verdict.verdict !== 'approved',
    requiresCheckpoint: checkpointed?.contract_hash !== contract.hash,
  })
  emit(flags, payload)
  if (verdict.verdict !== 'approved') process.exitCode = 1
  return payload
}

export async function reviewDiscussion(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  const selector = String(flags.discussion || '').trim()
  if (!selector) return fail(flags, 'Discussion review requires --discussion=D00001')
  const resolved = await resolveDiscussionSelector(specdevPath, selector)
  if (!resolved || resolved.error) return fail(flags, `Discussion not found: ${selector}`)
  const id = resolved.name.match(/^D\d{4,5}/)?.[0]
  const call = readGuidedCall(targetDir, id)
  if (
    !call.synchronized ||
    call.state.status !== 'active' ||
    call.state.position.node !== 'finalize'
  ) {
    return fail(flags, 'Finish the Discussion artifacts and resume the Discussion before review')
  }

  const reviewDir = join(resolved.path, 'review')
  const verdictPath = join(reviewDir, 'verdict.md')
  const statePath = join(reviewDir, 'state.json')
  await fse.ensureDir(reviewDir)
  let reviewState = (await readJsonIfPresent(statePath)) || {
    version: 1,
    round: 0,
    status: 'started',
  }
  const profile = await reviewProfile(specdevPath, flags, reviewState.profile)
  const guideIds = guideIdsFromFlags(flags, reviewState.guide_ids)
  const guides = await withCommonReviewGuide(
    specdevPath,
    await resolveGuides(specdevPath, guideIds, { phase: 'discussion' })
  )
  const round = reviewState.round + 1
  const result = await runSpawnedAgent({
    targetDir,
    specdevPath,
    role: 'reviewer',
    profile,
    discussion: id,
    prompt: [
      'Review this code-read-only Discussion. Do not modify tracked files.',
      `Proposal: ${relativeToRepo(targetDir, join(resolved.path, 'brainstorm', 'proposal.md'))}`,
      `Design: ${relativeToRepo(targetDir, join(resolved.path, 'brainstorm', 'design.md'))}`,
      round > 1 ? `Previous findings: ${relativeToRepo(targetDir, verdictPath)}` : null,
      'Check internal consistency, important missing cases, and assumptions against the current repository. Findings are advisory unless they expose a concrete blocker.',
      'Never run a full suite. A narrow dry check is allowed only when repository instructions permit it.',
    ]
      .filter(Boolean)
      .join('\n'),
    resultPath: verdictPath,
    resultKind: 'reviewer',
    guides,
  })
  if (result.status !== 'completed') return fail(flags, result.error || 'Reviewer failed')
  const verdict = result.result.frontmatter.verdict
  const approved = verdict === 'approved'
  const blocked = verdict === 'blocked'
  reviewState = {
    version: 1,
    round,
    status: approved ? 'approved' : blocked ? 'blocked' : 'needs_changes',
    profile,
    guide_ids: guideIds,
    attempt: result.attempt.id,
    updated_at: new Date().toISOString(),
  }
  await writeJsonAtomic(statePath, reviewState)
  const payload = {
    command: 'reviewloop',
    version: 2,
    status: approved ? 'approved' : reviewState.status,
    phase: 'discussion',
    discussion: id,
    round,
    verdict: relativeToRepo(targetDir, verdictPath),
    next_action: approved
      ? `Complete when satisfied: specdev discussion ${id} --complete.`
      : !approved
        ? `Address findings, then rerun specdev reviewloop discussion --discussion=${id}.`
        : 'Discussion review complete.',
  }
  emit(flags, payload)
  if (!approved) process.exitCode = 1
  return payload
}

export async function reviewBrainstorm(flags = {}) {
  const context = await assignmentContext(flags)
  const { targetDir, specdevPath, assignmentPath, name, mission } = context
  const graph = await currentAssignmentNode(targetDir)
  if (!graph || !['brainstorm', 'approve-contract'].includes(graph.position.node)) {
    return fail(flags, 'Brainstorm review is only available before contract approval')
  }
  const contract = await validateAssignmentContract(assignmentPath)
  if (!contract.valid) return fail(flags, `Contract is not ready: ${contract.errors.join('; ')}`)

  const reviewDir = join(assignmentPath, 'review')
  const baselinePath = join(reviewDir, 'brainstorm-baseline.md')
  const verdictPath = join(reviewDir, 'brainstorm-verdict.md')
  const statePath = join(reviewDir, 'brainstorm-state.json')
  await fse.ensureDir(reviewDir)
  let reviewState = await readJsonIfPresent(statePath)
  if (
    reviewState?.status === 'approved' &&
    reviewState.contract_hash === contract.hash &&
    (await fse.pathExists(verdictPath)) &&
    (await fse.pathExists(baselinePath))
  ) {
    const divergence = await contractDiff(baselinePath, contract.path)
    const checkpointed = await checkpointedContractFor(targetDir)
    const payload = assignmentBrainstormPayload({
      targetDir,
      name,
      contract,
      verdictPath,
      round: reviewState.round,
      materialDivergence: reviewState.material_divergence ?? false,
      divergence,
      status: 'approved',
      requiresCheckpoint: checkpointed?.contract_hash !== contract.hash,
    })
    emit(flags, payload)
    return payload
  }
  if (!reviewState || !(await fse.pathExists(baselinePath))) {
    await fse.copy(contract.path, baselinePath, { overwrite: true })
    reviewState = { version: 1, round: 0, status: 'started' }
  } else if (reviewState.status === 'approved') {
    reviewState = { ...reviewState, round: 0, status: 'started' }
  }

  const profile = await reviewProfile(specdevPath, flags, reviewState.profile)
  const guideIds = guideIdsFromFlags(flags, reviewState.guide_ids)
  const guides = await withCommonReviewGuide(
    specdevPath,
    await resolveGuides(specdevPath, guideIds, { phase: 'brainstorm' })
  )
  const missionAuthority = await childMissionReviewLines(targetDir, specdevPath, assignmentPath)
  const mode = reviewExecutionMode({
    phase: 'brainstorm',
    missionChild: missionAuthority.length > 0,
  })
  if (mode === 'automatic') {
    return reviewAutomaticBrainstorm({
      ...context,
      flags,
      contract,
      baselinePath,
      verdictPath,
      statePath,
      reviewState,
      profile,
      guideIds,
      guides,
      missionAuthority,
    })
  }

  const round = reviewState.round + 1
  const prompt = [
    'Review the Assignment contract. Do not modify tracked files.',
    `Contract: ${relativeToRepo(targetDir, contract.path)}`,
    `Frozen baseline: ${relativeToRepo(targetDir, baselinePath)}`,
    ...missionAuthority,
    round > 1 ? `Previous verdict: ${relativeToRepo(targetDir, verdictPath)}` : null,
    'Identify blocking or materially useful findings only.',
    missionAuthority.length > 0
      ? 'This is a Mission child: verify that its authority and acceptance criteria remain wholly inside the approved Mission contract and its queue entry.'
      : null,
    'Classify material_divergence by comparing the current contract with the frozen baseline: true only when scope, behavior, constraints, authority, or acceptance meaning materially changed; clarifications are false.',
    'Decide verdict and material_divergence independently. Divergence is informational for the user approval gate, not a defect: approve a sound current contract with material_divergence: true when no blocking finding remains, and never request changes solely because it differs from the baseline.',
    'A reviewer may run a narrow dry check only when repository instructions and the contract allow it. Never run the full suite here.',
  ]
    .filter(Boolean)
    .join('\n')

  const result = await runSpawnedAgent({
    targetDir,
    specdevPath,
    role: 'reviewer',
    profile,
    prompt,
    resultPath: verdictPath,
    resultKind: 'reviewer',
    assignment: name,
    mission,
    guides,
  })
  if (result.status !== 'completed') return fail(flags, result.error || 'Reviewer failed')

  const verdict = result.result.frontmatter
  const blocked = verdict.verdict === 'blocked'
  reviewState = {
    version: 1,
    round,
    status: verdict.verdict === 'approved' ? 'approved' : blocked ? 'blocked' : 'needs_changes',
    profile,
    guide_ids: guideIds,
    baseline_hash: hashFromContract(await fse.readFile(baselinePath, 'utf-8')),
    contract_hash: contract.hash,
    material_divergence: verdict.material_divergence ?? false,
    attempt: result.attempt.id,
    updated_at: new Date().toISOString(),
  }
  await writeJsonAtomic(statePath, reviewState)
  try {
    recordSideChannelAction({
      workflowRoot: workflowRootFor(targetDir),
      actionId: 'brainstorm-review',
      status: verdict.verdict === 'approved' ? 'completed' : 'failed',
      output: {
        verdict: verdict.verdict,
        attempt: result.attempt.id,
        contract_hash: contract.hash,
      },
    })
  } catch {
    // The durable review artifact still owns the reviewer result if an older pinned graph lacks the action.
  }

  const divergence = await contractDiff(baselinePath, contract.path)
  const checkpointed = await checkpointedContractFor(targetDir)
  const payload = assignmentBrainstormPayload({
    targetDir,
    name,
    contract,
    verdictPath,
    round,
    materialDivergence: verdict.material_divergence ?? false,
    divergence,
    status: verdict.verdict === 'approved' ? 'approved' : reviewState.status,
    canRerun: verdict.verdict !== 'approved',
    requiresCheckpoint: checkpointed?.contract_hash !== contract.hash,
  })
  emit(flags, payload)
  if (verdict.verdict !== 'approved') process.exitCode = 1
  return payload
}

async function reviewAutomaticBrainstorm(options) {
  const {
    targetDir,
    specdevPath,
    assignmentPath,
    name,
    mission,
    flags,
    baselinePath,
    verdictPath,
    statePath,
    profile,
    guideIds,
    guides,
    missionAuthority,
  } = options
  let state = {
    ...initialAutomaticReviewState(options.reviewState),
    profile,
    guide_ids: guideIds,
    baseline_hash: hashFromContract(await fse.readFile(baselinePath, 'utf-8')),
  }

  for (let transition = 0; transition < 8; transition += 1) {
    let contract = await validateAssignmentContract(assignmentPath)
    if (!contract.valid)
      return fail(
        flags,
        `Contract repair produced an invalid contract: ${contract.errors.join('; ')}`
      )

    if (state.stage === 'failed') {
      return emitAutomaticBrainstormResult({
        targetDir,
        name,
        contract,
        verdictPath,
        baselinePath,
        state,
        flags,
        status: 'blocked',
      })
    }
    if (state.stage === 'resolver') {
      const resolved = await runContractResolutionWorker({
        targetDir,
        specdevPath,
        assignmentPath,
        name,
        mission,
        flags,
        verdictPath,
        missionAuthority,
        resolver: true,
      })
      if (!resolved) return null
      state = {
        ...recordResolver(state, {
          attempt: resolved.attempt.id,
          status: resolved.result.frontmatter.status,
        }),
        contract_hash: contract.hash,
      }
      await writeJsonAtomic(statePath, state)
      continue
    }

    const arbitration = state.stage === 'arbiter'
    const round = state.round + 1
    const result = await runSpawnedAgent({
      targetDir,
      specdevPath,
      role: 'reviewer',
      profile,
      prompt: [
        arbitration
          ? 'Arbitrate the automatic Mission-child contract review. Do not modify files.'
          : 'Review the automatic Mission-child Assignment contract. Do not modify files.',
        `Contract: ${relativeToRepo(targetDir, contract.path)}`,
        `Frozen baseline: ${relativeToRepo(targetDir, baselinePath)}`,
        ...missionAuthority,
        `Previous findings: ${relativeToRepo(targetDir, verdictPath)}`,
        arbitration
          ? 'Return approved only when no blocking finding remains; use needs_changes only for a nonblocking reviewer disagreement, and blocked for an objective authority, validity, or feasibility failure.'
          : 'Identify blocking or materially useful findings only. Verify that authority and acceptance remain wholly inside the approved Mission contract and queue entry.',
        'Never run a full suite.',
      ].join('\n'),
      resultPath: verdictPath,
      resultKind: 'reviewer',
      assignment: name,
      mission,
      guides,
    })
    if (result.status !== 'completed') return fail(flags, result.error || 'Reviewer failed')
    const findings = await fse.readFile(verdictPath, 'utf-8')
    const verdict = result.result.frontmatter

    if (arbitration) {
      const arbitrationResult = recordArbitration(state, {
        verdict: verdict.verdict,
        attempt: result.attempt.id,
        candidateDigest: contract.hash,
        findings,
      })
      state = {
        ...arbitrationResult.state,
        contract_hash: contract.hash,
        material_divergence: verdict.material_divergence ?? false,
      }
      if (arbitrationResult.disposition === 'nonblocking-disagreement') {
        state = {
          ...state,
          stage: 'failed',
          status: 'failed',
          disposition: 'objective-failure',
          override_rejected:
            'Pre-implementation contract review has no completed delivery evidence for the strict host override gate.',
        }
      }
      await writeJsonAtomic(statePath, state)
      return emitAutomaticBrainstormResult({
        targetDir,
        name,
        contract,
        verdictPath,
        baselinePath,
        state,
        flags,
        status: state.status === 'approved' ? 'approved' : 'blocked',
      })
    }

    const primary = recordPrimaryReview(state, {
      verdict: verdict.verdict,
      candidateDigest: contract.hash,
      findings,
      attempt: result.attempt.id,
    })
    state = {
      ...primary.state,
      contract_hash: contract.hash,
      material_divergence: verdict.material_divergence ?? false,
    }
    await writeJsonAtomic(statePath, state)
    if (primary.disposition === 'approved') {
      return emitAutomaticBrainstormResult({
        targetDir,
        name,
        contract,
        verdictPath,
        baselinePath,
        state,
        flags,
        status: 'approved',
      })
    }
    if (primary.disposition === 'resolver') continue

    const repaired = await runContractResolutionWorker({
      targetDir,
      specdevPath,
      assignmentPath,
      name,
      mission,
      flags,
      verdictPath,
      missionAuthority,
      resolver: false,
    })
    if (!repaired) return null
    state = {
      ...state,
      repair_attempt: repaired.attempt.id,
      repair_status: repaired.result.frontmatter.status,
      updated_at: new Date().toISOString(),
    }
    if (repaired.result.frontmatter.status !== 'completed') state.stage = 'resolver'
    await writeJsonAtomic(statePath, state)
  }
  return fail(flags, 'Automatic Mission-child review exceeded its finite transition contract')
}

async function runContractResolutionWorker({
  targetDir,
  specdevPath,
  assignmentPath,
  name,
  mission,
  flags,
  verdictPath,
  missionAuthority,
  resolver,
}) {
  const profile = await resolveAgentProfile(specdevPath, 'worker', profileOverrides(flags))
  const resultPath = join(
    assignmentPath,
    'review',
    resolver ? 'brainstorm-resolver-result.md' : 'brainstorm-repair-result.md'
  )
  const result = await runSpawnedAgent({
    targetDir,
    specdevPath,
    role: 'worker',
    profile,
    assignment: name,
    mission,
    resultPath,
    resultKind: 'worker',
    prompt: [
      resolver
        ? 'Resolve the remaining automatic Mission-child contract findings in one final bounded Attempt.'
        : 'Repair the Mission-child Assignment contract for the next primary review.',
      `Contract to edit: ${relativeToRepo(targetDir, join(assignmentPath, 'brainstorm', 'contract.md'))}`,
      `Review findings: ${relativeToRepo(targetDir, verdictPath)}`,
      ...missionAuthority,
      'Edit only the child contract. Preserve approved Mission scope, reserved authority, and verification authority.',
      'If the findings require any top-level authority change, return blocked without making that change.',
    ].join('\n'),
  })
  if (result.status !== 'completed') {
    fail(flags, result.error || 'Contract convergence worker failed')
    return null
  }
  return result
}

async function emitAutomaticBrainstormResult({
  targetDir,
  name,
  contract,
  verdictPath,
  baselinePath,
  state,
  flags,
  status,
}) {
  const divergence = await contractDiff(baselinePath, contract.path)
  const checkpointed = await checkpointedContractFor(targetDir)
  const payload = assignmentBrainstormPayload({
    targetDir,
    name,
    contract,
    verdictPath,
    round: state.round,
    materialDivergence: state.material_divergence ?? false,
    divergence,
    status,
    canRerun: false,
    requiresCheckpoint: checkpointed?.contract_hash !== contract.hash,
  })
  payload.mode = 'automatic'
  payload.disposition =
    state.disposition || (status === 'approved' ? 'approved' : 'objective-failure')
  if (status !== 'approved') {
    payload.next_action =
      'Automatic Mission-child review reached an objective terminal failure inside the approved authority.'
    process.exitCode = 1
  }
  emit(flags, payload)
  return payload
}

export async function reviewImplementation(flags = {}) {
  const context = await assignmentContext(flags)
  const { targetDir, specdevPath, assignmentPath, name, mission } = context
  const { contract } = await assertApprovedContract(targetDir, assignmentPath)
  let graph = await currentAssignmentNode(targetDir)
  if (!graph || !['implementation-review', 'repair'].includes(graph.position.node)) {
    return fail(
      flags,
      `Implementation review is not available at ${graph?.position?.node || 'the current workflow'}`
    )
  }
  const reviewDir = join(assignmentPath, 'review')
  const verdictPath = join(reviewDir, 'implementation-verdict.md')
  const statePath = join(reviewDir, 'implementation-state.json')
  await fse.ensureDir(reviewDir)
  let reviewState = initialAutomaticReviewState((await readJsonIfPresent(statePath)) || {})

  if (graph.position.node === 'repair') {
    const implementationGuideIds = await selectedImplementationGuides(assignmentPath)
    const implementationGuides = await resolveGuides(specdevPath, implementationGuideIds, {
      phase: 'implementation',
    })
    const repaired = await runRepairWorker({
      ...context,
      flags,
      verdictPath,
      guides: implementationGuides,
    })
    if (!repaired) return null
    stepGuidedNode(targetDir, 'repair', {
      attempt: repaired.attempt.id,
      result: relativeToRepo(targetDir, repaired.resultPath),
    })
    graph = await currentAssignmentNode(targetDir)
    reviewState = {
      ...reviewState,
      stage: 'primary',
      repair_attempt: repaired.attempt.id,
      updated_at: new Date().toISOString(),
    }
    await writeJsonAtomic(statePath, reviewState)
  }

  let delivery
  try {
    delivery = await validateDeliveryArtifacts(specdevPath, assignmentPath, contract.acceptanceIds)
  } catch (error) {
    if (mission) throw error
    return requestArtifactRepair({
      ...context,
      flags,
      graph,
      verdictPath,
      statePath,
      reviewState,
      issue: `delivery_artifact_invalid: ${error.message}`,
    })
  }

  let candidateReceipt = null
  let candidateReceiptPath = null
  if (!mission) {
    const assignmentStatus = await fse.readJson(join(assignmentPath, 'status.json'))
    candidateReceipt = await buildStandaloneAssignmentCandidateReceipt({
      targetDir,
      assignmentPath,
      assignmentStatus,
    })
    candidateReceiptPath = await writeStandaloneAssignmentCandidateReceipt(
      assignmentPath,
      candidateReceipt
    )
    if (candidateReceipt.completeness !== 'complete') {
      return requestArtifactRepair({
        ...context,
        flags,
        graph,
        verdictPath,
        statePath,
        reviewState,
        issue: `candidate_receipt_incomplete: ${candidateReceipt.issues.join(', ')}`,
      })
    }
  }

  const profile = await reviewProfile(specdevPath, flags, reviewState.profile)
  const guideIds = guideIdsFromFlags(
    flags,
    reviewState.guide_ids || (await selectedReviewGuides(assignmentPath))
  )
  const guides = await withCommonReviewGuide(
    specdevPath,
    await resolveGuides(specdevPath, guideIds, { phase: 'implementation' })
  )
  reviewState = {
    ...reviewState,
    profile,
    guide_ids: guideIds,
    contract_hash: contract.hash,
    ...(candidateReceipt ? { candidate_receipt_identity: candidateReceipt.identity } : {}),
  }
  await writeJsonAtomic(statePath, reviewState)

  if (reviewState.stage === 'resolver') {
    const resolved = await runImplementationResolver({
      ...context,
      flags,
      verdictPath,
      guides: delivery.implementationGuides,
    })
    if (!resolved) return null
    if (resolved.result.frontmatter.status === 'completed') {
      delivery = await validateDeliveryArtifacts(
        specdevPath,
        assignmentPath,
        contract.acceptanceIds
      )
    }
    reviewState = recordResolver(reviewState, {
      attempt: resolved.attempt.id,
      status: resolved.result.frontmatter.status,
    })
    await writeJsonAtomic(statePath, reviewState)
    return reviewImplementation(flags)
  }

  const arbitration = reviewState.stage === 'arbiter'
  const round = reviewState.round + 1
  const prompt = [
    arbitration
      ? 'Arbitrate the automatic Assignment review in one final Attempt. Do not modify tracked files.'
      : 'Review the frozen Assignment candidate. Do not modify tracked files.',
    `Approved contract: ${relativeToRepo(targetDir, join(assignmentPath, 'brainstorm', 'contract.md'))}`,
    `Design plan: ${relativeToRepo(targetDir, join(assignmentPath, 'design', 'plan.md'))}`,
    `Progress and verification receipts: ${relativeToRepo(targetDir, join(assignmentPath, 'implementation', 'progress.json'))}`,
    `Outcome: ${relativeToRepo(targetDir, join(assignmentPath, 'outcome.md'))}`,
    candidateReceiptPath
      ? `Complete candidate receipt: ${relativeToRepo(targetDir, candidateReceiptPath)} @ ${candidateReceipt.identity}`
      : null,
    reviewState.round > 0 ? `Previous findings: ${relativeToRepo(targetDir, verdictPath)}` : null,
    'Inspect the current Git diff or revision. Reuse existing receipts and never run a full suite without explicit authority.',
    'Report scope_divergence, procedure_divergence, evidence_integrity, and user_reapproval_required explicitly. Scope materiality, changed/incomplete evidence, or required user reapproval cannot authorize delivery; disclosed procedure divergence may be approved when evidence remains complete.',
    'If the candidate adds or upgrades an external dependency, require execution-time package-manager/registry version evidence and inspect available lockfile/audit evidence. An unresolved direct high/critical advisory is blocking unless the approved contract explicitly accepts it. A lockfile-only update does not prove installation or entry-point startup; do not credit evidence the receipts do not contain.',
    arbitration
      ? 'Return approved when the candidate satisfies the contract, needs_changes only for a nonblocking disagreement that may advance solely if the host validates the strict delivery-evidence gate, and blocked for objective acceptance, verification, authority, or safety failure.'
      : 'Approve only when every acceptance criterion has a final result and no blocking contract defect remains.',
  ]
    .filter(Boolean)
    .join('\n')
  const result = await runSpawnedAgent({
    targetDir,
    specdevPath,
    role: 'reviewer',
    profile,
    prompt,
    resultPath: verdictPath,
    resultKind: 'reviewer',
    assignment: name,
    mission,
    guides,
  })
  if (result.status !== 'completed') return fail(flags, result.error || 'Reviewer failed')
  const reviewerResult = result.result.frontmatter
  const unsafeTransition =
    reviewerResult.scope_divergence === 'material' ||
    reviewerResult.evidence_integrity !== 'complete' ||
    reviewerResult.user_reapproval_required === true
  const verdict =
    unsafeTransition && reviewerResult.verdict === 'approved' ? 'blocked' : reviewerResult.verdict
  const findings = await fse.readFile(verdictPath, 'utf-8')
  const candidateDigest = await productStateDigest(targetDir)

  if (arbitration) {
    const arbitrationResult = recordArbitration(reviewState, {
      verdict,
      attempt: result.attempt.id,
      candidateDigest,
      findings,
    })
    reviewState = {
      ...arbitrationResult.state,
      profile,
      guide_ids: guideIds,
      ...reviewTaxonomy(reviewerResult),
    }
    let approved = arbitrationResult.disposition === 'approved'
    if (arbitrationResult.disposition === 'nonblocking-disagreement') {
      try {
        delivery = await validateDeliveryArtifacts(
          specdevPath,
          assignmentPath,
          contract.acceptanceIds
        )
        assertReviewWaiverEvidence(delivery, contract.acceptanceIds)
        approved = true
        reviewState = {
          ...reviewState,
          status: 'approved',
          disposition: 'nonblocking-override',
          evidence_override: true,
        }
      } catch (error) {
        reviewState = {
          ...reviewState,
          stage: 'failed',
          status: 'failed',
          disposition: 'objective-failure',
          override_rejected: error.message,
        }
      }
    }
    await writeJsonAtomic(statePath, reviewState)
    if (approved) {
      return completeImplementationReview({
        ...context,
        flags,
        contract,
        verdictPath,
        attempt: result.attempt.id,
        round,
        disposition: reviewState.disposition,
      })
    }
    stepGuidedNode(targetDir, 'implementation-review', {
      approved: false,
      verdict: relativeToRepo(targetDir, verdictPath),
      attempt: result.attempt.id,
      disposition: 'objective-failure',
    })
    await writeAssignmentStatus(assignmentPath, {
      status: 'failed',
      failed_at: new Date().toISOString(),
      blocker: reviewState.override_rejected || 'Automatic review found an objective failure.',
    })
    const payload = {
      command: 'reviewloop',
      version: 2,
      status: 'failed',
      phase: 'implementation',
      assignment: name,
      round,
      verdict: relativeToRepo(targetDir, verdictPath),
      disposition: 'objective-failure',
      next_action: 'Assignment terminated with objective review failure.',
    }
    emit(flags, payload)
    process.exitCode = 1
    return payload
  }

  const primary = recordPrimaryReview(reviewState, {
    verdict,
    attempt: result.attempt.id,
    candidateDigest,
    findings,
  })
  reviewState = {
    ...primary.state,
    profile,
    guide_ids: guideIds,
    ...reviewTaxonomy(reviewerResult),
  }
  await writeJsonAtomic(statePath, reviewState)
  if (primary.disposition === 'approved') {
    return completeImplementationReview({
      ...context,
      flags,
      contract,
      verdictPath,
      attempt: result.attempt.id,
      round,
      disposition: 'approved',
    })
  }
  if (primary.disposition === 'resolver') return reviewImplementation(flags)

  stepGuidedNode(targetDir, 'implementation-review', {
    approved: false,
    verdict: relativeToRepo(targetDir, verdictPath),
    attempt: result.attempt.id,
    disposition: 'repair',
  })
  return reviewImplementation(flags)
}

async function completeImplementationReview({
  targetDir,
  specdevPath,
  assignmentPath,
  name,
  mission,
  flags,
  contract,
  verdictPath,
  attempt,
  round,
  disposition,
}) {
  if (!mission) {
    const state = await readJsonIfPresent(
      join(assignmentPath, 'review', 'implementation-state.json')
    )
    const assignmentStatus = await fse.readJson(join(assignmentPath, 'status.json'))
    await validateDeliveryArtifacts(specdevPath, assignmentPath, contract.acceptanceIds)
    const currentCandidate = await buildStandaloneAssignmentCandidateReceipt({
      targetDir,
      assignmentPath,
      assignmentStatus,
    })
    if (
      currentCandidate.completeness !== 'complete' ||
      !state?.candidate_receipt_identity ||
      currentCandidate.identity !== state.candidate_receipt_identity
    ) {
      return requestArtifactRepair({
        targetDir,
        specdevPath,
        assignmentPath,
        name,
        mission,
        flags,
        verdictPath,
        statePath: join(assignmentPath, 'review', 'implementation-state.json'),
        reviewState: state || {},
        issue: 'candidate_receipt_changed_after_review',
      })
    }
  }
  stepGuidedNode(targetDir, 'implementation-review', {
    approved: true,
    verdict: relativeToRepo(targetDir, verdictPath),
    attempt,
    disposition,
  })
  await writeAssignmentStatus(assignmentPath, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  })
  await retireTransientArtifact(
    targetDir,
    specdevPath,
    join(assignmentPath, 'implementation', 'worker-result.md')
  )
  await retireTransientArtifact(
    targetDir,
    specdevPath,
    join(assignmentPath, 'implementation', 'repair-result.md')
  )
  const payload = {
    command: 'reviewloop',
    version: 2,
    status: 'approved',
    phase: 'implementation',
    assignment: name,
    round,
    verdict: relativeToRepo(targetDir, verdictPath),
    disposition,
    next_action: 'Assignment complete.',
  }
  if (!mission) {
    const completion = await completeStandaloneAssignmentDelivery({
      targetDir,
      specdevPath,
      assignmentPath,
    })
    Object.assign(payload, completion)
  }
  emit(flags, payload)
  return payload
}

async function runImplementationResolver({
  targetDir,
  specdevPath,
  assignmentPath,
  name,
  mission,
  flags,
  verdictPath,
  guides,
}) {
  const profile = await resolveAgentProfile(specdevPath, 'worker', profileOverrides(flags))
  const resultPath = join(assignmentPath, 'implementation', 'resolver-result.md')
  const result = await runSpawnedAgent({
    targetDir,
    specdevPath,
    role: 'worker',
    profile,
    prompt: [
      'Resolve the remaining automatic implementation-review findings in one final bounded Attempt.',
      `Approved contract: ${relativeToRepo(targetDir, join(assignmentPath, 'brainstorm', 'contract.md'))}`,
      `Plan: ${relativeToRepo(targetDir, join(assignmentPath, 'design', 'plan.md'))}`,
      `Findings: ${relativeToRepo(targetDir, verdictPath)}`,
      'Stay inside approved scope and authority. Reuse receipts; run only explicitly authorized focused verification.',
      'Update progress.json and outcome.md honestly. If a finding requires expanded authority or cannot be satisfied, return blocked.',
    ].join('\n'),
    resultPath,
    resultKind: 'worker',
    assignment: name,
    mission,
    guides,
  })
  if (result.status !== 'completed') {
    fail(flags, result.error || 'Implementation resolver failed')
    return null
  }
  return result
}

async function runRepairWorker({
  targetDir,
  specdevPath,
  assignmentPath,
  name,
  mission,
  flags,
  verdictPath,
  guides,
}) {
  const profile = await resolveAgentProfile(specdevPath, 'worker', profileOverrides(flags))
  const resultPath = join(assignmentPath, 'implementation', 'repair-result.md')
  const result = await runSpawnedAgent({
    targetDir,
    specdevPath,
    role: 'worker',
    profile,
    prompt: [
      'Continue the existing Assignment from the current repository state.',
      `Approved contract: ${relativeToRepo(targetDir, join(assignmentPath, 'brainstorm', 'contract.md'))}`,
      `Plan: ${relativeToRepo(targetDir, join(assignmentPath, 'design', 'plan.md'))}`,
      `Blocking review findings: ${relativeToRepo(targetDir, verdictPath)}`,
      'Fix only the blocking findings, run only authorized focused verification, update implementation/progress.json (including deviations and follow_up) and outcome.md, and do not rerun completed work blindly.',
    ].join('\n'),
    resultPath,
    resultKind: 'worker',
    assignment: name,
    mission,
    guides,
  })
  if (result.status !== 'completed' || result.result.frontmatter.status !== 'completed') {
    fail(flags, result.error || 'Repair worker failed')
    return null
  }
  return result
}

async function assignmentContext(flags) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  const assignmentPath = await resolveAssignmentPath(flags)
  await assertCurrentAssignmentPath(targetDir, assignmentPath)
  const status = await fse.readJson(join(assignmentPath, 'status.json')).catch(() => null)
  return {
    targetDir,
    specdevPath,
    assignmentPath,
    name: assignmentName(assignmentPath),
    mission: status?.mission || undefined,
  }
}

async function reviewProfile(specdevPath, flags, saved) {
  return resolveAgentProfile(
    specdevPath,
    'reviewer',
    saved ? { ...saved, timeout: saved.timeout_ms } : profileOverrides(flags)
  )
}

function profileOverrides(flags) {
  return {
    provider: typeof flags.provider === 'string' ? flags.provider : undefined,
    model: typeof flags.model === 'string' ? flags.model : undefined,
    effort: typeof flags.effort === 'string' ? flags.effort : undefined,
    timeout: typeof flags.timeout === 'string' ? flags.timeout : undefined,
  }
}

function guideIdsFromFlags(flags, fallback = []) {
  if (typeof flags.guides !== 'string') return fallback || []
  return flags.guides
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

async function selectedReviewGuides(assignmentPath) {
  const path = join(assignmentPath, 'implementation', 'progress.json')
  if (!(await fse.pathExists(path))) return []
  const progress = await fse.readJson(path)
  return Array.isArray(progress.selected_guides?.review)
    ? progress.selected_guides.review
        .map(String)
        .map((value) => value.trim())
        .filter(Boolean)
    : []
}

async function selectedImplementationGuides(assignmentPath) {
  const path = join(assignmentPath, 'implementation', 'progress.json')
  const progress = await fse.readJson(path).catch(() => null)
  return Array.isArray(progress?.selected_guides?.implementation)
    ? progress.selected_guides.implementation
        .map(String)
        .map((value) => value.trim())
        .filter(Boolean)
    : []
}

function reviewTaxonomy(result) {
  return {
    material_divergence: result.material_divergence,
    scope_divergence: result.scope_divergence,
    procedure_divergence: result.procedure_divergence,
    evidence_integrity: result.evidence_integrity,
    user_reapproval_required: result.user_reapproval_required,
    taxonomy_source: result.taxonomy_source || 'structured',
  }
}

async function requestArtifactRepair({
  targetDir,
  assignmentPath,
  name,
  flags,
  verdictPath,
  statePath,
  reviewState,
  issue,
}) {
  const boundedIssue = String(issue || 'candidate_receipt_incomplete').slice(0, 500)
  const repair = recordArtifactRepair(reviewState, { issue: boundedIssue })
  await fse.ensureDir(join(assignmentPath, 'review'))
  await fse.writeFile(
    verdictPath,
    `---\nverdict: blocked\nmaterial_divergence: false\nscope_divergence: none\nprocedure_divergence: disclosed\nevidence_integrity: incomplete\nuser_reapproval_required: false\n---\n\n## Findings\n\nArtifact preflight blocked review before any delivery commit: ${boundedIssue}\n`,
    'utf-8'
  )
  await writeJsonAtomic(statePath, repair.state)
  if (repair.disposition === 'exhausted') {
    return fail(
      flags,
      `Assignment ${name} awaits manual artifact repair after ${AUTOMATIC_ARTIFACT_REPAIR_LIMIT} automatic repair Attempt: ${boundedIssue}. Repair the preserved delivery artifacts, then rerun specdev implement; no replacement worker was launched.`
    )
  }
  stepGuidedNode(targetDir, 'implementation-review', {
    approved: false,
    verdict: relativeToRepo(targetDir, verdictPath),
    attempt: 'artifact-preflight',
    disposition: 'repair',
  })
  const next = await currentAssignmentNode(targetDir)
  if (next?.position?.node !== 'repair') {
    return fail(flags, `Assignment ${name} awaits artifact repair: ${boundedIssue}`)
  }
  return reviewImplementation(flags)
}

async function childMissionReviewLines(targetDir, specdevPath, assignmentPath) {
  const status = await fse.readJson(join(assignmentPath, 'status.json')).catch(() => null)
  if (!status?.mission) return []
  const resolved = await resolveMissionSelector(specdevPath, String(status.mission))
  if (!resolved || resolved.ambiguous) {
    throw new Error(`Mission child references an unresolved Mission: ${status.mission}`)
  }
  return [
    `Approved Mission contract: ${relativeToRepo(targetDir, join(resolved.path, 'brainstorm', 'contract.md'))}`,
    `Mission queue: ${relativeToRepo(targetDir, join(resolved.path, 'design', 'assignments.yaml'))}`,
  ]
}

function missionBrainstormPayload({
  targetDir,
  mission,
  contract,
  verdictPath,
  round,
  materialDivergence,
  divergence,
  status,
  canRerun = false,
  requiresCheckpoint = false,
}) {
  return {
    command: 'reviewloop',
    version: 2,
    status,
    phase: 'mission',
    mission: mission.id,
    round,
    verdict: relativeToRepo(targetDir, verdictPath),
    contract: relativeToRepo(targetDir, contract.path),
    material_divergence: materialDivergence,
    divergence_classification: !divergence
      ? 'none'
      : materialDivergence
        ? 'material'
        : 'clarifying',
    contract_hash: contract.hash,
    contract_preview: contractPreview(contract.content),
    textual_changes: divergence,
    next_action:
      status === 'approved'
        ? requiresCheckpoint
          ? `Run specdev mission run ${mission.id} to checkpoint this final hash, then show the contract preview, verdict, and hash before waiting for explicit user agreement.`
          : `Show the contract preview, verdict, and exact hash to the user. Only after explicit agreement run specdev mission run ${mission.id} --approve.`
        : canRerun
          ? `Address findings, then rerun specdev reviewloop mission --mission=${mission.id}.`
          : 'User direction is required.',
  }
}

function assignmentBrainstormPayload({
  targetDir,
  name,
  contract,
  verdictPath,
  round,
  materialDivergence,
  divergence,
  status,
  canRerun = false,
  requiresCheckpoint = false,
}) {
  return {
    command: 'reviewloop',
    version: 2,
    status,
    phase: 'brainstorm',
    assignment: name,
    round,
    verdict: relativeToRepo(targetDir, verdictPath),
    contract: relativeToRepo(targetDir, contract.path),
    material_divergence: materialDivergence,
    divergence_classification: !divergence
      ? 'none'
      : materialDivergence
        ? 'material'
        : 'clarifying',
    contract_hash: contract.hash,
    contract_preview: contractPreview(contract.content),
    textual_changes: divergence,
    next_action:
      status === 'approved'
        ? requiresCheckpoint
          ? 'Run specdev checkpoint brainstorm to present this final hash, then show the contract preview, verdict, and hash before waiting for explicit user agreement.'
          : 'Show the contract preview, verdict, and exact hash to the user, then run specdev approve brainstorm only after explicit agreement.'
        : canRerun
          ? 'Address the findings in the contract, then rerun specdev reviewloop brainstorm.'
          : 'User direction is required.',
  }
}

async function withCommonReviewGuide(specdevPath, guides) {
  return [
    { id: 'specdev-review', version: '1', path: join(specdevPath, 'guides', 'review.md') },
    ...guides,
  ]
}

async function contractDiff(baselinePath, contractPath) {
  try {
    const { stdout } = await execFile(
      'git',
      ['diff', '--no-index', '--unified=2', '--', baselinePath, contractPath],
      { maxBuffer: 512 * 1024 }
    )
    return stdout.trim()
  } catch (error) {
    if (error.code === 1) return String(error.stdout || '').trim()
    return ''
  }
}

async function readJsonIfPresent(path) {
  if (!(await fse.pathExists(path))) return null
  return fse.readJson(path)
}

async function writeJsonAtomic(path, value) {
  const temporary = `${path}.tmp-${process.pid}`
  await fse.writeJson(temporary, value, { spaces: 2 })
  await fse.move(temporary, path, { overwrite: true })
}

function hashFromContract(content) {
  return hashText(content)
}

function emit(flags, payload) {
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else {
    console.log(`${payload.phase} review: ${payload.status}`)
    console.log(`Verdict: ${payload.verdict}`)
    if (payload.contract) console.log(`Contract: ${payload.contract}`)
    if (payload.contract_hash) console.log(`Contract hash: ${payload.contract_hash}`)
    if (payload.contract_preview?.length > 0) {
      console.log('Contract preview:')
      for (const line of payload.contract_preview) console.log(`  - ${line}`)
    }
    if (payload.material_divergence !== undefined) {
      console.log(
        `Divergence: ${payload.divergence_classification || (payload.material_divergence ? 'material' : 'none')}`
      )
    }
    if (payload.textual_changes)
      console.log(`\nTextual changes from review baseline:\n${payload.textual_changes}`)
    if (payload.receipt) console.log(formatStandaloneAssignmentReceipt(payload.receipt))
    console.log(`Next: ${payload.next_action}`)
  }
}

function fail(flags, message) {
  if (flags.json)
    console.log(
      JSON.stringify({ command: 'reviewloop', version: 2, status: 'error', error: message })
    )
  else console.error(message)
  process.exitCode = 1
  return null
}
