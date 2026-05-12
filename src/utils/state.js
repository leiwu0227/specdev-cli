import { join } from 'path'
import fse from 'fs-extra'
import { artifactPaths, gateFields } from './workflow-contract.js'

/**
 * @typedef {Object} DetectedState
 * @property {'brainstorm'|'breakdown'|'implementation'|null} phase - active phase from manifest
 * @property {string|null} stepId - active step id (e.g., 'create_artifacts', 'checkpoint', 'approval')
 * @property {'guide'|'command'|'gate'|null} stepKind - active step kind
 * @property {'in_progress'|'checkpoint_ready'|'approved'|'completed'|'blocked'} status
 * @property {string[]} completedPhases - phase names whose gate is satisfied
 * @property {string|null} gate - gate field declared on the active step, if any
 * @property {string} state - legacy state-name string (e.g., 'brainstorm_in_progress'); derived from above for one-release back-compat; DO NOT branch on this in new code
 * @property {Array<{code:string,detail:string,recommended_fix:string}>} blockers
 * @property {Object} progress - existing progress shape
 */

const LEGACY_ROOT_ARTIFACTS = [
  'proposal.md',
  'design.md',
  'plan.md',
  'implementation.md',
  'validation_checklist.md',
]

export async function readGateStatus(assignmentPath) {
  const statusPath = join(assignmentPath, 'status.json')
  if (!(await fse.pathExists(statusPath))) {
    return { [gateFields.brainstorm]: false, [gateFields.implementation]: false }
  }
  try {
    const raw = await fse.readJson(statusPath)
    return {
      [gateFields.brainstorm]: Boolean(raw[gateFields.brainstorm]),
      [gateFields.implementation]: Boolean(raw[gateFields.implementation]),
    }
  } catch {
    return { [gateFields.brainstorm]: false, [gateFields.implementation]: false }
  }
}

export async function detectAssignmentState(assignmentSummary, assignmentPath) {
  const blockers = []
  const hasProposal = await fse.pathExists(join(assignmentPath, artifactPaths.brainstorm.proposal))
  const hasDesign = await fse.pathExists(join(assignmentPath, artifactPaths.brainstorm.design))
  const hasPlan = await fse.pathExists(join(assignmentPath, artifactPaths.breakdown.plan))
  const hasProgressFile = await fse.pathExists(
    join(assignmentPath, artifactPaths.implementation.progress)
  )

  const gates = await readGateStatus(assignmentPath)
  const progress = await readImplementationProgress(assignmentSummary, assignmentPath)

  if (assignmentSummary.skippedPhases && assignmentSummary.skippedPhases.length > 0) {
    blockers.push({
      code: 'inconsistent_phase_artifacts',
      detail: `Skipped phases detected: ${assignmentSummary.skippedPhases.join(', ')}`,
      recommended_fix: 'Restore missing earlier phase artifacts before continuing',
    })
  }

  const legacyRoots = await findLegacyRootArtifacts(assignmentPath)
  if (legacyRoots.length > 0) {
    blockers.push({
      code: 'legacy_layout_detected',
      detail: `Legacy root artifacts present: ${legacyRoots.join(', ')}`,
      recommended_fix: 'Run specdev migrate',
    })
  }

  // Brainstorm phase
  if (!hasProposal || !hasDesign) {
    return {
      state: 'brainstorm_in_progress',
      next_action: 'Continue brainstorm and produce brainstorm/proposal.md + brainstorm/design.md',
      blockers,
      progress,
    }
  }

  if (!gates[gateFields.brainstorm]) {
    return {
      state: 'brainstorm_checkpoint_ready',
      next_action: 'Run specdev checkpoint brainstorm, then request user approval with specdev approve brainstorm',
      blockers,
      progress,
    }
  }

  // Breakdown phase
  if (!hasPlan) {
    return {
      state: 'breakdown_in_progress',
      next_action: 'Invoke breakdown skill to generate breakdown/plan.md',
      blockers,
      progress,
    }
  }

  const revisionGuard = await checkRevisionMismatch(assignmentPath)
  if (revisionGuard.hasMismatch) {
    blockers.push({
      code: 'design_revision_mismatch',
      detail:
        `brainstorm revision is v${revisionGuard.brainstormRevision}, ` +
        `but breakdown is based on v${revisionGuard.breakdownRevision}`,
      recommended_fix: 'Re-run breakdown to refresh the plan for the latest design revision',
    })
    return {
      state: 'revision_requires_rebreakdown',
      next_action: 'Re-run breakdown before continuing implementation',
      blockers,
      progress,
    }
  }

  // Implementation phase
  if (!hasProgressFile) {
    return {
      state: 'implementation_in_progress',
      next_action: 'Invoke implementing skill to execute the plan',
      blockers,
      progress,
    }
  }

  if (progress.totalTasks > 0 && progress.completedTasks >= progress.totalTasks) {
    if (!gates[gateFields.implementation]) {
      return {
        state: 'implementation_checkpoint_ready',
        next_action: 'Run specdev checkpoint implementation, then request user approval with specdev approve implementation',
        blockers,
        progress,
      }
    }
  } else {
    return {
      state: 'implementation_in_progress',
      next_action: 'Continue implementing remaining tasks and keep progress evidence updated',
      blockers,
      progress,
    }
  }

  return {
    state: 'completed',
    next_action:
      'Assignment complete. Optionally record reusable knowledge, then start a new assignment',
    blockers,
    progress,
  }
}

async function checkRevisionMismatch(assignmentPath) {
  const brainstormRevision = await readRevisionNumber(
    join(assignmentPath, 'brainstorm', 'revision.json'),
    'revision'
  )
  if (brainstormRevision === null) {
    return {
      hasMismatch: false,
      brainstormRevision: null,
      breakdownRevision: null,
    }
  }

  const breakdownRevision = await readRevisionNumber(
    join(assignmentPath, 'breakdown', 'metadata.json'),
    'based_on_brainstorm_revision'
  )
  const normalizedBreakdownRevision = breakdownRevision ?? 0

  return {
    hasMismatch: normalizedBreakdownRevision !== brainstormRevision,
    brainstormRevision,
    breakdownRevision: normalizedBreakdownRevision,
  }
}

export async function readRevisionNumber(path, key) {
  if (!(await fse.pathExists(path))) {
    return null
  }
  try {
    const raw = await fse.readJson(path)
    const n = Number(raw?.[key])
    if (Number.isInteger(n) && n >= 0) {
      return n
    }
  } catch {
    return null
  }
  return null
}

async function findLegacyRootArtifacts(assignmentPath) {
  const found = []
  for (const artifact of LEGACY_ROOT_ARTIFACTS) {
    if (await fse.pathExists(join(assignmentPath, artifact))) {
      found.push(artifact)
    }
  }
  return found
}

async function readImplementationProgress(assignmentSummary, assignmentPath) {
  const progressPath = join(assignmentPath, 'implementation', 'progress.json')
  if (!(await fse.pathExists(progressPath))) {
    return {
      source: 'none',
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      pendingTasks: 0,
      summary: 'No implementation/progress.json found',
    }
  }

  let raw = {}
  try {
    raw = JSON.parse(await fse.readFile(progressPath, 'utf-8'))
  } catch {
    return {
      source: 'progress_json',
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      pendingTasks: 0,
      summary: 'implementation/progress.json is not valid JSON',
    }
  }

  if (Array.isArray(raw.tasks)) {
    const totalTasks = raw.tasks.length
    let completedTasks = 0
    let inProgressTasks = 0
    let pendingTasks = 0
    for (const task of raw.tasks) {
      if (task.status === 'completed') completedTasks++
      else if (task.status === 'in_progress') inProgressTasks++
      else pendingTasks++
    }

    return {
      source: 'progress_json',
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      summary: `${completedTasks}/${totalTasks} completed, ${inProgressTasks} in progress, ${pendingTasks} pending`,
    }
  }

  const totalFromObject = parseNumber(raw.total_tasks ?? raw.total ?? raw.task_count)
  const completedFromObject = parseNumber(
    raw.completed_tasks ?? raw.completed ?? raw.done
  )
  if (totalFromObject > 0) {
    const pendingTasks = Math.max(totalFromObject - completedFromObject, 0)
    return {
      source: 'progress_json',
      totalTasks: totalFromObject,
      completedTasks: completedFromObject,
      inProgressTasks: 0,
      pendingTasks,
      summary: `${completedFromObject}/${totalFromObject} completed`,
    }
  }

  if (Array.isArray(assignmentSummary.tasks) && assignmentSummary.tasks.length > 0) {
    const totalTasks = assignmentSummary.tasks.length
    const completedTasks = assignmentSummary.tasks.filter((task) => task.hasResult).length
    const pendingTasks = totalTasks - completedTasks
    return {
      source: 'tasks_fallback',
      totalTasks,
      completedTasks,
      inProgressTasks: 0,
      pendingTasks,
      summary: `${completedTasks}/${totalTasks} completed (from tasks/*/result.md)`,
    }
  }

  return {
    source: 'progress_json',
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    pendingTasks: 0,
    summary: 'No task counters found in implementation/progress.json',
  }
}

function parseNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}
