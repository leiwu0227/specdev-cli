import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-skills-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) {
    console.error(`  FAIL ${msg}`)
    failures++
  } else {
    console.log(`  PASS ${msg}`)
    passes++
  }
}

function runCmd(args) {
  return spawnSync('node', [CLI, ...args], { encoding: 'utf-8' })
}

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
}

// Setup
cleanup()

// Init a project
const initResult = runCmd(['init', `--target=${TEST_DIR}`])
assert(initResult.status === 0, 'init succeeds')

// Create a folder-based skill manually for testing
const testSkillDir = join(TEST_DIR, '.specdev', 'skills', 'test-folder-skill')
mkdirSync(testSkillDir, { recursive: true })
writeFileSync(join(testSkillDir, 'SKILL.md'), '---\nname: test-folder-skill\ndescription: A test skill\n---\n# Test\n')
mkdirSync(join(testSkillDir, 'scripts'), { recursive: true })
writeFileSync(join(testSkillDir, 'scripts', 'run.sh'), '#!/bin/bash\necho "ok"\n')

console.log('\nskills listing:')
const skillsResult = runCmd(['skills', `--target=${TEST_DIR}`])
assert(skillsResult.status === 0, 'skills command succeeds')

// Should list flat .md skills
assert(skillsResult.stdout.includes('verification-before-completion'), 'lists flat .md skills')

// Should list folder-based skills
assert(skillsResult.stdout.includes('test-folder-skill'), 'lists folder-based skills')

// Should show description for folder-based skills
assert(skillsResult.stdout.includes('A test skill'), 'shows folder skill description')

// Should indicate folder skills have scripts
assert(skillsResult.stdout.includes('scripts'), 'indicates scripts available')

// Cleanup
cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
