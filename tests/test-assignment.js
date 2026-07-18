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

  // Test 1: outputs reserved ID without creating folder
  console.log('assignment reserves ID without creating folder:')
  const result = runCmd(['assignment', 'Add', 'auth', 'system', `--target=${TEST_DIR}`])
  if (!assert(result.status === 0, 'exits 0', result.stderr)) failures++
  if (!assert(result.stdout.includes('00001'), 'outputs ID 00001')) failures++
  if (!assert(result.stdout.includes('Add auth system'), 'outputs description')) failures++

  const assignmentsDir = join(TEST_DIR, '.specdev/assignments')
  const entries = existsSync(assignmentsDir) ? readdirSync(assignmentsDir).filter(e => !e.startsWith('.')) : []
  if (!assert(entries.length === 0, 'does NOT create assignment folder', `found: ${entries.join(', ')}`)) failures++

  // Test 2: second call gets next ID
  console.log('\nassignment increments ID:')
  // Manually create a folder to simulate the agent having created the first assignment
  const fse = await import('fs-extra')
  await fse.default.ensureDir(join(assignmentsDir, '00001_feature_auth-system'))
  const result2 = runCmd(['assignment', 'Add payment flow', `--target=${TEST_DIR}`])
  if (!assert(result2.status === 0, 'second assignment exits 0')) failures++
  if (!assert(result2.stdout.includes('00002'), 'second assignment gets ID 00002')) failures++

  // Test 3: fails without big_picture.md filled
  console.log('\nassignment without big_picture:')
  cleanup()
  runCmd(['init', `--target=${TEST_DIR}`])
  const noBigPicture = runCmd(['assignment', 'test feature', `--target=${TEST_DIR}`])
  if (!assert(noBigPicture.status === 1, 'exits non-zero without big_picture filled')) failures++

  // Test 4: numeric label + existing assignment guides user to continue
  console.log('\nassignment numeric label disambiguation:')
  cleanup()
  runCmd(['init', `--target=${TEST_DIR}`])
  writeFileSync(bigPicturePath, '# Project\n\n## Overview\nA real project with enough content to pass the validation check.\n\n## Tech Stack\nNode.js\n')
  // Create a folder as if agent had created it from a previous assignment
  await fse.default.ensureDir(join(TEST_DIR, '.specdev/assignments/00001_feature_auth-system'))
  const numericLabel = runCmd(['assignment', '1', `--target=${TEST_DIR}`])
  if (!assert(numericLabel.status === 1, 'exits non-zero in non-interactive mode for numeric label')) failures++

  // Test 5: no description exits non-zero
  console.log('\nassignment without description:')
  cleanup()
  runCmd(['init', `--target=${TEST_DIR}`])
  writeFileSync(bigPicturePath, '# Project\n\n## Overview\nA real project with enough content to pass the validation check.\n\n## Tech Stack\nNode.js\n')
  const noDesc = runCmd(['assignment', `--target=${TEST_DIR}`])
  if (!assert(noDesc.status === 1, 'exits non-zero without description')) failures++
  if (!assert(noDesc.stderr.includes('No description'), 'prints usage hint')) failures++

  // Test 6: --json flag outputs valid JSON
  console.log('\nassignment --json output:')
  const jsonResult = runCmd(['assignment', 'Add dark mode', `--target=${TEST_DIR}`, '--json'])
  if (!assert(jsonResult.status === 0, 'exits 0 with --json')) failures++
  let parsed
  try {
    parsed = JSON.parse(jsonResult.stdout)
  } catch {
    parsed = null
  }
  if (!assert(parsed !== null, 'outputs valid JSON', jsonResult.stdout)) failures++
  if (parsed) {
    if (!assert(parsed.id === '00001', 'JSON has correct id')) failures++
    if (!assert(parsed.description === 'Add dark mode', 'JSON has correct description')) failures++
    if (!assert(parsed.status === 'ok', 'JSON has status ok')) failures++
    if (!assert(parsed.version === 1, 'JSON has version 1')) failures++
    if (!assert(typeof parsed.assignments_dir === 'string', 'JSON has assignments_dir')) failures++
  }

  cleanup()
  console.log('')
  if (failures > 0) { console.error(`❌ ${failures} assignment test(s) failed`); process.exit(1) }
  console.log('✅ All assignment tests passed')
}

runTests()
