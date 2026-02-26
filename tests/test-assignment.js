import { writeFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { cleanupDir, runSpecdev, assertTest } from './helpers.js'

const TEST_DIR = './test-assignment-output'

function cleanup() {
  cleanupDir(TEST_DIR)
}

function runCmd(args) {
  return runSpecdev(args)
}

function assert(condition, msg, detail = '') {
  return assertTest(condition, msg, detail)
}

async function runTests() {
  let failures = 0
  cleanup()

  // Setup
  const init = runCmd(['init', `--target=${TEST_DIR}`])
  if (init.status !== 0) { console.error('setup failed'); process.exit(1) }

  // Fill in big_picture.md (prerequisite)
  const bigPicturePath = join(TEST_DIR, '.specdev/project_notes/big_picture.md')
  writeFileSync(bigPicturePath, '# Project\n\n## Overview\nA real project with enough content to pass the validation check.\n\n## Tech Stack\nNode.js\n')

  // Test 1: creates assignment directory
  console.log('assignment creates directory:')
  const result = runCmd(['assignment', 'auth-system', `--target=${TEST_DIR}`])
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
  const result2 = runCmd(['assignment', 'payment', `--target=${TEST_DIR}`])
  if (!assert(result2.status === 0, 'second assignment exits 0')) failures++
  const entries2 = readdirSync(assignmentsDir)
  const second = entries2.find(e => e.includes('payment'))
  if (!assert(second && second.startsWith('00002'), 'second assignment gets ID 00002')) failures++

  // Test 4: fails without big_picture.md filled
  console.log('\nassignment without big_picture:')
  cleanup()
  runCmd(['init', `--target=${TEST_DIR}`])
  const noBigPicture = runCmd(['assignment', 'test', `--target=${TEST_DIR}`])
  if (!assert(noBigPicture.status === 1, 'exits non-zero without big_picture filled')) failures++

  // Test 5: numeric label + existing assignment guides user to continue
  console.log('\nassignment numeric label disambiguation:')
  cleanup()
  runCmd(['init', `--target=${TEST_DIR}`])
  writeFileSync(bigPicturePath, '# Project\n\n## Overview\nA real project with enough content to pass the validation check.\n\n## Tech Stack\nNode.js\n')
  runCmd(['assignment', 'auth-system', `--target=${TEST_DIR}`])
  const beforeNumeric = readdirSync(join(TEST_DIR, '.specdev/assignments')).length
  const numericLabel = runCmd(['assignment', '1', `--target=${TEST_DIR}`])
  const afterNumeric = readdirSync(join(TEST_DIR, '.specdev/assignments')).length
  if (!assert(numericLabel.status === 1, 'exits non-zero in non-interactive mode for numeric label')) failures++
  if (!assert(afterNumeric === beforeNumeric, 'does not create a new assignment when numeric label matches existing ID')) failures++

  cleanup()
  console.log('')
  if (failures > 0) { console.error(`❌ ${failures} assignment test(s) failed`); process.exit(1) }
  console.log('✅ All assignment tests passed')
}

runTests()
