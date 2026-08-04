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

const RECEIPT_LIMITS = Object.freeze({ items: 12, groups: 8, text: 240 })

export async function ensureAssignmentGitBoundary({
  targetDir,
  specdevPath,
  assignmentPath,
  assignmentStatus,
  adoptDirty = false,
}) {
  if (assignmentStatus?.mission) return { ok: true, skipped: 'mission_child' }

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
  await writeAssignmentStatus(assignmentPath, { git_boundary: boundary })
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
  const runtime = await compactCompletedWorkflowRuntime(specdevPath, {
    runId: status.run_id,
    attemptFilter: { assignment: name },
    terminalOwner: { assignment: name, status: status.status },
    focus: { kind: 'assignment', id: status.id },
  })
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
    if (!exists && !['review_verdict', 'review_state'].includes(key)) {
      issues.push(`missing_artifact:${key}`)
    }
  }

  const contract = await validateAssignmentContract(assignmentPath)
  if (!contract.valid) issues.push('invalid_contract')
  const progress = await readJsonIfPresent(artifactPaths.progress)
  const outcome = await readTextIfPresent(artifactPaths.outcome)
  const reviewState = await readJsonIfPresent(artifactPaths.review_state)
  const reviewResult = await readReviewResult(artifactPaths.review_verdict)
  const contractHashMatchesReview = Boolean(
    contract.hash && reviewState?.contract_hash && contract.hash === reviewState.contract_hash
  )
  if (!contractHashMatchesReview) issues.push('contract_review_identity_incomplete')

  const acceptance = summarizeAcceptance(contract.acceptanceIds || [], outcome, issues)
  const verification = summarizeVerification(progress?.verification, issues)
  const risks = summarizeRisks(outcome, issues)
  const review = summarizeReview(reviewState, reviewResult, issues)

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
  const worktreePaths = await gitStatusPaths(targetDir)
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
  const lines = [
    'Delivery receipt:',
    `  Evidence: ${receipt.completeness}`,
    `  Contract: ${receipt.contract.path} @ ${receipt.contract.hash || 'missing'}`,
    `  Review: ${receipt.review.verdict} (${receipt.review.disposition}; divergence: ${receipt.review.divergence})`,
    `  Delivery commit: ${receipt.delivery.commit || 'missing'}`,
    `  Acceptance: ${acceptance.passed} passed, ${acceptance.failed} failed, ${acceptance.blocked} blocked, ${acceptance.missing} missing`,
    `  Verification: ${verification.passed} passed, ${verification.failed} failed, ${verification.skipped} skipped, ${verification.missing} missing`,
    `  Changed project paths: ${receipt.changed_project_paths.count}`,
  ]
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

function summarizeVerification(receipts, issues) {
  if (!Array.isArray(receipts)) {
    issues.push('verification_evidence_missing')
    return {
      total: 0,
      items: [],
      omitted: 0,
      counts: { passed: 0, failed: 0, skipped: 0, missing: 1 },
    }
  }
  const items = receipts.slice(0, RECEIPT_LIMITS.items).map((receipt) => ({
    command: boundedText(receipt?.command || 'missing'),
    revision: boundedText(receipt?.revision || 'missing'),
    scope: boundedText(receipt?.scope || 'missing'),
    status: ['passed', 'failed', 'skipped'].includes(receipt?.status) ? receipt.status : 'missing',
    duration_ms: Number.isSafeInteger(receipt?.duration_ms) ? receipt.duration_ms : null,
  }))
  const counts = countStatuses(items, ['passed', 'failed', 'skipped', 'missing'])
  if (receipts.length > RECEIPT_LIMITS.items || counts.missing > 0) {
    issues.push('verification_evidence_incomplete')
  }
  if (counts.failed > 0 || counts.skipped > 0) issues.push('verification_not_passed')
  return {
    total: receipts.length,
    items,
    omitted: Math.max(0, receipts.length - items.length),
    counts,
  }
}

function summarizeReview(state, result, issues) {
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
  if (status !== 'approved' || verdict !== 'approved' || divergence === 'unknown') {
    issues.push('review_evidence_incomplete')
  }
  return { status, verdict, disposition, divergence }
}

function summarizeRisks(outcome, issues) {
  const match =
    /^##\s+Unresolved risks\s*$([\s\S]*?)(?=^##\s+|^\|\s*Acceptance\s*\|\s*Evidence\s*\|\s*Result\s*\||(?![\s\S]))/im.exec(
      outcome
    )
  if (!match) {
    issues.push('unresolved_risks_missing')
    return { status: 'missing', items: [] }
  }
  const text = match[1].trim()
  if (!text || /^(?:none|none\.)$/i.test(text)) return { status: 'none', items: [] }
  const candidates = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean)
  const items = candidates.slice(0, RECEIPT_LIMITS.items).map(boundedText)
  if (candidates.length > RECEIPT_LIMITS.items) issues.push('unresolved_risks_truncated')
  return { status: 'present', items }
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
