import { join } from 'path'
import fse from 'fs-extra'
import { writeSync } from 'fs'
import {
  resolveTargetDir,
  requireSpecdevDirectory,
} from '../utils/command-context.js'
import { scanAssignments, scanSingleAssignment } from '../utils/scan.js'
import { detectAssignmentState } from '../utils/state.js'
import { askChoice } from '../utils/prompt.js'
import { readBigPictureStatus } from '../utils/project-context.js'
import { printKeyValue, printListSection } from '../utils/output.js'

const ASSIGNMENT_AMBIGUITY_WINDOW_MS = 15 * 60 * 1000

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
  const feedbackPath = join(selected.path, 'review', 'review-feedback.md')
  const hasReviewFeedback = await fse.pathExists(feedbackPath)

  const payload = buildContinuePayload(detected, selected, selection, hasReviewFeedback)
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
        detail: 'No assignments found in .specdev/assignments',
        recommended_fix: 'Run specdev assignment <name>',
      },
    ],
    next_action: 'Create a new assignment to begin work',
  }
}

function buildContinuePayload(detected, selected, selection, hasReviewFeedback) {
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
    review_feedback: hasReviewFeedback ? 'review/review-feedback.md' : null,
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
}

async function resolveAssignment(specdevPath, flags) {
  const assignmentsDir = join(specdevPath, 'assignments')
  if (!(await fse.pathExists(assignmentsDir))) {
    return { selected: null }
  }

  if (typeof flags.assignment === 'string') {
    const explicit = join(assignmentsDir, flags.assignment)
    if (!(await fse.pathExists(explicit))) {
      return {
        selected: null,
        payload: {
          version: 1,
          status: 'blocked',
          state: 'assignment_not_found',
          blockers: [
            {
              code: 'assignment_not_found',
              detail: `Assignment not found: ${flags.assignment}`,
              recommended_fix: 'Run specdev continue without --assignment, or pick a valid assignment',
            },
          ],
          next_action: 'Choose an existing assignment and retry',
        },
      }
    }
    return {
      selected: { name: flags.assignment, path: explicit },
      selectedBy: 'flag',
    }
  }

  const assignments = await scanAssignments(specdevPath)
  if (assignments.length === 0) {
    return { selected: null }
  }

  const analyses = await Promise.all(
    assignments.map(async (assignment) => {
      const detected = await detectAssignmentState(assignment, assignment.path)
      const mtime = await latestAssignmentArtifactMtime(assignment.path)
      return { assignment, detected, mtime }
    })
  )

  analyses.sort((a, b) => {
    const scoreDelta = statePriority(b.detected.state) - statePriority(a.detected.state)
    if (scoreDelta !== 0) return scoreDelta
    const timeDelta = b.mtime - a.mtime
    if (timeDelta !== 0) return timeDelta
    return a.assignment.name.localeCompare(b.assignment.name)
  })

  const top = analyses[0]
  const competing = analyses.filter(
    (item) =>
      statePriority(item.detected.state) === statePriority(top.detected.state) &&
      Math.abs(item.mtime - top.mtime) <= ASSIGNMENT_AMBIGUITY_WINDOW_MS
  )

  if (competing.length > 1) {
    if (process.stdin.isTTY && process.stdout.isTTY) {
      const idx = await askChoice(
        'Multiple active assignments look equally likely. Which assignment should continue?',
        competing.map(
          (item) =>
            `${item.assignment.name} (${item.detected.state}; ${item.detected.progress.summary})`
        )
      )
      const chosen = competing[idx]
      return {
        selected: { name: chosen.assignment.name, path: chosen.assignment.path },
        selectedBy: 'interactive_clarification',
      }
    }

    return {
      selected: null,
      payload: {
        version: 1,
        status: 'blocked',
        state: 'assignment_ambiguous',
        blockers: [
          {
            code: 'assignment_ambiguous',
            detail:
              `Multiple assignments appear active: ${competing.map((item) => item.assignment.name).join(', ')}`,
            recommended_fix: 'Run specdev continue --assignment=<name>',
          },
        ],
        candidates: competing.map((item) => ({
          assignment: item.assignment.name,
          state: item.detected.state,
          progress: item.detected.progress.summary,
        })),
        next_action: 'Specify assignment explicitly via --assignment=<name>',
      },
    }
  }

  return {
    selected: { name: top.assignment.name, path: top.assignment.path },
    selectedBy: 'heuristic',
  }
}

function statePriority(state) {
  switch (state) {
    case 'revision_requires_rebreakdown':
      return 100
    case 'implementation_in_progress':
      return 95
    case 'implementation_ready':
      return 90
    case 'breakdown_ready':
      return 80
    case 'brainstorm_in_progress':
      return 70
    case 'review_ready':
      return 60
    case 'completed':
      return 10
    default:
      return 50
  }
}

async function latestAssignmentArtifactMtime(assignmentPath) {
  const artifactPaths = [
    'brainstorm/design.md',
    'brainstorm/proposal.md',
    'breakdown/plan.md',
    'breakdown/metadata.json',
    'implementation/progress.json',
    'review/review-feedback.md',
    'review_report.md',
  ]

  let latest = 0
  for (const rel of artifactPaths) {
    const full = join(assignmentPath, rel)
    if (!(await fse.pathExists(full))) continue
    const stat = await fse.stat(full)
    latest = Math.max(latest, stat.mtimeMs)
  }

  return latest
}
