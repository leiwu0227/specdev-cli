import {
  getCallableCall,
  listCallableCalls,
  startCallableCall,
  stepCallableCall,
} from 'ripplegraph'
import { assertWorkspaceEngine, workflowRootFor } from './engine.js'

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
  return {
    synchronized: true,
    calls: graphId ? result.calls.filter((call) => call.graphId === graphId) : result.calls,
  }
}
