import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { cleanupDir, runSpecdev, assertTest, createMockToolSkill } from './helpers.js'

const TEST_DIR = './tests/test-json-medium-output'
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

function createAssignmentWithPlan() {
  const specdev = join(TEST_DIR, '.specdev')
  const assignmentPath = join(specdev, 'assignments', '00001_feature_test-impl')
  mkdirSync(join(assignmentPath, 'brainstorm'), { recursive: true })
  mkdirSync(join(assignmentPath, 'breakdown'), { recursive: true })
  writeFileSync(join(assignmentPath, 'brainstorm', 'proposal.md'), '# Proposal\n\nTest proposal.\n')
  writeFileSync(join(assignmentPath, 'brainstorm', 'design.md'), '# Design\n\n## Overview\nTest.\n\n## Goals\nTest.\n\n## Design\nTest.\n')
  writeFileSync(join(assignmentPath, 'breakdown', 'plan.md'), [
    '# Test Plan',
    '',
    '**Execution Mode:** inline',
    '',
    '### Task 1: First task',
    'Do the first thing.',
    '',
    '### Task 2: Second task',
    'Do the second thing.',
    '',
  ].join('\n'))
  writeFileSync(join(specdev, '.current'), '00001_feature_test-impl\n')
  return assignmentPath
}

// --- implement --json ---

console.log('\nimplement --json:')
initProject()
createAssignmentWithPlan()
let result = runCmd(['implement', '--json', `--target=${TEST_DIR}`])
assert(result.status === 0, 'implement --json exits 0', result.stderr || result.stdout)
let json = null
try {
  json = JSON.parse(result.stdout)
  assert(true, 'implement --json outputs valid JSON')
} catch {
  assert(false, 'implement --json outputs valid JSON', result.stdout)
}
assert(json?.command === 'implement', 'json command is implement')
assert(json?.status === 'ok', 'json status is ok')
assert(typeof json?.plan_path === 'string', 'json has plan_path')
assert(json?.execution_mode === 'inline', 'json has execution_mode')
assert(Array.isArray(json?.tasks), 'json has tasks array')
assert(json?.tasks?.length === 2, 'json reports 2 tasks')

console.log('\nimplement --json error:')
initProject()
const specdev = join(TEST_DIR, '.specdev')
const noplanPath = join(specdev, 'assignments', '00001_feature_no-plan')
mkdirSync(join(noplanPath, 'brainstorm'), { recursive: true })
writeFileSync(join(specdev, '.current'), '00001_feature_no-plan\n')
result = runCmd(['implement', '--json', `--target=${TEST_DIR}`])
assert(result.status === 1, 'implement --json error exits 1')
try {
  json = JSON.parse(result.stdout)
  assert(json?.status === 'error', 'implement error json has status error')
} catch {
  assert(false, 'implement error outputs valid JSON', result.stdout)
}

// --- update --json ---

console.log('\nupdate --json:')
initProject()
result = runCmd(['update', '--json', `--target=${TEST_DIR}`])
assert(result.status === 0, 'update --json exits 0', result.stderr || result.stdout)
try {
  json = JSON.parse(result.stdout)
  assert(true, 'update --json outputs valid JSON')
} catch {
  assert(false, 'update --json outputs valid JSON', result.stdout)
}
assert(json?.command === 'update', 'json command is update')
assert(json?.status === 'ok', 'json status is ok')
assert(typeof json?.cli_version === 'string', 'json has cli_version')
assert(Array.isArray(json?.updated), 'json has updated array')
assert(Array.isArray(json?.preserved), 'json has preserved array')

// --- migrate legacy-assignments --json ---

console.log('\nmigrate-legacy --json:')
initProject()
const legacyAssignment = join(TEST_DIR, '.specdev', 'assignments', '00001_feature_legacy-test')
mkdirSync(legacyAssignment, { recursive: true })
writeFileSync(join(legacyAssignment, 'proposal.md'), '# Legacy Proposal\n')
writeFileSync(join(legacyAssignment, 'design.md'), '# Legacy Design\n')
result = runCmd(['migrate', 'legacy-assignments', '--json', '--dry-run', `--target=${TEST_DIR}`])
assert(result.status === 0, 'migrate-legacy --json exits 0', result.stderr || result.stdout)
try {
  json = JSON.parse(result.stdout)
  assert(true, 'migrate-legacy --json outputs valid JSON')
} catch {
  assert(false, 'migrate-legacy --json outputs valid JSON', result.stdout)
}
assert(json?.command === 'migrate legacy-assignments', 'json command is migrate legacy-assignments')
assert(json?.status === 'ok', 'json status is ok')
assert(typeof json?.assignments_scanned === 'number', 'json has assignments_scanned')
assert(typeof json?.files_moved === 'number', 'json has files_moved')
assert(json?.dry_run === true, 'json reports dry_run true')

// --- review --json ---

console.log('\nreview --json:')
initProject()
createAssignmentWithPlan()
result = runCmd(['review', 'brainstorm', '--json', `--target=${TEST_DIR}`])
assert(result.status === 0, 'review --json exits 0', result.stderr || result.stdout)
try {
  json = JSON.parse(result.stdout)
  assert(true, 'review --json outputs valid JSON')
} catch {
  assert(false, 'review --json outputs valid JSON', result.stdout)
}
assert(json?.command === 'review', 'json command is review')
assert(json?.status === 'ok', 'json status is ok')
assert(json?.phase === 'brainstorm', 'json phase is brainstorm')
assert(typeof json?.assignment === 'string', 'json has assignment')
assert(typeof json?.round === 'number', 'json has round')
assert(json?.round === 1, 'json round is 1 for first review')

// --- skills-sync --json ---

console.log('\nskills-sync --json:')
initProject()
result = runCmd(['skills', 'sync', '--json', `--target=${TEST_DIR}`])
assert(result.status === 0, 'skills-sync --json exits 0', result.stderr || result.stdout)
try {
  json = JSON.parse(result.stdout)
  assert(true, 'skills-sync --json outputs valid JSON')
} catch {
  assert(false, 'skills-sync --json outputs valid JSON', result.stdout)
}
assert(json?.command === 'skills sync', 'json command is skills sync')
assert(json?.status === 'ok', 'json status is ok')
assert(Array.isArray(json?.removed), 'json has removed array')
assert(Array.isArray(json?.regenerated), 'json has regenerated array')
assert(Array.isArray(json?.inactive), 'json has inactive array')

// --- skills-install --json ---

console.log('\nskills-install --json:')
initProject()
createMockToolSkill(TEST_DIR, 'test-tool')
mkdirSync(join(TEST_DIR, '.claude'), { recursive: true })
result = runCmd(['skills', 'install', '--json', '--agents=claude-code', `--target=${TEST_DIR}`])
assert(result.status === 0, 'skills-install --json exits 0', result.stderr || result.stdout)
try {
  json = JSON.parse(result.stdout)
  assert(true, 'skills-install --json outputs valid JSON')
} catch {
  assert(false, 'skills-install --json outputs valid JSON', result.stdout)
}
assert(json?.command === 'skills install', 'json command is skills install')
assert(json?.status === 'ok', 'json status is ok')
assert(Array.isArray(json?.skills), 'json has skills array')
assert(json?.skills?.includes('test-tool'), 'json includes test-tool in installed')
assert(json?.installed === true, 'json has installed flag')
assert(typeof json?.total_tools === 'number', 'json has total_tools')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
