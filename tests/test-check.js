import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'

const TEST_DIR = './test-check-output'

function cleanup() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true })
  }
}

function runCmd(args) {
  return spawnSync('node', args, { encoding: 'utf-8' })
}

function runShell(cmd) {
  return spawnSync('bash', ['-lc', cmd], { encoding: 'utf-8' })
}

function assert(condition, msg, detail = '') {
  if (!condition) {
    console.error(`  ❌ ${msg}`)
    if (detail) console.error(`     ${detail}`)
    return false
  }
  console.log(`  ✓ ${msg}`)
  return true
}

async function runTests() {
  let failures = 0
  cleanup()

  const init = runCmd(['./bin/specdev.js', 'init', `--target=${TEST_DIR}`])
  if (init.status !== 0) {
    console.error('❌ setup failed')
    process.exit(1)
  }

  const assignment = join(TEST_DIR, '.specdev/assignments/00001_feature_test-check')
  mkdirSync(assignment, { recursive: true })
  writeFileSync(join(assignment, 'plan.md'), '# Plan\n\n**Complexity: LOW**\n')
  writeFileSync(join(assignment, 'proposal.md'), '# Proposal\n')

  // Test 1: check status with no pending review
  console.log('check status (no review):')
  const noReview = runCmd([
    './bin/specdev.js', 'check', 'status',
    `--target=${TEST_DIR}`,
  ])
  if (!assert(noReview.status === 0, 'returns success when no reviews pending')) failures++
  if (!assert(noReview.stdout.includes('No pending'), 'reports no pending reviews')) failures++

  // Test 2: check status finds pending review
  console.log('\ncheck status (pending review):')
  writeFileSync(join(assignment, 'review_request.json'), JSON.stringify({
    version: 1,
    assignment_id: '00001',
    assignment_path: '.specdev/assignments/00001_feature_test-check',
    gate: 'gate_3',
    status: 'pending',
    mode: 'auto',
    timestamp: new Date().toISOString(),
    changed_files: ['src/foo.js'],
  }, null, 2))

  const pending = runCmd([
    './bin/specdev.js', 'check', 'status',
    `--target=${TEST_DIR}`,
  ])
  if (!assert(pending.status === 0, 'returns success for pending review')) failures++
  if (!assert(pending.stdout.includes('pending'), 'shows pending status')) failures++
  if (!assert(pending.stdout.includes('00001'), 'shows assignment id')) failures++

  // Test 3: check run triggers preflight (should fail — missing structural files)
  console.log('\ncheck run (preflight failure):')
  const run = runCmd([
    './bin/specdev.js', 'check', 'run',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_test-check',
  ])
  if (!assert(run.status === 1, 'exits non-zero when preflight fails', run.stdout + run.stderr)) failures++
  // Status should stay pending after preflight failure
  const afterRun = JSON.parse(readFileSync(join(assignment, 'review_request.json'), 'utf-8'))
  if (!assert(afterRun.status === 'pending', 'status stays pending after preflight failure')) failures++
  // Lock file should be cleaned up
  if (!assert(!existsSync(join(assignment, 'review_request.lock')), 'lock file removed on failure')) failures++

  // Test 4: check accept (from in_progress)
  console.log('\ncheck accept:')
  writeFileSync(join(assignment, 'review_request.json'), JSON.stringify({
    version: 1, assignment_id: '00001', gate: 'gate_3',
    status: 'in_progress', mode: 'auto', timestamp: new Date().toISOString(),
  }, null, 2))
  writeFileSync(join(assignment, 'review_request.lock'), new Date().toISOString())

  const accept = runCmd([
    './bin/specdev.js', 'check', 'accept',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_test-check',
    '--notes=looks good',
  ])
  if (!assert(accept.status === 0, 'accept returns success')) failures++
  const accepted = JSON.parse(readFileSync(join(assignment, 'review_request.json'), 'utf-8'))
  if (!assert(accepted.status === 'passed', 'status is passed after accept')) failures++
  if (!assert(accepted.reviewer_notes === 'looks good', 'reviewer notes stored')) failures++
  if (!assert(!existsSync(join(assignment, 'review_request.lock')), 'lock removed after accept')) failures++

  // Test 5: check reject (from in_progress)
  console.log('\ncheck reject:')
  writeFileSync(join(assignment, 'review_request.json'), JSON.stringify({
    version: 1, assignment_id: '00001', gate: 'gate_3',
    status: 'in_progress', mode: 'auto', timestamp: new Date().toISOString(),
  }, null, 2))
  writeFileSync(join(assignment, 'review_request.lock'), new Date().toISOString())

  const reject = runCmd([
    './bin/specdev.js', 'check', 'reject',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_test-check',
    '--reason=missing error handling',
  ])
  if (!assert(reject.status === 0, 'reject returns success')) failures++
  const rejected = JSON.parse(readFileSync(join(assignment, 'review_request.json'), 'utf-8'))
  if (!assert(rejected.status === 'failed', 'status is failed after reject')) failures++
  if (!assert(rejected.reviewer_notes === 'missing error handling', 'rejection reason stored')) failures++

  // Test 6: check resume with progress file
  console.log('\ncheck resume:')
  writeFileSync(join(assignment, 'review_request.json'), JSON.stringify({
    version: 1, assignment_id: '00001', gate: 'gate_3',
    status: 'in_progress', mode: 'auto', timestamp: new Date().toISOString(),
  }, null, 2))
  writeFileSync(join(assignment, 'review_progress.json'), JSON.stringify({
    phase: 'reviewing',
    mode: 'auto',
    started_at: new Date().toISOString(),
    last_activity: new Date(Date.now() - 600000).toISOString(), // 10 min ago
    files_total: 4,
    files_reviewed: ['src/foo.js', 'src/bar.js'],
    files_remaining: ['src/baz.js', 'tests/test.js'],
    findings_so_far: 1,
  }, null, 2))

  const resume = runCmd([
    './bin/specdev.js', 'check', 'resume',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_test-check',
  ])
  if (!assert(resume.status === 0, 'resume returns success')) failures++
  if (!assert(resume.stdout.includes('2/4'), 'resume shows progress')) failures++
  if (!assert(resume.stdout.includes('src/baz.js'), 'resume shows remaining files')) failures++

  cleanup()

  console.log('')
  if (failures > 0) {
    console.error(`❌ ${failures} check test(s) failed`)
    process.exit(1)
  }
  console.log('✅ All check tests passed')
}

runTests()
