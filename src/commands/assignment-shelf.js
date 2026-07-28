import { execFile as execFileCallback } from 'node:child_process'
import { join } from 'node:path'
import { promisify } from 'node:util'
import fse from 'fs-extra'
import {
  abandonRun,
  readCheckpoint,
  readCurrent as readRippleCurrent,
  runDir,
  writeCurrent as writeRippleCurrent,
} from 'ripplegraph'
import { resolveAssignmentSelector } from '../utils/assignment.js'
import { relativeToRepo, writeAssignmentStatus } from '../utils/assignment-vnext.js'
import { workflowRootFor } from '../utils/engine.js'
import { attemptLiveness, listAttemptRecords } from '../utils/process-record.js'
import { compactShelvedWorkflowRuntime } from '../utils/artifact-retention.js'

const execFile = promisify(execFileCallback)
const TERMINAL_ASSIGNMENT_STATUSES = new Set(['completed', 'abandoned'])

export async function shelfAssignmentCommand(targetDir, specdevPath, positionalArgs, flags = {}) {
  const selector = String(positionalArgs[0] || '').trim()
  if (!selector) return fail(flags, 'Usage: specdev assignment shelf <id> --reason="<reason>"')

  const resolved = await resolveAssignmentSelector(specdevPath, selector)
  if (!resolved || resolved.ambiguous) {
    return fail(flags, `Assignment not found or ambiguous: ${selector}`)
  }
  const status = await fse.readJson(join(resolved.path, 'status.json')).catch(() => null)
  if (!status?.id || !status.run_id) {
    return fail(
      flags,
      `Assignment ${resolved.name} has no durable lifecycle identity and cannot be shelved safely`
    )
  }
  if (status.status === 'shelved') {
    if (!status.shelf?.artifact || !status.shelf?.repository?.commit) {
      return fail(
        flags,
        `Assignment ${status.id} has an incomplete shelf record; restore status.json and shelf.md before retrying`
      )
    }
    try {
      const runtime = await finalizeShelvedRuntime(specdevPath, resolved.name, status)
      return emit(flags, shelfPayload(targetDir, resolved, status, runtime, true))
    } catch (error) {
      return fail(flags, `Could not finish idempotent shelf cleanup: ${error.message}`)
    }
  }
  if (status.mission) {
    return fail(
      flags,
      `Assignment ${status.id} is a Mission child and cannot be shelved; manage it through Mission ${status.mission}`
    )
  }
  if (TERMINAL_ASSIGNMENT_STATUSES.has(status.status)) {
    const action =
      status.status === 'completed'
        ? 'Create a new Assignment for follow-on work.'
        : 'This Assignment was abandoned; create a new Assignment if the work is wanted again.'
    return fail(flags, `Assignment ${status.id} is already ${status.status}. ${action}`)
  }

  const reason = shelfReason(positionalArgs, flags)
  if (!reason) {
    return fail(flags, 'Shelving requires an explicit reason via --reason="<reason>"')
  }

  const workflowRoot = workflowRootFor(targetDir)
  let checkpoint
  try {
    checkpoint = readCheckpoint(workflowRoot, status.run_id)
  } catch {
    return fail(
      flags,
      `Assignment ${status.id} has no matching execution run; it cannot be classified as an active shelf candidate`
    )
  }
  const current = readRippleCurrent(workflowRoot)
  if (
    checkpoint.rootGraph !== 'assignment-lifecycle' ||
    checkpoint.status !== 'active' ||
    current.focusedRunId !== status.run_id
  ) {
    return fail(
      flags,
      `Only the active standalone Assignment can be shelved; ${status.id} has run state ${checkpoint.status}`
    )
  }

  const running = await listAttemptRecords(specdevPath, {
    assignment: resolved.name,
    status: 'running',
  })
  const possiblyLive = []
  for (const attempt of running) {
    const liveness = await attemptLiveness(specdevPath, attempt.id)
    if (liveness.state !== 'stale') possiblyLive.push(`${attempt.id} (${liveness.state})`)
  }
  if (possiblyLive.length > 0) {
    return fail(
      flags,
      `Assignment ${status.id} still has a live or unverified worker/reviewer: ${possiblyLive.join(', ')}. Stop it or recover its process record before shelving.`
    )
  }

  let boundary
  try {
    boundary = await establishGitBoundary(targetDir, status.id, flags)
  } catch (error) {
    return fail(flags, error.message)
  }

  const shelvedAt = new Date().toISOString()
  const artifactPath = join(resolved.path, 'shelf.md')
  const repoArtifactPath = relativeToRepo(targetDir, artifactPath)
  const shelf = {
    version: 1,
    reason,
    shelved_at: shelvedAt,
    run_id: status.run_id,
    artifact: repoArtifactPath,
    repository: {
      branch: boundary.branch,
      commit: boundary.commit,
      boundary: boundary.snapshot ? 'authorized-snapshot' : 'clean-head',
    },
  }

  try {
    await fse.writeFile(
      artifactPath,
      await renderShelfArtifact(targetDir, resolved, status, shelf),
      'utf-8'
    )
    const nextStatus = await writeAssignmentStatus(resolved.path, {
      status: 'shelved',
      shelved_at: shelvedAt,
      shelf,
    })
    const runtime = await finalizeShelvedRuntime(specdevPath, resolved.name, nextStatus)
    return emit(flags, shelfPayload(targetDir, resolved, nextStatus, runtime, false))
  } catch (error) {
    return fail(
      flags,
      `Shelf boundary was recorded at ${boundary.commit}, but terminal cleanup did not finish: ${error.message}. Rerun the same shelf command to recover idempotently.`
    )
  }
}

async function finalizeShelvedRuntime(specdevPath, assignmentName, status) {
  const path = runDir(specdevPath, status.run_id)
  if (!(await fse.pathExists(path))) {
    return { compacted: false, run_id: status.run_id, attempts_removed: 0 }
  }
  const checkpoint = readCheckpoint(specdevPath, status.run_id)
  if (checkpoint.status !== 'abandoned') {
    if (!['active', 'suspended'].includes(checkpoint.status)) {
      throw new Error(`shelf record conflicts with run state ${checkpoint.status}`)
    }
    const current = readRippleCurrent(specdevPath)
    if (current.focusedRunId && current.focusedRunId !== status.run_id) {
      throw new Error(`another run is focused: ${current.focusedRunId}`)
    }
    if (!current.focusedRunId) {
      writeRippleCurrent(specdevPath, { focusedRunId: status.run_id })
    }
    abandonRun({ workflowRoot: specdevPath, reason: `Assignment ${status.id} shelved` })
  }
  return compactShelvedWorkflowRuntime(specdevPath, {
    runId: status.run_id,
    attemptFilter: { assignment: assignmentName },
  })
}

async function establishGitBoundary(targetDir, assignmentId, flags) {
  const [branch, commit, dirtyPaths] = await Promise.all([
    gitText(targetDir, ['branch', '--show-current']),
    gitText(targetDir, ['rev-parse', 'HEAD']),
    gitDirtyPaths(targetDir),
  ])
  if (!commit) throw new Error('Shelving requires a repository with an existing Git commit')
  if (dirtyPaths.length === 0) {
    return { branch: branch || null, commit, snapshot: false }
  }

  const authorized = parseSnapshotPaths(flags['snapshot-paths'])
  if (!authorized) {
    throw new Error(
      `Worktree changes require an explicit snapshot decision. Review git status, then rerun with --snapshot-paths='${JSON.stringify(dirtyPaths)}' to authorize exactly these paths.`
    )
  }
  assertExactPaths(authorized, dirtyPaths)

  const unchanged = await gitDirtyPaths(targetDir)
  assertExactPaths(authorized, unchanged)
  await git(targetDir, ['--literal-pathspecs', 'add', '-A', '--', ...authorized])
  assertExactPaths(authorized, await gitDirtyPaths(targetDir))
  await git(targetDir, ['commit', '-m', `specdev(assignment): shelf ${assignmentId}`])
  return {
    branch: (await gitText(targetDir, ['branch', '--show-current'])) || null,
    commit: await gitText(targetDir, ['rev-parse', 'HEAD']),
    snapshot: true,
  }
}

async function renderShelfArtifact(targetDir, resolved, status, shelf) {
  const contract = await fse
    .readFile(join(resolved.path, 'brainstorm', 'contract.md'), 'utf-8')
    .catch(() => '')
  const progress = await fse
    .readJson(join(resolved.path, 'implementation', 'progress.json'))
    .catch(() => null)
  const completedTasks = Array.isArray(progress?.tasks)
    ? progress.tasks.filter((task) => task.status === 'completed').map((task) => task.id)
    : []
  const unresolvedTasks = Array.isArray(progress?.tasks)
    ? progress.tasks.filter((task) => task.status !== 'completed').map((task) => task.id)
    : []
  const verification = Array.isArray(progress?.verification)
    ? progress.verification.slice(0, 8).map((receipt) => {
        const command = inline(receipt.command)
        return `- ${receipt.status || 'unknown'}: \`${command}\` (${inline(receipt.revision || 'unknown revision')}; ${inline(receipt.scope || 'unspecified scope')})`
      })
    : []
  const artifact = shelf.artifact
  return `# Assignment shelf

- Assignment: ${status.id} — ${inline(status.description || resolved.name)}
- Lifecycle: shelved (terminal and immutable)
- Shelved at: ${shelf.shelved_at}
- Reason: ${inline(shelf.reason)}
- RippleGraph run: ${shelf.run_id}
- Assignment artifacts: \`${relativeToRepo(targetDir, resolved.path)}\`
- Shelf artifact: \`${artifact}\`
- Repository branch: ${inline(shelf.repository.branch || '(detached HEAD)')}
- Shelf Git commit: ${shelf.repository.commit}

## Prior objective

${boundedSection(contract, 'Objective and context', status.description || 'Not recorded.')}

## Prior decisions

${boundedSection(contract, 'Important decisions', 'No explicit prior decisions were recorded.')}

## Completed work

${completedTasks.length > 0 ? `Completed Task receipts: ${completedTasks.join(', ')}.` : 'No completed Task receipts were recorded before shelving.'}

## Unresolved work

${unresolvedTasks.length > 0 ? `Incomplete Task receipts: ${unresolvedTasks.join(', ')}.` : 'Use the prior artifacts and repository diff to reassess unfinished work.'}
Shelf reason: ${inline(shelf.reason)}

## Historical verification

${verification.length > 0 ? verification.join('\n') : 'No historical verification receipts were recorded. Historical evidence is never current successor evidence.'}
`
}

function shelfPayload(targetDir, resolved, status, runtime, idempotent) {
  return {
    command: 'assignment-shelf',
    version: 1,
    status: 'shelved',
    id: String(status.id),
    name: resolved.name,
    path: relativeToRepo(targetDir, resolved.path),
    shelf: status.shelf,
    immutable: true,
    idempotent,
    runtime_compaction: runtime,
    next_action: `specdev assignment --from-assignment=${status.id}`,
  }
}

function shelfReason(positionalArgs, flags) {
  const value = typeof flags.reason === 'string' ? flags.reason : positionalArgs.slice(1).join(' ')
  return String(value || '').trim()
}

function parseSnapshotPaths(value) {
  if (value === undefined) return null
  if (typeof value !== 'string') {
    throw new Error('--snapshot-paths requires a JSON array of repository-relative paths')
  }
  let parsed
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error('--snapshot-paths must be valid JSON, for example \'["src/file.js"]\'')
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    parsed.some(
      (path) =>
        typeof path !== 'string' ||
        !path.trim() ||
        path.startsWith('/') ||
        path === '..' ||
        path.startsWith('../') ||
        path.includes('/../')
    )
  ) {
    throw new Error('--snapshot-paths must be a non-empty JSON array of repository-relative paths')
  }
  return [...new Set(parsed.map((path) => path.replaceAll('\\', '/')))].sort()
}

function assertExactPaths(authorized, dirtyPaths) {
  const expected = [...new Set(dirtyPaths)].sort()
  const actual = [...new Set(authorized)].sort()
  if (expected.length !== actual.length || expected.some((path, index) => path !== actual[index])) {
    const missing = expected.filter((path) => !actual.includes(path))
    const extra = actual.filter((path) => !expected.includes(path))
    throw new Error(
      `Snapshot authorization must exactly match the current dirty paths. Missing: ${missing.join(', ') || 'none'}. Extra: ${extra.join(', ') || 'none'}.`
    )
  }
}

async function gitDirtyPaths(targetDir) {
  const output = await gitOutput(targetDir, [
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all',
  ])
  const records = output.split('\0')
  const paths = []
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    if (!record) continue
    const status = record.slice(0, 2)
    paths.push(record.slice(3))
    if (status.includes('R') || status.includes('C')) {
      const original = records[index + 1]
      if (original) paths.push(original)
      index += 1
    }
  }
  return [...new Set(paths.filter(Boolean).map((path) => path.replaceAll('\\', '/')))].sort()
}

async function gitText(targetDir, args) {
  return (await gitOutput(targetDir, args)).trim()
}

async function gitOutput(targetDir, args) {
  try {
    const { stdout } = await execFile('git', args, { cwd: targetDir })
    return stdout
  } catch (error) {
    throw new Error(error.stderr?.trim() || error.message)
  }
}

async function git(targetDir, args) {
  await gitOutput(targetDir, args)
}

function boundedSection(markdown, heading, fallback) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = String(markdown).match(
    new RegExp(`^##\\s+${escaped}\\s*$\\n([\\s\\S]*?)(?=^##\\s+|$)`, 'mi')
  )
  const value = String(match?.[1] || '').trim()
  if (!value) return fallback
  return value.length > 1_200 ? `${value.slice(0, 1_197).trimEnd()}...` : value
}

function inline(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replaceAll('`', "'")
}

function emit(flags, payload) {
  if (flags.json) console.log(JSON.stringify(payload, null, 2))
  else {
    console.log(`Assignment ${payload.id} is shelved and immutable.`)
    console.log(`Shelf: ${payload.shelf.artifact}`)
    console.log(`Git recovery boundary: ${payload.shelf.repository.commit}`)
    console.log(`Continue as a fresh Assignment: ${payload.next_action}`)
  }
  return payload
}

function fail(flags, message) {
  if (flags.json) {
    console.log(
      JSON.stringify({ command: 'assignment-shelf', version: 1, status: 'error', error: message })
    )
  } else console.error(message)
  process.exitCode = 1
  return null
}
