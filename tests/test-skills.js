import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync, openSync, closeSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanSkillsDir } from '../src/utils/skills.js'
import { createMockToolSkill } from './helpers.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-skills-output')

let failures = 0
let passes = 0
let result

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function runCmd(args) {
  return spawnSync('node', [CLI, ...args], { encoding: 'utf-8' })
}

function runCmdSafe(args) {
  if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true })
  const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const stdoutPath = join(TEST_DIR, `.tmp-${token}.stdout`)
  const stderrPath = join(TEST_DIR, `.tmp-${token}.stderr`)
  const outFd = openSync(stdoutPath, 'w')
  const errFd = openSync(stderrPath, 'w')
  const result = spawnSync('node', [CLI, ...args], { stdio: ['ignore', outFd, errFd] })
  closeSync(outFd)
  closeSync(errFd)
  const stdout = existsSync(stdoutPath) ? readFileSync(stdoutPath, 'utf-8') : ''
  const stderr = existsSync(stderrPath) ? readFileSync(stderrPath, 'utf-8') : ''
  rmSync(stdoutPath, { force: true })
  rmSync(stderrPath, { force: true })
  return { ...result, stdout, stderr }
}

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
}

// =====================================================================
// Skills Listing
// =====================================================================

cleanup()
const initResult = runCmd(['init', `--target=${TEST_DIR}`])
assert(initResult.status === 0, 'init succeeds')

const testSkillDir = join(TEST_DIR, '.specdev', 'skills', 'tools', 'test-folder-skill')
mkdirSync(testSkillDir, { recursive: true })
writeFileSync(join(testSkillDir, 'SKILL.md'), '---\nname: test-folder-skill\ndescription: A test skill\n---\n# Test\n')
mkdirSync(join(testSkillDir, 'scripts'), { recursive: true })
writeFileSync(join(testSkillDir, 'scripts', 'run.sh'), '#!/bin/bash\necho "ok"\n')

console.log('\nskills listing:')
const skillsResult = runCmd(['skills', `--target=${TEST_DIR}`])
assert(skillsResult.status === 0, 'skills command succeeds')

const coreSkills = await scanSkillsDir(join(TEST_DIR, '.specdev', 'skills', 'core'), 'core')
const toolSkills = await scanSkillsDir(join(TEST_DIR, '.specdev', 'skills', 'tools'), 'tool')
const allSkills = [...coreSkills, ...toolSkills]

assert(allSkills.some(s => s.name === 'verification-before-completion'), 'lists flat .md skills')

const folderSkill = allSkills.find(s => s.name === 'test-folder-skill')
assert(!!folderSkill, 'lists folder-based skills')
assert(folderSkill?.description === 'A test skill', 'shows folder skill description')
assert(folderSkill?.hasScripts === true, 'indicates scripts available')
assert(folderSkill?.path?.endsWith('.specdev/skills/tools/test-folder-skill'), 'scanner includes skill path')
assert(folderSkill?.skillMdPath?.endsWith('.specdev/skills/tools/test-folder-skill/SKILL.md'), 'scanner includes skill md path')

console.log('\nskills listing as json:')
result = runCmd(['skills', `--target=${TEST_DIR}`, '--json'])
assert(result.status === 0, 'skills --json succeeds', result.stderr)
const skillsJson = JSON.parse(result.stdout)
assert(skillsJson.command === 'skills', 'skills json command is skills')
assert(skillsJson.version === 1, 'skills json version is 1')
assert(skillsJson.status === 'ok', 'skills json status is ok')
assert(Array.isArray(skillsJson.skills), 'skills json includes skills array')
const jsonCore = skillsJson.skills.find((skill) => skill.name === 'brainstorming')
assert(jsonCore?.category === 'core', 'skills json includes core category')
assert(jsonCore?.path.endsWith('.specdev/skills/core/brainstorming'), 'skills json includes core path')
assert(jsonCore?.skill_md_path.endsWith('.specdev/skills/core/brainstorming/SKILL.md'), 'skills json includes skill md path')
assert(jsonCore?.has_scripts === true, 'skills json includes scripts flag')
assert(jsonCore?.active === undefined, 'core skills have no active flag')
const jsonTool = skillsJson.skills.find((skill) => skill.name === 'test-folder-skill')
assert(jsonTool?.category === 'tool', 'skills json includes tool category')
assert(jsonTool?.description === 'A test skill', 'skills json includes description')
assert(jsonTool?.active === false, 'uninstalled tool skill is inactive')

console.log('\nskills view:')
result = runCmd(['skills', 'view', 'brainstorming', `--target=${TEST_DIR}`])
assert(result.status === 0, 'skills view succeeds for core skill', result.stderr)
assert(result.stdout.includes('# Brainstorming'), 'skills view prints SKILL.md content')
assert(!result.stdout.includes('Available skills'), 'skills view does not print list output')

result = runCmd(['skills', 'view', 'test-folder-skill', 'scripts/run.sh', `--target=${TEST_DIR}`])
assert(result.status === 0, 'skills view succeeds for support file', result.stderr)
assert(result.stdout.includes('echo "ok"'), 'skills view prints support file content')

result = runCmd(['skills', 'view', 'test-folder-skill', '../active-tools.json', `--target=${TEST_DIR}`])
assert(result.status === 1, 'skills view blocks traversal')
assert(result.stderr.includes('Cannot read outside skill directory'), 'skills view explains traversal block')

result = runCmd(['skills', 'view', 'missing-skill', `--target=${TEST_DIR}`])
assert(result.status === 1, 'skills view fails for missing skill')
assert(result.stderr.includes('Unknown skill: missing-skill'), 'skills view reports missing skill')

// =====================================================================
// Skills Subcommands
// =====================================================================

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

console.log('\nskills (list):')
result = runCmd(['skills', `--target=${TEST_DIR}`])
assert(result.status === 0, 'skills list succeeds')
const coreSkills2 = await scanSkillsDir(join(TEST_DIR, '.specdev', 'skills', 'core'), 'core')
assert(coreSkills2.length > 0, 'shows core skills')

console.log('\nskills install (no selection):')
result = runCmd(['skills', 'install', `--target=${TEST_DIR}`])
assert(result.status !== null, 'skills install does not crash')

console.log('\nskills remove (no name):')
result = runCmd(['skills', 'remove', `--target=${TEST_DIR}`])
assert(result.status === 1, 'skills remove without name fails')

console.log('\nskills sync (empty):')
result = runCmd(['skills', 'sync', `--target=${TEST_DIR}`])
assert(result.status === 0, 'skills sync succeeds on empty state')

// =====================================================================
// Skills Install
// =====================================================================

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
createMockToolSkill(TEST_DIR, 'mock-tool')
mkdirSync(join(TEST_DIR, '.claude', 'skills'), { recursive: true })

console.log('\nskills install (with --skills):')
result = runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=mock-tool', '--agents=claude-code'])
assert(result.status === 0, 'install succeeds')

assert(existsSync(join(TEST_DIR, '.claude', 'skills', 'mock-tool', 'SKILL.md')), 'wrapper created for claude-code')
const wrapper = readFileSync(join(TEST_DIR, '.claude', 'skills', 'mock-tool', 'SKILL.md'), 'utf-8')
assert(wrapper.includes('name: mock-tool'), 'wrapper has name')
assert(wrapper.includes('.specdev/skills/tools/mock-tool/SKILL.md'), 'wrapper points to source skill')

const activeToolsPath = join(TEST_DIR, '.specdev', 'skills', 'active-tools.json')
assert(existsSync(activeToolsPath), 'active-tools.json created')
const activeTools = JSON.parse(readFileSync(activeToolsPath, 'utf-8'))
assert(activeTools.tools['mock-tool'] !== undefined, 'mock-tool in active tools')
assert(activeTools.tools['mock-tool'].wrappers.length > 0, 'wrappers tracked')
assert(activeTools.agents.includes('claude-code'), 'agents recorded')

console.log('\nskills install (unknown skill):')
result = runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=nonexistent', '--agents=claude-code'])
assert(result.status === 1, 'install fails for unknown skill')

console.log('\nskills install (multiple agents):')
mkdirSync(join(TEST_DIR, '.codex', 'skills'), { recursive: true })
result = runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=mock-tool', '--agents=claude-code,codex'])
assert(result.status === 0, 'install with multiple agents succeeds')
assert(existsSync(join(TEST_DIR, '.codex', 'skills', 'mock-tool', 'SKILL.md')), 'codex wrapper created')

// =====================================================================
// Skills Remove
// =====================================================================

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
mkdirSync(join(TEST_DIR, '.claude', 'skills'), { recursive: true })
createMockToolSkill(TEST_DIR, 'mock-tool')

runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=mock-tool', '--agents=claude-code'])
assert(existsSync(join(TEST_DIR, '.claude', 'skills', 'mock-tool', 'SKILL.md')), 'precondition: wrapper exists after install')

console.log('\nskills remove:')
result = runCmd(['skills', 'remove', 'mock-tool', `--target=${TEST_DIR}`])
assert(result.status === 0, 'remove succeeds')
assert(!existsSync(join(TEST_DIR, '.claude', 'skills', 'mock-tool', 'SKILL.md')), 'wrapper deleted')

const afterRemove = JSON.parse(readFileSync(join(TEST_DIR, '.specdev', 'skills', 'active-tools.json'), 'utf-8'))
assert(afterRemove.tools['mock-tool'] === undefined, 'removed from active-tools.json')

console.log('\nskills remove (unknown):')
result = runCmd(['skills', 'remove', 'nonexistent', `--target=${TEST_DIR}`])
assert(result.status === 1, 'remove fails for unknown skill')

// =====================================================================
// Skills Sync
// =====================================================================

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
mkdirSync(join(TEST_DIR, '.claude', 'skills'), { recursive: true })
createMockToolSkill(TEST_DIR, 'mock-tool')

runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=mock-tool', '--agents=claude-code'])
rmSync(join(TEST_DIR, '.claude', 'skills', 'mock-tool'), { recursive: true })

console.log('\nskills sync — regenerate missing wrapper:')
result = runCmd(['skills', 'sync', `--target=${TEST_DIR}`])
assert(result.status === 0, 'sync succeeds')
assert(existsSync(join(TEST_DIR, '.claude', 'skills', 'mock-tool', 'SKILL.md')), 'wrapper regenerated')

rmSync(join(TEST_DIR, '.specdev', 'skills', 'tools', 'mock-tool'), { recursive: true })

console.log('\nskills sync — remove stale entry:')
result = runCmd(['skills', 'sync', `--target=${TEST_DIR}`])
assert(result.status === 0, 'sync succeeds on stale')
assert(!existsSync(join(TEST_DIR, '.claude', 'skills', 'mock-tool', 'SKILL.md')), 'stale wrapper removed')
const afterStale = JSON.parse(readFileSync(join(TEST_DIR, '.specdev', 'skills', 'active-tools.json'), 'utf-8'))
assert(afterStale.tools['mock-tool'] === undefined, 'stale entry removed from active-tools.json')

console.log('\nskills sync — warn about available:')
const newToolDir = join(TEST_DIR, '.specdev', 'skills', 'tools', 'my-tool')
mkdirSync(newToolDir, { recursive: true })
writeFileSync(
  join(newToolDir, 'SKILL.md'),
  '---\nname: my-tool\ndescription: test\ntype: tool\n---\n# my-tool\n'
)
result = runCmd(['skills', 'sync', `--target=${TEST_DIR}`])
assert(result.status === 0, 'sync succeeds with available uninstalled tool')
const afterAvailable = JSON.parse(readFileSync(join(TEST_DIR, '.specdev', 'skills', 'active-tools.json'), 'utf-8'))
assert(afterAvailable.tools['my-tool'] === undefined, 'available tool remains uninstalled')

// =====================================================================
// Skills Status
// =====================================================================

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
mkdirSync(join(TEST_DIR, '.claude', 'skills'), { recursive: true })
createMockToolSkill(TEST_DIR, 'mock-tool')
runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=mock-tool', '--agents=claude-code'])

console.log('\nskills listing — after install:')
result = runCmdSafe(['skills', `--target=${TEST_DIR}`])
assert(result.stdout.includes('mock-tool'), 'shows mock-tool')
assert(result.stdout.includes('[active]'), 'shows [active] status')
assert(!result.stdout.match(/brainstorming.*\[(active|available)\]/), 'core skills have no status tag')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
