import { explicitImplementationMode } from './assignment-execution.js'

const MODES = new Set(['inline', 'spawned'])

export function requestedMissionImplementationMode(flags = {}) {
  return explicitImplementationMode(flags)
}

export function beginMissionImplementationChoice(mission) {
  mission.implementation_execution = { version: 1, status: 'pending' }
  mission.status = 'awaiting_execution_choice'
  return mission.implementation_execution
}

export function chooseMissionImplementation(mission, mode, now = new Date().toISOString()) {
  const current = normalizedMissionImplementation(mission)
  if (!current || current.status !== 'pending') {
    throw new Error(`Mission ${mission.id} is not awaiting an implementation execution choice`)
  }
  if (!MODES.has(mode)) throw new Error('Mission implementation must be inline or spawned')
  mission.implementation_execution = {
    version: 1,
    status: 'selected',
    mode,
    source: 'user',
    selected_at: now,
  }
  mission.status = 'running'
  return mission.implementation_execution
}

export function missionImplementationProjection(mission) {
  const execution = normalizedMissionImplementation(mission)
  if (!execution) return null
  const mode = execution.status === 'selected' ? execution.mode : null
  return {
    version: 1,
    status: execution.status,
    mode,
    source: execution.source || null,
    owner:
      execution.status === 'pending'
        ? 'user'
        : mode === 'inline'
          ? 'foreground-agent'
          : 'mission-controller',
    selected_at: execution.selected_at || null,
  }
}

export function missionImplementationMode(mission) {
  const execution = normalizedMissionImplementation(mission)
  if (!execution || execution.status !== 'selected') {
    throw new Error(`Mission ${mission.id} has no selected implementation execution mode`)
  }
  return execution.mode
}

export function missionUsesSpawnedImplementation(mission) {
  return missionImplementationMode(mission) === 'spawned'
}

export function missionChildImplementationExecution(mission) {
  const execution = normalizedMissionImplementation(mission)
  if (!execution || execution.status !== 'selected') {
    throw new Error(
      `Mission ${mission.id} cannot freeze child implementation before mode selection`
    )
  }
  const mode = execution.mode
  return {
    version: 1,
    configured_mode: mode,
    effective_mode: mode,
    source: execution.source === 'legacy' ? 'mission-legacy' : 'mission',
    reason: mode === 'spawned' ? 'Mission-selected spawned implementation' : null,
    owner: mode === 'inline' ? 'foreground-agent' : 'mission-controller',
    frozen_at: execution.selected_at || mission.approved_at || mission.created_at,
  }
}

function normalizedMissionImplementation(mission) {
  const value = mission?.implementation_execution
  if (!value) {
    if (!mission?.approved_contract_hash) return null
    return {
      version: 1,
      status: 'selected',
      mode: 'spawned',
      source: 'legacy',
      selected_at: mission.approved_at || null,
    }
  }
  if (value.version !== 1 || !['pending', 'selected'].includes(value.status)) {
    throw new Error(`Mission ${mission.id} implementation execution record is invalid`)
  }
  if (value.status === 'pending') {
    if (value.mode !== undefined || value.source !== undefined || value.selected_at !== undefined) {
      throw new Error(`Mission ${mission.id} pending implementation execution record is invalid`)
    }
    return value
  }
  if (!MODES.has(value.mode) || value.source !== 'user' || !validTimestamp(value.selected_at)) {
    throw new Error(`Mission ${mission.id} selected implementation execution record is invalid`)
  }
  return value
}

function validTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}
