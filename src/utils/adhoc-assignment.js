import { join } from 'node:path'
import fse from 'fs-extra'
import { readFocusedAssignmentLifecycle } from './assignment-lifecycle.js'
import { attemptLiveness, listAttemptRecords } from './process-record.js'

const ASSIGNMENT_ATTEMPT_KINDS = new Set(['worker', 'reviewer'])

export async function resolveAdhocAssignmentCoexistence(specdevPath) {
  const assignment = await readFocusedAssignmentLifecycle(specdevPath)
  if (!assignment) return { status: 'none' }
  if (assignment.lifecycle === 'unknown') {
    return ambiguousAssignment(
      assignment,
      assignment.problem || 'The focused Assignment lifecycle cannot be resolved.'
    )
  }
  if (assignment.lifecycle !== 'active') return { status: 'none' }

  const status = assignment.status
  if (!status || status.mission) {
    return ambiguousAssignment(
      assignment,
      status?.mission
        ? 'The focused Assignment belongs to a Mission; standalone Adhoc coexistence does not change Mission semantics.'
        : 'The focused Assignment status is missing or invalid.'
    )
  }
  if (status.git_boundary?.starting_git_commit_hash) {
    return {
      status: 'blocked',
      state: 'assignment_boundary_conflict',
      assignment: assignmentFacts(assignment),
      conflicts: [
        {
          owner: `Assignment ${assignment.id}`,
          reason: 'implementation_git_boundary_established',
          boundary: status.git_boundary.starting_git_commit_hash,
          next_action:
            'Continue or otherwise resolve the Assignment without starting Adhoc; shelving remains an explicit user-only terminal choice.',
        },
      ],
      next_action:
        'Continue the active Assignment, or cancel this Adhoc request. SpecDev will not rebase or shelf the Assignment implicitly.',
    }
  }

  const runInspection = await inspectAssignmentRun(specdevPath, assignment)
  if (!runInspection.valid) return ambiguousAssignment(assignment, runInspection.problem)

  let attempts
  try {
    attempts = (await listAttemptRecords(specdevPath)).filter(
      (attempt) =>
        ASSIGNMENT_ATTEMPT_KINDS.has(attempt.kind) &&
        [assignment.name, assignment.id].includes(String(attempt.assignment || ''))
    )
  } catch (error) {
    return ambiguousAssignment(
      assignment,
      `Assignment Attempt records could not be classified: ${error.message}`
    )
  }
  const conflictingAttempts = []
  for (const attempt of attempts.filter((candidate) => candidate.status === 'running')) {
    const liveness = await attemptLiveness(specdevPath, attempt.id)
    conflictingAttempts.push({
      attempt: attempt.id,
      owner: `Assignment ${assignment.id} ${attempt.kind}`,
      reason: liveness.state === 'live_local' ? 'live_attempt' : 'ambiguous_running_attempt',
      liveness: liveness.state,
      next_action:
        'Let the Attempt finish or recover it to a durable non-running state before starting Adhoc.',
    })
  }
  if (conflictingAttempts.length > 0) {
    return {
      status: 'blocked',
      state: 'assignment_attempt_conflict',
      assignment: assignmentFacts(assignment),
      conflicts: conflictingAttempts,
      next_action:
        'Finish or recover every active Assignment worker/reviewer Attempt, then retry Adhoc start. Do not shelf the Assignment as a pause mechanism.',
    }
  }

  return {
    status: 'safe',
    assignment: {
      version: 1,
      ...assignmentFacts(assignment),
      run_status: runInspection.checkpoint.status,
      run_position: runInspection.checkpoint.position,
      preserved_paths: assignmentOwnedPaths(assignment, attempts),
    },
  }
}

export function assignmentOwnedPathDetails(path, coexistence) {
  if (!coexistence?.name || !coexistence?.run_id) return null
  const normalized = String(path || '')
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
  const assignmentRoot = `.specdev/assignments/${coexistence.name}`
  const runRoot = `.specdev/.ripplegraph/runs/${coexistence.run_id}`
  const exactPaths = new Set(coexistence.preserved_paths || [])
  if (
    normalized === '.specdev/.current' ||
    normalized === '.specdev/.id-counters.json' ||
    normalized === '.specdev/.ripplegraph/current.json' ||
    normalized === assignmentRoot ||
    normalized.startsWith(`${assignmentRoot}/`) ||
    normalized === runRoot ||
    normalized.startsWith(`${runRoot}/`) ||
    normalized.startsWith('.specdev/.ripplegraph/runs/') ||
    normalized.startsWith('.specdev/processes/') ||
    exactPaths.has(normalized)
  ) {
    return {
      path: normalized,
      owner: `Assignment ${coexistence.id}`,
      reason: 'preserved_assignment_workflow_state',
      next_action:
        'Leave this path with the active Assignment; it is outside Adhoc ownership and delivery.',
    }
  }
  return null
}

async function inspectAssignmentRun(specdevPath, assignment) {
  const current = await fse
    .readJson(join(specdevPath, '.ripplegraph', 'current.json'))
    .catch(() => null)
  if (current?.focusedRunId !== assignment.status.run_id) {
    return { valid: false, problem: 'Assignment focus and RippleGraph run ownership disagree.' }
  }
  const checkpoint = await fse
    .readJson(
      join(specdevPath, '.ripplegraph', 'runs', assignment.status.run_id, 'checkpoint.json')
    )
    .catch(() => null)
  if (
    checkpoint?.runId !== assignment.status.run_id ||
    checkpoint?.rootGraph !== 'assignment-lifecycle' ||
    checkpoint?.status !== 'active' ||
    checkpoint?.position?.graph !== 'assignment-lifecycle' ||
    checkpoint?.position?.node !== 'design' ||
    checkpoint?.outputs?.['create-assignment']?.name !== assignment.name
  ) {
    return {
      valid: false,
      problem:
        'The Assignment run is missing, inactive, owned by another identity, or not at the safe pre-implementation design boundary.',
    }
  }
  return { valid: true, checkpoint }
}

function assignmentFacts(assignment) {
  return {
    id: assignment.id,
    name: assignment.name,
    lifecycle: assignment.lifecycle,
    run_id: assignment.status?.run_id || null,
  }
}

function assignmentOwnedPaths(assignment, attempts) {
  return [
    '.specdev/.current',
    '.specdev/.id-counters.json',
    '.specdev/.ripplegraph/current.json',
    `.specdev/.ripplegraph/runs/${assignment.status.run_id}`,
    `.specdev/assignments/${assignment.name}`,
    ...attempts.map((attempt) => `.specdev/processes/${attempt.id}.yaml`),
  ].sort()
}

function ambiguousAssignment(assignment, problem) {
  return {
    status: 'blocked',
    state: 'assignment_state_ambiguous',
    assignment: assignmentFacts(assignment),
    conflicts: [
      {
        owner: `Assignment ${assignment.id}`,
        reason: 'uncertain_assignment_ownership',
        problem,
        next_action:
          'Inspect the Assignment status, focus, run, and Attempt records; restore one unambiguous owner before retrying.',
      },
    ],
    next_action:
      'Resolve the Assignment ownership ambiguity without shelving it implicitly, then retry Adhoc start.',
  }
}
