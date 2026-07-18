import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'

const TEST_DIR = './test-revise-output'

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

  // Test 1: fails without design.md
  console.log('revise without design.md:')
  const noDesign = runCmd([
    './bin/specdev.js', 'revise',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  if (!assert(noDesign.status === 1, 'exits non-zero without design.md')) failures++

  // Test 2: succeeds with design.md only and writes revision.json
  console.log('\nrevise with design.md only:')
  writeFileSync(join(assignment, 'brainstorm', 'design.md'), '# Design\n\n## Architecture\nSome design content.\n')
  writeFileSync(join(assignment, 'brainstorm', 'proposal.md'), '# Proposal\n')
  const designOnly = runCmd([
    './bin/specdev.js', 'revise',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  if (!assert(designOnly.status === 0, 'exits 0 with design.md only', designOnly.stderr)) failures++
  if (!assert(existsSync(join(assignment, 'brainstorm', 'revision.json')), 'writes brainstorm/revision.json')) failures++
  if (existsSync(join(assignment, 'brainstorm', 'revision.json'))) {
    const revision = JSON.parse(readFileSync(join(assignment, 'brainstorm', 'revision.json'), 'utf-8'))
    if (!assert(revision.revision === 1, 'sets initial brainstorm revision to 1')) failures++
  }

  // Test 3: increments revision and preserves downstream artifacts
  console.log('\nrevise with downstream artifacts:')
  mkdirSync(join(assignment, 'breakdown'), { recursive: true })
  writeFileSync(join(assignment, 'breakdown', 'plan.md'), '# Plan\n')
  mkdirSync(join(assignment, 'implementation'), { recursive: true })
  writeFileSync(join(assignment, 'implementation', 'progress.json'), '{}')
  writeFileSync(join(assignment, 'review_report.md'), '# Review\n')
  const withArtifacts = runCmd([
    './bin/specdev.js', 'revise',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  if (!assert(withArtifacts.status === 0, 'exits 0 with downstream artifacts', withArtifacts.stderr)) failures++
  if (!assert(existsSync(join(assignment, 'breakdown')), 'breakdown/ preserved')) failures++
  if (!assert(existsSync(join(assignment, 'implementation')), 'implementation/ preserved')) failures++
  if (!assert(existsSync(join(assignment, 'review_report.md')), 'review_report.md preserved')) failures++
  if (existsSync(join(assignment, 'brainstorm', 'revision.json'))) {
    const revision = JSON.parse(readFileSync(join(assignment, 'brainstorm', 'revision.json'), 'utf-8'))
    if (!assert(revision.revision === 2, 'increments brainstorm revision to 2')) failures++
  }

  // Test 4: design.md is preserved
  console.log('\ndesign.md preserved:')
  if (!assert(existsSync(join(assignment, 'brainstorm', 'design.md')), 'brainstorm/design.md still exists')) failures++
  if (!assert(existsSync(join(assignment, 'brainstorm', 'proposal.md')), 'brainstorm/proposal.md still exists')) failures++

  cleanup()
  console.log('')
  if (failures > 0) { console.error(`\u274C ${failures} revise test(s) failed`); process.exit(1) }
  console.log('\u2705 All revise tests passed')
}

runTests()
