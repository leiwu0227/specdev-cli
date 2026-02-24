import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'

const TEST_DIR = './test-breakdown-output'

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

  // Setup: init + create assignment with brainstorm artifacts
  runCmd(['./bin/specdev.js', 'init', `--target=${TEST_DIR}`])
  const assignment = join(TEST_DIR, '.specdev/assignments/00001_feature_test')
  mkdirSync(join(assignment, 'brainstorm'), { recursive: true })

  // Test 1: fails without brainstorm artifacts
  console.log('breakdown without brainstorm artifacts:')
  const noArtifacts = runCmd([
    './bin/specdev.js', 'breakdown',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  if (!assert(noArtifacts.status === 1, 'exits non-zero without design.md')) failures++

  // Test 2: succeeds with design.md
  console.log('\nbreakdown with design.md:')
  writeFileSync(join(assignment, 'brainstorm', 'design.md'), '# Design\n\n## Architecture\nSome design content.\n')
  writeFileSync(join(assignment, 'brainstorm', 'proposal.md'), '# Proposal\n')
  const withDesign = runCmd([
    './bin/specdev.js', 'breakdown',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  if (!assert(withDesign.status === 0, 'exits 0 with design.md', withDesign.stderr)) failures++

  // Test 3: creates breakdown subdirectory
  if (!assert(existsSync(join(assignment, 'breakdown')), 'creates breakdown/ subdirectory')) failures++
  if (!assert(existsSync(join(assignment, 'breakdown', 'metadata.json')), 'writes breakdown/metadata.json')) failures++
  if (existsSync(join(assignment, 'breakdown', 'metadata.json'))) {
    const metadata = JSON.parse(readFileSync(join(assignment, 'breakdown', 'metadata.json'), 'utf-8'))
    if (!assert(metadata.based_on_brainstorm_revision === 0, 'metadata defaults to brainstorm revision 0')) failures++
  }

  cleanup()
  console.log('')
  if (failures > 0) { console.error(`\u274C ${failures} breakdown test(s) failed`); process.exit(1) }
  console.log('\u2705 All breakdown tests passed')
}

runTests()
