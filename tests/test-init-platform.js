import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-init-platform-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) {
    console.error(`  ❌ ${msg}`)
    failures++
  } else {
    console.log(`  ✓ ${msg}`)
    passes++
  }
}

function runCmd(args) {
  return spawnSync('node', [CLI, ...args], { encoding: 'utf-8' })
}

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
}

// ---- Test default init (should generate AGENTS.md) ----
console.log('\ndefault init (generic):')
cleanup()
let result = runCmd(['init', `--target=${TEST_DIR}`])
assert(result.status === 0, 'init succeeds')
assert(existsSync(join(TEST_DIR, '.specdev', '_main.md')), '.specdev created')
assert(existsSync(join(TEST_DIR, 'AGENTS.md')), 'creates AGENTS.md by default')
const agentsMd = readFileSync(join(TEST_DIR, 'AGENTS.md'), 'utf-8')
assert(agentsMd.includes('.specdev/_main.md'), 'AGENTS.md points to _main.md')

// ---- Test --platform=claude ----
console.log('\n--platform=claude:')
cleanup()
result = runCmd(['init', `--target=${TEST_DIR}`, '--platform=claude'])
assert(result.status === 0, 'init with --platform=claude succeeds')
assert(existsSync(join(TEST_DIR, 'CLAUDE.md')), 'creates CLAUDE.md')
const claudeMd = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')
assert(claudeMd.includes('.specdev/_main.md'), 'CLAUDE.md points to _main.md')
assert(!existsSync(join(TEST_DIR, 'AGENTS.md')), 'does NOT create AGENTS.md when platform=claude')

// ---- Test --platform=codex ----
console.log('\n--platform=codex:')
cleanup()
result = runCmd(['init', `--target=${TEST_DIR}`, '--platform=codex'])
assert(result.status === 0, 'init with --platform=codex succeeds')
assert(existsSync(join(TEST_DIR, 'AGENTS.md')), 'creates AGENTS.md for codex')

// ---- Test --platform=cursor ----
console.log('\n--platform=cursor:')
cleanup()
result = runCmd(['init', `--target=${TEST_DIR}`, '--platform=cursor'])
assert(result.status === 0, 'init with --platform=cursor succeeds')
assert(existsSync(join(TEST_DIR, '.cursor', 'rules')), 'creates .cursor/rules')
const cursorRules = readFileSync(join(TEST_DIR, '.cursor', 'rules'), 'utf-8')
assert(cursorRules.includes('.specdev/_main.md'), '.cursor/rules points to _main.md')

// ---- Test adapter does NOT overwrite existing file ----
console.log('\nno-overwrite:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`, '--platform=claude'])
const originalContent = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')
const modified = originalContent + '\n# My custom rules\n'
writeFileSync(join(TEST_DIR, 'CLAUDE.md'), modified)
// Re-init with force (should update .specdev but preserve adapter)
result = runCmd(['init', `--target=${TEST_DIR}`, '--platform=claude', '--force'])
const afterForce = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')
assert(afterForce.includes('My custom rules'), 'preserves existing adapter content on --force')

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
