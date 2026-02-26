import { mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { cleanupDir, runSpecdev, assertTest } from './helpers.js'

const TEST_DIR = './test-apply-capture-output'

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

  runCmd(['init', `--target=${TEST_DIR}`])
  const assignment = join(TEST_DIR, '.specdev/assignments/00001_feature_capture')
  mkdirSync(join(assignment, 'capture'), { recursive: true })
  writeFileSync(
    join(assignment, 'capture', 'project-notes-diff.md'),
    [
      '# Project Notes Diff',
      '',
      '## Gaps Found',
      '- Missing architecture note for actor lifecycle.',
      'Consider adding a migration note (not a bullet and should be ignored).',
      '- feature_descriptions.md does not explain job queue retries.',
      '',
      '## No Changes Needed',
      '- Existing naming conventions are clear.',
      '',
    ].join('\n'),
    'utf-8'
  )

  console.log('apply-capture applies selected file:')
  const apply = runCmd([
    'apply-capture',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_capture',
    '--file=feature_descriptions',
    '--yes',
  ])
  if (!assert(apply.status === 0, 'apply-capture exits 0', apply.stderr)) failures++

  const featurePath = join(TEST_DIR, '.specdev/project_notes/feature_descriptions.md')
  const featureContent = readFileSync(featurePath, 'utf-8')
  if (!assert(featureContent.includes('Capture Updates — 00001_feature_capture'), 'writes section header')) failures++
  if (!assert(featureContent.includes('actor lifecycle'), 'writes first gap bullet')) failures++
  if (!assert(featureContent.includes('job queue retries'), 'writes second gap bullet')) failures++
  if (!assert(!featureContent.includes('not a bullet and should be ignored'), 'does not capture non-bullet gap text')) failures++

  console.log('\napply-capture dedupes repeated application:')
  const applyAgain = runCmd([
    'apply-capture',
    `--target=${TEST_DIR}`,
    '--assignment=00001_feature_capture',
    '--file=feature_descriptions',
    '--yes',
  ])
  if (!assert(applyAgain.status === 0, 'second apply-capture exits 0', applyAgain.stderr)) failures++
  const featureContent2 = readFileSync(featurePath, 'utf-8')
  const actorMatches = (featureContent2.match(/actor lifecycle/g) || []).length
  const retryMatches = (featureContent2.match(/job queue retries/g) || []).length
  if (!assert(actorMatches === 1, 'first gap bullet not duplicated')) failures++
  if (!assert(retryMatches === 1, 'second gap bullet not duplicated')) failures++

  console.log('\napply-capture rejects missing diff:')
  const noDiff = runCmd(['apply-capture', `--target=${TEST_DIR}`, '--assignment=00001_feature_missing', '--yes'])
  if (!assert(noDiff.status === 1, 'missing assignment/diff exits non-zero')) failures++

  cleanup()
  console.log('')
  if (failures > 0) { console.error(`❌ ${failures} apply-capture test(s) failed`); process.exit(1) }
  console.log('✅ All apply-capture tests passed')
}

runTests()
