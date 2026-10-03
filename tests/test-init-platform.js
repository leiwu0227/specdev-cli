import { ADAPTERS, adapterContent, SKILL_FILES } from '../src/commands/init.js'
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
const roadmapTodo = join(roadmapRoot, 'todo.md')
assert(
  existsSync(roadmapCore) &&
    existsSync(roadmapStructure) &&
    existsSync(roadmapForecast) &&
    existsSync(roadmapTodo) &&
    readFileSync(roadmapTodo, 'utf-8').startsWith('# Todo\n') &&
    !existsSync(join(roadmapRoot, 'designs', 'public_functions.md')) &&
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
        'project_notes/roadmap/todo.md',
      ].join('|') &&
    roadmapPayload.writable_paths.join('|') ===
      [
        'project_notes/roadmap/designs/**/*.md',
        'project_notes/roadmap/forecast.md',
        'project_notes/roadmap/todo.md',
      ].join('|') &&
    roadmapPayload.design_rules.word_limit.includes('maximum 799') &&
    roadmapPayload.design_rules.hierarchy.includes('conceptual parent-child hierarchy') &&
    roadmapPayload.design_rules.additional_notes.includes('one independent feature or module') &&
    roadmapPayload.design_rules.abstraction.includes('high-level stable abstractions') &&
    roadmapPayload.design_rules.explanation.includes('using examples') &&
    roadmapPayload.design_rules.progression.includes(
      'Except for source_code_folder_structure.md'
    ) &&
    roadmapPayload.design_rules.progression.includes('general descriptions') &&
    roadmapPayload.design_rules.progression.includes('no fixed headings, sections') &&
    roadmapPayload.design_rules.source_targets.includes(
      'except core_concepts.md and source_code_folder_structure.md'
    ) &&
    roadmapPayload.design_rules.source_targets.includes('maximum total line count') &&
    roadmapPayload.design_rules.source_targets.includes('no particular Markdown format') &&
    roadmapPayload.design_rules.illustration.includes('small relevant folder tree') &&
    roadmapPayload.design_rules.illustration.includes('pseudocode section') &&
    roadmapPayload.design_rules.illustration.includes('neither is required') &&
    roadmapPayload.design_rules.public_function_notes.includes(
      'Only when the user explicitly requests'
    ) &&
    roadmapPayload.design_rules.public_function_notes.includes('typed signatures') &&
    roadmapPayload.design_rules.public_function_notes.includes('CapCase (PascalCase)') &&
    roadmapPayload.design_rules.public_function_notes.includes('snake_case') &&
    roadmapPayload.design_rules.public_function_notes.includes('return type and returned value') &&
    roadmapPayload.design_rules.public_function_notes.includes('optional guidance') &&
    roadmapPayload.design_rules.public_function_notes.includes('not a standard filename') &&
    roadmapPayload.design_rules.public_function_notes.includes('validation rule') &&
    roadmapPayload.design_rules.separation.includes('runtime mechanics') &&
    roadmapPayload.design_rules.presentation.includes('intended final destination') &&
    roadmapPayload.design_rules.presentation.includes('*_draft.md') &&
    roadmapPayload.design_rules.presentation.includes('promote the draft') &&
    roadmapPayload.design_rules.presentation.includes('automatically commit') &&
    roadmapPayload.design_rules.presentation.includes('Do not echo full content') &&
    roadmapPayload.history.includes('published design-note changes are committed') &&
    roadmapPayload.next_action.includes('approval before writing a draft') &&
    roadmapPayload.forecast_rules.derivation.includes('inspect current code read-only') &&
    roadmapPayload.forecast_rules.comparison_direction.includes('code gaps versus the designs') &&
    roadmapPayload.forecast_rules.code_superset.includes('Current code may be a superset') &&
    roadmapPayload.forecast_rules.design_updates.includes('user separately initiates') &&
    roadmapPayload.forecast_rules.ordering.includes('dependency order') &&
    roadmapPayload.forecast_rules.ordering.includes('numbered Markdown section') &&
    roadmapPayload.forecast_rules.references.includes('design note or notes') &&
    roadmapPayload.forecast_rules.section_word_limit.includes('maximum 199') &&
    roadmapPayload.todo_rules.purpose.includes('user-selected') &&
    roadmapPayload.todo_rules.purpose.includes('non-architecture') &&
    roadmapPayload.todo_rules.purpose.includes('distinct from design-derived Forecast gaps') &&
    roadmapPayload.todo_rules.ordering.includes('dependency order') &&
    roadmapPayload.todo_rules.ordering.includes('user-priority order') &&
    roadmapPayload.todo_rules.format.includes('numbered Markdown section') &&
    roadmapPayload.todo_rules.section_word_limit.includes('maximum 199') &&
    roadmapPayload.todo_rules.provenance.includes('omit provenance metadata') &&
    roadmapPayload.todo_rules.provenance.includes('do not require Based on references') &&
    JSON.stringify(snapshotTree(TEST_DIR)) === JSON.stringify(beforeRoadmap),
  'roadmap reports the stateless exact-path boundary without creating state'
)

const agreedCore = '# Agreed core concepts\n'
const agreedForecast = '# Agreed forecast\n\n1. First item\n'
const agreedTodo = '# Agreed todo\n\n1. User item\n'
writeFileSync(roadmapCore, agreedCore)
writeFileSync(roadmapForecast, agreedForecast)
writeFileSync(roadmapTodo, agreedTodo)
rmSync(roadmapStructure)
result = runCmd(['update', `--target=${TEST_DIR}`, '--json'])
assert(
  result.status === 0 &&
    readFileSync(roadmapCore, 'utf-8') === agreedCore &&
    readFileSync(roadmapForecast, 'utf-8') === agreedForecast &&
    readFileSync(roadmapTodo, 'utf-8') === agreedTodo &&
    existsSync(roadmapStructure),
  'update preserves roadmap bytes and backfills a missing scaffold file'
)
rmSync(roadmapTodo)
result = runCmd(['update', `--target=${TEST_DIR}`, '--json'])
assert(
  result.status === 0 && readFileSync(roadmapTodo, 'utf-8').startsWith('# Todo\n'),
  'update backfills a missing Todo scaffold'
)

// Installation preserves current source bytes. Guidance meaning is reviewed in the diff;
// sentence fragments cannot establish whether an agent instruction is correct.
for (const path of [
  '_main.md', '_index.md', '_guides/workflow.md', '_guides/assignment_guide.md',
  '_guides/runtime.md', 'skills/README.md', 'skills/core/brainstorming/SKILL.md',
]) {
  assert(
    readFileSync(join(TEST_DIR, '.specdev', path), 'utf8') ===
      readFileSync(join(REPO_ROOT, 'templates', '.specdev', path), 'utf8'),
    'installed guidance matches its source: ' + path
  )
}
const mainMd = readFileSync(join(TEST_DIR, '.specdev', '_main.md'), 'utf8')
assert(mainMd.includes('.specdev/project_notes/big_picture.md'), 'main guide references project context')
assert(mainMd.includes('command -v specdev'), 'main guide provides the PATH fallback')
assert(mainMd.includes('[ -x .specdev/cache/bin/specdev ]'), 'main guide checks launcher executability')
assert(mainMd.includes('(_guides/workflow.md#roadmap)'), 'main guide links to Roadmap rules')
assert(mainMd.includes('(_guides/workflow.md#assignment)'), 'main guide links to Assignment rules')
for (const match of mainMd.matchAll(/\]\(([^)]+)\)/g)) {
  const [path, anchor] = match[1].split('#')
  const destination = join(TEST_DIR, '.specdev', path)
  assert(existsSync(destination), 'main-guide reference is installed: ' + path)
  if (anchor && existsSync(destination)) {
    const headings = [...readFileSync(destination, 'utf8').matchAll(/^#+ (.+)$/gm)]
      .map((heading) => heading[1].toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/ /g, '-'))
    assert(headings.includes(anchor), 'main-guide section exists: ' + match[1])
  }
}
for (const { path, heading } of Object.values(ADAPTERS)) {
  const adapter = readFileSync(join(TEST_DIR, path), 'utf8')
  assert(adapter === adapterContent(heading), path + ' installs the current adapter')
  assert(adapter.includes('.specdev/_main.md'), path + ' references the main guide')
  assert(!adapter.includes('develops SpecDev itself'), path + ' excludes source-repository advice')
}
for (const skillRoot of ['.claude', '.codex']) {
  const root = join(TEST_DIR, skillRoot, 'skills')
  const installedNames = readdirSync(root).filter((name) => name.startsWith('specdev-')).sort()
  assert(
    JSON.stringify(installedNames) === JSON.stringify(Object.keys(SKILL_FILES).sort()),
    skillRoot + ' installs the current skill set without retired skills'
  )
  for (const [name, content] of Object.entries(SKILL_FILES)) {
    const installed = readFileSync(join(root, name, 'SKILL.md'), 'utf8')
    assert(installed === content, skillRoot + '/' + name + ' installs current skill content')
    assert(installed.startsWith('---\nname: ' + name + '\n'), name + ' has matching skill metadata')
  }
}

// ---- Test hook installation ----
console.log('\nhook installation:')
const hookScript = join(TEST_DIR, '.claude', 'hooks', 'specdev-session-start.sh')
assert(existsSync(hookScript), '.claude/hooks/specdev-session-start.sh exists')
const hookContent = readFileSync(hookScript, 'utf-8')
const trackedHookContent = readFileSync(
  join(REPO_ROOT, '.claude', 'hooks', 'specdev-session-start.sh'),
  'utf-8'
)
assert(hookContent.startsWith('#!/usr/bin/env bash'), 'hook script starts with bash shebang')
assert(
  hookContent === trackedHookContent,
  '.claude tracked session hook matches the generated hook source'
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
