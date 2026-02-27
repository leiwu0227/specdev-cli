import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-skills-sync-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function runCmd(args) {
  return spawnSync('node', [CLI, ...args], { encoding: 'utf-8' })
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true }) }

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
mkdirSync(join(TEST_DIR, '.claude', 'skills'), { recursive: true })

// Install fireperp
runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=fireperp', '--agents=claude-code'])

// Delete the wrapper manually to simulate drift
rmSync(join(TEST_DIR, '.claude', 'skills', 'fireperp.md'))

// Sync should regenerate missing wrapper
console.log('\nskills sync — regenerate missing wrapper:')
let result = runCmd(['skills', 'sync', `--target=${TEST_DIR}`])
assert(result.status === 0, 'sync succeeds')
assert(existsSync(join(TEST_DIR, '.claude', 'skills', 'fireperp.md')), 'wrapper regenerated')

// Delete the tool skill directory to simulate stale entry
rmSync(join(TEST_DIR, '.specdev', 'skills', 'tools', 'fireperp'), { recursive: true })

// Sync should remove stale entry
console.log('\nskills sync — remove stale entry:')
result = runCmd(['skills', 'sync', `--target=${TEST_DIR}`])
assert(result.status === 0, 'sync succeeds on stale')
assert(!existsSync(join(TEST_DIR, '.claude', 'skills', 'fireperp.md')), 'stale wrapper removed')
const activeTools = JSON.parse(readFileSync(join(TEST_DIR, '.specdev', 'skills', 'active-tools.json'), 'utf-8'))
assert(activeTools.tools.fireperp === undefined, 'stale entry removed from active-tools.json')

// Add a new tool skill that isn't installed — sync should warn
console.log('\nskills sync — warn about available:')
const newToolDir = join(TEST_DIR, '.specdev', 'skills', 'tools', 'my-tool')
mkdirSync(newToolDir, { recursive: true })
writeFileSync(join(newToolDir, 'SKILL.md'), '---\nname: my-tool\ndescription: test\n---\n# my-tool\n')
result = runCmd(['skills', 'sync', `--target=${TEST_DIR}`])
assert(result.stdout.includes('my-tool') || result.stderr.includes('my-tool'), 'warns about available tool')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
