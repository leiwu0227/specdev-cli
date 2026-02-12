import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPTS_DIR = join(__dirname, '..', 'templates', '.specdev', 'skills', 'planning', 'scripts')
const TEST_DIR = join(__dirname, 'test-planning-output')

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

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
}

// Setup: create a fake project
cleanup()
mkdirSync(join(TEST_DIR, '.specdev', 'knowledge', 'project'), { recursive: true })
mkdirSync(join(TEST_DIR, '.specdev', 'knowledge', 'workflow'), { recursive: true })
mkdirSync(join(TEST_DIR, '.specdev', 'state', 'assignments'), { recursive: true })
mkdirSync(join(TEST_DIR, 'src'), { recursive: true })
writeFileSync(join(TEST_DIR, 'package.json'), '{"name": "test-project", "version": "1.0.0"}')
writeFileSync(join(TEST_DIR, 'src', 'index.js'), 'console.log("hello")')
writeFileSync(join(TEST_DIR, '.specdev', 'knowledge', 'project', 'architecture.md'), '# Architecture\nUses MVC pattern.')

// Init git repo for commit history
spawnSync('git', ['init'], { cwd: TEST_DIR })
spawnSync('git', ['add', '.'], { cwd: TEST_DIR })
spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@test.com', 'commit', '-m', 'init'], { cwd: TEST_DIR })

// ---- Test get-project-context.sh ----
console.log('\nget-project-context.sh:')

const script = join(SCRIPTS_DIR, 'get-project-context.sh')
const result = spawnSync('bash', [script, TEST_DIR], { encoding: 'utf-8' })

assert(result.status === 0, 'exits with code 0')
assert(result.stdout.includes('test-project'), 'includes project name from package.json')
assert(result.stdout.includes('src/index.js') || result.stdout.includes('src/'), 'includes file structure')
assert(result.stdout.includes('Architecture') || result.stdout.includes('MVC'), 'includes knowledge content')
assert(result.stdout.includes('init'), 'includes recent commit history')

// Test with missing project root
const badResult = spawnSync('bash', [script, '/nonexistent'], { encoding: 'utf-8' })
assert(badResult.status !== 0, 'exits non-zero for missing directory')

// ---- Additional test sections will be appended here (tasks 4-6) ----

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
