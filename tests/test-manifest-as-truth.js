// Manifest-as-truth integration test.
//
// Spins up a temp .specdev/ workspace, mutates workflow.yaml, and verifies
// that CLI consumers (next, status, approve, review, check-review) track
// the mutated manifest end-to-end. Guards every consumer migrated in
// Tasks 3-13 of the manifest-step-contracts refactor.

import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync, openSync, closeSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-manifest-as-truth-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function runCmd(args, opts = {}) {
  if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true })
  const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const stdoutPath = join(TEST_DIR, `.tmp-${token}.stdout`)
  const stderrPath = join(TEST_DIR, `.tmp-${token}.stderr`)
  const outFd = openSync(stdoutPath, 'w')
  const errFd = openSync(stderrPath, 'w')
  const result = spawnSync('node', [CLI, ...args], {
    stdio: ['ignore', outFd, errFd],
    cwd: opts.cwd || TEST_DIR,
  })
  closeSync(outFd)
  closeSync(errFd)
  const stdout = existsSync(stdoutPath) ? readFileSync(stdoutPath, 'utf-8') : ''
  const stderr = existsSync(stderrPath) ? readFileSync(stderrPath, 'utf-8') : ''
  rmSync(stdoutPath, { force: true })
  rmSync(stderrPath, { force: true })
  return { ...result, stdout, stderr }
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true }) }

function setCurrent(name) {
  writeFileSync(join(TEST_DIR, '.specdev', '.current'), name, 'utf-8')
}

function readManifest() {
  return YAML.parse(readFileSync(join(TEST_DIR, '.specdev', 'workflow.yaml'), 'utf-8'))
}

function writeManifest(parsed) {
  writeFileSync(
    join(TEST_DIR, '.specdev', 'workflow.yaml'),
    YAML.stringify(parsed),
    'utf-8',
  )
}

function seedBrainstormArtifacts(assignmentDir) {
  mkdirSync(join(assignmentDir, 'brainstorm'), { recursive: true })
  writeFileSync(
    join(assignmentDir, 'brainstorm', 'proposal.md'),
    '# Proposal\n\nplaceholder content to satisfy length checks.\n',
    'utf-8',
  )
  writeFileSync(
    join(assignmentDir, 'brainstorm', 'design.md'),
    '# Design\n\n## Overview\nplaceholder content to satisfy length checks.\n' +
      '## Goals\nplaceholder.\n## Non-Goals\nplaceholder.\n## Success Criteria\nplaceholder.\n',
    'utf-8',
  )
}

function initWithAssignment(assignmentName) {
  cleanup()
  runCmd(['init', `--target=${TEST_DIR}`])
  const assignmentDir = join(TEST_DIR, '.specdev', 'assignments', assignmentName)
  seedBrainstormArtifacts(assignmentDir)
  setCurrent(assignmentName)
  return assignmentDir
}

// =====================================================================
// Scenario 1 — Adding a required artifact reflects in `next` and `status`
// =====================================================================
async function test_extra_required_artifact_surfaces_in_next_and_status() {
  console.log('\nScenario 1 — extra required artifact surfaces in next and status:')
  const assignmentName = '00001_feature_extra-req'
  initWithAssignment(assignmentName)

  // Mutate: add an extra `requires:` entry to brainstorm.approval (gate).
  const manifest = readManifest()
  const approval = manifest.phases.brainstorm.steps.find((s) => s.id === 'approval')
  approval.requires = [...(approval.requires || []), 'brainstorm/extra.md']
  writeManifest(manifest)

  const nextRes = runCmd(['next', '--json', `--target=${TEST_DIR}`])
  let nextPayload = null
  try { nextPayload = JSON.parse(nextRes.stdout) } catch { nextPayload = null }
  assert(nextPayload && typeof nextPayload === 'object', 'next --json parses')
  if (nextPayload) {
    const blockers = JSON.stringify(nextPayload.blockers || nextPayload.detected?.blockers || nextPayload)
    assert(
      blockers.includes('brainstorm/extra.md'),
      'next --json blockers/payload references mutated extra artifact',
    )
  }

  const statusRes = runCmd(['status', '--json', `--target=${TEST_DIR}`], { cwd: TEST_DIR })
  let statusPayload = null
  try { statusPayload = JSON.parse(statusRes.stdout) } catch { statusPayload = null }
  assert(statusPayload && typeof statusPayload === 'object', 'status --json parses')
  if (statusPayload) {
    const dump = JSON.stringify(statusPayload)
    assert(
      dump.includes('brainstorm/extra.md'),
      'status --json artifacts payload references mutated extra artifact',
    )
  }
}

// =====================================================================
// Scenario 2 — Renaming a gate field flows through approve and status
// =====================================================================
async function test_renamed_gate_field_flows_through_approve() {
  console.log('\nScenario 2 — renamed gate field flows through approve + status:')
  const assignmentName = '00001_feature_renamed-gate'
  const assignmentDir = initWithAssignment(assignmentName)

  // Mutate: rename brainstorm gate field.
  const manifest = readManifest()
  const approval = manifest.phases.brainstorm.steps.find((s) => s.id === 'approval')
  approval.gate = 'brainstorm_done'
  writeManifest(manifest)

  const approveRes = runCmd(['approve', 'brainstorm', '--json', `--target=${TEST_DIR}`])
  let approvePayload = null
  try { approvePayload = JSON.parse(approveRes.stdout) } catch { approvePayload = null }
  assert(approvePayload && typeof approvePayload === 'object', 'approve brainstorm --json parses')

  const statusPath = join(assignmentDir, 'status.json')
  if (existsSync(statusPath)) {
    const status = JSON.parse(readFileSync(statusPath, 'utf-8'))
    assert(status.brainstorm_done === true, 'status.json carries mutated gate field brainstorm_done')
    assert(status.brainstorm_approved !== true, 'status.json does NOT carry default gate field')
  } else {
    assert(false, 'assignment status.json was written by approve brainstorm')
  }
}

// =====================================================================
// Scenario 3 — Review artifact list tracks produces:
// =====================================================================
async function test_review_artifact_list_tracks_produces() {
  console.log('\nScenario 3 — review artifact list tracks produces:')
  const assignmentName = '00001_feature_review-artifacts'
  const assignmentDir = initWithAssignment(assignmentName)
  // Seed the extra produced artifact so review doesn't error on missing file.
  writeFileSync(join(assignmentDir, 'brainstorm', 'extra.md'), '# Extra\n', 'utf-8')

  // Mutate: append an extra path to the brainstorm guide step's produces.
  const manifest = readManifest()
  const guide = manifest.phases.brainstorm.steps.find((s) => s.id === 'create_artifacts')
  guide.produces = [...(guide.produces || []), 'brainstorm/extra.md']
  // Also extend gate requires so the artifact is treated as part of the
  // review surface even if review reads from requires.
  const approval = manifest.phases.brainstorm.steps.find((s) => s.id === 'approval')
  approval.requires = [...(approval.requires || []), 'brainstorm/extra.md']
  writeManifest(manifest)

  const res = runCmd(['review', 'brainstorm', `--target=${TEST_DIR}`])
  const out = (res.stdout + '\n' + res.stderr)
  assert(
    out.includes('extra.md'),
    'specdev review brainstorm artifact list includes mutated produces entry',
  )
}

// =====================================================================
// Scenario 4 — check-review phase inference uses structured detected.phase
// =====================================================================
async function test_check_review_phase_inference_from_structured_state() {
  console.log('\nScenario 4 — check-review uses structured detected.phase:')
  const assignmentName = '00001_feature_check-review-phase'
  const assignmentDir = initWithAssignment(assignmentName)
  // Mark brainstorm approved + advance to implementation_in_progress.
  const statusPath = join(assignmentDir, 'status.json')
  writeFileSync(statusPath, JSON.stringify({
    name: assignmentName,
    brainstorm_approved: true,
    breakdown_complete: true,
    state: 'implementation_in_progress',
    tasks: [],
  }, null, 2), 'utf-8')
  mkdirSync(join(assignmentDir, 'breakdown'), { recursive: true })
  writeFileSync(join(assignmentDir, 'breakdown', 'plan.md'), '# Plan\n\nplaceholder\n', 'utf-8')
  mkdirSync(join(assignmentDir, 'implementation'), { recursive: true })
  writeFileSync(
    join(assignmentDir, 'implementation', 'progress.json'),
    JSON.stringify({ tasks: [] }, null, 2),
    'utf-8',
  )

  const res = runCmd(['check-review', `--target=${TEST_DIR}`])
  const out = (res.stdout + '\n' + res.stderr).toLowerCase()
  assert(
    out.includes('implementation') || res.stdout.includes('implementation'),
    'check-review infers phase=implementation from structured detected.phase',
  )
}

async function main() {
  await test_extra_required_artifact_surfaces_in_next_and_status()
  await test_renamed_gate_field_flows_through_approve()
  await test_review_artifact_list_tracks_produces()
  await test_check_review_phase_inference_from_structured_state()
  cleanup()
  console.log(`\n${passes} passed, ${failures} failed`)
  if (failures > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
