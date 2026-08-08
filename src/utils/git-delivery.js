import { execFile as execFileCallback } from 'node:child_process'
import { lstat, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)
const CONCURRENT_CALLABLE_ROOTS = ['.specdev/discussions', '.specdev/test-audits']
const CONCURRENT_CALL_ROOT = '.specdev/.ripplegraph/calls'

export async function requireGitHead(targetDir) {
  const head = await gitText(targetDir, ['rev-parse', '--verify', 'HEAD'])
  if (!head) throw new Error('A Git commit is required before this operation can start')
  return head
}

export async function currentGitBranch(targetDir) {
  return (await gitText(targetDir, ['branch', '--show-current'])) || null
}

export async function gitStatusPaths(targetDir) {
  return (await gitStatusEntries(targetDir)).map((entry) => entry.path)
}

export async function gitStatusEntries(targetDir) {
  const output = await gitOutput(targetDir, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
    '-z',
  ])
  const entries = output.split('\0').filter(Boolean)
  const paths = new Map()
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    const status = entry.slice(0, 2)
    const path = entry.slice(3)
    if (path) recordStatusPath(paths, path, status, 'path')
    if ((status.includes('R') || status.includes('C')) && entries[index + 1]) {
      recordStatusPath(paths, entries[index + 1], status, 'source')
      index += 1
    }
  }
  return [...paths.values()].sort((left, right) => left.path.localeCompare(right.path))
}

export function summarizeGitPaths(paths, limit = 12) {
  const normalized = [...new Set(paths.map(normalizePath).filter(Boolean))]
  return {
    count: normalized.length,
    preview: normalized.slice(0, Math.max(1, limit)),
    omitted: Math.max(0, normalized.length - Math.max(1, limit)),
  }
}

export function isConcurrentCallablePath(path) {
  const normalized = normalizePath(path)
  return CONCURRENT_CALLABLE_ROOTS.some(
    (root) => normalized === root || normalized.startsWith(`${root}/`)
  )
}

export function concurrentCallablePathDetails(path) {
  const normalized = normalizePath(path)
  const discussion = normalized.match(/^\.specdev\/discussions\/(D\d{4,5})(?:_|\/|$)/)
  if (discussion) return callablePathDetails(normalized, 'Discussion', discussion[1])
  const audit = normalized.match(/^\.specdev\/test-audits\/(TA\d{5})(?:_|\/|$)/)
  if (audit) return callablePathDetails(normalized, 'Test Audit', audit[1])
  const call = normalized.match(/^\.specdev\/\.ripplegraph\/calls\/(D\d{4,5}|TA\d{5})(?:\/|$)/)
  if (call) {
    return callablePathDetails(
      normalized,
      call[1].startsWith('TA') ? 'Test Audit' : 'Discussion',
      call[1]
    )
  }
  if (
    CONCURRENT_CALLABLE_ROOTS.some(
      (root) => normalized === root || normalized.startsWith(`${root}/`)
    ) ||
    normalized === CONCURRENT_CALL_ROOT ||
    normalized.startsWith(`${CONCURRENT_CALL_ROOT}/`)
  ) {
    return {
      path: normalized,
      owner: 'concurrent callable namespace',
      reason: 'reserved_concurrent_callable_path',
      next_action:
        'Complete, cancel, or separately checkpoint the owning Discussion or Test Audit before adopting this path.',
    }
  }
  return null
}

export async function stageOwnedChanges(targetDir) {
  const exclusions = CONCURRENT_CALLABLE_ROOTS.map((root) => `:(exclude,glob)${root}/**`)
  await gitRun(targetDir, ['add', '--all', '--', '.', ...exclusions])

  const staged = (
    await gitOutput(targetDir, ['diff', '--cached', '--name-only', '--no-renames', '-z'])
  )
    .split('\0')
    .map(normalizePath)
    .filter(isConcurrentCallablePath)
  if (staged.length > 0) {
    await gitRun(targetDir, ['restore', '--staged', '--', ...new Set(staged)])
  }
}

export async function commitExactDelivery(
  targetDir,
  { expectedHead, paths, subject, trailers, finalizeDraft }
) {
  const authorizedPaths = canonicalPathSet(paths)
  if (authorizedPaths.length === 0) throw new Error('Exact delivery requires at least one path')
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'specdev-adhoc-index-'))
  const indexFile = join(temporaryDirectory, 'index')
  const environment = { ...process.env, GIT_INDEX_FILE: indexFile }
  try {
    await gitRun(targetDir, ['read-tree', expectedHead], environment)
    await stageLiteralPaths(targetDir, authorizedPaths, environment)
    await assertExactStagedPaths(targetDir, authorizedPaths, environment)

    const draftTree = (await gitOutputStrict(targetDir, ['write-tree'], environment)).trim()
    const draftCommit = await createCommitObject(targetDir, {
      tree: draftTree,
      parent: expectedHead,
      subject,
      trailers,
      environment,
    })
    const draftPaths = await gitChangedPathsAtCommit(targetDir, draftCommit)
    if (finalizeDraft) await finalizeDraft({ commit: draftCommit, committedPaths: draftPaths })

    await stageLiteralPaths(targetDir, authorizedPaths, environment)
    await assertExactStagedPaths(targetDir, authorizedPaths, environment)
    const finalTree = (await gitOutputStrict(targetDir, ['write-tree'], environment)).trim()
    const finalCommit = await createCommitObject(targetDir, {
      tree: finalTree,
      parent: expectedHead,
      subject,
      trailers,
      environment,
    })
    const committedPaths = await gitChangedPathsAtCommit(targetDir, finalCommit)
    assertSamePaths(committedPaths, authorizedPaths, 'Delivery commit path set')
    await gitRun(targetDir, ['update-ref', 'HEAD', finalCommit, expectedHead])
    await synchronizeIndexPaths(targetDir, committedPaths, finalCommit)
    return { commit: finalCommit, committedPaths }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

export async function synchronizeIndexPaths(targetDir, paths, revision = 'HEAD') {
  const normalized = canonicalPathSet(paths)
  if (normalized.length === 0) return
  await gitRun(targetDir, [
    '--literal-pathspecs',
    'reset',
    '--quiet',
    revision,
    '--',
    ...normalized,
  ])
}

export async function commitDelivery(targetDir, { subject, trailers, allowEmpty = false }) {
  const trailerText = Object.entries(trailers)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim())
    .map(([key, value]) => `${key}: ${String(value).trim()}`)
    .join('\n')
  const args = ['commit', '-m', subject]
  if (trailerText) args.push('-m', trailerText)
  if (allowEmpty) args.push('--allow-empty')
  await gitRun(targetDir, args)
  return requireGitHead(targetDir)
}

export async function findCommitByTrailer(targetDir, key, value, options = {}) {
  return (await findCommitsByTrailer(targetDir, key, value, options))[0] || null
}

export async function findCommitsByTrailer(targetDir, key, value, options = {}) {
  const needle = `${key}: ${value}`
  const revision = options.revision || '--all'
  const matches = []
  const output = await gitOutput(targetDir, [
    'log',
    revision,
    '--format=%H',
    '--fixed-strings',
    `--grep=${needle}`,
  ])
  for (const hash of output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)) {
    const message = await gitOutput(targetDir, ['show', '-s', '--format=%B', hash])
    if (message.split(/\r?\n/).some((line) => line.trim() === needle)) matches.push(hash)
  }
  return matches
}

export async function gitChangedPathsAtCommit(targetDir, revision) {
  const output = await gitOutput(targetDir, [
    'diff-tree',
    '--root',
    '--no-commit-id',
    '--name-only',
    '--no-renames',
    '-r',
    '-z',
    revision,
  ])
  return [...new Set(output.split('\0').map(normalizePath).filter(Boolean))].sort()
}

export async function gitCommitSubject(targetDir, revision) {
  return gitText(targetDir, ['show', '-s', '--format=%s', revision])
}

export async function findCommitAddingPath(targetDir, path) {
  const output = await gitOutput(targetDir, [
    'log',
    '--all',
    '--diff-filter=A',
    '--format=%H',
    '--',
    normalizePath(path),
  ])
  return (
    output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) || null
  )
}

export async function firstParent(targetDir, revision) {
  return (await gitText(targetDir, ['rev-parse', `${revision}^`])) || null
}

async function gitText(targetDir, args) {
  try {
    return (await gitOutput(targetDir, args)).trim()
  } catch {
    return ''
  }
}

async function gitOutput(targetDir, args, environment = process.env) {
  try {
    const { stdout } = await execFile('git', args, {
      cwd: targetDir,
      env: environment,
      encoding: 'utf-8',
      maxBuffer: 4 * 1024 * 1024,
    })
    return stdout
  } catch (error) {
    if (error.code === 128 || error.code === 1) return ''
    throw error
  }
}

async function gitOutputStrict(targetDir, args, environment = process.env) {
  try {
    const { stdout } = await execFile('git', args, {
      cwd: targetDir,
      env: environment,
      encoding: 'utf-8',
      maxBuffer: 4 * 1024 * 1024,
    })
    return stdout
  } catch (error) {
    const detail = String(error.stderr || error.stdout || error.message).trim()
    throw new Error(`Git command failed: git ${args.join(' ')}${detail ? `\n${detail}` : ''}`)
  }
}

async function gitRun(targetDir, args, environment = process.env) {
  try {
    await execFile('git', args, {
      cwd: targetDir,
      env: environment,
      encoding: 'utf-8',
      maxBuffer: 4 * 1024 * 1024,
    })
  } catch (error) {
    const detail = String(error.stderr || error.stdout || error.message).trim()
    throw new Error(`Git command failed: git ${args.join(' ')}${detail ? `\n${detail}` : ''}`)
  }
}

function normalizePath(value) {
  const normalized = String(value || '').replaceAll('\\', '/')
  if (!normalized) return ''
  if (
    normalized.startsWith('/') ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split('/').some((segment) => segment === '.' || segment === '..' || !segment)
  ) {
    throw new Error(`Git returned an unsafe repository-relative path: ${JSON.stringify(value)}`)
  }
  return normalized
}

function recordStatusPath(paths, value, status, role) {
  const path = normalizePath(value)
  if (!path) return
  const existing = paths.get(path)
  if (!existing || existing.role === 'source') paths.set(path, { path, status, role })
}

function callablePathDetails(path, kind, id) {
  return {
    path,
    owner: `${kind} ${id}`,
    reason: 'owned_by_concurrent_callable',
    next_action: `Complete, cancel, or separately checkpoint ${kind} ${id} before adopting this path.`,
  }
}

function canonicalPathSet(paths) {
  return [...new Set(paths.map(normalizePath).filter(Boolean))].sort()
}

async function stageLiteralPaths(targetDir, paths, environment) {
  const present = []
  const absent = []
  for (const path of canonicalPathSet(paths)) {
    try {
      await lstat(join(targetDir, path))
      present.push(path)
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      absent.push(path)
    }
  }
  if (present.length > 0) {
    await gitRun(targetDir, ['--literal-pathspecs', 'add', '-A', '--', ...present], environment)
  }
  if (absent.length > 0) {
    await gitRun(
      targetDir,
      ['--literal-pathspecs', 'update-index', '--remove', '--', ...absent],
      environment
    )
  }
}

async function stagedPaths(targetDir, environment) {
  const output = await gitOutputStrict(
    targetDir,
    ['diff', '--cached', '--name-only', '--no-renames', '-z'],
    environment
  )
  return canonicalPathSet(output.split('\0'))
}

async function assertExactStagedPaths(targetDir, expectedPaths, environment) {
  const actualPaths = await stagedPaths(targetDir, environment)
  assertSamePaths(actualPaths, canonicalPathSet(expectedPaths), 'Staged path set')
}

function assertSamePaths(actual, expected, label) {
  const actualPaths = canonicalPathSet(actual)
  const expectedPaths = canonicalPathSet(expected)
  const missing = expectedPaths.filter((path) => !actualPaths.includes(path))
  const unexpected = actualPaths.filter((path) => !expectedPaths.includes(path))
  if (missing.length === 0 && unexpected.length === 0) return
  const error = new Error(
    `${label} mismatch; missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'}`
  )
  error.code = 'exact_path_mismatch'
  error.missingPaths = missing
  error.unexpectedPaths = unexpected
  throw error
}

async function createCommitObject(
  targetDir,
  { tree, parent, subject, trailers, environment = process.env }
) {
  const trailerText = Object.entries(trailers || {})
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim())
    .map(([key, value]) => `${key}: ${String(value).trim()}`)
    .join('\n')
  const args = ['commit-tree', tree, '-p', parent, '-m', subject]
  if (trailerText) args.push('-m', trailerText)
  return (await gitOutputStrict(targetDir, args, environment)).trim()
}
