import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
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

  // Test 1: review status with no pending review
  console.log('review status (no review):')
  const noReview = runCmd([
    './bin/specdev.js', 'review', 'status',
    `--target=${TEST_DIR}`,
  ])
  if (!assert(noReview.status === 0, 'returns success when no reviews pending')) failures++
  if (!assert(noReview.stdout.includes('No pending'), 'reports no pending reviews')) failures++

  // Test 2: review status finds pending review
  console.log('\nreview status (pending review):')
  writeFileSync(join(assignment, 'review_request.json'), JSON.stringify({
    version: 1,
    assignment_id: '00001',
    assignment_path: '.specdev/assignments/00001_feature_test-check',
    gate: 'review',
    status: 'pending',
    mode: 'auto',
    timestamp: new Date().toISOString(),
    changed_files: ['src/foo.js'],
  }, null, 2))

  const pending = runCmd([
    './bin/specdev.js', 'review', 'status',
    `--target=${TEST_DIR}`,
  ])
  if (!assert(pending.status === 0, 'returns success for pending review')) failures++
  if (!assert(pending.stdout.includes('pending'), 'shows pending status')) failures++
  if (!assert(pending.stdout.includes('00001'), 'shows assignment id')) failures++

  // Test 3: review start triggers preflight (should fail — missing structural files)
  console.log('\nreview start (preflight failure):')
  const run = runCmd([
    './bin/specdev.js', 'review', 'start',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_test-check',
  ])
  if (!assert(run.status === 1, 'exits non-zero when preflight fails', run.stdout + run.stderr)) failures++
  // Status should stay pending after preflight failure
  const afterRun = JSON.parse(readFileSync(join(assignment, 'review_request.json'), 'utf-8'))
  if (!assert(afterRun.status === 'pending', 'status stays pending after preflight failure')) failures++
  // Lock file should be cleaned up
  if (!assert(!existsSync(join(assignment, 'review_request.lock')), 'lock file removed on failure')) failures++

  // Test 4: review accept (from in_progress)
  console.log('\nreview accept:')
  writeFileSync(join(assignment, 'review_request.json'), JSON.stringify({
    version: 1, assignment_id: '00001', gate: 'review',
    status: 'in_progress', mode: 'auto', timestamp: new Date().toISOString(),
  }, null, 2))
  writeFileSync(join(assignment, 'review_request.lock'), new Date().toISOString())

  const accept = runCmd([
    './bin/specdev.js', 'review', 'accept',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_test-check',
    '--notes=looks good',
  ])
  if (!assert(accept.status === 0, 'accept returns success')) failures++
  const accepted = JSON.parse(readFileSync(join(assignment, 'review_request.json'), 'utf-8'))
  if (!assert(accepted.status === 'passed', 'status is passed after accept')) failures++
  if (!assert(accepted.reviewer_notes === 'looks good', 'reviewer notes stored')) failures++
  if (!assert(!existsSync(join(assignment, 'review_request.lock')), 'lock removed after accept')) failures++

  // Test 5: review reject (from in_progress)
  console.log('\nreview reject:')
  writeFileSync(join(assignment, 'review_request.json'), JSON.stringify({
    version: 1, assignment_id: '00001', gate: 'review',
    status: 'in_progress', mode: 'auto', timestamp: new Date().toISOString(),
  }, null, 2))
  writeFileSync(join(assignment, 'review_request.lock'), new Date().toISOString())

  const reject = runCmd([
    './bin/specdev.js', 'review', 'reject',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_test-check',
    '--reason=missing error handling',
  ])
  if (!assert(reject.status === 0, 'reject returns success')) failures++
  const rejected = JSON.parse(readFileSync(join(assignment, 'review_request.json'), 'utf-8'))
  if (!assert(rejected.status === 'failed', 'status is failed after reject')) failures++
  if (!assert(rejected.reviewer_notes === 'missing error handling', 'rejection reason stored')) failures++

  // Test 6: review resume with progress file
  console.log('\nreview resume:')
  writeFileSync(join(assignment, 'review_request.json'), JSON.stringify({
    version: 1, assignment_id: '00001', gate: 'review',
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
    './bin/specdev.js', 'review', 'resume',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_test-check',
  ])
  if (!assert(resume.status === 0, 'resume returns success')) failures++
  if (!assert(resume.stdout.includes('2/4'), 'resume shows progress')) failures++
  if (!assert(resume.stdout.includes('src/baz.js'), 'resume shows remaining files')) failures++

  cleanup()

  // Test 7: review.js does not use execSync (security)
  console.log('\nreview.js does not use execSync (security):')
  const source = readFileSync(new URL('../src/commands/review.js', import.meta.url), 'utf-8')
  if (!assert(!source.includes('execSync('), 'review.js should not use execSync — use execFileSync instead')) failures++
  if (!assert(source.includes('execFileSync'), 'review.js should use execFileSync')) failures++

  // Test: verify-gates.sh does not interpolate paths into node -e (security)
  console.log('\nverify-gates.sh does not interpolate paths into node -e (security):')
  const scriptPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'verify-gates.sh')
  const scriptSource = readFileSync(scriptPath, 'utf-8')
  if (!assert(!scriptSource.includes("readFileSync('$ASSIGNMENT_PATH"), 'verify-gates.sh should not interpolate $ASSIGNMENT_PATH into JS strings')) failures++

  // Test: review.js uses wx flag for atomic lock file creation (TOCTOU fix)
  console.log('\nreview start creates lock atomically with wx flag:')
  const reviewSource = readFileSync(new URL('../src/commands/review.js', import.meta.url), 'utf-8')
  if (!assert(reviewSource.includes("flag: 'wx'") || reviewSource.includes('flag: "wx"'),
    'review.js should use wx flag for atomic lock file creation')) failures++

  console.log('')
  if (failures > 0) {
    console.error(`❌ ${failures} review test(s) failed`)
    process.exit(1)
  }
  console.log('✅ All review tests passed')
}

runTests()
