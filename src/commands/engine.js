import {
  abandonRun,
  applyDispatchAction,
  decideGate,
  getDispatchRequest,
  getState,
  listRegisteredGraphs,
  listRuns,
  recordSideChannelAction,
  stepRun,
} from 'ripplegraph'
import { join } from 'path'
import { resolveTargetDir, requireSpecdevDirectory } from '../utils/command-context.js'
import { assertWorkspaceEngine, workflowRootFor } from '../utils/engine.js'
import { graphTitle, toProductState, wrapDecision } from '../utils/engine-adapter.js'

export async function engineCommand(command, positionalArgs = [], flags = {}) {
  const projectRoot = resolveTargetDir(flags)
  await requireSpecdevDirectory(join(projectRoot, '.specdev'))

  try {
    assertWorkspaceEngine(projectRoot)
    const workflowRoot = workflowRootFor(projectRoot)
    const result = runEngineCommand(workflowRoot, command, positionalArgs, flags)
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    if (result.status === 'blocked' || result.status === 'error') process.exitCode = 1
    return result
  } catch (error) {
    const result = {
      status: 'error',
      state: 'workflow_unavailable',
      problem: error?.message || String(error),
      next_action: { command_line: 'specdev update' },
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    process.exitCode = 1
    return result
  }
}

export function runEngineCommand(workflowRoot, command, positionalArgs = [], flags = {}) {
  if (command === 'do') return doCommand(workflowRoot, positionalArgs.join(' '))
  if (command === 'next') return renderState(workflowRoot, getState({ workflowRoot }))
  if (command === 'status') return statusCommand(workflowRoot)
  if (command === 'decide') return decideCommand(workflowRoot, positionalArgs[0])
  if (command === 'step') return stepCommand(workflowRoot, parseJsonFlag(flags.json))
  if (command === 'action') {
    return actionCommand(workflowRoot, positionalArgs[0], parseJsonFlag(flags.json, null))
  }
  if (command === 'cancel') return cancelCommand(workflowRoot, positionalArgs.join(' '))
  throw new Error(`unknown engine command: ${command}`)
}

function renderState(workflowRoot, state) {
  return toProductState(state, listRegisteredGraphs(workflowRoot))
}

function doCommand(workflowRoot, intent) {
  const current = getState({ workflowRoot })
  if (current.status === 'ok' && current.run?.status === 'active') {
    return {
      status: 'blocked',
      state: 'workflow_active',
      problem: 'a guided workflow is already active in this project',
      current: renderState(workflowRoot, current),
      next_action: { command_line: 'specdev next --json' },
    }
  }

  const request = getDispatchRequest({ workflowRoot, request: intent || '' })
  const workflows = request.availableGraphs.filter((graph) => graph.kind === 'workflow')
  const { matched, ranked } = selectIntentMatches(intent, workflows)
  if (matched.length !== 1) {
    const shortlist = ranked.length ? ranked.slice(0, 6).map((entry) => entry.graph) : workflows
    return {
      status: 'ok',
      state: 'needs_choice',
      problem: 'could not determine one guided workflow from that request',
      options: shortlist.map((graph, index) => ({
        n: index + 1,
        title: graph.title,
        description: graph.description,
      })),
      next_action: { command_line: 'specdev do "<more specific intent>"' },
    }
  }

  const graph = matched[0]
  const suspended = listRuns({ workflowRoot })
    .runs.filter((run) => run.status === 'suspended' && run.rootGraph === graph.id)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
  const action = suspended
    ? { action: 'resume_run', runId: suspended.id }
    : { action: 'start_run', graphId: graph.id }
  return renderState(workflowRoot, applyDispatchAction({ workflowRoot, action }))
}

function decideCommand(workflowRoot, rawValue) {
  if (!rawValue) throw new Error('decide requires <value-or-json>')
  const state = getState({ workflowRoot })
  const semanticBlock = semanticTransitionBlock(state, 'decide')
  if (semanticBlock) return semanticBlock
  const schema = state?.node?.gate?.decisionSchema
  if (!schema) throw new Error('current workflow step is not awaiting a decision')
  const value = parseJsonValue(rawValue)
  return renderState(
    workflowRoot,
    decideGate({ workflowRoot, decision: wrapDecision(value, schema) })
  )
}

function stepCommand(workflowRoot, output) {
  const currentState = getState({ workflowRoot })
  const semanticBlock = semanticTransitionBlock(currentState, 'step')
  if (semanticBlock) return semanticBlock
  const result = renderState(workflowRoot, stepRun({ workflowRoot, output: output || {} }))
  if (result.state !== 'invalid') return result
  const current = renderState(workflowRoot, getState({ workflowRoot }))
  return {
    ...result,
    ...(current.prompt ? { prompt: current.prompt } : {}),
    ...(current.instructions ? { instructions: current.instructions } : {}),
    ...(current.output_schema ? { output_schema: current.output_schema } : {}),
  }
}

function actionCommand(workflowRoot, actionId, input) {
  if (!actionId) throw new Error('action requires <action-id>')
  const state = getState({ workflowRoot })
  const semanticBlock = semanticTransitionBlock(state, 'action')
  if (semanticBlock) return semanticBlock
  const available = (state?.node?.sideChannelActions || []).map((action) => action.id)
  if (!available.includes(actionId)) {
    throw new Error(`unknown action '${actionId}'; available: ${available.join(', ') || '(none)'}`)
  }
  const result = recordSideChannelAction({ workflowRoot, actionId, input })
  return renderState(workflowRoot, result.state)
}

function semanticTransitionBlock(state, operation) {
  if (!['assignment-lifecycle', 'mission-lifecycle'].includes(state.position?.graph)) return null
  const commandLine = state.node?.operatorContext?.command || 'specdev next --json'
  return {
    status: 'blocked',
    state: 'semantic_command_required',
    problem: `generic ${operation} cannot advance ${state.position.graph}; use its semantic command`,
    next_action: { command_line: commandLine },
  }
}

function statusCommand(workflowRoot) {
  const graphs = listRegisteredGraphs(workflowRoot)
  const runs = listRuns({ workflowRoot })
  return {
    command: 'status',
    ...renderState(workflowRoot, getState({ workflowRoot })),
    runs: runs.runs.map((run, index) => ({
      n: index + 1,
      workflow: graphTitle(run.rootGraph, graphs),
      status: run.status,
      updated_at: run.updatedAt,
      focused: run.id === runs.focusedRunId,
    })),
  }
}

function cancelCommand(workflowRoot, reason) {
  const current = getState({ workflowRoot })
  if (current.status !== 'ok' || current.run?.status !== 'active') {
    return {
      status: 'blocked',
      state: 'idle',
      problem: 'no active guided workflow to cancel',
      next_action: { command_line: 'specdev do "<intent>"' },
    }
  }
  abandonRun({ workflowRoot, reason: reason || undefined })
  return {
    status: 'ok',
    state: 'cancelled',
    next_action: { command_line: 'specdev do "<intent>"' },
  }
}

function parseJsonFlag(value, fallback = {}) {
  if (value === undefined || value === true) return fallback
  if (typeof value !== 'string') return value
  return JSON.parse(value)
}

function parseJsonValue(value) {
  const trimmed = String(value).trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value
  return JSON.parse(trimmed)
}

function selectIntentMatches(intent, graphs) {
  const ranked = rankIntentMatches(intent, graphs)
  if (ranked.length === 0) return { matched: [], ranked }
  const top = ranked[0]
  const tied = ranked.filter((entry) => entry.score === top.score)
  if (tied.length > 1) return { matched: [], ranked }
  if (top.exact || top.contiguous) return { matched: [top.graph], ranked }
  const second = ranked[1]
  if (top.overlap >= 2 && (!second || top.score >= second.score * 1.5)) {
    return { matched: [top.graph], ranked }
  }
  return { matched: [], ranked }
}

function rankIntentMatches(intent, graphs) {
  const text = normalizeIntent(intent)
  if (!text) return []
  const intentTokens = new Set(text.split(' ').filter(Boolean))
  return graphs
    .map((graph) => {
      const phrases = [...(graph.activationHints || []), graph.id, graph.title]
        .map(normalizeIntent)
        .filter(Boolean)
      let score = 0
      let exact = false
      let contiguous = false
      let overlap = 0
      for (const phrase of phrases) {
        if (phrase === text) {
          exact = true
          score = Math.max(score, 1000 + phrase.length)
        } else if (` ${text} `.includes(` ${phrase} `)) {
          contiguous = true
          score = Math.max(score, 100 + phrase.length)
        } else {
          const words = phrase.split(' ').filter(Boolean)
          const hits = words.filter((word) => intentTokens.has(word)).length
          if (hits > 0) {
            overlap = Math.max(overlap, hits)
            score = Math.max(score, (hits / words.length) * 10 + hits)
          }
        }
      }
      return { graph, score, exact, contiguous, overlap }
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
}

function normalizeIntent(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
