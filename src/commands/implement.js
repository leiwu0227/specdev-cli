import { join } from 'node:path'
import fse from 'fs-extra'
import { resolveAgentProfile } from '../utils/agent-profiles.js'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { resolveTargetDir } from '../utils/command-context.js'
import {
  assertApprovedContract,
  currentAssignmentNode,
  normalizeReviewPolicy,
  relativeToRepo,
  writeAssignmentStatus,
} from '../utils/assignment-vnext.js'
import { stepGuidedNode } from '../utils/engine-sync.js'
import { loadGuideCatalog } from '../utils/guides.js'
import {
  assertReviewWaiverEvidence,
  validateDeliveryArtifacts,
} from '../utils/delivery-artifacts.js'
import { listAttemptRecords, updateAttemptRecord } from '../utils/process-record.js'
import { parseResultEnvelope } from '../utils/result-envelope.js'
import { productStateDigest, runSpawnedAgent } from '../utils/spawned-agent.js'
import { reviewImplementation } from './reviewloop.js'
import { retireTransientArtifact } from '../utils/artifact-retention.js'
import {
  completeStandaloneAssignmentDelivery,
  ensureAssignmentGitBoundary,
  findPendingStandaloneAssignmentDelivery,
  formatStandaloneAssignmentReceipt,
} from '../utils/assignment-delivery.js'

export async function implementCommand(positionalArgs = [], flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  const pending = flags.assignment
    ? null
    : await findPendingStandaloneAssignmentDelivery(targetDir, specdevPath)
  const assignmentPath = pending?.path || (await resolveAssignmentPath(flags))
  const name = assignmentName(assignmentPath)
  const assignmentStatus = await fse.readJson(join(assignmentPath, 'status.json')).catch(() => null)

  try {
    if (assignmentStatus?.status === 'completed' && !assignmentStatus.mission) {
      const completion = await completeStandaloneAssignmentDelivery({
        targetDir,
        specdevPath,
        assignmentPath,
      })
      return emit(flags, {
        command: 'implement',
        version: 2,
        status: 'completed',
        assignment: name,
        recovered: true,
        ...completion,
      })
    }
    const { contract, approval } = await assertApprovedContract(targetDir, assignmentPath)
    const reviewPolicy = normalizeReviewPolicy(approval.review_policy)
    let graph = await currentAssignmentNode(targetDir)
    if (!graph) throw new Error('The focused workflow is not an Assignment')

    const boundary = await ensureAssignmentGitBoundary({
      targetDir,
      specdevPath,
      assignmentPath,
      assignmentStatus,
      adoptDirty: Boolean(flags['adopt-dirty']),
    })
    if (!boundary.ok) {
      return emitBoundaryBlocked(flags, { assignment: name, ...boundary })
    }

    if (graph.position.node === 'design') {
      const resultPath = join(assignmentPath, 'implementation', 'worker-result.md')
      const recovery = await recoverWorkerArtifacts({
        specdevPath,
        assignmentPath,
        resultPath,
        acceptanceIds: contract.acceptanceIds,
      })
      if (['blocked', 'malformed', 'invalid'].includes(recovery.status) && !flags['retry-worker']) {
        const blockedAttempt =
          recovery.status === 'blocked'
            ? (await listAttemptRecords(specdevPath, { assignment: name }))
                .filter((attempt) => attempt.kind === 'worker' && attempt.status === 'blocked')
                .at(-1)
            : null
        return emitBlockedWorker(flags, {
          command: 'implement',
          version: 2,
          status: 'blocked',
          assignment: name,
          ...(blockedAttempt ? { attempt: blockedAttempt.id } : {}),
          result: relativeToRepo(targetDir, resultPath),
          recovery: recovery.status,
          diagnostic: recovery.diagnostic,
          next_action: `Repair the preserved result and delivery artifacts, then rerun specdev implement to resume without launching another worker. To explicitly replace the non-reusable result with a fresh automatic worker, run specdev implement --retry-worker.`,
        })
      }
      let artifacts = recovery.status === 'completed' ? recovery.artifacts : null
      let attemptId = 'recovered-artifacts'
      if (!artifacts) {
        const profile = await resolveAgentProfile(specdevPath, 'worker', profileOverrides(flags))
        const catalog = (await loadGuideCatalog(specdevPath)).filter((guide) =>
          guide.phases.includes('implementation')
        )
        const result = await runSpawnedAgent({
          targetDir,
          specdevPath,
          role: 'worker',
          profile,
          prompt: workerPrompt({ targetDir, assignmentPath, contract, catalog }),
          resultPath,
          resultKind: 'worker',
          assignment: name,
          mission: assignmentStatus?.mission || undefined,
        })
        if (result.status !== 'completed')
          throw new Error(result.error || 'Assignment worker failed')
        if (result.result.frontmatter.status !== 'completed') {
          return emitBlockedWorker(flags, {
            command: 'implement',
            version: 2,
            status: 'blocked',
            assignment: name,
            attempt: result.attempt.id,
            result: relativeToRepo(targetDir, resultPath),
            next_action: `Resolve the blocker using the preserved work. If the current coding session completes the delivery artifacts and changes worker-result.md to status: completed, rerun specdev implement; SpecDev will reuse those artifacts without launching another worker. To ask SpecDev for a fresh automatic worker instead, run specdev implement --retry-worker.`,
          })
        }
        artifacts = await validateDeliveryArtifacts(
          specdevPath,
          assignmentPath,
          contract.acceptanceIds
        )
        attemptId = result.attempt.id
        await updateAttemptRecord(specdevPath, result.attempt.id, {
          guides: artifacts.implementationGuides.map(({ id, version }) => ({ id, version })),
        })
      }
      stepGuidedNode(targetDir, 'design', {
        plan: relativeToRepo(targetDir, artifacts.planPath),
        attempt: attemptId,
      })
      stepGuidedNode(targetDir, 'implementation', {
        progress: relativeToRepo(targetDir, artifacts.progressPath),
        outcome: relativeToRepo(targetDir, artifacts.outcomePath),
        attempt: attemptId,
      })
      graph = await currentAssignmentNode(targetDir)
    } else if (graph.position.node === 'implementation') {
      const artifacts = await validateDeliveryArtifacts(
        specdevPath,
        assignmentPath,
        contract.acceptanceIds
      )
      stepGuidedNode(targetDir, 'implementation', {
        progress: relativeToRepo(targetDir, artifacts.progressPath),
        outcome: relativeToRepo(targetDir, artifacts.outcomePath),
        attempt: 'recovered-artifacts',
      })
      graph = await currentAssignmentNode(targetDir)
    }

    if (
      graph.position.node === 'implementation-review' &&
      reviewPolicy.implementation === 'waived'
    ) {
      const delivery = await validateDeliveryArtifacts(
        specdevPath,
        assignmentPath,
        contract.acceptanceIds
      )
      assertReviewWaiverEvidence(delivery, contract.acceptanceIds)
      const reviewDir = join(assignmentPath, 'review')
      const verdictPath = join(reviewDir, 'implementation-waiver.md')
      const candidateDigest = await productStateDigest(targetDir)
      await fse.ensureDir(reviewDir)
      await fse.writeFile(
        verdictPath,
        `---\nverdict: approved\nmaterial_divergence: false\n---\n\n## Findings\n\nImplementation review was waived by the approved Assignment policy. Host validation confirmed all acceptance criteria Passed, all verification receipts passed, no deviations, and no required follow-up.\n`,
        'utf-8'
      )
      await fse.writeJson(
        join(reviewDir, 'implementation-state.json'),
        {
          version: 1,
          round: 0,
          status: 'approved',
          policy_waiver: true,
          contract_hash: contract.hash,
          candidate_digest: candidateDigest,
          updated_at: new Date().toISOString(),
        },
        { spaces: 2 }
      )
      stepGuidedNode(targetDir, 'implementation-review', {
        approved: true,
        verdict: relativeToRepo(targetDir, verdictPath),
        attempt: 'policy-waiver',
        disposition: 'approved',
      })
      const completedAt = new Date().toISOString()
      await writeAssignmentStatus(assignmentPath, {
        status: 'completed',
        completed_at: completedAt,
      })
      let completion = null
      if (assignmentStatus?.mission) {
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
      } else {
        completion = await completeStandaloneAssignmentDelivery({
          targetDir,
          specdevPath,
          assignmentPath,
        })
      }
      return emit(flags, {
        command: 'implement',
        version: 2,
        status: 'completed',
        assignment: name,
        review: 'waived',
        ...(completion || {}),
      })
    }
    if (['implementation-review', 'repair'].includes(graph.position.node)) {
      return reviewImplementation(flags)
    }
    if (graph.run?.status === 'completed' || graph.position.node === 'done') {
      const completion = assignmentStatus?.mission
        ? null
        : await completeStandaloneAssignmentDelivery({
            targetDir,
            specdevPath,
            assignmentPath,
          })
      return emit(flags, {
        command: 'implement',
        version: 2,
        status: 'completed',
        assignment: name,
        ...(completion || {}),
      })
    }
    throw new Error(`Assignment cannot be implemented from ${graph.position.node}`)
  } catch (error) {
    const payload = { command: 'implement', version: 2, status: 'error', error: error.message }
    if (flags.json) console.log(JSON.stringify(payload))
    else console.error(error.message)
    process.exitCode = 1
    return payload
  }
}

async function recoverWorkerArtifacts({ specdevPath, assignmentPath, resultPath, acceptanceIds }) {
  if (!(await fse.pathExists(resultPath))) return { status: 'absent' }
  let result
  try {
    result = parseResultEnvelope(await fse.readFile(resultPath, 'utf-8'), 'worker')
  } catch (error) {
    return {
      status: 'malformed',
      diagnostic: `Preserved worker result is malformed: ${error.message}`,
    }
  }
  if (result.frontmatter.status === 'blocked') {
    return {
      status: 'blocked',
      diagnostic: 'Preserved worker result reports status: blocked and requires resolution.',
    }
  }
  try {
    return {
      status: 'completed',
      artifacts: await validateDeliveryArtifacts(specdevPath, assignmentPath, acceptanceIds),
    }
  } catch (error) {
    return {
      status: 'invalid',
      diagnostic: `Preserved completed delivery artifacts are invalid: ${error.message}`,
    }
  }
}

function workerPrompt({ targetDir, assignmentPath, contract, catalog }) {
  const rel = (path) => relativeToRepo(targetDir, path)
  const catalogText =
    catalog.length > 0
      ? catalog
          .map(
            (guide) =>
              `- ID ${guide.id} (version ${guide.version}): ${guide.summary} (${guide.path})`
          )
          .join('\n')
      : '- none'
  return [
    'Plan and implement this approved Assignment in one bounded Attempt.',
    'Inspect the current repository and delivery artifacts first. When resuming after an interruption or blocked Attempt, preserve correct existing work and continue only what remains; do not rewrite completed work blindly.',
    'You are already the automatic worker launched by the host controller. Do not run specdev lifecycle commands, change SpecDev focus, or spawn another implementation Attempt; write the requested artifacts and product changes directly.',
    `Approved contract: ${rel(contract.path)}`,
    `Write the ordered plan: ${rel(join(assignmentPath, 'design', 'plan.md'))}`,
    `Write progress and verification receipts: ${rel(join(assignmentPath, 'implementation', 'progress.json'))}`,
    `Write the concise final outcome: ${rel(join(assignmentPath, 'outcome.md'))}`,
    '',
    'The plan must include a `## Tasks` section with ordered Task IDs, reference acceptance IDs, and include:',
    '**Implementation Guides:** [at most three IDs]',
    '**Review Guides:** [at most three different or complementary IDs]',
    '',
    'Available guide catalog:',
    catalogText,
    '',
    'Choose the smallest useful guide set, read each selected Implementation guide before editing, and record catalog IDs without an @version suffix. The host resolves and records exact versions. The later reviewer receives the separately selected Review guides.',
    'Execute Tasks inline by default. Do not create worktrees, commits, subagents, or per-Task reviews unless the contract explicitly requires them.',
    'Repository instructions outrank the contract and guides. Before any test or protected command, obey repository confirmation rules. If permission is missing, return blocked rather than guessing.',
    'Never run a full suite when focused evidence answers the question. Reuse a receipt for the same command on the same revision.',
    'When adding or upgrading an external dependency, resolve its version from the package manager or registry during this Attempt rather than relying on model memory. Use the ecosystem lockfile/audit mechanism when available and record the result. A lockfile-only update is not evidence that the dependency installed or that its entry point starts. Do not claim completion with an unresolved direct high/critical advisory unless the approved contract explicitly accepts it; report the blocker or required follow-up instead.',
    'progress.json must use this exact top-level shape: { "version": 1, "tasks": [{ "id": "T-1", "status": "completed" }], "selected_guides": { "implementation": ["guide-id"], "review": ["guide-id"] }, "verification": [{ "command": "...", "revision": "...", "scope": "...", "status": "passed|failed|skipped", "duration_ms": 123 }], "deviations": [], "follow_up": "none|required" }. Do not rename these keys. Record every material contract or plan deviation in deviations. Use follow_up: required only when another bounded Assignment is actually needed. For a dirty tested candidate, record revision as `working-tree@<HEAD>` rather than implying HEAD contains the changes. Every Task must be completed before returning completed.',
    'outcome.md must summarize delivered behavior, deviations, unresolved risks, and a compact table with exactly three columns: Acceptance, Evidence, Result. Put only Passed, Failed, or Blocked (optional terminal punctuation is allowed) in the Result cell for every acceptance ID.',
  ].join('\n')
}

function profileOverrides(flags) {
  return {
    provider: typeof flags.provider === 'string' ? flags.provider : undefined,
    model: typeof flags.model === 'string' ? flags.model : undefined,
    effort: typeof flags.effort === 'string' ? flags.effort : undefined,
    timeout: typeof flags.timeout === 'string' ? flags.timeout : undefined,
  }
}

function emit(flags, payload) {
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else {
    console.log(`Assignment complete: ${payload.assignment}`)
    if (payload.receipt) console.log(formatStandaloneAssignmentReceipt(payload.receipt))
  }
  return payload
}

function emitBlockedWorker(flags, payload) {
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else {
    console.error(`Assignment blocked: ${payload.assignment}`)
    if (payload.attempt) console.error(`Attempt: ${payload.attempt}`)
    console.error(`Result: ${payload.result}`)
    if (payload.recovery) console.error(`Recovery: ${payload.recovery}`)
    if (payload.diagnostic) console.error(`Diagnostic: ${payload.diagnostic}`)
    console.error(`Next: ${payload.next_action}`)
  }
  process.exitCode = 1
  return payload
}

function emitBoundaryBlocked(flags, details) {
  const payload = {
    command: 'implement',
    version: 2,
    status: 'blocked',
    ...details,
  }
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else {
    console.error(`Assignment blocked at Git boundary: ${details.state}`)
    if (details.working_tree) {
      console.error(`Existing product paths: ${details.working_tree.count}`)
      for (const path of details.working_tree.preview) console.error(`  - ${path}`)
      if (details.working_tree.omitted)
        console.error(`  - +${details.working_tree.omitted} more path(s)`)
    }
    if (details.next_action) console.error(`Next: ${details.next_action}`)
  }
  process.exitCode = 1
  return payload
}
