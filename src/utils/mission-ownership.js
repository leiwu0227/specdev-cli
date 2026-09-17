import { createHash } from 'node:crypto'
import { join, relative } from 'node:path'
import fse from 'fs-extra'
import { parse } from 'yaml'
import { execFile as callback } from 'node:child_process'
import { promisify } from 'node:util'
import { gitStatusPaths, gitStatusEntries } from './git-delivery.js'
import { readMissionQueue, writeMission } from './mission.js'

const execFile = promisify(callback)
const product = (path) => !path.startsWith('.specdev/') && path !== '.specdev'

function validatePath(path) {
  if (
    typeof path !== 'string' ||
    !path ||
    path.startsWith('/') ||
    path.includes('\\') ||
    path.split('/').some((part) => !part || part === '.' || part === '..') ||
    !product(path)
  ) {
    throw new Error(`Invalid product ownership path: ${JSON.stringify(path)}`)
  }
  return path
}

export async function missionPathDigest(targetDir, path) {
  try {
    const stat = await fse.lstat(join(targetDir, validatePath(path)))
    const bytes = stat.isSymbolicLink()
      ? await fse.readlink(join(targetDir, path))
      : await fse.readFile(join(targetDir, path))
    return createHash('sha256')
      .update(stat.isSymbolicLink() ? 'symlink:' : stat.mode & 0o111 ? 'executable:' : 'file:')
      .update(bytes)
      .digest('hex')
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

export async function ensureMissionProductBoundary(context, flags = {}) {
  if (context.mission.product_boundary) return
  const paths = (await gitStatusPaths(context.targetDir)).filter(product)
  let adopted = []
  if (flags['adopt-paths']) {
    const entries = await fse.readJson(join(context.targetDir, flags['adopt-paths']))
    if (!Array.isArray(entries))
      throw new Error('Mission adoption requires an exact JSON path array')
    adopted = [...new Set(entries.map(validatePath))].sort()
    if (JSON.stringify(adopted) !== JSON.stringify([...paths].sort())) {
      throw new Error('Mission adoption manifest must exactly match current dirty product paths')
    }
  }
  if (paths.length && !adopted.length) {
    throw new Error(
      `Unadopted dirty product paths: ${paths.join(', ')}. Explicit adoption requires --adopt-paths=<JSON-file> with the exact path array.`
    )
  }
  context.mission.product_boundary = {
    adopted_paths: adopted,
    established_at: new Date().toISOString(),
  }
  // Adoption authorizes implementation; it does not claim future edits at a
  // commit boundary. Those must still match the worker's final byte manifest.
  await writeMission(context.missionPath, context.mission)
}

export async function missionOwnedPaths(context) {
  const { targetDir, specdevPath, missionPath, mission } = context
  const queue = (await fse.pathExists(join(missionPath, 'design', 'assignments.yaml')))
    ? await readMissionQueue(missionPath)
    : { assignments: [] }
  const prefixes = [
    relative(targetDir, missionPath).replaceAll('\\', '/') + '/',
    `.specdev/.ripplegraph/runs/${mission.run_id}/`,
  ]
  const claims = new Map()
  for (const child of queue.assignments) {
    if (!child.folder) continue
    if (!/^\d{5}_[^/\\]+$/.test(child.folder)) throw new Error('Invalid child artifact identity')
    const root = join(specdevPath, 'assignments', child.folder)
    const status = await fse.readJson(join(root, 'status.json'))
    if (status.mission !== mission.id || String(status.id) !== String(child.id))
      throw new Error('Ambiguous child artifact ownership')
    prefixes.push(`.specdev/assignments/${child.folder}/`)
    if (status.run_id) prefixes.push(`.specdev/.ripplegraph/runs/${status.run_id}/`)
    const progress = await fse
      .readJson(join(root, 'implementation', 'progress.json'))
      .catch((error) => {
        if (error.code === 'ENOENT') return null
        throw error
      })
    for (const claim of progress?.owned_paths || []) {
      validatePath(claim.path)
      if (claim.sha256 !== null && !/^[a-f0-9]{64}$/.test(claim.sha256 || ''))
        throw new Error(`Missing byte identity for owned path ${claim.path}`)
      // Sequential later children may deliberately revise an earlier path.
      claims.set(claim.path, claim.sha256)
    }
  }
  const entries = await gitStatusEntries(targetDir)
  const dirty = entries.map((entry) => entry.path)
  const owned = []
  for (const path of dirty) {
    if (product(path)) {
      if (!claims.has(path)) continue
      if ((await missionPathDigest(targetDir, path)) !== claims.get(path))
        throw new Error(`Owned path changed after its worker manifest: ${path}`)
      const entry = entries.find((entry) => entry.path === path)
      if (entry.status !== '??' && entry.status[0] !== ' ' && entry.status[1] !== ' ') {
        throw new Error(`Overlapping staged and unstaged edits on owned path: ${path}`)
      }
      owned.push(path)
    } else if (
      prefixes.some((prefix) => path.startsWith(prefix)) ||
      [
        '.specdev/.current',
        '.specdev/.id-counters.json',
        '.specdev/.ripplegraph/current.json',
      ].includes(path)
    ) {
      owned.push(path)
    } else if (/^\.specdev\/processes\/Attempt-\d+\.yaml$/.test(path)) {
      let record
      try {
        record = parse(await fse.readFile(join(targetDir, path), 'utf8'))
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
        const { stdout } = await execFile('git', ['show', `HEAD:${path}`], { cwd: targetDir })
        record = parse(stdout)
      }
      if (record?.mission === mission.id) owned.push(path)
    }
  }
  return owned
}
