import {
  boundaryHash,
  terminal,
  readJson,
  fileDigest,
  lifecycleEvents,
} from '../utils/assignment-boundary.js'
import { execFileSync } from 'node:child_process'
import { join, relative, resolve } from 'node:path'
import fse from 'fs-extra'
import { readCheckpoint, readCurrent, recordSideChannelAction } from 'ripplegraph'
import { resolveAssignmentSelector } from '../utils/assignment.js'
import { readCurrentFocus } from '../utils/current.js'
import { validateAssignmentContract } from '../utils/assignment-vnext.js'
import { gitStatusEntries, concurrentCallablePathDetails } from '../utils/git-delivery.js'
import { listAttemptRecords, attemptLiveness } from '../utils/process-record.js'
import { discardReviewerContinuationLease } from '../utils/reviewer-continuation.js'

const git = (root, args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
const reviewFile = 'review/implementation-state.json'
export function assignmentBoundaryHelp() {
  console.log(`Usage: specdev assignment revalidate-boundary <id> [--assessment=<json>] [--confirm=<digest>]

Preview the intervening commits first. Supply an assessment JSON with contract
("compatible" or "changed"), reason, owned_paths (exact product paths), and
reuse_evidence (receipt indices, normally []). Reuse requires recorded input_digests
that still match. Missing proof requires fresh verification. Confirm the exact digest.
Changed scope requires checkpoint brainstorm and normal user approval afterward.
Recovery preserves original authority and work; it never bypasses required review.`)
}

export async function assignmentBoundaryCommand(root, specdev, args, flags = {}) {
  try {
    const resolved = await resolveAssignmentSelector(specdev, String(args[0] || ''))
    if (!resolved || resolved.ambiguous) throw new Error('Select one existing Assignment')
    const path = resolved.path
    let status = await fse.readJson(join(path, 'status.json'))
    const recovery = status.boundary_recovery
    if (flags.confirm && recovery?.digest === flags.confirm && recovery.phase === 'applied') {
      return emit(flags, {
        status: 'applied',
        digest: recovery.digest,
        next_action: nextAction(recovery),
      })
    }
    await assertQuiescent(root, specdev, resolved, status)
    if (recovery?.phase === 'pending') {
      if (flags.confirm !== recovery.digest)
        throw new Error('Boundary recovery is pending; retry its exact --confirm digest')
      const actual = await snapshot(root, specdev, resolved, recovery.original_status)
      // Review reset is the only candidate artifact changed by recovery itself.
      if (
        ![recovery.plan.snapshot.review, resetReview(recovery.digest)].some(
          (item) => boundaryHash(item) === boundaryHash(actual.review)
        )
      )
        throw new Error('Review state changed during boundary recovery')
      actual.review = recovery.plan.snapshot.review
      if (boundaryHash(actual) !== boundaryHash(recovery.plan.snapshot))
        throw new Error('Recovery inputs changed; restore the confirmed candidate before retrying')
      return emit(flags, await applyRecovery(root, specdev, resolved, status))
    }
    if (recovery?.requires_reapproval && !recovery.approval)
      throw new Error('Complete contract reapproval before another boundary recovery')
    const plan = await buildPlan(root, specdev, resolved, status, flags)
    if (!flags.confirm)
      return emit(flags, {
        status: 'awaiting_confirmation',
        plan,
        next_action: `Inspect the assessment, then rerun with --confirm=${plan.digest}`,
      })
    if (flags.confirm !== plan.digest) throw new Error('Stale boundary confirmation; preview again')
    if (!plan.assessment)
      throw new Error(
        'Supply --assessment with an explicit contract and evidence assessment before confirmation'
      )
    // Re-read immediately before preparing durable authority.
    if (
      boundaryHash(await snapshot(root, specdev, resolved, status)) !== boundaryHash(plan.snapshot)
    )
      throw new Error('Boundary inputs changed during confirmation; preview again')
    const originalStatus = { ...status }
    delete originalStatus.boundary_recovery
    status = await atomicJson(join(path, 'status.json'), {
      ...status,
      updated_at: new Date().toISOString(),
      boundary_recovery: {
        version: 1,
        phase: 'pending',
        digest: plan.digest,
        plan,
        original_status: originalStatus,
        requires_reapproval: plan.assessment.contract === 'changed',
      },
    })
    return emit(flags, await applyRecovery(root, specdev, resolved, status))
  } catch (error) {
    process.exitCode = 1
    return emit(flags, { status: 'blocked', error: error.message })
  }
}

async function assertQuiescent(root, specdev, resolved, status) {
  if (status.mission || terminal.has(status.status))
    throw new Error('Boundary recovery requires an unfinished standalone Assignment')
  if (await fse.pathExists(join(specdev, 'cache', 'adhoc.json')))
    throw new Error('Finish the active Adhoc before boundary recovery')
  if (!status.git_boundary?.starting_git_commit_hash)
    throw new Error('Assignment has no established implementation boundary')
  const checkpoint = readCheckpoint(specdev, status.run_id)
  const foreground = await readCurrentFocus(specdev)
  if (
    readCurrent(specdev).focusedRunId !== status.run_id ||
    foreground?.kind !== 'assignment' ||
    foreground.id !== status.id
  )
    throw new Error('Select and resume the owning Assignment before boundary recovery')
  if (
    checkpoint.status !== 'active' ||
    checkpoint.rootGraph !== 'assignment-lifecycle' ||
    checkpoint.stack.length ||
    !['design', 'implementation', 'implementation-review', 'repair'].includes(
      checkpoint.position.node
    )
  )
    throw new Error('Assignment is not at a supported quiescent implementation or review position')
  if (checkpoint.outputs['create-assignment']?.name !== resolved.name)
    throw new Error('Assignment runtime identity mismatch')
  for (const attempt of await listAttemptRecords(specdev)) {
    const live = await attemptLiveness(specdev, attempt.id)
    if (
      live.state === 'live_local' ||
      !['completed', 'failed', 'interrupted', 'blocked'].includes(attempt.status)
    )
      throw new Error(`Live or ambiguous activity prevents recovery: ${attempt.id}`)
  }
}

async function snapshot(root, specdev, resolved, originalStatus) {
  await assertQuiescent(root, specdev, resolved, originalStatus)
  const prefix = relative(root, resolved.path).replaceAll('\\', '/') + '/'
  const runPrefix = `.specdev/.ripplegraph/runs/${originalStatus.run_id}/`
  const entries = await gitStatusEntries(root)
  const status = await fse.readJson(join(resolved.path, 'status.json'))
  const pending = status.boundary_recovery?.phase === 'pending' ? status.boundary_recovery : null
  const ignored = new Set([
    prefix + 'status.json',
    prefix + 'status.json.tmp',
    prefix + reviewFile,
    prefix + reviewFile + '.tmp',
    runPrefix + 'transition-log.jsonl',
  ])
  const preparedPrefix = pending ? prefix + 'boundary-history/' + pending.digest : null
  const included = (path) =>
    !ignored.has(path) &&
    !(
      preparedPrefix &&
      (path === preparedPrefix + '.json' ||
        path === preparedPrefix + '.json.tmp' ||
        path.startsWith(preparedPrefix + '/'))
    )
  const paths = [
    ...new Set([
      ...git(root, ['ls-files', '-z', '--', prefix]).split('\0').filter(Boolean),
      ...entries.map((entry) => entry.path),
    ]),
  ]
    .filter(included)
    .sort()
  const files = []
  for (const path of paths) files.push({ path, digest: await fileDigest(root, path) })
  delete status.boundary_recovery
  delete status.updated_at
  const events = await lifecycleEvents(specdev, originalStatus.run_id)
  const reviewArtifacts = {}
  for (const name of ['review/implementation-verdict.md', 'review/candidate-receipt.json']) {
    const bytes = await fse.readFile(join(resolved.path, name)).catch((error) => {
      if (error.code === 'ENOENT') return null
      throw error
    })
    reviewArtifacts[name] = bytes?.toString('base64') ?? null
  }
  return {
    head: git(root, ['rev-parse', 'HEAD']).trim(),
    branch: git(root, ['branch', '--show-current']).trim(),
    checkpoint: readCheckpoint(specdev, originalStatus.run_id),
    status,
    files,
    dirty: entries.filter((entry) => included(entry.path)),
    index: boundaryHash(git(root, ['diff', '--cached', '--binary', '--no-ext-diff'])),
    transitions: events.filter(
      (event) =>
        !(
          pending &&
          event.output?.actionId === 'assignment-boundary' &&
          event.output?.output?.digest === pending.digest
        )
    ),
    review_artifacts: reviewArtifacts,
    review: await readJson(join(resolved.path, reviewFile)),
    attempts: await listAttemptRecords(specdev),
  }
}

async function buildPlan(root, specdev, resolved, status, flags) {
  const snap = await snapshot(root, specdev, resolved, status)
  const from = status.git_boundary.starting_git_commit_hash
  if (from === snap.head) throw new Error('HEAD already matches the effective Assignment boundary')
  try {
    git(root, ['merge-base', '--is-ancestor', from, snap.head])
  } catch {
    throw new Error(
      'HEAD does not descend from the effective boundary; resolve divergent history before recovery'
    )
  }
  if (!snap.branch) throw new Error('Recover on a named branch')
  const contract = await validateAssignmentContract(resolved.path)
  if (!contract.valid) throw new Error(`Invalid contract: ${contract.errors.join('; ')}`)
  const approval =
    status.boundary_recovery?.approval ||
    status.boundary_recovery?.plan.approved_contract ||
    snap.checkpoint.outputs['approve-contract']
  if (!approval?.approved) throw new Error('Assignment has no contract approval')
  const assessment = flags.assessment
    ? await fse.readJson(resolve(root, String(flags.assessment)))
    : null
  if (assessment) {
    if (
      !['compatible', 'changed'].includes(assessment.contract) ||
      !String(assessment.reason || '').trim() ||
      !Array.isArray(assessment.owned_paths) ||
      !Array.isArray(assessment.reuse_evidence)
    )
      throw new Error('Assessment requires contract, reason, owned_paths and reuse_evidence')
    if (assessment.contract === 'compatible' && contract.hash !== approval.contract_hash)
      throw new Error('Changed contract requires material-scope assessment and normal reapproval')
    for (const path of assessment.owned_paths) {
      if (
        typeof path !== 'string' ||
        path.startsWith('/') ||
        path.includes('\\') ||
        path.split('/').some((part) => !part || part === '.' || part === '..') ||
        path.startsWith('.specdev/')
      )
        throw new Error(`Invalid owned product path: ${path}`)
    }
    if (assessment.contract === 'changed' && assessment.reuse_evidence.length)
      throw new Error('Changed scope requires fresh acceptance evidence')
  }
  const receipts =
    (await readJson(join(resolved.path, 'implementation', 'progress.json')))?.verification || []
  for (const index of assessment?.reuse_evidence || []) {
    const receipt = receipts[index]
    if (
      !Number.isInteger(index) ||
      !receipt?.input_digests ||
      !Object.keys(receipt.input_digests).length
    )
      throw new Error(
        'Evidence reuse requires receipt input_digests; rerun evidence without input provenance'
      )
    for (const [path, digest] of Object.entries(receipt.input_digests)) {
      if ((await fileDigest(root, path)) !== digest)
        throw new Error(`Evidence input changed: ${path}`)
    }
  }
  const prefix = relative(root, resolved.path).replaceAll('\\', '/') + '/'
  const dirty = snap.dirty.map((entry) => ({
    ...entry,
    owner:
      entry.path.startsWith(prefix) || assessment?.owned_paths.includes(entry.path)
        ? status.id
        : concurrentCallablePathDetails(entry.path)?.owner || 'unrelated; excluded from delivery',
  }))
  const facts = {
    version: 1,
    assignment: status.id,
    run_id: status.run_id,
    original_boundary: status.git_boundary.original_git_commit_hash || from,
    effective_boundary: from,
    commits: git(root, ['log', '--format=%H %s', `${from}..${snap.head}`])
      .trim()
      .split('\n'),
    changed_paths: git(root, ['diff', '--name-only', '-z', from, snap.head])
      .split('\0')
      .filter(Boolean),
    approved_contract: approval,
    contract_hash: contract.hash,
    assessment,
    dirty,
    evidence: receipts.map((receipt, index) => ({
      index,
      digest: boundaryHash(receipt),
      action: assessment?.reuse_evidence.includes(index) ? 'reuse' : 'invalidate',
    })),
    snapshot: snap,
  }
  return { ...facts, digest: boundaryHash(facts) }
}

const resetReview = (digest) => ({
  version: 2,
  stage: 'primary',
  round: 0,
  primary_round: 0,
  history: [],
  boundary_digest: digest,
})
async function atomicJson(path, value) {
  await fse.outputJson(`${path}.tmp`, value, { spaces: 2 })
  await fse.move(`${path}.tmp`, path, { overwrite: true })
  return value
}
async function applyRecovery(root, specdev, resolved, status) {
  const recovery = status.boundary_recovery
  const { plan, digest } = recovery
  const { digest: ignored, ...facts } = plan
  if (boundaryHash(facts) !== digest) throw new Error('Invalid prepared recovery digest')
  const history = join(resolved.path, 'boundary-history', digest + '.json')
  await atomicJson(history, plan)
  for (const [name, bytes] of Object.entries(plan.snapshot.review_artifacts)) {
    if (bytes !== null)
      await fse.outputFile(
        join(resolved.path, 'boundary-history', digest, name),
        Buffer.from(bytes, 'base64')
      )
  }
  await discardReviewerContinuationLease(specdev, resolved.path)
  await atomicJson(join(resolved.path, reviewFile), resetReview(digest))
  let events = await lifecycleEvents(specdev, status.run_id)
  if (
    !events.some(
      (event) =>
        event.output?.actionId === 'assignment-boundary' && event.output?.output?.digest === digest
    )
  ) {
    recordSideChannelAction({
      workflowRoot: specdev,
      actionId: 'assignment-boundary',
      input: { confirmation: digest },
      output: { digest },
      note: 'User accepted intervening commits; contract and review obligations remain separate',
    })
    events = await lifecycleEvents(specdev, status.run_id)
  }
  const event = events.find(
    (item) =>
      item.output?.actionId === 'assignment-boundary' && item.output?.output?.digest === digest
  )
  await atomicJson(join(resolved.path, 'status.json'), {
    ...status,
    updated_at: new Date().toISOString(),
    git_boundary: {
      ...status.git_boundary,
      original_git_commit_hash: plan.original_boundary,
      starting_git_commit_hash: plan.snapshot.head,
    },
    boundary_recovery: { ...recovery, phase: 'applied', lifecycle_event: event },
  })
  return { status: 'applied', digest, next_action: nextAction(recovery) }
}
function nextAction(recovery) {
  return recovery.requires_reapproval && !recovery.approval
    ? 'specdev checkpoint brainstorm, then obtain user approval with specdev approve brainstorm'
    : 'Refresh invalidated evidence, then specdev implement; required independent review remains required'
}
function emit(flags, payload) {
  const result = { command: 'assignment revalidate-boundary', version: 1, ...payload }
  console.log(JSON.stringify(result, null, 2))
  return result
}
