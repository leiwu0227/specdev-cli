import { join } from 'path'
import fse from 'fs-extra'
import { findLatestAssignment } from './scan.js'
import {
  resolveTargetDir,
  requireSpecdevDirectory,
} from './command-context.js'

/**
 * Parse assignment directory name into components
 * e.g. "00001_feature_auth" -> { id: "00001", type: "feature", label: "auth" }
 */
export function parseAssignmentId(name) {
  const match = name.match(/^(\d+)_(\w+?)_(.+)$/)
  if (match) return { id: match[1], type: match[2], label: match[3] }
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

  // Preserve existing behavior for full names and absolute paths.
  const explicitPath = join(assignmentsDir, wanted)
  if (await fse.pathExists(explicitPath)) {
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
 * Resolve assignment path from flags (--assignment or latest)
 */
export async function resolveAssignmentPath(flags) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  if (flags.assignment) {
    const resolved = await resolveAssignmentSelector(specdevPath, flags.assignment)
    if (!resolved) {
      console.error(`❌ Assignment not found: ${flags.assignment}`)
      process.exit(1)
    }
    if (resolved.ambiguous) {
      console.error(`❌ Assignment id is ambiguous: ${resolved.wanted}`)
      console.error(`   Matches: ${resolved.matches.join(', ')}`)
      console.error('   Use --assignment=<full-assignment-name>')
      process.exit(1)
    }
    return resolved.path
  }

  const latest = await findLatestAssignment(specdevPath)
  if (!latest) {
    console.error('❌ No assignments found')
    process.exit(1)
  }
  return latest.path
}

/**
 * Get the assignment directory name from a full path
 */
export function assignmentName(assignmentPath) {
  return assignmentPath.split(/[/\\]/).pop()
}
