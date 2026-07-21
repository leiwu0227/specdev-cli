import assert from 'node:assert/strict'
import { graphTitle, toProductState, wrapDecision } from '../src/utils/engine-adapter.js'

const graphs = [
  { id: 'assignment-lifecycle', title: 'Assignment lifecycle' },
  { id: 'child-graph', title: 'Child workflow' },
]

assert.deepEqual(toProductState({ status: 'no_focused_run' }, graphs), {
  status: 'ok',
  state: 'idle',
  next_action: { command_line: 'specdev do "<intent>"' },
})

const progress = toProductState(
  {
    status: 'ok',
    run: { rootGraph: 'assignment-lifecycle', status: 'active', id: 'run-secret' },
    position: { graph: 'assignment-lifecycle', node: 'brainstorm' },
    node: {
      purpose: 'Produce a design.',
      instructions: 'Write the proposal.',
      outputSchema: { type: 'object', required: ['summary'] },
      operatorContext: { phase: 'brainstorm', command: 'specdev checkpoint brainstorm' },
      sideChannelActions: [{ id: 'research', purpose: 'Research without advancing.' }],
    },
    stack: [{ child: { graphId: 'child-graph' } }],
  },
  graphs
)

assert.equal(progress.workflow, 'Assignment lifecycle')
assert.equal(progress.phase, 'brainstorm')
assert.equal(progress.next_action.command_line, 'specdev checkpoint brainstorm')
assert.deepEqual(progress.actions, [{ id: 'research', purpose: 'Research without advancing.' }])
assert.deepEqual(progress.call_stack, [
  { title: 'Assignment lifecycle' },
  { title: 'Child workflow' },
])
assert.equal(JSON.stringify(progress).includes('run-secret'), false, 'run ids stay internal')
assert.equal(
  JSON.stringify(progress).includes('assignment-lifecycle'),
  false,
  'graph ids stay internal'
)

const gate = toProductState(
  {
    status: 'ok',
    run: { rootGraph: 'assignment-lifecycle', status: 'active' },
    node: {
      purpose: 'Choose review mode.',
      interaction: {
        prompt: 'How should this be reviewed?',
        choices: [{ label: 'Skip review and approve', value: 'approve_skip_review' }],
      },
      gate: { decisionSchema: { type: 'object', required: ['choice'] } },
      operatorContext: {
        phase: 'brainstorm',
        command: 'specdev approve brainstorm',
        commands: { approve_skip_review: 'specdev approve brainstorm' },
      },
    },
  },
  graphs
)

assert.equal(gate.state, 'awaiting_decision')
assert.equal(gate.next_action.command_line, 'specdev approve brainstorm')
assert.deepEqual(gate.choices[0], {
  n: 1,
  value: 'approve_skip_review',
  label: 'Skip review and approve',
  command: 'specdev approve brainstorm',
})
assert.match(gate.render_hint, /exact order/)

assert.deepEqual(
  wrapDecision('approve', {
    required: ['choice'],
    properties: { choice: { type: 'string' } },
  }),
  { choice: 'approve' }
)
assert.deepEqual(wrapDecision({ choice: 'approve' }, {}), { choice: 'approve' })
assert.equal(graphTitle('unknown-internal-id', graphs), 'Guided workflow')

const invalid = toProductState(
  { status: 'validation_error', errors: [{ path: 'summary' }] },
  graphs
)
assert.equal(invalid.status, 'blocked')
assert.equal(invalid.state, 'invalid')

const completed = toProductState(
  {
    status: 'completed',
    run: { rootGraph: 'assignment-lifecycle', status: 'completed', id: 'hidden' },
  },
  graphs
)
assert.equal(completed.state, 'completed')
assert.equal(JSON.stringify(completed).includes('hidden'), false)

console.log('Engine adapter tests passed.')
