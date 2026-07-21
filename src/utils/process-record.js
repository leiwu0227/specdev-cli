import { join } from 'node:path'
import fse from 'fs-extra'
import { parse, stringify } from 'yaml'
import { reserveEntityId } from './id-reservation.js'

const DURABLE_STATUSES = new Set(['running', 'completed', 'interrupted', 'failed', 'blocked'])

export async function createAttemptRecord(specdevPath, input) {
  const id = await reserveEntityId(specdevPath, 'attempt')
  const record = {
    id,
    kind: requiredText(input.kind, 'kind'),
    status: 'running',
    workspace: normalizeRepoRelative(input.workspace || '.'),
    base_revision: nullableText(input.base_revision),
    started_at: input.started_at || new Date().toISOString(),
    profile: nullableText(input.profile),
    provider: nullableText(input.provider),
    model: nullableText(input.model),
    effort: nullableText(input.effort),
    network: Boolean(input.network),
    result_path: nullableText(input.result_path),
    ...(Array.isArray(input.guides) && input.guides.length > 0
      ? {
          guides: input.guides.map((guide) => ({
            id: String(guide.id),
            version: String(guide.version),
          })),
        }
      : {}),
    ...(input.assignment ? { assignment: String(input.assignment) } : {}),
    ...(input.mission ? { mission: String(input.mission) } : {}),
    ...(input.discussion ? { discussion: String(input.discussion) } : {}),
  }
  await writeAttemptRecord(specdevPath, record)
  return record
}

export async function readAttemptRecord(specdevPath, id) {
  const path = attemptPath(specdevPath, id)
  if (!(await fse.pathExists(path))) return null
  const parsed = parse(await fse.readFile(path, 'utf-8'))
  return parsed && typeof parsed === 'object' ? parsed : null
}

export async function updateAttemptRecord(specdevPath, id, patch) {
  const existing = await readAttemptRecord(specdevPath, id)
  if (!existing) throw new Error(`Attempt not found: ${id}`)
  if (patch.status && !DURABLE_STATUSES.has(patch.status)) {
    throw new Error(`invalid Attempt status: ${patch.status}`)
  }
  const endedAt =
    patch.status && patch.status !== 'running' && !patch.ended_at && !existing.ended_at
      ? new Date().toISOString()
      : patch.ended_at || existing.ended_at
  const inferredDuration =
    endedAt &&
    existing.started_at &&
    patch.duration_ms === undefined &&
    existing.duration_ms === undefined
      ? Math.max(0, new Date(endedAt).getTime() - new Date(existing.started_at).getTime())
      : undefined
  const next = {
    ...existing,
    ...patch,
    id: existing.id,
    ...(endedAt ? { ended_at: endedAt } : {}),
    ...(inferredDuration !== undefined ? { duration_ms: inferredDuration } : {}),
  }
  delete next.pid
  delete next.cwd
  await writeAttemptRecord(specdevPath, next)
  return next
}

export async function listAttemptRecords(specdevPath, filters = {}) {
  const dir = join(specdevPath, 'processes')
  if (!(await fse.pathExists(dir))) return []
  const entries = await fse.readdir(dir, { withFileTypes: true })
  const records = []
  for (const entry of entries.filter(
    (candidate) => candidate.isFile() && /^ATT-\d+\.yaml$/.test(candidate.name)
  )) {
    const record = await readAttemptRecord(specdevPath, entry.name.replace(/\.yaml$/, ''))
    if (!record) continue
    if (filters.status && record.status !== filters.status) continue
    if (filters.kind && record.kind !== filters.kind) continue
    if (filters.assignment && record.assignment !== filters.assignment) continue
    if (filters.mission && record.mission !== filters.mission) continue
    if (filters.discussion && record.discussion !== filters.discussion) continue
    records.push(record)
  }
  return records.sort((left, right) =>
    String(left.started_at).localeCompare(String(right.started_at))
  )
}

export async function attemptActivitySummary(specdevPath, filters = {}, bounds = {}) {
  return summarizeAttemptActivity(await listAttemptRecords(specdevPath, filters), bounds)
}

export function summarizeAttemptActivity(attempts, bounds = {}) {
  const records = Array.isArray(attempts) ? attempts : []
  const providerAttempts = records.filter((attempt) => attempt.provider)
  const providerAttemptOutcomes = Object.fromEntries(
    ['completed', 'failed', 'blocked', 'interrupted', 'running'].map((status) => [
      status,
      providerAttempts.filter((attempt) => attempt.status === status).length,
    ])
  )
  const tokenValues = providerAttempts
    .map((attempt) => attempt.usage?.provider_reported_tokens)
    .filter((value) => Number.isSafeInteger(value) && value >= 0)
  const startedAt = validTimestamp(bounds.startedAt, Date.now())
  const endedAt = validTimestamp(bounds.endedAt, Date.now())
  return {
    attempt_count: records.length,
    orchestration_attempt_count: records.length - providerAttempts.length,
    provider_attempt_count: providerAttempts.length,
    provider_attempts: {
      total: providerAttempts.length,
      ...providerAttemptOutcomes,
    },
    elapsed_ms: Math.max(0, endedAt - startedAt),
    agent_duration_ms: providerAttempts.reduce(
      (sum, attempt) => sum + (Number(attempt.duration_ms) || 0),
      0
    ),
    provider_reported_tokens:
      tokenValues.length > 0 ? tokenValues.reduce((sum, value) => sum + value, 0) : null,
  }
}

export async function writeLocalProcessMarker(specdevPath, attemptId, input = {}) {
  const path = localMarkerPath(specdevPath, attemptId)
  await fse.ensureDir(join(specdevPath, 'cache', 'processes'))
  await fse.writeJson(
    path,
    {
      attempt: attemptId,
      pid: input.pid || process.pid,
      cwd: input.cwd || process.cwd(),
      started_at: input.started_at || new Date().toISOString(),
    },
    { spaces: 2 }
  )
  return path
}

export async function readLocalProcessMarker(specdevPath, attemptId) {
  const path = localMarkerPath(specdevPath, attemptId)
  if (!(await fse.pathExists(path))) return null
  try {
    return await fse.readJson(path)
  } catch {
    return null
  }
}

export async function clearLocalProcessMarker(specdevPath, attemptId) {
  const path = localMarkerPath(specdevPath, attemptId)
  if (await fse.pathExists(path)) await fse.remove(path)
}

export async function attemptLiveness(specdevPath, attemptId) {
  const marker = await readLocalProcessMarker(specdevPath, attemptId)
  if (!marker) return { state: 'unknown' }
  if (!Number.isInteger(marker.pid) || marker.pid <= 0) return { state: 'stale', marker }
  try {
    process.kill(marker.pid, 0)
    return { state: 'live_local', marker }
  } catch {
    return { state: 'stale', marker }
  }
}

async function writeAttemptRecord(specdevPath, record) {
  await fse.ensureDir(join(specdevPath, 'processes'))
  const path = attemptPath(specdevPath, record.id)
  const temporaryPath = `${path}.tmp-${process.pid}`
  await fse.writeFile(temporaryPath, stringify(record, { lineWidth: 0 }), 'utf-8')
  await fse.move(temporaryPath, path, { overwrite: true })
}

function attemptPath(specdevPath, id) {
  if (!/^ATT-\d+$/.test(String(id))) throw new Error(`invalid Attempt ID: ${id}`)
  return join(specdevPath, 'processes', `${id}.yaml`)
}

function localMarkerPath(specdevPath, id) {
  if (!/^ATT-\d+$/.test(String(id))) throw new Error(`invalid Attempt ID: ${id}`)
  return join(specdevPath, 'cache', 'processes', `${id}.json`)
}

function normalizeRepoRelative(value) {
  const text = requiredText(value, 'workspace').replaceAll('\\', '/')
  if (text.startsWith('/') || text === '..' || text.startsWith('../') || text.includes('/../')) {
    throw new Error('Attempt workspace must be repository-relative')
  }
  return text
}

function requiredText(value, field) {
  const text = String(value || '').trim()
  if (!text) throw new Error(`Attempt ${field} is required`)
  return text
}

function nullableText(value) {
  const text = String(value || '').trim()
  return text || null
}

function validTimestamp(value, fallback) {
  const timestamp = new Date(value || fallback).getTime()
  return Number.isFinite(timestamp) ? timestamp : fallback
}
