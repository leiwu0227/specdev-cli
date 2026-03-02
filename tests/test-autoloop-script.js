import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync, chmodSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT = join(__dirname, '..', 'templates', '.specdev', 'skills', 'tools', 'autoloop', 'scripts', 'autoloop.sh')
const TEST_DIR = join(__dirname, 'test-autoloop-script-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true }) }

function setupReviewerConfig(name, config) {
  const dir = join(TEST_DIR, 'reviewers')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(config), 'utf-8')
}

function setupGitRepo() {
  spawnSync('git', ['init'], { cwd: TEST_DIR })
  spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: TEST_DIR })
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: TEST_DIR })
  writeFileSync(join(TEST_DIR, 'file.js'), 'const x = 1\n')
  spawnSync('git', ['add', '.'], { cwd: TEST_DIR })
  spawnSync('git', ['commit', '-m', 'init'], { cwd: TEST_DIR })
  writeFileSync(join(TEST_DIR, 'file.js'), 'const x = 2\n')
}

function runScript(args) {
  return spawnSync('bash', [SCRIPT, ...args], {
    encoding: 'utf-8',
    cwd: TEST_DIR,
    env: { ...process.env, AUTOLOOP_REVIEWERS_DIR: join(TEST_DIR, 'reviewers') },
  })
}

cleanup()
mkdirSync(TEST_DIR, { recursive: true })

// Test: missing --reviewer flag
console.log('\nautoloop.sh (missing reviewer):')
let result = runScript([])
assert(result.status === 1, 'exits 1 without --reviewer')

// Test: unknown reviewer config
console.log('\nautoloop.sh (unknown reviewer):')
result = runScript(['--reviewer', 'nonexistent', '--round', '1'])
assert(result.status === 1, 'exits 1 for unknown reviewer')
assert(result.stderr.includes('not found'), 'error mentions config not found')

// Test: invalid --round flag
console.log('\nautoloop.sh (invalid round):')
result = runScript(['--reviewer', 'nonexistent', '--round', 'abc'])
assert(result.status === 1, 'exits 1 for non-numeric round')
assert(result.stderr.includes('positive integer'), 'error mentions positive integer round')

// Test: pass verdict
console.log('\nautoloop.sh (pass verdict):')
setupGitRepo()
setupReviewerConfig('echo-pass', {
  name: 'echo-pass',
  command: "echo 'LGTM, code looks good'",
  scope: 'diff',
  max_rounds: 3,
})
result = runScript(['--reviewer', 'echo-pass', '--round', '1'])
assert(result.status === 0, 'exits 0')
let json = JSON.parse(result.stdout)
assert(json.verdict === 'pass', 'verdict is pass')
assert(json.round === 1, 'round is 1')
assert(json.escalate === false, 'escalate is false')

// Test: fail verdict
console.log('\nautoloop.sh (fail verdict):')
setupReviewerConfig('echo-fail', {
  name: 'echo-fail',
  command: "echo 'needs changes: missing error handling'",
  scope: 'diff',
  max_rounds: 3,
})
result = runScript(['--reviewer', 'echo-fail', '--round', '1'])
assert(result.status === 0, 'exits 0')
json = JSON.parse(result.stdout)
assert(json.verdict === 'fail', 'verdict is fail')
assert(json.escalate === false, 'escalate is false on round 1')
assert(json.findings.includes('missing error handling'), 'findings contain reviewer output')

// Test: escalation on max rounds
console.log('\nautoloop.sh (escalation):')
result = runScript(['--reviewer', 'echo-fail', '--round', '3'])
assert(result.status === 0, 'exits 0')
json = JSON.parse(result.stdout)
assert(json.verdict === 'fail', 'verdict is fail')
assert(json.escalate === true, 'escalate is true at max rounds')

// Test: neither pattern matches → defaults to fail
console.log('\nautoloop.sh (ambiguous output):')
setupReviewerConfig('echo-ambiguous', {
  name: 'echo-ambiguous',
  command: "echo 'I have some thoughts about this code'",
  scope: 'diff',
  max_rounds: 3,
})
result = runScript(['--reviewer', 'echo-ambiguous', '--round', '1'])
assert(result.status === 0, 'exits 0')
json = JSON.parse(result.stdout)
assert(json.verdict === 'fail', 'ambiguous defaults to fail')

// Test: custom scope via --context
console.log('\nautoloop.sh (custom context):')
setupReviewerConfig('echo-context', {
  name: 'echo-context',
  command: "echo 'pass'",
  scope: 'custom',
  max_rounds: 3,
})
result = runScript(['--reviewer', 'echo-context', '--round', '1', '--scope', 'custom', '--context', 'some custom code'])
assert(result.status === 0, 'exits 0 with custom context')
json = JSON.parse(result.stdout)
assert(json.verdict === 'pass', 'pass with custom context')

// Test: scope override via flag
console.log('\nautoloop.sh (scope override):')
result = runScript(['--reviewer', 'echo-pass', '--round', '1', '--scope', 'files'])
assert(result.status === 0, 'exits 0 with scope override')
json = JSON.parse(result.stdout)
assert(json.verdict === 'pass', 'pass with files scope')

// Test: reviewer command failure
console.log('\nautoloop.sh (command failure):')
setupReviewerConfig('bad-cmd', {
  name: 'bad-cmd',
  command: 'nonexistent-binary-xyz',
  scope: 'diff',
  max_rounds: 3,
})
result = runScript(['--reviewer', 'bad-cmd', '--round', '1'])
assert(result.status === 1, 'exits 1 when reviewer command fails')

// Test: multi-line reviewer output produces valid JSON
console.log('\nautoloop.sh (multi-line output):')
setupReviewerConfig('multiline', {
  name: 'multiline',
  command: "printf 'line1\\nneeds changes:\\n- fix error handling\\n- add tests'",
  scope: 'diff',
  max_rounds: 3,
})
result = runScript(['--reviewer', 'multiline', '--round', '1'])
assert(result.status === 0, 'exits 0')
json = JSON.parse(result.stdout)
assert(json.verdict === 'fail', 'verdict is fail for multi-line output')
assert(json.findings.includes('fix error handling'), 'findings preserve multi-line content')
assert(json.findings.includes('add tests'), 'findings preserve all lines')

// Test: reviewer output with special JSON characters (double quotes)
console.log('\nautoloop.sh (special JSON chars):')
setupReviewerConfig('json-chars', {
  name: 'json-chars',
  command: "echo \"needs changes: use \\\"const\\\" instead of \\\"var\\\"\"",
  scope: 'diff',
  max_rounds: 3,
})
result = runScript(['--reviewer', 'json-chars', '--round', '1'])
assert(result.status === 0, 'exits 0')
json = JSON.parse(result.stdout)
assert(json.verdict === 'fail', 'verdict is fail')
assert(json.findings.includes('const'), 'findings preserve content with quotes')

// Test: reviewer config missing required command
console.log('\nautoloop.sh (missing command field):')
setupReviewerConfig('missing-command', {
  name: 'missing-command',
  scope: 'diff',
  max_rounds: 3,
})
result = runScript(['--reviewer', 'missing-command', '--round', '1'])
assert(result.status === 1, 'exits 1 when command field is missing')
assert(result.stderr.includes("missing required field 'command'"), 'error mentions missing command field')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
