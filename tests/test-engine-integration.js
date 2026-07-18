import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { suspendRun } from 'ripplegraph'

const repoRoot = resolve(import.meta.dirname, '..')
const bin = join(repoRoot, 'bin', 'specdev.js')
const roots = []

function tempProject(label) {
  const root = mkdtempSync(join(tmpdir(), `specdev-ripplegraph-${label}-`))
  roots.push(root)
  return root
}

function run(root, args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  })
  assert.equal(
    result.status,
    expectedStatus,
    `${args.join(' ')} exited ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  )
  return result
}

function runJson(root, args, expectedStatus = 0) {
  const result = run(root, args, expectedStatus)
  try {
    return JSON.parse(result.stdout)
  } catch (error) {
    throw new Error(`invalid JSON from ${args.join(' ')}: ${error.message}\n${result.stdout}`)
  }
}

function writeBigPicture(root) {
  writeFileSync(
    join(root, '.specdev', 'project_notes', 'big_picture.md'),
    '# Project Big Picture\n\n## Overview\nA test Node.js CLI with enough durable context for guided work.\n\n## Tech Stack\nNode.js 20 and JSON files.\n',
    'utf8'
  )
}

function writeBrainstorm(path) {
  mkdirSync(join(path, 'brainstorm'), { recursive: true })
  writeFileSync(
    join(path, 'brainstorm', 'proposal.md'),
    '# Proposal\n\nBuild the tested workflow behavior with explicit user approval.\n',
    'utf8'
  )
  writeFileSync(
    join(path, 'brainstorm', 'design.md'),
    '# Design\n\n## Overview\nA complete integration fixture.\n\n## Goals\nProve graph and semantic command synchronization.\n\n## Non-Goals\nNo production files are changed.\n\n## Design\nUse a temporary initialized workspace.\n\n## Success Criteria\nBoth approval gates complete and status remains product-shaped.\n',
    'utf8'
  )
}

try {
  const root = tempProject('main')
  const init = runJson(root, ['init', '--platform=none', '--json'])
  assert.equal(init.status, 'ok')
  assert.equal(init.guided_workflows, 5)
  assert.equal(existsSync(join(root, '.specdev', 'workflow.json')), true)
  assert.equal(existsSync(join(root, '.specdev', 'workflow.yaml')), false)

  const registryPath = join(root, '.specdev', '.ripplegraph', 'registry.json')
  let registry = JSON.parse(readFileSync(registryPath, 'utf8'))
  assert.equal(Object.keys(registry.graphs).length, 6)

  assert.equal(runJson(root, ['next', '--json']).state, 'idle')
  const choices = runJson(root, ['do', 'something unclear'])
  assert.equal(choices.state, 'needs_choice')
  assert.equal(choices.options.length, 5)
  assert.equal(JSON.stringify(choices).includes('assignment-lifecycle'), false)

  const orientation = runJson(root, ['do', 'project orientation'])
  assert.equal(orientation.workflow, 'Project orientation')
  assert.equal(orientation.phase, 'orientation')
  suspendRun({ workflowRoot: join(root, '.specdev'), note: 'integration resume check' })
  const resumedOrientation = runJson(root, ['do', 'project orientation'])
  assert.equal(resumedOrientation.workflow, 'Project orientation')
  assert.equal(resumedOrientation.phase, 'orientation')
  run(root, ['start'])
  assert.equal(runJson(root, ['next', '--json']).prompt.includes('Collect the project'), true)
  writeBigPicture(root)
  runJson(root, [
    'step',
    `--json=${JSON.stringify({
      path: '.specdev/project_notes/big_picture.md',
      summary: 'Project purpose, stack, and constraints recorded.',
    })}`,
  ])
  run(root, ['start'])
  assert.equal(runJson(root, ['next', '--json']).state, 'idle')

  const started = runJson(root, ['do', 'start an assignment'])
  assert.equal(started.workflow, 'Assignment lifecycle')
  assert.equal(started.phase, 'assignment')

  const assignment = runJson(root, [
    'assignment',
    'Exercise the graph lifecycle',
    '--type=feature',
    '--slug=graph-lifecycle',
    '--json',
  ])
  assert.equal(assignment.status, 'ok')
  writeBrainstorm(assignment.path)

  let state = runJson(root, ['next', '--json'])
  assert.equal(state.phase, 'brainstorm')
  const invalid = runJson(root, ['step', '--json={}'], 1)
  assert.equal(invalid.state, 'invalid')
  assert.equal(invalid.prompt.includes('Produce and validate'), true)
  const action = runJson(root, [
    'action',
    'research',
    `--json=${JSON.stringify({ topic: 'graph lifecycle' })}`,
  ])
  assert.equal(action.phase, 'brainstorm')
  assert.equal(runJson(root, ['next', '--json']).phase, 'brainstorm')
  runJson(root, [
    'step',
    `--json=${JSON.stringify({
      proposal: 'brainstorm/proposal.md',
      design: 'brainstorm/design.md',
      summary: 'Scope and design agreed.',
    })}`,
  ])
  const brainstormCheckpoint = runJson(root, ['checkpoint', 'brainstorm', '--json'])
  assert.equal(brainstormCheckpoint.status, 'pass')
  state = runJson(root, ['next', '--json'])
  assert.equal(state.state, 'awaiting_decision')
  assert.equal(
    state.choices.some((choice) => choice.value === 'approve_skip_review'),
    true
  )
  runJson(root, ['decide', 'approve_skip_review'])
  const brainstormApproval = runJson(root, ['approve', 'brainstorm', '--json'])
  assert.equal(brainstormApproval.approved, true)
  assert.equal(runJson(root, ['next', '--json']).phase, 'breakdown')

  const revision = runJson(root, ['revise', '--json'])
  assert.equal(revision.revision, 1)
  assert.equal(runJson(root, ['next', '--json']).phase, 'brainstorm')
  runJson(root, [
    'step',
    `--json=${JSON.stringify({
      proposal: 'brainstorm/proposal.md',
      design: 'brainstorm/design.md',
      summary: 'Approved design re-entered after revision.',
    })}`,
  ])
  runJson(root, ['checkpoint', 'brainstorm', '--json'])
  runJson(root, ['decide', 'approve_skip_review'])
  runJson(root, ['approve', 'brainstorm', '--json'])
  assert.equal(runJson(root, ['next', '--json']).phase, 'breakdown')

  mkdirSync(join(assignment.path, 'breakdown'), { recursive: true })
  writeFileSync(
    join(assignment.path, 'breakdown', 'plan.md'),
    '# Plan\n\n### Task 1: Verify the graph\n\nComplete the integration fixture.\n',
    'utf8'
  )
  runJson(root, ['step', `--json=${JSON.stringify({ plan: 'breakdown/plan.md', task_count: 1 })}`])
  assert.equal(runJson(root, ['next', '--json']).phase, 'implementation')

  mkdirSync(join(assignment.path, 'implementation'), { recursive: true })
  writeFileSync(
    join(assignment.path, 'implementation', 'progress.json'),
    `${JSON.stringify({ tasks: [{ number: 1, status: 'completed' }] }, null, 2)}\n`,
    'utf8'
  )
  runJson(root, [
    'step',
    `--json=${JSON.stringify({
      progress: 'implementation/progress.json',
      summary: 'The integration fixture is complete.',
    })}`,
  ])
  const implementationCheckpoint = runJson(root, ['checkpoint', 'implementation', '--json'])
  assert.equal(implementationCheckpoint.status, 'pass')
  assert.equal(runJson(root, ['next', '--json']).state, 'awaiting_decision')
  runJson(root, ['decide', 'approve_skip_review'])
  const implementationApproval = runJson(root, ['approve', 'implementation', '--json'])
  assert.equal(implementationApproval.approved, true)
  assert.equal(runJson(root, ['next', '--json']).phase, 'capture')
  const completed = runJson(root, [
    'step',
    `--json=${JSON.stringify({ summary: 'No durable knowledge update needed.' })}`,
  ])
  assert.equal(completed.state, 'completed')

  const status = runJson(root, ['status', '--json'])
  assert.equal(
    status.runs.some(
      (item) => item.workflow === 'Assignment lifecycle' && item.status === 'completed'
    ),
    true
  )
  assert.equal(JSON.stringify(status).includes('run-'), false)

  const discussion = runJson(root, ['discussion', 'Explore a follow-up design', '--json'])
  writeBrainstorm(discussion.path)
  runJson(root, [
    'step',
    `--json=${JSON.stringify({
      proposal: 'brainstorm/proposal.md',
      design: 'brainstorm/design.md',
    })}`,
  ])
  const discussionCheckpoint = runJson(root, [
    'checkpoint',
    'discussion',
    `--discussion=${discussion.id}`,
    '--json',
  ])
  assert.equal(discussionCheckpoint.status, 'pass')
  assert.equal(runJson(root, ['next', '--json']).state, 'awaiting_decision')
  assert.equal(runJson(root, ['decide', 'finish']).state, 'completed')

  runJson(root, ['migrate', '--json'])
  runJson(root, [
    'step',
    `--json=${JSON.stringify({ inventory: '.specdev/migration/inventory.md', summary: 'No ambiguity.' })}`,
  ])
  runJson(root, [
    'step',
    `--json=${JSON.stringify({ plan: '.specdev/migration/layout-plan.md', summary: 'No moves needed.' })}`,
  ])
  state = runJson(root, ['next', '--json'])
  assert.equal(state.state, 'awaiting_decision')
  assert.deepEqual(
    state.choices.map((choice) => choice.value),
    ['apply', 'revise', 'cancel']
  )
  assert.equal(runJson(root, ['decide', 'cancel']).state, 'completed')

  const distill = runJson(root, ['distill', 'project'])
  assert.equal(distill.status, 'ok')
  state = runJson(root, ['next', '--json'])
  assert.equal(state.workflow, 'Knowledge distillation')
  assert.equal(state.state, 'awaiting_decision')
  assert.equal(runJson(root, ['decide', 'none']).state, 'completed')

  runJson(root, ['do', 'project orientation'])
  const cancelled = runJson(root, ['cancel', 'integration cancellation check'])
  assert.equal(cancelled.state, 'cancelled')
  assert.equal(runJson(root, ['next', '--json']).state, 'idle')

  registry = JSON.parse(readFileSync(registryPath, 'utf8'))
  registry.graphs.stale = { ...registry.graphs['project-orientation'], id: 'stale' }
  writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8')
  writeFileSync(join(root, '.specdev', 'workflow.yaml'), 'legacy: preserved\n', 'utf8')
  const update = runJson(root, ['update', '--platform=none', '--json'])
  assert.equal(update.status, 'ok')
  registry = JSON.parse(readFileSync(registryPath, 'utf8'))
  assert.deepEqual(Object.keys(registry.graphs).sort(), [
    'assignment-lifecycle',
    'discussion-lifecycle',
    'knowledge-distillation',
    'layout-migration',
    'project-orientation',
    'workspace-dispatcher',
  ])
  assert.equal(readFileSync(join(root, '.specdev', 'workflow.yaml'), 'utf8'), 'legacy: preserved\n')

  const legacyRoot = tempProject('legacy')
  runJson(legacyRoot, ['init', '--platform=none', '--json'])
  writeBigPicture(legacyRoot)
  const legacyName = '00001_feature_legacy-active'
  const legacyPath = join(legacyRoot, '.specdev', 'assignments', legacyName)
  writeBrainstorm(legacyPath)
  mkdirSync(join(legacyPath, 'context'), { recursive: true })
  writeFileSync(
    join(legacyPath, 'status.json'),
    `${JSON.stringify({ brainstorm_approved: false, implementation_approved: false }, null, 2)}\n`,
    'utf8'
  )
  writeFileSync(join(legacyRoot, '.specdev', '.current'), `${legacyName}\n`, 'utf8')
  const legacyNext = runJson(legacyRoot, ['next', '--json'])
  assert.equal(legacyNext.assignment, legacyName)
  assert.notEqual(legacyNext.state, 'idle')
  const engineFocus = JSON.parse(
    readFileSync(join(legacyRoot, '.specdev', '.ripplegraph', 'current.json'), 'utf8')
  )
  assert.equal(engineFocus.focusedRunId, null)

  console.log('Engine integration tests passed.')
} finally {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
}
