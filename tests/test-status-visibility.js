import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { resolveAssignmentExecution } from '../src/utils/assignment-execution.js'
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
  status: {
    implementation_execution: {
      version: 1,
      configured_mode: 'auto',
      effective_mode: 'inline',
      source: 'auto-default',
      reason: null,
      owner: 'foreground-agent',
      frozen_at: '2026-09-01T00:00:00.000Z',
    },
  },
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
  'assignment_execution',
  'phase',
  'attempt',
  'next_action',
  'dirty_paths',
  'dirty_owners',
])
assert.equal(activeViews.active.assignment_execution.effective_mode, 'inline')
assert.equal(activeViews.active.assignment_execution.current_owner, 'foreground-agent')
assert.match(activeViews.active.assignment_execution.recovery_action, /foreground agent/)
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
assert.match(
  activeHuman,
  /Implementation execution: inline \(auto-default; owner foreground-agent\)/
)
assert.match(activeHuman, /Execution recovery: The foreground agent/)
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

const repoRoot = resolve(import.meta.dirname, '..')
const executionRoot = mkdtempSync(join(tmpdir(), 'specdev-assignment-execution-'))
const specdevPath = join(executionRoot, '.specdev')
mkdirSync(join(specdevPath, 'cache'), { recursive: true })
try {
  writeFileSync(
    join(specdevPath, 'agents.yaml'),
    'implementation:\n  mode: auto\nworker:\n  provider: codex\n',
    'utf8'
  )
  const automatic = await resolveAssignmentExecution(specdevPath)
  assert.equal(automatic.configured_mode, 'auto')
  assert.equal(automatic.effective_mode, 'inline')
  assert.equal(automatic.source, 'auto-default')
  assert.equal(automatic.owner, 'foreground-agent')

  writeFileSync(
    join(specdevPath, 'cache', 'agents.local.yaml'),
    'implementation:\n  mode: spawned\n',
    'utf8'
  )
  const local = await resolveAssignmentExecution(specdevPath)
  assert.equal(local.configured_mode, 'spawned')
  assert.equal(local.effective_mode, 'spawned')
  assert.equal(local.source, 'configuration')

  const mission = await resolveAssignmentExecution(specdevPath, { mission: true })
  assert.equal(mission.effective_mode, 'spawned')
  assert.equal(mission.owner, 'mission-controller')
  await assert.rejects(
    resolveAssignmentExecution(specdevPath, { mission: true, flags: { inline: true } }),
    /Mission-controlled Assignment execution is fixed to spawned mode/
  )

  const legacy = await resolveAssignmentExecution(specdevPath, { legacySpawned: true })
  assert.equal(legacy.effective_mode, 'spawned')
  assert.equal(legacy.source, 'legacy-recovery')
  await assert.rejects(
    resolveAssignmentExecution(specdevPath, {
      legacySpawned: true,
      flags: { inline: true },
    }),
    /fixed to spawned recovery/
  )

  await assert.rejects(
    resolveAssignmentExecution(specdevPath, {
      frozen: automatic,
      flags: { spawned: true },
    }),
    /frozen as inline/
  )
  await assert.rejects(
    resolveAssignmentExecution(specdevPath, { flags: { inline: true, spawned: true } }),
    /--inline and --spawned conflict/
  )
  await assert.rejects(
    resolveAssignmentExecution(specdevPath, {
      flags: { spawned: true, 'execution-reason': 'x'.repeat(241) },
    }),
    /at most 240 characters/
  )

  writeFileSync(
    join(specdevPath, 'cache', 'agents.local.yaml'),
    'implementation:\n  mode: invalid\n',
    'utf8'
  )
  await assert.rejects(resolveAssignmentExecution(specdevPath), /mode must be auto, inline, or spawned/)
  writeFileSync(join(specdevPath, 'cache', 'agents.local.yaml'), 'scheduler:\n  mode: inline\n', 'utf8')
  await assert.rejects(resolveAssignmentExecution(specdevPath), /invalid agent profile role/)

  const installedAgents = readFileSync(
    join(repoRoot, 'templates', '.specdev', 'agents.yaml'),
    'utf8'
  )
  assert.match(installedAgents, /^implementation:\n {2}mode: auto # auto \| inline \| spawned$/m)
  assert.match(
    readFileSync(
      join(repoRoot, 'templates', '.specdev', '_guides', 'assignment_guide.md'),
      'utf8'
    ),
    /`auto` freezes to `inline` at the Git boundary/
  )
} finally {
  rmSync(executionRoot, { recursive: true, force: true })
}

console.log('Status visibility tests passed.')
