import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'

const TEST_DIR = './test-assignment-output'

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

  // Setup
  const init = runCmd(['./bin/specdev.js', 'init', `--target=${TEST_DIR}`])
  if (init.status !== 0) { console.error('setup failed'); process.exit(1) }

  // Fill in big_picture.md (prerequisite)
  const bigPicturePath = join(TEST_DIR, '.specdev/project_notes/big_picture.md')
  writeFileSync(bigPicturePath, '# Project\n\n## Overview\nA real project with enough content to pass the validation check.\n\n## Tech Stack\nNode.js\n')

  // Test 1: creates assignment directory
  console.log('assignment creates directory:')
  const result = runCmd(['./bin/specdev.js', 'assignment', 'auth-system', `--target=${TEST_DIR}`])
  if (!assert(result.status === 0, 'exits 0', result.stderr)) failures++

  const assignmentsDir = join(TEST_DIR, '.specdev/assignments')
  const entries = existsSync(assignmentsDir) ? readdirSync(assignmentsDir) : []
  const created = entries.find(e => e.includes('auth-system'))
  if (!assert(created, 'creates assignment directory with name')) failures++
  if (!assert(created && created.match(/^\d{5}_/), 'directory has sequential ID prefix')) failures++

  // Test 2: creates brainstorm subdirectory
  if (created) {
    const brainstormDir = join(assignmentsDir, created, 'brainstorm')
    if (!assert(existsSync(brainstormDir), 'creates brainstorm/ subdirectory')) failures++
  }

  // Test 3: second assignment gets next ID
  console.log('\nassignment increments ID:')
  const result2 = runCmd(['./bin/specdev.js', 'assignment', 'payment', `--target=${TEST_DIR}`])
  if (!assert(result2.status === 0, 'second assignment exits 0')) failures++
  const entries2 = readdirSync(assignmentsDir)
  const second = entries2.find(e => e.includes('payment'))
  if (!assert(second && second.startsWith('00002'), 'second assignment gets ID 00002')) failures++

  // Test 4: fails without big_picture.md filled
  console.log('\nassignment without big_picture:')
  cleanup()
  runCmd(['./bin/specdev.js', 'init', `--target=${TEST_DIR}`])
  const noBigPicture = runCmd(['./bin/specdev.js', 'assignment', 'test', `--target=${TEST_DIR}`])
  if (!assert(noBigPicture.status === 1, 'exits non-zero without big_picture filled')) failures++

  cleanup()
  console.log('')
  if (failures > 0) { console.error(`❌ ${failures} assignment test(s) failed`); process.exit(1) }
  console.log('✅ All assignment tests passed')
}

runTests()
