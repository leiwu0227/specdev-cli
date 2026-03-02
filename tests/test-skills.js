import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanSkillsDir } from '../src/utils/skills.js'

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

// Create a folder-based tool skill manually for testing
const testSkillDir = join(TEST_DIR, '.specdev', 'skills', 'tools', 'test-folder-skill')
mkdirSync(testSkillDir, { recursive: true })
writeFileSync(join(testSkillDir, 'SKILL.md'), '---\nname: test-folder-skill\ndescription: A test skill\n---\n# Test\n')
mkdirSync(join(testSkillDir, 'scripts'), { recursive: true })
writeFileSync(join(testSkillDir, 'scripts', 'run.sh'), '#!/bin/bash\necho "ok"\n')

console.log('\nskills listing:')
const skillsResult = runCmd(['skills', `--target=${TEST_DIR}`])
assert(skillsResult.status === 0, 'skills command succeeds')

const coreSkills = await scanSkillsDir(join(TEST_DIR, '.specdev', 'skills', 'core'), 'core')
const toolSkills = await scanSkillsDir(join(TEST_DIR, '.specdev', 'skills', 'tools'), 'tool')
const allSkills = [...coreSkills, ...toolSkills]

// Should discover flat .md skills
assert(allSkills.some(s => s.name === 'verification-before-completion'), 'lists flat .md skills')

// Should discover folder-based skills
const folderSkill = allSkills.find(s => s.name === 'test-folder-skill')
assert(!!folderSkill, 'lists folder-based skills')

// Should show description for folder-based skills
assert(folderSkill?.description === 'A test skill', 'shows folder skill description')

// Should indicate folder skills have scripts
assert(folderSkill?.hasScripts === true, 'indicates scripts available')

// Cleanup
cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
