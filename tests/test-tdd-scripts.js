import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPTS_DIR = join(__dirname, '..', 'templates', '.specdev', 'skills', 'core', 'test-driven-development', 'scripts')
const TEST_DIR = join(__dirname, 'test-tdd-output')

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

// Setup: create a fake project with a test script
cleanup()
mkdirSync(join(TEST_DIR, 'src'), { recursive: true })
writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({
  name: 'test-tdd-project',
  version: '1.0.0',
  scripts: {
    test: 'echo "all tests passed" && exit 0'
  }
}))
writeFileSync(join(TEST_DIR, 'src', 'index.js'), 'console.log("hello")')

// ---- Test verify-tests.sh ----
console.log('\nverify-tests.sh:')

const script = join(SCRIPTS_DIR, 'verify-tests.sh')

// Test with auto-detected test command (npm test)
const result = spawnSync('bash', [script, TEST_DIR], { encoding: 'utf-8' })
assert(result.status === 0, 'exits with code 0')

let output
try {
  output = JSON.parse(result.stdout)
  assert(true, 'outputs valid JSON')
} catch (e) {
  assert(false, 'outputs valid JSON — got: ' + result.stdout.substring(0, 100))
  output = {}
}

assert(output.passed === true, 'reports tests passed')
assert(output.exit_code === 0, 'exit_code is 0')
assert(output.command === 'npm test', 'auto-detects npm test command')
assert(typeof output.output_summary === 'string', 'includes output_summary')

// Test with explicit test command
const explicitResult = spawnSync('bash', [script, TEST_DIR, 'echo hello'], { encoding: 'utf-8' })
assert(explicitResult.status === 0, 'exits 0 with explicit command')

let explicitOutput
try {
  explicitOutput = JSON.parse(explicitResult.stdout)
  assert(explicitOutput.command === 'echo hello', 'uses explicit command')
} catch (e) {
  assert(false, 'explicit command outputs valid JSON')
}

// Test with failing test command
const failProject = join(TEST_DIR, 'fail-project')
mkdirSync(failProject, { recursive: true })
writeFileSync(join(failProject, 'package.json'), JSON.stringify({
  name: 'fail-project',
  scripts: { test: 'echo "test failed" && exit 1' }
}))

const failResult = spawnSync('bash', [script, failProject], { encoding: 'utf-8' })
assert(failResult.status === 0, 'exits 0 even when tests fail (status in JSON)')

let failOutput
try {
  failOutput = JSON.parse(failResult.stdout)
  assert(failOutput.passed === false, 'reports tests failed')
  assert(failOutput.exit_code === 1, 'exit_code is 1 for failing tests')
} catch (e) {
  assert(false, 'failing test outputs valid JSON')
}

// Test with missing project root
const badResult = spawnSync('bash', [script, '/nonexistent'], { encoding: 'utf-8' })
assert(badResult.status !== 0, 'exits non-zero for missing directory')

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
