import { createHash } from 'node:crypto'
import { basename, join } from 'node:path'
import fse from 'fs-extra'
import {
  readCheckpoint,
  readCurrent as readRippleCurrent,
  runDir,
  writeCurrent as writeRippleCurrent,
} from 'ripplegraph'
import { relativeToRepo } from './assignment-vnext.js'
import { clearCurrent, readCurrentFocus } from './current.js'
import {
  clearLocalProcessMarker,
  listAttemptRecords,
  updateAttemptRecord,
} from './process-record.js'

export async function retireTransientArtifact(targetDir, specdevPath, path) {
  if (!(await fse.pathExists(path))) return false
  const repoPath = relativeToRepo(targetDir, path)
  const attempts = await listAttemptRecords(specdevPath)
  const owners = attempts.filter((attempt) => attempt.result_path === repoPath)
  const key = owners[0]?.id || createHash('sha256').update(repoPath).digest('hex').slice(0, 12)
  const destination = join(specdevPath, 'cache', 'retired-artifacts', `${key}-${basename(path)}`)
  await fse.ensureDir(join(specdevPath, 'cache', 'retired-artifacts'))
  await fse.move(path, destination, { overwrite: true })
  for (const attempt of owners) {
    await updateAttemptRecord(specdevPath, attempt.id, {
      result_path: null,
      result_retention: 'local-cache-only',
    })
  }
  return true
}

export async function compactCompletedWorkflowRuntime(specdevPath, options) {
  return compactTerminalWorkflowRuntime(specdevPath, options, new Set(['completed']))
}

export async function compactShelvedWorkflowRuntime(specdevPath, options) {
  return compactTerminalWorkflowRuntime(specdevPath, options, new Set(['abandoned']))
}

async function compactTerminalWorkflowRuntime(specdevPath, options, allowedStatuses) {
  const runId = String(options?.runId || '').trim()
  const attemptFilter = options?.attemptFilter
  const focus = options?.focus
  if (!runId) throw new Error('terminal runtime compaction requires a run ID')
  const filterEntries = Object.entries(attemptFilter || {})
  if (
    filterEntries.length !== 1 ||
    !['assignment', 'mission'].includes(filterEntries[0][0]) ||
    !String(filterEntries[0][1] || '').trim()
  ) {
    throw new Error('terminal runtime compaction requires one Attempt owner filter')
  }
  const ownerFilter = { [filterEntries[0][0]]: String(filterEntries[0][1]).trim() }

  const path = runDir(specdevPath, runId)
  const runExists = await fse.pathExists(path)
  if (runExists) {
    const checkpoint = readCheckpoint(specdevPath, runId)
    if (!allowedStatuses.has(checkpoint.status)) {
      throw new Error(`cannot compact non-terminal RippleGraph run ${runId}: ${checkpoint.status}`)
    }
  }

  const attempts = await listAttemptRecords(specdevPath, ownerFilter)
  const running = attempts.filter((attempt) => attempt.status === 'running')
  if (running.length > 0) {
    throw new Error(
      `cannot compact runtime with running Attempts: ${running.map((attempt) => attempt.id).join(', ')}`
    )
  }

  const current = readRippleCurrent(specdevPath)
  if (current.focusedRunId === runId) {
    writeRippleCurrent(specdevPath, { focusedRunId: null })
  }
  if (runExists) await fse.remove(path)

  for (const attempt of attempts) {
    await clearLocalProcessMarker(specdevPath, attempt.id)
    await fse.remove(join(specdevPath, 'processes', `${attempt.id}.yaml`))
  }

  if (focus) {
    const currentFocus = await readCurrentFocus(specdevPath)
    if (currentFocus?.kind === focus.kind && currentFocus.id === String(focus.id)) {
      await clearCurrent(specdevPath)
    }
  }

  return {
    compacted: runExists,
    run_id: runId,
    attempts_removed: attempts.length,
  }
}
