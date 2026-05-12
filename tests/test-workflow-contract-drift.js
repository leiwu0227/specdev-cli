import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ASSIGNMENT_TYPES,
  AGENT_SPEC_PATHS,
  REQUIRED_BRAINSTORM_SECTIONS,
  artifactPaths,
  commandPhases,
} from '../src/utils/workflow-contract.js'

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

const root = new URL('..', import.meta.url).pathname
const read = (path) => readFileSync(join(root, path), 'utf-8')

console.log('\nworkflow contract drift:')
const workflow = read('templates/.specdev/_guides/workflow.md')
assert(workflow.includes(ASSIGNMENT_TYPES.join(' | ')), 'workflow guide uses contract assignment type list')
const workflowManifest = read('templates/.specdev/workflow.yaml')
assert(workflowManifest.includes('workflow_contract_version: 1'), 'workflow manifest declares contract version')
assert(workflowManifest.includes('phase:end'), 'workflow manifest documents phase-end hook slot')
assert(workflowManifest.includes('brainstorm_approved'), 'workflow manifest preserves brainstorm gate field')

const main = read('templates/.specdev/_main.md')
assert(main.includes('specdev knowledge search'), '_main.md tells agents to search knowledge')
assert(main.includes('knowledge/workflow'), '_main.md mentions workflow FAQ knowledge')
assert(main.includes('specdev next --json'), '_main.md points agents to runtime next action')

const brainstormTemplate = read('templates/.specdev/_templates/brainstorm-design.md')
for (const [type, sections] of Object.entries(REQUIRED_BRAINSTORM_SECTIONS)) {
  assert(brainstormTemplate.includes(type), `brainstorm template documents ${type} sections`)
  for (const section of sections) {
    assert(brainstormTemplate.includes(section), `brainstorm template includes ${section}`)
  }
}

const knowledgeCapture = read('templates/.specdev/skills/core/knowledge-capture/SKILL.md')
assert(knowledgeCapture.includes('knowledge/workflow/'), 'knowledge capture explains workflow FAQ notes')
assert(knowledgeCapture.includes('knowledge/workflow_feedback/'), 'knowledge capture preserves workflow feedback distinction')
assert(knowledgeCapture.includes('Prefer prune-and-replace'), 'knowledge capture prunes stale notes before adding')

const initSource = read('src/commands/init.js')
for (const phase of commandPhases.review.filter(p => p !== 'discussion')) {
  assert(initSource.includes(phase), `generated command skills mention review phase ${phase}`)
}
for (const command of ['approve', 'implement', 'check-review']) {
  assert(read(`src/commands/${command}.js`).includes('specdev next --json'), `${command} command points to runtime next action`)
}

assert(workflow.includes(artifactPaths.brainstorm.proposal), 'workflow guide mentions brainstorm proposal path')
assert(workflow.includes(artifactPaths.brainstorm.design), 'workflow guide mentions brainstorm design path')
assert(workflow.includes('specdev next --json'), 'workflow guide uses runtime next action as navigation source')

assert(AGENT_SPEC_PATHS.researcher === '.specdev/agents/researcher/agent.md', 'researcher runtime agent path is exported')
assert(read('templates/.specdev/agents/researcher/agent.md').includes('name: researcher'), 'researcher agent template exists')
assert(read('templates/.specdev/agents/researcher/output-schema.json').includes('"scope_used"'), 'researcher output schema exists')
assert(read('templates/.specdev/_templates/agent-spec.schema.json').includes('"runners"'), 'agent spec meta-schema exists')
assert(read('templates/.specdev/_index.md').includes('Agents'), '_index.md documents agents')
assert(read('templates/.specdev/skills/core/brainstorming/SKILL.md').includes('specdev research'), 'brainstorming skill hints at researcher')
for (const skill of ['brainstorming', 'breakdown', 'implementing', 'reviewloop']) {
  assert(read(`templates/.specdev/skills/core/${skill}/SKILL.md`).includes('specdev next --json'), `${skill} skill uses runtime next action`)
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
