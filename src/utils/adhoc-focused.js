import { join } from 'node:path'
import fse from 'fs-extra'
import { readFocusedAssignmentLifecycle } from './assignment-lifecycle.js'
import { readCurrentFocus } from './current.js'
import { readMission, resolveMissionSelector, writeMission } from './mission.js'
import { attemptLiveness, listAttemptRecords } from './process-record.js'

const FOCUSED_ATTEMPT_KINDS = new Set(['worker', 'reviewer', 'controller'])
const SAFE_POSITIONS = {
  assignment: new Set(['brainstorm', 'approve-contract', 'design']),
  mission: new Set(['brainstorm', 'approve-mission']),
}

export async function resolveAdhocFocusedCoexistence(specdevPath) {
  const focus = await readCurrentFocus(specdevPath)
  if (!focus) return { status: 'none' }
  if (focus.kind === 'assignment') return resolveAssignmentCoexistence(specdevPath)
  if (focus.kind === 'mission') return resolveMissionCoexistence(specdevPath, focus.id)
  return { status: 'none' }
}

export async function readFocusedRevalidation(specdevPath) {
  const owner = await readFocusedOwner(specdevPath)
  const obligation = owner?.record?.adhoc_revalidation
  if (!owner || obligation?.status !== 'required') return null
  return { owner: publicOwner(owner), obligation }
}

export async function requireFocusedRevalidation(specdevPath, coexistence, detour) {
  const owner = await readFocusedOwner(specdevPath)
  assertSameOwner(owner, coexistence)
  const obligation = {
    version: 1,
    status: 'required',
    adhoc: detour.adhoc,
    disposition: detour.disposition,
    starting_revision: detour.starting_revision,
    ending_revision: detour.ending_revision,
    changed_paths: [...new Set(detour.changed_paths || [])].sort(),
    required_at: new Date().toISOString(),
  }
  await writeOwnerRecord(owner, { ...owner.record, adhoc_revalidation: obligation })
  return obligation
}

export async function completeFocusedRevalidation(
  specdevPath,
  { outcome, revision, changedPaths }
) {
  const owner = await readFocusedOwner(specdevPath)
  const current = owner?.record?.adhoc_revalidation
  if (!owner || current?.status !== 'required') return null
  const obligation = {
    ...current,
    status: 'satisfied',
    contract_assessment: 'unchanged',
    outcome,
    revalidated_revision: revision,
    revalidated_worktree_paths: [...new Set(changedPaths || [])].sort(),
    revalidated_at: new Date().toISOString(),
  }
  await writeOwnerRecord(owner, { ...owner.record, adhoc_revalidation: obligation })
  return { owner: publicOwner(owner), obligation }
}

export async function reportFocusedContractChange(
  specdevPath,
  { outcome, revision, changedPaths }
) {
  const owner = await readFocusedOwner(specdevPath)
  const current = owner?.record?.adhoc_revalidation
  if (!owner || current?.status !== 'required') return null
  const report = {
    outcome,
    observed_revision: revision,
    observed_worktree_paths: [...new Set(changedPaths || [])].sort(),
    reported_at: new Date().toISOString(),
  }
  const obligation = {
    ...current,
    contract_change_reports: [...(current.contract_change_reports || []), report],
  }
  await writeOwnerRecord(owner, { ...owner.record, adhoc_revalidation: obligation })
  return { owner: publicOwner(owner), obligation, report }
}

export function focusedOwnedPathDetails(path, coexistence) {
  if (!coexistence?.name || !coexistence?.run_id) return null
  const kind = coexistence.kind === 'mission' ? 'mission' : 'assignment'
  const normalized = String(path || '')
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
  const ownerRoot = `.specdev/${kind === 'mission' ? 'missions' : 'assignments'}/${coexistence.name}`
  const runRoot = `.specdev/.ripplegraph/runs/${coexistence.run_id}`
  const exactPaths = new Set(coexistence.preserved_paths || [])
  if (
    normalized === '.specdev/.current' ||
    normalized === '.specdev/.id-counters.json' ||
    normalized === '.specdev/.ripplegraph/current.json' ||
    normalized === ownerRoot ||
    normalized.startsWith(`${ownerRoot}/`) ||
    normalized === runRoot ||
    normalized.startsWith(`${runRoot}/`) ||
    normalized.startsWith('.specdev/.ripplegraph/runs/') ||
    normalized.startsWith('.specdev/processes/') ||
    exactPaths.has(normalized) ||
    (coexistence.child_paths || []).some(
      (childPath) => normalized === childPath || normalized.startsWith(`${childPath}/`)
    )
  ) {
    const label = `${kind === 'mission' ? 'Mission' : 'Assignment'} ${coexistence.id}`
    return {
      path: normalized,
      owner: label,
      reason: `preserved_${kind}_workflow_state`,
      next_action: `Leave this path with the active ${kind === 'mission' ? 'Mission' : 'Assignment'}; it is outside Adhoc ownership and delivery.`,
    }
  }
  return null
}

async function resolveAssignmentCoexistence(specdevPath) {
  const assignment = await readFocusedAssignmentLifecycle(specdevPath)
  if (!assignment) return { status: 'none' }
  if (assignment.lifecycle === 'unknown') {
    return ambiguousOwner(
      assignment,
      assignment.problem || 'The focused Assignment lifecycle cannot be resolved.'
    )
  }
  if (assignment.lifecycle !== 'active') return { status: 'none' }

  const status = assignment.status
  if (!status) return ambiguousOwner(assignment, 'The focused Assignment status is missing.')
  if (status.mission) {
    return blockedOwner(
      assignment,
      'focused_owner_unsupported',
      'mission_child_focus_requires_controller',
      `The focused Assignment belongs to Mission ${status.mission}; resume the Mission controller before requesting a detour.`,
      'Mission-owned child focus cannot be treated as a standalone Assignment or detached from its controller.'
    )
  }
  if (status.adhoc_revalidation?.status === 'required') {
    return revalidationBlocked(assignment, status.adhoc_revalidation)
  }
  if (status.git_boundary?.starting_git_commit_hash) {
    return boundaryBlocked(
      assignment,
      status.git_boundary.starting_git_commit_hash,
      'implementation_git_boundary_established'
    )
  }

  const runInspection = await inspectFocusedRun(specdevPath, assignment, 'assignment')
  if (!runInspection.valid) return ambiguousOwner(assignment, runInspection.problem)
  const attempts = await inspectAttempts(specdevPath, assignment)
  if (!attempts.valid) return attempts.blocked

  return {
    status: 'safe',
    focused: {
      version: 2,
      ...ownerFacts(assignment),
      run_status: runInspection.checkpoint.status,
      run_position: runInspection.checkpoint.position,
      preserved_paths: focusedOwnedPaths(assignment, attempts.records),
      child_paths: [],
    },
  }
}

async function resolveMissionCoexistence(specdevPath, selector) {
  const resolved = await resolveMissionSelector(specdevPath, selector)
  if (!resolved || resolved.ambiguous) {
    return ambiguousOwner(
      { kind: 'mission', id: String(selector), name: null, status: null },
      'Focused Mission artifacts are missing or ambiguous.'
    )
  }
  const mission = await readMission(resolved.path).catch(() => null)
  const owner = {
    kind: 'mission',
    id: String(mission?.id || resolved.id),
    name: resolved.name,
    path: resolved.path,
    status: mission?.status || 'unknown',
    run_id: mission?.run_id || null,
    record: mission,
  }
  if (!mission?.id || !mission?.run_id) {
    return ambiguousOwner(owner, 'The focused Mission record is missing or invalid.')
  }
  if (['completed', 'failed', 'abandoned'].includes(mission.status)) return { status: 'none' }
  if (mission.adhoc_revalidation?.status === 'required') {
    return revalidationBlocked(owner, mission.adhoc_revalidation)
  }
  if (mission.base_revision || mission.approved_contract_hash || mission.approved_at) {
    return boundaryBlocked(
      owner,
      mission.base_revision || mission.created_revision || 'established',
      'mission_execution_boundary_established'
    )
  }

  const runInspection = await inspectFocusedRun(specdevPath, owner, 'mission')
  if (!runInspection.valid) return ambiguousOwner(owner, runInspection.problem)
  const attempts = await inspectAttempts(specdevPath, owner)
  if (!attempts.valid) return attempts.blocked
  const childPaths = await missionChildPaths(specdevPath, mission.id)

  return {
    status: 'safe',
    focused: {
      version: 2,
      ...ownerFacts(owner),
      run_status: runInspection.checkpoint.status,
      run_position: runInspection.checkpoint.position,
      preserved_paths: focusedOwnedPaths(owner, attempts.records),
      child_paths: childPaths,
    },
  }
}

async function inspectFocusedRun(specdevPath, owner, kind) {
  const runId = owner.status?.run_id || owner.run_id
  const current = await fse
    .readJson(join(specdevPath, '.ripplegraph', 'current.json'))
    .catch(() => null)
  if (current?.focusedRunId !== runId) {
    return {
      valid: false,
      problem: `${ownerLabel(owner)} focus and RippleGraph ownership disagree.`,
    }
  }
  const checkpoint = await fse
    .readJson(join(specdevPath, '.ripplegraph', 'runs', runId, 'checkpoint.json'))
    .catch(() => null)
  const expectedRoot = `${kind}-lifecycle`
  if (
    checkpoint?.runId !== runId ||
    checkpoint?.rootGraph !== expectedRoot ||
    checkpoint?.status !== 'active' ||
    checkpoint?.position?.graph !== expectedRoot
  ) {
    return {
      valid: false,
      problem: `${ownerLabel(owner)} run is missing, inactive, or owned by another graph.`,
    }
  }
  if (!SAFE_POSITIONS[kind].has(checkpoint.position.node)) {
    return {
      valid: false,
      problem: `${ownerLabel(owner)} is at unsupported lifecycle position ${checkpoint.position.node}.`,
    }
  }
  return { valid: true, checkpoint }
}

async function inspectAttempts(specdevPath, owner) {
  let records
  try {
    records = (await listAttemptRecords(specdevPath)).filter(
      (attempt) => FOCUSED_ATTEMPT_KINDS.has(attempt.kind) && attemptBelongsToOwner(attempt, owner)
    )
  } catch (error) {
    return {
      valid: false,
      blocked: ambiguousOwner(
        owner,
        `${ownerLabel(owner)} Attempt records could not be classified: ${error.message}`
      ),
    }
  }
  const conflicts = []
  for (const attempt of records.filter((candidate) => candidate.status === 'running')) {
    const liveness = await attemptLiveness(specdevPath, attempt.id)
    conflicts.push({
      attempt: attempt.id,
      owner: `${ownerLabel(owner)} ${attempt.kind}`,
      reason: liveness.state === 'live_local' ? 'live_attempt' : 'ambiguous_running_attempt',
      liveness: liveness.state,
      next_action: 'Let the Attempt finish or recover it before starting Adhoc.',
    })
  }
  if (conflicts.length > 0) {
    return {
      valid: false,
      blocked: {
        status: 'blocked',
        state:
          owner.kind === 'mission' ? 'mission_attempt_conflict' : 'assignment_attempt_conflict',
        focused: ownerFacts(owner),
        ...ownerAlias(owner),
        conflicts,
        next_action: `Finish or recover every active ${ownerLabel(owner)} Attempt, then retry Adhoc start.`,
      },
    }
  }
  return { valid: true, records }
}

async function readFocusedOwner(specdevPath) {
  const focus = await readCurrentFocus(specdevPath)
  if (!focus) return null
  if (focus.kind === 'assignment') {
    const assignment = await readFocusedAssignmentLifecycle(specdevPath)
    if (!assignment?.status) return null
    return {
      kind: 'assignment',
      id: assignment.id,
      name: assignment.name,
      path: assignment.path,
      run_id: assignment.status.run_id,
      record: assignment.status,
    }
  }
  if (focus.kind === 'mission') {
    const resolved = await resolveMissionSelector(specdevPath, focus.id)
    if (!resolved || resolved.ambiguous) return null
    const record = await readMission(resolved.path).catch(() => null)
    if (!record) return null
    return {
      kind: 'mission',
      id: record.id,
      name: resolved.name,
      path: resolved.path,
      run_id: record.run_id,
      record,
    }
  }
  return null
}

async function writeOwnerRecord(owner, record) {
  if (owner.kind === 'mission') return writeMission(owner.path, record)
  const path = join(owner.path, 'status.json')
  const temporary = `${path}.tmp-${process.pid}`
  await fse.writeJson(temporary, record, { spaces: 2 })
  await fse.move(temporary, path, { overwrite: true })
}

async function missionChildPaths(specdevPath, missionId) {
  const root = join(specdevPath, 'assignments')
  if (!(await fse.pathExists(root))) return []
  const paths = []
  for (const entry of await fse.readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const status = await fse.readJson(join(root, entry.name, 'status.json')).catch(() => null)
    if (status?.mission === missionId) paths.push(`.specdev/assignments/${entry.name}`)
  }
  return paths.sort()
}

function attemptBelongsToOwner(attempt, owner) {
  if (owner.kind === 'mission') return String(attempt.mission || '') === owner.id
  return [owner.name, owner.id].includes(String(attempt.assignment || ''))
}

function focusedOwnedPaths(owner, attempts) {
  const kind = owner.kind === 'mission' ? 'mission' : 'assignment'
  const runId = owner.status?.run_id || owner.run_id
  return [
    '.specdev/.current',
    '.specdev/.id-counters.json',
    '.specdev/.ripplegraph/current.json',
    `.specdev/.ripplegraph/runs/${runId}`,
    `.specdev/${kind === 'mission' ? 'missions' : 'assignments'}/${owner.name}`,
    ...attempts.map((attempt) => `.specdev/processes/${attempt.id}.yaml`),
  ].sort()
}

function assertSameOwner(owner, coexistence) {
  if (
    !owner ||
    owner.kind !== coexistence?.kind ||
    owner.id !== coexistence?.id ||
    owner.run_id !== coexistence?.run_id
  ) {
    throw new Error('Focused workflow ownership changed during the Adhoc detour')
  }
}

function publicOwner(owner) {
  return {
    kind: owner.kind,
    id: owner.id,
    name: owner.name,
    run_id: owner.run_id,
  }
}

function ownerFacts(owner) {
  return {
    kind: owner.kind || 'assignment',
    id: owner.id,
    name: owner.name,
    lifecycle: owner.lifecycle || owner.status || owner.record?.status || 'active',
    run_id: owner.status?.run_id || owner.run_id || null,
  }
}

function ownerLabel(owner) {
  const kind = owner.kind === 'mission' ? 'Mission' : 'Assignment'
  return `${kind} ${owner.id}`
}

function boundaryBlocked(owner, boundary, reason) {
  return {
    status: 'blocked',
    state: owner.kind === 'mission' ? 'mission_boundary_conflict' : 'assignment_boundary_conflict',
    focused: ownerFacts(owner),
    ...ownerAlias(owner),
    conflicts: [
      {
        owner: ownerLabel(owner),
        reason,
        boundary,
        next_action: `Continue or otherwise resolve the ${owner.kind === 'mission' ? 'Mission' : 'Assignment'} without starting Adhoc.`,
      },
    ],
    next_action: `Continue the active ${owner.kind === 'mission' ? 'Mission' : 'Assignment'}, or cancel this Adhoc request. SpecDev will not rebase or terminate it implicitly.`,
  }
}

function revalidationBlocked(owner, obligation) {
  return {
    status: 'blocked',
    state: 'focused_revalidation_required',
    focused: ownerFacts(owner),
    ...ownerAlias(owner),
    revalidation: obligation,
    next_action:
      'Recheck the focused contract against the post-detour repository, then run specdev adhoc revalidate --contract=unchanged --outcome="<summary>".',
  }
}

function blockedOwner(owner, state, reason, problem, nextAction) {
  return {
    status: 'blocked',
    state,
    focused: ownerFacts(owner),
    ...ownerAlias(owner),
    conflicts: [{ owner: ownerLabel(owner), reason, problem, next_action: nextAction }],
    next_action: nextAction,
  }
}

function ambiguousOwner(owner, problem) {
  return blockedOwner(
    owner,
    owner.kind === 'mission' ? 'mission_state_ambiguous' : 'assignment_state_ambiguous',
    'uncertain_focused_ownership',
    problem,
    'Inspect the focused status, focus, run, and Attempt records; restore one unambiguous owner before retrying.'
  )
}

function ownerAlias(owner) {
  const facts = ownerFacts(owner)
  return owner.kind === 'mission' ? { mission: facts } : { assignment: facts }
}
