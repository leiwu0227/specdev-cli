import { createHash } from 'node:crypto'
import { join } from 'node:path'
import fse from 'fs-extra'
import {
  commitDelivery,
  currentGitBranch,
  findCommitByTrailer,
  findCommitsByTrailer,
  firstParent,
  gitChangedPathsAtCommit,
  gitStatusPaths,
  requireGitHead,
  stageOwnedChanges,
  summarizeGitPaths,
} from './git-delivery.js'
import {
  relativeToRepo,
  validateAssignmentContract,
  writeAssignmentStatus,
} from './assignment-vnext.js'
import { compactCompletedWorkflowRuntime, retireTransientArtifact } from './artifact-retention.js'
import { attemptActivitySummary } from './process-record.js'
import { parseResultEnvelope } from './result-envelope.js'
import { validateDeliveryArtifacts } from './delivery-artifacts.js'

const RECEIPT_LIMITS = Object.freeze({ items: 12, groups: 8, text: 240 })

export async function buildStandaloneAssignmentCandidateReceipt({
  targetDir,
  assignmentPath,
  assignmentStatus,
}) {
  const issues = []
  const paths = receiptArtifactPaths(assignmentPath)
  const reviewedPaths = {
    contract: paths.contract,
    plan: paths.plan,
    progress: paths.progress,
    outcome: paths.outcome,
  }
  const artifacts = {}
  for (const [key, path] of Object.entries(reviewedPaths)) {
    const bytes = await fse.readFile(path).catch(() => null)
    artifacts[key] = {
      path: boundedText(relativeToRepo(targetDir, path)),
      exists: bytes !== null,
      digest: bytes === null ? null : createHash('sha256').update(bytes).digest('hex'),
    }
    if (bytes === null) issues.push(`missing_artifact:${key}`)
  }
  const contract = await validateAssignmentContract(assignmentPath)
  if (!contract.valid) issues.push('invalid_contract')
  const progress = await readJsonIfPresent(paths.progress)
  const outcome = await readTextIfPresent(paths.outcome)
  const acceptance = summarizeAcceptance(contract.acceptanceIds || [], outcome, issues)
  const verification = summarizeVerification(progress?.verification, issues)
  const risks = summarizeRisks(outcome, issues)
  if (progress?.follow_up === 'required') issues.push('follow_up_required')

  const productDigest = await productWorkingTreeDigest(targetDir)
  if (!productDigest) issues.push('candidate_product_identity_missing')
  const identityInputs = {
    assignment_id: String(assignmentStatus?.id || '').trim() || null,
    implementation_execution: assignmentStatus?.implementation_execution || null,
    contract_hash: contract.hash || null,
    product_digest: productDigest,
    artifact_digests: Object.fromEntries(
      Object.entries(artifacts).map(([key, value]) => [key, value.digest])
    ),
  }
  const identity = createHash('sha256').update(JSON.stringify(identityInputs)).digest('hex')
  const projectPaths = (await gitStatusPaths(targetDir)).filter(
    (path) => path !== '.specdev' && !path.startsWith('.specdev/')
  )
  const uniqueIssues = [...new Set(issues)]
  const receipt = {
    version: 1,
    kind: 'standalone_assignment_candidate',
    completeness: uniqueIssues.length === 0 ? 'complete' : 'incomplete',
    identity,
    assignment: {
      id: identityInputs.assignment_id,
      folder: assignmentPath.split(/[/\\]/).pop(),
    },
    implementation_execution: assignmentStatus?.implementation_execution || null,
    contract: { path: artifacts.contract.path, hash: contract.hash || null },
    acceptance,
    verification,
    changed_project_paths: groupProjectPaths(projectPaths),
    unresolved_risks: risks,
    artifacts,
    issues: uniqueIssues.slice(0, RECEIPT_LIMITS.items),
    issues_omitted: Math.max(0, uniqueIssues.length - RECEIPT_LIMITS.items),
  }
  validateStandaloneAssignmentCandidateReceipt(receipt)
  return receipt
}

export async function preflightStandaloneAssignmentCandidate({
  targetDir,
  specdevPath,
  assignmentPath,
  assignmentStatus,
  acceptanceIds,
  delivery: validatedDelivery = null,
  writeReceipt = false,
  writeIncomplete = false,
}) {
  let delivery = validatedDelivery
  if (!delivery) {
    try {
      delivery = await validateDeliveryArtifacts(specdevPath, assignmentPath, acceptanceIds)
    } catch (error) {
      const issues = [`delivery_artifact_invalid: ${boundedText(error.message)}`]
      return {
        status: 'incomplete',
        stage: 'delivery_artifacts',
        completeness: 'incomplete',
        issues,
        issues_omitted: 0,
        delivery: null,
        receipt: null,
        receipt_path: null,
        verification: null,
      }
    }
  }
  const receipt = await buildStandaloneAssignmentCandidateReceipt({
    targetDir,
    assignmentPath,
    assignmentStatus,
  })
  const complete = receipt.completeness === 'complete'
  const receiptPath =
    writeReceipt && (complete || writeIncomplete)
      ? await writeStandaloneAssignmentCandidateReceipt(assignmentPath, receipt)
      : null
  return {
    status: complete ? 'complete' : 'incomplete',
    stage: 'candidate',
    completeness: receipt.completeness,
    issues: [...receipt.issues],
    issues_omitted: receipt.issues_omitted,
    delivery,
    receipt,
    receipt_path: receiptPath,
    verification: verificationProjection(receipt.verification),
  }
}

export function validateStandaloneAssignmentCandidateReceipt(receipt) {
  if (!receipt || receipt.version !== 1 || receipt.kind !== 'standalone_assignment_candidate') {
    throw new Error('Invalid standalone Assignment candidate receipt')
  }
  if (!/^[a-f0-9]{64}$/.test(String(receipt.identity || ''))) {
    throw new Error('Standalone Assignment candidate receipt has invalid identity')
  }
  if (!['complete', 'incomplete'].includes(receipt.completeness)) {
    throw new Error('Standalone Assignment candidate receipt has invalid completeness')
  }
  if (!Array.isArray(receipt.issues) || receipt.issues.length > RECEIPT_LIMITS.items) {
    throw new Error('Standalone Assignment candidate receipt issues are invalid or unbounded')
  }
  for (const key of [
    'assignment',
    'contract',
    'acceptance',
    'verification',
    'changed_project_paths',
    'unresolved_risks',
    'artifacts',
  ]) {
    if (!receipt[key] || typeof receipt[key] !== 'object') {
      throw new Error(`Standalone Assignment candidate receipt is missing ${key}`)
    }
  }
  for (const key of ['acceptance', 'verification']) {
    if (!Array.isArray(receipt[key].items) || receipt[key].items.length > RECEIPT_LIMITS.items) {
      throw new Error(`Standalone Assignment candidate receipt ${key} is invalid or unbounded`)
    }
  }
  if (
    !Array.isArray(receipt.verification.authoritative_evidence) ||
    receipt.verification.authoritative_evidence.length > RECEIPT_LIMITS.items
  ) {
    throw new Error('Standalone Assignment candidate authoritative evidence is invalid')
  }
  validateVerificationProjection(receipt.verification, 'candidate')
  for (const artifact of Object.values(receipt.artifacts)) {
    if (
      typeof artifact?.path !== 'string' ||
      typeof artifact.exists !== 'boolean' ||
      (artifact.digest !== null && !/^[a-f0-9]{64}$/.test(String(artifact.digest)))
    ) {
      throw new Error('Standalone Assignment candidate artifact identity is invalid')
    }
  }
  return receipt
}

export async function writeStandaloneAssignmentCandidateReceipt(assignmentPath, receipt) {
  validateStandaloneAssignmentCandidateReceipt(receipt)
  const path = join(assignmentPath, 'review', 'candidate-receipt.json')
  await fse.ensureDir(join(assignmentPath, 'review'))
  const temporary = `${path}.tmp-${process.pid}`
  await fse.writeJson(temporary, receipt, { spaces: 2 })
  await fse.move(temporary, path, { overwrite: true })
  return path
}

export async function ensureAssignmentGitBoundary({
  targetDir,
  specdevPath,
  assignmentPath,
  assignmentStatus,
  implementationExecution = null,
  adoptDirty = false,
}) {
  if (assignmentStatus?.mission) {
    if (implementationExecution && !assignmentStatus?.implementation_execution) {
      await writeAssignmentStatus(assignmentPath, {
        implementation_execution: implementationExecution,
      })
    }
    return { ok: true, skipped: 'mission_child' }
  }

  const adhocPath = join(specdevPath, 'cache', 'adhoc.json')
  if (await fse.pathExists(adhocPath)) {
    return {
      ok: false,
      state: 'adhoc_active',
      next_action: 'Finish or cancel the active Adhoc before implementing an Assignment.',
    }
  }

  const currentHead = await requireGitHead(targetDir)
  if (assignmentStatus?.git_boundary?.starting_git_commit_hash) {
    if (currentHead !== assignmentStatus.git_boundary.starting_git_commit_hash) {
      return {
        ok: false,
        state: 'head_changed',
        starting_git_commit_hash: assignmentStatus.git_boundary.starting_git_commit_hash,
        current_git_commit_hash: currentHead,
        next_action:
          'Inspect the intervening commits and restore or deliberately restart the Assignment boundary; SpecDev will not silently absorb them.',
      }
    }
    if (implementationExecution && !assignmentStatus?.implementation_execution) {
      await writeAssignmentStatus(assignmentPath, {
        implementation_execution: implementationExecution,
      })
    }
    return { ok: true, boundary: assignmentStatus.git_boundary, recovered: true }
  }

  const paths = await gitStatusPaths(targetDir)
  const projectPaths = paths.filter((path) => path !== '.specdev' && !path.startsWith('.specdev/'))
  if (projectPaths.length > 0 && !adoptDirty) {
    return {
      ok: false,
      state: 'dirty_worktree',
      working_tree: summarizeGitPaths(projectPaths),
      interaction: {
        question:
          'Product files already have changes. Decide whether they belong to this approved Assignment.',
        options: [
          { id: 'inspect', label: 'Stop and inspect', recommended: true },
          { id: 'checkpoint', label: 'Commit existing work separately, then rerun' },
          {
            id: 'adopt',
            label: 'Include every current product change in this Assignment',
            command: 'specdev implement --adopt-dirty',
          },
        ],
      },
    }
  }

  const boundary = {
    version: 1,
    starting_git_commit_hash: currentHead,
    starting_branch: await currentGitBranch(targetDir),
    starting_worktree: projectPaths.length > 0 ? 'adopted' : 'clean',
    adopted_path_count: projectPaths.length,
    established_at: new Date().toISOString(),
  }
  await writeAssignmentStatus(assignmentPath, {
    git_boundary: boundary,
    ...(implementationExecution ? { implementation_execution: implementationExecution } : {}),
  })
  return { ok: true, boundary, recovered: false }
}

export async function finalizeStandaloneAssignmentDelivery({
  targetDir,
  assignmentPath,
  assignmentStatus,
}) {
  if (assignmentStatus?.mission) return null
  const id = String(assignmentStatus?.id || '').trim()
  if (!id) throw new Error('Assignment status has no durable ID')

  const recovered = await findCommitByTrailer(targetDir, 'SpecDev-Assignment', id, {
    revision: 'HEAD',
  })
  if (recovered) {
    return {
      starting_git_commit_hash: assignmentStatus.git_boundary?.starting_git_commit_hash || null,
      ending_git_commit_hash: recovered,
      recovered: true,
    }
  }

  const startingGitCommitHash = assignmentStatus.git_boundary?.starting_git_commit_hash
  if (!startingGitCommitHash) {
    throw new Error(
      'Assignment has no implementation Git boundary; rerun from implementation start'
    )
  }
  const currentHead = await requireGitHead(targetDir)
  if (currentHead !== startingGitCommitHash) {
    throw new Error(
      `Git HEAD changed during Assignment implementation (${startingGitCommitHash} -> ${currentHead}); inspect the intervening commit before delivery`
    )
  }

  await stageOwnedChanges(targetDir)
  const endingGitCommitHash = await commitDelivery(targetDir, {
    subject: `specdev(assignment): deliver ${id}`,
    trailers: {
      'SpecDev-Assignment': id,
      'SpecDev-Commit-Type': 'delivery',
    },
  })
  return {
    starting_git_commit_hash: startingGitCommitHash,
    ending_git_commit_hash: endingGitCommitHash,
    recovered: false,
  }
}

export async function completeStandaloneAssignmentDelivery({
  targetDir,
  specdevPath,
  assignmentPath,
}) {
  let status = await fse.readJson(join(assignmentPath, 'status.json'))
  if (status.mission) return null
  if (status.status !== 'completed') {
    throw new Error('Standalone Assignment cannot be delivered before completion')
  }

  const name = assignmentPath.split(/[/\\]/).pop()
  const existingDeliveryCommit = status.id
    ? await findCommitByTrailer(targetDir, 'SpecDev-Assignment', status.id, { revision: 'HEAD' })
    : null
  const activity =
    status.activity ||
    (await attemptActivitySummary(
      specdevPath,
      { assignment: name },
      {
        startedAt: status.approved_at || status.created_at,
        endedAt: status.completed_at,
      }
    ))
  if (!status.activity) {
    status = existingDeliveryCommit
      ? { ...status, activity }
      : await writeAssignmentStatus(assignmentPath, { activity })
  }

  const reviewState = await readJsonIfPresent(
    join(assignmentPath, 'review', 'implementation-state.json')
  )
  if (reviewState?.candidate_receipt_identity && !existingDeliveryCommit) {
    const currentCandidate = await buildStandaloneAssignmentCandidateReceipt({
      targetDir,
      assignmentPath,
      assignmentStatus: status,
    })
    if (
      currentCandidate.completeness !== 'complete' ||
      currentCandidate.identity !== reviewState.candidate_receipt_identity
    ) {
      throw new Error('Standalone Assignment reviewed candidate changed before delivery commit')
    }
  }

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
  if (status.delivery_phase !== 'ready' || !status.delivery_prepared_at) {
    const deliveryPatch = {
      delivery_phase: 'ready',
      delivery_prepared_at: status.delivery_prepared_at || new Date().toISOString(),
    }
    status = existingDeliveryCommit
      ? { ...status, ...deliveryPatch }
      : await writeAssignmentStatus(assignmentPath, deliveryPatch)
  }
  const delivery = await finalizeStandaloneAssignmentDelivery({
    targetDir,
    assignmentPath,
    assignmentStatus: status,
  })
  const receipt = await buildStandaloneAssignmentReceipt({
    targetDir,
    assignmentPath,
    assignmentStatus: status,
    delivery,
  })
  if (receipt.completeness !== 'complete') {
    const error = new Error(
      `Standalone Assignment awaits artifact repair: ${receipt.issues.join(', ') || 'final receipt incomplete'}`
    )
    error.receipt = receipt
    throw error
  }
  const runtime = await compactCompletedWorkflowRuntime(specdevPath, {
    runId: status.run_id,
    attemptFilter: { assignment: name },
    terminalOwner: { assignment: name, status: status.status },
    focus: { kind: 'assignment', id: status.id },
  })
  return { activity, runtime_compaction: runtime, delivery, receipt }
}

export async function buildStandaloneAssignmentReceipt({
  targetDir,
  assignmentPath,
  assignmentStatus,
  delivery,
}) {
  const issues = []
  const artifactPaths = receiptArtifactPaths(assignmentPath)
  const artifacts = {}
  for (const [key, path] of Object.entries(artifactPaths)) {
    const exists = await fse.pathExists(path)
    artifacts[key] = { path: boundedText(relativeToRepo(targetDir, path)), exists }
    if (!exists && !['review_verdict', 'review_state', 'candidate_receipt'].includes(key)) {
      issues.push(`missing_artifact:${key}`)
    }
  }

  const contract = await validateAssignmentContract(assignmentPath)
  if (!contract.valid) issues.push('invalid_contract')
  const progress = await readJsonIfPresent(artifactPaths.progress)
  const outcome = await readTextIfPresent(artifactPaths.outcome)
  const reviewState = await readJsonIfPresent(artifactPaths.review_state)
  const reviewResult = await readReviewResult(artifactPaths.review_verdict)
  const candidateReceipt = await readJsonIfPresent(artifactPaths.candidate_receipt)
  const contractHashMatchesReview = Boolean(
    contract.hash && reviewState?.contract_hash && contract.hash === reviewState.contract_hash
  )
  if (!contractHashMatchesReview) issues.push('contract_review_identity_incomplete')

  const acceptance = summarizeAcceptance(contract.acceptanceIds || [], outcome, issues)
  const verification = summarizeVerification(progress?.verification, issues)
  const risks = summarizeRisks(outcome, issues)
  const review = summarizeReview(reviewState, reviewResult, candidateReceipt, issues)

  const id = String(assignmentStatus?.id || '').trim()
  const deliveryCommit = String(delivery?.ending_git_commit_hash || '').trim() || null
  const matchingCommits = id
    ? await findCommitsByTrailer(targetDir, 'SpecDev-Assignment', id, { revision: 'HEAD' })
    : []
  if (!deliveryCommit) issues.push('missing_delivery_commit')
  if (matchingCommits.length !== 1) issues.push('ambiguous_delivery_commit')
  const startingCommit = assignmentStatus?.git_boundary?.starting_git_commit_hash || null
  const deliveryParent = deliveryCommit ? await firstParent(targetDir, deliveryCommit) : null
  if (!startingCommit || !deliveryParent || startingCommit !== deliveryParent) {
    issues.push('ambiguous_git_delivery_boundary')
  }
  const committedPaths = deliveryCommit
    ? await gitChangedPathsAtCommit(targetDir, deliveryCommit)
    : []
  const projectPaths = committedPaths.filter(
    (path) => path !== '.specdev' && !path.startsWith('.specdev/')
  )
  const worktreePaths = (await gitStatusPaths(targetDir)).filter(
    (path) => path !== '.specdev' && !path.startsWith('.specdev/')
  )
  const worktree = summarizeGitPaths(worktreePaths, RECEIPT_LIMITS.items)

  const uniqueIssues = [...new Set(issues)]
  const receipt = {
    version: 1,
    completeness: uniqueIssues.length === 0 ? 'complete' : 'incomplete',
    assignment: {
      id: id || null,
      folder: assignmentPath.split(/[/\\]/).pop(),
      status: assignmentStatus?.status || 'unknown',
    },
    implementation_execution: assignmentStatus?.implementation_execution || null,
    contract: {
      path: artifacts.contract.path,
      hash: contract.hash || null,
      approved_at: assignmentStatus?.approved_at || null,
      review_identity_matches: contractHashMatchesReview,
    },
    review,
    delivery: {
      starting_commit: startingCommit,
      commit: deliveryCommit,
      matching_commit_count: matchingCommits.length,
    },
    acceptance,
    verification,
    changed_project_paths: groupProjectPaths(projectPaths),
    unresolved_risks: risks,
    artifacts,
    worktree: {
      clean: worktreePaths.length === 0,
      ...worktree,
      preview: worktree.preview.map(boundedText),
    },
    issues: uniqueIssues.slice(0, RECEIPT_LIMITS.items),
    issues_omitted: Math.max(0, uniqueIssues.length - RECEIPT_LIMITS.items),
  }
  validateStandaloneAssignmentReceipt(receipt)
  return receipt
}

export function formatStandaloneAssignmentReceipt(receipt) {
  validateStandaloneAssignmentReceipt(receipt)
  const acceptance = receipt.acceptance.counts
  const verification = receipt.verification.counts
  const roles = receipt.verification.by_role
  const lines = [
    'Delivery receipt:',
    `  Evidence: ${receipt.completeness}`,
    `  Contract: ${receipt.contract.path} @ ${receipt.contract.hash || 'missing'}`,
    `  Review: ${receipt.review.verdict} (${receipt.review.disposition}; divergence: ${receipt.review.divergence})`,
    `  Delivery commit: ${receipt.delivery.commit || 'missing'}`,
    `  Acceptance: ${acceptance.passed} passed, ${acceptance.failed} failed, ${acceptance.blocked} blocked, ${acceptance.missing} missing`,
    `  Verification: ${verification.passed} passed, ${verification.failed} failed, ${verification.skipped} skipped, ${verification.missing} missing`,
    `    Qualification: ${roles.qualification.passed} passed, ${roles.qualification.failed} failed, ${roles.qualification.skipped} skipped`,
    `    Authoritative acceptance: ${roles.authoritative_acceptance.passed} passed, ${roles.authoritative_acceptance.failed} failed, ${roles.authoritative_acceptance.skipped} skipped`,
    `  Changed project paths: ${receipt.changed_project_paths.count}`,
  ]
  if (receipt.verification.effective) {
    const effective = receipt.verification.effective
    lines.splice(
      9,
      0,
      `  Current verification obligations: ${effective.counts.passed} passed, ${effective.counts.failed} failed, ${effective.counts.skipped} skipped, ${effective.counts.missing} missing`,
      `  Superseded verification attempts: ${receipt.verification.superseded}`
    )
  }
  for (const group of receipt.changed_project_paths.groups) {
    const suffix = group.omitted > 0 ? `, +${group.omitted} more` : ''
    lines.push(`    ${group.name} (${group.count}): ${group.paths.join(', ')}${suffix}`)
  }
  lines.push(
    `  Unresolved risks: ${receipt.unresolved_risks.status}${
      receipt.unresolved_risks.items.length > 0
        ? ` — ${receipt.unresolved_risks.items.join('; ')}`
        : ''
    }`,
    `  Worktree: ${receipt.worktree.clean ? 'clean' : `dirty (${receipt.worktree.count} path(s))`}`
  )
  if (receipt.issues.length > 0) {
    const suffix = receipt.issues_omitted > 0 ? `, +${receipt.issues_omitted} more` : ''
    lines.push(`  Evidence issues: ${receipt.issues.join(', ')}${suffix}`)
  }
  lines.push('  Artifacts:')
  for (const [name, artifact] of Object.entries(receipt.artifacts)) {
    lines.push(`    ${name}: ${artifact.path}${artifact.exists ? '' : ' (missing)'}`)
  }
  return lines.join('\n')
}

export function validateStandaloneAssignmentReceipt(receipt) {
  if (!receipt || receipt.version !== 1) throw new Error('Invalid standalone delivery receipt')
  if (!['complete', 'incomplete'].includes(receipt.completeness)) {
    throw new Error('Standalone delivery receipt has invalid completeness')
  }
  for (const key of [
    'assignment',
    'contract',
    'review',
    'delivery',
    'acceptance',
    'verification',
    'changed_project_paths',
    'unresolved_risks',
    'artifacts',
    'worktree',
  ]) {
    if (!receipt[key] || typeof receipt[key] !== 'object') {
      throw new Error(`Standalone delivery receipt is missing ${key}`)
    }
  }
  if (!Array.isArray(receipt.issues) || receipt.issues.length > RECEIPT_LIMITS.items) {
    throw new Error('Standalone delivery receipt issues are invalid or unbounded')
  }
  if (
    !Array.isArray(receipt.changed_project_paths.groups) ||
    receipt.changed_project_paths.groups.length > RECEIPT_LIMITS.groups
  ) {
    throw new Error('Standalone delivery receipt path groups are invalid or unbounded')
  }
  const groupedPathCount = receipt.changed_project_paths.groups.reduce((count, group) => {
    if (!Array.isArray(group.paths)) {
      throw new Error('Standalone delivery receipt path group is invalid')
    }
    return count + group.paths.length
  }, 0)
  if (groupedPathCount > RECEIPT_LIMITS.items) {
    throw new Error('Standalone delivery receipt path preview is unbounded')
  }
  for (const key of ['acceptance', 'verification']) {
    if (!Array.isArray(receipt[key].items) || receipt[key].items.length > RECEIPT_LIMITS.items) {
      throw new Error(`Standalone delivery receipt ${key} summary is invalid or unbounded`)
    }
  }
  if (
    !receipt.verification.by_role ||
    !receipt.verification.by_role.qualification ||
    !receipt.verification.by_role.authoritative_acceptance ||
    !Array.isArray(receipt.verification.authoritative_evidence)
  ) {
    throw new Error('Standalone delivery receipt verification roles are invalid')
  }
  validateVerificationProjection(receipt.verification, 'delivery')
  if (
    !Array.isArray(receipt.unresolved_risks.items) ||
    receipt.unresolved_risks.items.length > RECEIPT_LIMITS.items
  ) {
    throw new Error('Standalone delivery receipt risk summary is invalid or unbounded')
  }
  if (
    !Array.isArray(receipt.worktree.preview) ||
    receipt.worktree.preview.length > RECEIPT_LIMITS.items
  ) {
    throw new Error('Standalone delivery receipt worktree summary is invalid or unbounded')
  }
  for (const artifact of Object.values(receipt.artifacts)) {
    if (typeof artifact?.path !== 'string' || typeof artifact.exists !== 'boolean') {
      throw new Error('Standalone delivery receipt artifact entry is invalid')
    }
  }
  return receipt
}

function receiptArtifactPaths(assignmentPath) {
  const reviewDir = join(assignmentPath, 'review')
  const waiverPath = join(reviewDir, 'implementation-waiver.md')
  const verdictPath = fse.existsSync(waiverPath)
    ? waiverPath
    : join(reviewDir, 'implementation-verdict.md')
  return {
    contract: join(assignmentPath, 'brainstorm', 'contract.md'),
    plan: join(assignmentPath, 'design', 'plan.md'),
    progress: join(assignmentPath, 'implementation', 'progress.json'),
    outcome: join(assignmentPath, 'outcome.md'),
    status: join(assignmentPath, 'status.json'),
    review_verdict: verdictPath,
    review_state: join(reviewDir, 'implementation-state.json'),
    candidate_receipt: join(reviewDir, 'candidate-receipt.json'),
  }
}

async function readJsonIfPresent(path) {
  return fse.readJson(path).catch(() => null)
}

async function readTextIfPresent(path) {
  return fse.readFile(path, 'utf8').catch(() => '')
}

async function readReviewResult(path) {
  const content = await readTextIfPresent(path)
  if (!content) return null
  try {
    return parseResultEnvelope(content, 'reviewer').frontmatter
  } catch {
    return null
  }
}

function summarizeAcceptance(ids, outcome, issues) {
  const items = ids.slice(0, RECEIPT_LIMITS.items).map((id) => {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = new RegExp(
      `^\\|\\s*${escaped}\\s*\\|\\s*(.*)\\s*\\|\\s*(Passed|Failed|Blocked)[.!]?\\s*\\|\\s*$`,
      'mi'
    ).exec(outcome)
    return {
      id,
      evidence: boundedText(match?.[1] || 'Missing acceptance evidence.'),
      result: match ? match[2].toLowerCase() : 'missing',
    }
  })
  const counts = countStatuses(items, ['passed', 'failed', 'blocked', 'missing'])
  if (ids.length === 0 || ids.length > RECEIPT_LIMITS.items || counts.missing > 0) {
    issues.push('acceptance_evidence_incomplete')
  }
  if (counts.failed > 0 || counts.blocked > 0) issues.push('acceptance_not_passed')
  return { total: ids.length, items, omitted: Math.max(0, ids.length - items.length), counts }
}

export function summarizeVerification(receipts, issues) {
  if (!Array.isArray(receipts)) {
    issues.push('verification_evidence_missing')
    const counts = { passed: 0, failed: 0, skipped: 0, missing: 1 }
    const byRole = emptyVerificationRoleCounts()
    return {
      total: 0,
      items: [],
      omitted: 0,
      counts,
      by_role: byRole,
      raw: { total: 0, counts, by_role: byRole },
      effective: { total: 0, counts, by_role: byRole },
      superseded: 0,
      authoritative_evidence: [],
      authoritative_evidence_omitted: 0,
    }
  }
  const normalized = receipts.map(normalizeVerificationReceipt)
  const rawItems = normalized.map((entry) => entry.item)
  const counts = countStatuses(rawItems, ['passed', 'failed', 'skipped', 'missing'])
  const byRole = {
    qualification: countStatuses(
      rawItems.filter((item) => item.role === 'qualification'),
      ['passed', 'failed', 'skipped', 'missing']
    ),
    authoritative_acceptance: countStatuses(
      rawItems.filter((item) => item.role === 'authoritative_acceptance'),
      ['passed', 'failed', 'skipped', 'missing']
    ),
  }
  if (normalized.some((entry) => !entry.valid)) {
    issues.push('verification_evidence_incomplete')
  }
  const obligations = new Map()
  for (const entry of normalized) {
    const previous = obligations.get(entry.key)
    const history = previous?.history_counts || {
      passed: 0,
      failed: 0,
      skipped: 0,
      missing: 0,
    }
    history[entry.item.status] += 1
    obligations.set(entry.key, {
      ...entry.item,
      attempts: (previous?.attempts || 0) + 1,
      superseded: previous?.attempts || 0,
      history_counts: history,
      first_index: previous?.first_index ?? entry.index,
      last_index: entry.index,
    })
  }
  const effectiveItems = [...obligations.values()]
  const effectiveCounts = countStatuses(effectiveItems, ['passed', 'failed', 'skipped', 'missing'])
  const effectiveByRole = {
    qualification: countStatuses(
      effectiveItems.filter((item) => item.role === 'qualification'),
      ['passed', 'failed', 'skipped', 'missing']
    ),
    authoritative_acceptance: countStatuses(
      effectiveItems.filter((item) => item.role === 'authoritative_acceptance'),
      ['passed', 'failed', 'skipped', 'missing']
    ),
  }
  const prioritized = [...effectiveItems].sort(compareVerificationObligations)
  const authoritative = prioritized.filter((item) => item.role === 'authoritative_acceptance')
  if (authoritative.length === 0) issues.push('authoritative_verification_missing')
  if (
    effectiveByRole.authoritative_acceptance.failed > 0 ||
    effectiveByRole.authoritative_acceptance.skipped > 0 ||
    effectiveByRole.authoritative_acceptance.missing > 0
  ) {
    issues.push('authoritative_verification_not_passed')
  }
  const items = prioritized.slice(0, RECEIPT_LIMITS.items).map(publicVerificationObligation)
  const authoritativeEvidence = authoritative.slice(0, RECEIPT_LIMITS.items)
  return {
    total: receipts.length,
    items,
    omitted: Math.max(0, effectiveItems.length - items.length),
    counts,
    by_role: byRole,
    raw: { total: receipts.length, counts, by_role: byRole },
    effective: {
      total: effectiveItems.length,
      counts: effectiveCounts,
      by_role: effectiveByRole,
    },
    superseded: Math.max(0, receipts.length - effectiveItems.length),
    authoritative_evidence: authoritativeEvidence.map((item) => ({
      command: item.command,
      revision: item.revision,
      status: item.status,
    })),
    authoritative_evidence_omitted: Math.max(
      0,
      authoritative.length - authoritativeEvidence.length
    ),
  }
}

function normalizeVerificationReceipt(receipt, index) {
  const explicitRole = ['qualification', 'authoritative_acceptance'].includes(receipt?.role)
    ? receipt.role
    : null
  const hasRole = receipt?.role !== undefined && receipt?.role !== null && receipt?.role !== ''
  const role = explicitRole || 'authoritative_acceptance'
  const command = String(receipt?.command || '').trim()
  const revision = String(receipt?.revision || '').trim()
  const scope = String(receipt?.scope || '').trim()
  const status = ['passed', 'failed', 'skipped'].includes(receipt?.status)
    ? receipt.status
    : 'missing'
  const duration = Number.isSafeInteger(receipt?.duration_ms) ? receipt.duration_ms : null
  const valid = Boolean(
    command &&
      revision &&
      scope &&
      status !== 'missing' &&
      duration !== null &&
      (!hasRole || explicitRole)
  )
  return {
    index,
    valid,
    key: valid ? JSON.stringify([role, command, revision]) : `invalid:${index}`,
    item: {
      command: boundedText(command || 'missing'),
      revision: boundedText(revision || 'missing'),
      scope: boundedText(scope || 'missing'),
      status: valid ? status : 'missing',
      duration_ms: duration,
      role,
      role_source: explicitRole ? 'explicit' : 'legacy_default',
    },
  }
}

function compareVerificationObligations(left, right) {
  const priority = (item) => {
    if (item.role === 'authoritative_acceptance' && item.status !== 'passed') return 0
    if (item.role === 'authoritative_acceptance') return 1
    return 2
  }
  return (
    priority(left) - priority(right) ||
    left.last_index - right.last_index ||
    left.first_index - right.first_index
  )
}

function publicVerificationObligation(item) {
  const { first_index: _firstIndex, last_index: _lastIndex, ...publicItem } = item
  return publicItem
}

function verificationProjection(summary) {
  if (!summary?.raw || !summary?.effective) return null
  return {
    raw_total: summary.raw.total,
    effective_total: summary.effective.total,
    superseded: summary.superseded,
    preview_omitted: summary.omitted,
    authoritative_evidence_omitted: summary.authoritative_evidence_omitted,
  }
}

function validateVerificationProjection(summary, label) {
  const hasProjection = summary.raw !== undefined || summary.effective !== undefined
  if (!hasProjection) return
  if (
    !summary.raw ||
    !summary.effective ||
    !Number.isSafeInteger(summary.raw.total) ||
    summary.raw.total < 0 ||
    !Number.isSafeInteger(summary.effective.total) ||
    summary.effective.total < 0 ||
    !Number.isSafeInteger(summary.superseded) ||
    summary.superseded < 0 ||
    summary.raw.total !== summary.effective.total + summary.superseded ||
    !summary.raw.counts ||
    !summary.raw.by_role ||
    !summary.effective.counts ||
    !summary.effective.by_role ||
    !Number.isSafeInteger(summary.authoritative_evidence_omitted) ||
    summary.authoritative_evidence_omitted < 0
  ) {
    throw new Error(`Standalone Assignment ${label} verification projection is invalid`)
  }
}

function emptyVerificationRoleCounts() {
  return {
    qualification: { passed: 0, failed: 0, skipped: 0, missing: 0 },
    authoritative_acceptance: { passed: 0, failed: 0, skipped: 0, missing: 1 },
  }
}

function summarizeReview(state, result, candidateReceipt, issues) {
  const verdict = result?.verdict || (state?.policy_waiver ? 'approved' : 'missing')
  const status = state?.status || 'missing'
  const disposition = state?.policy_waiver
    ? 'waived'
    : state?.disposition || (status === 'approved' ? 'approved' : 'missing')
  const divergence =
    typeof result?.material_divergence === 'boolean'
      ? result.material_divergence
        ? 'material'
        : 'none'
      : 'unknown'
  const scopeDivergence = result?.scope_divergence || state?.scope_divergence || 'unknown'
  const procedureDivergence =
    result?.procedure_divergence || state?.procedure_divergence || 'unknown'
  const evidenceIntegrity = result?.evidence_integrity || state?.evidence_integrity || 'unknown'
  const userReapprovalRequired =
    result?.user_reapproval_required ?? state?.user_reapproval_required ?? false
  const candidateIdentity = candidateReceipt?.identity || null
  const reviewedCandidateIdentity = state?.candidate_receipt_identity || null
  const candidateIdentityMatches =
    candidateIdentity && reviewedCandidateIdentity
      ? candidateIdentity === reviewedCandidateIdentity &&
        candidateReceipt?.completeness === 'complete'
      : null
  const taxonomySource = result?.taxonomy_source || state?.taxonomy_source || 'structured'
  if (status !== 'approved' || verdict !== 'approved' || divergence === 'unknown') {
    issues.push('review_evidence_incomplete')
  }
  if (
    taxonomySource !== 'legacy_projection' &&
    (scopeDivergence === 'material' ||
      userReapprovalRequired ||
      !['complete', 'unknown'].includes(evidenceIntegrity))
  ) {
    issues.push('review_transition_unsafe')
  }
  if (candidateIdentityMatches === false) issues.push('reviewed_candidate_identity_changed')
  return {
    status,
    verdict,
    disposition,
    divergence,
    scope_divergence: scopeDivergence,
    procedure_divergence: procedureDivergence,
    evidence_integrity: evidenceIntegrity,
    user_reapproval_required: Boolean(userReapprovalRequired),
    candidate_identity: candidateIdentity,
    candidate_identity_matches: candidateIdentityMatches,
    taxonomy_source: taxonomySource,
  }
}

export function summarizeRisks(outcome, issues) {
  const canonical =
    /^##\s+Unresolved risks\s*$([\s\S]*?)(?=^##\s+|^\|\s*Acceptance\s*\|\s*Evidence\s*\|\s*Result\s*\||(?![\s\S]))/im.exec(
      outcome
    )
  const legacy = canonical ? null : /^Unresolved risks:\s*(.+)$/im.exec(outcome)
  const match = canonical || legacy
  if (!match) {
    issues.push('unresolved_risks_missing')
    return { status: 'missing', items: [], source: 'missing' }
  }
  const text = match[1].trim()
  const source = canonical ? 'canonical_section' : 'legacy_inline'
  if (!text || /^(?:none|none blocking)[.!]?$/i.test(text)) {
    return { status: 'none', items: [], source }
  }
  const candidates = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean)
  const items = candidates.slice(0, RECEIPT_LIMITS.items).map(boundedText)
  if (candidates.length > RECEIPT_LIMITS.items) issues.push('unresolved_risks_truncated')
  return { status: 'present', items, source }
}

function groupProjectPaths(paths) {
  const grouped = new Map()
  for (const path of [...new Set(paths)].sort()) {
    const name = path.includes('/') ? path.split('/')[0] : '(root)'
    if (!grouped.has(name)) grouped.set(name, [])
    grouped.get(name).push(path)
  }
  const entries = [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right))
  const displayed = entries.slice(0, RECEIPT_LIMITS.groups)
  let remainingPathBudget = RECEIPT_LIMITS.items
  const groups = displayed.map(([name, values], index) => {
    const remainingGroups = displayed.length - index - 1
    const previewCount = Math.min(values.length, remainingPathBudget - remainingGroups)
    remainingPathBudget -= previewCount
    return {
      name: boundedText(name),
      count: values.length,
      paths: values.slice(0, previewCount).map(boundedText),
      omitted: Math.max(0, values.length - previewCount),
    }
  })
  return {
    count: paths.length,
    groups,
    omitted_groups: Math.max(0, entries.length - groups.length),
  }
}

function countStatuses(items, statuses) {
  return Object.fromEntries(
    statuses.map((status) => [
      status,
      items.filter((item) => item.result === status || item.status === status).length,
    ])
  )
}

function boundedText(value) {
  const text = String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length <= RECEIPT_LIMITS.text
    ? text
    : `${text.slice(0, RECEIPT_LIMITS.text - 3).trimEnd()}...`
}

async function productWorkingTreeDigest(targetDir) {
  const paths = (await gitStatusPaths(targetDir))
    .filter((path) => path !== '.specdev' && !path.startsWith('.specdev/'))
    .sort()
  const hash = createHash('sha256')
  for (const path of paths) {
    hash.update('\0path\0')
    hash.update(path)
    const absolutePath = join(targetDir, path)
    let stat
    try {
      stat = await fse.lstat(absolutePath)
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      hash.update('\0deleted\0')
      continue
    }
    if (stat.isSymbolicLink()) {
      hash.update('\0symlink\0')
      hash.update(await fse.readlink(absolutePath))
    } else if (stat.isFile()) {
      hash.update(`\0file:${stat.mode & 0o111}\0`)
      hash.update(await fse.readFile(absolutePath))
    } else {
      hash.update(`\0other:${stat.mode}\0`)
    }
  }
  return hash.digest('hex')
}

export async function findPendingStandaloneAssignmentDelivery(targetDir, specdevPath) {
  const root = join(specdevPath, 'assignments')
  if (!(await fse.pathExists(root))) return null
  const candidates = []
  for (const entry of await fse.readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const path = join(root, entry.name)
    const status = await fse.readJson(join(path, 'status.json')).catch(() => null)
    if (
      status?.status !== 'completed' ||
      status.mission ||
      !status.id ||
      !status.git_boundary?.starting_git_commit_hash
    ) {
      continue
    }
    if (
      !(await findCommitByTrailer(targetDir, 'SpecDev-Assignment', status.id, {
        revision: 'HEAD',
      }))
    ) {
      candidates.push({ path, status })
    }
  }
  if (candidates.length > 1) {
    throw new Error(
      `Multiple standalone Assignment deliveries need recovery: ${candidates.map((item) => item.status.id).join(', ')}`
    )
  }
  return candidates[0] || null
}
