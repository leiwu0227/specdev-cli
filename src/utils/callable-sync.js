import {
  getCallableCall,
  listCallableCalls,
  startCallableCall,
  stepCallableCall,
} from 'ripplegraph'
import { assertWorkspaceEngine, workflowRootFor } from './engine.js'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { discussionCompletions } from './discussion-completion.js'

export function startGuidedCall(projectRoot, graphId, callId, input = {}) {
  assertWorkspaceEngine(projectRoot)
  return {
    synchronized: true,
    state: startCallableCall({
      workflowRoot: workflowRootFor(projectRoot),
      graphId,
      callId,
      input,
    }),
  }
}

export function readGuidedCall(projectRoot, callId) {
  assertWorkspaceEngine(projectRoot)
  if (
    /^D\d{4,5}$/.test(callId) &&
    !existsSync(
      join(workflowRootFor(projectRoot), '.ripplegraph', 'calls', callId, 'checkpoint.json')
    )
  ) {
    const record = discussionCompletions(workflowRootFor(projectRoot)).find(
      (item) => item.id === callId
    )
    if (record) return { synchronized: true, state: record.state }
  }
  return {
    synchronized: true,
    state: getCallableCall({ workflowRoot: workflowRootFor(projectRoot), callId }),
  }
}

export function stepGuidedCall(projectRoot, callId, output) {
  assertWorkspaceEngine(projectRoot)
  return {
    synchronized: true,
    state: stepCallableCall({
      workflowRoot: workflowRootFor(projectRoot),
      callId,
      output,
    }),
  }
}

export function listGuidedCalls(projectRoot, graphId = null) {
  assertWorkspaceEngine(projectRoot)
  const result = listCallableCalls({ workflowRoot: workflowRootFor(projectRoot) })
  for (const record of discussionCompletions(workflowRootFor(projectRoot))) {
    if (!result.calls.some((call) => call.id === record.id))
      result.calls.push({
        id: record.id,
        status: 'completed',
        graphId: 'discussion-lifecycle',
        position: record.state.position,
        updatedAt: record.completed_at,
      })
  }
  return {
    synchronized: true,
    calls: graphId ? result.calls.filter((call) => call.graphId === graphId) : result.calls,
  }
}
