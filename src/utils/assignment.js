import { isAbsolute, join, relative, resolve } from 'path'
import fse from 'fs-extra'
import { resolveCurrentAssignment } from './current.js'
import { resolveTargetDir, requireSpecdevDirectory } from './command-context.js'

/**
 * Parse assignment directory name into components
 * e.g. "00001_feature_auth" -> { id: "00001", type: "feature", label: "auth" }
 */
export function parseAssignmentId(name) {
  const match = name.match(/^(\d+)_(\w+?)_(.+)$/)
  if (match) return { id: match[1], type: match[2], label: match[3] }
  const current = name.match(/^(\d+)_(.+)$/)
  if (current) return { id: current[1], type: null, label: current[2] }
  return { id: null, type: null, label: name }
}

/**
 * Resolve an assignment selector to a concrete assignment path.
 * Supports:
 * - full assignment directory name (e.g. 00001_feature_auth)
 * - numeric assignment id (e.g. 1, 00001)
 * - absolute assignment path
 */
export async function resolveAssignmentSelector(specdevPath, selector) {
  if (typeof selector !== 'string') return null
  const wanted = selector.trim()
  if (!wanted) return null

  const assignmentsDir = join(specdevPath, 'assignments')

  // Full folder names and absolute paths are allowed only when they resolve to
  // a direct child of this repository's assignments directory.
  const explicitPath = isAbsolute(wanted) ? resolve(wanted) : join(assignmentsDir, wanted)
  const explicitRelative = relative(assignmentsDir, explicitPath)
  const directAssignment =
    explicitRelative &&
    !explicitRelative.includes('/') &&
    !explicitRelative.includes('\\') &&
    /^\d+_[^/\\]+$/.test(explicitRelative)
  if (
    directAssignment &&
    (await fse.pathExists(explicitPath)) &&
    (await fse.stat(explicitPath)).isDirectory()
  ) {
    return { path: explicitPath, name: assignmentName(explicitPath) }
  }

  // Numeric shorthand: match by parsed assignment id.
  if (/^\d+$/.test(wanted)) {
    if (!(await fse.pathExists(assignmentsDir))) return null
    const entries = await fse.readdir(assignmentsDir, { withFileTypes: true })
    const wantedId = Number(wanted)
    const matches = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => {
        const parsed = parseAssignmentId(name)
        return parsed.id !== null && Number(parsed.id) === wantedId
      })

    if (matches.length === 1) {
      const name = matches[0]
      return { path: join(assignmentsDir, name), name }
    }

    if (matches.length > 1) {
      return { ambiguous: true, matches, wanted }
    }
  }

  return null
}

/**
 * Resolve assignment path from .current pointer
 */
export async function resolveAssignmentPath(flags) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  if (typeof flags.assignment === 'string') {
    const explicit = await resolveAssignmentSelector(specdevPath, flags.assignment)
    if (!explicit || explicit.ambiguous) {
      console.error(`❌ Assignment selector is not unique or was not found: ${flags.assignment}`)
      process.exit(1)
    }
    return explicit.path
  }

  const current = await resolveCurrentAssignment(specdevPath)

  if (current.error === 'stale') {
    console.error(
      `❌ Active assignment "${current.name}" not found. Run specdev focus <id> to set a valid assignment.`
    )
    process.exit(1)
  }

  if (current.error === 'missing') {
    const assignmentsDir = join(specdevPath, 'assignments')
    if (await fse.pathExists(assignmentsDir)) {
      const entries = await fse.readdir(assignmentsDir, { withFileTypes: true })
      const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name)
      if (dirs.length > 0) {
        console.error('❌ No active assignment. Run specdev focus <id> to set one.')
        console.error('   Available:')
        for (const d of dirs) {
          console.error(`   - ${d}`)
        }
        process.exit(1)
      }
    }
    console.error('❌ No assignments found')
    process.exit(1)
  }

  if (current.error === 'ambiguous') {
    console.error(`❌ Active assignment ID "${current.name}" is ambiguous.`)
    console.error(`   Matches: ${current.matches.join(', ')}`)
    console.error('   Run specdev focus <full-assignment-name> after resolving the duplicate IDs.')
    process.exit(1)
  }

  return current.path
}

/**
 * Get the assignment directory name from a full path
 */
export function assignmentName(assignmentPath) {
  return assignmentPath.split(/[/\\]/).pop()
}
