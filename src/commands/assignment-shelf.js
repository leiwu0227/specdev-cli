import { execFile as execFileCallback } from 'node:child_process'
import { createHash } from 'node:crypto'
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
import { commitDelivery, isConcurrentCallablePath } from '../utils/git-delivery.js'

const execFile = promisify(execFileCallback)
const TERMINAL_ASSIGNMENT_STATUSES = new Set(['completed', 'abandoned'])
const SNAPSHOT_COMMIT_TYPE = 'shelf-snapshot'
const TERMINAL_COMMIT_TYPE = 'shelf-terminal'
const SUMMARY_LIMIT = 8

export function shelfAssignmentHelp() {
  console.log(`Usage: specdev assignment shelf <id> --reason="<reason>" [--snapshot-token=<token>]

Shelve the active standalone Assignment as an immutable terminal record.

Options:
  --reason="<reason>"       Required reason recorded in shelf.md and status.json.
  --snapshot-token=<token> Short authorization for the displayed HEAD and dirty path set.
  --json                    Emit structured output.

Protocol:
  Clean work uses the pre-shelf HEAD as its recovery boundary. Dirty work first
  requires the exact token printed by this command, then creates one labelled
  snapshot-boundary commit. SpecDev writes and compacts the shelf state and
  creates a separate terminal shelf commit. Both commit hashes are returned.

Cache and concurrency:
  Tracked .specdev/cache/** entries are removed from Git tracking while their
  ignored local files are preserved. Cache-only dirt needs no snapshot token.
  Concurrent Discussion and Test Audit artifacts are reported and left unstaged.
  A live or unverified Assignment worker/reviewer blocks shelving.

Recovery:
  Rerun the exact same command after a Git or process interruption. A labelled
  snapshot commit is discovered by trailers and reused. Existing terminal
  metadata is compacted and committed if its terminal commit is missing. No
  recovery path resets commits, unstages changes, or deletes cache content.`)
}

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
    const snapshotToken =
      status.shelf.repository.snapshot_token ||
      (await snapshotTokenForBoundary(targetDir, status.shelf.repository.commit).catch(() => null))
    const recoveryCommand = shelfRecoveryCommand(status.id, status.shelf.reason, snapshotToken)
    try {
      return emit(
        flags,
        await finishShelfTransaction(targetDir, specdevPath, resolved, status, true)
      )
    } catch (error) {
      return fail(
        flags,
        `Could not finish idempotent shelf cleanup: ${error.message}\nRerun: ${recoveryCommand}`
      )
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
    boundary = await establishGitBoundary(targetDir, status.id, reason, flags)
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
      ...(boundary.token ? { snapshot_token: boundary.token } : {}),
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
    return emit(
      flags,
      await finishShelfTransaction(targetDir, specdevPath, resolved, nextStatus, false)
    )
  } catch (error) {
    return fail(
      flags,
      `Shelf boundary was recorded at ${boundary.commit}, but terminal cleanup did not finish: ${error.message}\nRerun: ${boundary.recoveryCommand}`
    )
  }
}

async function finishShelfTransaction(targetDir, specdevPath, resolved, status, idempotent) {
  const ownedPaths = await terminalOwnedPaths(targetDir, specdevPath, resolved, status)
  await assertTerminalIndexSafe(targetDir, ownedPaths)
  const existingTerminal = await findCommitWithTrailers(targetDir, {
    'SpecDev-Assignment': status.id,
    'SpecDev-Commit-Type': TERMINAL_COMMIT_TYPE,
  })
  const runtime = await finalizeShelvedRuntime(specdevPath, resolved.name, status)
  await stageTerminalPaths(targetDir, ownedPaths)
  await assertTerminalIndexSafe(targetDir, ownedPaths)

  let terminalCommit = existingTerminal?.hash || null
  if ((await gitStagedPaths(targetDir)).length > 0 || !terminalCommit) {
    terminalCommit = await commitDelivery(targetDir, {
      subject: `specdev(assignment): shelf ${status.id}`,
      trailers: {
        'SpecDev-Assignment': status.id,
        'SpecDev-Commit-Type': TERMINAL_COMMIT_TYPE,
      },
      allowEmpty: !terminalCommit,
    })
  }
  return shelfPayload(targetDir, resolved, status, runtime, idempotent, terminalCommit)
}

async function finalizeShelvedRuntime(specdevPath, assignmentName, status) {
  const path = runDir(specdevPath, status.run_id)
  if (await fse.pathExists(join(path, 'checkpoint.json'))) {
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
  }
  return compactShelvedWorkflowRuntime(specdevPath, {
    runId: status.run_id,
    attemptFilter: { assignment: assignmentName },
    terminalOwner: { assignment: assignmentName, status: status.status },
  })
}

async function establishGitBoundary(targetDir, assignmentId, reason, flags) {
  if (flags['snapshot-paths'] !== undefined) {
    throw new Error('--snapshot-paths is no longer supported; use the displayed --snapshot-token')
  }

  const recovered = await findCommitWithTrailers(targetDir, {
    'SpecDev-Assignment': assignmentId,
    'SpecDev-Commit-Type': SNAPSHOT_COMMIT_TYPE,
  })
  if (recovered) {
    const token = trailerValue(recovered.message, 'SpecDev-Snapshot-Token')
    return {
      branch: (await gitText(targetDir, ['branch', '--show-current'])) || null,
      commit: recovered.hash,
      snapshot: true,
      token,
      recoveryCommand: shelfRecoveryCommand(assignmentId, reason, token),
    }
  }

  const initial = await inspectShelfGitState(targetDir)
  if (!initial.head) throw new Error('Shelving requires a repository with an existing Git commit')
  if (initial.stagedConcurrentPaths.length > 0) {
    throw new Error(
      `Concurrent Discussion/Test Audit artifacts are already staged; shelving will not commit or unstage them: ${formatPathSummary(summarizePaths(initial.stagedConcurrentPaths))}`
    )
  }
  const expectedToken = snapshotToken(assignmentId, initial.head, initial.authorizedPaths)
  const suppliedToken = parseSnapshotToken(flags['snapshot-token'])
  if (initial.authorizedPaths.length > 0 && suppliedToken !== expectedToken) {
    throw new Error(
      snapshotDecisionMessage(
        assignmentId,
        reason,
        initial,
        expectedToken,
        suppliedToken ? 'The snapshot token no longer matches the current HEAD and path set.' : null
      )
    )
  }
  if (initial.authorizedPaths.length === 0 && suppliedToken) {
    throw new Error(
      snapshotDecisionMessage(
        assignmentId,
        reason,
        initial,
        null,
        'No snapshot token is needed because there are no non-disposable dirty paths.'
      )
    )
  }

  const current = await inspectShelfGitState(targetDir)
  assertUnchangedShelfState(initial, current, assignmentId, reason, suppliedToken)
  if (current.snapshotPaths.length === 0) {
    await retireTrackedCache(targetDir, current.trackedCachePaths)
    return {
      branch: current.branch,
      commit: current.head,
      snapshot: false,
      token: suppliedToken,
      recoveryCommand: shelfRecoveryCommand(assignmentId, reason, suppliedToken),
    }
  }

  await git(targetDir, ['--literal-pathspecs', 'add', '-A', '--', ...current.snapshotPaths])
  await retireTrackedCache(targetDir, current.trackedCachePaths)
  const beforeCommit = await inspectShelfGitState(targetDir)
  assertUnchangedShelfState(current, beforeCommit, assignmentId, reason, suppliedToken)
  const commit = await commitDelivery(targetDir, {
    subject: `specdev(assignment): shelf snapshot ${assignmentId}`,
    trailers: {
      'SpecDev-Assignment': assignmentId,
      'SpecDev-Commit-Type': SNAPSHOT_COMMIT_TYPE,
      'SpecDev-Snapshot-Token': suppliedToken,
    },
  })
  return {
    branch: (await gitText(targetDir, ['branch', '--show-current'])) || null,
    commit,
    snapshot: true,
    token: suppliedToken,
    recoveryCommand: shelfRecoveryCommand(assignmentId, reason, suppliedToken),
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

function shelfPayload(targetDir, resolved, status, runtime, idempotent, terminalCommit) {
  return {
    command: 'assignment-shelf',
    version: 1,
    status: 'shelved',
    id: String(status.id),
    name: resolved.name,
    path: relativeToRepo(targetDir, resolved.path),
    shelf: status.shelf,
    repository: {
      boundary_commit: status.shelf.repository.commit,
      terminal_commit: terminalCommit,
    },
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

function parseSnapshotToken(value) {
  if (value === undefined) return null
  if (typeof value !== 'string' || !/^[a-f0-9]{16}$/i.test(value.trim())) {
    throw new Error('--snapshot-token must be the 16-character token printed by this command')
  }
  return value.trim().toLowerCase()
}

function snapshotToken(assignmentId, head, paths) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        assignment: String(assignmentId),
        head: String(head),
        paths: [...new Set(paths)].sort(),
      })
    )
    .digest('hex')
    .slice(0, 16)
}

async function inspectShelfGitState(targetDir) {
  const [branch, head, dirtyPaths, trackedCachePaths, stagedPaths] = await Promise.all([
    gitText(targetDir, ['branch', '--show-current']),
    gitText(targetDir, ['rev-parse', 'HEAD']),
    gitDirtyPaths(targetDir),
    gitTrackedCachePaths(targetDir),
    gitStagedPaths(targetDir),
  ])
  const dirtyCachePaths = dirtyPaths.filter(isCachePath)
  const concurrentPaths = dirtyPaths.filter(
    (path) => !isCachePath(path) && isConcurrentCallablePath(path)
  )
  const authorizedPaths = dirtyPaths.filter((path) => !isCachePath(path))
  const snapshotPaths = authorizedPaths.filter((path) => !isConcurrentCallablePath(path))
  return {
    branch: branch || null,
    head,
    dirtyCachePaths,
    trackedCachePaths,
    concurrentPaths,
    stagedConcurrentPaths: stagedPaths.filter(isConcurrentCallablePath),
    authorizedPaths,
    snapshotPaths,
  }
}

function assertUnchangedShelfState(before, after, assignmentId, reason, suppliedToken) {
  if (after.stagedConcurrentPaths.length > 0) {
    throw new Error(
      `Concurrent Discussion/Test Audit artifacts became staged; shelving will not commit or unstage them: ${formatPathSummary(summarizePaths(after.stagedConcurrentPaths))}`
    )
  }
  const currentToken = snapshotToken(assignmentId, after.head, after.authorizedPaths)
  const expectedToken = snapshotToken(assignmentId, before.head, before.authorizedPaths)
  if (
    before.head !== after.head ||
    expectedToken !== currentToken ||
    (suppliedToken && suppliedToken !== currentToken)
  ) {
    throw new Error(
      snapshotDecisionMessage(
        assignmentId,
        reason,
        after,
        after.authorizedPaths.length > 0 ? currentToken : null,
        'HEAD or dirty path membership changed before the snapshot boundary.'
      )
    )
  }
}

function snapshotDecisionMessage(assignmentId, reason, state, token, prefix) {
  const authorized = summarizePaths(state.authorizedPaths)
  const cache = summarizePaths([...new Set([...state.dirtyCachePaths, ...state.trackedCachePaths])])
  const concurrent = summarizePaths(state.concurrentPaths)
  const lines = []
  if (prefix) lines.push(prefix)
  if (state.authorizedPaths.length > 0 && !prefix) {
    lines.push('Worktree changes require an explicit snapshot decision.')
  }
  lines.push(`HEAD: ${state.head || '(missing)'}`)
  lines.push(`Non-disposable dirty paths: ${formatPathSummary(authorized)}`)
  lines.push(
    `Disposable cache paths: ${formatPathSummary(cache)} (dirty ${state.dirtyCachePaths.length}, tracked ${state.trackedCachePaths.length})`
  )
  lines.push(`Concurrent callable paths left unstaged: ${formatPathSummary(concurrent)}`)
  if (token || state.authorizedPaths.length === 0) {
    lines.push(`Rerun: ${shelfRecoveryCommand(assignmentId, reason, token)}`)
  }
  return lines.join('\n')
}

function summarizePaths(paths) {
  const normalized = [...new Set(paths)].sort()
  return {
    count: normalized.length,
    preview: normalized.slice(0, SUMMARY_LIMIT),
    omitted: Math.max(0, normalized.length - SUMMARY_LIMIT),
  }
}

function formatPathSummary(summary) {
  if (summary.count === 0) return '0'
  const preview = summary.preview.join(', ')
  return `${summary.count} (${preview}${summary.omitted > 0 ? `, +${summary.omitted} more` : ''})`
}

function shelfRecoveryCommand(assignmentId, reason, token = null) {
  const safeReason = String(reason || '')
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
  return `specdev assignment shelf ${assignmentId} --reason="${safeReason}"${token ? ` --snapshot-token=${token}` : ''}`
}

function isCachePath(path) {
  return path === '.specdev/cache' || path.startsWith('.specdev/cache/')
}

async function gitTrackedCachePaths(targetDir) {
  const output = await gitOutput(targetDir, [
    'ls-files',
    '-z',
    '--',
    '.specdev/cache',
    '.specdev/cache/**',
  ])
  return output
    .split('\0')
    .map((path) => path.replaceAll('\\', '/'))
    .filter(Boolean)
    .sort()
}

async function retireTrackedCache(targetDir, paths) {
  if (paths.length === 0) return
  await git(targetDir, [
    '--literal-pathspecs',
    'rm',
    '--cached',
    '--force',
    '-r',
    '--ignore-unmatch',
    '--',
    ...paths,
  ])
}

async function terminalOwnedPaths(targetDir, specdevPath, resolved, status) {
  const attempts = await listAttemptRecords(specdevPath, { assignment: resolved.name })
  return [
    relativeToRepo(targetDir, join(resolved.path, 'shelf.md')),
    relativeToRepo(targetDir, join(resolved.path, 'status.json')),
    relativeToRepo(targetDir, runDir(specdevPath, status.run_id)),
    relativeToRepo(targetDir, join(specdevPath, '.ripplegraph', 'current.json')),
    ...attempts.map((attempt) =>
      relativeToRepo(targetDir, join(specdevPath, 'processes', `${attempt.id}.yaml`))
    ),
  ]
}

async function stageTerminalPaths(targetDir, paths) {
  const stageable = []
  for (const path of [...new Set(paths)]) {
    const exists = await fse.pathExists(join(targetDir, path))
    const tracked = Boolean(await gitText(targetDir, ['ls-files', '--', path]))
    if (exists || tracked) stageable.push(path)
  }
  if (stageable.length > 0) {
    await git(targetDir, ['--literal-pathspecs', 'add', '-A', '--', ...stageable])
  }
}

async function assertTerminalIndexSafe(targetDir, ownedPaths) {
  const staged = await gitStagedPaths(targetDir)
  const unexpected = staged.filter(
    (path) => !isCachePath(path) && !ownedPaths.some((owned) => pathWithin(path, owned))
  )
  if (unexpected.length > 0) {
    throw new Error(
      `Terminal shelf commit cannot include staged paths outside its ownership: ${formatPathSummary(summarizePaths(unexpected))}`
    )
  }
}

function pathWithin(path, root) {
  return path === root || path.startsWith(`${root}/`)
}

async function gitStagedPaths(targetDir) {
  const output = await gitOutput(targetDir, [
    'diff',
    '--cached',
    '--name-only',
    '--no-renames',
    '-z',
  ])
  return output
    .split('\0')
    .map((path) => path.replaceAll('\\', '/'))
    .filter(Boolean)
}

async function findCommitWithTrailers(targetDir, trailers) {
  const first = Object.entries(trailers)[0]
  const hashes = (
    await gitOutput(targetDir, [
      'log',
      'HEAD',
      '--format=%H',
      '--fixed-strings',
      `--grep=${first[0]}: ${first[1]}`,
    ])
  )
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  for (const hash of hashes) {
    const message = await gitOutput(targetDir, ['show', '-s', '--format=%B', hash])
    const matches = Object.entries(trailers).every(([key, value]) =>
      message.split(/\r?\n/).some((line) => line.trim() === `${key}: ${value}`)
    )
    if (matches) return { hash, message }
  }
  return null
}

function trailerValue(message, key) {
  const prefix = `${key}: `
  return (
    message
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.startsWith(prefix))
      ?.slice(prefix.length)
      .trim() || null
  )
}

async function snapshotTokenForBoundary(targetDir, hash) {
  const message = await gitOutput(targetDir, ['show', '-s', '--format=%B', hash])
  return trailerValue(message, 'SpecDev-Snapshot-Token')
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
    console.log(`Git recovery boundary: ${payload.repository.boundary_commit}`)
    console.log(`Terminal shelf commit: ${payload.repository.terminal_commit}`)
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
