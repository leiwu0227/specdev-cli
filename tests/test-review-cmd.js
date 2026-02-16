import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'

const TEST_DIR = './test-review-cmd-output'

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
}

function runCmd(args) {
  return spawnSync('node', args, { encoding: 'utf-8' })
}

function assert(condition, msg, detail = '') {
  if (!condition) {
    console.error(`  \u274C ${msg}`)
    if (detail) console.error(`     ${detail}`)
    return false
  }
  console.log(`  \u2713 ${msg}`)
  return true
}

async function runTests() {
  let failures = 0
  cleanup()

  runCmd(['./bin/specdev.js', 'init', `--target=${TEST_DIR}`])

  // Test 1: review after brainstorm phase
  console.log('review after brainstorm:')
  const assignment = join(TEST_DIR, '.specdev/assignments/00001_feature_test')
  mkdirSync(join(assignment, 'brainstorm'), { recursive: true })
  writeFileSync(join(assignment, 'brainstorm', 'proposal.md'), '# Proposal\n')
  writeFileSync(join(assignment, 'brainstorm', 'design.md'), '# Design\n')

  const brainstormReview = runCmd([
    './bin/specdev.js', 'review',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  if (!assert(brainstormReview.status === 0, 'exits 0', brainstormReview.stderr)) failures++
  if (!assert(brainstormReview.stdout.includes('brainstorm') || brainstormReview.stdout.includes('design'),
    'mentions brainstorm phase context')) failures++

  // Test 2: review after implementation phase
  console.log('\nreview after implementation:')
  mkdirSync(join(assignment, 'breakdown'), { recursive: true })
  mkdirSync(join(assignment, 'implementation'), { recursive: true })
  writeFileSync(join(assignment, 'breakdown', 'plan.md'), '# Plan\n')
  writeFileSync(join(assignment, 'implementation', 'progress.json'), '{}')

  const implReview = runCmd([
    './bin/specdev.js', 'review',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  if (!assert(implReview.status === 0, 'exits 0 for implementation review')) failures++
  if (!assert(implReview.stdout.includes('implementation') || implReview.stdout.includes('code'),
    'mentions implementation/code review context')) failures++

  // Test 3: review without any assignment
  console.log('\nreview without assignment:')
  cleanup()
  runCmd(['./bin/specdev.js', 'init', `--target=${TEST_DIR}`])
  const noAssignment = runCmd(['./bin/specdev.js', 'review', `--target=${TEST_DIR}`])
  if (!assert(noAssignment.status === 1, 'exits non-zero without assignment')) failures++

  cleanup()
  console.log('')
  if (failures > 0) { console.error(`\u274C ${failures} review test(s) failed`); process.exit(1) }
  console.log('\u2705 All review tests passed')
}

runTests()
