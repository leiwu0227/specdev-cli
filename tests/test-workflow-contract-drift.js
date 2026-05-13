import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import YAML from 'yaml'
import {
  ASSIGNMENT_TYPES,
  AGENT_SPEC_PATHS,
  REQUIRED_BRAINSTORM_SECTIONS,
  commandPhases,
} from '../src/utils/workflow-contract.js'

// Per-phase artifact paths now live solely in the manifest; the drift test
// reads them from the installed template manifest to keep producing/consuming
// references in sync without a JS export.
const MANIFEST_ARTIFACT_PATHS = {
  brainstorm: {
    proposal: 'brainstorm/proposal.md',
    design: 'brainstorm/design.md',
  },
  breakdown: {
    plan: 'breakdown/plan.md',
  },
  implementation: {
    progress: 'implementation/progress.json',
  },
}

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
assert(workflowManifest.includes('workflow_contract_version: 2'), 'workflow manifest declares contract version 2')
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

assert(workflow.includes(MANIFEST_ARTIFACT_PATHS.brainstorm.proposal), 'workflow guide mentions brainstorm proposal path')
assert(workflow.includes(MANIFEST_ARTIFACT_PATHS.brainstorm.design), 'workflow guide mentions brainstorm design path')
for (const [section, entries] of Object.entries(MANIFEST_ARTIFACT_PATHS)) {
  for (const path of Object.values(entries)) {
    assert(workflowManifest.includes(path), `workflow manifest references ${section} path ${path}`)
  }
}
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

// Test budget contract (D00004 layer C)
const breakdownSkill = read('templates/.specdev/skills/core/breakdown/SKILL.md')
assert(breakdownSkill.includes('**Test Budget:** +<count>'), 'breakdown SKILL declares per-task Test Budget format')
assert(breakdownSkill.includes('≤ 5 new tests across all tasks'), 'breakdown SKILL plan header declares aggregate Test Budget cap')
assert(breakdownSkill.includes('Test budget rules'), 'breakdown SKILL includes test budget rules section')

const reviewerPrompt = read('templates/.specdev/skills/core/review-agent/prompts/implementation-reviewer.md')
assert(reviewerPrompt.includes('Test budget'), 'implementation reviewer prompt enforces test budget')
assert(reviewerPrompt.includes('net new tests'), 'implementation reviewer counts net additions (not raw)')
for (const stack of ['mocha', 'pytest', '#[test]', 'func Test', '@Test', '[Fact]', 'RSpec', 'TEST_F', 'XCTest', 'ExUnit']) {
  assert(reviewerPrompt.includes(stack), `reviewer prompt covers ${stack} counting rule`)
}

// Dangling-reference guard: every `workflowArtifactPaths.<section>.<key>`
// referenced in source must resolve against the live contract. Catches
// refactors that drop a contract section but leave consumers behind
// (e.g. the `capture.*` regression in `specdev status`).
const consumerSources = [
  'src/commands/continue.js',
]
const refPattern = /workflowArtifactPaths\.([a-zA-Z_]+)\.([a-zA-Z_]+)/g
for (const path of consumerSources) {
  const src = read(path)
  for (const match of src.matchAll(refPattern)) {
    const [, section, key] = match
    const resolved = MANIFEST_ARTIFACT_PATHS[section] && MANIFEST_ARTIFACT_PATHS[section][key]
    assert(resolved, `${path} references live artifactPaths.${section}.${key}`)
  }
}

// =====================================================================
// Class 1 — Manifest contract presence
// =====================================================================
console.log('\nclass 1 — manifest contract presence:')
for (const manifestPath of ['templates/.specdev/workflow.yaml', '.specdev/workflow.yaml']) {
  const parsed = YAML.parse(read(manifestPath))
  assert(parsed.workflow_contract_version === 2, `${manifestPath}: workflow_contract_version === 2`)

  // Every kind:command id:checkpoint has an interaction block with required fields.
  // Every kind:gate has an on_satisfied block.
  // Every step has requires: or produces:.
  for (const [phaseName, phase] of Object.entries(parsed.phases || {})) {
    for (const step of phase.steps || []) {
      const stepLabel = `${manifestPath}: ${phaseName}.${step.id}`
      if (step.kind === 'command' && step.id === 'checkpoint') {
        const ix = step.interaction
        assert(ix && typeof ix === 'object', `${stepLabel}: has interaction block`)
        if (ix) {
          assert(typeof ix.id === 'string' && ix.id.length > 0, `${stepLabel}: interaction.id present`)
          assert(ix.kind === 'choice', `${stepLabel}: interaction.kind === 'choice'`)
          assert(typeof ix.prompt === 'string' && ix.prompt.length > 0, `${stepLabel}: interaction.prompt non-empty`)
          assert(ix.render_via === 'choice_prompt', `${stepLabel}: interaction.render_via === 'choice_prompt'`)
          assert(Array.isArray(ix.choices) && ix.choices.length > 0, `${stepLabel}: interaction.choices non-empty array`)
        }
      }
      if (step.kind === 'gate') {
        const os = step.on_satisfied
        assert(os && typeof os === 'object', `${stepLabel}: has on_satisfied block`)
        if (os) {
          assert(os.next && typeof os.next.kind === 'string', `${stepLabel}: on_satisfied.next.kind present`)
          assert(typeof os.interrupt === 'boolean', `${stepLabel}: on_satisfied.interrupt is boolean`)
        }
      }
      const hasContract = Array.isArray(step.requires) || Array.isArray(step.produces)
      assert(hasContract, `${stepLabel}: step has requires: or produces:`)
    }
  }

  // Top-level interactions array contains discussion_checkpoint.
  const topLevel = parsed.interactions || []
  const discussion = topLevel.find((e) => e && e.id === 'discussion_checkpoint')
  assert(discussion, `${manifestPath}: top-level interactions includes discussion_checkpoint`)
}

// =====================================================================
// Class 2 — Core SKILL.md prose
// =====================================================================
console.log('\nclass 2 — core SKILL.md prose:')
const bannedChoiceLabels = [
  'Automated review, then continue if approved',
  'Skip review and approve',
  'reviewloop_autocontinue',
]
const bannedCommandStrings = [
  'specdev reviewloop implementation --reviewer=',
  'specdev approve implementation',
]
const requiredGenericStrings = [
  'AskUserQuestion',
  'interaction',
  'continuation',
  'exact labels and order',
]
const coreSkillFiles = [
  '.specdev/skills/core/brainstorming/SKILL.md',
  '.specdev/skills/core/implementing/SKILL.md',
  '.specdev/skills/core/reviewloop/SKILL.md',
  'templates/.specdev/skills/core/brainstorming/SKILL.md',
  'templates/.specdev/skills/core/implementing/SKILL.md',
  'templates/.specdev/skills/core/reviewloop/SKILL.md',
]
for (const file of coreSkillFiles) {
  const content = read(file)
  for (const banned of bannedChoiceLabels) {
    assert(!content.includes(banned), `${file}: no banned choice label '${banned}'`)
  }
  for (const banned of bannedCommandStrings) {
    assert(!content.includes(banned), `${file}: no hard-coded command string '${banned}'`)
  }
  for (const required of requiredGenericStrings) {
    assert(content.includes(required), `${file}: contains generic rendering verbiage '${required}'`)
  }
}

// =====================================================================
// Class 3 — Generated command-skill templates in init.js + mirrors
// =====================================================================
console.log('\nclass 3 — generated command-skill templates and host mirrors:')
const initSrc = read('src/commands/init.js')
// reviewloop template inside init.js must be generic
const reviewloopTemplateRegion = initSrc.split("'specdev-reviewloop'")[1] || ''
assert(reviewloopTemplateRegion.includes('interaction'), 'init.js specdev-reviewloop template mentions interaction block')
assert(reviewloopTemplateRegion.includes('continuation'), 'init.js specdev-reviewloop template mentions continuation block')
assert(!reviewloopTemplateRegion.includes('Automated review, then continue if approved'),
  'init.js specdev-reviewloop template has no hard-coded autocontinue choice label')
assert(!reviewloopTemplateRegion.includes('--autocontinue contract'),
  'init.js specdev-reviewloop template has no hard-coded autocontinue contract phrase')

const hostMirrors = [
  '.codex/skills/specdev-reviewloop/SKILL.md',
  '.claude/skills/specdev-reviewloop/SKILL.md',
]
for (const file of hostMirrors) {
  const content = read(file)
  for (const banned of bannedChoiceLabels) {
    assert(!content.includes(banned), `${file}: no banned choice label '${banned}'`)
  }
  assert(content.includes('interaction'), `${file}: mentions interaction block`)
  assert(content.includes('continuation'), `${file}: mentions continuation block`)
}

// =====================================================================
// Class 4 — Repo-wide hard-coded artifact-path sweep
// =====================================================================
console.log('\nclass 4 — hard-coded artifact-path sweep:')
const ALLOWLISTED_JS = new Set([
  // DEFAULT_WORKFLOW literals are the canonical manifest fallback.
  'src/utils/workflow-runtime.js',
  // Legacy assignment migrator intentionally retains old layout paths.
  'src/commands/migrate-legacy-assignments.js',
])
const FORBIDDEN_LITERALS = [
  "'brainstorm/proposal.md'",
  "'brainstorm/design.md'",
  "'breakdown/plan.md'",
  "'implementation/progress.json'",
  '"brainstorm/proposal.md"',
  '"brainstorm/design.md"',
  '"breakdown/plan.md"',
  '"implementation/progress.json"',
]
// Member-access patterns flagged outside workflow-contract.js itself.
// Note: commandPhases.<key> is intentionally kept as a static CLI-grammar
// surface (see workflow-contract.js top-of-file rationale) and is NOT swept.
const memberPatterns = [
  /\bartifactPaths\.[a-zA-Z_]+\.[a-zA-Z_]+/,
  /\bgateFields\.[a-zA-Z_]+/,
]

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (st.isFile() && full.endsWith('.js')) out.push(full)
  }
  return out
}

const srcRoot = join(root, 'src')
const jsFiles = walk(srcRoot, [])
const matches = []
for (const full of jsFiles) {
  const rel = relative(root, full).split('\\').join('/')
  if (ALLOWLISTED_JS.has(rel)) continue
  const content = readFileSync(full, 'utf-8')
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const lit of FORBIDDEN_LITERALS) {
      if (line.includes(lit)) {
        matches.push(`${rel}:${i + 1}: ${line.trim()}`)
      }
    }
    if (rel !== 'src/utils/workflow-contract.js') {
      for (const re of memberPatterns) {
        if (re.test(line)) {
          matches.push(`${rel}:${i + 1}: ${line.trim()}`)
        }
      }
    }
  }
}
if (matches.length > 0) {
  for (const m of matches) console.error(`    ${m}`)
}
assert(matches.length === 0, `no hard-coded artifact-path literals or artifactPaths/gateFields member access outside allowlist (${matches.length} matches)`)

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
