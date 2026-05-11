import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')
const CLI = join(ROOT, 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-research-output')

let failures = 0
let passes = 0

function assert(condition, msg, detail = '') {
  if (!condition) {
    console.error(`  FAIL ${msg}`)
    if (detail) console.error(`       ${detail}`)
    failures++
  } else {
    console.log(`  PASS ${msg}`)
    passes++
  }
}

function runSpecdev(args, options = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf-8',
    env: { ...process.env, ...options.env },
    cwd: options.cwd || ROOT,
  })
}

function cleanup() {
  rmSync(TEST_DIR, { recursive: true, force: true })
  mkdirSync(TEST_DIR, { recursive: true })
}

function writeStub(projectDir, behavior = 'ok') {
  const stubPath = join(projectDir, 'stub-runner.js')
  writeFileSync(stubPath, `
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
const stdin = readFileSync(0, 'utf-8')
const invocationPath = process.env.SPECDEV_TEST_INVOCATION
const previous = invocationPath && existsSync(invocationPath) ? JSON.parse(readFileSync(invocationPath, 'utf-8')) : []
previous.push({ argv: process.argv.slice(2), cwd: process.cwd(), stdin })
if (invocationPath) writeFileSync(invocationPath, JSON.stringify(previous, null, 2))
if (process.env.SPECDEV_TEST_BEHAVIOR === 'bad') {
  console.log('## Topic\\n\\nBad output')
  process.exit(0)
}
if (process.env.SPECDEV_TEST_BEHAVIOR === 'bad-once' && previous.length === 1) {
  console.log('## Topic\\n\\nBad output')
  process.exit(0)
}
const markdown = '## Topic\\n\\nResearch\\n\\n## Scope Used\\n\\nrepo\\n\\n## Findings\\n\\nWorks.\\n\\n## Sources\\n\\n- repo: stub\\n\\n## Limitations\\n\\nNone.\\n\\n' +
  '\`\`\`json\\n{"topic":"Research","scope_used":["repo"],"sources":[],"findings_word_count":1,"confidence":"high","status":"ok"}\\n\`\`\`\\n'
process.stdout.write(markdown)
`)

  const agentPath = join(projectDir, '.specdev', 'agents', 'researcher', 'agent.md')
  let agent = readFileSync(agentPath, 'utf-8')
  agent = agent.replace(/command: codex/g, `command: ${process.execPath}`)
  agent = agent.replace(/command: claude/g, `command: ${process.execPath}`)
  agent = agent.replace(/command: cursor-agent/g, `command: ${process.execPath}`)
  agent = agent.replace(/args: \[exec, "-"\]/g, `args: [${JSON.stringify(stubPath)}]`)
  agent = agent.replace(/args: \[--print, --input-format, text, --output-format, stream-json, --verbose\]/g, `args: [${JSON.stringify(stubPath)}]`)
  agent = agent.replace(/args: \[-f, -p\]/g, `args: [${JSON.stringify(stubPath)}]`)
  agent = agent.replace(/stream_json: true/g, 'stream_json: false')
  writeFileSync(agentPath, agent)

  return { stubPath, behavior }
}

function setupProject(name = 'project') {
  const projectDir = join(TEST_DIR, name)
  const result = runSpecdev(['init', `--target=${projectDir}`])
  assert(result.status === 0, `init succeeds for ${name}`, result.stderr || result.stdout)
  const assignment = join(projectDir, '.specdev', 'assignments', '00001_feature_agents')
  mkdirSync(join(assignment, 'brainstorm'), { recursive: true })
  mkdirSync(join(assignment, 'context'), { recursive: true })
  writeFileSync(join(projectDir, '.specdev', '.current'), '00001_feature_agents\n')
  writeFileSync(join(assignment, 'brainstorm', 'proposal.md'), '# Proposal\n')
  writeFileSync(join(assignment, 'brainstorm', 'design.md'), '# Design\n')
  writeStub(projectDir)
  return { projectDir, assignment }
}

cleanup()

console.log('\nresearch command basic run and collision:')
{
  const { projectDir, assignment } = setupProject('basic')
  const invocationPath = join(projectDir, 'invocation.json')
  let result = runSpecdev(['research', 'agent docs', '--platform=codex', `--target=${projectDir}`], {
    env: { SPECDEV_TEST_INVOCATION: invocationPath },
  })
  assert(result.status === 0, 'research exits 0', result.stderr || result.stdout)
  assert(existsSync(join(assignment, 'context', 'research-agent-docs.md')), 'research artifact is created')
  const invocation = JSON.parse(readFileSync(invocationPath, 'utf-8'))
  assert(invocation[0].cwd === projectDir, 'child cwd is target project')
  assert(invocation[0].stdin.includes('agent docs'), 'rendered prompt reaches stdin')

  result = runSpecdev(['research', 'agent docs', '--platform=codex', `--target=${projectDir}`], {
    env: { SPECDEV_TEST_INVOCATION: invocationPath },
  })
  assert(result.status === 0, 'second same-topic research exits 0')
  assert(existsSync(join(assignment, 'context', 'research-agent-docs-2.md')), 'collision appends -2')
}

console.log('\nresearch command validation and retry:')
{
  const { projectDir, assignment } = setupProject('retry')
  let result = runSpecdev(['research', 'bad output', '--platform=codex', `--target=${projectDir}`], {
    env: { SPECDEV_TEST_BEHAVIOR: 'bad' },
  })
  assert(result.status !== 0, 'malformed output exits non-zero')
  assert(existsSync(join(assignment, 'context', 'research-bad-output.md')), 'malformed artifact is preserved')

  const invocationPath = join(projectDir, 'retry-invocation.json')
  result = runSpecdev(['research', 'bad once', '--platform=codex', `--target=${projectDir}`], {
    env: { SPECDEV_TEST_BEHAVIOR: 'bad-once', SPECDEV_TEST_INVOCATION: invocationPath },
  })
  assert(result.status === 0, 'bad-then-good output retries successfully', result.stderr || result.stdout)
  const invocations = JSON.parse(readFileSync(invocationPath, 'utf-8'))
  assert(invocations.length === 2, 'retry invokes child twice')
  assert(invocations[1].stdin.includes('Previous response was rejected'), 'retry prompt includes validation error')
}

console.log('\nresearch command host detection and context safety:')
{
  const { projectDir } = setupProject('context')
  writeFileSync(join(projectDir, 'notes.md'), 'allowed context')
  writeFileSync(join(projectDir, '.env'), 'SECRET=1')
  const outside = join(TEST_DIR, 'outside.txt')
  writeFileSync(outside, 'outside')
  symlinkSync(outside, join(projectDir, 'outside-link.txt'))

  let result = runSpecdev(['research', 'host detect', '--context=notes.md', `--target=${projectDir}`], {
    env: { SPECDEV_HOST_AGENT: 'codex', SPECDEV_TEST_INVOCATION: join(projectDir, 'host-invocation.json') },
  })
  assert(result.status === 0, 'host-detected platform succeeds')
  const invocation = JSON.parse(readFileSync(join(projectDir, 'host-invocation.json'), 'utf-8'))
  assert(invocation[0].stdin.includes('allowed context'), 'allowed context file is included')

  result = runSpecdev(['research', 'secret', '--platform=codex', '--context=.env', `--target=${projectDir}`])
  assert(result.status !== 0 && /unsafe-context|secret/i.test(`${result.stdout}\n${result.stderr}`), 'secret-looking context is rejected')

  result = runSpecdev(['research', 'outside', '--platform=codex', `--context=${outside}`, `--target=${projectDir}`])
  assert(result.status !== 0 && /outside/i.test(`${result.stdout}\n${result.stderr}`), 'outside context is rejected')

  result = runSpecdev(['research', 'symlink', '--platform=codex', '--context=outside-link.txt', `--target=${projectDir}`])
  assert(result.status !== 0 && /outside|symlink/i.test(`${result.stdout}\n${result.stderr}`), 'symlink escape is rejected')

  result = runSpecdev(['research', 'unsafe', '--platform=codex', '--context=.env', '--unsafe-context', `--target=${projectDir}`])
  assert(result.status === 0, 'unsafe-context allows explicit secret context')
}

console.log('\nresearch command max context uses stdin:')
{
  const { projectDir } = setupProject('max-context')
  const large = 'x'.repeat(256 * 1024)
  writeFileSync(join(projectDir, 'large.txt'), large)
  const invocationPath = join(projectDir, 'large-invocation.json')
  const result = runSpecdev(['research', 'large context', '--platform=codex', '--context=large.txt', `--target=${projectDir}`], {
    env: { SPECDEV_TEST_INVOCATION: invocationPath },
  })
  assert(result.status === 0, 'max-sized context run succeeds', result.stderr || result.stdout)
  const invocation = JSON.parse(readFileSync(invocationPath, 'utf-8'))[0]
  assert(invocation.stdin.includes('x'.repeat(1024)), 'large context is delivered through stdin')
  assert(!invocation.argv.some(value => value.includes('x'.repeat(1024))), 'large context is not delivered through argv')
}

console.log(`\n${passes} passed, ${failures} failed`)
cleanup()
process.exit(failures > 0 ? 1 : 0)
