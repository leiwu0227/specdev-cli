import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { assertTest, runSpecdev } from './helpers.js'

const TEST_DIR = join('/tmp', 'specdev-test-current')

function setup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
  mkdirSync(join(TEST_DIR, '.specdev', 'assignments', '00001_feature_auth'), { recursive: true })
  mkdirSync(join(TEST_DIR, '.specdev', 'assignments', '00002_bugfix_login'), { recursive: true })
}

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
}

async function main() {
  console.log('test-current.js')

  const { readCurrent, writeCurrent, clearCurrent, resolveCurrentAssignment } = await import('../src/utils/current.js')

  // Test 1: readCurrent returns null when .current doesn't exist
  setup()
  let result = await readCurrent(join(TEST_DIR, '.specdev'))
  let ok = assertTest(result === null, 'readCurrent returns null when .current missing')

  // Test 2: writeCurrent writes and readCurrent reads back
  await writeCurrent(join(TEST_DIR, '.specdev'), '00001_feature_auth')
  result = await readCurrent(join(TEST_DIR, '.specdev'))
  ok = assertTest(result === '00001_feature_auth', 'writeCurrent/readCurrent round-trip') && ok

  // Test 3: clearCurrent removes the file
  await clearCurrent(join(TEST_DIR, '.specdev'))
  result = await readCurrent(join(TEST_DIR, '.specdev'))
  ok = assertTest(result === null, 'clearCurrent removes .current') && ok

  // Test 4: readCurrent returns null for empty file
  writeFileSync(join(TEST_DIR, '.specdev', '.current'), '', 'utf-8')
  result = await readCurrent(join(TEST_DIR, '.specdev'))
  ok = assertTest(result === null, 'readCurrent returns null for empty file') && ok

  // Test 5: readCurrent trims whitespace
  writeFileSync(join(TEST_DIR, '.specdev', '.current'), '  00001_feature_auth  \n', 'utf-8')
  result = await readCurrent(join(TEST_DIR, '.specdev'))
  ok = assertTest(result === '00001_feature_auth', 'readCurrent trims whitespace') && ok

  // Test 6: resolveCurrentAssignment returns path when .current is valid
  await writeCurrent(join(TEST_DIR, '.specdev'), '00001_feature_auth')
  const resolved = await resolveCurrentAssignment(join(TEST_DIR, '.specdev'))
  ok = assertTest(resolved !== null && resolved.name === '00001_feature_auth', 'resolveCurrentAssignment resolves valid .current') && ok

  // Test 7: resolveCurrentAssignment returns error for stale pointer
  await writeCurrent(join(TEST_DIR, '.specdev'), '00099_gone_deleted')
  const stale = await resolveCurrentAssignment(join(TEST_DIR, '.specdev'))
  ok = assertTest(stale !== null && stale.error === 'stale', 'resolveCurrentAssignment detects stale pointer') && ok
  result = await readCurrent(join(TEST_DIR, '.specdev'))
  ok = assertTest(result === null, 'resolveCurrentAssignment clears stale pointer') && ok

  // Test 8: resolveCurrentAssignment returns error when .current missing
  const missing = await resolveCurrentAssignment(join(TEST_DIR, '.specdev'))
  ok = assertTest(missing !== null && missing.error === 'missing', 'resolveCurrentAssignment returns missing error') && ok

  // Test 9: command reads .current when set (integration)
  setup()
  mkdirSync(join(TEST_DIR, '.specdev', 'assignments', '00001_feature_auth', 'brainstorm'), { recursive: true })
  writeFileSync(join(TEST_DIR, '.specdev', 'assignments', '00001_feature_auth', 'brainstorm', 'proposal.md'), 'Test proposal with enough content to pass check', 'utf-8')
  writeFileSync(join(TEST_DIR, '.specdev', 'assignments', '00001_feature_auth', 'brainstorm', 'design.md'), '## Overview\n\nTest design\n\n## Goals\n\nTest\n\n## Non-Goals\n\nTest\n\n## Design\n\nTest\n\n## Success Criteria\n\nTest', 'utf-8')
  writeFileSync(join(TEST_DIR, '.specdev', '.current'), '00001_feature_auth', 'utf-8')
  {
    const r = runSpecdev(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`])
    ok = assertTest(r.status === 0, 'checkpoint reads .current and succeeds', r.stderr) && ok
    ok = assertTest(r.stdout.includes('00001_feature_auth'), 'checkpoint output shows correct assignment') && ok
  }
  cleanup()

  // Test 10: command errors when .current not set (integration)
  setup()
  {
    const r = runSpecdev(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`])
    ok = assertTest(r.status !== 0, 'checkpoint errors without .current') && ok
    ok = assertTest(r.stderr.includes('focus') || r.stderr.includes('No active'), 'error message mentions focus', r.stderr) && ok
  }
  cleanup()

  if (!ok) process.exit(1)
}

main()
