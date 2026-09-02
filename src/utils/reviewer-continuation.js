import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import fse from 'fs-extra'
import { gitStatusPaths } from './git-delivery.js'
import { reviewerSessionCapability } from './provider-adapters.js'

export const REVIEWER_CONTINUATION_LEASE_VERSION = 1
export const REVIEWER_CONTINUATION_TTL_MS = 24 * 60 * 60 * 1000

const MAX_CANDIDATE_PATHS = 100
const MAX_DELTA_ITEMS = 20

export async function createReviewerContinuationLease({
  targetDir,
  specdevPath,
  assignmentPath,
  assignmentId,
  profile,
  contractHash,
  candidateReceipt,
  findingsIdentity,
  sourceAttempt,
  round,
  providerSessionId,
  now = Date.now(),
}) {
  if (!reviewerSessionCapability({ profile, role: 'reviewer' }).supported) return null
  if (!validSessionId(providerSessionId)) return null
  const candidate = await captureCandidateSnapshot(targetDir, candidateReceipt)
  if (!candidate) return null
  const lease = {
    version: REVIEWER_CONTINUATION_LEASE_VERSION,
    one_use: true,
    assignment: {
      id: requiredText(assignmentId, 'assignment id'),
      folder: assignmentFolder(assignmentPath),
    },
    role: 'primary-reviewer',
    provider_session_id: providerSessionId.trim(),
    profile: frozenProfile(profile),
    permissions: frozenPermissions(profile),
    contract_hash: requiredHash(contractHash, 'contract hash'),
    cwd: await fse.realpath(targetDir),
    reviewed_candidate: candidate,
    findings_identity: requiredHash(findingsIdentity, 'findings identity'),
    source_attempt: requiredText(sourceAttempt, 'source Attempt'),
    round: positiveInteger(round, 'review round'),
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + REVIEWER_CONTINUATION_TTL_MS).toISOString(),
  }
  const path = reviewerContinuationLeasePath(specdevPath, assignmentPath)
  await writeJsonAtomic(path, lease)
  return { path, lease }
}

export async function preparePrimaryReviewerContinuation({
  targetDir,
  specdevPath,
  assignmentPath,
  assignmentId,
  profile,
  contractHash,
  candidateReceipt,
  reviewState,
  now = Date.now(),
}) {
  const sourceAttempt = nullableText(reviewState?.attempt)
  if (
    reviewState?.stage !== 'primary' ||
    reviewState?.status !== 'converging' ||
    reviewState?.primary_round !== 1 ||
    !sourceAttempt
  ) {
    await discardReviewerContinuationLease(specdevPath, assignmentPath)
    return { status: 'fresh', reason: 'not_immediate_repair_successor', sourceAttempt }
  }

  const claimed = await claimLease(specdevPath, assignmentPath)
  if (!claimed) return { status: 'fresh', reason: 'lease_missing', sourceAttempt }
  let lease
  try {
    lease = await fse.readJson(claimed)
  } catch {
    await fse.remove(claimed)
    return { status: 'fresh', reason: 'lease_invalid', sourceAttempt }
  }
  await fse.remove(claimed)

  const invalidReason = await leaseInvalidationReason({
    targetDir,
    assignmentPath,
    assignmentId,
    profile,
    contractHash,
    candidateReceipt,
    reviewState,
    lease,
    now,
  })
  if (invalidReason) {
    return {
      status: 'fresh',
      reason: invalidReason,
      sourceAttempt: nullableText(lease?.source_attempt) || sourceAttempt,
    }
  }

  const currentCandidate = await captureCandidateSnapshot(targetDir, candidateReceipt).catch(
    () => null
  )
  if (!currentCandidate) {
    return { status: 'fresh', reason: 'candidate_scope_unbounded', sourceAttempt }
  }
  const beforePaths = new Map(
    lease.reviewed_candidate.paths.map((entry) => [entry.path, entry.digest])
  )
  const addedPaths = currentCandidate.paths
    .map((entry) => entry.path)
    .filter((path) => !beforePaths.has(path))
  if (addedPaths.length > 0) {
    return { status: 'fresh', reason: 'unrelated_candidate_change', sourceAttempt }
  }

  const delta = buildCandidateDelta(lease.reviewed_candidate, currentCandidate)
  return {
    status: 'eligible',
    session: { mode: 'resume', id: lease.provider_session_id },
    sourceAttempt: lease.source_attempt,
    delta,
    prompt: renderContinuationDelta(lease, currentCandidate, delta),
  }
}

export async function discardReviewerContinuationLease(specdevPath, assignmentPath) {
  const path = reviewerContinuationLeasePath(specdevPath, assignmentPath)
  if (await fse.pathExists(path)) await fse.remove(path)
}

export function reviewerContinuationLeasePath(specdevPath, assignmentPath) {
  return join(
    specdevPath,
    'cache',
    'reviewer-continuations',
    `${assignmentFolder(assignmentPath)}.json`
  )
}

async function leaseInvalidationReason({
  targetDir,
  assignmentPath,
  assignmentId,
  profile,
  contractHash,
  candidateReceipt,
  reviewState,
  lease,
  now,
}) {
  if (!validLeaseShape(lease)) return 'lease_invalid'
  if (new Date(lease.expires_at).getTime() <= now) return 'lease_expired'
  if (lease.assignment.folder !== assignmentFolder(assignmentPath)) return 'assignment_mismatch'
  if (lease.assignment.id !== String(assignmentId)) return 'assignment_mismatch'
  if (lease.role !== 'primary-reviewer') return 'role_mismatch'
  if (!reviewerSessionCapability({ profile, role: 'reviewer' }).supported) {
    return 'provider_unsupported'
  }
  if (stableJson(lease.profile) !== stableJson(frozenProfile(profile))) return 'profile_mismatch'
  if (stableJson(lease.permissions) !== stableJson(frozenPermissions(profile))) {
    return 'permission_mismatch'
  }
  if (lease.contract_hash !== contractHash) return 'contract_mismatch'
  if (lease.cwd !== (await fse.realpath(targetDir))) return 'cwd_mismatch'
  if (lease.reviewed_candidate.identity !== reviewState.candidate_receipt_identity) {
    return 'candidate_baseline_mismatch'
  }
  if (lease.findings_identity !== reviewState.findings_digest) return 'findings_mismatch'
  if (lease.source_attempt !== reviewState.attempt) return 'source_attempt_mismatch'
  if (lease.round !== reviewState.primary_round) return 'round_mismatch'
  if (candidateReceipt?.completeness !== 'complete') return 'candidate_incomplete'
  if (candidateReceipt.identity === lease.reviewed_candidate.identity) return 'candidate_unchanged'
  return null
}

async function captureCandidateSnapshot(targetDir, candidateReceipt) {
  if (candidateReceipt?.completeness !== 'complete') return null
  const paths = (await gitStatusPaths(targetDir))
    .filter((path) => path !== '.specdev' && !path.startsWith('.specdev/'))
    .sort()
  if (paths.length > MAX_CANDIDATE_PATHS) return null
  const snapshots = []
  for (const path of paths) {
    snapshots.push({ path, digest: await pathDigest(targetDir, path) })
  }
  return {
    identity: requiredHash(candidateReceipt.identity, 'candidate identity'),
    paths: snapshots,
    verification: candidateReceipt.verification,
    artifact_digests: Object.fromEntries(
      Object.entries(candidateReceipt.artifacts || {}).map(([key, value]) => [key, value.digest])
    ),
  }
}

async function pathDigest(targetDir, path) {
  const absolute = join(targetDir, path)
  try {
    const stat = await fse.lstat(absolute)
    if (stat.isSymbolicLink()) {
      return digest(`symlink\0${await fse.readlink(absolute)}`)
    }
    if (stat.isFile()) return digest(await fse.readFile(absolute))
    return digest(`other\0${stat.mode}\0${stat.size}`)
  } catch (error) {
    if (error?.code === 'ENOENT') return digest('missing')
    throw error
  }
}

function buildCandidateDelta(before, after) {
  const beforePaths = new Map(before.paths.map((entry) => [entry.path, entry.digest]))
  const afterPaths = new Map(after.paths.map((entry) => [entry.path, entry.digest]))
  const pathChanges = []
  for (const [path, beforeDigest] of beforePaths) {
    const afterDigest = afterPaths.get(path)
    if (afterDigest === beforeDigest) continue
    pathChanges.push({ path, change: afterDigest ? 'modified' : 'no_longer_changed' })
  }
  const evidenceChanges = evidenceDelta(before.verification, after.verification)
  const artifactChanges = Object.keys({ ...before.artifact_digests, ...after.artifact_digests })
    .filter((key) => before.artifact_digests[key] !== after.artifact_digests[key])
    .slice(0, MAX_DELTA_ITEMS)
  return {
    previous_candidate_identity: before.identity,
    repaired_candidate_identity: after.identity,
    changed_paths: pathChanges.slice(0, MAX_DELTA_ITEMS),
    changed_paths_omitted: Math.max(0, pathChanges.length - MAX_DELTA_ITEMS),
    changed_verification: evidenceChanges.items,
    changed_verification_omitted: evidenceChanges.omitted,
    changed_artifacts: artifactChanges,
  }
}

function evidenceDelta(before = {}, after = {}) {
  const beforeItems = new Map(
    (before.items || []).map((item) => [verificationKey(item), stableJson(item)])
  )
  const afterItems = new Map((after.items || []).map((item) => [verificationKey(item), item]))
  const changes = []
  for (const [key, item] of afterItems) {
    if (beforeItems.get(key) === stableJson(item)) continue
    changes.push({
      command: item.command,
      role: item.role,
      status: item.status,
      revision: item.revision,
    })
  }
  for (const item of before.items || []) {
    if (!afterItems.has(verificationKey(item))) {
      changes.push({ command: item.command, role: item.role, status: 'removed', revision: null })
    }
  }
  return {
    items: changes.slice(0, MAX_DELTA_ITEMS),
    omitted: Math.max(0, changes.length - MAX_DELTA_ITEMS),
  }
}

function renderContinuationDelta(lease, currentCandidate, delta) {
  return [
    'Continue the exact primary-reviewer session only to verify the repaired candidate.',
    `Source review Attempt: ${lease.source_attempt}`,
    `Previous findings identity: ${lease.findings_identity}`,
    `Reviewed candidate: ${lease.reviewed_candidate.identity}`,
    `Repaired candidate: ${currentCandidate.identity}`,
    'Treat the approved contract, current candidate receipt, prior findings artifact, and current repository as authoritative; session memory is advisory.',
    'Re-check every prior finding and explicitly look for regressions introduced by the repair.',
    `Bounded reviewed-to-repaired delta:\n${JSON.stringify(delta, null, 2)}`,
  ].join('\n')
}

async function claimLease(specdevPath, assignmentPath) {
  const path = reviewerContinuationLeasePath(specdevPath, assignmentPath)
  if (!(await fse.pathExists(path))) return null
  const claim = `${path}.claim-${process.pid}-${Date.now()}`
  try {
    await fse.move(path, claim, { overwrite: false })
    return claim
  } catch {
    return null
  }
}

function validLeaseShape(lease) {
  return Boolean(
    lease &&
      lease.version === REVIEWER_CONTINUATION_LEASE_VERSION &&
      lease.one_use === true &&
      lease.assignment &&
      typeof lease.assignment.id === 'string' &&
      typeof lease.assignment.folder === 'string' &&
      lease.profile &&
      lease.permissions &&
      typeof lease.cwd === 'string' &&
      typeof lease.source_attempt === 'string' &&
      lease.reviewed_candidate &&
      /^[a-f0-9]{64}$/.test(String(lease.reviewed_candidate.identity || '')) &&
      Array.isArray(lease.reviewed_candidate.paths) &&
      lease.reviewed_candidate.paths.length <= MAX_CANDIDATE_PATHS &&
      lease.reviewed_candidate.paths.every(
        (entry) =>
          entry &&
          typeof entry.path === 'string' &&
          /^[a-f0-9]{64}$/.test(String(entry.digest || ''))
      ) &&
      validSessionId(lease.provider_session_id) &&
      /^[a-f0-9]{64}$/.test(String(lease.contract_hash || '')) &&
      /^[a-f0-9]{64}$/.test(String(lease.findings_identity || '')) &&
      Number.isSafeInteger(lease.round) &&
      lease.round > 0 &&
      Number.isFinite(new Date(lease.expires_at).getTime())
  )
}

function frozenProfile(profile = {}) {
  return {
    provider: nullableText(profile.provider),
    model: nullableText(profile.model),
    effort: nullableText(profile.effort),
    timeout_ms: Number(profile.timeout_ms),
    filesystem: nullableText(profile.filesystem),
    network: Boolean(profile.network),
  }
}

function frozenPermissions(profile = {}) {
  return { filesystem: nullableText(profile.filesystem), network: Boolean(profile.network) }
}

function assignmentFolder(path) {
  return requiredText(path?.split(/[/\\]/).pop(), 'assignment folder')
}

function verificationKey(item = {}) {
  return stableJson([item.role || null, item.command || null])
}

function stableJson(value) {
  if (Array.isArray(value)) return JSON.stringify(value.map(stableValue))
  return JSON.stringify(stableValue(value))
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)])
  )
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex')
}

function validSessionId(value) {
  return /^[A-Za-z0-9_-]{8,256}$/.test(String(value || '').trim())
}

function requiredHash(value, field) {
  const text = requiredText(value, field)
  if (!/^[a-f0-9]{64}$/.test(text)) throw new Error(`${field} must be a sha256 digest`)
  return text
}

function positiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${field} must be positive`)
  return value
}

function requiredText(value, field) {
  const text = String(value || '').trim()
  if (!text) throw new Error(`${field} is required`)
  return text
}

function nullableText(value) {
  const text = String(value ?? '').trim()
  return text || null
}

async function writeJsonAtomic(path, value) {
  await fse.ensureDir(dirname(path))
  const temporary = `${path}.tmp-${process.pid}`
  await fse.writeJson(temporary, value, { spaces: 2 })
  await fse.move(temporary, path, { overwrite: true })
}
