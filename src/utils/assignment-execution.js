import { join } from 'node:path'
import { resolveImplementationMode } from './agent-profiles.js'

const EXECUTION_MODES = new Set(['auto', 'inline', 'spawned'])

export async function resolveAssignmentExecution(
  specdevPath,
  { flags = {}, mission = false, frozen = null, legacySpawned = false } = {}
) {
  const explicit = explicitMode(flags)
  const suppliedReason = boundedReason(flags['execution-reason'])
  if (suppliedReason && explicit !== 'spawned') {
    throw new Error('--execution-reason is supported only with --spawned')
  }
  if (frozen) return validateFrozenExecution(frozen, explicit)

  if (mission) {
    if (explicit === 'inline') {
      throw new Error('Mission-controlled Assignment execution is fixed to spawned mode')
    }
    return executionDecision({
      configuredMode: 'spawned',
      effectiveMode: 'spawned',
      source: 'mission',
      reason: 'Mission-controlled Assignment execution',
      owner: 'mission-controller',
    })
  }

  if (legacySpawned) {
    if (explicit === 'inline') {
      throw new Error(
        'Preserved legacy worker results are fixed to spawned recovery and cannot switch to inline'
      )
    }
    return executionDecision({
      configuredMode: 'auto',
      effectiveMode: 'spawned',
      source: 'legacy-recovery',
      reason: 'Preserved spawned-worker result predates execution-mode recording',
      owner: 'spawned-worker',
    })
  }

  const configuredMode = await resolveImplementationMode(specdevPath)
  if (configuredMode !== 'auto' && explicit && explicit !== configuredMode) {
    throw new Error(
      `implementation.mode=${configuredMode} conflicts with explicit --${explicit}; change the fixed configuration or omit the flag`
    )
  }
  const effectiveMode = explicit || (configuredMode === 'auto' ? 'inline' : configuredMode)
  const source = explicit ? 'command' : configuredMode === 'auto' ? 'auto-default' : 'configuration'
  const reason =
    effectiveMode === 'spawned'
      ? suppliedReason ||
        (source === 'configuration'
          ? 'Fixed spawned implementation policy'
          : 'Explicit --spawned selection')
      : null
  return executionDecision({
    configuredMode,
    effectiveMode,
    source,
    reason,
    owner: effectiveMode === 'inline' ? 'foreground-agent' : 'spawned-worker',
  })
}

export function assignmentExecutionProjection(status, node = null) {
  const execution = status?.implementation_execution
  if (!execution) return null
  const currentOwner =
    node === 'implementation-review'
      ? 'independent-reviewer'
      : node === 'done' || status?.status === 'completed'
        ? 'none'
        : execution.owner
  return {
    configured_mode: execution.configured_mode,
    effective_mode: execution.effective_mode,
    source: execution.source,
    reason: execution.reason,
    current_owner: currentOwner,
    recovery_action: executionNextAction(execution, node),
  }
}

export function inlineImplementationObligations({
  targetDir,
  assignmentPath,
  contract,
  issue = null,
  resultFile = 'worker-result.md',
}) {
  const relative = (path) =>
    path
      .slice(targetDir.length + 1)
      .split('\\')
      .join('/')
  return {
    owner: 'foreground-agent',
    action: issue ? 'repair-preserved-inline-delivery' : 'implement-approved-assignment-inline',
    obligations: {
      contract: relative(contract.path),
      plan: relative(join(assignmentPath, 'design', 'plan.md')),
      progress: relative(join(assignmentPath, 'implementation', 'progress.json')),
      outcome: relative(join(assignmentPath, 'outcome.md')),
      result: relative(join(assignmentPath, 'implementation', resultFile)),
    },
    ...(issue ? { issue: String(issue).slice(0, 500) } : {}),
    result_contract: {
      format: 'worker-result-envelope',
      status: ['completed', 'blocked'],
      required_section: '## Changes',
    },
    verification:
      'Run only repository-authorized focused verification and record every receipt in implementation/progress.json.',
    next_command: 'specdev implement',
  }
}

function explicitMode(flags) {
  const inline = flags.inline !== undefined
  const spawned = flags.spawned !== undefined
  if (inline && flags.inline !== true) throw new Error('--inline does not accept a value')
  if (spawned && flags.spawned !== true) throw new Error('--spawned does not accept a value')
  if (inline && spawned) throw new Error('--inline and --spawned conflict; choose exactly one')
  return inline ? 'inline' : spawned ? 'spawned' : null
}

function validateFrozenExecution(frozen, explicit) {
  if (!frozen || frozen.version !== 1) {
    throw new Error('frozen Assignment implementation execution record is invalid')
  }
  if (!EXECUTION_MODES.has(frozen.configured_mode)) {
    throw new Error('frozen Assignment implementation configured_mode is invalid')
  }
  if (!['inline', 'spawned'].includes(frozen.effective_mode)) {
    throw new Error('frozen Assignment implementation effective_mode is invalid')
  }
  if (explicit && explicit !== frozen.effective_mode) {
    throw new Error(
      `Assignment implementation mode is frozen as ${frozen.effective_mode}; executor switching after the Git boundary is not supported`
    )
  }
  return frozen
}

function executionDecision({ configuredMode, effectiveMode, source, reason, owner }) {
  return {
    version: 1,
    configured_mode: configuredMode,
    effective_mode: effectiveMode,
    source,
    reason,
    owner,
    frozen_at: new Date().toISOString(),
  }
}

function executionNextAction(execution, node) {
  if (node === 'implementation-review') return 'Run or resume the independent implementation review.'
  if (node === 'repair' && execution.effective_mode === 'inline') {
    return 'The foreground agent repairs the preserved candidate, then reruns specdev implement.'
  }
  if (['design', 'implementation'].includes(node) && execution.effective_mode === 'inline') {
    return 'The foreground agent completes the structured delivery obligations, then reruns specdev implement.'
  }
  if (node === 'done') return 'Assignment complete.'
  return execution.effective_mode === 'spawned'
    ? 'Run specdev implement to resume the spawned implementation path.'
    : 'Run specdev implement to continue.'
}

function boundedReason(value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  if (text.length > 240) throw new Error('--execution-reason must be at most 240 characters')
  return text
}
