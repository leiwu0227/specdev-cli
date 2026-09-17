import { lstatSync, readdirSync, unlinkSync, rmdirSync } from 'node:fs'
import { isAbsolute, relative, resolve, join } from 'node:path'

// All deletion is of individually revalidated entries; never follow a link or
// recursively remove a directory that may contain an unrelated new file.
export function safeStat(root, path) {
  const base = resolve(root)
  const target = resolve(path)
  const rel = relative(base, target)
  if (!rel || isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) {
    throw new Error(`cleanup path escapes its root: ${path}`)
  }
  let cursor = base
  for (const part of ['', ...rel.split(/[\\/]/)]) {
    if (part) cursor = join(cursor, part)
    let stat
    try {
      stat = lstatSync(cursor)
    } catch (error) {
      if (error.code === 'ENOENT') return null
      throw error
    }
    if (stat.isSymbolicLink()) throw new Error(`cleanup refuses symlink: ${cursor}`)
    if (cursor === target) return stat
    if (!stat.isDirectory()) throw new Error(`cleanup ancestor is not a directory: ${cursor}`)
  }
}

export function inspectTree(root, path) {
  const stat = safeStat(root, path)
  if (!stat) return []
  if (stat.isFile())
    return [{ path, bytes: stat.size, dev: stat.dev, ino: stat.ino, mtime: stat.mtimeMs }]
  if (!stat.isDirectory()) throw new Error(`cleanup refuses special file: ${path}`)
  return readdirSync(path)
    .sort()
    .flatMap((name) => inspectTree(root, join(path, name)))
}

export function removeInspectedFile(root, entry) {
  const stat = safeStat(root, entry.path)
  if (!stat) return
  if (
    !stat.isFile() ||
    stat.dev !== entry.dev ||
    stat.ino !== entry.ino ||
    stat.size !== entry.bytes ||
    stat.mtimeMs !== entry.mtime
  ) {
    throw new Error(`cleanup candidate changed: ${entry.path}`)
  }
  unlinkSync(entry.path)
}

export function removeSafeTree(root, path) {
  const files = inspectTree(root, path)
  // Keep the checkpoint until all disposable children have gone, so an
  // interrupted removal can still be validated through the normal engine API.
  files.sort(
    (a, b) =>
      Number(a.path.endsWith('/checkpoint.json')) - Number(b.path.endsWith('/checkpoint.json'))
  )
  for (const file of files) removeInspectedFile(root, file)
  removeEmptyDirectories(root, path)
}

export function removeEmptyDirectories(root, path) {
  const stat = safeStat(root, path)
  if (!stat?.isDirectory()) return
  for (const name of readdirSync(path)) {
    const child = join(path, name)
    if (safeStat(root, child)?.isDirectory()) removeEmptyDirectories(root, child)
  }
  try {
    rmdirSync(path)
  } catch (error) {
    if (!['ENOTEMPTY', 'EEXIST', 'ENOENT'].includes(error.code)) throw error
  }
}
