import { join } from 'path'
import fse from 'fs-extra'
import { writeSync } from 'fs'
import {
  resolveTargetDir,
  requireSpecdevDirectory,
} from '../utils/command-context.js'
import { scanAssignments, scanSingleAssignment, readProcessedCaptures } from '../utils/scan.js'
import { detectAssignmentState } from '../utils/state.js'
import { readBigPictureStatus } from '../utils/project-context.js'
import { printKeyValue, printListSection } from '../utils/output.js'
import { getLatestRound } from '../utils/review-feedback.js'
import { resolveCurrentAssignment } from '../utils/current.js'

export async function continueCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  const json = Boolean(flags.json)
  await requireSpecdevDirectory(specdevPath)

  const bigPicture = await readBigPictureStatus(specdevPath)
  if (!bigPicture.filled) return emitBlocked(buildProjectContextMissingPayload(), json)

  const selection = await resolveAssignment(specdevPath, flags)
  if (!selection.selected) {
    return emitBlocked(selection.payload || buildNoAssignmentPayload(), json)
  }
  const selected = selection.selected

  const assignmentSummary = await scanSingleAssignment(selected.path, selected.name)
  const detected = await detectAssignmentState(assignmentSummary, selected.path)

  // Check for review feedback from a separate review session
  // Determine current phase from detected state
  const currentPhase = detected.state.startsWith('brainstorm') ? 'brainstorm' : 'implementation'
  const feedbackPath = join(selected.path, 'review', `${currentPhase}-feedback.md`)
  let reviewStatus = null
  let reviewFeedbackRelPath = null
  if (await fse.pathExists(feedbackPath)) {
    const feedbackContent = await fse.readFile(feedbackPath, 'utf-8')
    const latest = getLatestRound(feedbackContent)
    if (latest && latest.verdict === 'needs-changes') {
      reviewStatus = 'needs-changes'
      reviewFeedbackRelPath = `review/${currentPhase}-feedback.md`
    }
  }

  const payload = buildContinuePayload(detected, selected, selection, reviewStatus, reviewFeedbackRelPath)

  // Check for unprocessed distill assignments
  const knowledgePath = join(specdevPath, 'knowledge')
  const allAssignments = await scanAssignments(specdevPath)
  const captureAssignments = allAssignments.filter(a => a.capture)
  const processedProject = await readProcessedCaptures(knowledgePath, 'project')
  const unprocessedDistill = captureAssignments
    .filter(a => !processedProject.has(a.name))
    .sort((a, b) => a.name.localeCompare(b.name))

  if (unprocessedDistill.length > 0) {
    const MAX_SHOWN = 5
    payload.distill_pending = {
      count: unprocessedDistill.length,
      assignments: unprocessedDistill.slice(0, MAX_SHOWN).map(a => a.name),
    }
  }

  emit(payload, json)
  if (payload.status === 'blocked') process.exitCode = 1
}

function buildProjectContextMissingPayload() {
  return {
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
}

function buildNoAssignmentPayload() {
  return {
    version: 1,
    status: 'blocked',
    state: 'no_assignment',
    blockers: [
      {
        code: 'no_assignment',
        detail: 'No active assignment set',
        recommended_fix: 'Run specdev focus <id> or specdev assignment <description>',
      },
    ],
    next_action: 'Set an active assignment via specdev focus <id>',
  }
}

function buildContinuePayload(detected, selected, selection, reviewStatus, reviewFeedbackRelPath) {
  return {
    version: 1,
    status: detected.blockers.length > 0 ? 'blocked' : 'ok',
    assignment: selected.name,
    assignment_path: selected.path,
    selected_by: selection.selectedBy,
    state: detected.state,
    next_action: detected.next_action,
    blockers: detected.blockers,
    progress: detected.progress,
    review_feedback: reviewStatus === 'needs-changes' ? reviewFeedbackRelPath : null,
  }
}

function emitBlocked(payload, asJson) {
  emit(payload, asJson)
  process.exitCode = 1
}

function emit(payload, asJson) {
  if (asJson) {
    writeSync(1, `${JSON.stringify(payload, null, 2)}\n`)
    return
  }

  console.log('SpecDev Continue')
  if (payload.assignment) {
    printKeyValue('Assignment', payload.assignment)
    printKeyValue('State', payload.state)
  } else {
    printKeyValue('State', payload.state)
  }
  if (payload.review_feedback) {
    console.log('')
    console.log('Review Feedback:')
    console.log(`  Read ${payload.review_feedback} in the assignment folder and address findings.`)
  }

  console.log('')
  console.log('Next Action:')
  console.log(`  ${payload.next_action}`)

  if (payload.progress) {
    console.log('')
    console.log('Progress:')
    console.log(`  ${payload.progress.summary}`)
  }

  if (payload.blockers && payload.blockers.length > 0) {
    console.log('')
    const items = payload.blockers.map(
      (blocker) =>
        `${blocker.code}: ${blocker.detail} (fix: ${blocker.recommended_fix})`
    )
    printListSection('Blockers:', items)
  }

  if (payload.distill_pending) {
    console.log('')
    console.log('Distill Pending:')
    const suffix = payload.distill_pending.count > 5 ? ' (showing oldest 5)' : ''
    console.log(`  ${payload.distill_pending.count} assignment(s) have unprocessed captures${suffix}`)
    console.log('  Run: specdev distill --assignment=<name>')
  }
}

async function resolveAssignment(specdevPath, flags) {
  const current = await resolveCurrentAssignment(specdevPath)

  if (current.error === 'stale') {
    return {
      selected: null,
      payload: {
        version: 1,
        status: 'blocked',
        state: 'stale_current',
        blockers: [{
          code: 'stale_current',
          detail: `Active assignment "${current.name}" not found`,
          recommended_fix: 'Run specdev focus <id> to set a valid assignment',
        }],
        next_action: 'Run specdev focus <id>',
      },
    }
  }

  if (current.error === 'missing') {
    return { selected: null }
  }

  return {
    selected: { name: current.name, path: current.path },
    selectedBy: 'current',
  }
}
