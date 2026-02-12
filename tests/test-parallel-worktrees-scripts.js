import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPTS_DIR = join(__dirname, '..', 'templates', '.specdev', 'skills', 'parallel-worktrees', 'scripts')
const TEST_DIR = join(__dirname, 'test-parallel-worktrees-output')
const WORKTREES_DIR = join(__dirname, 'test-parallel-worktrees-output-worktrees')

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
  // Remove worktrees first (must be done from the main repo)
  if (existsSync(TEST_DIR)) {
    spawnSync('git', ['worktree', 'prune'], { cwd: TEST_DIR })
  }
  if (existsSync(WORKTREES_DIR)) rmSync(WORKTREES_DIR, { recursive: true })
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
}

// Setup: create a real git repo
cleanup()
mkdirSync(join(TEST_DIR, 'src'), { recursive: true })
writeFileSync(join(TEST_DIR, 'package.json'), '{"name": "worktree-test"}')
writeFileSync(join(TEST_DIR, 'src', 'index.js'), 'console.log("hello")')

spawnSync('git', ['init'], { cwd: TEST_DIR })
spawnSync('git', ['add', '.'], { cwd: TEST_DIR })
spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@test.com', 'commit', '-m', 'init'], { cwd: TEST_DIR })

// ---- Test setup-worktree.sh ----
console.log('\nsetup-worktree.sh:')

const script = join(SCRIPTS_DIR, 'setup-worktree.sh')

// Create a worktree
const result = spawnSync('bash', [script, TEST_DIR, 'task-one'], { encoding: 'utf-8' })
assert(result.status === 0, 'exits with code 0')

let output
try {
  output = JSON.parse(result.stdout)
  assert(true, 'outputs valid JSON')
} catch (e) {
  assert(false, 'outputs valid JSON — got: ' + result.stdout.substring(0, 100))
  output = {}
}

assert(output.task_name === 'task-one', 'has correct task_name')
assert(output.branch === 'worktree/task-one', 'has correct branch name')
assert(typeof output.worktree_path === 'string' && output.worktree_path.length > 0, 'has worktree_path')
assert(typeof output.base_branch === 'string' && output.base_branch.length > 0, 'has base_branch')

// Verify worktree exists
if (output.worktree_path) {
  assert(existsSync(output.worktree_path), 'worktree directory exists')
  assert(existsSync(join(output.worktree_path, 'package.json')), 'worktree has project files')
}

// Test with missing project root
const badResult = spawnSync('bash', [script, '/nonexistent', 'task-two'], { encoding: 'utf-8' })
assert(badResult.status !== 0, 'exits non-zero for missing directory')

// Test with missing task name
const noTask = spawnSync('bash', [script, TEST_DIR], { encoding: 'utf-8' })
assert(noTask.status !== 0, 'exits non-zero for missing task name')

// Cleanup: remove worktree
if (output.worktree_path && existsSync(output.worktree_path)) {
  spawnSync('git', ['worktree', 'remove', output.worktree_path, '--force'], { cwd: TEST_DIR })
}

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
