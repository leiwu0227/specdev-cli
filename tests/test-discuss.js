import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { runSpecdev, assertTest } from './helpers.js'

const TEST_DIR = join('/tmp', 'specdev-test-discuss')

function setup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
  mkdirSync(join(TEST_DIR, '.specdev', 'discussions'), { recursive: true })
  mkdirSync(join(TEST_DIR, '.specdev', 'project_notes'), { recursive: true })
  writeFileSync(join(TEST_DIR, '.specdev', 'project_notes', 'big_picture.md'), 'This is a test project with sufficient content to pass the filled check. It contains enough text to exceed the minimum length requirement for validation.', 'utf-8')
}

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
}

function main() {
  console.log('test-discuss.js')
  setup()

  // Test 1: specdev discussion creates discussion folder
  let r = runSpecdev(['discussion', 'auth ideas', `--target=${TEST_DIR}`, '--json'])
  let ok = assertTest(r.status === 0, 'discussion exits 0', r.stderr)
  const output = JSON.parse(r.stdout)
  ok = assertTest(output.id === 'D0001', 'discussion returns D0001') && ok
  ok = assertTest(existsSync(join(TEST_DIR, '.specdev', 'discussions', 'D0001_auth-ideas', 'brainstorm')), 'discussion creates folder with brainstorm subdir') && ok

  // Test 2: second discussion gets D0002
  r = runSpecdev(['discussion', 'perf tuning', `--target=${TEST_DIR}`, '--json'])
  ok = assertTest(r.status === 0, 'second discussion exits 0', r.stderr) && ok
  const output2 = JSON.parse(r.stdout)
  ok = assertTest(output2.id === 'D0002', 'second discussion returns D0002') && ok

  // Test 3: discussion --list lists discussions
  r = runSpecdev(['discussion', '--list', `--target=${TEST_DIR}`])
  ok = assertTest(r.status === 0, 'discussion --list exits 0', r.stderr) && ok
  ok = assertTest(r.stdout.includes('D0001_auth-ideas'), 'discussion --list shows D0001') && ok
  ok = assertTest(r.stdout.includes('D0002_perf-tuning'), 'discussion --list shows D0002') && ok

  // Test 4: discussion with no description errors
  r = runSpecdev(['discussion', `--target=${TEST_DIR}`])
  ok = assertTest(r.status !== 0, 'discussion with no args exits non-zero') && ok

  cleanup()
  if (!ok) process.exit(1)
}

main()
