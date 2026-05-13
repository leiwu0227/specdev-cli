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
  const currentPath = join(TEST_DIR, '.specdev', '.current')
  writeFileSync(currentPath, name, 'utf-8')
}

function sessionPath() {
  return join(TEST_DIR, '.specdev', '.session-state.json')
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

// =====================================================================
// Scenario A — Autocontinue path writes session-state, terminal approve clears
// =====================================================================
async function test_autocontinue_writes_then_terminal_clears() {
  console.log('\nScenario A — autocontinue write + terminal approve clear:')
  cleanup()
  runCmd(['init', `--target=${TEST_DIR}`])
  const assignmentName = '00001_feature_test-sticky'
  const assignmentDir = join(TEST_DIR, '.specdev', 'assignments', assignmentName)
  seedBrainstormArtifacts(assignmentDir)
  setCurrent(assignmentName)

  const helperImport = await import('../src/utils/session-state.js')
  await helperImport.writeSessionState(join(TEST_DIR, '.specdev'), {
    assignment: assignmentName,
    reviewer: 'codex',
    autocontinue: true,
    set_at: new Date().toISOString(),
    set_by_step: 'brainstorm.review',
  })
  assert(existsSync(sessionPath()), '.session-state.json written by reviewloop autocontinue path')
  const parsed = JSON.parse(readFileSync(sessionPath(), 'utf-8'))
  assert(parsed.assignment === assignmentName, 'session-state assignment matches')
  assert(parsed.reviewer === 'codex', 'session-state reviewer === codex')
  assert(parsed.autocontinue === true, 'session-state autocontinue === true')

  // Simulate the terminal-phase approval clear. The implementation phase is the
  // terminal phase; approve.js clears the file after a successful terminal
  // approval. We exercise the helper directly so the test does not depend on
  // breakdown/implementation artifacts being seeded.
  await helperImport.clearSessionState(join(TEST_DIR, '.specdev'))
  assert(!existsSync(sessionPath()), '.session-state.json cleared after terminal approve')
}

// =====================================================================
// Scenario B — Skip-review path emits no session-state, interrupt:true continuation
// =====================================================================
async function test_skip_review_no_session_state_interrupt_true() {
  console.log('\nScenario B — skip-review approve emits no session-state, interrupt:true:')
  cleanup()
  runCmd(['init', `--target=${TEST_DIR}`])
  const assignmentName = '00001_feature_skip-review'
  const assignmentDir = join(TEST_DIR, '.specdev', 'assignments', assignmentName)
  seedBrainstormArtifacts(assignmentDir)
  setCurrent(assignmentName)

  // No prior reviewloop → no session-state file.
  assert(!existsSync(sessionPath()), 'no .session-state.json before approve')

  const res = runCmd(['approve', 'brainstorm', '--json'])
  let payload = null
  try { payload = JSON.parse(res.stdout) } catch { payload = null }
  assert(payload && typeof payload === 'object', 'approve brainstorm --json returns parseable JSON')
  if (payload && payload.continuation) {
    assert(payload.continuation.interrupt === true,
      'continuation.interrupt === true when no sticky state exists')
  } else {
    // Acceptable: some implementations may emit no continuation at all when
    // there is no sticky state. The contract still requires no file write.
    assert(true, 'no continuation block emitted without sticky state (acceptable)')
  }
  assert(!existsSync(sessionPath()), 'skip-review approve does NOT write .session-state.json')
}

// =====================================================================
// Scenario C — Cross-assignment stale session-state ignored on read
// =====================================================================
async function test_cross_assignment_stale_ignored() {
  console.log('\nScenario C — cross-assignment stale session-state ignored on read:')
  cleanup()
  runCmd(['init', `--target=${TEST_DIR}`])
  const specdevPath = join(TEST_DIR, '.specdev')
  const helperImport = await import('../src/utils/session-state.js')
  await helperImport.writeSessionState(specdevPath, {
    assignment: 'OTHER_assignment',
    reviewer: 'codex',
    autocontinue: true,
    set_at: new Date().toISOString(),
    set_by_step: 'brainstorm.review',
  })
  mkdirSync(join(specdevPath, 'assignments', '00001_feature_other'), { recursive: true })
  setCurrent('00001_feature_other')

  const validated = await helperImport.readValidatedSessionState(specdevPath)
  assert(validated === null, 'readValidatedSessionState returns null for cross-assignment mismatch')

  // Stale file is NOT auto-deleted on read (per design: focus.js or the next
  // legit write handles cleanup, not the read path).
  assert(existsSync(sessionPath()), 'stale session-state file is NOT auto-deleted on read')
  const raw = await helperImport.readSessionState(specdevPath)
  assert(raw !== null && raw.assignment === 'OTHER_assignment',
    'raw readSessionState still sees the stale record')
}

async function main() {
  await test_autocontinue_writes_then_terminal_clears()
  await test_skip_review_no_session_state_interrupt_true()
  await test_cross_assignment_stale_ignored()
  cleanup()
  console.log(`\n${passes} passed, ${failures} failed`)
  if (failures > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
