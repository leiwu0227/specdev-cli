import { abandonRun, applyDispatchAction, decideGate, getState, stepRun } from 'ripplegraph'
import { ensureWorkspaceEngine, hasWorkspaceEngine, workflowRootFor } from './engine.js'

export function startGuidedRun(projectRoot, graphId, options = {}) {
  if (!hasWorkspaceEngine(projectRoot)) return { synchronized: false, reason: 'engine_missing' }
  ensureWorkspaceEngine(projectRoot)
  const workflowRoot = workflowRootFor(projectRoot)
  const current = getState({ workflowRoot })
  if (current.status === 'ok' && current.run?.status === 'active') {
    if (current.run.rootGraph === graphId) {
      return { synchronized: true, state: current, started: false }
    }
    if (options.strict) {
      throw new Error(
        `another guided workflow is active; run 'specdev next --json' or 'specdev cancel' first`
      )
    }
    return { synchronized: false, reason: 'other_workflow_active', state: current }
  }
  const state = applyDispatchAction({
    workflowRoot,
    action: { action: 'start_run', graphId },
  })
  return { synchronized: true, state, started: true }
}

export function stepGuidedNode(projectRoot, expectedNodes, output) {
  if (!hasWorkspaceEngine(projectRoot)) return { synchronized: false, reason: 'engine_missing' }
  const workflowRoot = workflowRootFor(projectRoot)
  const current = getState({ workflowRoot })
  if (current.status !== 'ok' || current.run?.status !== 'active') {
    return { synchronized: false, reason: 'no_active_run' }
  }
  const expected = Array.isArray(expectedNodes) ? expectedNodes : [expectedNodes]
  if (!expected.includes(current.position.node)) {
    return { synchronized: false, reason: 'different_node', state: current }
  }
  return {
    synchronized: true,
    state: stepRun({ workflowRoot, output }),
  }
}

export function decideGuidedNode(projectRoot, expectedNode, decision) {
  if (!hasWorkspaceEngine(projectRoot)) return { synchronized: false, reason: 'engine_missing' }
  const workflowRoot = workflowRootFor(projectRoot)
  const current = getState({ workflowRoot })
  if (
    current.status !== 'ok' ||
    current.run?.status !== 'active' ||
    current.position.node !== expectedNode
  ) {
    return { synchronized: false, reason: 'different_node', state: current }
  }
  return {
    synchronized: true,
    state: decideGate({ workflowRoot, decision }),
  }
}

export function syncAssignmentApproval(projectRoot, phase) {
  const reviewNode = `${phase}-review`
  const approvalNode = phase === 'brainstorm' ? 'approve-brainstorm' : 'approve-implementation'
  stepGuidedNode(projectRoot, reviewNode, { review_complete: true })
  return stepGuidedNode(projectRoot, approvalNode, { approved: true })
}

export function restartAssignmentBrainstorm(projectRoot, assignment) {
  if (!hasWorkspaceEngine(projectRoot)) return { synchronized: false, reason: 'engine_missing' }
  ensureWorkspaceEngine(projectRoot)
  const workflowRoot = workflowRootFor(projectRoot)
  const current = getState({ workflowRoot })

  if (current.status === 'ok' && current.run?.status === 'active') {
    if (current.run.rootGraph !== 'assignment-lifecycle') {
      return { synchronized: false, reason: 'other_workflow_active', state: current }
    }
    if (current.position.node === 'brainstorm') {
      return { synchronized: true, restarted: false, state: current }
    }
    abandonRun({ workflowRoot, reason: `revising ${assignment.name}` })
  }

  applyDispatchAction({
    workflowRoot,
    action: { action: 'start_run', graphId: 'assignment-lifecycle' },
  })
  return {
    synchronized: true,
    restarted: true,
    state: stepRun({
      workflowRoot,
      output: {
        name: assignment.name,
        path: assignment.path,
        description: assignment.description || `Revise ${assignment.name}`,
      },
    }),
  }
}
