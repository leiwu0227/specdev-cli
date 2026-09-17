import { join, relative } from 'node:path'
import fse from 'fs-extra'
import { isAttemptId, readAttemptRecord, attemptLiveness } from './process-record.js'
import {
  inspectTree,
  safeStat,
  removeInspectedFile,
  removeEmptyDirectories,
} from './retention-files.js'

export function artifactOwner(specdevPath, path) {
  const [family, name] = relative(specdevPath, path).split(/[\\/]/)
  if (family === 'assignments' && /^\d{5}_[^/\\]+$/.test(name || '')) return { assignment: name }
  if (family === 'missions' && /^M\d{5}(?:_[^/\\]+)?$/.test(name || ''))
    return { mission: name.match(/^M\d{5}/)[0] }
  if (family === 'discussions' && /^D\d{4,5}_[^/\\]+$/.test(name || ''))
    return { discussion: name.match(/^D\d{4,5}/)[0] }
  return null
}

export function ownerDirectory(owner) {
  const entries = Object.entries(owner || {})
  if (entries.length !== 1) throw new Error('cleanup requires one owner')
  const [kind, id] = entries[0]
  if (
    !['assignment', 'mission', 'discussion'].includes(kind) ||
    !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(id)
  )
    throw new Error('invalid cleanup owner')
  return `${kind}--${id}`
}

export function matchesOwner(attempt, owner) {
  const [kind, id] = Object.entries(owner)[0]
  return attempt[kind] === id
}

export async function retentionAttempts(specdevPath) {
  const dir = join(specdevPath, 'processes')
  if (!safeStat(specdevPath, dir)) return []
  const attempts = []
  for (const name of await fse.readdir(dir)) {
    if (!name.endsWith('.yaml') || !isAttemptId(name.slice(0, -5))) continue
    const id = name.slice(0, -5)
    const stat = safeStat(specdevPath, join(dir, name))
    if (!stat?.isFile()) throw new Error(`invalid cleanup Attempt file: ${name}`)
    const attempt = await readAttemptRecord(specdevPath, id)
    if (attempt?.id !== id) throw new Error(`mismatched cleanup Attempt identity: ${name}`)
    attempts.push(attempt)
  }
  return attempts
}

export async function assertInactiveAttempts(specdevPath, attempts) {
  for (const attempt of attempts) {
    if (!isAttemptId(attempt.id)) throw new Error('invalid cleanup Attempt identity')
    if (
      attempt.status === 'running' ||
      !['completed', 'failed', 'blocked', 'interrupted'].includes(attempt.status)
    ) {
      throw new Error(`cannot clean running or uncertain Attempt: ${attempt.id}`)
    }
    const marker = join(specdevPath, 'cache', 'processes', `${attempt.id}.json`)
    if (safeStat(specdevPath, marker)) {
      const live = await attemptLiveness(specdevPath, attempt.id)
      if (live.state !== 'stale')
        throw new Error(`cannot clean live or uncertain Attempt: ${attempt.id}`)
    }
    safeStat(specdevPath, join(specdevPath, 'processes', `${attempt.id}.yaml`))
  }
}

export async function ownedCacheFiles(specdevPath, owner, attempts, extraOwners = []) {
  const ids = new Set(attempts.map((attempt) => attempt.id))
  const files = []
  for (const folder of ['attempts', 'processes', 'retired-artifacts']) {
    const dir = join(specdevPath, 'cache', folder)
    if (!safeStat(specdevPath, dir)) continue
    for (const name of await fse.readdir(dir)) {
      const id = name.match(/^((?:Attempt|ATT)-(?:\d{5}-\d+|\d+))(?=[.-])/)?.[1]
      if (id && ids.has(id)) files.push(...inspectTree(specdevPath, join(dir, name)))
    }
  }
  for (const candidate of [owner, ...extraOwners]) {
    const dir = join(specdevPath, 'cache', 'retired-artifacts', ownerDirectory(candidate))
    files.push(...inspectTree(specdevPath, dir))
    if (candidate.assignment) {
      files.push(
        ...inspectTree(
          specdevPath,
          join(specdevPath, 'cache', 'reviewer-continuations', `${candidate.assignment}.json`)
        )
      )
    }
    if (candidate.mission)
      files.push(
        ...inspectTree(specdevPath, join(specdevPath, 'cache', 'missions', candidate.mission))
      )
  }
  return [...new Map(files.map((file) => [file.path, file])).values()]
}

export async function cleanOwnedCache(
  specdevPath,
  owner,
  { extraOwners = [], validate = async () => {} } = {}
) {
  ownerDirectory(owner)
  const allAttempts = await retentionAttempts(specdevPath)
  const owns = (attempt) =>
    [owner, ...extraOwners].some((candidate) => matchesOwner(attempt, candidate))
  const attempts = allAttempts.filter(owns)
  await assertInactiveAttempts(specdevPath, attempts)
  const files = await ownedCacheFiles(specdevPath, owner, attempts, extraOwners)
  await validate()
  await assertInactiveAttempts(specdevPath, (await retentionAttempts(specdevPath)).filter(owns))
  for (const file of files) removeInspectedFile(specdevPath, file)
  for (const candidate of [owner, ...extraOwners]) {
    removeEmptyDirectories(
      specdevPath,
      join(specdevPath, 'cache', 'retired-artifacts', ownerDirectory(candidate))
    )
    if (candidate.mission)
      removeEmptyDirectories(specdevPath, join(specdevPath, 'cache', 'missions', candidate.mission))
  }
  return files
}
