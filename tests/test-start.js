import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'

const TEST_DIR = './test-start-output'

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
}

function runCmd(args) {
  return spawnSync('node', args, { encoding: 'utf-8' })
}

function assert(condition, msg, detail = '') {
  if (!condition) {
    console.error(`  ❌ ${msg}`)
    if (detail) console.error(`     ${detail}`)
    return false
  }
  console.log(`  ✓ ${msg}`)
  return true
}

async function runTests() {
  let failures = 0
  cleanup()

  // Test 1: fails without .specdev
  console.log('start without .specdev:')
  mkdirSync(TEST_DIR, { recursive: true })
  const noSpecdev = runCmd(['./bin/specdev.js', 'start', `--target=${TEST_DIR}`])
  if (!assert(noSpecdev.status === 1, 'exits non-zero without .specdev')) failures++

  // Test 2: detects empty/template big_picture.md
  console.log('\nstart with template big_picture:')
  const init = runCmd(['./bin/specdev.js', 'init', `--target=${TEST_DIR}`])
  if (init.status !== 0) { console.error('setup failed'); process.exit(1) }

  const startTemplate = runCmd(['./bin/specdev.js', 'start', `--target=${TEST_DIR}`])
  if (!assert(startTemplate.status === 0, 'exits 0 with template big_picture')) failures++

  // Test 3: shows content when big_picture.md is filled
  console.log('\nstart with filled big_picture:')
  const bigPicturePath = join(TEST_DIR, '.specdev/project_notes/big_picture.md')
  writeFileSync(bigPicturePath, '# Project Big Picture\n\n## Overview\nThis is a real project with real content that has been filled in properly.\n\n## Tech Stack\nNode.js, TypeScript\n')
  const startFilled = runCmd(['./bin/specdev.js', 'start', `--target=${TEST_DIR}`])
  if (!assert(startFilled.status === 0, 'exits 0 with filled big_picture')) failures++

  cleanup()
  console.log('')
  if (failures > 0) { console.error(`❌ ${failures} start test(s) failed`); process.exit(1) }
  console.log('✅ All start tests passed')
}

runTests()
