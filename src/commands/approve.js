import { join } from 'node:path'
import fse from 'fs-extra'
import { parseResultEnvelope } from '../utils/result-envelope.js'
import { resolveAssignmentPath, assignmentName } from '../utils/assignment.js'
import { resolveTargetDir } from '../utils/command-context.js'
import {
  assertCurrentAssignmentPath,
  checkpointedContractFor,
  gitSnapshot,
  normalizeReviewPolicy,
  reviewPolicyFromFlags,
  validateAssignmentContract,
  writeAssignmentStatus,
} from '../utils/assignment-vnext.js'
import { decideGuidedNode } from '../utils/engine-sync.js'
import { retireTransientArtifact } from '../utils/artifact-retention.js'
import { workspaceChangeSummaryLines } from '../utils/workspace-changes.js'

export async function approveCommand(positionalArgs = [], flags = {}) {
  const phase = positionalArgs[0]
  if (phase !== 'brainstorm') {
    console.error('Assignment vNext has one user approval: specdev approve brainstorm')
    process.exitCode = 1
    return
  }

  const targetDir = resolveTargetDir(flags)
  const assignmentPath = await resolveAssignmentPath(flags)
  const name = assignmentName(assignmentPath)
  let state
  try {
    state = await assertCurrentAssignmentPath(targetDir, assignmentPath)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
    return
  }
  if (state.position.node !== 'approve-contract') {
    console.error(
      'The Assignment is not awaiting contract approval. Run specdev checkpoint brainstorm first.'
    )
    process.exitCode = 1
    return
  }

  const contract = await validateAssignmentContract(assignmentPath)
  if (!contract.valid) {
    console.error(`Cannot approve the contract: ${contract.errors.join('; ')}`)
    process.exitCode = 1
    return
  }
  const checkpointed = await checkpointedContractFor(targetDir)
  if (checkpointed?.contract_hash !== contract.hash) {
    console.error(
      'The Assignment contract changed after its hash was shown. Run specdev checkpoint brainstorm again before approval.'
    )
    process.exitCode = 1
    return
  }
  const reviewRecord = await readOptionalReview(assignmentPath)
  const review = reviewRecord?.contract_hash === contract.hash ? reviewRecord.result : null
  const staleReview = Boolean(reviewRecord && !review)
  const statusRecord = await fse.readJson(join(assignmentPath, 'status.json')).catch(() => ({}))
  let reviewPolicy
  try {
    reviewPolicy = reviewPolicyFromFlags(flags, normalizeReviewPolicy(statusRecord.review_policy))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
    return
  }
  if (
    reviewPolicy.brainstorm === 'required' &&
    review?.frontmatter.verdict !== 'approved' &&
    !flags['override-review']
  ) {
    console.error(
      'This Assignment requires an approved Brainstorm review for the exact contract hash. Run specdev reviewloop brainstorm, or explicitly use --override-review.'
    )
    process.exitCode = 1
    return
  }
  if (review && review.frontmatter.verdict !== 'approved' && !flags['override-review']) {
    console.error(
      'The latest Brainstorm review is not approved. Address it and rerun review, or explicitly use --override-review.'
    )
    process.exitCode = 1
    return
  }

  const git = await gitSnapshot(targetDir)
  const decision = {
    approved: true,
    contract_hash: contract.hash,
    actor: String(flags.actor || 'user'),
    approved_at: new Date().toISOString(),
    review_override: Boolean(flags['override-review']),
    review_policy: reviewPolicy,
    ...(git.revision ? { revision: git.revision } : {}),
  }
  const result = decideGuidedNode(targetDir, 'approve-contract', decision)
  if (!result.synchronized) {
    console.error('Could not record contract approval in the focused Assignment workflow')
    process.exitCode = 1
    return
  }
  await writeAssignmentStatus(assignmentPath, {
    review_policy: reviewPolicy,
    review_policy_frozen_at: decision.approved_at,
  })
  await retireTransientArtifact(
    targetDir,
    join(targetDir, '.specdev'),
    join(assignmentPath, 'review', 'brainstorm-baseline.md')
  )

  const payload = {
    command: 'approve',
    version: 2,
    status: 'ok',
    phase,
    assignment: name,
    approved: true,
    contract_hash: contract.hash,
    actor: decision.actor,
    review_override: decision.review_override,
    review_policy: reviewPolicy,
    revision: git.revision,
    dirty_paths: git.dirty_paths,
    review: review
      ? {
          verdict: review.frontmatter.verdict,
          material_divergence: review.frontmatter.material_divergence ?? null,
          stale: false,
        }
      : staleReview
        ? { stale: true, reviewed_contract_hash: reviewRecord.contract_hash }
        : null,
    next_action: 'specdev implement',
  }
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else {
    console.log(`Approved Assignment contract: ${name}`)
    console.log(`Contract hash: ${contract.hash}`)
    console.log(
      `Reviews: brainstorm ${reviewPolicy.brainstorm}; implementation ${reviewPolicy.implementation}`
    )
    if (review) {
      console.log(`Review verdict: ${review.frontmatter.verdict}`)
      console.log(
        `Material divergence: ${review.frontmatter.material_divergence === true ? 'yes' : 'no'}`
      )
    } else if (staleReview) {
      console.log(
        `Review note: the saved verdict covered older contract hash ${reviewRecord.contract_hash}`
      )
    }
    for (const line of workspaceChangeSummaryLines(git.dirty_paths)) console.log(line)
    console.log('Automatic delivery can now start: specdev implement')
  }
  return payload
}

async function readOptionalReview(assignmentPath) {
  const path = join(assignmentPath, 'review', 'brainstorm-verdict.md')
  if (!(await fse.pathExists(path))) return null
  try {
    const result = parseResultEnvelope(await fse.readFile(path, 'utf-8'), 'reviewer')
    const statePath = join(assignmentPath, 'review', 'brainstorm-state.json')
    const state = (await fse.pathExists(statePath)) ? await fse.readJson(statePath) : null
    return { result, contract_hash: state?.contract_hash || null }
  } catch (error) {
    throw new Error(`invalid Brainstorm review verdict: ${error.message}`)
  }
}
