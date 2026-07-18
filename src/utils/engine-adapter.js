const CHOICE_RENDER_HINT =
  'Present these choices in the exact order shown and wait for an explicit user selection.'

export function toProductState(state, graphs = []) {
  if (state.status === 'no_focused_run') {
    return {
      status: 'ok',
      state: 'idle',
      next_action: { command_line: 'specdev do "<intent>"' },
    }
  }

  if (state.status === 'completed' || state.run?.status === 'completed') {
    return {
      status: 'ok',
      state: 'completed',
      workflow: graphTitle(state.run?.rootGraph, graphs),
      next_action: { command_line: 'specdev do "<intent>"' },
    }
  }

  if (state.status === 'validation_error') {
    return {
      status: 'blocked',
      state: 'invalid',
      errors: state.errors,
      next_action: { command_line: 'specdev next --json' },
    }
  }

  const node = state.node || {}
  const workflow = graphTitle(state.run?.rootGraph, graphs)
  const actions = (node.sideChannelActions || []).map((action) => ({
    id: action.id,
    purpose: action.purpose,
  }))
  const choices = (node.interaction?.choices || []).map((choice, index) => ({
    n: index + 1,
    value: choice.value,
    label: choice.label,
    ...(node.operatorContext?.commands?.[choice.value]
      ? { command: node.operatorContext.commands[choice.value] }
      : {}),
  }))
  const callStack = productCallStack(state, graphs)

  if (node.gate) {
    return {
      status: 'ok',
      state: 'awaiting_decision',
      workflow,
      phase: node.operatorContext?.phase || null,
      prompt: node.interaction?.prompt || node.purpose,
      choices,
      ...(choices.length ? { render_hint: CHOICE_RENDER_HINT } : {}),
      ...(node.instructions ? { instructions: node.instructions } : {}),
      ...(actions.length ? { actions } : {}),
      ...(callStack ? { call_stack: callStack } : {}),
      next_action: { command_line: 'specdev decide <value>' },
    }
  }

  return {
    status: 'ok',
    state: 'in_progress',
    workflow,
    phase: node.operatorContext?.phase || null,
    prompt: node.purpose,
    ...(node.instructions ? { instructions: node.instructions } : {}),
    ...(node.outputSchema ? { output_schema: node.outputSchema } : {}),
    ...(choices.length ? { choices, render_hint: CHOICE_RENDER_HINT } : {}),
    ...(actions.length ? { actions } : {}),
    ...(callStack ? { call_stack: callStack } : {}),
    next_action: { command_line: 'specdev step --json=<output>' },
  }
}

export function wrapDecision(value, decisionSchema) {
  if (isPlainObject(value)) return value
  const field = decisionSchema?.required?.[0] || Object.keys(decisionSchema?.properties || {})[0]
  if (!field) throw new Error('current gate has no decision field')
  return { [field]: value }
}

export function graphTitle(graphId, graphs = []) {
  if (!graphId) return null
  return graphs.find((graph) => graph.id === graphId)?.title || 'Guided workflow'
}

function productCallStack(state, graphs) {
  const stack = state.stack || []
  if (stack.length === 0) return undefined
  const graphIds = [state.run?.rootGraph, ...stack.map((frame) => frame.child?.graphId)].filter(
    Boolean
  )
  return graphIds.map((id) => ({ title: graphTitle(id, graphs) }))
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
