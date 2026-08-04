import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)
const CONCURRENT_CALLABLE_ROOTS = ['.specdev/discussions', '.specdev/test-audits']

export async function requireGitHead(targetDir) {
  const head = await gitText(targetDir, ['rev-parse', '--verify', 'HEAD'])
  if (!head) throw new Error('A Git commit is required before this operation can start')
  return head
}

export async function currentGitBranch(targetDir) {
  return (await gitText(targetDir, ['branch', '--show-current'])) || null
}

export async function gitStatusPaths(targetDir) {
  const output = await gitOutput(targetDir, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
    '-z',
  ])
  const entries = output.split('\0').filter(Boolean)
  const paths = []
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    const code = entry.slice(0, 2)
    const path = entry.slice(3)
    if (path) paths.push(normalizePath(path))
    if ((code.includes('R') || code.includes('C')) && entries[index + 1]) {
      paths.push(normalizePath(entries[index + 1]))
      index += 1
    }
  }
  return [...new Set(paths)]
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

async function gitOutput(targetDir, args) {
  try {
    const { stdout } = await execFile('git', args, {
      cwd: targetDir,
      encoding: 'utf-8',
      maxBuffer: 4 * 1024 * 1024,
    })
    return stdout
  } catch (error) {
    if (error.code === 128 || error.code === 1) return ''
    throw error
  }
}

async function gitRun(targetDir, args) {
  try {
    await execFile('git', args, {
      cwd: targetDir,
      encoding: 'utf-8',
      maxBuffer: 4 * 1024 * 1024,
    })
  } catch (error) {
    const detail = String(error.stderr || error.stdout || error.message).trim()
    throw new Error(`Git command failed: git ${args.join(' ')}${detail ? `\n${detail}` : ''}`)
  }
}

function normalizePath(value) {
  return String(value || '')
    .trim()
    .replaceAll('\\', '/')
}
