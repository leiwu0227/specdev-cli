import { constants } from 'node:fs'
import { open } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import fse from 'fs-extra'

const ATTEMPT_ID_PATTERN = /^(?:Attempt|ATT)-(?:\d+|\d{5}-\d+)$/
const MILESTONE_MAX_BYTES = 4 * 1024
const PHASE_MAX_CHARS = 64
const SUMMARY_MAX_CHARS = 160
const FRESH_AFTER_MS = 45_000
const STALE_AFTER_MS = 120_000
const FUTURE_TOLERANCE_MS = 30_000
const SENSITIVE_TEXT =
  /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+\S+|\b(?:api[_ -]?key|access[_ -]?token|password|secret)\s*[:=]\s*\S+|\b(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{12,})/i

export const ATTEMPT_PROGRESS_INTERVAL_MS = 15_000

export function attemptProgressPaths(specdevPath, attemptId) {
  if (!ATTEMPT_ID_PATTERN.test(String(attemptId))) {
    throw new Error(`invalid Attempt ID: ${attemptId}`)
  }
  const root = join(specdevPath, 'cache', 'attempts')
  return {
    milestone: join(root, `${attemptId}.milestone.json`),
    progress: join(root, `${attemptId}.progress.json`),
  }
}

export async function readAttemptMilestone(path, options = {}) {
  const previous = options.lastValidMilestone || null
  let handle
  try {
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0))
    const stat = await handle.stat()
    if (!stat.isFile()) return invalidMilestone(previous, 'milestone_not_regular')
    if (stat.size > MILESTONE_MAX_BYTES) {
      return invalidMilestone(previous, 'milestone_oversized')
    }
    const buffer = Buffer.alloc(MILESTONE_MAX_BYTES + 1)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    if (bytesRead > MILESTONE_MAX_BYTES) {
      return invalidMilestone(previous, 'milestone_oversized')
    }
    const parsed = JSON.parse(buffer.subarray(0, bytesRead).toString('utf-8'))
    return {
      milestone: validateMilestone(parsed, options.now),
      diagnostic: null,
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return { milestone: previous, diagnostic: null }
    return invalidMilestone(previous, milestoneErrorCode(error))
  } finally {
    await handle?.close().catch(() => {})
  }
}

export function validateMilestone(value, now = Date.now()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw milestoneError('milestone_invalid_shape')
  }
  const allowed = new Set(['version', 'phase', 'summary', 'updated_at'])
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw milestoneError('milestone_unknown_field')
  }
  if (value.version !== 1) throw milestoneError('milestone_invalid_version')
  const phase = boundedPublicText(value.phase, PHASE_MAX_CHARS, 'phase')
  const summary = boundedPublicText(value.summary, SUMMARY_MAX_CHARS, 'summary')
  if (typeof value.updated_at !== 'string') {
    throw milestoneError('milestone_invalid_timestamp')
  }
  const timestamp = Date.parse(value.updated_at)
  const currentTime = validTime(now, Date.now())
  if (!Number.isFinite(timestamp) || timestamp > currentTime + FUTURE_TOLERANCE_MS) {
    throw milestoneError('milestone_invalid_timestamp')
  }
  return {
    version: 1,
    phase,
    summary,
    updated_at: new Date(timestamp).toISOString(),
  }
}

export function buildAttemptProgress(input) {
  const now = validTime(input.now, Date.now())
  const startedAt = validTime(input.startedAt, now)
  const logActivityAt = optionalTime(input.logActivityAt, now)
  const milestone = input.milestone || null
  const milestoneAt = milestone ? optionalTime(milestone.updated_at, now) : null
  const latestActivityAt = Math.max(startedAt, logActivityAt || 0, milestoneAt || 0)
  const activityAgeMs = Math.max(0, now - latestActivityAt)
  const processLiveness = normalizeProcessLiveness(input.processLiveness)
  const classification =
    processLiveness !== 'live_local'
      ? 'stale'
      : activityAgeMs <= FRESH_AFTER_MS
        ? 'fresh'
        : activityAgeMs <= STALE_AFTER_MS
          ? 'quiet'
          : 'stale'
  const diagnostic =
    input.diagnostic ||
    (milestoneAt !== null && now - milestoneAt > STALE_AFTER_MS ? 'milestone_stale' : null)
  return {
    version: 1,
    attempt: String(input.attemptId),
    role: boundedPublicText(input.role, PHASE_MAX_CHARS, 'role'),
    phase: milestone?.phase || null,
    elapsed_ms: Math.max(0, now - startedAt),
    process_liveness: processLiveness,
    log_liveness:
      logActivityAt === null
        ? now - startedAt <= STALE_AFTER_MS
          ? 'quiet'
          : 'stale'
        : classifyAge(now - logActivityAt),
    last_log_activity_at: logActivityAt === null ? null : new Date(logActivityAt).toISOString(),
    milestone,
    classification,
    diagnostic,
    updated_at: new Date(now).toISOString(),
  }
}

export async function writeAttemptProgress(path, progress) {
  await fse.ensureDir(dirname(path))
  const temporaryPath = `${path}.tmp-${process.pid}`
  await fse.writeJson(temporaryPath, progress, { spaces: 2 })
  await fse.move(temporaryPath, path, { overwrite: true })
}

export function formatAttemptProgress(progress, format = 'human') {
  if (format === 'structured') {
    return JSON.stringify({ type: 'specdev.attempt_progress', progress })
  }
  const milestone = progress.milestone
    ? `${progress.milestone.phase}: ${progress.milestone.summary}`
    : 'none'
  const diagnostic = progress.diagnostic ? `; diagnostic ${progress.diagnostic}` : ''
  return `SpecDev ${progress.attempt} progress: ${progress.role}; ${formatElapsed(progress.elapsed_ms)}; process ${progress.process_liveness}; logs ${progress.log_liveness}; milestone ${milestone}; ${progress.classification}${diagnostic}.`
}

export function attemptMilestonePrompt(targetDir, milestonePath) {
  const relativePath = milestonePath.startsWith(`${targetDir}/`)
    ? milestonePath.slice(targetDir.length + 1)
    : basename(milestonePath)
  return `Optional public progress milestones: atomically overwrite \`${relativePath}\` with one JSON object shaped exactly as {"version":1,"phase":"short phase","summary":"user-facing status, max 160 characters","updated_at":"ISO-8601 timestamp"}. This file is ignored runtime telemetry. Never include reasoning, prompts, credentials, secrets, source excerpts, or provider output. Milestones are optional and cannot change the Attempt result or lifecycle disposition.`
}

function invalidMilestone(previous, diagnostic) {
  return { milestone: previous, diagnostic }
}

function milestoneError(code) {
  const error = new Error(code)
  error.code = code
  return error
}

function milestoneErrorCode(error) {
  return String(error?.code || '').startsWith('milestone_') ? error.code : 'milestone_malformed'
}

function boundedPublicText(value, maxChars, field) {
  if (typeof value !== 'string') throw milestoneError(`milestone_invalid_${field}`)
  const text = value.trim()
  if (!text || [...text].length > maxChars || /[\u0000-\u001f\u007f]/u.test(text)) {
    throw milestoneError(`milestone_invalid_${field}`)
  }
  if (SENSITIVE_TEXT.test(text)) throw milestoneError('milestone_sensitive_text')
  return text
}

function normalizeProcessLiveness(value) {
  return ['live_local', 'unknown', 'stale', 'exited'].includes(value) ? value : 'unknown'
}

function classifyAge(ageMs) {
  if (ageMs <= FRESH_AFTER_MS) return 'active'
  if (ageMs <= STALE_AFTER_MS) return 'quiet'
  return 'stale'
}

function validTime(value, fallback) {
  const timestamp = typeof value === 'number' ? value : Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : fallback
}

function optionalTime(value, now) {
  if (value === null || value === undefined) return null
  const timestamp = validTime(value, NaN)
  return Number.isFinite(timestamp) && timestamp <= now + FUTURE_TOLERANCE_MS ? timestamp : null
}

function formatElapsed(value) {
  const seconds = Math.max(0, Math.floor(Number(value) / 1000))
  if (seconds < 60) return `${seconds}s elapsed`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${seconds % 60}s elapsed`
}
