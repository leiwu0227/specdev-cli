import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = join(__dirname, '..')
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

function normalizedProse(content) {
  return content.replace(/\s+/g, ' ')
}

function snapshotTree(root, relative = '') {
  const records = []
  const current = join(root, relative)
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const child = relative ? join(relative, entry.name) : entry.name
    if (child === join('.specdev', 'cache')) continue
    if (entry.isDirectory()) {
      records.push(`dir:${child}`)
      records.push(...snapshotTree(root, child))
    } else if (entry.isFile()) {
      records.push(`file:${child}:${readFileSync(join(root, child)).toString('base64')}`)
    }
  }
  return records.sort()
}

// ---- Test default init creates all three adapters ----
console.log('\ndefault init creates all adapters:')
cleanup()
let result = runCmd(['init', `--target=${TEST_DIR}`])
assert(result.status === 0, 'init succeeds')
assert(existsSync(join(TEST_DIR, '.specdev', '_main.md')), '.specdev created')
assert(existsSync(join(TEST_DIR, 'CLAUDE.md')), 'creates CLAUDE.md')
assert(existsSync(join(TEST_DIR, 'AGENTS.md')), 'creates AGENTS.md')
assert(existsSync(join(TEST_DIR, '.cursor', 'rules')), 'creates .cursor/rules')

const roadmapRoot = join(TEST_DIR, '.specdev', 'project_notes', 'roadmap')
const roadmapCore = join(roadmapRoot, 'designs', 'core_concepts.md')
const roadmapStructure = join(roadmapRoot, 'designs', 'source_code_folder_structure.md')
const roadmapForecast = join(roadmapRoot, 'forecast.md')
assert(
  existsSync(roadmapCore) &&
    existsSync(roadmapStructure) &&
    existsSync(roadmapForecast) &&
    !existsSync(join(roadmapRoot, 'designs', 'core-concept.md')) &&
    existsSync(join(TEST_DIR, '.claude', 'skills', 'specdev-roadmap', 'SKILL.md')),
  'init installs the exact roadmap scaffold and command skill'
)

const beforeRoadmap = snapshotTree(TEST_DIR)
result = runCmd(['roadmap', `--target=${TEST_DIR}`, '--json'])
const roadmapPayload = JSON.parse(result.stdout)
assert(
  result.status === 0 &&
    roadmapPayload.state === 'stateless' &&
    roadmapPayload.standard_files.join('|') ===
      [
        'project_notes/roadmap/designs/core_concepts.md',
        'project_notes/roadmap/designs/source_code_folder_structure.md',
        'project_notes/roadmap/forecast.md',
      ].join('|') &&
    roadmapPayload.writable_paths.join('|') ===
      [
        'project_notes/roadmap/designs/**/*.md',
        'project_notes/roadmap/forecast.md',
      ].join('|') &&
    roadmapPayload.design_rules.word_limit.includes('maximum 799') &&
    roadmapPayload.design_rules.hierarchy.includes('conceptual parent-child hierarchy') &&
    roadmapPayload.design_rules.additional_notes.includes('one independent feature or module') &&
    roadmapPayload.design_rules.abstraction.includes('high-level stable abstractions') &&
    roadmapPayload.design_rules.explanation.includes('using examples') &&
    roadmapPayload.design_rules.separation.includes('runtime mechanics') &&
    roadmapPayload.design_rules.presentation.includes('intended final destination') &&
    roadmapPayload.design_rules.presentation.includes('*_draft.md') &&
    roadmapPayload.design_rules.presentation.includes('promote the draft') &&
    roadmapPayload.design_rules.presentation.includes('Do not echo full content') &&
    roadmapPayload.next_action.includes('approval before writing a draft') &&
    roadmapPayload.forecast_rules.derivation.includes('inspect current code read-only') &&
    roadmapPayload.forecast_rules.comparison_direction.includes('code gaps versus the designs') &&
    roadmapPayload.forecast_rules.code_superset.includes('Current code may be a superset') &&
    roadmapPayload.forecast_rules.design_updates.includes('user separately initiates') &&
    roadmapPayload.forecast_rules.ordering.includes('dependency order') &&
    roadmapPayload.forecast_rules.ordering.includes('numbered Markdown section') &&
    roadmapPayload.forecast_rules.references.includes('design note or notes') &&
    roadmapPayload.forecast_rules.section_word_limit.includes('maximum 199') &&
    JSON.stringify(snapshotTree(TEST_DIR)) === JSON.stringify(beforeRoadmap),
  'roadmap reports the stateless exact-path boundary without creating state'
)

const agreedCore = '# Agreed core concepts\n'
const agreedForecast = '# Agreed forecast\n\n1. First item\n'
writeFileSync(roadmapCore, agreedCore)
writeFileSync(roadmapForecast, agreedForecast)
rmSync(roadmapStructure)
result = runCmd(['update', `--target=${TEST_DIR}`, '--json'])
assert(
  result.status === 0 &&
    readFileSync(roadmapCore, 'utf-8') === agreedCore &&
    readFileSync(roadmapForecast, 'utf-8') === agreedForecast &&
    existsSync(roadmapStructure),
  'update preserves roadmap bytes and backfills a missing scaffold file'
)

const mainMd = readFileSync(join(TEST_DIR, '.specdev', '_main.md'), 'utf-8')
assert(
  mainMd.includes('.specdev/project_notes/big_picture.md'),
  '_main.md uses a repository-root-relative project context path'
)
assert(
  normalizedProse(mainMd).includes(
    'When starting a new Assignment or Mission, also read `.specdev/project_notes/big_picture.md` unconditionally'
  ) &&
    normalizedProse(mainMd).includes(
      'For every other lane, read it only when project-wide intent is materially relevant'
    ),
  '_main.md limits unconditional project context loading to new Assignment and Mission starts'
)
assert(mainMd.includes('command -v specdev'), '_main.md installs the copyable PATH fallback')
assert(
  mainMd.includes('[ -x .specdev/cache/bin/specdev ]'),
  '_main.md checks workspace launcher executability before use'
)
assert(
  /repeated\s+read-only probes/.test(mainMd),
  '_main.md defines phase-level announcement granularity'
)
assert(
  normalizedProse(mainMd).includes('small user-requested documentation artifacts') &&
    normalizedProse(mainMd).includes('without a graph, receipt, or automatic commit') &&
    normalizedProse(mainMd).includes('write first, and verify narrowly') &&
    mainMd.includes('project_notes/manual/') &&
    normalizedProse(mainMd).includes('Use SpecDev Adhoc to update the public API manual'),
  '_main.md defines Direct documentation eligibility, proportional orientation, and explicit Adhoc routing'
)
assert(
  normalizedProse(mainMd).includes('coordination or handoff note') &&
    normalizedProse(mainMd).includes('not an implicit Adhoc selection') &&
    normalizedProse(mainMd).includes('re-anchor in that repository'),
  '_main.md defines the cross-repository handoff-note ownership boundary'
)
const claudeMd = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')
assert(claudeMd.includes('.specdev/_main.md'), 'CLAUDE.md points to _main.md')
const agentsMd = readFileSync(join(TEST_DIR, 'AGENTS.md'), 'utf-8')
assert(agentsMd.includes('.specdev/_main.md'), 'AGENTS.md points to _main.md')
assert(
  !agentsMd.includes('develops SpecDev itself'),
  'AGENTS.md does not inject SpecDev source-repository advice'
)
const cursorRules = readFileSync(join(TEST_DIR, '.cursor', 'rules'), 'utf-8')
assert(cursorRules.includes('.specdev/_main.md'), '.cursor/rules points to _main.md')
for (const [adapterName, adapter] of [
  ['CLAUDE.md', claudeMd],
  ['AGENTS.md', agentsMd],
  ['.cursor/rules', cursorRules],
]) {
  assert(
    adapter.includes('coordination or handoff note') &&
      adapter.includes('does not select Adhoc') &&
      adapter.includes('re-anchor in that repository'),
    `${adapterName} preserves explicit lane selection and destination-repository re-anchoring`
  )
  assert(
    normalizedProse(adapter).includes('small requested documentation artifacts') &&
      normalizedProse(adapter).includes('create no graph, receipt, or automatic commit') &&
      normalizedProse(adapter).includes('read destination instructions') &&
      normalizedProse(adapter).includes('Use SpecDev Adhoc to update the public API manual'),
    `${adapterName} exposes the Direct documentation fast path and explicit Adhoc example`
  )
}

// ---- Test default init installs Claude extras (skills, hooks, settings) ----
console.log('\ndefault init installs Claude extras:')
const skillsDir = join(TEST_DIR, '.claude', 'skills')
assert(existsSync(skillsDir), '.claude/skills/ directory created')
assert(existsSync(join(skillsDir, 'specdev-start', 'SKILL.md')), 'specdev-start/SKILL.md installed')
assert(existsSync(join(skillsDir, 'specdev-adhoc', 'SKILL.md')), 'specdev-adhoc/SKILL.md installed')
assert(
  existsSync(join(skillsDir, 'specdev-assignment', 'SKILL.md')),
  'specdev-assignment/SKILL.md installed'
)
assert(
  existsSync(join(skillsDir, 'specdev-rewind', 'SKILL.md')),
  'specdev-rewind/SKILL.md installed'
)
assert(
  !existsSync(join(skillsDir, 'specdev-brainstorm', 'SKILL.md')),
  'specdev-brainstorm removed (redundant with assignment)'
)
assert(
  existsSync(join(skillsDir, 'specdev-continue', 'SKILL.md')),
  'specdev-continue/SKILL.md installed'
)
assert(
  existsSync(join(skillsDir, 'specdev-mission', 'SKILL.md')),
  'specdev-mission/SKILL.md installed'
)
assert(
  existsSync(join(skillsDir, 'specdev-reviewloop', 'SKILL.md')),
  'specdev-reviewloop/SKILL.md installed'
)
assert(
  !existsSync(join(skillsDir, 'specdev-review', 'SKILL.md')),
  'retired specdev-review skill is absent'
)

const startSkill = readFileSync(join(skillsDir, 'specdev-start', 'SKILL.md'), 'utf-8')
assert(startSkill.includes('big_picture.md'), 'start skill references big_picture.md')
assert(startSkill.includes('purpose, users'), 'start skill includes Q&A instructions')

const adhocSkill = readFileSync(join(skillsDir, 'specdev-adhoc', 'SKILL.md'), 'utf-8')
assert(
  normalizedProse(adhocSkill).includes(
    'big_picture.md` only when project-wide intent is materially relevant'
  ) && !normalizedProse(adhocSkill).includes('big_picture.md` unconditionally'),
  'Adhoc skill loads project context only when materially relevant'
)
assert(/adhoc\s+verify --label=/.test(adhocSkill), 'Adhoc skill documents structured verification')
assert(adhocSkill.includes('--title='), 'Adhoc skill documents the independent short title')
assert(
  /independent\s+Discussion and Test/i.test(adhocSkill),
  'Adhoc skill explains concurrent callable classification'
)
assert(
  adhocSkill.includes('exact temporary-index transaction'),
  'Adhoc skill documents transactional exact staging'
)
assert(
  adhocSkill.includes('requested, committed, rejected, and remaining'),
  'Adhoc skill documents Git-derived delivery facts'
)
assert(
  normalizedProse(adhocSkill).includes('quiescent approved pre-implementation boundary') &&
    normalizedProse(adhocSkill).includes('shelving is explicit terminal user authority') &&
    normalizedProse(adhocSkill).includes('Finish and cancel retain the same Assignment identity'),
  'Adhoc skill documents non-terminal active Assignment coexistence and blocking boundaries'
)
for (const skillRoot of ['.claude', '.codex']) {
  const installedAdhocSkill = readFileSync(
    join(TEST_DIR, skillRoot, 'skills', 'specdev-adhoc', 'SKILL.md'),
    'utf-8'
  )
  const installedAdhocProse = normalizedProse(installedAdhocSkill)
  assert(
    installedAdhocProse.includes('bounded file write request has not thereby selected Adhoc') &&
      installedAdhocProse.includes('coordination or handoff note') &&
      installedAdhocProse.includes('do not create SpecDev state in the active repository') &&
      installedAdhocProse.includes('re-anchor in that repository'),
    `${skillRoot} Adhoc skill preserves the handoff-note exemption and repo-B classification boundary`
  )
  assert(
    installedAdhocSkill.includes(
      'description: Run a user-explicitly-selected Adhoc change without a RippleGraph workflow'
    ) &&
      installedAdhocProse.includes('write an HTTP usage manual under project notes') &&
      installedAdhocProse.includes(
        'Use SpecDev Adhoc to update the public API manual and commit it'
      ),
    `${skillRoot} Adhoc skill makes explicit activation and documentation routing visible`
  )
  assert(
    installedAdhocSkill.includes('exact temporary-index transaction') &&
      installedAdhocSkill.includes('requested, committed, rejected, and remaining'),
    `${skillRoot} Adhoc skill retains ownership and transaction guidance`
  )
  assert(
    installedAdhocProse.includes('quiescent approved pre-implementation boundary') &&
      installedAdhocProse.includes('Assignment-advancing commands remain blocked') &&
      installedAdhocProse.includes('never an automatic pause or prerequisite'),
    `${skillRoot} Adhoc skill preserves active Assignment ownership without implicit shelving`
  )
}

const assignmentSkill = readFileSync(join(skillsDir, 'specdev-assignment', 'SKILL.md'), 'utf-8')
assert(
  assignmentSkill.includes('specdev assignment'),
  'assignment skill references specdev assignment command'
)
assert(assignmentSkill.includes('Specdev:'), 'assignment skill includes prefix instruction')
assert(
  assignmentSkill.includes('contract-preview bullets'),
  'assignment skill requires a contract preview before approval'
)
assert(
  normalizedProse(assignmentSkill).includes(
    'When starting a new Assignment, read `.specdev/project_notes/big_picture.md` unconditionally'
  ),
  'assignment skill loads project context unconditionally on new starts'
)

const missionSkill = readFileSync(join(skillsDir, 'specdev-mission', 'SKILL.md'), 'utf-8')
assert(
  missionSkill.includes('contract-preview bullets'),
  'mission skill requires a contract preview before approval'
)
assert(
  normalizedProse(missionSkill).includes(
    'When starting a new Mission, read `.specdev/project_notes/big_picture.md` unconditionally'
  ),
  'mission skill loads project context unconditionally on new starts'
)

const rewindSkill = readFileSync(join(skillsDir, 'specdev-rewind', 'SKILL.md'), 'utf-8')
assert(rewindSkill.includes('.specdev/_main.md'), 'rewind skill references _main.md')

const roadmapSkill = readFileSync(join(skillsDir, 'specdev-roadmap', 'SKILL.md'), 'utf-8')
const roadmapSkillProse = normalizedProse(roadmapSkill)
assert(
  roadmapSkillProse.includes('only when the user explicitly selects it') &&
    roadmapSkillProse.includes('wait for explicit user approval to write') &&
    !roadmapSkillProse.includes('complete proposed content or diff') &&
    roadmapSkillProse.includes(
      'creates no ID, RippleGraph state, receipt, snapshot, or automatic commit'
    ) &&
    roadmapSkillProse.includes('fewer than 800 words (maximum 799)') &&
    roadmapSkillProse.includes('conceptual parent-child hierarchy') &&
    roadmapSkillProse.includes('one independent feature or module') &&
    roadmapSkillProse.includes('high-level stable abstractions') &&
    roadmapSkillProse.includes('reusable conceptual templates') &&
    roadmapSkillProse.includes('runtime mechanics, verification history') &&
    roadmapSkillProse.includes('Write the draft as `*_draft.md`') &&
    roadmapSkillProse.includes('report only the draft Markdown path') &&
    roadmapSkillProse.includes('promote the draft to the final `.md` path') &&
    roadmapSkillProse.includes('identify design-note sections not yet reflected in code') &&
    roadmapSkillProse.includes('never design gaps versus current code') &&
    roadmapSkillProse.includes('extra code-only features do not create forecast items') &&
    roadmapSkillProse.includes('user separately initiates Roadmap collaboration') &&
    roadmapSkillProse.includes('list those gaps in dependency order') &&
    roadmapSkillProse.includes('numbered Markdown section') &&
    roadmapSkillProse.includes('design note or notes the section') &&
    roadmapSkillProse.includes('fewer than 200 words (maximum 199)') &&
    roadmapSkillProse.includes('Selecting another lane immediately supersedes') &&
    roadmapSkillProse.includes('no exit command or state transition is required'),
  'roadmap skill requires explicit selection and approval without workflow history'
)

const continueSkill = readFileSync(join(skillsDir, 'specdev-continue', 'SKILL.md'), 'utf-8')
assert(continueSkill.includes('specdev next'), 'continue skill references durable workflow resume')
assert(
  normalizedProse(continueSkill).includes(
    'Resume from the durable contract and workflow artifacts first'
  ) &&
    normalizedProse(continueSkill).includes(
      'big_picture.md` only when project-wide intent is materially relevant'
    ),
  'continue skill prefers durable artifacts and selectively reloads project context'
)

const reviewloopSkill = readFileSync(join(skillsDir, 'specdev-reviewloop', 'SKILL.md'), 'utf-8')
assert(reviewloopSkill.includes('agents.yaml'), 'reviewloop skill references repository profiles')
assert(
  reviewloopSkill.includes('review sessions are advisory'),
  'reviewloop skill distinguishes native advisory reviews from authoritative reviewloop verdicts'
)
assert(
  reviewloopSkill.includes('contract-preview bullets'),
  'reviewloop skill requires a contract preview before approval'
)

const installedSkillNames = readdirSync(join(TEST_DIR, '.claude', 'skills'), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('specdev-'))
  .map((entry) => entry.name)
  .sort()
for (const skillRoot of ['.claude', '.codex']) {
  for (const skillName of installedSkillNames) {
    const installedSkill = readFileSync(
      join(TEST_DIR, skillRoot, 'skills', skillName, 'SKILL.md'),
      'utf-8'
    )
    const trackedSkill = readFileSync(
      join(REPO_ROOT, skillRoot, 'skills', skillName, 'SKILL.md'),
      'utf-8'
    )
    assert(
      trackedSkill === installedSkill,
      `${skillRoot}/${skillName} tracked host copy matches generated skill prose`
    )
    assert(
      !installedSkill.includes('Announce every subtask') &&
        normalizedProse(installedSkill).includes(
          'Announce meaningful phases, plan changes, failed verification, and blockers'
        ) &&
        normalizedProse(installedSkill).includes(
          'repeated read-only probes need no separate announcement'
        ),
      `${skillRoot}/${skillName} uses meaningful-phase announcement guidance`
    )
  }
}

// ---- Test hook installation ----
console.log('\nhook installation:')
const hookScript = join(TEST_DIR, '.claude', 'hooks', 'specdev-session-start.sh')
assert(existsSync(hookScript), '.claude/hooks/specdev-session-start.sh exists')
const hookContent = readFileSync(hookScript, 'utf-8')
assert(hookContent.startsWith('#!/usr/bin/env bash'), 'hook script starts with bash shebang')
assert(
  !hookContent.includes('Announce every subtask') &&
    hookContent.includes('Announce meaningful phases') &&
    hookContent.includes('small non-behavioral documentation writes') &&
    hookContent.includes('Direct writes create no workflow state, receipt, or automatic commit'),
  'SessionStart guidance exposes Direct writes and meaningful-phase announcements'
)
const settingsFile = join(TEST_DIR, '.claude', 'settings.json')
assert(existsSync(settingsFile), '.claude/settings.json exists')
const settings = JSON.parse(readFileSync(settingsFile, 'utf-8'))
assert(
  settings.hooks &&
    Array.isArray(settings.hooks.SessionStart) &&
    settings.hooks.SessionStart.some(
      (entry) =>
        entry.hooks &&
        entry.hooks.some((h) => h.command === '.claude/hooks/specdev-session-start.sh')
    ),
  'settings.json contains SessionStart hook pointing to specdev script'
)

// ---- Test --platform=claude still works (backward compat, deprecation notice) ----
console.log('\n--platform=claude backward compat:')
cleanup()
result = runCmd(['init', `--target=${TEST_DIR}`, '--platform=claude'])
assert(result.status === 0, 'init with --platform=claude succeeds')
assert(existsSync(join(TEST_DIR, 'CLAUDE.md')), 'creates CLAUDE.md')
assert(existsSync(join(TEST_DIR, 'AGENTS.md')), 'creates AGENTS.md')
assert(existsSync(join(TEST_DIR, '.cursor', 'rules')), 'creates .cursor/rules')

// ---- Test hook registration is idempotent ----
console.log('\nhook registration idempotent:')
result = runCmd(['init', `--target=${TEST_DIR}`, '--force'])
const settingsAfter = JSON.parse(readFileSync(settingsFile, 'utf-8'))
const hookEntries = settingsAfter.hooks.SessionStart.filter(
  (entry) =>
    entry.hooks && entry.hooks.some((h) => h.command === '.claude/hooks/specdev-session-start.sh')
)
assert(hookEntries.length === 1, 'no duplicate hook entry after re-init with --force')

// ---- Test hook merges with existing settings ----
console.log('\nhook merges with existing settings:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
// Add extra settings and re-init
const settingsPath2 = join(TEST_DIR, '.claude', 'settings.json')
const existing = JSON.parse(readFileSync(settingsPath2, 'utf-8'))
existing.permissions = { allow: ['Read'] }
writeFileSync(settingsPath2, JSON.stringify(existing, null, 2) + '\n')
result = runCmd(['init', `--target=${TEST_DIR}`, '--force'])
const merged = JSON.parse(readFileSync(settingsPath2, 'utf-8'))
assert(
  merged.permissions && merged.permissions.allow.includes('Read'),
  'preserves existing permissions key'
)
assert(
  merged.hooks && merged.hooks.SessionStart.length > 0,
  'preserves hook registration alongside existing settings'
)

// ---- Test invalid settings are preserved (no overwrite) ----
console.log('\ninvalid settings preserved:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
const invalidSettingsPath = join(TEST_DIR, '.claude', 'settings.json')
writeFileSync(invalidSettingsPath, '{ invalid json')
result = runCmd(['init', `--target=${TEST_DIR}`, '--force'])
assert(result.status === 0, 're-init succeeds even with invalid settings')
assert(
  readFileSync(invalidSettingsPath, 'utf-8') === '{ invalid json',
  'keeps invalid settings file untouched'
)

// ---- Test adapter contains "Specdev:" instruction ----
console.log('\nadapter drift-detection instruction:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
const driftCheck = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')
assert(driftCheck.includes('Specdev:'), 'adapter includes "Specdev:" prefix instruction')

// ---- Test adapters do NOT overwrite existing files ----
console.log('\nno-overwrite:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
const originalContent = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')
const modified = originalContent + '\n# My custom rules\n'
writeFileSync(join(TEST_DIR, 'CLAUDE.md'), modified)
// Re-init with force (should update .specdev but preserve adapter)
result = runCmd(['init', `--target=${TEST_DIR}`, '--force'])
const afterForce = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')
assert(afterForce.includes('My custom rules'), 'preserves existing CLAUDE.md content on --force')

// Also verify AGENTS.md and .cursor/rules are preserved
const originalAgents = readFileSync(join(TEST_DIR, 'AGENTS.md'), 'utf-8')
const modifiedAgents = originalAgents + '\n# Custom agent rules\n'
writeFileSync(join(TEST_DIR, 'AGENTS.md'), modifiedAgents)
const originalCursor = readFileSync(join(TEST_DIR, '.cursor', 'rules'), 'utf-8')
const modifiedCursor = originalCursor + '\n# Custom cursor rules\n'
writeFileSync(join(TEST_DIR, '.cursor', 'rules'), modifiedCursor)
result = runCmd(['init', `--target=${TEST_DIR}`, '--force'])
assert(
  readFileSync(join(TEST_DIR, 'AGENTS.md'), 'utf-8').includes('Custom agent rules'),
  'preserves existing AGENTS.md content on --force'
)
assert(
  readFileSync(join(TEST_DIR, '.cursor', 'rules'), 'utf-8').includes('Custom cursor rules'),
  'preserves existing .cursor/rules content on --force'
)

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
