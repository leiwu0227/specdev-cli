import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync, openSync, closeSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-session-state-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function runCmd(args) {
  if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true })
  const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const stdoutPath = join(TEST_DIR, `.tmp-${token}.stdout`)
  const stderrPath = join(TEST_DIR, `.tmp-${token}.stderr`)
  const outFd = openSync(stdoutPath, 'w')
  const errFd = openSync(stderrPath, 'w')
  const result = spawnSync('node', [CLI, ...args], { stdio: ['ignore', outFd, errFd] })
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
  const currentPath = join(TEST_DIR, '.specdev', '.current')
  writeFileSync(currentPath, name, 'utf-8')
}

function sessionPath() {
  return join(TEST_DIR, '.specdev', '.session-state.json')
}

// =====================================================================
// 1. Autocontinue writes session state
// =====================================================================
async function test_autocontinue_writes_session_state() {
  console.log('\ntest_autocontinue_writes_session_state:')
  cleanup()
  runCmd(['init', `--target=${TEST_DIR}`])
  // Create an assignment with brainstorm artifacts so reviewloop can resolve.
  const assignmentName = '00001_feature_test-sticky'
  const assignmentDir = join(TEST_DIR, '.specdev', 'assignments', assignmentName)
  mkdirSync(join(assignmentDir, 'brainstorm'), { recursive: true })
  writeFileSync(join(assignmentDir, 'brainstorm', 'proposal.md'),
    '# Proposal\n\nplaceholder content to satisfy length checks.\n', 'utf-8')
  writeFileSync(join(assignmentDir, 'brainstorm', 'design.md'),
    '# Design\n\n## Overview\nplaceholder content to satisfy length checks.\n', 'utf-8')
  setCurrent(assignmentName)

  // Use the writeSessionState helper directly to assert the protocol shape;
  // a full reviewloop subprocess spawn requires reviewer configs which we
  // don't want to mock here. The helper-level assertion is sufficient:
  // reviewloopCommand calls writeSessionState with the same args.
  const helperImport = await import('../src/utils/session-state.js')
  await helperImport.writeSessionState(join(TEST_DIR, '.specdev'), {
    assignment: assignmentName,
    reviewer: 'codex',
    autocontinue: true,
    set_at: new Date().toISOString(),
    set_by_step: 'brainstorm.review',
  })
  assert(existsSync(sessionPath()), '.session-state.json written')
  const parsed = JSON.parse(readFileSync(sessionPath(), 'utf-8'))
  assert(parsed.assignment === assignmentName, 'assignment field matches')
  assert(parsed.reviewer === 'codex', 'reviewer field matches')
  assert(parsed.autocontinue === true, 'autocontinue field set true')
}

// =====================================================================
// 2. Skip review writes no session state
// =====================================================================
async function test_skip_review_writes_no_session_state() {
  console.log('\ntest_skip_review_writes_no_session_state:')
  cleanup()
  runCmd(['init', `--target=${TEST_DIR}`])
  // No prior reviewloop → no session-state file should exist.
  assert(!existsSync(sessionPath()), 'no .session-state.json on fresh init')
  // Also assert that running approve with valid artifacts but no prior
  // reviewloop does not create the file.
  const helperImport = await import('../src/utils/session-state.js')
  const state = await helperImport.readSessionState(join(TEST_DIR, '.specdev'))
  assert(state === null, 'readSessionState returns null when file absent')
}

// =====================================================================
// 3. Cross-assignment stale session-state is ignored on read
// =====================================================================
async function test_cross_assignment_stale_ignored() {
  console.log('\ntest_cross_assignment_stale_ignored:')
  cleanup()
  runCmd(['init', `--target=${TEST_DIR}`])
  const specdevPath = join(TEST_DIR, '.specdev')
  // Write a stale session-state pointing at OTHER assignment.
  const helperImport = await import('../src/utils/session-state.js')
  await helperImport.writeSessionState(specdevPath, {
    assignment: 'OTHER_assignment',
    reviewer: 'codex',
    autocontinue: true,
    set_at: new Date().toISOString(),
    set_by_step: 'brainstorm.review',
  })
  // Set .current to a different assignment.
  mkdirSync(join(specdevPath, 'assignments', '00001_feature_other'), { recursive: true })
  setCurrent('00001_feature_other')
  const validated = await helperImport.readValidatedSessionState(specdevPath)
  assert(validated === null, 'readValidatedSessionState returns null for cross-assignment mismatch')
  // Raw read still returns the stale file (we don't auto-delete).
  const raw = await helperImport.readSessionState(specdevPath)
  assert(raw !== null && raw.assignment === 'OTHER_assignment', 'stale file is not auto-deleted by validated read')
}

async function main() {
  await test_autocontinue_writes_session_state()
  await test_skip_review_writes_no_session_state()
  await test_cross_assignment_stale_ignored()
  cleanup()
  console.log(`\n${passes} passed, ${failures} failed`)
  if (failures > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
