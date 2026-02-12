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

// ---- Test scaffold-plan.sh ----
console.log('\nscaffold-plan.sh:')

const scaffoldScript = join(SCRIPTS_DIR, 'scaffold-plan.sh')

// Create docs/plans directory
mkdirSync(join(TEST_DIR, 'docs', 'plans'), { recursive: true })

const scaffoldResult = spawnSync('bash', [scaffoldScript, 'my-feature', TEST_DIR], { encoding: 'utf-8' })

assert(scaffoldResult.status === 0, 'exits with code 0')

// Check the file was created with today's date
const today = new Date().toISOString().split('T')[0]
const expectedFile = join(TEST_DIR, 'docs', 'plans', `${today}-my-feature.md`)
assert(existsSync(expectedFile), 'creates plan file with date prefix')

const planContent = readFileSync(expectedFile, 'utf-8')
assert(planContent.includes('Implementation Plan'), 'includes plan header')
assert(planContent.includes('specdev:executing'), 'includes execution instruction')
assert(planContent.includes('**Goal:**'), 'includes goal placeholder')
assert(planContent.includes('### Task 1:'), 'includes task template')
assert(planContent.includes('**Step 1: Write the failing test**'), 'includes TDD step template')

// Outputs the file path
assert(scaffoldResult.stdout.includes(expectedFile) || scaffoldResult.stdout.includes(`${today}-my-feature.md`), 'outputs created file path')

// Fails if plan already exists (no overwrite)
const scaffoldAgain = spawnSync('bash', [scaffoldScript, 'my-feature', TEST_DIR], { encoding: 'utf-8' })
assert(scaffoldAgain.status !== 0, 'refuses to overwrite existing plan')

// ---- Additional test sections will be appended here (tasks 5-6) ----

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
