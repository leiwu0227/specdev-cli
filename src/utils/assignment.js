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
 * Resolve assignment path from flags (--assignment or latest)
 */
export async function resolveAssignmentPath(flags) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  await requireSpecdevDirectory(specdevPath)

  if (flags.assignment) {
    const assignmentPath = join(specdevPath, 'assignments', flags.assignment)
    if (!(await fse.pathExists(assignmentPath))) {
      console.error(`❌ Assignment not found: ${flags.assignment}`)
      process.exit(1)
    }
    return assignmentPath
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
