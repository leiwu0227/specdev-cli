import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { runSpecdev, assertTest } from './helpers.js'

const TEST_DIR = join('/tmp', 'specdev-test-focus')

function setup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
  mkdirSync(join(TEST_DIR, '.specdev', 'assignments', '00001_feature_auth'), { recursive: true })
  mkdirSync(join(TEST_DIR, '.specdev', 'assignments', '00002_bugfix_login'), { recursive: true })
  mkdirSync(join(TEST_DIR, '.specdev', 'project_notes'), { recursive: true })
  writeFileSync(join(TEST_DIR, '.specdev', 'project_notes', 'big_picture.md'), 'This is a test project with sufficient content to pass the filled check.', 'utf-8')
}

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
}

function main() {
  console.log('test-focus.js')
  setup()

  // Test 1: specdev focus 1 sets .current
  let r = runSpecdev(['focus', '1', `--target=${TEST_DIR}`])
  let ok = assertTest(r.status === 0, 'focus 1 exits 0', r.stderr)
  const current = readFileSync(join(TEST_DIR, '.specdev', '.current'), 'utf-8')
  ok = assertTest(current === '00001_feature_auth', 'focus 1 writes correct assignment to .current') && ok

  // Test 2: specdev focus 2 switches .current
  r = runSpecdev(['focus', '2', `--target=${TEST_DIR}`])
  ok = assertTest(r.status === 0, 'focus 2 exits 0', r.stderr) && ok
  const current2 = readFileSync(join(TEST_DIR, '.specdev', '.current'), 'utf-8')
  ok = assertTest(current2 === '00002_bugfix_login', 'focus 2 writes correct assignment') && ok

  // Test 3: specdev focus --clear removes .current
  r = runSpecdev(['focus', '--clear', `--target=${TEST_DIR}`])
  ok = assertTest(r.status === 0, 'focus --clear exits 0', r.stderr) && ok
  ok = assertTest(!existsSync(join(TEST_DIR, '.specdev', '.current')), 'focus --clear removes .current') && ok

  // Test 4: specdev focus 99 errors for unknown assignment
  r = runSpecdev(['focus', '99', `--target=${TEST_DIR}`])
  ok = assertTest(r.status !== 0, 'focus 99 exits non-zero') && ok
  ok = assertTest(r.stderr.includes('not found') || r.stdout.includes('not found'), 'focus 99 shows not found message') && ok

  // Test 5: specdev focus with no args errors
  r = runSpecdev(['focus', `--target=${TEST_DIR}`])
  ok = assertTest(r.status !== 0, 'focus with no args exits non-zero') && ok

  cleanup()
  if (!ok) process.exit(1)
}

main()
