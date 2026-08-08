import { createHash } from 'node:crypto'

export const MISSION_GAP_STAGES = Object.freeze(['resolution', 'resolver', 'arbiter'])
export const MISSION_GAP_FAILURES = Object.freeze([
  'semantic-failure',
  'authority-failure',
  'infrastructure-failure',
])

export function ensureMissionGapState(mission) {
  const existing = mission.gaps
  if (existing?.version === 1 && Array.isArray(existing.items)) {
    existing.processed_signals = Array.isArray(existing.processed_signals)
      ? existing.processed_signals
      : []
    return existing
  }
  mission.gaps = {
    version: 1,
    items: [],
    processed_signals: [],
  }
  return mission.gaps
}

export function openMissionGap(
  mission,
  {
    kind,
    sourceId,
    signalId,
    artifact = null,
    parentGapId = null,
    acceptance = null,
    findingType = null,
    now = new Date().toISOString(),
  }
) {
  const state = ensureMissionGapState(mission)
  const signal = requiredIdentity(signalId, 'Mission gap signal')
  const processed = state.processed_signals.includes(signal)
  if (processed) {
    return {
      gap: parentGapId
        ? state.items.find((item) => item.id === parentGapId) || null
        : state.items.find((item) => item.source?.key === sourceKey(kind, sourceId)) || null,
      created: false,
      processed: false,
    }
  }

  let gap
  if (parentGapId) {
    gap = state.items.find((item) => item.id === parentGapId)
    if (!gap) throw new Error(`Mission repair descendant references unknown gap ${parentGapId}`)
  } else {
    const key = sourceKey(kind, sourceId, acceptance, findingType)
    gap = state.items.find((item) => item.source?.key === key)
    if (!gap) {
      gap = {
        id: stableGapId(key),
        source: {
          kind: requiredIdentity(kind, 'Mission gap source kind'),
          id: requiredIdentity(sourceId, 'Mission gap source identity'),
          key,
        },
        status: 'open',
        stage: 'resolution',
        disposition: 'unresolved',
        ...(acceptance ? { acceptance } : {}),
        ...(findingType ? { finding_type: findingType } : {}),
        assignments: [],
        signals: [],
        created_at: now,
        updated_at: now,
      }
      state.items.push(gap)
    } else if (gap.status === 'closed') {
      delete gap.closed_at
      delete gap.evidence
    }
  }

  state.processed_signals.push(signal)
  gap.signals = Array.isArray(gap.signals) ? gap.signals : []
  gap.signals.push(signal)
  gap.status = 'open'
  gap.updated_at = now
  if (artifact) gap.artifact = artifact
  return { gap, created: gap.created_at === now && gap.signals.length === 1, processed: true }
}

export function advanceMissionGap(
  mission,
  gapId,
  { signalId, artifact = null, now = new Date().toISOString() }
) {
  const state = ensureMissionGapState(mission)
  const gap = requiredGap(state, gapId)
  const signal = requiredIdentity(signalId, 'Mission gap escalation signal')
  if (state.processed_signals.includes(signal)) {
    return { gap, advanced: false }
  }
  state.processed_signals.push(signal)
  gap.signals = [...(gap.signals || []), signal]
  const index = MISSION_GAP_STAGES.indexOf(gap.stage)
  if (index < 0) throw new Error(`Mission gap ${gap.id} has invalid stage ${gap.stage}`)
  gap.stage = MISSION_GAP_STAGES[Math.min(index + 1, MISSION_GAP_STAGES.length - 1)]
  gap.status = 'open'
  gap.updated_at = now
  if (artifact) gap.artifact = artifact
  return { gap, advanced: true }
}

export function attachMissionGapAssignment(
  mission,
  gapId,
  assignmentId,
  { stage, now = new Date().toISOString() } = {}
) {
  const gap = requiredGap(ensureMissionGapState(mission), gapId)
  const assignment = requiredIdentity(assignmentId, 'Mission gap Assignment')
  const resolutionStage = stage || gap.stage
  if (!MISSION_GAP_STAGES.includes(resolutionStage)) {
    throw new Error(`Mission gap ${gap.id} has invalid Assignment stage ${resolutionStage}`)
  }
  gap.assignments = Array.isArray(gap.assignments) ? gap.assignments : []
  const existing = gap.assignments.find((item) => item.id === assignment)
  if (!existing) gap.assignments.push({ id: assignment, stage: resolutionStage })
  gap.status = 'resolving'
  gap.updated_at = now
  return gap
}

export function awaitMissionGapValidation(
  mission,
  gapId,
  { artifact = null, now = new Date().toISOString() } = {}
) {
  const gap = requiredGap(ensureMissionGapState(mission), gapId)
  gap.status = 'validating'
  gap.updated_at = now
  if (artifact) gap.artifact = artifact
  return gap
}

export function closeMissionGap(
  mission,
  gapId,
  { evidence = null, authority = null, now = new Date().toISOString() } = {}
) {
  const gap = requiredGap(ensureMissionGapState(mission), gapId)
  gap.status = 'closed'
  gap.disposition = 'evidence-closed'
  gap.closed_at = now
  gap.updated_at = now
  if (evidence) gap.evidence = evidence
  if (authority) gap.closure_authority = authority
  return gap
}

export function supersedeMissionGap(
  mission,
  gapId,
  { supersededBy, evidence = null, authority = null, now = new Date().toISOString() }
) {
  const gap = requiredGap(ensureMissionGapState(mission), gapId)
  const replacement = requiredIdentity(supersededBy, 'Superseding Mission finding')
  gap.status = 'superseded'
  gap.disposition = 'evidence-superseded'
  gap.superseded_by = replacement
  gap.superseded_at = now
  gap.updated_at = now
  if (evidence) gap.evidence = evidence
  if (authority) gap.closure_authority = authority
  return gap
}

export function failMissionGap(
  mission,
  gapId,
  disposition,
  { reason, evidence = null, now = new Date().toISOString() } = {}
) {
  if (!MISSION_GAP_FAILURES.includes(disposition)) {
    throw new Error(`Invalid Mission gap failure disposition: ${disposition}`)
  }
  const gap = requiredGap(ensureMissionGapState(mission), gapId)
  gap.status = 'failed'
  gap.disposition = disposition
  gap.reason = String(reason || '').trim() || 'Mission gap could not be resolved.'
  gap.failed_at = now
  gap.updated_at = now
  if (evidence) gap.evidence = evidence
  return gap
}

export function actionableMissionGap(mission) {
  return (
    ensureMissionGapState(mission).items.find(
      (gap) => gap.status === 'open' && MISSION_GAP_STAGES.includes(gap.stage)
    ) || null
  )
}

export function missionGap(mission, gapId) {
  return ensureMissionGapState(mission).items.find((item) => item.id === gapId) || null
}

export function missionGapForSource(
  mission,
  kind,
  sourceId,
  acceptance = null,
  findingType = null
) {
  const key = sourceKey(kind, sourceId, acceptance, findingType)
  return (
    ensureMissionGapState(mission).items.find(
      (item) => item.source?.key === key && !['closed', 'superseded'].includes(item.status)
    ) || null
  )
}

export function recordMissionSourceGap(
  mission,
  { kind, sourceId, signalId, artifact, acceptance = null, findingType = null }
) {
  const existing = missionGapForSource(mission, kind, sourceId, acceptance, findingType)
  if (!existing) {
    return openMissionGap(mission, {
      kind,
      sourceId,
      signalId,
      artifact,
      acceptance,
      findingType,
    }).gap
  }
  if (['resolving', 'validating'].includes(existing.status)) {
    return advanceMissionGap(mission, existing.id, { signalId, artifact }).gap
  }
  return openMissionGap(mission, {
    kind,
    sourceId,
    signalId,
    artifact,
    parentGapId: existing.id,
    acceptance,
    findingType,
  }).gap
}

export function adoptLegacyMissionReplan(mission) {
  const trigger = mission.pending_replan
  if (!trigger) {
    ensureMissionGapState(mission)
    return false
  }
  if (trigger.reason === 'parallel_wave_follow_up') {
    for (const child of trigger.children || []) {
      recordMissionSourceGap(mission, {
        kind: 'child',
        sourceId: child,
        signalId: `legacy-wave:${trigger.wave}:${child}`,
        artifact: trigger.artifact || null,
      })
    }
  } else {
    const source =
      trigger.reason === 'child_follow_up'
        ? { kind: 'child', id: trigger.child }
        : trigger.reason === 'mission_review'
          ? { kind: 'mission-review', id: 'convergence' }
          : trigger.reason === 'final_verification'
            ? { kind: 'final-verification', id: 'authorized-command' }
            : { kind: 'mission-convergence', id: trigger.reason || 'legacy-replan' }
    const gap = recordMissionSourceGap(mission, {
      kind: source.kind,
      sourceId: source.id,
      signalId: `legacy:${trigger.reason}:${trigger.child || trigger.wave || trigger.created_at || 'signal'}`,
      artifact: trigger.artifact || null,
    })
    if (trigger.review_stage === 'resolver' && gap.stage === 'resolution') {
      advanceMissionGap(mission, gap.id, {
        signalId: `legacy:${trigger.reason}:resolver`,
        artifact: trigger.artifact || null,
      })
    }
  }
  delete mission.pending_replan
  delete mission.replan_attempts
  return true
}

export function compactMissionGaps(mission) {
  const state = ensureMissionGapState(mission)
  return {
    opened: state.items.length,
    closed: state.items.filter((gap) => ['closed', 'superseded'].includes(gap.status)).length,
    failed: state.items.filter((gap) => gap.status === 'failed').length,
    dispositions: Object.fromEntries(
      [...new Set(state.items.map((gap) => gap.disposition))].map((disposition) => [
        disposition,
        state.items.filter((gap) => gap.disposition === disposition).length,
      ])
    ),
  }
}

function sourceKey(kind, sourceId, acceptance = null, findingType = null) {
  const base = `${requiredIdentity(kind, 'Mission gap source kind')}:${requiredIdentity(
    sourceId,
    'Mission gap source identity'
  )}`
  return acceptance || findingType
    ? `${base}:${requiredIdentity(acceptance, 'Mission gap acceptance')}:${requiredIdentity(
        findingType,
        'Mission gap finding type'
      )}`
    : base
}

function stableGapId(key) {
  return `gap-${createHash('sha256').update(key).digest('hex').slice(0, 16)}`
}

function requiredIdentity(value, label) {
  const normalized = String(value || '').trim()
  if (!normalized) throw new Error(`${label} is required`)
  return normalized
}

function requiredGap(state, gapId) {
  const id = requiredIdentity(gapId, 'Mission gap ID')
  const gap = state.items.find((item) => item.id === id)
  if (!gap) throw new Error(`Unknown Mission gap ${id}`)
  return gap
}
