import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'

const TEST_DIR = './test-implement-output'

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
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

  runCmd(['./bin/specdev.js', 'init', `--target=${TEST_DIR}`])
  const assignment = join(TEST_DIR, '.specdev/assignments/00001_feature_test')
  mkdirSync(join(assignment, 'breakdown'), { recursive: true })

  // Test 1: fails without plan.md
  console.log('implement without plan.md:')
  const noPlan = runCmd([
    './bin/specdev.js', 'implement',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  if (!assert(noPlan.status === 1, 'exits non-zero without plan.md')) failures++

  // Test 2: succeeds with plan.md
  console.log('\nimplement with plan.md:')
  writeFileSync(join(assignment, 'breakdown', 'plan.md'), '# Plan\n\n## Task 1\nDo something.\n')
  const withPlan = runCmd([
    './bin/specdev.js', 'implement',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  if (!assert(withPlan.status === 0, 'exits 0 with plan.md', withPlan.stderr)) failures++
  if (!assert(withPlan.stdout.includes('implement') || withPlan.stdout.includes('SKILL.md'),
    'mentions implementing skill')) failures++

  // Test 3: creates implementation subdirectory
  if (!assert(existsSync(join(assignment, 'implementation')), 'creates implementation/ subdirectory')) failures++

  cleanup()
  console.log('')
  if (failures > 0) { console.error(`❌ ${failures} implement test(s) failed`); process.exit(1) }
  console.log('✅ All implement tests passed')
}

runTests()
