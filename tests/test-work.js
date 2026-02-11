import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'

const TEST_DIR = './test-work-output'

function cleanup() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true })
  }
}

function runCmd(args) {
  return spawnSync('node', args, { encoding: 'utf-8' })
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

  // Setup: init project + create assignment with plan/proposal
  const init = runCmd(['./bin/specdev.js', 'init', `--target=${TEST_DIR}`])
  if (init.status !== 0) {
    console.error('❌ setup failed: specdev init')
    process.exit(1)
  }

  const assignment = join(TEST_DIR, '.specdev/assignments/00001_feature_test-work')
  mkdirSync(assignment, { recursive: true })
  writeFileSync(join(assignment, 'plan.md'), '# Plan\n\n**Complexity: LOW**\n')
  writeFileSync(join(assignment, 'proposal.md'), '# Proposal\n')

  // Test 1: work request creates review_request.json
  console.log('work request:')
  const req = runCmd([
    './bin/specdev.js', 'work', 'request',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_test-work',
    '--gate=gate_3',
  ])
  if (!assert(req.status === 0, 'creates a review request')) failures++

  const requestPath = join(assignment, 'review_request.json')
  if (!assert(existsSync(requestPath), 'review_request.json exists')) failures++

  const reviewReq = JSON.parse(readFileSync(requestPath, 'utf-8'))
  if (!assert(reviewReq.status === 'pending', 'status is pending')) failures++
  if (!assert(
    reviewReq.assignment_path === '.specdev/assignments/00001_feature_test-work',
    'writes project-relative assignment_path'
  )) failures++

  // Test 2: work status shows current state
  console.log('\nwork status:')
  const status = runCmd([
    './bin/specdev.js', 'work', 'status',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_test-work',
  ])
  if (!assert(status.status === 0, 'status returns success')) failures++
  if (!assert(status.stdout.includes('pending'), 'status output shows pending')) failures++

  // Test 3: work status with mode flag
  console.log('\nwork request with mode:')
  // Remove existing request first
  rmSync(requestPath)
  const reqMode = runCmd([
    './bin/specdev.js', 'work', 'request',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_test-work',
    '--gate=gate_3',
    '--mode=manual',
  ])
  if (!assert(reqMode.status === 0, 'creates request with mode flag')) failures++
  const reqWithMode = JSON.parse(readFileSync(requestPath, 'utf-8'))
  if (!assert(reqWithMode.mode === 'manual', 'mode is stored in request')) failures++

  // Test 4: work status detects passed review
  console.log('\nwork status after pass:')
  const passedReq = { ...reqWithMode, status: 'passed', completed_at: new Date().toISOString() }
  writeFileSync(requestPath, JSON.stringify(passedReq, null, 2))
  const statusPassed = runCmd([
    './bin/specdev.js', 'work', 'status',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_test-work',
  ])
  if (!assert(statusPassed.status === 0, 'status returns success for passed review')) failures++
  if (!assert(statusPassed.stdout.includes('passed'), 'status shows passed')) failures++

  // Test 5: work status detects failed review (exits non-zero)
  console.log('\nwork status after fail:')
  const failedReq = { ...reqWithMode, status: 'failed', reviewer_notes: 'missing tests', completed_at: new Date().toISOString() }
  writeFileSync(requestPath, JSON.stringify(failedReq, null, 2))
  const statusFailed = runCmd([
    './bin/specdev.js', 'work', 'status',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_test-work',
  ])
  if (!assert(statusFailed.status === 1, 'status exits non-zero for failed review')) failures++
  if (!assert(statusFailed.stdout.includes('failed'), 'status shows failed')) failures++

  // Test: help text documents work and check commands
  console.log('\nhelp text:')
  const helpSource = readFileSync('./src/commands/help.js', 'utf-8')
  if (!assert(
    helpSource.includes('work <sub>') && helpSource.includes('check <sub>'),
    'help documents work and check commands'
  )) failures++
  if (!assert(
    !helpSource.includes('review <sub>'),
    'help no longer documents review command'
  )) failures++

  cleanup()

  console.log('')
  if (failures > 0) {
    console.error(`❌ ${failures} work test(s) failed`)
    process.exit(1)
  }
  console.log('✅ All work tests passed')
}

runTests()
