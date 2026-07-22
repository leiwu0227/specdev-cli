import { execFile as execFileCallback } from 'node:child_process'
import { lstat, realpath } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { promisify } from 'node:util'
import fse from 'fs-extra'

const execFile = promisify(execFileCallback)
const SLOT_PATTERN = /^slot-(0[1-9]|[1-9]\d)$/

export function missionChildBranch(missionId, childId) {
  if (!/^M\d{5}$/.test(String(missionId))) throw new Error('invalid Mission ID for child branch')
  if (!/^\d{5}$/.test(String(childId))) throw new Error('invalid Assignment ID for child branch')
  return `specdev/${missionId}/${childId}`
}

export function missionWorktreeRelativePath(slot) {
  if (!SLOT_PATTERN.test(String(slot))) throw new Error(`invalid Mission worktree slot: ${slot}`)
  return `.specdev/worktrees/${slot}`
}

export async function listMissionWorktrees(projectRoot, specdevPath) {
  const poolRoot = await canonicalPath(resolve(specdevPath, 'worktrees'))
  const { stdout } = await execFile('git', ['worktree', 'list', '--porcelain'], {
    cwd: projectRoot,
  })
  const records = []
  let record = {}
  for (const line of `${stdout}\n`.split('\n')) {
    if (!line.trim()) {
      if (record.worktree) records.push(record)
      record = {}
      continue
    }
    const [key, ...rest] = line.split(' ')
    const value = rest.join(' ').trim()
    if (key === 'worktree') record.worktree = value
    if (key === 'HEAD') record.revision = value
    if (key === 'branch') record.branch = value.replace(/^refs\/heads\//, '')
    if (key === 'detached') record.detached = true
  }
  const normalized = []
  for (const item of records) {
    const worktree = await canonicalPath(item.worktree)
    if (isWithin(poolRoot, worktree)) normalized.push({ ...item, worktree })
  }
  return normalized
}

export async function ensureMissionWorktree({
  projectRoot,
  specdevPath,
  slot,
  branch,
  baseRevision,
}) {
  const relativePath = missionWorktreeRelativePath(slot)
  await assertIgnoredPoolPath(projectRoot, relativePath)
  await fse.ensureDir(resolve(specdevPath, 'worktrees'))
  const poolRoot = await canonicalPath(resolve(specdevPath, 'worktrees'))
  const worktreePath = resolve(poolRoot, slot)
  assertWithin(poolRoot, worktreePath)

  const registered = await listMissionWorktrees(projectRoot, specdevPath)
  const matchingBranch = registered.find((item) => item.branch === branch)
  if (matchingBranch) {
    assertWithin(poolRoot, matchingBranch.worktree)
    await assertNotSymlink(matchingBranch.worktree)
    await assertBranchDescendsFrom(projectRoot, branch, baseRevision)
    return { path: matchingBranch.worktree, relativePath, branch, recovered: true }
  }
  const occupied = registered.find((item) => item.worktree === worktreePath)
  if (occupied)
    throw new Error(`${slot} is already leased to ${occupied.branch || 'detached HEAD'}`)
  if (await fse.pathExists(worktreePath)) {
    await assertNotSymlink(worktreePath)
    const entries = await fse.readdir(worktreePath)
    if (entries.length > 0) throw new Error(`${slot} exists but is not a registered Git worktree`)
  }

  const branchExists = await gitSucceeds(projectRoot, [
    'show-ref',
    '--verify',
    '--quiet',
    `refs/heads/${branch}`,
  ])
  if (branchExists) await assertBranchDescendsFrom(projectRoot, branch, baseRevision)
  const args = branchExists
    ? ['worktree', 'add', worktreePath, branch]
    : ['worktree', 'add', '-b', branch, worktreePath, baseRevision]
  await execFile('git', args, { cwd: projectRoot })
  await assertNotSymlink(worktreePath)
  return { path: worktreePath, relativePath, branch, recovered: branchExists }
}

export async function removeMissionWorktree({ projectRoot, specdevPath, worktreePath }) {
  const requestedPath = resolve(worktreePath)
  await assertNotSymlink(requestedPath)
  const poolRoot = await canonicalPath(resolve(specdevPath, 'worktrees'))
  const absolutePath = await canonicalPath(requestedPath)
  assertWithin(poolRoot, absolutePath)
  const registered = await listMissionWorktrees(projectRoot, specdevPath)
  if (!registered.some((item) => item.worktree === absolutePath)) {
    throw new Error('refusing to remove an unregistered Mission worktree')
  }
  await execFile('git', ['worktree', 'remove', absolutePath], { cwd: projectRoot })
}

export async function createMissionChildDelivery({
  worktreePath,
  missionPath,
  missionId,
  childId,
  wave,
}) {
  const missionRelative = repoRelative(worktreePath, missionPath)
  if (!missionRelative?.startsWith('.specdev/missions/')) {
    throw new Error('Mission path is outside the child worktree')
  }
  const sharedPaths = [
    '.specdev/.current',
    '.specdev/.id-counters.json',
    '.specdev/.ripplegraph',
    missionRelative,
  ]
  const trackedSharedPaths = []
  for (const path of sharedPaths) {
    const { stdout } = await execFile('git', ['ls-files', '--', path], { cwd: worktreePath })
    if (stdout.trim()) trackedSharedPaths.push(path)
  }
  if (trackedSharedPaths.length > 0) {
    await execFile(
      'git',
      ['restore', '--source=HEAD', '--staged', '--worktree', '--', ...trackedSharedPaths],
      { cwd: worktreePath }
    )
  }
  await execFile('git', ['clean', '-fd', '--', ...sharedPaths], { cwd: worktreePath })
  await execFile('git', ['add', '-A'], { cwd: worktreePath })
  if (await gitSucceeds(worktreePath, ['diff', '--cached', '--quiet'])) {
    const { stdout: message } = await execFile('git', ['log', '-1', '--format=%B'], {
      cwd: worktreePath,
    })
    if (
      message.includes(`SpecDev-Mission: ${missionId}`) &&
      message.includes(`SpecDev-Assignment: ${childId}`) &&
      message.includes(`SpecDev-Wave: ${wave}`) &&
      message.includes('SpecDev-Commit-Type: child-delivery')
    ) {
      const { stdout } = await execFile('git', ['rev-parse', 'HEAD'], { cwd: worktreePath })
      return stdout.trim()
    }
    throw new Error(`Child ${childId} produced no deliverable changes`)
  }
  await execFile(
    'git',
    [
      'commit',
      '-m',
      `specdev(${missionId}): deliver ${childId}`,
      '-m',
      `SpecDev-Mission: ${missionId}\nSpecDev-Assignment: ${childId}\nSpecDev-Wave: ${wave}\nSpecDev-Commit-Type: child-delivery`,
    ],
    { cwd: worktreePath }
  )
  const { stdout } = await execFile('git', ['rev-parse', 'HEAD'], { cwd: worktreePath })
  return stdout.trim()
}

async function assertIgnoredPoolPath(projectRoot, relativePath) {
  if (!(await gitSucceeds(projectRoot, ['check-ignore', '--quiet', '--', relativePath]))) {
    throw new Error('.specdev/worktrees must be Git-ignored before parallel Mission execution')
  }
  if (await gitSucceeds(projectRoot, ['ls-files', '--error-unmatch', '--', relativePath])) {
    throw new Error('Mission worktree slot is tracked by Git')
  }
}

async function assertNotSymlink(path) {
  try {
    const info = await lstat(path)
    if (info.isSymbolicLink()) throw new Error(`Mission worktree path is a symlink: ${path}`)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

async function assertBranchDescendsFrom(projectRoot, branch, baseRevision) {
  if (!(await gitSucceeds(projectRoot, ['merge-base', '--is-ancestor', baseRevision, branch]))) {
    throw new Error(`Mission child branch ${branch} does not descend from its recorded wave base`)
  }
}

function assertWithin(parent, child) {
  if (!isWithin(parent, child)) throw new Error('Mission worktree escaped the expected pool root')
}

function isWithin(parent, child) {
  const rel = relative(resolve(parent), resolve(child))
  return (
    Boolean(rel) &&
    rel !== '..' &&
    !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
  )
}

function repoRelative(root, path) {
  const value = relative(root, path).replaceAll('\\', '/')
  return value && value !== '..' && !value.startsWith('../') ? value : null
}

async function gitSucceeds(cwd, args) {
  try {
    await execFile('git', args, { cwd })
    return true
  } catch {
    return false
  }
}

async function canonicalPath(path) {
  try {
    return await realpath(path)
  } catch (error) {
    if (error.code === 'ENOENT') return resolve(path)
    throw error
  }
}
