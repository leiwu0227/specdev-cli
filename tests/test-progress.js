import { mkdirSync, writeFileSync } from 'fs'
import { readFileSync } from 'fs'
import { join } from 'path'
import { cleanupDir, runSpecdev, assertTest } from './helpers.js'

const TEST_DIR = './test-progress-output'

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
  const assignment = join(TEST_DIR, '.specdev/assignments/00001_feature_test')
  mkdirSync(join(assignment, 'breakdown'), { recursive: true })
  writeFileSync(
    join(assignment, 'breakdown', 'plan.md'),
    '# Plan\n\n### Task 1: Alpha\n- Create: `a.txt`\n\n### Task 2: Beta\n- Create: `b.txt`\n'
  )

  console.log('progress summary:')
  const summary = runCmd(['progress', 'summary', `--target=${TEST_DIR}`, '--assignment=00001_feature_test'])
  if (!assert(summary.status === 0, 'summary exits 0', summary.stderr)) failures++
  const progressPath = join(assignment, 'implementation', 'progress.json')
  const p1 = JSON.parse(readFileSync(progressPath, 'utf-8'))
  if (!assert(p1.total_tasks === 2, 'summary initializes progress with 2 tasks')) failures++

  console.log('\nprogress task update:')
  const started = runCmd(['progress', '1', 'started', `--target=${TEST_DIR}`, '--assignment=00001_feature_test'])
  if (!assert(started.status === 0, 'started exits 0', started.stderr)) failures++
  const completed = runCmd(['progress', '1', 'completed', `--target=${TEST_DIR}`, '--assignment=00001_feature_test'])
  if (!assert(completed.status === 0, 'completed exits 0', completed.stderr)) failures++

  const summary2 = runCmd(['progress', 'summary', `--target=${TEST_DIR}`, '--assignment=00001_feature_test'])
  if (!assert(summary2.status === 0, 'post-update summary exits 0', summary2.stderr)) failures++
  const p2 = JSON.parse(readFileSync(progressPath, 'utf-8'))
  const task1 = p2.tasks.find((t) => t.number === 1)
  if (!assert(task1 && task1.status === 'completed', 'progress file reflects task 1 completion')) failures++

  console.log('\nprogress bad args:')
  const bad = runCmd(['progress', 'foo', 'started', `--target=${TEST_DIR}`, '--assignment=00001_feature_test'])
  if (!assert(bad.status === 1, 'bad task number exits non-zero')) failures++

  cleanup()
  console.log('')
  if (failures > 0) { console.error(`❌ ${failures} progress test(s) failed`); process.exit(1) }
  console.log('✅ All progress tests passed')
}

runTests()
