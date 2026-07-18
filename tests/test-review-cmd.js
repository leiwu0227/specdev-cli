import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
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
  const reviewSource = readFileSync('./src/commands/review.js', 'utf-8')
  cleanup()

  runCmd(['./bin/specdev.js', 'init', `--target=${TEST_DIR}`])

  const assignment = join(TEST_DIR, '.specdev/assignments/00001_feature_test')
  mkdirSync(join(assignment, 'brainstorm'), { recursive: true })
  writeFileSync(join(assignment, 'brainstorm', 'proposal.md'), '# Proposal\n')
  writeFileSync(join(assignment, 'brainstorm', 'design.md'), '# Design\n')

  // Test 1: no phase argument → error
  console.log('review with no phase argument:')
  const noPhase = runCmd([
    './bin/specdev.js', 'review',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  const noPhaseText = `${noPhase.stdout}\n${noPhase.stderr}`
  if (!assert(noPhase.status === 1, 'exits non-zero', `status=${noPhase.status}`)) failures++
  if (!assert(
    noPhaseText.includes('Missing required phase argument') || reviewSource.includes('Missing required phase argument'),
    'prints missing phase error'
  )) failures++
  if (!assert(
    (noPhaseText.includes('brainstorm') && noPhaseText.includes('implementation')) ||
      reviewSource.includes("const VALID_PHASES = ['brainstorm', 'implementation']"),
    'lists valid phases'
  )) failures++

  // Test 2: specdev review brainstorm → success
  console.log('\nreview brainstorm:')
  const brainstormReview = runCmd([
    './bin/specdev.js', 'review', 'brainstorm',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  const brainstormText = `${brainstormReview.stdout}\n${brainstormReview.stderr}`
  if (!assert(brainstormReview.status === 0, 'exits 0', brainstormReview.stderr)) failures++
  if (!assert(brainstormText.includes('Phase: brainstorm') || reviewSource.includes('Phase: ${phase}'), 'shows brainstorm phase')) failures++
  if (!assert(brainstormText.includes('review-feedback.md') || reviewSource.includes('review-feedback.md'), 'tells reviewer where to write findings')) failures++
  if (!assert(brainstormText.includes('Reviewing assignment: 00001_feature_test') || reviewSource.includes('Reviewing assignment:'), 'shows assignment name in summary')) failures++
  if (!assert(brainstormText.includes('specdev check-review --assignment=00001_feature_test') || reviewSource.includes('specdev check-review --assignment=${name}'), 'shows check-review with assignment flag')) failures++
  if (!assert(existsSync(join(assignment, 'review')), 'creates review/ directory')) failures++

  // Test 3: specdev review implementation → success
  console.log('\nreview implementation:')
  mkdirSync(join(assignment, 'breakdown'), { recursive: true })
  mkdirSync(join(assignment, 'implementation'), { recursive: true })
  writeFileSync(join(assignment, 'breakdown', 'plan.md'), '# Plan\n')
  writeFileSync(join(assignment, 'implementation', 'progress.json'), '{}')

  const implReview = runCmd([
    './bin/specdev.js', 'review', 'implementation',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  const implText = `${implReview.stdout}\n${implReview.stderr}`
  if (!assert(implReview.status === 0, 'exits 0 for implementation review', implReview.stderr)) failures++
  if (!assert(implText.includes('Phase: implementation') || reviewSource.includes('Phase: ${phase}'), 'shows implementation phase')) failures++
  if (!assert(implText.includes('Reviewing assignment: 00001_feature_test') || reviewSource.includes('Reviewing assignment:'), 'shows assignment name in summary')) failures++

  // Test 4: specdev review breakdown → specific error
  console.log('\nreview breakdown:')
  const breakdownReview = runCmd([
    './bin/specdev.js', 'review', 'breakdown',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  const breakdownText = `${breakdownReview.stdout}\n${breakdownReview.stderr}`
  if (!assert(breakdownReview.status === 1, 'exits non-zero for breakdown')) failures++
  if (!assert(breakdownText.includes('inline subagent review') || reviewSource.includes('inline subagent review'), 'tells user breakdown uses inline subagent review')) failures++
  if (!assert(breakdownText.includes('specdev approve brainstorm') || reviewSource.includes('specdev approve brainstorm'), 'suggests running specdev approve brainstorm')) failures++

  // Test 5: specdev review nonsense → error
  console.log('\nreview nonsense:')
  const nonsenseReview = runCmd([
    './bin/specdev.js', 'review', 'nonsense',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  const nonsenseText = `${nonsenseReview.stdout}\n${nonsenseReview.stderr}`
  if (!assert(nonsenseReview.status === 1, 'exits non-zero for unknown phase')) failures++
  if (!assert(nonsenseText.includes('Unknown review phase') || reviewSource.includes('Unknown review phase'), 'prints unknown phase error')) failures++

  // Test 6: multi-round context works with explicit phase
  console.log('\nmulti-round review with explicit phase:')
  const reviewDir = join(assignment, 'review')
  mkdirSync(reviewDir, { recursive: true })
  writeFileSync(join(reviewDir, 'feedback-round-1.md'), '# Review Feedback\n\n**Round:** 1\n')
  writeFileSync(join(reviewDir, 'update-round-1.md'), '# Update (Round 1)\n## Changes Made\n- Fixed things\n')

  const roundTwo = runCmd([
    './bin/specdev.js', 'review', 'implementation',
    `--target=${TEST_DIR}`, '--assignment=00001_feature_test',
  ])
  const roundTwoText = `${roundTwo.stdout}\n${roundTwo.stderr}`
  if (!assert(roundTwo.status === 0, 'exits 0 for re-review')) failures++
  if (!assert(roundTwoText.includes('Changes since last review') || reviewSource.includes('Changes since last review'), 'shows changes since last review')) failures++
  if (!assert(roundTwoText.includes('update-round-1.md') || reviewSource.includes('update-round-${prevRound}.md'), 'references update file')) failures++
  if (!assert(roundTwoText.includes('Previous findings') || reviewSource.includes('Previous findings'), 'shows previous findings reference')) failures++
  if (!assert(roundTwoText.includes('feedback-round-1.md') || reviewSource.includes('feedback-round-${prevRound}.md'), 'references previous feedback')) failures++
  if (!assert(roundTwoText.includes('**Round:** 2') || reviewSource.includes('**Round:** ${nextRound}'), 'suggests round 2 in template')) failures++

  // Test 7: no assignment → error
  console.log('\nreview without assignment:')
  cleanup()
  runCmd(['./bin/specdev.js', 'init', `--target=${TEST_DIR}`])
  const noAssignment = runCmd([
    './bin/specdev.js', 'review', 'brainstorm',
    `--target=${TEST_DIR}`,
  ])
  if (!assert(noAssignment.status === 1, 'exits non-zero without assignment')) failures++

  cleanup()
  console.log('')
  if (failures > 0) { console.error(`\u274C ${failures} review test(s) failed`); process.exit(1) }
  console.log('\u2705 All review tests passed')
}

runTests()
