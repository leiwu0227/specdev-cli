import assert from 'node:assert/strict'
import { formatStatusView, projectStatusViews } from '../src/utils/status-view.js'

const activeHistory = {
  command: 'status',
  status: 'ok',
  state: 'in_progress',
  workflow: 'Assignment lifecycle',
  phase: 'implementation',
  prompt: 'Run the approved implementation.',
  instructions: 'Historical implementation instructions.',
  output_schema: { type: 'object' },
  next_action: { command_line: 'specdev implement' },
  runs: [
    {
      n: 1,
      workflow: 'Assignment lifecycle',
      status: 'active',
      updated_at: '2026-08-04T08:00:00.000Z',
      focused: true,
    },
  ],
}
const focus = { kind: 'assignment', id: '00041' }
const assignment = {
  name: '00041_make-status-active-first',
  lifecycle: 'active',
  next_action: 'specdev next --json',
}
const runningAttempt = {
  id: 'Attempt-00041-00004',
  kind: 'worker',
  status: 'running',
}
const activeViews = projectStatusViews({
  history: activeHistory,
  focus,
  assignment,
  lifecycle: 'active',
  attempts: [runningAttempt],
  runningAttempt,
  liveness: { state: 'live_local' },
  dirtyPaths: ['src/commands/engine.js', 'src/utils/status-view.js'],
})

assert.equal(activeViews.history, activeHistory)
assert.deepEqual(Object.keys(activeViews.active), [
  'command',
  'version',
  'focus',
  'lifecycle',
  'phase',
  'attempt',
  'next_action',
  'dirty_paths',
])
assert.deepEqual(activeViews.active.attempt, {
  id: 'Attempt-00041-00004',
  role: 'worker',
  status: 'running',
  liveness: 'live_local',
})
assert.equal('runs' in activeViews.active, false)
assert.equal('prompt' in activeViews.active, false)
assert.equal('instructions' in activeViews.active, false)
assert.equal('output_schema' in activeViews.active, false)

const activeHuman = formatStatusView(activeViews.active)
assert.match(activeHuman, /SpecDev status: active/)
assert.match(activeHuman, /Attempt: Attempt-00041-00004/)
assert.match(activeHuman, /Dirty paths: 2/)
assert.doesNotMatch(activeHuman, /Run history:/)
assert.doesNotMatch(activeHuman, /Historical implementation instructions/)

const decisionHistory = {
  command: 'status',
  status: 'ok',
  state: 'awaiting_decision',
  phase: 'brainstorm',
  prompt: 'Approve this exact contract?',
  choices: [{ n: 1, value: 'approve', label: 'Approve' }],
  next_action: { command_line: 'specdev approve brainstorm' },
  runs: [],
}
const decision = projectStatusViews({
  history: decisionHistory,
  focus,
  assignment,
  lifecycle: 'active',
})
assert.deepEqual(decision.active.pending_decision, {
  prompt: 'Approve this exact contract?',
  choices: [{ n: 1, value: 'approve', label: 'Approve' }],
})
assert.equal('attempt' in decision.active, false)

const interrupted = projectStatusViews({
  history: activeHistory,
  focus,
  assignment,
  lifecycle: 'active',
  attempts: [runningAttempt],
  runningAttempt,
  liveness: { state: 'stale' },
})
assert.equal(interrupted.active.lifecycle, 'interrupted')
assert.equal(interrupted.active.attempt.status, 'interrupted')
assert.match(interrupted.active.blocker, /stale process liveness/)

const blockedAttempt = {
  id: 'Attempt-00041-00005',
  kind: 'worker',
  status: 'blocked',
}
const blocked = projectStatusViews({
  history: activeHistory,
  focus,
  assignment,
  lifecycle: 'active',
  attempts: [blockedAttempt],
})
assert.equal(blocked.active.lifecycle, 'blocked')
assert.match(blocked.active.blocker, /Attempt-00041-00005 is blocked/)

const idleHistory = {
  command: 'status',
  status: 'ok',
  state: 'idle',
  next_action: { command_line: 'specdev do "<intent>"' },
  runs: [],
}
const idle = projectStatusViews({ history: idleHistory })
assert.equal(idle.active.lifecycle, 'idle')
assert.equal(idle.active.focus, null)
assert.deepEqual(idle.active.dirty_paths, { count: 0, preview: [], omitted: 0 })

const historyHuman = formatStatusView(activeViews.active, activeViews.history)
assert.match(historyHuman, /Run history:/)
assert.match(historyHuman, /1\. Assignment lifecycle: active, focused/)
assert.equal(activeViews.history.runs, activeHistory.runs)

console.log('Status visibility tests passed.')
