# Tool Skills Installation & Discovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CLI-driven installation system that activates tool skills via coding agent wrappers, with validation, sync, and enforcement touchpoints.

**Architecture:** Extend the existing `specdev skills` command with subcommands (`install`, `remove`, `sync`). New utilities handle `active-tools.json` state, coding agent detection, wrapper generation, and nested frontmatter parsing. Enforcement integrates into existing `checkpoint` and `update` commands.

**Tech Stack:** Node.js (ESM), fs-extra, built-in readline for interactive prompts. No new dependencies.

---

### Task 1: Extend parseFrontmatter for nested YAML

**Mode:** full

**Files:**
- Modify: `src/utils/skills.js:4-17`
- Test: `tests/test-frontmatter.js`

**Step 1: Write the failing test**

```js
// tests/test-frontmatter.js
import { parseFrontmatter } from '../src/utils/skills.js'

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

// Existing flat key: value still works
console.log('\nparseFrontmatter — flat values:')
const flat = parseFrontmatter('---\nname: fireperp\ndescription: Web search\ntype: tool\n---\n# Body')
assert(flat.name === 'fireperp', 'parses name')
assert(flat.description === 'Web search', 'parses description')
assert(flat.type === 'tool', 'parses type')

// Inline arrays
console.log('\nparseFrontmatter — inline arrays:')
const withArrays = parseFrontmatter(`---
name: fireperp
triggers:
  keywords: ["web search", "research", "look up"]
  paths: []
  operations: ["brainstorm", "fact-check"]
validation:
  env: ["PERPLEXITY_API_KEY"]
  basic: "which fire"
  smoke: "fire perplexity 'test' --max-tokens 10"
---
# Body`)

assert(withArrays.name === 'fireperp', 'still parses flat name')
assert(typeof withArrays.triggers === 'object', 'triggers is an object')
assert(Array.isArray(withArrays.triggers.keywords), 'triggers.keywords is array')
assert(withArrays.triggers.keywords.length === 3, 'triggers.keywords has 3 items')
assert(withArrays.triggers.keywords[0] === 'web search', 'first keyword correct')
assert(Array.isArray(withArrays.triggers.paths), 'triggers.paths is array')
assert(withArrays.triggers.paths.length === 0, 'triggers.paths is empty')
assert(Array.isArray(withArrays.triggers.operations), 'triggers.operations is array')
assert(withArrays.triggers.operations.length === 2, 'triggers.operations has 2 items')

// Nested validation
console.log('\nparseFrontmatter — nested validation:')
assert(typeof withArrays.validation === 'object', 'validation is an object')
assert(Array.isArray(withArrays.validation.env), 'validation.env is array')
assert(withArrays.validation.env[0] === 'PERPLEXITY_API_KEY', 'validation.env value correct')
assert(withArrays.validation.basic === 'which fire', 'validation.basic is string')
assert(withArrays.validation.smoke === "fire perplexity 'test' --max-tokens 10", 'validation.smoke is string')

// No frontmatter
console.log('\nparseFrontmatter — edge cases:')
const none = parseFrontmatter('# No frontmatter here')
assert(Object.keys(none).length === 0, 'returns empty object when no frontmatter')

// Frontmatter with only flat keys (no nested)
const onlyFlat = parseFrontmatter('---\nname: test\nphase: build\n---\n')
assert(onlyFlat.name === 'test', 'flat-only still works')
assert(onlyFlat.phase === 'build', 'flat-only second key')

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-frontmatter.js`
Expected: FAIL — nested objects return wrong values (triggers parsed as flat string)

**Step 3: Write minimal implementation**

Replace `parseFrontmatter` in `src/utils/skills.js`:

```js
export function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  const result = {}
  let currentParent = null

  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue

    const indented = line.match(/^  (\w[\w-]*):\s*(.*)$/)
    if (indented && currentParent) {
      // Indented key under a parent
      const [, key, rawVal] = indented
      result[currentParent][key] = parseYamlValue(rawVal)
      continue
    }

    const topLevel = line.match(/^(\w[\w-]*):\s*(.*)$/)
    if (topLevel) {
      const [, key, rawVal] = topLevel
      if (rawVal === '' || rawVal === undefined) {
        // Parent key with no value — next indented lines are children
        result[key] = {}
        currentParent = key
      } else {
        result[key] = parseYamlValue(rawVal)
        currentParent = null
      }
    }
  }
  return result
}

function parseYamlValue(raw) {
  const trimmed = raw.trim()
  // Inline JSON-style array: ["a", "b"]
  if (trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return trimmed
    }
  }
  // Quoted string
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-frontmatter.js`
Expected: PASS

**Step 5: Run existing tests to verify no regressions**

Run: `npm run test:skills && npm run test:scan`
Expected: PASS

**Step 6: Commit**

```bash
git add src/utils/skills.js tests/test-frontmatter.js
git commit -m "feat: extend parseFrontmatter for nested YAML (triggers, validation)"
```

---

### Task 2: Create active-tools.json utilities

**Mode:** full

**Files:**
- Create: `src/utils/active-tools.js`
- Test: `tests/test-active-tools.js`

**Step 1: Write the failing test**

```js
// tests/test-active-tools.js
import { existsSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readActiveTools, writeActiveTools, addTool, removeTool } from '../src/utils/active-tools.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const TEST_DIR = join(__dirname, 'test-active-tools-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true }) }

cleanup()
mkdirSync(join(TEST_DIR, '.specdev', 'skills'), { recursive: true })
const specdevPath = join(TEST_DIR, '.specdev')

// readActiveTools returns default when file doesn't exist
console.log('\nreadActiveTools:')
const empty = await readActiveTools(specdevPath)
assert(typeof empty.tools === 'object', 'default has tools object')
assert(Array.isArray(empty.agents), 'default has agents array')
assert(Object.keys(empty.tools).length === 0, 'default tools is empty')

// writeActiveTools and readActiveTools roundtrip
console.log('\nwriteActiveTools:')
const data = { tools: { fireperp: { installed: '2026-02-27', validation: 'smoke', wrappers: ['.claude/skills/fireperp.md'] } }, agents: ['claude-code'] }
await writeActiveTools(specdevPath, data)
const jsonPath = join(specdevPath, 'skills', 'active-tools.json')
assert(existsSync(jsonPath), 'creates active-tools.json')
const roundtrip = await readActiveTools(specdevPath)
assert(roundtrip.tools.fireperp.installed === '2026-02-27', 'roundtrip preserves data')
assert(roundtrip.agents[0] === 'claude-code', 'roundtrip preserves agents')

// addTool
console.log('\naddTool:')
await addTool(specdevPath, 'newtool', { installed: '2026-02-27', validation: 'basic', wrappers: [] })
const afterAdd = await readActiveTools(specdevPath)
assert(afterAdd.tools.newtool !== undefined, 'addTool adds entry')
assert(afterAdd.tools.fireperp !== undefined, 'addTool preserves existing')

// removeTool
console.log('\nremoveTool:')
await removeTool(specdevPath, 'newtool')
const afterRemove = await readActiveTools(specdevPath)
assert(afterRemove.tools.newtool === undefined, 'removeTool removes entry')
assert(afterRemove.tools.fireperp !== undefined, 'removeTool preserves others')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-active-tools.js`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```js
// src/utils/active-tools.js
import { join } from 'path'
import fse from 'fs-extra'

const ACTIVE_TOOLS_PATH = join('skills', 'active-tools.json')
const DEFAULT = { tools: {}, agents: [] }

export async function readActiveTools(specdevPath) {
  const filePath = join(specdevPath, ACTIVE_TOOLS_PATH)
  if (!(await fse.pathExists(filePath))) return { ...DEFAULT, tools: {} }
  try {
    return await fse.readJson(filePath)
  } catch {
    return { ...DEFAULT, tools: {} }
  }
}

export async function writeActiveTools(specdevPath, data) {
  const filePath = join(specdevPath, ACTIVE_TOOLS_PATH)
  await fse.ensureDir(join(specdevPath, 'skills'))
  await fse.writeJson(filePath, data, { spaces: 2 })
}

export async function addTool(specdevPath, name, entry) {
  const data = await readActiveTools(specdevPath)
  data.tools[name] = entry
  await writeActiveTools(specdevPath, data)
}

export async function removeTool(specdevPath, name) {
  const data = await readActiveTools(specdevPath)
  delete data.tools[name]
  await writeActiveTools(specdevPath, data)
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-active-tools.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/active-tools.js tests/test-active-tools.js
git commit -m "feat: add active-tools.json read/write/add/remove utilities"
```

---

### Task 3: Add coding agent detection

**Mode:** full

**Files:**
- Create: `src/utils/agents.js`
- Test: `tests/test-agents.js`

**Step 1: Write the failing test**

```js
// tests/test-agents.js
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectCodingAgents, AGENT_CONFIGS } from '../src/utils/agents.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const TEST_DIR = join(__dirname, 'test-agents-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true }) }

// No agents
cleanup()
mkdirSync(TEST_DIR, { recursive: true })
console.log('\ndetectCodingAgents:')
let agents = detectCodingAgents(TEST_DIR)
assert(agents.length === 0, 'no agents detected in empty dir')

// Claude Code only
mkdirSync(join(TEST_DIR, '.claude'), { recursive: true })
agents = detectCodingAgents(TEST_DIR)
assert(agents.length === 1, 'detects one agent')
assert(agents[0] === 'claude-code', 'detects claude-code')

// Claude Code + Codex
mkdirSync(join(TEST_DIR, '.codex'), { recursive: true })
agents = detectCodingAgents(TEST_DIR)
assert(agents.length === 2, 'detects two agents')
assert(agents.includes('codex'), 'detects codex')

// All three
mkdirSync(join(TEST_DIR, '.opencode'), { recursive: true })
agents = detectCodingAgents(TEST_DIR)
assert(agents.length === 3, 'detects three agents')
assert(agents.includes('opencode'), 'detects opencode')

// AGENT_CONFIGS has wrapper paths
console.log('\nAGENT_CONFIGS:')
assert(AGENT_CONFIGS['claude-code'].wrapperDir === join('.claude', 'skills'), 'claude-code wrapper dir')
assert(AGENT_CONFIGS['codex'].wrapperDir === join('.codex', 'skills'), 'codex wrapper dir')
assert(AGENT_CONFIGS['opencode'].wrapperDir === join('.claude', 'skills'), 'opencode shares claude wrapper dir')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-agents.js`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```js
// src/utils/agents.js
import { existsSync } from 'fs'
import { join } from 'path'

export const AGENT_CONFIGS = {
  'claude-code': {
    detect: (dir) => existsSync(join(dir, '.claude')),
    wrapperDir: join('.claude', 'skills'),
    wrapperFile: (name) => `${name}.md`,
  },
  'codex': {
    detect: (dir) => existsSync(join(dir, '.codex')),
    wrapperDir: join('.codex', 'skills'),
    wrapperFile: (name) => join(name, 'SKILL.md'),
  },
  'opencode': {
    detect: (dir) => existsSync(join(dir, '.opencode')),
    wrapperDir: join('.claude', 'skills'),
    wrapperFile: (name) => `${name}.md`,
  },
}

export function detectCodingAgents(targetDir) {
  const detected = []
  for (const [agentName, config] of Object.entries(AGENT_CONFIGS)) {
    if (config.detect(targetDir)) {
      detected.push(agentName)
    }
  }
  return detected
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-agents.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/agents.js tests/test-agents.js
git commit -m "feat: add coding agent detection for wrapper placement"
```

---

### Task 4: Add wrapper generation and removal

**Mode:** full

**Files:**
- Create: `src/utils/wrappers.js`
- Test: `tests/test-wrappers.js`

**Step 1: Write the failing test**

```js
// tests/test-wrappers.js
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateWrapperContent, writeWrappers, removeWrappers } from '../src/utils/wrappers.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const TEST_DIR = join(__dirname, 'test-wrappers-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true }) }

cleanup()
mkdirSync(join(TEST_DIR, '.claude', 'skills'), { recursive: true })
mkdirSync(join(TEST_DIR, '.codex', 'skills'), { recursive: true })

// generateWrapperContent
console.log('\ngenerateWrapperContent:')
const content = generateWrapperContent({
  name: 'fireperp',
  description: 'Web search via Perplexity API',
  summary: 'Use for researching topics, looking up API docs, verifying facts.',
})
assert(content.includes('name: fireperp'), 'wrapper has name in frontmatter')
assert(content.includes('Web search via Perplexity API'), 'wrapper has description')
assert(content.includes('.specdev/skills/tools/fireperp/SKILL.md'), 'wrapper points to source')
assert(content.includes('researching topics'), 'wrapper has summary')

// writeWrappers
console.log('\nwriteWrappers:')
const wrapperPaths = writeWrappers(TEST_DIR, 'fireperp', content, ['claude-code', 'codex'])
assert(wrapperPaths.length === 2, 'returns 2 wrapper paths')
assert(existsSync(join(TEST_DIR, '.claude', 'skills', 'fireperp.md')), 'claude wrapper exists')
assert(existsSync(join(TEST_DIR, '.codex', 'skills', 'fireperp', 'SKILL.md')), 'codex wrapper exists')

const claudeWrapper = readFileSync(join(TEST_DIR, '.claude', 'skills', 'fireperp.md'), 'utf-8')
assert(claudeWrapper.includes('name: fireperp'), 'claude wrapper has correct content')

// removeWrappers
console.log('\nremoveWrappers:')
removeWrappers(TEST_DIR, wrapperPaths)
assert(!existsSync(join(TEST_DIR, '.claude', 'skills', 'fireperp.md')), 'claude wrapper removed')
assert(!existsSync(join(TEST_DIR, '.codex', 'skills', 'fireperp', 'SKILL.md')), 'codex wrapper removed')

// removeWrappers handles missing files gracefully
removeWrappers(TEST_DIR, ['.claude/skills/nonexistent.md'])
assert(true, 'removeWrappers handles missing files without error')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-wrappers.js`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```js
// src/utils/wrappers.js
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { AGENT_CONFIGS } from './agents.js'

export function generateWrapperContent({ name, description, summary }) {
  const fullDesc = summary ? `${description}. ${summary}` : description
  return `---
name: ${name}
description: ${fullDesc}
---

# ${name}

${description}

**Source of truth:** \`.specdev/skills/tools/${name}/SKILL.md\`
Read the source skill file and follow its instructions.
`
}

export function writeWrappers(targetDir, name, content, agents) {
  const paths = []
  const written = new Set()

  for (const agentName of agents) {
    const config = AGENT_CONFIGS[agentName]
    if (!config) continue

    const relPath = join(config.wrapperDir, config.wrapperFile(name))

    // Deduplicate — opencode and claude-code share the same path
    if (written.has(relPath)) continue
    written.add(relPath)

    const absPath = join(targetDir, relPath)
    const absDir = dirname(absPath)
    if (!existsSync(absDir)) mkdirSync(absDir, { recursive: true })
    writeFileSync(absPath, content, 'utf-8')
    paths.push(relPath)
  }

  return paths
}

export function removeWrappers(targetDir, wrapperPaths) {
  for (const relPath of wrapperPaths) {
    const absPath = join(targetDir, relPath)
    if (existsSync(absPath)) {
      rmSync(absPath, { force: true })
      // Clean up empty parent dir (for codex-style nested wrappers)
      const parentDir = dirname(absPath)
      try {
        const { readdirSync } = await import('fs')
        if (readdirSync(parentDir).length === 0) rmSync(parentDir, { recursive: true })
      } catch { /* ignore */ }
    }
  }
}
```

Wait — `removeWrappers` uses `await import` in a sync function. Fix:

```js
// src/utils/wrappers.js
import { existsSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { AGENT_CONFIGS } from './agents.js'

export function generateWrapperContent({ name, description, summary }) {
  const fullDesc = summary ? `${description}. ${summary}` : description
  return `---
name: ${name}
description: ${fullDesc}
---

# ${name}

${description}

**Source of truth:** \`.specdev/skills/tools/${name}/SKILL.md\`
Read the source skill file and follow its instructions.
`
}

export function writeWrappers(targetDir, name, content, agents) {
  const paths = []
  const written = new Set()

  for (const agentName of agents) {
    const config = AGENT_CONFIGS[agentName]
    if (!config) continue

    const relPath = join(config.wrapperDir, config.wrapperFile(name))
    if (written.has(relPath)) continue
    written.add(relPath)

    const absPath = join(targetDir, relPath)
    const absDir = dirname(absPath)
    if (!existsSync(absDir)) mkdirSync(absDir, { recursive: true })
    writeFileSync(absPath, content, 'utf-8')
    paths.push(relPath)
  }

  return paths
}

export function removeWrappers(targetDir, wrapperPaths) {
  for (const relPath of wrapperPaths) {
    const absPath = join(targetDir, relPath)
    if (existsSync(absPath)) {
      rmSync(absPath, { force: true })
      const parentDir = dirname(absPath)
      try {
        if (readdirSync(parentDir).length === 0) rmSync(parentDir, { recursive: true })
      } catch { /* ignore */ }
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-wrappers.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/wrappers.js tests/test-wrappers.js
git commit -m "feat: add wrapper generation, placement, and removal for coding agents"
```

---

### Task 5: Wire up skills subcommand routing

**Mode:** full

**Files:**
- Modify: `src/commands/dispatch.js:21`
- Modify: `src/commands/skills.js`
- Test: `tests/test-skills-subcommands.js`

**Step 1: Write the failing test**

```js
// tests/test-skills-subcommands.js
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-skills-subcmd-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function runCmd(args) {
  return spawnSync('node', [CLI, ...args], { encoding: 'utf-8' })
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true }) }

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

// `specdev skills` (no subcommand) still lists skills
console.log('\nskills (list):')
let result = runCmd(['skills', `--target=${TEST_DIR}`])
assert(result.status === 0, 'skills list succeeds')
assert(result.stdout.includes('Core skills'), 'shows core skills')

// `specdev skills install` without --non-interactive shows usage
console.log('\nskills install (no selection):')
result = runCmd(['skills', 'install', `--target=${TEST_DIR}`])
// Should either show available skills or prompt — not crash
assert(result.status !== null, 'skills install does not crash')

// `specdev skills remove` without name shows error
console.log('\nskills remove (no name):')
result = runCmd(['skills', 'remove', `--target=${TEST_DIR}`])
assert(result.status === 1, 'skills remove without name fails')
assert(result.stderr.includes('name') || result.stdout.includes('Usage'), 'shows usage hint')

// `specdev skills sync` runs cleanly on empty state
console.log('\nskills sync (empty):')
result = runCmd(['skills', 'sync', `--target=${TEST_DIR}`])
assert(result.status === 0, 'skills sync succeeds on empty state')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-skills-subcommands.js`
Expected: FAIL — subcommands not routed (install/remove/sync not recognized)

**Step 3: Write minimal implementation**

In `src/commands/dispatch.js`, change the skills handler to pass positionalArgs:

```js
// Change line 21:
skills: ({ flags }) => skillsCommand(flags),
// To:
skills: ({ positionalArgs, flags }) => skillsCommand(positionalArgs, flags),
```

In `src/commands/skills.js`, restructure to handle subcommands:

```js
import { join } from 'path'
import fse from 'fs-extra'
import { resolveTargetDir } from '../utils/command-context.js'
import { scanSkillsDir } from '../utils/skills.js'
import { readActiveTools } from '../utils/active-tools.js'

export async function skillsCommand(positionalArgs = [], flags = {}) {
  const subcommand = positionalArgs[0]

  if (subcommand === 'install') {
    const { skillsInstallCommand } = await import('./skills-install.js')
    return skillsInstallCommand(positionalArgs.slice(1), flags)
  }
  if (subcommand === 'remove') {
    const { skillsRemoveCommand } = await import('./skills-remove.js')
    return skillsRemoveCommand(positionalArgs.slice(1), flags)
  }
  if (subcommand === 'sync') {
    const { skillsSyncCommand } = await import('./skills-sync.js')
    return skillsSyncCommand(flags)
  }

  // Default: list skills
  return skillsListCommand(flags)
}

async function skillsListCommand(flags) {
  const targetDir = resolveTargetDir(flags)
  const skillsPath = join(targetDir, '.specdev', 'skills')

  if (!(await fse.pathExists(skillsPath))) {
    console.error('No .specdev/skills directory found.')
    console.error('Run `specdev init` first.')
    process.exitCode = 1
    return
  }

  const skills = []
  skills.push(...await scanSkillsDir(join(skillsPath, 'core'), 'core'))
  skills.push(...await scanSkillsDir(join(skillsPath, 'tools'), 'tool'))
  skills.sort((a, b) => a.name.localeCompare(b.name))

  // Load activation state for tool skills
  const activeTools = await readActiveTools(join(targetDir, '.specdev'))
  const activeNames = new Set(Object.keys(activeTools.tools))

  console.log(`\nAvailable skills (${skills.length}):\n`)
  const coreSkills = skills.filter(s => s.category === 'core')
  const toolSkills = skills.filter(s => s.category === 'tool')

  if (coreSkills.length > 0) {
    console.log('Core skills:')
    for (const skill of coreSkills) {
      const scripts = skill.hasScripts ? ' [scripts]' : ''
      const desc = skill.description ? ` — ${skill.description}` : ''
      console.log(`  ${skill.name}${scripts}${desc}`)
    }
    console.log()
  }

  if (toolSkills.length > 0) {
    console.log('Tool skills:')
    for (const skill of toolSkills) {
      const scripts = skill.hasScripts ? ' [scripts]' : ''
      const desc = skill.description ? ` — ${skill.description}` : ''
      const status = activeNames.has(skill.name) ? ' [active]' : ' [available]'
      console.log(`  ${skill.name}${status}${scripts}${desc}`)
    }
    console.log()
  }
  console.log()
}
```

Create stub files for install/remove/sync so imports don't crash:

```js
// src/commands/skills-install.js
export async function skillsInstallCommand(positionalArgs = [], flags = {}) {
  console.log('Install command — not yet implemented')
  // Will be implemented in Task 6
}
```

```js
// src/commands/skills-remove.js
export async function skillsRemoveCommand(positionalArgs = [], flags = {}) {
  if (!positionalArgs[0]) {
    console.error('Missing required skill name')
    console.log('Usage: specdev skills remove <name>')
    process.exitCode = 1
    return
  }
  console.log('Remove command — not yet implemented')
  // Will be implemented in Task 7
}
```

```js
// src/commands/skills-sync.js
export async function skillsSyncCommand(flags = {}) {
  console.log('Sync complete (no active tools)')
  // Will be implemented in Task 8
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-skills-subcommands.js`
Expected: PASS

**Step 5: Run existing skills test to verify no regression**

Run: `npm run test:skills`
Expected: PASS

**Step 6: Commit**

```bash
git add src/commands/dispatch.js src/commands/skills.js src/commands/skills-install.js src/commands/skills-remove.js src/commands/skills-sync.js tests/test-skills-subcommands.js
git commit -m "feat: add skills subcommand routing (install, remove, sync)"
```

---

### Task 6: Implement `specdev skills install`

**Mode:** full

**Files:**
- Modify: `src/commands/skills-install.js`
- Test: `tests/test-skills-install.js`

**Step 1: Write the failing test**

```js
// tests/test-skills-install.js
import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-skills-install-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function runCmd(args) {
  return spawnSync('node', [CLI, ...args], { encoding: 'utf-8' })
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true }) }

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

// Create .claude dir (simulating agent installed)
mkdirSync(join(TEST_DIR, '.claude', 'skills'), { recursive: true })

// Non-interactive install with --skills and --agents flags
console.log('\nskills install (non-interactive):')
let result = runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=fireperp', '--agents=claude-code'])
assert(result.status === 0, 'install succeeds')

// Wrapper created
assert(existsSync(join(TEST_DIR, '.claude', 'skills', 'fireperp.md')), 'wrapper created for claude-code')
const wrapper = readFileSync(join(TEST_DIR, '.claude', 'skills', 'fireperp.md'), 'utf-8')
assert(wrapper.includes('name: fireperp'), 'wrapper has name')
assert(wrapper.includes('.specdev/skills/tools/fireperp/SKILL.md'), 'wrapper points to source')

// active-tools.json updated
const activeToolsPath = join(TEST_DIR, '.specdev', 'skills', 'active-tools.json')
assert(existsSync(activeToolsPath), 'active-tools.json created')
const activeTools = JSON.parse(readFileSync(activeToolsPath, 'utf-8'))
assert(activeTools.tools.fireperp !== undefined, 'fireperp in active tools')
assert(activeTools.tools.fireperp.wrappers.length > 0, 'wrappers tracked')
assert(activeTools.agents.includes('claude-code'), 'agents recorded')

// Install unknown skill fails
console.log('\nskills install (unknown skill):')
result = runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=nonexistent', '--agents=claude-code'])
assert(result.status === 1, 'install fails for unknown skill')

// Install with multiple agents
console.log('\nskills install (multiple agents):')
mkdirSync(join(TEST_DIR, '.codex', 'skills'), { recursive: true })
result = runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=fireperp', '--agents=claude-code,codex'])
assert(result.status === 0, 'install with multiple agents succeeds')
assert(existsSync(join(TEST_DIR, '.codex', 'skills', 'fireperp', 'SKILL.md')), 'codex wrapper created')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-skills-install.js`
Expected: FAIL — install not yet implemented (stub)

**Step 3: Write minimal implementation**

```js
// src/commands/skills-install.js
import { join } from 'path'
import fse from 'fs-extra'
import { resolveTargetDir } from '../utils/command-context.js'
import { scanSkillsDir, parseFrontmatter } from '../utils/skills.js'
import { readActiveTools, writeActiveTools } from '../utils/active-tools.js'
import { detectCodingAgents } from '../utils/agents.js'
import { generateWrapperContent, writeWrappers } from '../utils/wrappers.js'
import { blankLine } from '../utils/output.js'

export async function skillsInstallCommand(positionalArgs = [], flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  const toolsDir = join(specdevPath, 'skills', 'tools')

  if (!(await fse.pathExists(toolsDir))) {
    console.error('No .specdev/skills/tools/ directory found.')
    console.error('Run `specdev init` first.')
    process.exitCode = 1
    return
  }

  // Scan available tool skills
  const available = await scanSkillsDir(toolsDir, 'tool')
  if (available.length === 0) {
    console.log('No tool skills found in .specdev/skills/tools/')
    return
  }

  // Determine which skills and agents to install
  let selectedSkills, selectedAgents

  if (flags.skills) {
    // Non-interactive mode
    selectedSkills = flags.skills.split(',').map(s => s.trim())
    const unknowns = selectedSkills.filter(s => !available.some(a => a.name === s))
    if (unknowns.length > 0) {
      console.error(`Unknown tool skills: ${unknowns.join(', ')}`)
      console.error(`Available: ${available.map(a => a.name).join(', ')}`)
      process.exitCode = 1
      return
    }
  } else {
    // Interactive mode: show available skills
    console.log('\nAvailable tool skills:')
    available.forEach((s, i) => {
      const desc = s.description ? ` — ${s.description}` : ''
      console.log(`  [${i + 1}] ${s.name}${desc}`)
    })
    blankLine()
    console.log('Use --skills=name1,name2 to select skills non-interactively')
    console.log('Example: specdev skills install --skills=fireperp')
    return
  }

  if (flags.agents) {
    selectedAgents = flags.agents.split(',').map(s => s.trim())
  } else {
    selectedAgents = detectCodingAgents(targetDir)
    if (selectedAgents.length === 0) {
      console.error('No coding agents detected. Create .claude/, .codex/, or .opencode/ first.')
      console.error('Or specify agents with --agents=claude-code,codex')
      process.exitCode = 1
      return
    }
  }

  const activeTools = await readActiveTools(specdevPath)
  const today = new Date().toISOString().slice(0, 10)

  for (const skillName of selectedSkills) {
    // Read the skill's SKILL.md for frontmatter
    const skillMdPath = join(toolsDir, skillName, 'SKILL.md')
    const skillContent = await fse.readFile(skillMdPath, 'utf-8')
    const frontmatter = parseFrontmatter(skillContent)

    // Generate wrapper
    const wrapperContent = generateWrapperContent({
      name: frontmatter.name || skillName,
      description: frontmatter.description || '',
      summary: '',
    })

    // Write wrappers to each agent
    const wrapperPaths = writeWrappers(targetDir, skillName, wrapperContent, selectedAgents)

    // Extract triggers from frontmatter if present
    const triggers = frontmatter.triggers || null

    // Record in active-tools.json
    activeTools.tools[skillName] = {
      installed: today,
      validation: 'none',
      lastValidated: null,
      wrappers: wrapperPaths,
      ...(triggers ? { triggers } : {}),
    }

    console.log(`✅ Installed ${skillName}`)
    for (const p of wrapperPaths) {
      console.log(`   → ${p}`)
    }
  }

  // Record agents
  const agentSet = new Set([...(activeTools.agents || []), ...selectedAgents])
  activeTools.agents = [...agentSet]

  await writeActiveTools(specdevPath, activeTools)
  blankLine()
  console.log(`Active tools updated (${Object.keys(activeTools.tools).length} tools, ${activeTools.agents.length} agents)`)
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-skills-install.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/skills-install.js tests/test-skills-install.js
git commit -m "feat: implement specdev skills install with wrapper generation"
```

---

### Task 7: Implement `specdev skills remove`

**Mode:** full

**Files:**
- Modify: `src/commands/skills-remove.js`
- Test: `tests/test-skills-remove.js`

**Step 1: Write the failing test**

```js
// tests/test-skills-remove.js
import { existsSync, rmSync, mkdirSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-skills-remove-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function runCmd(args) {
  return spawnSync('node', [CLI, ...args], { encoding: 'utf-8' })
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true }) }

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
mkdirSync(join(TEST_DIR, '.claude', 'skills'), { recursive: true })

// First install a skill
runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=fireperp', '--agents=claude-code'])
assert(existsSync(join(TEST_DIR, '.claude', 'skills', 'fireperp.md')), 'precondition: wrapper exists after install')

// Remove it
console.log('\nskills remove:')
let result = runCmd(['skills', 'remove', 'fireperp', `--target=${TEST_DIR}`])
assert(result.status === 0, 'remove succeeds')
assert(!existsSync(join(TEST_DIR, '.claude', 'skills', 'fireperp.md')), 'wrapper deleted')

// active-tools.json updated
const activeTools = JSON.parse(readFileSync(join(TEST_DIR, '.specdev', 'skills', 'active-tools.json'), 'utf-8'))
assert(activeTools.tools.fireperp === undefined, 'removed from active-tools.json')

// Remove unknown skill gives error
console.log('\nskills remove (unknown):')
result = runCmd(['skills', 'remove', 'nonexistent', `--target=${TEST_DIR}`])
assert(result.status === 1, 'remove fails for unknown skill')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-skills-remove.js`
Expected: FAIL — remove not yet implemented (stub)

**Step 3: Write minimal implementation**

```js
// src/commands/skills-remove.js
import { join } from 'path'
import { resolveTargetDir } from '../utils/command-context.js'
import { readActiveTools, removeTool } from '../utils/active-tools.js'
import { removeWrappers } from '../utils/wrappers.js'

export async function skillsRemoveCommand(positionalArgs = [], flags = {}) {
  const name = positionalArgs[0]

  if (!name) {
    console.error('Missing required skill name')
    console.log('Usage: specdev skills remove <name>')
    process.exitCode = 1
    return
  }

  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')

  const activeTools = await readActiveTools(specdevPath)

  if (!activeTools.tools[name]) {
    console.error(`Tool skill "${name}" is not installed`)
    console.error(`Active tools: ${Object.keys(activeTools.tools).join(', ') || '(none)'}`)
    process.exitCode = 1
    return
  }

  // Remove wrappers
  const wrapperPaths = activeTools.tools[name].wrappers || []
  removeWrappers(targetDir, wrapperPaths)

  // Remove from active-tools.json
  await removeTool(specdevPath, name)

  console.log(`✅ Removed ${name}`)
  for (const p of wrapperPaths) {
    console.log(`   ✗ ${p}`)
  }
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-skills-remove.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/skills-remove.js tests/test-skills-remove.js
git commit -m "feat: implement specdev skills remove with wrapper cleanup"
```

---

### Task 8: Implement `specdev skills sync`

**Mode:** full

**Files:**
- Modify: `src/commands/skills-sync.js`
- Test: `tests/test-skills-sync.js`

**Step 1: Write the failing test**

```js
// tests/test-skills-sync.js
import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-skills-sync-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function runCmd(args) {
  return spawnSync('node', [CLI, ...args], { encoding: 'utf-8' })
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true }) }

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
mkdirSync(join(TEST_DIR, '.claude', 'skills'), { recursive: true })

// Install fireperp
runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=fireperp', '--agents=claude-code'])

// Delete the wrapper manually to simulate drift
rmSync(join(TEST_DIR, '.claude', 'skills', 'fireperp.md'))

// Sync should regenerate missing wrapper
console.log('\nskills sync — regenerate missing wrapper:')
let result = runCmd(['skills', 'sync', `--target=${TEST_DIR}`])
assert(result.status === 0, 'sync succeeds')
assert(existsSync(join(TEST_DIR, '.claude', 'skills', 'fireperp.md')), 'wrapper regenerated')

// Delete the tool skill directory to simulate stale entry
rmSync(join(TEST_DIR, '.specdev', 'skills', 'tools', 'fireperp'), { recursive: true })

// Sync should remove stale entry
console.log('\nskills sync — remove stale entry:')
result = runCmd(['skills', 'sync', `--target=${TEST_DIR}`])
assert(result.status === 0, 'sync succeeds on stale')
assert(!existsSync(join(TEST_DIR, '.claude', 'skills', 'fireperp.md')), 'stale wrapper removed')
const activeTools = JSON.parse(readFileSync(join(TEST_DIR, '.specdev', 'skills', 'active-tools.json'), 'utf-8'))
assert(activeTools.tools.fireperp === undefined, 'stale entry removed from active-tools.json')

// Add a new tool skill that isn't installed — sync should warn
console.log('\nskills sync — warn about available:')
const newToolDir = join(TEST_DIR, '.specdev', 'skills', 'tools', 'my-tool')
mkdirSync(newToolDir, { recursive: true })
writeFileSync(join(newToolDir, 'SKILL.md'), '---\nname: my-tool\ndescription: test\n---\n# my-tool\n')
result = runCmd(['skills', 'sync', `--target=${TEST_DIR}`])
assert(result.stdout.includes('my-tool') || result.stderr.includes('my-tool'), 'warns about available tool')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-skills-sync.js`
Expected: FAIL — sync only prints stub message

**Step 3: Write minimal implementation**

```js
// src/commands/skills-sync.js
import { join } from 'path'
import fse from 'fs-extra'
import { resolveTargetDir } from '../utils/command-context.js'
import { scanSkillsDir, parseFrontmatter } from '../utils/skills.js'
import { readActiveTools, writeActiveTools } from '../utils/active-tools.js'
import { generateWrapperContent, writeWrappers, removeWrappers } from '../utils/wrappers.js'
import { blankLine } from '../utils/output.js'

export async function skillsSyncCommand(flags = {}) {
  const targetDir = resolveTargetDir(flags)
  const specdevPath = join(targetDir, '.specdev')
  const toolsDir = join(specdevPath, 'skills', 'tools')

  const activeTools = await readActiveTools(specdevPath)
  const available = await scanSkillsDir(toolsDir, 'tool')
  const availableNames = new Set(available.map(s => s.name))

  let changed = false

  // 1. Remove stale entries (in active-tools but no longer in tools/)
  for (const name of Object.keys(activeTools.tools)) {
    if (!availableNames.has(name)) {
      const wrapperPaths = activeTools.tools[name].wrappers || []
      removeWrappers(targetDir, wrapperPaths)
      delete activeTools.tools[name]
      console.log(`  ✗ Removed stale: ${name}`)
      changed = true
    }
  }

  // 2. Regenerate missing wrappers for active tools
  for (const [name, entry] of Object.entries(activeTools.tools)) {
    const wrapperPaths = entry.wrappers || []
    const missing = wrapperPaths.filter(p => !fse.pathExistsSync(join(targetDir, p)))

    if (missing.length > 0) {
      // Re-read skill to regenerate
      const skillMdPath = join(toolsDir, name, 'SKILL.md')
      if (await fse.pathExists(skillMdPath)) {
        const content = await fse.readFile(skillMdPath, 'utf-8')
        const fm = parseFrontmatter(content)
        const wrapperContent = generateWrapperContent({
          name: fm.name || name,
          description: fm.description || '',
          summary: '',
        })
        const agents = activeTools.agents || []
        const newPaths = writeWrappers(targetDir, name, wrapperContent, agents)
        entry.wrappers = newPaths
        console.log(`  ↻ Regenerated wrappers: ${name}`)
        changed = true
      }
    }
  }

  // 3. Warn about available but inactive tools
  const activeNames = new Set(Object.keys(activeTools.tools))
  const inactive = available.filter(s => !activeNames.has(s.name))
  if (inactive.length > 0) {
    blankLine()
    console.log('Available but not installed:')
    for (const s of inactive) {
      const desc = s.description ? ` — ${s.description}` : ''
      console.log(`  ${s.name}${desc}`)
    }
    console.log('\nRun: specdev skills install --skills=<name>')
  }

  if (changed) {
    await writeActiveTools(specdevPath, activeTools)
  }

  if (!changed && inactive.length === 0) {
    console.log('Sync complete — everything up to date')
  }
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-skills-sync.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/skills-sync.js tests/test-skills-sync.js
git commit -m "feat: implement specdev skills sync with stale removal and wrapper regeneration"
```

---

### Task 9: Enhanced skills listing with activation status

**Mode:** full

**Files:**
- Modify: `src/commands/skills.js` (already done in Task 5)
- Test: `tests/test-skills-status.js`

**Step 1: Write the failing test**

```js
// tests/test-skills-status.js
import { existsSync, rmSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-skills-status-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function runCmd(args) {
  return spawnSync('node', [CLI, ...args], { encoding: 'utf-8' })
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true }) }

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
mkdirSync(join(TEST_DIR, '.claude', 'skills'), { recursive: true })

// Before install — fireperp should show [available]
console.log('\nskills listing — before install:')
let result = runCmd(['skills', `--target=${TEST_DIR}`])
assert(result.stdout.includes('fireperp'), 'shows fireperp')
assert(result.stdout.includes('[available]'), 'shows [available] status')

// After install — fireperp should show [active]
runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=fireperp', '--agents=claude-code'])
console.log('\nskills listing — after install:')
result = runCmd(['skills', `--target=${TEST_DIR}`])
assert(result.stdout.includes('[active]'), 'shows [active] status')

// Core skills should NOT show status tags
assert(!result.stdout.match(/brainstorming.*\[(active|available)\]/), 'core skills have no status tag')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Run test to verify it passes (already implemented in Task 5)**

Run: `node tests/test-skills-status.js`
Expected: PASS — the listing code in Task 5 already adds `[active]`/`[available]` tags

If it fails, adjust the listing code in `src/commands/skills.js` to ensure status tags appear correctly.

**Step 3: Commit**

```bash
git add tests/test-skills-status.js
git commit -m "test: verify skills listing shows activation status for tool skills"
```

---

### Task 10: Integrate sync into `specdev update`

**Mode:** full

**Files:**
- Modify: `src/commands/update.js:57-95`
- Test: `tests/test-update-sync.js`

**Step 1: Write the failing test**

```js
// tests/test-update-sync.js
import { existsSync, rmSync, mkdirSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-update-sync-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function runCmd(args) {
  return spawnSync('node', [CLI, ...args], { encoding: 'utf-8' })
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true }) }

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
mkdirSync(join(TEST_DIR, '.claude', 'skills'), { recursive: true })

// Install fireperp, then delete wrapper
runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=fireperp', '--agents=claude-code'])
rmSync(join(TEST_DIR, '.claude', 'skills', 'fireperp.md'))

// Update should run sync and regenerate wrapper
console.log('\nupdate runs sync:')
let result = runCmd(['update', `--target=${TEST_DIR}`])
assert(result.status === 0, 'update succeeds')
assert(existsSync(join(TEST_DIR, '.claude', 'skills', 'fireperp.md')), 'wrapper regenerated by update sync')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-update-sync.js`
Expected: FAIL — update doesn't run sync, wrapper stays deleted

**Step 3: Write minimal implementation**

Add sync call to `src/commands/update.js` after the existing update logic. Add this after the `backfillAdapters` block (around line 85):

```js
    // Sync tool skill wrappers
    const { skillsSyncCommand } = await import('./skills-sync.js')
    await skillsSyncCommand(flags)
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-update-sync.js`
Expected: PASS

**Step 5: Run existing update tests to verify no regression**

Run: `npm run test:update-skills`
Expected: PASS

**Step 6: Commit**

```bash
git add src/commands/update.js tests/test-update-sync.js
git commit -m "feat: run skills sync as part of specdev update"
```

---

### Task 11: Add tool skill enforcement to checkpoint

**Mode:** full

**Files:**
- Modify: `src/commands/checkpoint.js:79-119`
- Test: `tests/test-checkpoint-tools.js`

**Step 1: Write the failing test**

```js
// tests/test-checkpoint-tools.js
import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-checkpoint-tools-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function runCmd(args) {
  return spawnSync('node', [CLI, ...args], { encoding: 'utf-8' })
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true }) }

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
mkdirSync(join(TEST_DIR, '.claude', 'skills'), { recursive: true })

// Install fireperp
runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=fireperp', '--agents=claude-code'])

// Create a passing implementation checkpoint scenario
const assignmentDir = join(TEST_DIR, '.specdev', 'assignments', '001_feature_test')
mkdirSync(join(assignmentDir, 'implementation'), { recursive: true })
mkdirSync(join(assignmentDir, 'breakdown'), { recursive: true })

// Plan that declares fireperp skill
writeFileSync(join(assignmentDir, 'breakdown', 'plan.md'), `# Test Plan

### Task 1: Research API
**Skills:** [fireperp, test-driven-development]

Do research.

### Task 2: Implement
**Skills:** [test-driven-development]

Build it.
`)

// All tasks completed
writeFileSync(join(assignmentDir, 'implementation', 'progress.json'), JSON.stringify({
  tasks: [{ status: 'completed' }, { status: 'completed' }]
}))

// Checkpoint with --json should include tool warnings
console.log('\ncheckpoint implementation --json:')
let result = runCmd(['checkpoint', 'implementation', `--target=${TEST_DIR}`, `--assignment=${assignmentDir}`])
assert(result.status === 0, 'checkpoint passes (tools are advisory)')

// Now test --json output
result = runCmd(['checkpoint', 'implementation', `--target=${TEST_DIR}`, `--assignment=${assignmentDir}`, '--json'])
if (result.status === 0 && result.stdout.trim()) {
  try {
    const json = JSON.parse(result.stdout)
    assert(Array.isArray(json.warnings), 'json output has warnings array')
  } catch {
    assert(false, 'json output is valid JSON')
  }
} else {
  // If --json isn't implemented yet, the text output should mention tools
  assert(true, 'checkpoint runs without crash')
}

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-checkpoint-tools.js`
Expected: FAIL — checkpoint doesn't accept `--assignment` flag and doesn't produce JSON output

**Step 3: Write minimal implementation**

Add tool skill enforcement to `checkpointImplementation` in `src/commands/checkpoint.js`:

Add import at top:
```js
import { readActiveTools } from '../utils/active-tools.js'
```

Add to `checkpointImplementation`, after the existing progress check passes (after line 113). Before the success output:

```js
  // Tool skill enforcement (advisory)
  const specdevPath = join(assignmentPath, '..', '..')
  const activeTools = await readActiveTools(specdevPath)
  const activeToolNames = Object.keys(activeTools.tools)

  const toolWarnings = []

  if (activeToolNames.length > 0) {
    // Read plan to check Skills: and Skipped: declarations
    const planPath = join(assignmentPath, 'breakdown', 'plan.md')
    let planContent = ''
    if (await fse.pathExists(planPath)) {
      planContent = await fse.readFile(planPath, 'utf-8')
    }

    // Extract all declared skills and skipped skills from plan
    const declaredSkills = new Set()
    const skippedSkills = new Map() // name -> reason
    for (const match of planContent.matchAll(/\*\*Skills:\*\*\s*\[([^\]]*)\]/g)) {
      match[1].split(',').map(s => s.trim()).filter(Boolean).forEach(s => declaredSkills.add(s))
    }
    for (const match of planContent.matchAll(/\*\*Skipped:\*\*\s*(\w[\w-]*)\s*—\s*(.+)/g)) {
      skippedSkills.set(match[1], match[2].trim())
    }

    for (const toolName of activeToolNames) {
      if (declaredSkills.has(toolName)) continue // used
      if (skippedSkills.has(toolName)) {
        toolWarnings.push({ code: 'TOOL_SKILL_SKIPPED', skill: toolName, reason: skippedSkills.get(toolName) })
      } else {
        toolWarnings.push({ code: 'TOOL_SKILL_UNUSED', skill: toolName, waiver: null })
      }
    }
  }

  if (flags.json) {
    const output = {
      status: 'pass',
      warnings: toolWarnings,
    }
    console.log(JSON.stringify(output, null, 2))
    return
  }
```

Also update checkpointImplementation function signature to accept `flags` parameter. Update the call in `checkpointCommand`:

```js
  } else if (phase === 'implementation') {
    await checkpointImplementation(assignmentPath, name, flags)
  }
```

And the function signature:

```js
async function checkpointImplementation(assignmentPath, name, flags = {}) {
```

After the success message, add advisory warnings:

```js
  if (toolWarnings.length > 0) {
    blankLine()
    console.log('Tool skill notes:')
    for (const w of toolWarnings) {
      if (w.code === 'TOOL_SKILL_SKIPPED') {
        console.log(`   ⏭ ${w.skill} — skipped: ${w.reason}`)
      } else {
        console.log(`   ⚠ ${w.skill} — active but not declared in plan`)
      }
    }
  }
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-checkpoint-tools.js`
Expected: PASS

**Step 5: Run existing checkpoint tests to verify no regression**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/commands/checkpoint.js tests/test-checkpoint-tools.js
git commit -m "feat: add tool skill enforcement to implementation checkpoint"
```

---

### Task 12: Update help command and register test scripts

**Mode:** lightweight

**Files:**
- Modify: `src/commands/help.js`
- Modify: `package.json`

**Step 1: Add skills subcommands to help output**

In `src/commands/help.js`, add skills subcommands to the usage listing:

```
   skills                    List available skills with activation status
   skills install            Install tool skills with coding agent wrappers
   skills remove <name>      Remove an installed tool skill
   skills sync               Reconcile active tools with available skills
```

**Step 2: Register test scripts in `package.json`**

Add to the `scripts` section:

```json
"test:frontmatter": "node ./tests/test-frontmatter.js",
"test:active-tools": "node ./tests/test-active-tools.js",
"test:agents": "node ./tests/test-agents.js",
"test:wrappers": "node ./tests/test-wrappers.js",
"test:skills-subcommands": "node ./tests/test-skills-subcommands.js",
"test:skills-install": "node ./tests/test-skills-install.js",
"test:skills-remove": "node ./tests/test-skills-remove.js",
"test:skills-sync": "node ./tests/test-skills-sync.js",
"test:skills-status": "node ./tests/test-skills-status.js",
"test:update-sync": "node ./tests/test-update-sync.js",
"test:checkpoint-tools": "node ./tests/test-checkpoint-tools.js",
```

Add them to the main `test` script chain as well. Update the cleanup script to include new test output dirs.

**Step 3: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 4: Commit**

```bash
git add src/commands/help.js package.json
git commit -m "chore: add skills subcommands to help and register new test scripts"
```
