import { join } from 'node:path'
import fse from 'fs-extra'
import {
  attemptLiveness,
  clearLocalProcessMarker,
  isAttemptId,
  isDurableAttemptStatus,
  readAttemptRecord,
  updateAttemptRecord,
} from './process-record.js'

export async function inspectMaintenanceQuiescence(specdevPath) {
  const loaded = await loadAttemptRecords(specdevPath)
  const blockers = [...loaded.blockers]
  const staleAttempts = []
  let runningAttemptCount = 0

  for (const { id, record } of loaded.records) {
    if (record.status !== 'running') continue
    runningAttemptCount += 1
    const identityIssue = validateRunningAttempt(id, record)
    if (identityIssue) {
      blockers.push(blockerFor(record, id, 'unclassifiable', identityIssue))
      continue
    }

    const liveness = await attemptLiveness(specdevPath, id)
    const facts = attemptFacts(record, id, liveness.state)
    if (liveness.state === 'stale') {
      staleAttempts.push(facts)
      continue
    }
    blockers.push({
      ...facts,
      reason: liveness.state === 'live_local' ? 'live_attempt' : 'ambiguous_liveness',
      next_action:
        liveness.state === 'live_local'
          ? 'Stop the owning Attempt and let its workflow record a non-running status before retrying.'
          : 'Recover or explicitly resolve the owning Attempt before retrying maintenance.',
    })
  }

  return maintenanceSummary({
    inspectedAttemptCount: loaded.records.length,
    runningAttemptCount,
    staleAttempts,
    blockers,
  })
}

export async function reconcileMaintenanceQuiescence(specdevPath) {
  const initial = await inspectMaintenanceQuiescence(specdevPath)
  if (initial.status === 'blocked' || initial.stale_attempts.length === 0) {
    return { ...initial, reconciled_attempts: [] }
  }

  const reconciled = []
  for (const stale of initial.stale_attempts) {
    try {
      const current = await readAttemptRecord(specdevPath, stale.attempt)
      if (!current || current.status !== 'running') continue
      const identityIssue = validateRunningAttempt(stale.attempt, current)
      if (identityIssue) {
        return reconciliationFailure(initial, reconciled, stale, identityIssue)
      }
      const liveness = await attemptLiveness(specdevPath, stale.attempt)
      if (liveness.state !== 'stale') {
        const refreshed = await inspectMaintenanceQuiescence(specdevPath)
        return { ...refreshed, reconciled_attempts: reconciled }
      }
      await updateAttemptRecord(specdevPath, stale.attempt, {
        status: 'interrupted',
        error: 'stale local process reconciled by specdev update preflight',
      })
      await clearLocalProcessMarker(specdevPath, stale.attempt)
      reconciled.push(stale.attempt)
    } catch (error) {
      return reconciliationFailure(initial, reconciled, stale, error.message)
    }
  }

  const refreshed = await inspectMaintenanceQuiescence(specdevPath)
  return { ...refreshed, reconciled_attempts: reconciled }
}

async function loadAttemptRecords(specdevPath) {
  const directory = join(specdevPath, 'processes')
  if (!(await fse.pathExists(directory))) return { records: [], blockers: [] }

  let entries
  try {
    entries = await fse.readdir(directory, { withFileTypes: true })
  } catch (error) {
    return {
      records: [],
      blockers: [registryBlocker('attempt_registry_unreadable', error.message)],
    }
  }

  const records = []
  const blockers = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.yaml')) continue
    const id = entry.name.slice(0, -'.yaml'.length)
    if (!isAttemptId(id)) continue
    try {
      const record = await readAttemptRecord(specdevPath, id)
      if (!record || !isDurableAttemptStatus(record.status)) {
        blockers.push(blockerFor(record, id, 'unclassifiable', 'invalid_attempt_record'))
        continue
      }
      records.push({ id, record })
    } catch (error) {
      blockers.push(
        blockerFor(null, id, 'unclassifiable', 'unreadable_attempt_record', error.message)
      )
    }
  }
  return { records, blockers }
}

function validateRunningAttempt(id, record) {
  if (record.id !== id) return 'attempt_identity_mismatch'
  if (!String(record.kind || '').trim()) return 'missing_attempt_kind'
  if (attemptOwners(record).length === 0) return 'missing_attempt_owner'
  return null
}

function maintenanceSummary({
  inspectedAttemptCount,
  runningAttemptCount,
  staleAttempts,
  blockers,
}) {
  return {
    status:
      blockers.length > 0
        ? 'blocked'
        : staleAttempts.length > 0
          ? 'reconciliation_required'
          : 'quiescent',
    inspected_attempt_count: inspectedAttemptCount,
    running_attempt_count: runningAttemptCount,
    stale_attempts: staleAttempts,
    blockers,
  }
}

function attemptFacts(record, id, liveness) {
  return {
    attempt: id,
    kind: String(record.kind),
    owners: attemptOwners(record),
    liveness,
  }
}

function attemptOwners(record) {
  const source = record && typeof record === 'object' ? record : {}
  return ['assignment', 'mission', 'discussion']
    .filter((field) => String(source[field] || '').trim())
    .map((field) => ({ kind: field, id: String(source[field]).trim() }))
}

function blockerFor(record, id, liveness, reason, detail = null) {
  return {
    attempt: id,
    kind: record?.kind ? String(record.kind) : null,
    owners: attemptOwners(record),
    liveness,
    reason,
    ...(detail ? { detail: String(detail) } : {}),
    next_action:
      'Repair or recover this Attempt through its owning workflow before retrying maintenance.',
  }
}

function registryBlocker(reason, detail) {
  return {
    attempt: null,
    kind: null,
    owners: [],
    liveness: 'unclassifiable',
    reason,
    detail: String(detail),
    next_action: 'Restore readable durable Attempt state before retrying maintenance.',
  }
}

function reconciliationFailure(initial, reconciled, stale, detail) {
  return {
    ...initial,
    status: 'blocked',
    blockers: [
      ...initial.blockers,
      {
        ...stale,
        reason: 'stale_reconciliation_failed',
        detail: String(detail),
        next_action:
          'Recover the stale Attempt through its owning workflow before retrying maintenance.',
      },
    ],
    reconciled_attempts: reconciled,
  }
}
