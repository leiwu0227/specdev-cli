import { join } from 'path'
import fse from 'fs-extra'
import { writeSync } from 'fs'
import {
  resolveTargetDir,
  requireSpecdevDirectory,
} from '../utils/command-context.js'
import { findLatestAssignment, scanSingleAssignment } from '../utils/scan.js'
import { detectAssignmentState } from '../utils/state.js'

export async function continueCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  const json = Boolean(flags.json)
  await requireSpecdevDirectory(specdevPath)

  const bigPicturePath = join(specdevPath, 'project_notes', 'big_picture.md')
  if (!(await isBigPictureFilled(bigPicturePath))) {
    const payload = {
      version: 1,
      status: 'blocked',
      state: 'project_context_missing',
      blockers: [
        {
          code: 'project_context_missing',
          detail: 'project_notes/big_picture.md is missing or still template content',
          recommended_fix: 'Run specdev start',
        },
      ],
      next_action: 'Fill project context via specdev start before resuming assignments',
    }
    emit(payload, json)
    process.exitCode = 1
    return
  }

  const selected = await resolveAssignment(specdevPath, flags)
  if (!selected) {
    const payload = {
      version: 1,
      status: 'blocked',
      state: 'no_assignment',
      blockers: [
        {
          code: 'no_assignment',
          detail: 'No assignments found in .specdev/assignments',
          recommended_fix: 'Run specdev assignment <name>',
        },
      ],
      next_action: 'Create a new assignment to begin work',
    }
    emit(payload, json)
    process.exitCode = 1
    return
  }

  const assignmentSummary = await scanSingleAssignment(selected.path, selected.name)
  const detected = await detectAssignmentState(assignmentSummary, selected.path)
  const payload = {
    version: 1,
    status: detected.blockers.length > 0 ? 'blocked' : 'ok',
    assignment: selected.name,
    assignment_path: selected.path,
    selected_by: flags.assignment ? 'flag' : 'latest',
    state: detected.state,
    next_action: detected.next_action,
    blockers: detected.blockers,
    progress: detected.progress,
  }

  emit(payload, json)
}

function emit(payload, asJson) {
  if (asJson) {
    writeSync(1, `${JSON.stringify(payload, null, 2)}\n`)
    return
  }

  writeSync(1, 'SpecDev Continue\n')
  if (payload.assignment) {
    writeSync(1, `Assignment: ${payload.assignment}\n`)
    writeSync(1, `State: ${payload.state}\n`)
  } else {
    writeSync(1, `State: ${payload.state}\n`)
  }
  writeSync(1, '\n')
  writeSync(1, 'Next Action:\n')
  writeSync(1, `  ${payload.next_action}\n`)

  if (payload.progress) {
    writeSync(1, '\n')
    writeSync(1, 'Progress:\n')
    writeSync(1, `  ${payload.progress.summary}\n`)
  }

  if (payload.blockers && payload.blockers.length > 0) {
    writeSync(1, '\n')
    writeSync(1, 'Blockers:\n')
    for (const blocker of payload.blockers) {
      writeSync(
        1,
        `  - ${blocker.code}: ${blocker.detail} (fix: ${blocker.recommended_fix})\n`
      )
    }
  }
}

async function resolveAssignment(specdevPath, flags) {
  const assignmentsDir = join(specdevPath, 'assignments')
  if (!(await fse.pathExists(assignmentsDir))) {
    return null
  }

  if (typeof flags.assignment === 'string') {
    const explicit = join(assignmentsDir, flags.assignment)
    if (!(await fse.pathExists(explicit))) {
      console.error(`❌ Assignment not found: ${flags.assignment}`)
      process.exit(1)
    }
    return { name: flags.assignment, path: explicit }
  }

  return findLatestAssignment(specdevPath)
}

async function isBigPictureFilled(bigPicturePath) {
  if (!(await fse.pathExists(bigPicturePath))) {
    return false
  }
  const content = await fse.readFile(bigPicturePath, 'utf-8')
  return content.trim().length > 100 && !content.includes('TODO: filled by')
}
