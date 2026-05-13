import { join } from 'path'
import fse from 'fs-extra'
import { writeSync } from 'fs'
import {
  resolveTargetDir,
  requireSpecdevDirectory,
} from '../utils/command-context.js'
import { scanSingleAssignment } from '../utils/scan.js'
import {
  loadStateForAssignment,
  readGateStatus,
  enumerateGateFieldsByPhase,
  enumeratePhaseArtifacts,
} from '../utils/state.js'
import { readBigPictureStatus } from '../utils/project-context.js'
import { printKeyValue, printListSection } from '../utils/output.js'
import { getLatestRound } from '../utils/review-feedback.js'
import { resolveCurrentAssignment } from '../utils/current.js'

export async function continueCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  const json = Boolean(flags.json)
  const asStatus = Boolean(flags.statusPayload)
  const statusText = Boolean(flags.statusText)
  await requireSpecdevDirectory(specdevPath)

  const bigPicture = await readBigPictureStatus(specdevPath)
  const selection = await resolveAssignment(specdevPath, flags)
  if (!selection.selected) {
    if (!bigPicture.filled) return emitBlocked(buildProjectContextMissingPayload(), { json, asStatus, statusText })
    return emitBlocked(selection.payload || buildNoAssignmentPayload(), { json, asStatus, statusText })
  }
  const selected = selection.selected

  const assignmentSummary = await scanSingleAssignment(selected.path, selected.name)
  const { detected, workflowInfo } = await loadStateForAssignment(specdevPath, assignmentSummary, selected.path)

  // Check for review feedback from a separate review session
  // Use the structured phase from detected state directly. When there's no
  // active phase (e.g., assignment is completed), fall back to implementation
  // since review feedback files live alongside the most-recent reviewable phase.
  const currentPhase = detected.phase || 'implementation'
  const feedbackPath = join(selected.path, 'review', `${currentPhase}-feedback.md`)
  let reviewStatus = null
  let reviewFeedbackRelPath = null
  const reviewLogs = await collectReviewLogs(selected.path, currentPhase)
  if (await fse.pathExists(feedbackPath)) {
    const feedbackContent = await fse.readFile(feedbackPath, 'utf-8')
    const latest = getLatestRound(feedbackContent)
    if (latest && latest.verdict === 'needs-changes') {
      reviewStatus = 'needs-changes'
      reviewFeedbackRelPath = `review/${currentPhase}-feedback.md`
    }
  }

  const workflowStatus = await collectWorkflowStatus(selected.path, workflowInfo)
  if (!bigPicture.filled) {
    detected.blockers = [
      {
        code: 'project_context_missing',
        detail: 'project_notes/big_picture.md is missing or still template content',
        recommended_fix: 'Run specdev start',
      },
      ...detected.blockers,
    ]
  }
  const payload = buildContinuePayload(
    detected,
    selected,
    selection,
    reviewStatus,
    reviewFeedbackRelPath,
    reviewLogs,
    workflowStatus
  )

  emit(payload, { json, asStatus, statusText })
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

function buildContinuePayload(
  detected,
  selected,
  selection,
  reviewStatus,
  reviewFeedbackRelPath,
  reviewLogs,
  workflowStatus
) {
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
    gates: workflowStatus.gates,
    artifacts: workflowStatus.artifacts,
    review_feedback: reviewStatus === 'needs-changes' ? reviewFeedbackRelPath : null,
    review_logs: reviewLogs,
  }
}

function emitBlocked(payload, options) {
  emit(payload, options)
  process.exitCode = 1
}

function emit(payload, options = {}) {
  const asJson = typeof options === 'boolean' ? options : Boolean(options.json)
  const asStatus = typeof options === 'object' && Boolean(options.asStatus)
  const statusText = typeof options === 'object' && Boolean(options.statusText)
  const outputPayload = asStatus ? buildStatusPayload(payload) : payload

  if (asJson) {
    writeSync(1, `${JSON.stringify(outputPayload, null, 2)}\n`)
    return
  }

  console.log(statusText ? 'SpecDev Status' : 'SpecDev Continue')
  if (outputPayload.assignment) {
    printKeyValue('Assignment', outputPayload.assignment)
    printKeyValue('State', outputPayload.state)
  } else {
    printKeyValue('State', outputPayload.state)
  }
  if (outputPayload.review_feedback) {
    console.log('')
    console.log('Review Feedback:')
    console.log(`  Read ${outputPayload.review_feedback} in the assignment folder and address findings.`)
  }

  if (outputPayload.review_logs && outputPayload.review_logs.length > 0) {
    console.log('')
    console.log('Reviewloop Diagnostics:')
    for (const log of outputPayload.review_logs) {
      console.log(`  ${log.path}`)
    }
  }

  console.log('')
  console.log('Next Action:')
  console.log(`  ${outputPayload.next_action}`)

  if (outputPayload.progress) {
    console.log('')
    console.log('Progress:')
    console.log(`  ${outputPayload.progress.summary}`)
  }

  if (outputPayload.blockers && outputPayload.blockers.length > 0) {
    console.log('')
    const items = outputPayload.blockers.map(
      (blocker) =>
        `${blocker.code}: ${blocker.detail} (fix: ${blocker.recommended_fix})`
    )
    printListSection('Blockers:', items)
  }

}

export function buildStatusPayload(payload) {
  return {
    command: 'status',
    version: payload.version,
    status: payload.status,
    kind: payload.assignment ? 'assignment' : null,
    assignment: payload.assignment || null,
    assignment_path: payload.assignment_path || null,
    selected_by: payload.selected_by || null,
    state: payload.state,
    gates: payload.gates || null,
    artifacts: payload.artifacts || null,
    blockers: payload.blockers || [],
    progress: payload.progress || null,
    review_feedback: payload.review_feedback || null,
    review_logs: payload.review_logs || [],
    next_action: payload.next_action,
  }
}

async function collectWorkflowStatus(assignmentPath, workflowInfo) {
  const gates = await readGateStatus(assignmentPath, workflowInfo)
  const gateByPhase = enumerateGateFieldsByPhase(workflowInfo)
  const artifacts = {}
  const trackedArtifacts = enumeratePhaseArtifacts(workflowInfo)

  for (const artifact of trackedArtifacts) {
    artifacts[artifact] = await fse.pathExists(join(assignmentPath, artifact))
      ? 'present'
      : 'missing'
  }

  // Build phase-keyed gate summary (e.g., { brainstorm: 'approved', implementation: 'pending' })
  const phaseGates = {}
  for (const [phaseName, fieldName] of Object.entries(gateByPhase)) {
    phaseGates[phaseName] = gates[fieldName] ? 'approved' : 'pending'
  }

  return {
    gates: phaseGates,
    artifacts,
  }
}

async function collectReviewLogs(assignmentPath, phase) {
  const reviewDir = join(assignmentPath, 'review')
  if (!await fse.pathExists(reviewDir)) return []

  const entries = await fse.readdir(reviewDir)
  const logPattern = new RegExp(`^${phase}-reviewer-.+-round-\\d+\\.log$`)
  const logs = []

  for (const entry of entries) {
    if (!logPattern.test(entry)) continue
    const absPath = join(reviewDir, entry)
    const stat = await fse.stat(absPath)
    logs.push({
      path: `review/${entry}`,
      mtime_ms: stat.mtimeMs,
      size: stat.size,
    })
  }

  return logs
    .sort((a, b) => b.mtime_ms - a.mtime_ms)
    .slice(0, 5)
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
