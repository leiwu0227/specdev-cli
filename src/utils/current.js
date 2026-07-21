import { join } from 'path'
import fse from 'fs-extra'
import { parse, stringify } from 'yaml'

const CURRENT_FILE = '.current'
const CURRENT_KINDS = new Set(['assignment', 'mission', 'discussion'])

export async function readCurrentFocus(specdevPath) {
  const filePath = join(specdevPath, CURRENT_FILE)
  if (!(await fse.pathExists(filePath))) return null
  const content = (await fse.readFile(filePath, 'utf-8')).trim()
  if (!content) return null

  let decoded
  try {
    decoded = parse(content)
  } catch {
    decoded = content
  }

  // Historical installations stored only the Assignment directory name.
  if (typeof decoded === 'string') {
    const match = decoded.match(/^(\d+)(?:_|$)/)
    if (!match) return null
    return { kind: 'assignment', id: match[1], legacyName: decoded }
  }

  if (!decoded || typeof decoded !== 'object') return null
  const kind = String(decoded.kind || '').trim()
  const id = String(decoded.id || '').trim()
  if (!CURRENT_KINDS.has(kind) || !id) return null
  return { kind, id }
}

/**
 * Compatibility reader for legacy Assignment-only callers. New code should
 * use readCurrentFocus() and explicit entity selectors.
 */
export async function readCurrent(specdevPath) {
  const focus = await readCurrentFocus(specdevPath)
  if (!focus) return null
  if (focus.kind !== 'assignment') return focus.id
  if (focus.legacyName) return focus.legacyName

  const resolved = await findAssignmentById(specdevPath, focus.id)
  return resolved?.name || focus.id
}

export async function writeCurrentFocus(specdevPath, focus) {
  if (!focus || !CURRENT_KINDS.has(focus.kind) || !String(focus.id || '').trim()) {
    throw new Error('current focus requires kind=assignment|mission|discussion and a non-empty id')
  }

  const filePath = join(specdevPath, CURRENT_FILE)
  const temporaryPath = `${filePath}.tmp-${process.pid}`
  const content = stringify({ kind: focus.kind, id: String(focus.id).trim() }, { lineWidth: 0 })
  await fse.writeFile(temporaryPath, content, 'utf-8')
  await fse.move(temporaryPath, filePath, { overwrite: true })
}

export async function writeCurrent(specdevPath, assignmentName) {
  const match = String(assignmentName || '').match(/^(\d+)(?:_|$)/)
  if (!match) throw new Error(`invalid Assignment focus: ${assignmentName}`)
  await writeCurrentFocus(specdevPath, { kind: 'assignment', id: match[1] })
}

export async function clearCurrent(specdevPath) {
  const filePath = join(specdevPath, CURRENT_FILE)
  if (await fse.pathExists(filePath)) {
    await fse.remove(filePath)
  }
}

export async function resolveCurrentAssignment(specdevPath) {
  const focus = await readCurrentFocus(specdevPath)
  if (!focus || focus.kind !== 'assignment') return { error: 'missing' }

  if (focus.legacyName) {
    const assignmentPath = join(specdevPath, 'assignments', focus.legacyName)
    if (await fse.pathExists(assignmentPath)) {
      return { name: focus.legacyName, path: assignmentPath }
    }
  }

  const resolved = await findAssignmentById(specdevPath, focus.id)
  if (!resolved) {
    await clearCurrent(specdevPath)
    return { error: 'stale', name: focus.legacyName || focus.id }
  }
  if (resolved.ambiguous) {
    return { error: 'ambiguous', name: focus.id, matches: resolved.matches }
  }
  return resolved
}

async function findAssignmentById(specdevPath, id) {
  const assignmentsDir = join(specdevPath, 'assignments')
  if (!(await fse.pathExists(assignmentsDir))) return null
  const wanted = Number(id)
  const entries = await fse.readdir(assignmentsDir, { withFileTypes: true })
  const matches = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => Number(name.match(/^(\d+)_/)?.[1]) === wanted)
    .sort()

  if (matches.length === 0) return null
  if (matches.length > 1) return { ambiguous: true, matches }
  return { name: matches[0], path: join(assignmentsDir, matches[0]) }
}
