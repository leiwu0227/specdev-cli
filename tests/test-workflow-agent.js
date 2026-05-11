import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { cleanupDir, runSpecdev, assertTest } from './helpers.js'

const TEST_DIR = resolve('./tests/test-workflow-agent-output')

let failures = 0
let passes = 0

function assert(condition, msg, detail = '') {
  if (assertTest(condition, msg, detail)) passes++
  else failures++
}

function runCmd(args, options = {}) {
  return runSpecdev(args, {
    ...options,
    env: { ...process.env, ...options.env },
  })
}

function cleanup() {
  cleanupDir(TEST_DIR)
}

function writeRunner(projectDir) {
  const stubPath = join(projectDir, 'stub-runner.js')
  writeFileSync(stubPath, `
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
const stdin = readFileSync(0, 'utf-8')
const invocationPath = process.env.SPECDEV_TEST_INVOCATION
const previous = invocationPath && existsSync(invocationPath) ? JSON.parse(readFileSync(invocationPath, 'utf-8')) : []
previous.push({ argv: process.argv.slice(2), cwd: process.cwd(), stdin })
if (invocationPath) writeFileSync(invocationPath, JSON.stringify(previous, null, 2))
if (process.env.SPECDEV_TEST_BEHAVIOR === 'bad-once' && previous.length === 1) {
  console.log('## Topic\\n\\nBad output')
  process.exit(0)
}
const markdown = '## Topic\\n\\nResearch\\n\\n## Scope Used\\n\\nrepo\\n\\n## Findings\\n\\nWorks.\\n\\n## Sources\\n\\n- repo: stub\\n\\n## Limitations\\n\\nNone.\\n\\n' +
  '\`\`\`json\\n{"topic":"Research","scope_used":["repo"],"sources":[{"type":"repo","ref":"stub"}],"findings_word_count":1,"confidence":"high","status":"ok"}\\n\`\`\`\\n'
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
}

function setupProject(name) {
  const projectDir = join(TEST_DIR, name)
  const result = runCmd(['init', `--target=${projectDir}`])
  assert(result.status === 0, `init succeeds for ${name}`, result.stderr || result.stdout)

  const assignment = join(projectDir, '.specdev', 'assignments', '00001_feature_agents')
  mkdirSync(join(assignment, 'brainstorm'), { recursive: true })
  mkdirSync(join(assignment, 'context'), { recursive: true })
  writeFileSync(join(projectDir, '.specdev', '.current'), '00001_feature_agents\n')
  writeFileSync(join(assignment, 'brainstorm', 'proposal.md'), '# Proposal\n')
  writeFileSync(join(assignment, 'brainstorm', 'design.md'), '# Design\n')
  writeRunner(projectDir)

  return { projectDir, assignment }
}

cleanup()

console.log('\nagents inspect --json:')
{
  const { projectDir } = setupProject('inspect')
  const result = runCmd([
    'agents',
    'inspect',
    '.specdev/agents/researcher/agent.md',
    `--target=${projectDir}`,
    '--json',
  ])
  assert(result.status === 0, 'inspect validates researcher agent', result.stderr || result.stdout)
  const payload = JSON.parse(result.stdout)
  assert(payload.command === 'agents inspect', 'inspect json identifies command')
  assert(payload.name === 'researcher', 'inspect json includes researcher name')
  assert(existsSync(payload.schema_path), 'inspect json schema path exists')
}

console.log('\nagents inspect invalid spec:')
{
  const { projectDir } = setupProject('invalid')
  const badPath = join(projectDir, 'bad-agent.md')
  writeFileSync(badPath, `---
description: Missing required metadata
output:
  schema: ./.missing-schema.json
---

Bad
`)
  const result = runCmd(['agents', 'inspect', badPath, `--target=${projectDir}`, '--json'])
  assert(result.status !== 0, 'inspect rejects invalid agent')
  const payload = JSON.parse(result.stdout)
  assert(payload.status === 'error', 'invalid inspect returns error json')
}

console.log('\nresearch command success:')
{
  const { projectDir, assignment } = setupProject('research')
  const invocationPath = join(projectDir, 'invocation.json')
  const result = runCmd(['research', 'agent docs', '--platform=codex', `--target=${projectDir}`], {
    env: { SPECDEV_TEST_INVOCATION: invocationPath },
  })
  assert(result.status === 0, 'research exits 0', result.stderr || result.stdout)
  assert(existsSync(join(assignment, 'context', 'research-agent-docs.md')), 'research artifact is created')
  const invocation = JSON.parse(readFileSync(invocationPath, 'utf-8'))
  assert(invocation[0].cwd === projectDir, 'runner cwd is target project')
  assert(invocation[0].stdin.includes('agent docs'), 'rendered prompt reaches runner stdin')
}

console.log('\nresearch command retries malformed output:')
{
  const { projectDir } = setupProject('retry')
  const invocationPath = join(projectDir, 'retry-invocation.json')
  const result = runCmd(['research', 'bad once', '--platform=codex', `--target=${projectDir}`], {
    env: {
      SPECDEV_TEST_BEHAVIOR: 'bad-once',
      SPECDEV_TEST_INVOCATION: invocationPath,
    },
  })
  assert(result.status === 0, 'bad-then-good output retries successfully', result.stderr || result.stdout)
  const invocations = JSON.parse(readFileSync(invocationPath, 'utf-8'))
  assert(invocations.length === 2, 'runner is invoked twice')
  assert(invocations[1].stdin.includes('Previous response was rejected'), 'retry prompt includes validation error')
}

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
