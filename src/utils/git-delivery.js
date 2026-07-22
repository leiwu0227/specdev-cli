import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)

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

export async function stageAll(targetDir) {
  await gitRun(targetDir, ['add', '--all'])
}

export async function commitDelivery(targetDir, { subject, trailers }) {
  const trailerText = Object.entries(trailers)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim())
    .map(([key, value]) => `${key}: ${String(value).trim()}`)
    .join('\n')
  const args = ['commit', '-m', subject]
  if (trailerText) args.push('-m', trailerText)
  await gitRun(targetDir, args)
  return requireGitHead(targetDir)
}

export async function findCommitByTrailer(targetDir, key, value, options = {}) {
  const needle = `${key}: ${value}`
  const revision = options.revision || '--all'
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
    if (message.split(/\r?\n/).some((line) => line.trim() === needle)) return hash
  }
  return null
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
