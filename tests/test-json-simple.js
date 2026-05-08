import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { cleanupDir, runSpecdev, assertTest } from './helpers.js'

const TEST_DIR = './tests/test-json-simple-output'
let failures = 0
let passes = 0

function assert(condition, msg, detail = '') {
  if (assertTest(condition, msg, detail)) passes++
  else failures++
}

function runCmd(args) {
  return runSpecdev(args)
}

function cleanup() { cleanupDir(TEST_DIR) }

function initProject() {
  cleanup()
  runCmd(['init', `--target=${TEST_DIR}`])
}

function createAssignment(id = '00001', slug = 'test-feature') {
  const name = `${id}_feature_${slug}`
  const specdev = join(TEST_DIR, '.specdev')
  const assignmentPath = join(specdev, 'assignments', name)
  mkdirSync(join(assignmentPath, 'brainstorm'), { recursive: true })
  writeFileSync(join(assignmentPath, 'brainstorm', 'proposal.md'), '# Proposal\n\nThis is a sufficiently long proposal for testing purposes.\n')
  writeFileSync(join(assignmentPath, 'brainstorm', 'design.md'), '# Design\n\nThis is a sufficiently long design document for testing purposes.\n')
  writeFileSync(join(specdev, '.current'), name, 'utf-8')
  return name
}

// --- help --json ---

console.log('\nhelp --json:')
let result = runCmd(['help', '--json'])
assert(result.status === 0, 'help --json exits 0', result.stderr)
let json = null
try {
  json = JSON.parse(result.stdout)
  assert(true, 'help --json outputs valid JSON')
} catch {
  assert(false, 'help --json outputs valid JSON', result.stdout)
}
assert(json?.command === 'help', 'json command is help')
assert(Array.isArray(json?.commands), 'json has commands array')
assert(json?.commands?.length > 0, 'commands array is non-empty')
const firstCmd = json?.commands?.[0]
assert(typeof firstCmd?.name === 'string', 'first command has name')
assert(typeof firstCmd?.usage === 'string', 'first command has usage')
assert(typeof firstCmd?.description === 'string', 'first command has description')

// --- focus --json ---

console.log('\nfocus --json:')
initProject()
const assignmentName = createAssignment()
result = runCmd(['focus', '00001', '--json', `--target=${TEST_DIR}`])
assert(result.status === 0, 'focus --json exits 0', result.stderr || result.stdout)
try {
  json = JSON.parse(result.stdout)
  assert(true, 'focus --json outputs valid JSON')
} catch {
  assert(false, 'focus --json outputs valid JSON', result.stdout)
}
assert(json?.command === 'focus', 'json command is focus')
assert(json?.status === 'ok', 'json status is ok')
assert(json?.assignment_name === assignmentName, 'json has correct assignment_name')
assert(json?.assignment_id === '00001', 'json has correct assignment_id')
assert(typeof json?.path === 'string', 'json has path')

// --- focus --clear --json ---

console.log('\nfocus --clear --json:')
result = runCmd(['focus', '--clear', '--json', `--target=${TEST_DIR}`])
assert(result.status === 0, 'focus --clear --json exits 0', result.stderr)
try {
  json = JSON.parse(result.stdout)
  assert(true, 'focus --clear --json outputs valid JSON')
} catch {
  assert(false, 'focus --clear --json outputs valid JSON', result.stdout)
}
assert(json?.cleared === true, 'json has cleared: true')

// --- approve --json (success) ---

console.log('\napprove --json (success):')
initProject()
createAssignment()
result = runCmd(['approve', 'brainstorm', '--json', `--target=${TEST_DIR}`])
assert(result.status === 0, 'approve --json exits 0', result.stderr || result.stdout)
try {
  json = JSON.parse(result.stdout)
  assert(true, 'approve --json outputs valid JSON')
} catch {
  assert(false, 'approve --json outputs valid JSON', result.stdout)
}
assert(json?.command === 'approve', 'json command is approve')
assert(json?.status === 'ok', 'json status is ok')
assert(json?.phase === 'brainstorm', 'json phase is brainstorm')
assert(json?.approved === true, 'json approved is true')

// --- approve --json (error) ---

console.log('\napprove --json (error):')
initProject()
const emptyAssignment = '00002_feature_empty'
const specdev = join(TEST_DIR, '.specdev')
mkdirSync(join(specdev, 'assignments', emptyAssignment, 'brainstorm'), { recursive: true })
writeFileSync(join(specdev, '.current'), emptyAssignment, 'utf-8')
result = runCmd(['approve', 'brainstorm', '--json', `--target=${TEST_DIR}`])
assert(result.status === 1, 'approve error --json exits 1')
try {
  json = JSON.parse(result.stdout)
  assert(true, 'approve error --json outputs valid JSON')
} catch {
  assert(false, 'approve error --json outputs valid JSON', result.stdout)
}
assert(json?.status === 'error', 'json status is error')
assert(json?.approved === false, 'json approved is false')
assert(Array.isArray(json?.errors), 'json has errors array')

// --- revise --json ---

console.log('\nrevise --json:')
initProject()
createAssignment()
result = runCmd(['revise', '--json', `--target=${TEST_DIR}`])
assert(result.status === 0, 'revise --json exits 0', result.stderr || result.stdout)
try {
  json = JSON.parse(result.stdout)
  assert(true, 'revise --json outputs valid JSON')
} catch {
  assert(false, 'revise --json outputs valid JSON', result.stdout)
}
assert(json?.command === 'revise', 'json command is revise')
assert(json?.status === 'ok', 'json status is ok')
assert(json?.revision_recorded === true, 'json revision_recorded is true')
assert(json?.revision === 1, 'json revision is 1')
assert(json?.phase === 'brainstorm', 'json phase is brainstorm')

// --- migrate --json ---

console.log('\nmigrate --json:')
initProject()
result = runCmd(['migrate', '--json', `--target=${TEST_DIR}`])
assert(result.status === 0, 'migrate --json exits 0', result.stderr || result.stdout)
try {
  json = JSON.parse(result.stdout)
  assert(true, 'migrate --json outputs valid JSON')
} catch {
  assert(false, 'migrate --json outputs valid JSON', result.stdout)
}
assert(json?.command === 'migrate', 'json command is migrate')
assert(json?.status === 'ok', 'json status is ok')
assert(typeof json?.message === 'string', 'json has message')

// --- skills remove --json (error — not installed) ---

console.log('\nskills remove --json (error):')
initProject()
result = runCmd(['skills', 'remove', 'nonexistent', '--json', `--target=${TEST_DIR}`])
assert(result.status === 1, 'skills remove error exits 1')
try {
  json = JSON.parse(result.stdout)
  assert(true, 'skills remove error --json outputs valid JSON')
} catch {
  assert(false, 'skills remove error --json outputs valid JSON', result.stdout)
}
assert(json?.command === 'skills remove', 'json command is skills remove')
assert(json?.status === 'error', 'json status is error')
assert(json?.skill === 'nonexistent', 'json has skill name')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
