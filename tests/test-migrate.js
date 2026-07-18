import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const TEST_DIR = './test-migrate-output'

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
}

function runCmd(args) {
  return spawnSync('node', ['./bin/specdev.js', ...args], { encoding: 'utf-8' })
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

function setupLegacyAssignment(name) {
  const assignment = join(TEST_DIR, '.specdev', 'assignments', name)
  mkdirSync(assignment, { recursive: true })
  writeFileSync(join(assignment, 'proposal.md'), '# Proposal\n')
  writeFileSync(join(assignment, 'plan.md'), '# Plan\n')
  writeFileSync(join(assignment, 'implementation.md'), '# Impl\n')
  return assignment
}

async function runTests() {
  let failures = 0
  cleanup()

  runCmd(['init', `--target=${TEST_DIR}`])

  console.log('migrate dry-run:')
  const a1 = setupLegacyAssignment('00001_feature_legacy')
  const dryRun = runCmd(['migrate', `--target=${TEST_DIR}`, '--dry-run'])
  if (!assert(dryRun.status === 0, 'dry-run exits 0', dryRun.stderr)) failures++
  if (!assert(existsSync(join(a1, 'proposal.md')), 'dry-run keeps legacy proposal.md')) failures++
  if (!assert(!existsSync(join(a1, 'brainstorm', 'proposal.md')), 'dry-run does not move files')) failures++

  console.log('\nmigrate apply:')
  const apply = runCmd(['migrate', `--target=${TEST_DIR}`])
  if (!assert(apply.status === 0, 'migrate exits 0', apply.stderr)) failures++
  if (!assert(!existsSync(join(a1, 'proposal.md')), 'moves proposal.md from legacy root')) failures++
  if (!assert(existsSync(join(a1, 'brainstorm', 'proposal.md')), 'creates brainstorm/proposal.md')) failures++
  if (!assert(!existsSync(join(a1, 'plan.md')), 'moves plan.md from legacy root')) failures++
  if (!assert(existsSync(join(a1, 'breakdown', 'plan.md')), 'creates breakdown/plan.md')) failures++
  if (!assert(!existsSync(join(a1, 'implementation.md')), 'moves implementation.md from legacy root')) failures++
  if (!assert(existsSync(join(a1, 'implementation', 'implementation.md')), 'creates implementation/implementation.md')) failures++
  if (!assert(existsSync(join(a1, 'implementation', 'progress.json')), 'creates implementation/progress.json')) failures++
  if (!assert(existsSync(join(a1, 'context')), 'ensures context/ exists')) failures++

  console.log('\nmigrate assignment filter:')
  const a2 = setupLegacyAssignment('00002_feature_filtered')
  const onlyA1 = runCmd([
    'migrate',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_legacy',
  ])
  if (!assert(onlyA1.status === 0, 'filtered migrate exits 0')) failures++
  if (!assert(existsSync(join(a2, 'proposal.md')), 'does not touch other assignments')) failures++

  console.log('\nmissing assignment:')
  const missing = runCmd([
    'migrate',
    `--target=${TEST_DIR}`,
    '--assignment=99999_feature_missing',
  ])
  if (!assert(missing.status === 1, 'missing assignment exits non-zero')) failures++

  cleanup()
  console.log('')
  if (failures > 0) {
    console.error(`❌ ${failures} migrate test(s) failed`)
    process.exit(1)
  }
  console.log('✅ All migrate tests passed')
}

runTests()
