export const MAX_PARALLEL_MISSION_CHILDREN = 3

const ACTIVE_STATUSES = new Set(['pending', 'running', 'completed', 'blocked'])
const TERMINAL_STATUSES = new Set(['integrated', 'cancelled'])

export function normalizeMissionWaves(assignments, { sequential = false } = {}) {
  if (!Array.isArray(assignments) || assignments.length === 0) {
    throw new Error('Mission Design requires a non-empty assignments list')
  }
  const normalized = assignments.map((item, index) => {
    const supplied = Number(item.wave)
    const wave = sequential ? index + 1 : supplied
    if (!Number.isSafeInteger(wave) || wave < 1) {
      throw new Error('Every planned Mission Assignment requires a positive integer wave')
    }
    return { ...item, wave }
  })
  const waves = [...new Set(normalized.map((item) => item.wave))].sort((a, b) => a - b)
  for (let index = 0; index < waves.length; index += 1) {
    if (waves[index] !== index + 1) {
      throw new Error('Mission waves must be dense positive integers beginning at 1')
    }
  }
  return normalized
}

export function currentMissionWave(queue) {
  const candidates = (queue?.assignments || [])
    .filter((item) => missionItemIsActive(item))
    .map((item) => Number(item.wave))
    .filter((wave) => Number.isSafeInteger(wave) && wave > 0)
  return candidates.length > 0 ? Math.min(...candidates) : null
}

export function missionWaveItems(queue, wave = currentMissionWave(queue)) {
  if (!wave) return []
  return (queue?.assignments || []).filter(
    (item) => Number(item.wave) === wave && !TERMINAL_STATUSES.has(item.status)
  )
}

export function missionWaveIsParallel(queue, wave = currentMissionWave(queue)) {
  return missionWaveItems(queue, wave).length > 1
}

export function integratableMissionPrefix(queue, wave = currentMissionWave(queue)) {
  const prefix = []
  for (const item of (queue?.assignments || []).filter((entry) => Number(entry.wave) === wave)) {
    if (item.status === 'integrated' || item.status === 'cancelled') continue
    if (item.status !== 'completed') break
    prefix.push(item)
  }
  return prefix
}

export function missionQueueHasRemaining(queue) {
  return (queue?.assignments || []).some((item) => missionItemIsActive(item))
}

export function nextMissionWaveIsParallel(queue) {
  return missionWaveIsParallel(queue, currentMissionWave(queue))
}

export function validateMissionQueueStatuses(queue) {
  const supported = new Set([
    'pending',
    'running',
    'completed',
    'integrated',
    'blocked',
    'cancelled',
  ])
  for (const item of queue?.assignments || []) {
    if (!supported.has(item.status)) {
      throw new Error(`Unsupported Mission Assignment status: ${item.status}`)
    }
  }
  return queue
}

export function missionIntegrationRecoveryAction({
  phase,
  stagedPaths = [],
  deliveryPaths = [],
  missionPrefix,
}) {
  if (!['applying', 'committing'].includes(phase)) {
    throw new Error(`Unsupported Mission integration phase: ${phase}`)
  }
  const delivery = new Set(deliveryPaths)
  const unexpected = stagedPaths.filter(
    (path) => !delivery.has(path) && path !== missionPrefix && !path.startsWith(`${missionPrefix}/`)
  )
  if (unexpected.length > 0) {
    throw new Error(`Unrelated staged paths: ${unexpected.join(', ')}`)
  }
  if (phase === 'committing') return 'commit'
  if (stagedPaths.length === 0) return 'retry'
  if (!stagedPaths.some((path) => delivery.has(path))) {
    throw new Error('No staged path belongs to the Mission child delivery')
  }
  return 'commit'
}

function missionItemIsActive(item) {
  if (item.status === 'completed' && !item.delivery_revision) return false
  return ACTIVE_STATUSES.has(item.status)
}
