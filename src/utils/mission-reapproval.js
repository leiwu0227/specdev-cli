import { createHash } from 'node:crypto'
import { dirname, join, resolve, sep } from 'node:path'
import fse from 'fs-extra'
import { gitSnapshot, relativeToRepo, validateAssignmentContract } from './assignment-vnext.js'
import {
  buildStandaloneAssignmentCandidateReceipt,
  validateStandaloneAssignmentCandidateReceipt,
} from './assignment-delivery.js'
import { parseResultEnvelope } from './result-envelope.js'

const DIGEST = /^[a-f0-9]{64}$/

export async function buildMissionReapproval({
  targetDir,
  missionPath,
  mission,
  child,
  assignmentPath,
  assignmentStatus,
  candidateReceipt,
  verdictPath,
  reviewState,
}) {
  validateStandaloneAssignmentCandidateReceipt(candidateReceipt)
  if (candidateReceipt.completeness !== 'complete') {
    throw new Error('Mission user reapproval requires a complete candidate receipt')
  }
  const contract = await validateAssignmentContract(assignmentPath)
  if (!contract.valid) throw new Error('Mission child contract is not valid')
  const verdict = await fse.readFile(verdictPath, 'utf8')
  const parsed = parseResultEnvelope(verdict, 'reviewer').frontmatter
  if (
    parsed.verdict !== 'approved' ||
    parsed.evidence_integrity !== 'complete' ||
    parsed.user_reapproval_required !== true
  ) {
    throw new Error('Review result is not eligible for Mission user reapproval')
  }
  const snapshot = await gitSnapshot(targetDir)
  const candidateRevision = snapshot.dirty_paths.length
    ? `working-tree@${snapshot.revision || 'unborn'}`
    : snapshot.revision || 'unborn'
  const findings = findingsSection(verdict)
  const identity = {
    mission: mission.id,
    child,
    contract_hash: contract.hash,
    candidate_revision: candidateRevision,
    candidate_digest: reviewState.candidate_digest,
    candidate_receipt_identity: candidateReceipt.identity,
    candidate_receipt: relativeToRepo(
      targetDir,
      join(assignmentPath, 'review', 'candidate-receipt.json')
    ),
    verdict: relativeToRepo(targetDir, verdictPath),
    verdict_digest: digest(verdict),
    findings_digest: digest(findings),
    review_attempt: reviewState.attempt,
    review_verdict: parsed.verdict,
    material_divergence: parsed.material_divergence,
    scope_divergence: parsed.scope_divergence,
    procedure_divergence: parsed.procedure_divergence,
    evidence_integrity: parsed.evidence_integrity,
    user_reapproval_required: parsed.user_reapproval_required,
    disclosed_divergences: disclosedDivergences(parsed),
  }
  const identityDigest = digest(stableJson(identity))
  const record = {
    version: 1,
    status: 'pending',
    identity: identityDigest,
    binding: identity,
    created_at: new Date().toISOString(),
  }
  validateMissionReapproval(record)
  const path = missionReapprovalPath(missionPath, child, identityDigest)
  await writeJsonAtomic(path, record)
  return { record, path }
}

export async function inspectMissionReapproval({
  targetDir,
  missionPath,
  mission,
  assignmentPath,
  assignmentStatus,
  pending,
}) {
  const path = confinedPath(targetDir, pending.artifact, missionPath, 'reapproval artifact')
  const record = await fse.readJson(path).catch(() => null)
  validateMissionReapproval(record)
  if (
    record.identity !== pending.identity ||
    record.binding.mission !== mission.id ||
    record.binding.child !== pending.child
  ) {
    throw new Error('Pending Mission user-reapproval pointer does not match its durable record')
  }
  const candidateReceipt = await buildStandaloneAssignmentCandidateReceipt({
    targetDir,
    assignmentPath,
    assignmentStatus,
  })
  const verdictPath = confinedPath(targetDir, record.binding.verdict, assignmentPath, 'review verdict')
  const verdict = await fse.readFile(verdictPath, 'utf8').catch(() => null)
  const contract = await validateAssignmentContract(assignmentPath)
  const current = {
    contract_hash: contract.hash || null,
    candidate_receipt_identity: candidateReceipt.identity,
    verdict_digest: verdict === null ? null : digest(verdict),
    findings_digest: verdict === null ? null : digest(findingsSection(verdict)),
  }
  const stale_fields = Object.keys(current).filter(
    (field) => current[field] !== record.binding[field]
  )
  return {
    record,
    path,
    current,
    stale: stale_fields.length > 0 || candidateReceipt.completeness !== 'complete',
    stale_fields,
  }
}

export async function decideMissionReapproval({ path, record, decision, actor, reason = null }) {
  validateMissionReapproval(record)
  if (!['approve', 'reject'].includes(decision)) throw new Error('Invalid reapproval decision')
  const desiredStatus = decision === 'approve' ? 'approved' : 'rejected'
  if (record.status !== 'pending') {
    if (record.status === desiredStatus) return { record, idempotent: true }
    throw new Error(`Mission user reapproval was already ${record.status}`)
  }
  const decided = {
    ...record,
    status: desiredStatus,
    decision: {
      value: decision,
      identity: record.identity,
      actor,
      decided_at: new Date().toISOString(),
      ...(reason ? { reason } : {}),
    },
  }
  validateMissionReapproval(decided)
  await writeJsonAtomic(path, decided)
  return { record: decided, idempotent: false }
}

export async function readMissionReapproval(missionPath, child, identity) {
  if (!/^\d{5}$/.test(String(child || '')) || !DIGEST.test(String(identity || ''))) {
    throw new Error('Mission user-reapproval selector is invalid')
  }
  const path = missionReapprovalPath(missionPath, child, identity)
  const record = await fse.readJson(path).catch(() => null)
  validateMissionReapproval(record)
  return { path, record }
}

export function validateMissionReapproval(record) {
  if (!record || record.version !== 1 || !['pending', 'approved', 'rejected'].includes(record.status)) {
    throw new Error('Invalid Mission user-reapproval record')
  }
  if (!DIGEST.test(String(record.identity || '')) || !record.binding) {
    throw new Error('Mission user-reapproval identity is invalid')
  }
  for (const field of [
    'mission',
    'child',
    'contract_hash',
    'candidate_revision',
    'candidate_digest',
    'candidate_receipt_identity',
    'candidate_receipt',
    'verdict',
    'verdict_digest',
    'findings_digest',
    'review_attempt',
  ]) {
    if (!record.binding[field]) throw new Error(`Mission user-reapproval is missing ${field}`)
  }
  if (!/^M\d{5}$/.test(record.binding.mission) || !/^\d{5}$/.test(record.binding.child)) {
    throw new Error('Mission user-reapproval Mission or child identity is invalid')
  }
  for (const field of [
    'contract_hash',
    'candidate_digest',
    'candidate_receipt_identity',
    'verdict_digest',
    'findings_digest',
  ]) {
    if (!DIGEST.test(String(record.binding[field]))) {
      throw new Error(`Mission user-reapproval ${field} is invalid`)
    }
  }
  if (
    record.binding.review_verdict !== 'approved' ||
    record.binding.evidence_integrity !== 'complete' ||
    record.binding.user_reapproval_required !== true ||
    !Array.isArray(record.binding.disclosed_divergences)
  ) {
    throw new Error('Mission user-reapproval review authority is invalid')
  }
  if (digest(stableJson(record.binding)) !== record.identity) {
    throw new Error('Mission user-reapproval binding digest does not match')
  }
  if (record.status !== 'pending') {
    if (
      !record.decision ||
      record.decision.identity !== record.identity ||
      record.decision.value !== (record.status === 'approved' ? 'approve' : 'reject') ||
      !record.decision.actor ||
      !record.decision.decided_at
    ) {
      throw new Error('Mission user-reapproval decision is incomplete')
    }
  }
  return record
}

export function missionReapprovalPreview(record) {
  validateMissionReapproval(record)
  return {
    status: record.status,
    identity: record.identity,
    mission: record.binding.mission,
    child: record.binding.child,
    contract_hash: record.binding.contract_hash,
    candidate_revision: record.binding.candidate_revision,
    candidate_digest: record.binding.candidate_digest,
    candidate_receipt_identity: record.binding.candidate_receipt_identity,
    candidate_receipt: record.binding.candidate_receipt,
    verdict: record.binding.verdict,
    verdict_digest: record.binding.verdict_digest,
    findings_digest: record.binding.findings_digest,
    disclosed_divergences: record.binding.disclosed_divergences,
  }
}

function missionReapprovalPath(missionPath, child, identity) {
  return join(missionPath, 'review', 'user-reapproval', `${child}-${identity}.json`)
}

function disclosedDivergences(result) {
  return [
    `material_divergence=${result.material_divergence}`,
    `scope_divergence=${result.scope_divergence}`,
    `procedure_divergence=${result.procedure_divergence}`,
    `evidence_integrity=${result.evidence_integrity}`,
    `user_reapproval_required=${result.user_reapproval_required}`,
  ]
}

function findingsSection(markdown) {
  const match = /^##\s+Findings\s*$([\s\S]*)$/im.exec(markdown)
  return match ? match[1].trim() : ''
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function digest(value) {
  return createHash('sha256').update(String(value)).digest('hex')
}

async function writeJsonAtomic(path, value) {
  await fse.ensureDir(dirname(path))
  const temporary = `${path}.tmp-${process.pid}`
  await fse.writeJson(temporary, value, { spaces: 2 })
  await fse.move(temporary, path, { overwrite: true })
}

function confinedPath(targetDir, relativePath, expectedRoot, label) {
  const root = resolve(expectedRoot)
  const path = resolve(targetDir, String(relativePath || ''))
  if (path !== root && !path.startsWith(`${root}${sep}`)) {
    throw new Error(`Mission user-reapproval ${label} escapes its expected root`)
  }
  return path
}
