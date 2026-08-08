import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import fse from 'fs-extra'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'
import {
  commitExactDelivery,
  concurrentCallablePathDetails,
  currentGitBranch,
  findCommitAddingPath,
  findCommitByTrailer,
  firstParent,
  gitChangedPathsAtCommit,
  gitCommitSubject,
  gitStatusEntries,
  gitStatusPaths,
  requireGitHead,
  summarizeGitPaths,
  synchronizeIndexPaths,
} from '../utils/git-delivery.js'
import { relativeToRepo } from '../utils/assignment-vnext.js'

export async function adhocCommand(positionalArgs = [], flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)
  const [subcommand, ...rest] = positionalArgs

  try {
    if (subcommand === 'start') return startAdhoc(targetDir, specdevPath, rest, flags)
    if (subcommand === 'verify') return verifyAdhoc(targetDir, specdevPath, rest, flags)
    if (subcommand === 'finish') return finishAdhoc(targetDir, specdevPath, flags)
    if (subcommand === 'status') return statusAdhoc(targetDir, specdevPath, flags)
    if (subcommand === 'show') return showAdhoc(targetDir, specdevPath, rest[0], flags)
    if (subcommand === 'cancel') return cancelAdhoc(specdevPath, flags)
    return fail(
      flags,
      'Usage: specdev adhoc start "<scope>" [--title="..."] [--adopt-dirty] | verify --label="..." [--annotation="..."] -- <command> | finish --outcome="..." [--verification="..."] | status | show <ID> | cancel'
    )
  } catch (error) {
    return fail(flags, error.message)
  }
}

async function startAdhoc(targetDir, specdevPath, scopeArgs, flags) {
  const scope = scopeArgs.join(' ').trim()
  if (!scope) return fail(flags, 'Adhoc scope is required')

  const active = await readActive(specdevPath)
  if (active) {
    return blocked(flags, {
      state: 'already_active',
      id: active.id,
      scope: active.scope,
      next_action: 'Finish or cancel the active Adhoc before starting another in this worktree.',
    })
  }

  const startingGitCommitHash = await requireGitHead(targetDir)
  const branch = await currentGitBranch(targetDir)
  const allEntries = await gitStatusEntries(targetDir)
  const allPaths = allEntries.map((entry) => entry.path)
  const rejectedPaths = flags['adopt-dirty']
    ? allPaths.flatMap((path) => {
        const rejection = concurrentCallablePathDetails(path)
        return rejection ? [rejection] : []
      })
    : []
  const decision = classifyWorktree(allPaths, {
    adoptedPaths: flags['adopt-dirty'] && rejectedPaths.length === 0 ? allPaths : [],
    phase: 'start',
  })
  if (decision.product_dirty.count > 0 && !flags['adopt-dirty']) {
    return blocked(flags, {
      state: 'dirty_worktree',
      worktree: { ...decision, decision: 'blocked' },
      working_tree: decision.product_dirty,
      interaction: {
        question: 'The worktree already has changes. Decide what they mean before Adhoc starts.',
        options: [
          {
            id: 'inspect',
            label: 'Stop and inspect',
            command: 'git status --short',
            recommended: true,
          },
          {
            id: 'checkpoint',
            label: 'Commit existing work separately, then rerun',
          },
          {
            id: 'adopt',
            label: 'Include every current change in this Adhoc',
            command: `specdev adhoc start ${shellQuote(scope)} --adopt-dirty`,
          },
        ],
      },
    })
  }
  if (rejectedPaths.length > 0) {
    return blocked(flags, {
      state: 'adoption_rejected',
      requested_paths: pathClassification(allPaths),
      rejected_paths: rejectedPaths,
      worktree: { ...decision, decision: 'blocked' },
      next_action:
        'Resolve every rejected callable-owned path, then inspect the complete dirty set and rerun --adopt-dirty. No Adhoc state was created.',
    })
  }

  const startedAt = new Date().toISOString()
  const id = createAdhocId(startedAt)
  const receiptRelative = `.specdev/adhoc/${startedAt.slice(0, 7)}/${id}_${slugify(scope)}.md`
  const state = {
    version: 2,
    id,
    scope,
    title: stringFlag(flags.title) || null,
    started_at: startedAt,
    starting_git_commit_hash: startingGitCommitHash,
    starting_branch: branch,
    starting_worktree: decision.product_dirty.count > 0 ? 'adopted' : 'clean',
    adopted_path_count: decision.adopted.count,
    adoption_manifest: {
      version: 1,
      starting_revision: startingGitCommitHash,
      paths: flags['adopt-dirty']
        ? allEntries.map(({ path, status, role }) => ({ path, status, role }))
        : [],
    },
    starting_worktree_decision: { ...decision, decision: 'allowed' },
    receipt: receiptRelative,
  }
  await writeActive(specdevPath, state)
  return emit(flags, {
    command: 'adhoc start',
    version: 1,
    status: 'started',
    id,
    scope,
    title: state.title,
    starting_worktree: state.starting_worktree,
    adopted_path_count: state.adopted_path_count,
    adoption_manifest: state.adoption_manifest,
    worktree: state.starting_worktree_decision,
    next_action:
      'Make the bounded change directly. Optionally capture commands with adhoc verify, then finish with an outcome and passing evidence or --verification.',
  })
}

async function verifyAdhoc(targetDir, specdevPath, commandArgs, flags) {
  const active = await readActive(specdevPath)
  if (!active) return fail(flags, 'No active Adhoc exists in this worktree')
  const label = stringFlag(flags.label)
  if (!label) return fail(flags, 'Adhoc verification requires --label="..."')
  if (commandArgs.length === 0) {
    return fail(flags, 'Adhoc verification requires a command after --')
  }

  const currentHead = await requireGitHead(targetDir)
  if (currentHead !== active.starting_git_commit_hash) {
    return blocked(flags, {
      state: 'head_changed',
      id: active.id,
      scope: active.scope,
      starting_git_commit_hash: active.starting_git_commit_hash,
      current_git_commit_hash: currentHead,
      next_action: 'Restore or resolve the Adhoc history boundary before recording verification.',
    })
  }

  const statusPaths = await gitStatusPaths(targetDir)
  const startedAt = new Date().toISOString()
  const started = Date.now()
  const execution = await executeVerification(commandArgs, targetDir)
  const completedAt = new Date().toISOString()
  const attempt = {
    version: 1,
    id: `V-${String((active.verification_attempts || []).length + 1).padStart(3, '0')}`,
    label,
    annotation: stringFlag(flags.annotation) || null,
    command: commandArgs.join(' '),
    argv: commandArgs,
    working_directory: targetDir,
    started_at: startedAt,
    completed_at: completedAt,
    duration_ms: Math.max(0, Date.now() - started),
    exit_status: execution.exitCode,
    status: execution.exitCode === 0 ? 'passed' : 'failed',
    tested_revision: statusPaths.length > 0 ? `working-tree@${currentHead}` : currentHead,
    output: execution.output,
  }
  active.verification_attempts = [...(active.verification_attempts || []), attempt]
  await writeActive(specdevPath, active)

  const payload = {
    command: 'adhoc verify',
    version: 1,
    status: attempt.status,
    id: active.id,
    verification: attempt,
    acceptance_evidence: currentAcceptanceEvidence(active.verification_attempts),
  }
  emit(flags, payload)
  if (attempt.status === 'failed') process.exitCode = 1
  return payload
}

async function finishAdhoc(targetDir, specdevPath, flags) {
  const active = await readActive(specdevPath)
  if (!active) return fail(flags, 'No active Adhoc exists in this worktree')

  const recoveredCommit = await findCommitByTrailer(targetDir, 'SpecDev-Adhoc', active.id, {
    revision: 'HEAD',
  })
  if (recoveredCommit) {
    const verification = await verifyDeliveryCommit(targetDir, active, recoveredCommit)
    if (!verification.valid) return blockedDelivery(flags, active, verification, true)
    await clearActive(specdevPath)
    return completedPayload(targetDir, active, recoveredCommit, flags, true, verification)
  }

  const currentHead = await requireGitHead(targetDir)
  if (currentHead !== active.starting_git_commit_hash) {
    return blocked(flags, {
      state: 'head_changed',
      id: active.id,
      scope: active.scope,
      starting_git_commit_hash: active.starting_git_commit_hash,
      current_git_commit_hash: currentHead,
      next_action:
        'Inspect the intervening commits. Cancel this Adhoc or restore its starting HEAD before finishing; SpecDev will not silently absorb a changed history boundary.',
    })
  }

  const outcome = stringFlag(flags.outcome)
  const verification = stringFlag(flags.verification)
  const attempts = active.verification_attempts || []
  const acceptanceEvidence = currentAcceptanceEvidence(attempts)
  const structuredVerificationPassed =
    acceptanceEvidence.length > 0 &&
    acceptanceEvidence.every((attempt) => attempt.status === 'passed')
  if (!outcome || (!verification && !structuredVerificationPassed)) {
    return fail(
      flags,
      'An --outcome="..." and either --verification="..." or current passing structured verification evidence are required'
    )
  }

  const manifest = exactAdoptionManifest(active)
  if (!manifest.valid) {
    return blocked(flags, {
      state: 'legacy_adoption_manifest_missing',
      id: active.id,
      scope: active.scope,
      rejected_paths: manifest.rejected_paths,
      next_action:
        'Cancel this legacy adopted Adhoc, inspect the still-dirty paths, and restart with --adopt-dirty to create exact authorization.',
    })
  }

  const currentEntries = (await gitStatusEntries(targetDir)).filter(
    (entry) => entry.path !== active.receipt
  )
  const currentPaths = currentEntries
    .map((entry) => entry.path)
    .filter((path) => !isProtectedAdhocPath(path))
  if (currentPaths.length === 0) {
    return blocked(flags, {
      state: 'no_changes',
      id: active.id,
      scope: active.scope,
      next_action: 'Make the bounded repository change, or cancel this empty Adhoc.',
    })
  }

  const missingAdoptedPaths = manifest.paths.filter((path) => !currentPaths.includes(path))
  if (missingAdoptedPaths.length > 0) {
    return blocked(flags, {
      state: 'adopted_paths_missing',
      id: active.id,
      scope: active.scope,
      rejected_paths: missingAdoptedPaths.map((path) => ({
        path,
        reason: 'required_adopted_path_has_no_precommit_delta',
        next_action:
          'Restore the adopted path delta or cancel and restart after explicitly resolving the changed authorization.',
      })),
      next_action:
        'Every adopted manifest path must be represented in the delivery commit; restore the missing deltas or cancel and restart.',
    })
  }

  const receiptPath = join(targetDir, active.receipt)
  active.outcome = outcome
  active.verification = verification || null
  active.completed_at = new Date().toISOString()
  active.acceptance_evidence = acceptanceEvidence
  active.delivery_candidate = {
    version: 1,
    starting_revision: active.starting_git_commit_hash,
    product_paths: [...new Set(currentPaths)].sort(),
    receipt_path: active.receipt,
  }
  await writeActive(specdevPath, active)
  await fse.ensureDir(dirname(receiptPath))
  await fse.writeFile(receiptPath, receiptMarkdown(active, preparingPathFacts(active)), 'utf-8')

  let delivery
  try {
    delivery = await commitExactDelivery(targetDir, {
      expectedHead: active.starting_git_commit_hash,
      paths: [...active.delivery_candidate.product_paths, active.receipt],
      subject:
        stringFlag(flags.message) ||
        `specdev(adhoc): ${readableSubject(active.title || active.scope, 68)}`,
      trailers: {
        'SpecDev-Adhoc': active.id,
        'SpecDev-Commit-Type': 'delivery',
      },
      finalizeDraft: async ({ committedPaths }) => {
        const facts = {
          requested: manifest.paths,
          committed: committedPaths,
          rejected: [],
          remaining: [],
        }
        await fse.writeFile(receiptPath, receiptMarkdown(active, facts), 'utf-8')
      },
    })
  } catch (error) {
    return blocked(flags, {
      state: error.code === 'exact_path_mismatch' ? 'staged_path_mismatch' : 'delivery_failed',
      id: active.id,
      scope: active.scope,
      rejected_paths: [
        ...(error.missingPaths || []).map((path) => ({
          path,
          reason: 'missing_from_staged_candidate',
          next_action: 'Restore the required path delta and retry finish.',
        })),
        ...(error.unexpectedPaths || []).map((path) => ({
          path,
          reason: 'unauthorized_staged_path',
          next_action: 'Remove or separately checkpoint the unauthorized path and retry finish.',
        })),
      ],
      error: error.message,
      next_action:
        'The Adhoc remains active and the caller index was not changed. Resolve the reported path or Git failure, then retry finish.',
    })
  }
  const endingGitCommitHash = delivery.commit
  const deliveryVerification = await verifyDeliveryCommit(targetDir, active, endingGitCommitHash)
  if (!deliveryVerification.valid)
    return blockedDelivery(flags, active, deliveryVerification, false)
  await clearActive(specdevPath)
  return completedPayload(
    targetDir,
    active,
    endingGitCommitHash,
    flags,
    false,
    deliveryVerification
  )
}

async function statusAdhoc(targetDir, specdevPath, flags) {
  const active = await readActive(specdevPath)
  if (!active) return emit(flags, { command: 'adhoc status', version: 1, status: 'idle' })
  const currentHead = await requireGitHead(targetDir)
  return emit(flags, {
    command: 'adhoc status',
    version: 1,
    status: currentHead === active.starting_git_commit_hash ? 'active' : 'blocked',
    state: currentHead === active.starting_git_commit_hash ? 'working' : 'head_changed',
    id: active.id,
    scope: active.scope,
    starting_worktree: active.starting_worktree,
    adoption_manifest: active.adoption_manifest || null,
    changed_paths: summarizeGitPaths(await gitStatusPaths(targetDir)),
  })
}

async function showAdhoc(targetDir, specdevPath, id, flags) {
  if (!id) return fail(flags, 'Usage: specdev adhoc show <ID>')
  const receiptPath = await findReceipt(specdevPath, id)
  if (!receiptPath) return fail(flags, `Adhoc receipt not found: ${id}`)
  const receiptRelative = relativeToRepo(targetDir, receiptPath)
  const endingGitCommitHash =
    (await findCommitByTrailer(targetDir, 'SpecDev-Adhoc', id)) ||
    (await findCommitAddingPath(targetDir, receiptRelative))
  const startingGitCommitHash = endingGitCommitHash
    ? await firstParent(targetDir, endingGitCommitHash)
    : null
  return emit(flags, {
    command: 'adhoc show',
    version: 1,
    status: endingGitCommitHash ? 'completed' : 'receipt_uncommitted',
    id,
    receipt: receiptRelative,
    starting_git_commit_hash: startingGitCommitHash,
    ending_git_commit_hash: endingGitCommitHash,
  })
}

async function cancelAdhoc(specdevPath, flags) {
  const active = await readActive(specdevPath)
  if (!active) return emit(flags, { command: 'adhoc cancel', version: 1, status: 'idle' })
  await clearActive(specdevPath)
  return emit(flags, {
    command: 'adhoc cancel',
    version: 1,
    status: 'cancelled',
    id: active.id,
    source_changes: 'left_untouched',
  })
}

async function completedPayload(
  targetDir,
  active,
  endingGitCommitHash,
  flags,
  recovered,
  deliveryVerification = null
) {
  const verification =
    deliveryVerification || (await verifyDeliveryCommit(targetDir, active, endingGitCommitHash))
  const startingGitCommitHash = verification.starting_git_commit_hash
  const committedPaths = verification.path_facts.committed
  const remainingPaths = verification.remaining_paths
  const worktree = classifyWorktree(remainingPaths, { phase: 'finish' })
  const verificationAttempts = active.verification_attempts || []
  return emit(flags, {
    command: 'adhoc finish',
    version: 1,
    status: 'completed',
    id: active.id,
    scope: active.scope,
    receipt: active.receipt,
    delivery_commit: endingGitCommitHash,
    delivery_subject: await gitCommitSubject(targetDir, endingGitCommitHash),
    committed_paths: {
      product: committedPaths.filter((path) => path !== active.receipt),
      receipt: committedPaths.filter((path) => path === active.receipt),
    },
    path_facts: verification.path_facts,
    verification: {
      manual: active.verification || null,
      attempts: verificationAttempts,
      acceptance_evidence: currentAcceptanceEvidence(verificationAttempts),
    },
    start_worktree: active.starting_worktree_decision || null,
    starting_git_commit_hash: startingGitCommitHash,
    ending_git_commit_hash: endingGitCommitHash,
    remaining_worktree: worktree,
    product_worktree_clean: worktree.product_dirty.count === 0,
    recovered,
  })
}

async function verifyDeliveryCommit(targetDir, active, endingGitCommitHash) {
  const manifest = exactAdoptionManifest(active)
  if (!manifest.valid) {
    return {
      valid: false,
      state: 'legacy_adoption_manifest_missing',
      issues: manifest.rejected_paths,
      path_facts: {
        requested: [],
        committed: [],
        rejected: manifest.rejected_paths,
        remaining: [],
      },
      remaining_paths: await gitStatusPaths(targetDir),
      next_action:
        'Do not clear this legacy adopted Adhoc automatically; inspect the delivery boundary and resolve it explicitly.',
    }
  }

  const startingGitCommitHash = await firstParent(targetDir, endingGitCommitHash)
  const currentHead = await requireGitHead(targetDir)
  const committedPaths = await gitChangedPathsAtCommit(targetDir, endingGitCommitHash)
  const expectedPaths = active.delivery_candidate
    ? [
        ...(active.delivery_candidate.product_paths || []),
        active.delivery_candidate.receipt_path || active.receipt,
      ]
    : committedPaths
  const expected = [...new Set(expectedPaths)].sort()
  const committed = [...new Set(committedPaths)].sort()
  const issues = []
  if (currentHead !== endingGitCommitHash) {
    issues.push({
      path: '(current HEAD)',
      reason: 'delivery_commit_is_not_head',
      expected: endingGitCommitHash,
      actual: currentHead,
      next_action: 'Resolve the intervening history before retrying recovered completion.',
    })
  }
  if (startingGitCommitHash !== active.starting_git_commit_hash) {
    issues.push({
      path: '(delivery parent)',
      reason: 'delivery_parent_mismatch',
      expected: active.starting_git_commit_hash,
      actual: startingGitCommitHash,
      next_action: 'Inspect and restore the authorized Adhoc history boundary before retrying.',
    })
  }
  for (const path of expected.filter((path) => !committed.includes(path))) {
    issues.push({
      path,
      reason: 'authorized_candidate_missing_from_commit',
      next_action: 'Restore the authorized delivery boundary before retrying completion.',
    })
  }
  for (const path of committed.filter((path) => !expected.includes(path))) {
    issues.push({
      path,
      reason: 'unauthorized_path_in_commit',
      next_action:
        'Inspect and restore the delivery commit; this path was not in the durable candidate.',
    })
  }
  for (const path of manifest.paths.filter((path) => !committed.includes(path))) {
    if (issues.some((issue) => issue.path === path)) continue
    issues.push({
      path,
      reason: 'adopted_path_missing_from_commit',
      next_action: 'Restore the adopted path to the delivery commit before retrying completion.',
    })
  }
  for (const path of committed) {
    const protectedPath = concurrentCallablePathDetails(path)
    if (protectedPath) issues.push(protectedPath)
  }
  if (!committed.includes(active.receipt)) {
    issues.push({
      path: active.receipt,
      reason: 'receipt_missing_from_commit',
      next_action: 'Restore the commit-derived receipt to the delivery commit before retrying.',
    })
  }

  if (issues.length > 0) {
    return {
      valid: false,
      state: 'delivery_commit_invalid',
      issues,
      starting_git_commit_hash: startingGitCommitHash,
      ending_git_commit_hash: endingGitCommitHash,
      path_facts: {
        requested: manifest.paths,
        committed,
        rejected: issues,
        remaining: [],
      },
      remaining_paths: await gitStatusPaths(targetDir),
      next_action:
        'The Adhoc remains active. Inspect or restore the delivery commit and retry finish; SpecDev will not clear state from ambiguous Git facts.',
    }
  }

  await synchronizeIndexPaths(targetDir, committed, endingGitCommitHash)
  const remainingPaths = await gitStatusPaths(targetDir)
  const remainingOwnedPaths = remainingPaths.filter(
    (path) => path !== active.receipt && !isProtectedAdhocPath(path)
  )
  const remainingIssues = remainingOwnedPaths.map((path) => ({
    path,
    reason: manifest.paths.includes(path)
      ? 'adopted_delta_remains_after_commit'
      : 'adhoc_owned_delta_remains_after_commit',
    next_action: 'Resolve the remaining owned delta, then retry finish to revalidate completion.',
  }))
  return {
    valid: remainingIssues.length === 0,
    state: remainingIssues.length === 0 ? 'verified' : 'remaining_owned_delta',
    issues: remainingIssues,
    starting_git_commit_hash: startingGitCommitHash,
    ending_git_commit_hash: endingGitCommitHash,
    path_facts: {
      requested: manifest.paths,
      committed,
      rejected: remainingIssues,
      remaining: remainingOwnedPaths,
    },
    remaining_paths: remainingPaths,
    next_action:
      remainingIssues.length === 0
        ? null
        : 'The delivery commit exists, but owned worktree deltas remain. Resolve them and retry finish; active state was preserved.',
  }
}

function blockedDelivery(flags, active, verification, recovered) {
  return blocked(flags, {
    state: verification.state,
    id: active.id,
    scope: active.scope,
    delivery_commit: verification.ending_git_commit_hash || null,
    recovered,
    path_facts: verification.path_facts,
    rejected_paths: verification.issues,
    next_action: verification.next_action,
  })
}

function exactAdoptionManifest(active) {
  const manifest = active.adoption_manifest
  if (manifest?.version === 1 && manifest.starting_revision === active.starting_git_commit_hash) {
    const entries = Array.isArray(manifest.paths) ? manifest.paths : []
    const paths = [...new Set(entries.map((entry) => entry?.path).filter(Boolean))].sort()
    return { valid: true, entries, paths }
  }
  if (active.starting_worktree !== 'adopted') return { valid: true, entries: [], paths: [] }
  return {
    valid: false,
    rejected_paths: [
      {
        path: '(legacy adoption authorization)',
        reason: 'exact_manifest_unavailable',
        next_action:
          'Cancel and restart with --adopt-dirty after inspecting the exact current path set.',
      },
    ],
  }
}

function preparingPathFacts(active) {
  const manifest = exactAdoptionManifest(active)
  return {
    requested: manifest.valid ? manifest.paths : [],
    committed: [],
    rejected: [],
    remaining: active.delivery_candidate?.product_paths || [],
  }
}

function receiptMarkdown(active, pathFacts) {
  const starting =
    active.starting_worktree === 'clean'
      ? 'Clean.'
      : `Existing changes adopted with user approval (${active.adopted_path_count} paths).`
  const history = active.verification_attempts || []
  const evidence = active.acceptance_evidence || currentAcceptanceEvidence(history)
  const historyLines = history.length
    ? history.map((attempt) => formatVerificationAttempt(attempt, true)).join('\n')
    : 'No structured verification attempts were recorded.'
  const evidenceLines = evidence.length
    ? evidence.map(formatVerificationAttempt).join('\n')
    : 'No structured acceptance evidence was recorded.'
  const manual = active.verification || 'No manual verification summary was supplied.'
  const structured = JSON.stringify(
    {
      version: 1,
      path_facts: pathFacts,
      attempt_history: history,
      acceptance_evidence: evidence,
    },
    null,
    2
  )
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n')
  return `# Adhoc ${active.id}\n\n- Scope: ${active.scope}\n- Title: ${active.title || 'Derived from full scope'}\n- Started: ${active.started_at}\n- Completed: ${active.completed_at}\n- Starting working tree: ${starting}\n\n## Outcome\n\n${active.outcome}\n\n## Delivery path facts\n\n### Requested adopted paths\n\n${formatReceiptPaths(pathFacts.requested)}\n\n### Committed paths\n\n${formatReceiptPaths(pathFacts.committed)}\n\n### Rejected paths\n\n${formatReceiptRejections(pathFacts.rejected)}\n\n### Remaining owned paths\n\n${formatReceiptPaths(pathFacts.remaining)}\n\n## Verification summary\n\n${manual}\n\n## Verification attempt history\n\n${historyLines}\n\n## Current acceptance evidence\n\n${evidenceLines}\n\n## Structured verification\n\n${structured}\n`
}

function formatReceiptPaths(paths = []) {
  return paths.length > 0 ? paths.map((path) => `- \`${path}\``).join('\n') : 'None.'
}

function formatReceiptRejections(rejections = []) {
  return rejections.length > 0
    ? rejections
        .map((item) => `- \`${item.path}\` — ${item.reason}${item.owner ? ` (${item.owner})` : ''}`)
        .join('\n')
    : 'None.'
}

async function findReceipt(specdevPath, id) {
  const root = join(specdevPath, 'adhoc')
  if (!(await fse.pathExists(root))) return null
  for (const month of await fse.readdir(root, { withFileTypes: true })) {
    if (!month.isDirectory()) continue
    const monthPath = join(root, month.name)
    const match = (await fse.readdir(monthPath, { withFileTypes: true })).find(
      (entry) => entry.isFile() && entry.name.startsWith(`${id}_`) && entry.name.endsWith('.md')
    )
    if (match) return join(monthPath, match.name)
  }
  return null
}

function activePath(specdevPath) {
  return join(specdevPath, 'cache', 'adhoc.json')
}

async function readActive(specdevPath) {
  const path = activePath(specdevPath)
  return (await fse.pathExists(path)) ? fse.readJson(path) : null
}

async function writeActive(specdevPath, value) {
  const path = activePath(specdevPath)
  const temporary = `${path}.tmp-${process.pid}`
  await fse.ensureDir(dirname(path))
  await fse.writeJson(temporary, value, { spaces: 2 })
  await fse.move(temporary, path, { overwrite: true })
}

async function clearActive(specdevPath) {
  await fse.remove(activePath(specdevPath))
}

function createAdhocId(timestamp) {
  const compact = timestamp.replace(/[-:.]/g, '')
  return `AH-${compact}-${randomBytes(2).toString('hex')}`
}

function slugify(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'change'
  )
}

function stringFlag(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`
}

function classifyWorktree(paths, { adoptedPaths = [], phase } = {}) {
  const workflowPaths = paths.filter(isProtectedAdhocPath)
  const productPaths = paths.filter((path) => !isProtectedAdhocPath(path))
  return {
    version: 1,
    phase,
    product_dirty: pathClassification(productPaths),
    preserved_workflow_state: pathClassification(workflowPaths),
    adopted: pathClassification(adoptedPaths),
    applied_policy: 'preserve_concurrent_discussion_and_test_audit_state',
    decision: productPaths.length > 0 && adoptedPaths.length === 0 ? 'blocked' : 'allowed',
  }
}

function isProtectedAdhocPath(path) {
  return Boolean(concurrentCallablePathDetails(path))
}

function pathClassification(paths) {
  return { ...summarizeGitPaths(paths), paths: [...new Set(paths)].sort() }
}

function currentAcceptanceEvidence(attempts = []) {
  const latestByLabel = new Map()
  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    const attempt = attempts[index]
    if (!latestByLabel.has(attempt.label)) latestByLabel.set(attempt.label, attempt)
  }
  return [...latestByLabel.values()].reverse()
}

function formatVerificationAttempt(attempt, includeResult = false) {
  const annotation = attempt.annotation ? ` — ${attempt.annotation}` : ''
  const summary = `- **${attempt.label}: ${attempt.status}.** \`${attempt.command}\` (${attempt.duration_ms} ms, ${attempt.tested_revision})${annotation}`
  if (!includeResult) return summary
  const output = String(attempt.output?.text || '(no output)')
    .slice(-2048)
    .split(/\r?\n/)
    .map((line) => `    ${line}`)
    .join('\n')
  return `${summary}\n  - Working directory: \`${attempt.working_directory}\`\n  - Exit status: ${attempt.exit_status}\n  - Output${attempt.output?.truncated ? ' (bounded tail)' : ''}:\n\n${output}`
}

async function executeVerification(argv, targetDir) {
  const outputLimit = 16 * 1024
  return new Promise((resolve) => {
    const child = spawn(argv[0], argv.slice(1), {
      cwd: targetDir,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let text = ''
    let totalBytes = 0
    const capture = (source, chunk) => {
      const value = chunk.toString('utf8')
      totalBytes += Buffer.byteLength(value)
      text += `${source}: ${value}`
      if (Buffer.byteLength(text) > outputLimit) {
        text = Buffer.from(text).subarray(-outputLimit).toString('utf8')
      }
    }
    child.stdout.on('data', (chunk) => capture('stdout', chunk))
    child.stderr.on('data', (chunk) => capture('stderr', chunk))
    child.on('error', (error) => {
      capture('error', Buffer.from(error.message))
      resolve({
        exitCode: typeof error.errno === 'number' ? error.errno : 127,
        output: {
          text: text.trim(),
          truncated: totalBytes > outputLimit,
          captured_bytes: totalBytes,
        },
      })
    })
    child.on('close', (code) => {
      resolve({
        exitCode: Number.isInteger(code) ? code : 1,
        output: {
          text: text.trim(),
          truncated: totalBytes > outputLimit,
          captured_bytes: totalBytes,
        },
      })
    })
  })
}

function readableSubject(value, limit) {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (normalized.length <= limit) return normalized

  const window = normalized.slice(0, limit + 1)
  const minimumBoundary = Math.floor(limit * 0.45)
  const clauseMatches = [...window.matchAll(/[,;:!?]|\s[-–—]\s/g)]
    .map((match) => match.index)
    .filter((index) => index >= minimumBoundary && index <= limit)
  const space = window.lastIndexOf(' ', limit)
  const boundary = clauseMatches.at(-1) ?? space
  let subject = window.slice(0, boundary > 0 ? boundary : limit).replace(/[\s,;:!?–—-]+$/g, '')
  const weakEnding =
    /\s+(?:a|an|and|as|at|by|for|from|in|into|of|on|or|the|to|using|while|with|without)$/i
  while (weakEnding.test(subject)) subject = subject.replace(weakEnding, '')
  return subject || normalized.slice(0, limit).trimEnd()
}

function emit(flags, payload) {
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else {
    const label = payload.id ? ` ${payload.id}` : ''
    console.log(`Adhoc${label}: ${payload.status}`)
    if (payload.scope) console.log(`Scope: ${payload.scope}`)
    if (payload.title) console.log(`Title: ${payload.title}`)
    if (payload.worktree) printWorktree(payload.worktree)
    if (payload.adoption_manifest) printAdoptionManifest(payload.adoption_manifest)
    if (payload.start_worktree) printWorktree(payload.start_worktree, 'Starting')
    if (payload.receipt) console.log(`Receipt: ${payload.receipt}`)
    if (payload.delivery_commit) console.log(`Delivery commit: ${payload.delivery_commit}`)
    if (payload.delivery_subject) console.log(`Delivery subject: ${payload.delivery_subject}`)
    if (payload.committed_paths) {
      printPaths('Committed product paths', payload.committed_paths.product)
      printPaths('Committed receipt paths', payload.committed_paths.receipt)
    }
    if (payload.verification?.label) {
      console.log(`Verification ${payload.verification.label}: ${payload.verification.status}`)
    } else if (payload.verification?.acceptance_evidence) {
      for (const attempt of payload.verification.acceptance_evidence) {
        console.log(`Verification ${attempt.label}: ${attempt.status}`)
      }
    }
    if (payload.starting_git_commit_hash)
      console.log(`Starting Git commit: ${payload.starting_git_commit_hash}`)
    if (payload.ending_git_commit_hash)
      console.log(`Ending Git commit: ${payload.ending_git_commit_hash}`)
    if (payload.remaining_worktree) printWorktree(payload.remaining_worktree, 'Remaining')
    if (payload.path_facts) printPathFacts(payload.path_facts)
    if (typeof payload.product_worktree_clean === 'boolean')
      console.log(`Product worktree clean: ${payload.product_worktree_clean ? 'yes' : 'no'}`)
    if (payload.next_action) console.log(`Next: ${payload.next_action}`)
  }
  return payload
}

function blocked(flags, details) {
  const payload = { command: 'adhoc', version: 1, status: 'blocked', ...details }
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else {
    console.error(`Adhoc blocked: ${details.state}`)
    if (details.working_tree) {
      console.error(`Existing paths: ${details.working_tree.count}`)
      for (const path of details.working_tree.preview) console.error(`  - ${path}`)
      if (details.working_tree.omitted)
        console.error(`  - +${details.working_tree.omitted} more path(s)`)
    }
    if (details.worktree) printWorktree(details.worktree, 'Worktree', console.error)
    if (details.rejected_paths?.length) {
      console.error('Rejected paths:')
      for (const rejection of details.rejected_paths) {
        console.error(`  - ${rejection.path}: ${rejection.reason}`)
        if (rejection.owner) console.error(`    Owner: ${rejection.owner}`)
        if (rejection.next_action) console.error(`    Next: ${rejection.next_action}`)
      }
    }
    if (details.error) console.error(`Error: ${details.error}`)
    if (details.next_action) console.error(`Next: ${details.next_action}`)
  }
  process.exitCode = 1
  return payload
}

function printWorktree(worktree, prefix = 'Worktree', write = console.log) {
  write(`${prefix} product paths: ${worktree.product_dirty.count}`)
  printPaths(`${prefix} product`, worktree.product_dirty.paths, write)
  write(
    `${prefix} independent workflow paths: ${worktree.preserved_workflow_state.count} (preserved)`
  )
  printPaths(`${prefix} independent workflow`, worktree.preserved_workflow_state.paths, write)
  write(`${prefix} adopted paths: ${worktree.adopted.count}`)
  printPaths(`${prefix} adopted`, worktree.adopted.paths, write)
  write(`${prefix} policy: ${worktree.applied_policy}`)
  write(`${prefix} decision: ${worktree.decision}`)
}

function printPaths(label, paths = [], write = console.log) {
  if (paths.length === 0) return
  write(`${label}:`)
  for (const path of paths.slice(0, 12)) write(`  - ${path}`)
  if (paths.length > 12) write(`  - +${paths.length - 12} more path(s)`)
}

function printAdoptionManifest(manifest, write = console.log) {
  write(`Adoption manifest v${manifest.version}: ${manifest.paths.length} path(s)`)
  for (const entry of manifest.paths.slice(0, 12)) {
    write(`  - ${entry.status} ${entry.path}`)
  }
  if (manifest.paths.length > 12) write(`  - +${manifest.paths.length - 12} more path(s)`)
}

function printPathFacts(facts, write = console.log) {
  printPaths('Requested adopted paths', facts.requested, write)
  printPaths('Actual committed paths', facts.committed, write)
  if (facts.rejected?.length) {
    write('Rejected paths:')
    for (const rejection of facts.rejected.slice(0, 12)) {
      write(`  - ${rejection.path}: ${rejection.reason}`)
    }
    if (facts.rejected.length > 12) write(`  - +${facts.rejected.length - 12} more path(s)`)
  }
  printPaths('Remaining owned paths', facts.remaining, write)
}

function fail(flags, message) {
  const payload = { command: 'adhoc', version: 1, status: 'error', error: message }
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else console.error(message)
  process.exitCode = 1
  return payload
}
