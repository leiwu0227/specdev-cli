import { gitStatusPaths, summarizeGitPaths } from './git-delivery.js'
import { readCurrentFocus } from './current.js'
import { resolveMissionSelector, readMission } from './mission.js'
import { attemptLiveness, listAttemptRecords } from './process-record.js'

export async function buildStatusViews({ targetDir, specdevPath, history, assignment = null }) {
  const focus = await readCurrentFocus(specdevPath)
  const attempts = focus
    ? relevantAttempts(await listAttemptRecords(specdevPath), focus, assignment)
    : []
  const runningAttempt = [...attempts].reverse().find((attempt) => attempt.status === 'running')
  const liveness = runningAttempt ? await attemptLiveness(specdevPath, runningAttempt.id) : null
  const lifecycle = await focusedLifecycle(specdevPath, focus, assignment, history)
  const dirtyPaths = await gitStatusPaths(targetDir)
  return projectStatusViews({
    history,
    focus,
    assignment,
    lifecycle,
    attempts,
    runningAttempt,
    liveness,
    dirtyPaths,
  })
}

export function projectStatusViews({
  history,
  focus = null,
  assignment = null,
  lifecycle = null,
  attempts = [],
  runningAttempt = null,
  liveness = null,
  dirtyPaths = [],
}) {
  const latestAttempt = attempts.at(-1) || null
  const interrupted = runningAttempt && liveness?.state !== 'live_local'
  const terminalBlock =
    !runningAttempt &&
    ['blocked', 'failed', 'interrupted'].includes(latestAttempt?.status) &&
    history.phase === 'implementation'
      ? latestAttempt
      : null
  const effectiveLifecycle = interrupted
    ? 'interrupted'
    : terminalBlock
      ? terminalBlock.status === 'failed'
        ? 'blocked'
        : terminalBlock.status
      : lifecycle || lifecycleFromHistory(history)
  const blocker =
    history.problem ||
    assignment?.problem ||
    (interrupted
      ? `Attempt ${runningAttempt.id} has ${liveness.state} process liveness; inspect it before takeover.`
      : terminalBlock
        ? `Attempt ${terminalBlock.id} is ${terminalBlock.status}; inspect its durable result before continuing.`
        : null)
  const active = {
    command: 'status',
    version: 2,
    focus: focus
      ? {
          kind: focus.kind,
          id: String(focus.id),
          ...(assignment?.name ? { name: assignment.name } : {}),
        }
      : null,
    lifecycle: effectiveLifecycle,
    ...(history.phase ? { phase: history.phase } : {}),
    ...(runningAttempt
      ? {
          attempt: {
            id: runningAttempt.id,
            role: runningAttempt.kind,
            status: interrupted ? 'interrupted' : 'running',
            liveness: liveness?.state || 'unknown',
          },
        }
      : history.state === 'awaiting_decision'
        ? {
            pending_decision: {
              prompt: history.prompt,
              choices: history.choices || [],
            },
          }
        : {}),
    next_action: history.next_action || normalizeNextAction(assignment?.next_action),
    dirty_paths: summarizeGitPaths(dirtyPaths),
    ...(blocker ? { blocker } : {}),
  }
  return { active, history }
}

export function formatStatusView(active, history = null) {
  const lines = [`SpecDev status: ${active.lifecycle}`]
  if (active.focus) {
    const label = `${capitalize(active.focus.kind)} ${active.focus.id}`
    lines.push(`Focus: ${label}${active.focus.name ? ` (${active.focus.name})` : ''}`)
  } else {
    lines.push('Focus: none')
  }
  if (active.phase) lines.push(`Phase: ${active.phase}`)
  if (active.attempt) {
    lines.push(
      `Attempt: ${active.attempt.id} (${active.attempt.role}, ${active.attempt.status}; ${active.attempt.liveness})`
    )
  }
  if (active.pending_decision) {
    lines.push(`Decision: ${active.pending_decision.prompt}`)
    for (const choice of active.pending_decision.choices) {
      lines.push(`  ${choice.n}. ${choice.label || choice.value}`)
    }
  }
  lines.push(`Dirty paths: ${formatDirtyPaths(active.dirty_paths)}`)
  if (active.blocker) lines.push(`Blocker: ${active.blocker}`)
  if (active.next_action) {
    lines.push(`Next: ${active.next_action.command_line || active.next_action}`)
  }
  if (history) {
    lines.push('', 'Run history:')
    if (!history.runs?.length) lines.push('  none')
    for (const run of history.runs || []) {
      const focused = run.focused ? ', focused' : ''
      lines.push(`  ${run.n}. ${run.workflow}: ${run.status}${focused}; updated ${run.updated_at}`)
    }
  }
  return `${lines.join('\n')}\n`
}

function relevantAttempts(attempts, focus, assignment) {
  return attempts.filter((attempt) => {
    if (focus.kind === 'assignment') {
      return [String(focus.id), assignment?.name].filter(Boolean).includes(attempt.assignment)
    }
    if (focus.kind === 'mission') return attempt.mission === focus.id
    if (focus.kind === 'discussion') return attempt.discussion === focus.id
    return false
  })
}

async function focusedLifecycle(specdevPath, focus, assignment, history) {
  if (!focus) return lifecycleFromHistory(history)
  if (focus.kind === 'assignment') return assignment?.lifecycle || lifecycleFromHistory(history)
  if (focus.kind === 'mission') {
    const resolved = await resolveMissionSelector(specdevPath, focus.id)
    if (resolved && !resolved.ambiguous) {
      const mission = await readMission(resolved.path).catch(() => null)
      if (mission?.status) return mission.status
    }
  }
  return lifecycleFromHistory(history)
}

function lifecycleFromHistory(history) {
  if (history.state === 'idle') return 'idle'
  if (history.status === 'blocked' || history.status === 'error') return 'blocked'
  if (history.state === 'completed') return 'completed'
  return 'active'
}

function normalizeNextAction(value) {
  return value ? { command_line: value } : null
}

function formatDirtyPaths(summary) {
  if (!summary?.count) return 'clean'
  const preview = summary.preview.join(', ')
  return `${summary.count} (${preview}${summary.omitted ? `, +${summary.omitted} more` : ''})`
}

function capitalize(value) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`
}
