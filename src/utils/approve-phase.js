import { join } from 'path'
import fse from 'fs-extra'

/**
 * Validate artifacts for a phase and update status.json on success.
 *
 * @param {string} assignmentPath - absolute path to the assignment directory
 * @param {'brainstorm'|'implementation'} phase - phase to approve
 * @returns {Promise<{ approved: boolean, errors: string[] }>}
 */
export async function approvePhase(assignmentPath, phase) {
  if (phase === 'brainstorm') {
    return approveBrainstorm(assignmentPath)
  }
  if (phase === 'implementation') {
    return approveImplementation(assignmentPath)
  }
  return { approved: false, errors: [`Unknown phase: ${phase}`] }
}

async function approveBrainstorm(assignmentPath) {
  const errors = []

  for (const file of ['brainstorm/proposal.md', 'brainstorm/design.md']) {
    const filePath = join(assignmentPath, file)
    if (!(await fse.pathExists(filePath))) {
      errors.push(`${file} (missing)`)
    } else {
      const content = await fse.readFile(filePath, 'utf-8')
      if (content.trim().length < 20) {
        errors.push(`${file} (empty or too short)`)
      }
    }
  }

  if (errors.length > 0) {
    return { approved: false, errors }
  }

  const status = await readStatus(assignmentPath)
  status.brainstorm_approved = true
  await writeStatus(assignmentPath, status)

  return { approved: true, errors: [] }
}

async function approveImplementation(assignmentPath) {
  const progressPath = join(assignmentPath, 'implementation', 'progress.json')

  if (!(await fse.pathExists(progressPath))) {
    return { approved: false, errors: ['progress.json missing'] }
  }

  let raw
  try {
    raw = await fse.readJson(progressPath)
  } catch {
    return { approved: false, errors: ['progress.json is invalid'] }
  }

  if (!Array.isArray(raw.tasks) || raw.tasks.length === 0) {
    return { approved: false, errors: ['no tasks found in progress.json'] }
  }

  const incomplete = raw.tasks.filter(t => t.status !== 'completed')
  if (incomplete.length > 0) {
    return {
      approved: false,
      errors: [`${incomplete.length} of ${raw.tasks.length} tasks not completed`],
    }
  }

  const status = await readStatus(assignmentPath)
  status.implementation_approved = true
  await writeStatus(assignmentPath, status)

  return { approved: true, errors: [] }
}

async function readStatus(assignmentPath) {
  const statusPath = join(assignmentPath, 'status.json')
  if (await fse.pathExists(statusPath)) {
    try {
      return await fse.readJson(statusPath)
    } catch {
      return {}
    }
  }
  return {}
}

async function writeStatus(assignmentPath, status) {
  const statusPath = join(assignmentPath, 'status.json')
  await fse.writeJson(statusPath, status, { spaces: 2 })
}
