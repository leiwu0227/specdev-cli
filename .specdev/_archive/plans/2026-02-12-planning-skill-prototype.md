# Planning Skill Prototype — Implementation Plan

> **For agent:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build the first specdev v2 skill end-to-end (SKILL.md + scripts + tests + platform adapter) to validate the scripts-as-tools architecture.

**Architecture:** New folder-based skill structure under `templates/.specdev/skills/planning/` with SKILL.md as the manual and shell scripts as deterministic tools. The skills listing command is updated to discover folder-based skills. Platform adapter generation is added to `specdev init`.

**Tech Stack:** Node.js (ESM), shell scripts (bash), fs-extra

**Reference:** `docs/plans/2026-02-12-specdev-v2-design.md`

---

### Task 1: Update skills command to support folder-based skills

Currently `src/commands/skills.js` only lists `.md` files in the skills directory. It needs to also detect subdirectories containing `SKILL.md`.

**Files:**
- Modify: `src/commands/skills.js`
- Modify: `tests/verify-output.js` (add new planning skill files to required list)

**Step 1: Write the failing test**

Create `tests/test-skills.js`:

```javascript
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-skills-output')

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

// Setup
cleanup()

// Init a project
const initResult = runCmd(['init', `--target=${TEST_DIR}`])
assert(initResult.status === 0, 'init succeeds')

// Create a folder-based skill manually for testing
const testSkillDir = join(TEST_DIR, '.specdev', 'skills', 'test-folder-skill')
mkdirSync(testSkillDir, { recursive: true })
writeFileSync(join(testSkillDir, 'SKILL.md'), '---\nname: test-folder-skill\ndescription: A test skill\n---\n# Test\n')
mkdirSync(join(testSkillDir, 'scripts'), { recursive: true })
writeFileSync(join(testSkillDir, 'scripts', 'run.sh'), '#!/bin/bash\necho "ok"\n')

console.log('\nskills listing:')
const skillsResult = runCmd(['skills', `--target=${TEST_DIR}`])
assert(skillsResult.status === 0, 'skills command succeeds')

// Should list flat .md skills
assert(skillsResult.stdout.includes('verification-before-completion'), 'lists flat .md skills')

// Should list folder-based skills
assert(skillsResult.stdout.includes('test-folder-skill'), 'lists folder-based skills')

// Should show description for folder-based skills
assert(skillsResult.stdout.includes('A test skill'), 'shows folder skill description')

// Should indicate folder skills have scripts
assert(skillsResult.stdout.includes('scripts'), 'indicates scripts available')

// Cleanup
cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-skills.js`
Expected: FAIL — folder-based skills not listed, no description shown

**Step 3: Write minimal implementation**

Update `src/commands/skills.js` to:

```javascript
import { readdirSync, existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export function skillsCommand(flags = {}) {
  const target = flags.target ? resolve(flags.target) : process.cwd()
  const skillsDir = join(target, '.specdev', 'skills')

  if (!existsSync(skillsDir)) {
    console.error('No .specdev/skills directory found.')
    console.error('Run `specdev init` first.')
    process.exit(1)
  }

  const entries = readdirSync(skillsDir, { withFileTypes: true })
  const skills = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (entry.name === 'README.md' || entry.name === 'skills_invoked_template.md') continue

    if (entry.isDirectory()) {
      // Folder-based skill: look for SKILL.md
      const skillMd = join(skillsDir, entry.name, 'SKILL.md')
      if (existsSync(skillMd)) {
        const content = readFileSync(skillMd, 'utf-8')
        const desc = parseFrontmatter(content).description || ''
        const hasScripts = existsSync(join(skillsDir, entry.name, 'scripts'))
        skills.push({ name: entry.name, type: 'folder', description: desc, hasScripts })
      }
    } else if (entry.name.endsWith('.md')) {
      // Flat .md skill (legacy)
      skills.push({ name: entry.name.replace('.md', ''), type: 'flat', description: '', hasScripts: false })
    }
  }

  skills.sort((a, b) => a.name.localeCompare(b.name))

  console.log(`\nAvailable skills (${skills.length}):\n`)
  for (const skill of skills) {
    const scripts = skill.hasScripts ? ' [scripts]' : ''
    const desc = skill.description ? ` — ${skill.description}` : ''
    console.log(`  ${skill.name}${scripts}${desc}`)
  }
  console.log()
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const result = {}
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':')
    if (key && rest.length) result[key.trim()] = rest.join(':').trim()
  }
  return result
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-skills.js`
Expected: PASS

**Step 5: Add test script to package.json**

Add to package.json scripts: `"test:skills": "node tests/test-skills.js"`

Update test script to include: `npm run test:skills` in the sequence.

**Step 6: Commit**

```bash
git add src/commands/skills.js tests/test-skills.js package.json
git commit -m "feat: support folder-based skills in skills listing"
```

---

### Task 2: Create planning skill SKILL.md

Write the manual for the planning skill — the markdown that teaches agents when/how/why to use the planning tools.

**Files:**
- Create: `templates/.specdev/skills/planning/SKILL.md`

**Step 1: Write the failing test**

Add to `tests/verify-output.js` required files array:

```javascript
'skills/planning/SKILL.md',
'skills/planning/scripts/get-project-context.sh',
'skills/planning/scripts/scaffold-plan.sh',
'skills/planning/scripts/validate-plan.sh',
'skills/planning/scripts/register-assignment.sh',
```

**Step 2: Run test to verify it fails**

Run: `node tests/verify-output.js`
Expected: FAIL — planning skill files missing

**Step 3: Create SKILL.md**

Create `templates/.specdev/skills/planning/SKILL.md`:

```markdown
---
name: planning
description: Interactive design-to-plan workflow — turns ideas into self-executing plans
---

# Planning

## Contract

- **Input:** A goal, feature request, or assignment proposal
- **Process:** Question-by-question refinement → approach exploration → section-by-section design → detailed plan
- **Output:** `docs/plans/YYYY-MM-DD-<name>.md` — a self-executing plan document
- **Next skill:** Plan header tells the executing agent which skill to use (executing or subagent-dispatch)

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `scripts/get-project-context.sh` | Scan repo structure, recent commits, knowledge files → context summary | At the start, before asking questions |
| `scripts/scaffold-plan.sh` | Generate plan file with proper header and task template | After design is validated, before detailing tasks |
| `scripts/validate-plan.sh` | Check plan completeness — every task has files, code, tests, commands | After writing all tasks, before handoff |
| `scripts/register-assignment.sh` | Create assignment entry in state/, link plan | After plan is validated |

## Process

### Phase 1: Understand

Get context first, then ask questions one at a time.

1. Run `scripts/get-project-context.sh <project-root>` to get current state
2. Read the output — it tells you about the repo, recent work, and existing knowledge
3. Ask the user ONE question at a time to understand their goal
4. Prefer multiple-choice questions when possible
5. Continue until you understand: purpose, constraints, success criteria

**Rules:**
- Only ONE question per message
- If a topic needs more exploration, break it into multiple questions
- Multiple choice is easier to answer than open-ended — prefer it
- Do not proceed until you understand what you are building

### Phase 2: Explore Approaches

Once you understand the goal, propose options.

1. Present 2-3 different approaches with trade-offs
2. Lead with your recommended approach and explain why
3. Keep it conversational — this is a discussion, not a presentation
4. Let the user choose

### Phase 3: Design

Present the design incrementally for validation.

1. Break the design into sections of 200-300 words
2. Present one section at a time
3. After each section, ask: "Does this look right so far?"
4. Cover: architecture, components, data flow, error handling, testing approach
5. Be ready to revise if something doesn't make sense

### Phase 4: Detail the Plan

Turn the validated design into a self-executing plan document.

1. Run `scripts/scaffold-plan.sh <plan-name> <project-root>` to create the plan file
2. Fill in bite-sized tasks (each step is 2-5 minutes of work):
   - "Write the failing test" — one step
   - "Run it to make sure it fails" — one step
   - "Implement the minimal code" — one step
   - "Run the tests" — one step
   - "Commit" — one step
3. Every task MUST include:
   - Exact file paths (create/modify/test)
   - Complete code (not "add validation" — show the actual code)
   - Exact commands to run with expected output
4. Run `scripts/validate-plan.sh <plan-file>` to check completeness
5. Fix any gaps the validator finds

### Phase 5: Handoff

Register the plan and offer execution options.

1. Run `scripts/register-assignment.sh <plan-file> <project-root>` to create the assignment
2. Tell the user:

> Plan complete and saved to `docs/plans/<filename>.md`.
>
> **Two execution options:**
> 1. **Subagent-Driven (this session)** — Fresh subagent per task, review between tasks
> 2. **New Session** — Open new session, agent reads plan header and executes
>
> Which approach?

## Plan Document Format

Every plan MUST start with this header:

```
# [Feature Name] Implementation Plan

> **For agent:** Use specdev:executing skill to implement this plan task-by-task.

**Goal:** [One sentence]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

---
```

Every task MUST follow this structure:

```
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.ext`
- Modify: `exact/path/to/existing.ext:line-range`
- Test: `tests/exact/path/to/test.ext`

**Step 1: Write the failing test**
[Complete test code]

**Step 2: Run test to verify it fails**
Run: `exact command`
Expected: FAIL with "specific error message"

**Step 3: Write minimal implementation**
[Complete implementation code]

**Step 4: Run test to verify it passes**
Run: `exact command`
Expected: PASS

**Step 5: Commit**
[Exact git commands with message]
```

## Red Flags

- Asking multiple questions in one message — STOP, ask one at a time
- Skipping get-project-context.sh — you need context before asking questions
- Writing vague task steps ("add error handling") — be specific, show the code
- Skipping validate-plan.sh — always run it before handoff
- Presenting the entire design at once — break into 200-300 word sections
- Not offering execution options at the end — always present the handoff

## Integration

- **Before this skill:** brainstorming (if the idea needs refinement first)
- **After this skill:** executing or subagent-dispatch (to implement the plan)
- **Always active during this skill:** verification-before-completion (validate plan completeness)
```

**Step 4: Run test to verify it still fails**

Run: `node tests/verify-output.js`
Expected: FAIL — script files still missing (we only created SKILL.md so far, scripts come in later tasks)

**Step 5: Commit**

```bash
git add templates/.specdev/skills/planning/SKILL.md tests/verify-output.js
git commit -m "feat: add planning skill SKILL.md — the manual for the planning workflow"
```

---

### Task 3: Write get-project-context.sh

This script scans the repo and returns a structured context summary the agent can use before asking questions.

**Files:**
- Create: `templates/.specdev/skills/planning/scripts/get-project-context.sh`

**Step 1: Write the failing test**

Create `tests/test-planning-scripts.js`:

```javascript
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPTS_DIR = join(__dirname, '..', 'templates', '.specdev', 'skills', 'planning', 'scripts')
const TEST_DIR = join(__dirname, 'test-planning-output')

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

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
}

// Setup: create a fake project
cleanup()
mkdirSync(join(TEST_DIR, '.specdev', 'knowledge', 'project'), { recursive: true })
mkdirSync(join(TEST_DIR, '.specdev', 'knowledge', 'workflow'), { recursive: true })
mkdirSync(join(TEST_DIR, '.specdev', 'state', 'assignments'), { recursive: true })
mkdirSync(join(TEST_DIR, 'src'), { recursive: true })
writeFileSync(join(TEST_DIR, 'package.json'), '{"name": "test-project", "version": "1.0.0"}')
writeFileSync(join(TEST_DIR, 'src', 'index.js'), 'console.log("hello")')
writeFileSync(join(TEST_DIR, '.specdev', 'knowledge', 'project', 'architecture.md'), '# Architecture\nUses MVC pattern.')

// Init git repo for commit history
spawnSync('git', ['init'], { cwd: TEST_DIR })
spawnSync('git', ['add', '.'], { cwd: TEST_DIR })
spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@test.com', 'commit', '-m', 'init'], { cwd: TEST_DIR })

// ---- Test get-project-context.sh ----
console.log('\nget-project-context.sh:')

const script = join(SCRIPTS_DIR, 'get-project-context.sh')
const result = spawnSync('bash', [script, TEST_DIR], { encoding: 'utf-8' })

assert(result.status === 0, 'exits with code 0')
assert(result.stdout.includes('test-project'), 'includes project name from package.json')
assert(result.stdout.includes('src/index.js') || result.stdout.includes('src/'), 'includes file structure')
assert(result.stdout.includes('Architecture') || result.stdout.includes('MVC'), 'includes knowledge content')
assert(result.stdout.includes('init'), 'includes recent commit history')

// Test with missing project root
const badResult = spawnSync('bash', [script, '/nonexistent'], { encoding: 'utf-8' })
assert(badResult.status !== 0, 'exits non-zero for missing directory')

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-planning-scripts.js`
Expected: FAIL — script doesn't exist yet

**Step 3: Write the script**

Create `templates/.specdev/skills/planning/scripts/get-project-context.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# get-project-context.sh — Scan a project and return structured context for planning
#
# Usage: get-project-context.sh <project-root>
# Output: Markdown summary to stdout
# Exit: 0 on success, 1 on error

PROJECT_ROOT="${1:-}"

if [ -z "$PROJECT_ROOT" ] || [ ! -d "$PROJECT_ROOT" ]; then
  echo "Error: project root directory required" >&2
  echo "Usage: get-project-context.sh <project-root>" >&2
  exit 1
fi

PROJECT_ROOT=$(cd "$PROJECT_ROOT" && pwd)

echo "# Project Context"
echo ""

# --- Project identity ---
if [ -f "$PROJECT_ROOT/package.json" ]; then
  NAME=$(grep -o '"name":\s*"[^"]*"' "$PROJECT_ROOT/package.json" | head -1 | sed 's/"name":\s*"//;s/"//')
  VERSION=$(grep -o '"version":\s*"[^"]*"' "$PROJECT_ROOT/package.json" | head -1 | sed 's/"version":\s*"//;s/"//')
  echo "## Project: ${NAME:-unknown} v${VERSION:-unknown}"
elif [ -f "$PROJECT_ROOT/Cargo.toml" ]; then
  NAME=$(grep '^name' "$PROJECT_ROOT/Cargo.toml" | head -1 | sed 's/name\s*=\s*"//;s/"//')
  echo "## Project: ${NAME:-unknown}"
elif [ -f "$PROJECT_ROOT/pyproject.toml" ]; then
  NAME=$(grep '^name' "$PROJECT_ROOT/pyproject.toml" | head -1 | sed 's/name\s*=\s*"//;s/"//')
  echo "## Project: ${NAME:-unknown}"
else
  DIRNAME=$(basename "$PROJECT_ROOT")
  echo "## Project: $DIRNAME"
fi
echo ""

# --- File structure (top 2 levels, excluding hidden/node_modules/vendor) ---
echo "## File Structure"
echo '```'
if command -v find &> /dev/null; then
  find "$PROJECT_ROOT" -maxdepth 2 \
    -not -path '*/\.*' \
    -not -path '*/node_modules/*' \
    -not -path '*/vendor/*' \
    -not -path '*/__pycache__/*' \
    -not -path '*/target/*' \
    -not -name '*.lock' \
    | sed "s|^$PROJECT_ROOT/||" \
    | sort \
    | head -50
fi
echo '```'
echo ""

# --- Recent git history ---
if [ -d "$PROJECT_ROOT/.git" ]; then
  echo "## Recent Commits"
  echo '```'
  git -C "$PROJECT_ROOT" log --oneline -10 2>/dev/null || echo "(no commits)"
  echo '```'
  echo ""
fi

# --- Existing knowledge ---
KNOWLEDGE_DIR="$PROJECT_ROOT/.specdev/knowledge/project"
if [ -d "$KNOWLEDGE_DIR" ]; then
  KNOWLEDGE_FILES=$(find "$KNOWLEDGE_DIR" -name '*.md' -type f 2>/dev/null)
  if [ -n "$KNOWLEDGE_FILES" ]; then
    echo "## Existing Knowledge"
    echo ""
    for f in $KNOWLEDGE_FILES; do
      RELPATH=$(echo "$f" | sed "s|^$PROJECT_ROOT/.specdev/knowledge/||")
      echo "### $RELPATH"
      cat "$f"
      echo ""
    done
  fi
fi

# --- Current assignments ---
ASSIGNMENTS_DIR="$PROJECT_ROOT/.specdev/state/assignments"
if [ ! -d "$ASSIGNMENTS_DIR" ]; then
  ASSIGNMENTS_DIR="$PROJECT_ROOT/.specdev/assignments"
fi
if [ -d "$ASSIGNMENTS_DIR" ]; then
  ASSIGNMENT_COUNT=$(find "$ASSIGNMENTS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
  if [ "$ASSIGNMENT_COUNT" -gt 0 ]; then
    echo "## Active Assignments ($ASSIGNMENT_COUNT)"
    echo ""
    find "$ASSIGNMENTS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort | while read -r dir; do
      ANAME=$(basename "$dir")
      echo "- $ANAME"
      if [ -f "$dir/review_request.json" ]; then
        STATUS=$(grep -o '"status":\s*"[^"]*"' "$dir/review_request.json" | head -1 | sed 's/"status":\s*"//;s/"//')
        echo "  Status: $STATUS"
      fi
    done
    echo ""
  fi
fi
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-planning-scripts.js`
Expected: PASS

**Step 5: Make script executable and commit**

```bash
chmod +x templates/.specdev/skills/planning/scripts/get-project-context.sh
git add templates/.specdev/skills/planning/scripts/get-project-context.sh tests/test-planning-scripts.js
git commit -m "feat: add get-project-context.sh — scans repo for planning context"
```

---

### Task 4: Write scaffold-plan.sh

This script creates a plan file with the correct header template.

**Files:**
- Create: `templates/.specdev/skills/planning/scripts/scaffold-plan.sh`
- Modify: `tests/test-planning-scripts.js` (add tests)

**Step 1: Write the failing test**

Append to `tests/test-planning-scripts.js` (before the final cleanup/summary):

```javascript
// ---- Test scaffold-plan.sh ----
console.log('\nscaffold-plan.sh:')

const scaffoldScript = join(SCRIPTS_DIR, 'scaffold-plan.sh')

// Create docs/plans directory
mkdirSync(join(TEST_DIR, 'docs', 'plans'), { recursive: true })

const scaffoldResult = spawnSync('bash', [scaffoldScript, 'my-feature', TEST_DIR], { encoding: 'utf-8' })

assert(scaffoldResult.status === 0, 'exits with code 0')

// Check the file was created with today's date
const today = new Date().toISOString().split('T')[0]
const expectedFile = join(TEST_DIR, 'docs', 'plans', `${today}-my-feature.md`)
assert(existsSync(expectedFile), 'creates plan file with date prefix')

const planContent = readFileSync(expectedFile, 'utf-8')
assert(planContent.includes('Implementation Plan'), 'includes plan header')
assert(planContent.includes('specdev:executing'), 'includes execution instruction')
assert(planContent.includes('**Goal:**'), 'includes goal placeholder')
assert(planContent.includes('### Task 1:'), 'includes task template')
assert(planContent.includes('**Step 1: Write the failing test**'), 'includes TDD step template')

// Outputs the file path
assert(scaffoldResult.stdout.includes(expectedFile) || scaffoldResult.stdout.includes(`${today}-my-feature.md`), 'outputs created file path')

// Fails if plan already exists (no overwrite)
const scaffoldAgain = spawnSync('bash', [scaffoldScript, 'my-feature', TEST_DIR], { encoding: 'utf-8' })
assert(scaffoldAgain.status !== 0, 'refuses to overwrite existing plan')
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-planning-scripts.js`
Expected: FAIL — scaffold-plan.sh doesn't exist

**Step 3: Write the script**

Create `templates/.specdev/skills/planning/scripts/scaffold-plan.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# scaffold-plan.sh — Create a plan file with the standard header template
#
# Usage: scaffold-plan.sh <plan-name> <project-root>
# Output: Path to created file on stdout
# Exit: 0 on success, 1 on error (including if file already exists)

PLAN_NAME="${1:-}"
PROJECT_ROOT="${2:-}"

if [ -z "$PLAN_NAME" ] || [ -z "$PROJECT_ROOT" ]; then
  echo "Error: plan name and project root required" >&2
  echo "Usage: scaffold-plan.sh <plan-name> <project-root>" >&2
  exit 1
fi

PROJECT_ROOT=$(cd "$PROJECT_ROOT" && pwd)
TODAY=$(date +%Y-%m-%d)
PLANS_DIR="$PROJECT_ROOT/docs/plans"
PLAN_FILE="$PLANS_DIR/${TODAY}-${PLAN_NAME}.md"

# Don't overwrite existing plans
if [ -f "$PLAN_FILE" ]; then
  echo "Error: plan already exists: $PLAN_FILE" >&2
  exit 1
fi

# Create directory if needed
mkdir -p "$PLANS_DIR"

# Write the plan template
cat > "$PLAN_FILE" << 'TEMPLATE'
# [Feature Name] Implementation Plan

> **For agent:** Use specdev:executing skill to implement this plan task-by-task.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

---

### Task 1: [Component Name]

**Files:**
- Create: `exact/path/to/file.ext`
- Modify: `exact/path/to/existing.ext`
- Test: `tests/exact/path/to/test.ext`

**Step 1: Write the failing test**

```
[Complete test code here]
```

**Step 2: Run test to verify it fails**

Run: `[exact command]`
Expected: FAIL with "[specific error]"

**Step 3: Write minimal implementation**

```
[Complete implementation code here]
```

**Step 4: Run test to verify it passes**

Run: `[exact command]`
Expected: PASS

**Step 5: Commit**

```bash
git add [files]
git commit -m "[type]: [description]"
```
TEMPLATE

echo "$PLAN_FILE"
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-planning-scripts.js`
Expected: PASS

**Step 5: Commit**

```bash
chmod +x templates/.specdev/skills/planning/scripts/scaffold-plan.sh
git add templates/.specdev/skills/planning/scripts/scaffold-plan.sh tests/test-planning-scripts.js
git commit -m "feat: add scaffold-plan.sh — creates plan files with standard template"
```

---

### Task 5: Write validate-plan.sh

This script checks a plan document for completeness — every task must have files, code, test commands, and expected output.

**Files:**
- Create: `templates/.specdev/skills/planning/scripts/validate-plan.sh`
- Modify: `tests/test-planning-scripts.js` (add tests)

**Step 1: Write the failing test**

Append to `tests/test-planning-scripts.js`:

```javascript
// ---- Test validate-plan.sh ----
console.log('\nvalidate-plan.sh:')

const validateScript = join(SCRIPTS_DIR, 'validate-plan.sh')

// Create a valid plan
const validPlan = join(TEST_DIR, 'docs', 'plans', 'valid-plan.md')
writeFileSync(validPlan, `# Test Plan

> **For agent:** Use specdev:executing skill to implement this plan task-by-task.

**Goal:** Test the validator

**Architecture:** Simple test

**Tech Stack:** Node.js

---

### Task 1: Add feature

**Files:**
- Create: \`src/feature.js\`
- Test: \`tests/feature.test.js\`

**Step 1: Write the failing test**

\`\`\`javascript
test('feature works', () => { expect(true).toBe(true) })
\`\`\`

**Step 2: Run test to verify it fails**

Run: \`npm test\`
Expected: FAIL

**Step 3: Write minimal implementation**

\`\`\`javascript
function feature() { return true }
\`\`\`

**Step 4: Run test to verify it passes**

Run: \`npm test\`
Expected: PASS

**Step 5: Commit**

\`\`\`bash
git add src/feature.js tests/feature.test.js
git commit -m "feat: add feature"
\`\`\`
`)

const validResult = spawnSync('bash', [validateScript, validPlan], { encoding: 'utf-8' })
assert(validResult.status === 0, 'valid plan passes validation')
assert(validResult.stdout.includes('1 task'), 'reports task count')

// Create an incomplete plan (missing code blocks)
const incompletePlan = join(TEST_DIR, 'docs', 'plans', 'incomplete-plan.md')
writeFileSync(incompletePlan, `# Incomplete Plan

> **For agent:** Use specdev:executing skill.

**Goal:** Test

---

### Task 1: Do something

**Files:**
- Create: \`src/thing.js\`

**Step 1: Write the failing test**

Add some test code here.

**Step 3: Write minimal implementation**

Add implementation.
`)

const incompleteResult = spawnSync('bash', [validateScript, incompletePlan], { encoding: 'utf-8' })
assert(incompleteResult.status !== 0, 'incomplete plan fails validation')
assert(incompleteResult.stderr.includes('missing') || incompleteResult.stdout.includes('missing') || incompleteResult.stdout.includes('FAIL'), 'reports what is missing')

// Missing file
const missingResult = spawnSync('bash', [validateScript, '/nonexistent/plan.md'], { encoding: 'utf-8' })
assert(missingResult.status !== 0, 'exits non-zero for missing file')
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-planning-scripts.js`
Expected: FAIL — validate-plan.sh doesn't exist

**Step 3: Write the script**

Create `templates/.specdev/skills/planning/scripts/validate-plan.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# validate-plan.sh — Check a plan document for completeness
#
# Usage: validate-plan.sh <plan-file>
# Output: Validation report to stdout, errors to stderr
# Exit: 0 if all checks pass, 1 if any fail

PLAN_FILE="${1:-}"

if [ -z "$PLAN_FILE" ] || [ ! -f "$PLAN_FILE" ]; then
  echo "Error: plan file required and must exist" >&2
  echo "Usage: validate-plan.sh <plan-file>" >&2
  exit 1
fi

FAILURES=0
WARNINGS=0

fail() {
  echo "  FAIL: $1" >&2
  FAILURES=$((FAILURES + 1))
}

warn() {
  echo "  WARN: $1"
  WARNINGS=$((WARNINGS + 1))
}

pass() {
  echo "  OK: $1"
}

CONTENT=$(cat "$PLAN_FILE")

echo "Validating: $PLAN_FILE"
echo ""

# --- Header checks ---
echo "Header:"

if echo "$CONTENT" | grep -q '^\*\*Goal:\*\*'; then
  GOAL=$(echo "$CONTENT" | grep '^\*\*Goal:\*\*' | sed 's/\*\*Goal:\*\*\s*//')
  if [ -z "$GOAL" ] || echo "$GOAL" | grep -q '\['; then
    fail "Goal is placeholder — fill it in"
  else
    pass "Goal present"
  fi
else
  fail "missing **Goal:** in header"
fi

if echo "$CONTENT" | grep -q 'specdev:executing\|executing-plans\|executing skill'; then
  pass "Execution instruction present"
else
  fail "missing execution instruction in header (should reference specdev:executing)"
fi

# --- Task checks ---
TASK_HEADERS=$(echo "$CONTENT" | grep -c '^### Task [0-9]' || true)

if [ "$TASK_HEADERS" -eq 0 ]; then
  fail "no tasks found (expected ### Task N: headers)"
  echo ""
  echo "Result: ${FAILURES} failures, ${WARNINGS} warnings"
  exit 1
fi

echo ""
echo "Tasks: $TASK_HEADERS found"

TASK_NUM=0
while IFS= read -r line; do
  TASK_NUM=$((TASK_NUM + 1))
  TASK_NAME=$(echo "$line" | sed 's/^### Task [0-9]*:\s*//')

  # Extract task section (from this header to next task header or end)
  TASK_SECTION=$(echo "$CONTENT" | sed -n "/^### Task ${TASK_NUM}:/,/^### Task $((TASK_NUM + 1)):/p" | head -n -1)
  if [ -z "$TASK_SECTION" ]; then
    # Last task — extract to end of file
    TASK_SECTION=$(echo "$CONTENT" | sed -n "/^### Task ${TASK_NUM}:/,\$p")
  fi

  echo ""
  echo "Task $TASK_NUM: $TASK_NAME"

  # Check for **Files:** section
  if echo "$TASK_SECTION" | grep -q '^\*\*Files:\*\*'; then
    pass "Files section present"
  else
    fail "Task $TASK_NUM missing **Files:** section"
  fi

  # Check for code blocks (need at least 2: test + implementation)
  CODE_BLOCKS=$(echo "$TASK_SECTION" | grep -c '^\`\`\`' || true)
  # Code blocks come in pairs (open + close), so divide by 2
  CODE_BLOCK_COUNT=$((CODE_BLOCKS / 2))
  if [ "$CODE_BLOCK_COUNT" -ge 2 ]; then
    pass "$CODE_BLOCK_COUNT code blocks"
  else
    fail "Task $TASK_NUM has $CODE_BLOCK_COUNT code blocks (need at least 2: test + implementation)"
  fi

  # Check for Run: commands
  RUN_COMMANDS=$(echo "$TASK_SECTION" | grep -c '^Run:' || true)
  if [ "$RUN_COMMANDS" -ge 1 ]; then
    pass "$RUN_COMMANDS run commands"
  else
    fail "Task $TASK_NUM missing Run: commands (need at least 1 test command)"
  fi

  # Check for Expected: output
  EXPECTED=$(echo "$TASK_SECTION" | grep -c '^Expected:' || true)
  if [ "$EXPECTED" -ge 1 ]; then
    pass "Expected output specified"
  else
    warn "Task $TASK_NUM missing Expected: output"
  fi

  # Check for commit step
  if echo "$TASK_SECTION" | grep -q 'git commit'; then
    pass "Commit step present"
  else
    warn "Task $TASK_NUM missing commit step"
  fi

done <<< "$(echo "$CONTENT" | grep '^### Task [0-9]')"

echo ""
echo "Result: $TASK_HEADERS tasks, ${FAILURES} failures, ${WARNINGS} warnings"

if [ "$FAILURES" -gt 0 ]; then
  exit 1
fi

exit 0
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-planning-scripts.js`
Expected: PASS

**Step 5: Commit**

```bash
chmod +x templates/.specdev/skills/planning/scripts/validate-plan.sh
git add templates/.specdev/skills/planning/scripts/validate-plan.sh tests/test-planning-scripts.js
git commit -m "feat: add validate-plan.sh — checks plan completeness before handoff"
```

---

### Task 6: Write register-assignment.sh

This script creates a new assignment entry in the state directory, linking it to the plan file.

**Files:**
- Create: `templates/.specdev/skills/planning/scripts/register-assignment.sh`
- Modify: `tests/test-planning-scripts.js` (add tests)

**Step 1: Write the failing test**

Append to `tests/test-planning-scripts.js`:

```javascript
// ---- Test register-assignment.sh ----
console.log('\nregister-assignment.sh:')

const registerScript = join(SCRIPTS_DIR, 'register-assignment.sh')

// Create state directory
mkdirSync(join(TEST_DIR, '.specdev', 'state', 'assignments'), { recursive: true })

// Register using the valid plan
const registerResult = spawnSync('bash', [registerScript, validPlan, TEST_DIR, 'feature', 'test-feature'], { encoding: 'utf-8' })

assert(registerResult.status === 0, 'exits with code 0')

// Check assignment directory was created
const stateDir = join(TEST_DIR, '.specdev', 'state', 'assignments')
const entries = readdirSync(stateDir).filter(e => e !== '.gitkeep')
assert(entries.length === 1, 'creates one assignment entry')
assert(entries[0].includes('feature') && entries[0].includes('test-feature'), 'assignment name includes type and label')

const assignmentDir = join(stateDir, entries[0])

// Check proposal.md created
assert(existsSync(join(assignmentDir, 'proposal.md')), 'creates proposal.md')

// Check plan.md is linked/copied
assert(existsSync(join(assignmentDir, 'plan.md')), 'creates plan.md')
const planLink = readFileSync(join(assignmentDir, 'plan.md'), 'utf-8')
assert(planLink.includes('valid-plan.md') || planLink.includes('Test Plan'), 'plan.md references or contains the plan')

// Check context directory
assert(existsSync(join(assignmentDir, 'context')), 'creates context/ directory')

// Check tasks directory
assert(existsSync(join(assignmentDir, 'tasks')), 'creates tasks/ directory')

// Outputs assignment path
assert(registerResult.stdout.includes(entries[0]), 'outputs assignment directory name')

// Second registration gets next ID
const registerResult2 = spawnSync('bash', [registerScript, validPlan, TEST_DIR, 'bugfix', 'fix-thing'], { encoding: 'utf-8' })
assert(registerResult2.status === 0, 'second registration succeeds')
const entries2 = readdirSync(stateDir).filter(e => e !== '.gitkeep')
assert(entries2.length === 2, 'creates second assignment')

// IDs should be sequential
const ids = entries2.map(e => parseInt(e.split('_')[0])).sort()
assert(ids[1] === ids[0] + 1, 'assignment IDs are sequential')
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-planning-scripts.js`
Expected: FAIL — register-assignment.sh doesn't exist

**Step 3: Write the script**

Create `templates/.specdev/skills/planning/scripts/register-assignment.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# register-assignment.sh — Create a new assignment entry linked to a plan
#
# Usage: register-assignment.sh <plan-file> <project-root> <type> <label>
#   type: feature, bugfix, refactor
#   label: kebab-case name (e.g., add-auth, fix-login)
#
# Output: Assignment directory path to stdout
# Exit: 0 on success, 1 on error

PLAN_FILE="${1:-}"
PROJECT_ROOT="${2:-}"
TYPE="${3:-}"
LABEL="${4:-}"

if [ -z "$PLAN_FILE" ] || [ -z "$PROJECT_ROOT" ] || [ -z "$TYPE" ] || [ -z "$LABEL" ]; then
  echo "Error: all arguments required" >&2
  echo "Usage: register-assignment.sh <plan-file> <project-root> <type> <label>" >&2
  exit 1
fi

if [ ! -f "$PLAN_FILE" ]; then
  echo "Error: plan file not found: $PLAN_FILE" >&2
  exit 1
fi

PROJECT_ROOT=$(cd "$PROJECT_ROOT" && pwd)

# Determine assignments directory (v2 state/ or v1 flat)
ASSIGNMENTS_DIR="$PROJECT_ROOT/.specdev/state/assignments"
if [ ! -d "$ASSIGNMENTS_DIR" ]; then
  ASSIGNMENTS_DIR="$PROJECT_ROOT/.specdev/assignments"
fi
mkdir -p "$ASSIGNMENTS_DIR"

# Find next ID
NEXT_ID=1
EXISTING=$(find "$ASSIGNMENTS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort | tail -1)
if [ -n "$EXISTING" ]; then
  LAST_NAME=$(basename "$EXISTING")
  LAST_ID=$(echo "$LAST_NAME" | grep -o '^[0-9]*' || echo "0")
  NEXT_ID=$((LAST_ID + 1))
fi

# Format ID with zero-padding
PADDED_ID=$(printf "%05d" "$NEXT_ID")

# Create assignment directory
ASSIGNMENT_NAME="${PADDED_ID}_${TYPE}_${LABEL}"
ASSIGNMENT_DIR="$ASSIGNMENTS_DIR/$ASSIGNMENT_NAME"

mkdir -p "$ASSIGNMENT_DIR"
mkdir -p "$ASSIGNMENT_DIR/context"
mkdir -p "$ASSIGNMENT_DIR/context/messages"
mkdir -p "$ASSIGNMENT_DIR/tasks"
mkdir -p "$ASSIGNMENT_DIR/scaffold"

# Create proposal.md
cat > "$ASSIGNMENT_DIR/proposal.md" << EOF
# ${LABEL}

**Type:** ${TYPE}
**Created:** $(date -Iseconds)
**Plan:** $(basename "$PLAN_FILE")

## Scope

See linked plan for full details.
EOF

# Link plan: copy content with reference to source
{
  echo "<!-- Source: $PLAN_FILE -->"
  cat "$PLAN_FILE"
} > "$ASSIGNMENT_DIR/plan.md"

# Create empty tracking files
touch "$ASSIGNMENT_DIR/context/.gitkeep"
touch "$ASSIGNMENT_DIR/context/messages/.gitkeep"
touch "$ASSIGNMENT_DIR/tasks/.gitkeep"

echo "$ASSIGNMENT_DIR"
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-planning-scripts.js`
Expected: PASS

**Step 5: Commit**

```bash
chmod +x templates/.specdev/skills/planning/scripts/register-assignment.sh
git add templates/.specdev/skills/planning/scripts/register-assignment.sh tests/test-planning-scripts.js
git commit -m "feat: add register-assignment.sh — creates assignment entries from plans"
```

---

### Task 7: Add platform adapter generation to specdev init

Update `specdev init` to detect platform and generate the appropriate entry-point file.

**Files:**
- Modify: `src/commands/init.js`
- Modify: `tests/test-work.js` (or create `tests/test-init-platform.js`)

**Step 1: Write the failing test**

Create `tests/test-init-platform.js`:

```javascript
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
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

// ---- Test default init (auto-detect, should generate AGENTS.md) ----
console.log('\ndefault init (generic):')
cleanup()
let result = runCmd(['init', `--target=${TEST_DIR}`])
assert(result.status === 0, 'init succeeds')
assert(existsSync(join(TEST_DIR, '.specdev', '_main.md')), '.specdev created')
// Default should create AGENTS.md as generic fallback
assert(existsSync(join(TEST_DIR, 'AGENTS.md')), 'creates AGENTS.md by default')
const agentsMd = readFileSync(join(TEST_DIR, 'AGENTS.md'), 'utf-8')
assert(agentsMd.includes('.specdev/_main.md'), 'AGENTS.md points to _main.md')

// ---- Test --platform=claude ----
console.log('\n--platform=claude:')
cleanup()
result = runCmd(['init', `--target=${TEST_DIR}`, '--platform=claude'])
assert(result.status === 0, 'init with --platform=claude succeeds')
assert(existsSync(join(TEST_DIR, 'CLAUDE.md')), 'creates CLAUDE.md')
const claudeMd = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')
assert(claudeMd.includes('.specdev/_main.md'), 'CLAUDE.md points to _main.md')
assert(!existsSync(join(TEST_DIR, 'AGENTS.md')), 'does NOT create AGENTS.md when platform=claude')

// ---- Test --platform=codex ----
console.log('\n--platform=codex:')
cleanup()
result = runCmd(['init', `--target=${TEST_DIR}`, '--platform=codex'])
assert(result.status === 0, 'init with --platform=codex succeeds')
assert(existsSync(join(TEST_DIR, 'AGENTS.md')), 'creates AGENTS.md for codex')

// ---- Test --platform=cursor ----
console.log('\n--platform=cursor:')
cleanup()
result = runCmd(['init', `--target=${TEST_DIR}`, '--platform=cursor'])
assert(result.status === 0, 'init with --platform=cursor succeeds')
assert(existsSync(join(TEST_DIR, '.cursor', 'rules')), 'creates .cursor/rules')
const cursorRules = readFileSync(join(TEST_DIR, '.cursor', 'rules'), 'utf-8')
assert(cursorRules.includes('.specdev/_main.md'), '.cursor/rules points to _main.md')

// ---- Test adapter does NOT overwrite existing file ----
console.log('\nno-overwrite:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`, '--platform=claude'])
// Modify the CLAUDE.md
const originalContent = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')
const modified = originalContent + '\n# My custom rules\n'
const { writeFileSync } = await import('node:fs')
writeFileSync(join(TEST_DIR, 'CLAUDE.md'), modified)
// Re-init with force (should update .specdev but warn about adapter)
result = runCmd(['init', `--target=${TEST_DIR}`, '--platform=claude', '--force'])
const afterForce = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')
assert(afterForce.includes('My custom rules'), 'preserves existing adapter content on --force')

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-init-platform.js`
Expected: FAIL — no AGENTS.md or CLAUDE.md generated

**Step 3: Modify init.js**

Update `src/commands/init.js` — add platform adapter generation after the `.specdev` copy:

```javascript
import { existsSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { copySpecdev } from '../utils/copy.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const ADAPTERS = {
  claude: {
    file: 'CLAUDE.md',
    content: `# Claude Code Instructions

Read \`.specdev/_main.md\` before starting any task. It contains the workflow, skills, and project context you need.
`
  },
  codex: {
    file: 'AGENTS.md',
    content: `# Agent Instructions

Read \`.specdev/_main.md\` before starting any task. It contains the workflow, skills, and project context you need.
`
  },
  cursor: {
    dir: '.cursor',
    file: '.cursor/rules',
    content: `Read \`.specdev/_main.md\` before starting any task. It contains the workflow, skills, and project context you need.
`
  },
  generic: {
    file: 'AGENTS.md',
    content: `# Agent Instructions

Read \`.specdev/_main.md\` before starting any task. It contains the workflow, skills, and project context you need.
`
  }
}

export function initCommand(flags = {}) {
  const target = flags.target ? resolve(flags.target) : process.cwd()
  const force = flags.force === true || flags.force === 'true'
  const dryRun = flags['dry-run'] === true || flags['dry-run'] === 'true'
  const platform = flags.platform || 'generic'

  const specdevPath = join(target, '.specdev')
  const templatePath = join(__dirname, '..', '..', 'templates', '.specdev')

  if (existsSync(specdevPath) && !force) {
    console.error('.specdev already exists. Use --force to overwrite.')
    process.exit(1)
  }

  if (dryRun) {
    console.log('[dry-run] Would initialize .specdev at:', target)
    console.log('[dry-run] Platform adapter:', platform)
    return
  }

  try {
    copySpecdev(templatePath, specdevPath, force)

    // Generate platform adapter
    const adapter = ADAPTERS[platform] || ADAPTERS.generic
    const adapterPath = join(target, adapter.file)

    if (!existsSync(adapterPath)) {
      if (adapter.dir) {
        mkdirSync(join(target, adapter.dir), { recursive: true })
      }
      writeFileSync(adapterPath, adapter.content)
      console.log(`Created ${adapter.file} (${platform} adapter)`)
    } else {
      console.log(`${adapter.file} already exists — skipping (won't overwrite your customizations)`)
    }

    console.log(`\n✓ Initialized .specdev at ${target}`)
    console.log(`\nNext steps:`)
    console.log(`  1. Read .specdev/_main.md to understand the workflow`)
    console.log(`  2. Edit .specdev/project_notes/big_picture.md with your project context`)
    console.log(`  3. Start your first assignment in .specdev/assignments/`)
  } catch (err) {
    console.error('Failed to initialize:', err.message)
    process.exit(1)
  }
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-init-platform.js`
Expected: PASS

**Step 5: Add test script and commit**

Add to package.json: `"test:init-platform": "node tests/test-init-platform.js"`

```bash
git add src/commands/init.js tests/test-init-platform.js package.json
git commit -m "feat: add platform adapter generation to specdev init"
```

---

### Task 8: Update _main.md for v2 structure

Update the router to reference the new skill folder structure and the scripts-as-tools model.

**Files:**
- Modify: `templates/.specdev/_main.md`

**Step 1: Read current _main.md**

Read: `templates/.specdev/_main.md`

**Step 2: Update _main.md**

Replace the content of `templates/.specdev/_main.md` with an updated version that:
- References folder-based skills (`skills/<name>/SKILL.md`)
- Explains the scripts-as-tools model
- Keeps the assignment flow but references new state/ structure
- Mentions platform adapters

```markdown
# SpecDev Workflow

You are working in a project that uses SpecDev — a spec-driven development framework. Skills are manuals that teach you when and how to use scripts (deterministic tools). You are the brain.

## Getting Started

1. Read `project_notes/big_picture.md` for project context
2. Check `state/assignments/` for active work (or `assignments/` in older projects)
3. List available skills: look in `skills/` for folders containing `SKILL.md`
4. Each skill has a **Contract** section that tells you: Input → Process → Output → Next skill

## How Skills Work

```
skills/<name>/
  SKILL.md        ← read this: it's the manual
  scripts/        ← run these: they're deterministic tools
  docs/           ← reference material
  prompts/        ← subagent templates
```

- **Read SKILL.md** to learn when and how to use a skill
- **Run scripts** for reliable, deterministic operations (state management, validation, scaffolding)
- Scripts accept arguments, write JSON/markdown output, and manage state files
- You focus on reasoning and decisions; scripts handle mechanical tasks

## Assignment Flow

1. **Understand** — Run the planning skill's `get-project-context.sh`, ask questions one at a time
2. **Plan** — Use the planning skill to create a self-executing plan document
3. **Execute** — Follow the plan's header instruction (it tells you which skill to use)
4. **Verify** — Use verification skill scripts to confirm completion
5. **Capture** — Distill learnings into `knowledge/` for future reference

## Rules That Always Apply

- Read always-apply skills (verification-before-completion, receiving-code-review) at start of work
- No completion claims without running verification scripts and confirming output
- No performative agreement in reviews — verify technically before accepting
- Every skill produces an artifact (document, state file, or report)
- Scripts handle polling, state transitions, and validation — don't do these manually
```

**Step 3: Verify existing tests still pass**

Run: `npm test`
Expected: PASS (verify-output.js checks for _main.md existence, not content)

**Step 4: Commit**

```bash
git add templates/.specdev/_main.md
git commit -m "docs: update _main.md for v2 skills-as-tools model"
```

---

### Task 9: Wire up all tests and run full validation

Make sure all new tests are in the test pipeline and everything passes together.

**Files:**
- Modify: `package.json` (add new test scripts)

**Step 1: Update package.json test scripts**

Add new test scripts and update the main test sequence:

```json
{
  "test:skills": "node tests/test-skills.js",
  "test:planning": "node tests/test-planning-scripts.js",
  "test:init-platform": "node tests/test-init-platform.js",
  "test": "npm run test:init && npm run test:verify && npm run test:scan && npm run test:skills && npm run test:planning && npm run test:init-platform && npm run test:work && npm run test:check && npm run test:cleanup"
}
```

**Step 2: Run the full test suite**

Run: `npm test`
Expected: All tests PASS

**Step 3: Fix any failures**

If any tests fail due to interactions (e.g., verify-output.js needs new files in the required list), fix them.

**Step 4: Commit**

```bash
git add package.json tests/verify-output.js
git commit -m "test: wire up planning skill tests into full test suite"
```

---

## Summary

9 tasks total:

| Task | What | Key files |
|------|------|-----------|
| 1 | Folder-based skills in `specdev skills` | `src/commands/skills.js`, `tests/test-skills.js` |
| 2 | Planning SKILL.md (the manual) | `templates/.specdev/skills/planning/SKILL.md` |
| 3 | `get-project-context.sh` | `templates/.../scripts/get-project-context.sh` |
| 4 | `scaffold-plan.sh` | `templates/.../scripts/scaffold-plan.sh` |
| 5 | `validate-plan.sh` | `templates/.../scripts/validate-plan.sh` |
| 6 | `register-assignment.sh` | `templates/.../scripts/register-assignment.sh` |
| 7 | Platform adapters in `specdev init` | `src/commands/init.js`, `tests/test-init-platform.js` |
| 8 | Update `_main.md` for v2 | `templates/.specdev/_main.md` |
| 9 | Wire tests, full validation | `package.json` |
