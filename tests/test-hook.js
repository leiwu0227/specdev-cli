import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { cleanupDir, runSpecdev, assertTest } from './helpers.js'

const TEST_DIR = './tests/test-hook-output'
const HOOK_PATH = join(process.cwd(), 'hooks', 'session-start.sh')
const BIN_DIR = join(process.cwd(), 'bin')

let failures = 0
let passes = 0

function assert(condition, msg, detail = '') {
  if (assertTest(condition, msg, detail)) passes++
  else failures++
}

function runHook(cwd) {
  const result = spawnSync('bash', [HOOK_PATH], {
    encoding: 'utf-8',
    cwd,
    timeout: 30000,
    env: { ...process.env, PATH: `${BIN_DIR}:${process.env.PATH}` },
  })
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  }
}

function cleanup() { cleanupDir(TEST_DIR) }

function writeFixture() {
  cleanup()
  runSpecdev(['init', `--target=${TEST_DIR}`])

  const specdev = join(TEST_DIR, '.specdev')

  // Create a knowledge file
  mkdirSync(join(specdev, 'knowledge', 'architecture'), { recursive: true })
  writeFileSync(
    join(specdev, 'knowledge', 'architecture', 'test-note.md'),
    '# Test Architecture Note\n\nSome knowledge content.\n',
  )

  // Create an assignment with brainstorm artifacts
  const assignmentPath = join(specdev, 'assignments', '00001_feature_test-hook')
  mkdirSync(join(assignmentPath, 'brainstorm'), { recursive: true })
  writeFileSync(join(assignmentPath, 'brainstorm', 'proposal.md'), '# Proposal\n\nTest proposal.\n')
  writeFileSync(join(assignmentPath, 'brainstorm', 'design.md'), '# Design\n\nTest design.\n')

  const completedPath = join(specdev, 'assignments', '00000_feature_completed-hook')
  mkdirSync(join(completedPath, 'brainstorm'), { recursive: true })
  mkdirSync(join(completedPath, 'breakdown'), { recursive: true })
  mkdirSync(join(completedPath, 'implementation'), { recursive: true })
  mkdirSync(join(completedPath, 'capture'), { recursive: true })
  writeFileSync(join(completedPath, 'brainstorm', 'proposal.md'), '# Proposal\n')
  writeFileSync(join(completedPath, 'brainstorm', 'design.md'), '# Design\n')
  writeFileSync(join(completedPath, 'breakdown', 'plan.md'), '# Plan\n')
  writeFileSync(join(completedPath, 'implementation', 'progress.json'), JSON.stringify({ tasks: [{ status: 'completed' }] }))
  writeFileSync(join(completedPath, 'capture', 'project-notes-diff.md'), '# Diff\n')
  writeFileSync(join(completedPath, 'capture', 'workflow-diff.md'), '# Diff\n')
  writeFileSync(join(completedPath, 'status.json'), JSON.stringify({ brainstorm_approved: true, implementation_approved: true }))

  // Set current assignment
  writeFileSync(join(specdev, '.current'), '00001_feature_test-hook')
}

// --- Tests ---

console.log('\nhook with assignment and knowledge:')
writeFixture()
let result = runHook(TEST_DIR)
assert(result.status === 0, 'hook exits 0', result.stderr)
let hookJson = null
try {
  hookJson = JSON.parse(result.stdout)
  assert(true, 'hook outputs valid JSON')
} catch {
  assert(false, 'hook outputs valid JSON', result.stdout.slice(0, 200))
}
const context = hookJson?.hookSpecificOutput?.additionalContext || ''
assert(context.includes('00001_feature_test-hook'), 'context includes assignment name')
assert(context.includes('brainstorm'), 'context includes phase')
assert(context.includes('specdev checkpoint brainstorm') || context.includes('specdev approve brainstorm'), 'context includes phase-relevant commands')
assert(context.includes('knowledge') || context.includes('Knowledge'), 'context includes knowledge note')
assert(context.includes('00000_feature_completed-hook'), 'context includes recent completed assignment')
assert(context.includes('Announce every subtask'), 'context includes announce reminder')

console.log('\nhook with implementation phase:')
cleanup()
runSpecdev(['init', `--target=${TEST_DIR}`])
const specdev2 = join(TEST_DIR, '.specdev')
const implAssignment = join(specdev2, 'assignments', '00002_feature_test-impl')
mkdirSync(join(implAssignment, 'brainstorm'), { recursive: true })
mkdirSync(join(implAssignment, 'breakdown'), { recursive: true })
mkdirSync(join(implAssignment, 'implementation'), { recursive: true })
writeFileSync(join(implAssignment, 'brainstorm', 'design.md'), '# Design\n')
writeFileSync(join(implAssignment, 'breakdown', 'plan.md'), '# Plan\n')
writeFileSync(join(specdev2, '.current'), '00002_feature_test-impl')
result = runHook(TEST_DIR)
assert(result.status === 0, 'implementation hook exits 0', result.stderr)
hookJson = JSON.parse(result.stdout)
const implContext = hookJson?.hookSpecificOutput?.additionalContext || ''
assert(implContext.includes('implementation'), 'impl context includes implementation phase')
assert(
  implContext.includes('specdev checkpoint implementation') || implContext.includes('specdev reviewloop implementation'),
  'impl context includes implementation commands',
)

console.log('\nhook with no .specdev:')
cleanup()
mkdirSync(TEST_DIR, { recursive: true })
result = runHook(TEST_DIR)
assert(result.status === 0, 'no-specdev hook exits 0')
hookJson = JSON.parse(result.stdout)
assert(
  JSON.stringify(hookJson) === '{}' || hookJson?.hookSpecificOutput != null,
  'no-specdev outputs empty or basic context',
)

console.log('\nhook with specdev but no assignments:')
cleanup()
runSpecdev(['init', `--target=${TEST_DIR}`])
result = runHook(TEST_DIR)
assert(result.status === 0, 'no-assignment hook exits 0', result.stderr)
hookJson = JSON.parse(result.stdout)
const noAssignContext = hookJson?.hookSpecificOutput?.additionalContext || ''
assert(noAssignContext.includes('specdev') || noAssignContext.includes('Specdev'), 'no-assignment still mentions specdev')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
