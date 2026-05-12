# Executing & Orientation Skills — Implementation Plan

> **For agent:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build the executing skill (picks up a plan and runs it task-by-task) and the orientation skill (router that helps agents find the right skill), completing the end-to-end workflow: orientation → planning → executing.

**Architecture:** Two new folder-based skills under `templates/.specdev/skills/`. The executing skill has scripts for plan parsing, progress tracking, and task extraction. The orientation skill has a script to list available skills with their contracts.

**Tech Stack:** Node.js (ESM), shell scripts (bash), fs-extra

---

### Task 1: Create executing skill SKILL.md

Write the manual that teaches agents how to pick up a self-executing plan and run it task-by-task.

**Files:**
- Create: `templates/.specdev/skills/executing/SKILL.md`
- Create: `templates/.specdev/skills/executing/scripts/.gitkeep`
- Modify: `tests/verify-output.js` (add executing skill files to required list)

**Step 1: Write the failing test**

Add to `tests/verify-output.js` required files array (before the Knowledge vault comment):

```javascript
  // Executing skill (directory-based)
  '.specdev/skills/executing/SKILL.md',
  '.specdev/skills/executing/scripts/extract-tasks.sh',
  '.specdev/skills/executing/scripts/track-progress.sh',
```

**Step 2: Run test to verify it fails**

Run: `node ./bin/specdev.js init --target=./test-output && node tests/verify-output.js`
Expected: FAIL — executing skill files missing

**Step 3: Create directories and SKILL.md**

Create `templates/.specdev/skills/executing/scripts/.gitkeep` (empty).

Create `templates/.specdev/skills/executing/SKILL.md`:

```markdown
---
name: executing
description: Execute a self-executing plan task-by-task with TDD discipline
---

# Executing

## Contract

- **Input:** A plan file at `docs/plans/YYYY-MM-DD-<name>.md` (created by the planning skill)
- **Process:** Parse tasks → execute each sequentially (test-first) → track progress → report completion
- **Output:** Implemented code, committed per-task, with progress tracked in assignment state
- **Next skill:** verification (to confirm everything is done), then knowledge-capture

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `scripts/extract-tasks.sh` | Parse a plan file and output structured task list as JSON | At the start, to understand all tasks |
| `scripts/track-progress.sh` | Update progress state (mark tasks started/completed) | After each task completes |

## Process

### Phase 1: Setup

1. Read the plan file referenced in the assignment (or provided directly)
2. Run `scripts/extract-tasks.sh <plan-file>` to get the structured task list
3. Review the output — it tells you how many tasks, their names, and file paths

### Phase 2: Execute Each Task

For each task in order:

1. Run `scripts/track-progress.sh <plan-file> <task-number> started` to mark it in progress
2. Read the task's complete description from the plan
3. Follow the steps exactly as written:
   - **Step 1:** Write the failing test (copy the code from the plan)
   - **Step 2:** Run the test command — verify it fails as expected
   - **Step 3:** Write the minimal implementation (copy the code from the plan)
   - **Step 4:** Run the test command — verify it passes
   - **Step 5:** Commit with the specified message
4. Run `scripts/track-progress.sh <plan-file> <task-number> completed` to mark it done
5. If a step fails unexpectedly, stop and diagnose before continuing

### Phase 3: Completion

1. Run `scripts/track-progress.sh <plan-file> summary` to confirm all tasks are done
2. Report what was implemented, tests passing, commits made

## When to Use

- You see a plan header that says "Use specdev:executing skill"
- You have a validated plan document (created by the planning skill)
- Tasks are meant to be executed sequentially by a single agent

## When NOT to Use

- Tasks are independent and could run in parallel → use subagent-dispatch instead
- The plan hasn't been validated → run validate-plan.sh first
- You need to design something → use planning skill first

## Red Flags

- Skipping the test step — always run the test, even if the code "looks right"
- Modifying task code beyond what the plan specifies — the plan was validated, follow it
- Continuing past a failing step — stop and diagnose
- Not committing after each task — each task should be an atomic commit
- Skipping track-progress.sh — progress tracking enables resume after interruption

## Integration

- **Before this skill:** planning (creates the plan this skill executes)
- **After this skill:** verification (confirm completion), knowledge-capture (distill learnings)
- **During this skill:** test-driven-development principles apply to every task
```

**Step 4: Verify test still fails (scripts not yet created)**

Run: `rm -rf ./test-output && node ./bin/specdev.js init --target=./test-output && node tests/verify-output.js`
Expected: FAIL — script files still missing

**Step 5: Commit**

```bash
git add templates/.specdev/skills/executing/ tests/verify-output.js
git commit -m "feat: add executing skill SKILL.md — manual for plan execution"
```

---

### Task 2: Write extract-tasks.sh

Parse a plan file and output a structured JSON task list that agents and scripts can consume.

**Files:**
- Create: `templates/.specdev/skills/executing/scripts/extract-tasks.sh`
- Create: `tests/test-executing-scripts.js`

**Step 1: Write the failing test**

Create `tests/test-executing-scripts.js`:

```javascript
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPTS_DIR = join(__dirname, '..', 'templates', '.specdev', 'skills', 'executing', 'scripts')
const TEST_DIR = join(__dirname, 'test-executing-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) {
    console.error(`  FAIL ${msg}`)
    failures++
  } else {
    console.log(`  PASS ${msg}`)
    passes++
  }
}

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
}

// Setup
cleanup()
mkdirSync(join(TEST_DIR, 'docs', 'plans'), { recursive: true })

// Create a sample plan
const planFile = join(TEST_DIR, 'docs', 'plans', 'test-plan.md')
writeFileSync(planFile, `# Test Feature Implementation Plan

> **For agent:** Use specdev:executing skill to implement this plan task-by-task.

**Goal:** Build a test feature

**Architecture:** Simple module with tests

**Tech Stack:** Node.js

---

### Task 1: Create the module

**Files:**
- Create: \`src/mod.js\`
- Test: \`tests/mod.test.js\`

**Step 1: Write the failing test**

\`\`\`javascript
import { mod } from '../src/mod.js'
test('mod returns hello', () => { expect(mod()).toBe('hello') })
\`\`\`

**Step 2: Run test to verify it fails**

Run: \`npm test\`
Expected: FAIL with "mod is not defined"

**Step 3: Write minimal implementation**

\`\`\`javascript
export function mod() { return 'hello' }
\`\`\`

**Step 4: Run test to verify it passes**

Run: \`npm test\`
Expected: PASS

**Step 5: Commit**

\`\`\`bash
git add src/mod.js tests/mod.test.js
git commit -m "feat: add mod module"
\`\`\`

### Task 2: Add greeting function

**Files:**
- Modify: \`src/mod.js\`
- Test: \`tests/mod.test.js\`

**Step 1: Write the failing test**

\`\`\`javascript
test('greet returns hello name', () => { expect(greet('world')).toBe('hello world') })
\`\`\`

**Step 2: Run test to verify it fails**

Run: \`npm test\`
Expected: FAIL

**Step 3: Write minimal implementation**

\`\`\`javascript
export function greet(name) { return 'hello ' + name }
\`\`\`

**Step 4: Run test to verify it passes**

Run: \`npm test\`
Expected: PASS

**Step 5: Commit**

\`\`\`bash
git add src/mod.js tests/mod.test.js
git commit -m "feat: add greet function"
\`\`\`
`)

// ---- Test extract-tasks.sh ----
console.log('\nextract-tasks.sh:')

const extractScript = join(SCRIPTS_DIR, 'extract-tasks.sh')
const result = spawnSync('bash', [extractScript, planFile], { encoding: 'utf-8' })

assert(result.status === 0, 'exits with code 0')

// Parse the JSON output
let tasks
try {
  tasks = JSON.parse(result.stdout)
  assert(true, 'outputs valid JSON')
} catch (e) {
  assert(false, 'outputs valid JSON — got: ' + result.stdout.substring(0, 100))
  tasks = []
}

assert(Array.isArray(tasks), 'output is an array')
assert(tasks.length === 2, 'finds 2 tasks')

if (tasks.length >= 1) {
  assert(tasks[0].number === 1, 'task 1 has number 1')
  assert(tasks[0].name.includes('Create the module'), 'task 1 has correct name')
  assert(tasks[0].files && tasks[0].files.length >= 1, 'task 1 has files listed')
}

if (tasks.length >= 2) {
  assert(tasks[1].number === 2, 'task 2 has number 2')
  assert(tasks[1].name.includes('greeting'), 'task 2 has correct name')
}

// Test with missing file
const badResult = spawnSync('bash', [extractScript, '/nonexistent/plan.md'], { encoding: 'utf-8' })
assert(badResult.status !== 0, 'exits non-zero for missing file')

// ---- Placeholder for track-progress tests (Task 3) ----

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-executing-scripts.js`
Expected: FAIL — script doesn't exist

**Step 3: Write the script**

Create `templates/.specdev/skills/executing/scripts/extract-tasks.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# extract-tasks.sh — Parse a plan file and output structured task list as JSON
#
# Usage: extract-tasks.sh <plan-file>
# Output: JSON array of tasks to stdout
# Exit: 0 on success, 1 on error

PLAN_FILE="${1:-}"

if [ -z "$PLAN_FILE" ] || [ ! -f "$PLAN_FILE" ]; then
  echo "Error: plan file required and must exist" >&2
  echo "Usage: extract-tasks.sh <plan-file>" >&2
  exit 1
fi

CONTENT=$(cat "$PLAN_FILE")

# Extract task count
TASK_COUNT=$(echo "$CONTENT" | grep -c '^### Task [0-9]' || true)

if [ "$TASK_COUNT" -eq 0 ]; then
  echo "[]"
  exit 0
fi

# Build JSON array
echo "["

TASK_NUM=0
while IFS= read -r header_line; do
  TASK_NUM=$((TASK_NUM + 1))

  # Extract task name
  TASK_NAME=$(echo "$header_line" | sed 's/^### Task [0-9]*:\s*//')

  # Extract task section
  TASK_SECTION=$(echo "$CONTENT" | sed -n "/^### Task ${TASK_NUM}:/,/^### Task $((TASK_NUM + 1)):/p" | head -n -1)
  if [ -z "$TASK_SECTION" ]; then
    TASK_SECTION=$(echo "$CONTENT" | sed -n "/^### Task ${TASK_NUM}:/,\$p")
  fi

  # Extract files (lines starting with - Create:/Modify:/Test: after **Files:**)
  FILES_JSON="["
  FIRST_FILE=true
  while IFS= read -r fline; do
    # Strip leading "- " and extract the path from backticks
    FILE_PATH=$(echo "$fline" | sed 's/^-\s*\(Create\|Modify\|Test\):\s*//; s/`//g' | xargs)
    FILE_ACTION=$(echo "$fline" | grep -o '^\-\s*\(Create\|Modify\|Test\)' | sed 's/^-\s*//' || echo "unknown")
    if [ -n "$FILE_PATH" ]; then
      if [ "$FIRST_FILE" = true ]; then
        FIRST_FILE=false
      else
        FILES_JSON+=","
      fi
      # Escape any quotes in file path
      FILE_PATH_ESC=$(echo "$FILE_PATH" | sed 's/"/\\"/g')
      FILE_ACTION_ESC=$(echo "$FILE_ACTION" | sed 's/"/\\"/g')
      FILES_JSON+="{\"path\":\"${FILE_PATH_ESC}\",\"action\":\"${FILE_ACTION_ESC}\"}"
    fi
  done <<< "$(echo "$TASK_SECTION" | grep -E '^\s*-\s*(Create|Modify|Test):' || true)"
  FILES_JSON+="]"

  # Add comma separator between tasks
  if [ "$TASK_NUM" -gt 1 ]; then
    echo ","
  fi

  # Escape task name for JSON
  TASK_NAME_ESC=$(echo "$TASK_NAME" | sed 's/"/\\"/g')

  echo "  {\"number\":${TASK_NUM},\"name\":\"${TASK_NAME_ESC}\",\"files\":${FILES_JSON}}"

done <<< "$(echo "$CONTENT" | grep '^### Task [0-9]')"

echo ""
echo "]"
```

**Step 4: Make executable, run test**

Run: `chmod +x templates/.specdev/skills/executing/scripts/extract-tasks.sh`
Run: `node tests/test-executing-scripts.js`
Expected: PASS

**Step 5: Commit**

```bash
git add templates/.specdev/skills/executing/scripts/extract-tasks.sh tests/test-executing-scripts.js
git commit -m "feat: add extract-tasks.sh — parses plan files into structured JSON"
```

---

### Task 3: Write track-progress.sh

Track task execution progress — mark tasks started/completed and provide a summary.

**Files:**
- Create: `templates/.specdev/skills/executing/scripts/track-progress.sh`
- Modify: `tests/test-executing-scripts.js` (append tests)

**Step 1: Append the failing test**

Add to `tests/test-executing-scripts.js` before the cleanup/summary section:

```javascript
// ---- Test track-progress.sh ----
console.log('\ntrack-progress.sh:')

const trackScript = join(SCRIPTS_DIR, 'track-progress.sh')

// Create a progress directory
const progressDir = join(TEST_DIR, '.specdev', 'state')
mkdirSync(progressDir, { recursive: true })

// Mark task 1 as started
const startResult = spawnSync('bash', [trackScript, planFile, '1', 'started'], { encoding: 'utf-8' })
assert(startResult.status === 0, 'mark task 1 started exits 0')

// Check progress file exists
const progressFile = planFile + '.progress.json'
assert(existsSync(progressFile), 'creates progress file next to plan')

const progress1 = JSON.parse(readFileSync(progressFile, 'utf-8'))
assert(progress1.tasks[0].status === 'in_progress', 'task 1 is in_progress')
assert(progress1.tasks[0].number === 1, 'task 1 number is 1')

// Mark task 1 as completed
const completeResult = spawnSync('bash', [trackScript, planFile, '1', 'completed'], { encoding: 'utf-8' })
assert(completeResult.status === 0, 'mark task 1 completed exits 0')

const progress2 = JSON.parse(readFileSync(progressFile, 'utf-8'))
assert(progress2.tasks[0].status === 'completed', 'task 1 is completed')
assert(progress2.tasks[0].completed_at !== undefined, 'task 1 has completed_at timestamp')

// Mark task 2 as started then completed
spawnSync('bash', [trackScript, planFile, '2', 'started'], { encoding: 'utf-8' })
spawnSync('bash', [trackScript, planFile, '2', 'completed'], { encoding: 'utf-8' })

// Get summary
const summaryResult = spawnSync('bash', [trackScript, planFile, 'summary', ''], { encoding: 'utf-8' })
assert(summaryResult.status === 0, 'summary exits 0')
assert(summaryResult.stdout.includes('2') && summaryResult.stdout.includes('completed'), 'summary shows completed count')

// Test with bad args
const badTrack = spawnSync('bash', [trackScript], { encoding: 'utf-8' })
assert(badTrack.status !== 0, 'exits non-zero with no args')
```

**Step 2: Run test to verify new tests fail**

Run: `node tests/test-executing-scripts.js`
Expected: extract-tasks tests PASS, track-progress tests FAIL

**Step 3: Write the script**

Create `templates/.specdev/skills/executing/scripts/track-progress.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# track-progress.sh — Track task execution progress
#
# Usage:
#   track-progress.sh <plan-file> <task-number> started    — Mark task as in progress
#   track-progress.sh <plan-file> <task-number> completed  — Mark task as completed
#   track-progress.sh <plan-file> summary                  — Show progress summary
#
# Output: Status message to stdout
# State: Creates/updates <plan-file>.progress.json
# Exit: 0 on success, 1 on error

PLAN_FILE="${1:-}"
TASK_NUM="${2:-}"
ACTION="${3:-}"

if [ -z "$PLAN_FILE" ]; then
  echo "Error: plan file required" >&2
  echo "Usage: track-progress.sh <plan-file> <task-number> <started|completed>" >&2
  echo "       track-progress.sh <plan-file> summary" >&2
  exit 1
fi

if [ ! -f "$PLAN_FILE" ]; then
  echo "Error: plan file not found: $PLAN_FILE" >&2
  exit 1
fi

PROGRESS_FILE="${PLAN_FILE}.progress.json"

# Initialize progress file if it doesn't exist
if [ ! -f "$PROGRESS_FILE" ]; then
  # Get task count from plan
  TASK_COUNT=$(grep -c '^### Task [0-9]' "$PLAN_FILE" || true)

  # Build initial JSON
  TASKS_JSON="["
  for i in $(seq 1 "$TASK_COUNT"); do
    if [ "$i" -gt 1 ]; then
      TASKS_JSON+=","
    fi
    TASKS_JSON+="{\"number\":${i},\"status\":\"pending\",\"started_at\":null,\"completed_at\":null}"
  done
  TASKS_JSON+="]"

  echo "{\"plan_file\":\"${PLAN_FILE}\",\"total_tasks\":${TASK_COUNT},\"tasks\":${TASKS_JSON}}" > "$PROGRESS_FILE"
fi

# Handle summary action
if [ "$TASK_NUM" = "summary" ]; then
  CONTENT=$(cat "$PROGRESS_FILE")
  TOTAL=$(echo "$CONTENT" | grep -o '"total_tasks":[0-9]*' | grep -o '[0-9]*')
  COMPLETED=$(echo "$CONTENT" | grep -o '"status":"completed"' | wc -l)
  IN_PROGRESS=$(echo "$CONTENT" | grep -o '"status":"in_progress"' | wc -l)
  PENDING=$(echo "$CONTENT" | grep -o '"status":"pending"' | wc -l)

  echo "Progress: ${COMPLETED}/${TOTAL} completed, ${IN_PROGRESS} in progress, ${PENDING} pending"
  exit 0
fi

# Validate task number and action
if [ -z "$TASK_NUM" ] || [ -z "$ACTION" ]; then
  echo "Error: task number and action required" >&2
  exit 1
fi

case "$ACTION" in
  started)
    NOW=$(date -Iseconds)
    # Use node for reliable JSON manipulation
    if command -v node &> /dev/null; then
      node -e "
        const fs = require('fs');
        const data = JSON.parse(fs.readFileSync('${PROGRESS_FILE}', 'utf-8'));
        const task = data.tasks.find(t => t.number === ${TASK_NUM});
        if (task) {
          task.status = 'in_progress';
          task.started_at = '${NOW}';
        }
        fs.writeFileSync('${PROGRESS_FILE}', JSON.stringify(data, null, 2));
      "
    else
      # Fallback: use sed for basic JSON manipulation
      sed -i "s/\"number\":${TASK_NUM},\"status\":\"pending\"/\"number\":${TASK_NUM},\"status\":\"in_progress\",\"started_at\":\"${NOW}\"/" "$PROGRESS_FILE"
    fi
    echo "Task ${TASK_NUM}: started"
    ;;
  completed)
    NOW=$(date -Iseconds)
    if command -v node &> /dev/null; then
      node -e "
        const fs = require('fs');
        const data = JSON.parse(fs.readFileSync('${PROGRESS_FILE}', 'utf-8'));
        const task = data.tasks.find(t => t.number === ${TASK_NUM});
        if (task) {
          task.status = 'completed';
          task.completed_at = '${NOW}';
        }
        fs.writeFileSync('${PROGRESS_FILE}', JSON.stringify(data, null, 2));
      "
    else
      sed -i "s/\"number\":${TASK_NUM},\"status\":\"in_progress\"/\"number\":${TASK_NUM},\"status\":\"completed\",\"completed_at\":\"${NOW}\"/" "$PROGRESS_FILE"
    fi
    echo "Task ${TASK_NUM}: completed"
    ;;
  *)
    echo "Error: action must be 'started' or 'completed'" >&2
    exit 1
    ;;
esac
```

**Step 4: Make executable, run test**

Run: `chmod +x templates/.specdev/skills/executing/scripts/track-progress.sh`
Run: `node tests/test-executing-scripts.js`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add templates/.specdev/skills/executing/scripts/track-progress.sh tests/test-executing-scripts.js
git commit -m "feat: add track-progress.sh — tracks task execution state"
```

---

### Task 4: Create orientation skill

The lightweight router that helps agents find the right skill. Includes a script to list skills with their contracts.

**Files:**
- Create: `templates/.specdev/skills/orientation/SKILL.md`
- Create: `templates/.specdev/skills/orientation/scripts/list-skills.sh`
- Modify: `tests/verify-output.js` (add orientation skill files)

**Step 1: Write the failing test**

Add to `tests/verify-output.js` required files array:

```javascript
  // Orientation skill (directory-based)
  '.specdev/skills/orientation/SKILL.md',
  '.specdev/skills/orientation/scripts/list-skills.sh',
```

**Step 2: Run test to verify it fails**

Run: `rm -rf ./test-output && node ./bin/specdev.js init --target=./test-output && node tests/verify-output.js`
Expected: FAIL — orientation skill files missing

**Step 3: Create the orientation skill**

Create `templates/.specdev/skills/orientation/scripts/` directory.

Create `templates/.specdev/skills/orientation/SKILL.md`:

```markdown
---
name: orientation
description: Router — helps you find the right skill for your situation
---

# Orientation

## Contract

- **Input:** You're starting work and don't know which skill to use
- **Process:** Assess the situation → match to the right skill
- **Output:** Directs you to the correct skill's SKILL.md
- **Next skill:** Whatever skill matches your situation

## When to Read This

Read this if:
- You just started a session and need to figure out what to do
- You're unsure which skill applies to your current situation
- You want to see what skills are available

## Quick Decision Tree

**Are you starting from scratch with an idea?**
→ Use the **planning** skill

**Do you have a validated plan document?**
→ Use the **executing** skill

**Are you debugging a failing test or unexpected behavior?**
→ Use the **systematic-debugging** skill (flat file: `skills/systematic-debugging.md`)

**Are you reviewing someone else's code?**
→ Read `skills/receiving-code-review.md` (always-apply)

**Are you about to claim work is done?**
→ Read `skills/verification-before-completion.md` (always-apply)

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `scripts/list-skills.sh` | List all available skills with their contracts | When you need to discover available skills |

## How to Use list-skills.sh

Run: `scripts/list-skills.sh <specdev-path>`

It outputs a summary of every skill: name, type (folder or flat), description, and contract (if available). Use this to quickly find the right skill without reading every SKILL.md.

## Always-Apply Skills

These skills should be read at the start of EVERY work session:

1. **verification-before-completion** (`skills/verification-before-completion.md`) — No completion claims without evidence
2. **receiving-code-review** (`skills/receiving-code-review.md`) — No performative agreement in reviews
```

Create `templates/.specdev/skills/orientation/scripts/list-skills.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# list-skills.sh — List all available skills with their contracts
#
# Usage: list-skills.sh <specdev-path>
# Output: Markdown summary of all skills to stdout
# Exit: 0 on success, 1 on error

SPECDEV_PATH="${1:-}"

if [ -z "$SPECDEV_PATH" ] || [ ! -d "$SPECDEV_PATH" ]; then
  echo "Error: .specdev path required" >&2
  echo "Usage: list-skills.sh <specdev-path>" >&2
  exit 1
fi

SKILLS_DIR="$SPECDEV_PATH/skills"

if [ ! -d "$SKILLS_DIR" ]; then
  echo "Error: no skills directory found at $SKILLS_DIR" >&2
  exit 1
fi

echo "# Available Skills"
echo ""

# Folder-based skills
for dir in "$SKILLS_DIR"/*/; do
  [ -d "$dir" ] || continue
  SKILL_FILE="$dir/SKILL.md"
  [ -f "$SKILL_FILE" ] || continue

  NAME=$(basename "$dir")
  DESC=$(grep '^description:' "$SKILL_FILE" | head -1 | sed 's/description:\s*//')
  HAS_SCRIPTS="no"
  [ -d "$dir/scripts" ] && HAS_SCRIPTS="yes"

  echo "## $NAME [folder] [scripts: $HAS_SCRIPTS]"
  [ -n "$DESC" ] && echo "$DESC"
  echo ""

  # Extract contract if present
  CONTRACT=$(sed -n '/^## Contract/,/^## /p' "$SKILL_FILE" | head -n -1)
  if [ -n "$CONTRACT" ]; then
    echo "$CONTRACT"
    echo ""
  fi
done

# Flat .md skills
for file in "$SKILLS_DIR"/*.md; do
  [ -f "$file" ] || continue
  BASENAME=$(basename "$file")
  [ "$BASENAME" = "README.md" ] && continue
  [ "$BASENAME" = "skills_invoked_template.md" ] && continue

  NAME="${BASENAME%.md}"
  # Read first meaningful line after any heading
  FIRST_LINE=$(grep -v '^#\|^$\|^---' "$file" | head -1 | sed 's/^\*\*[^*]*\*\*\s*//')

  echo "## $NAME [flat]"
  [ -n "$FIRST_LINE" ] && echo "$FIRST_LINE"
  echo ""
done
```

**Step 4: Make script executable, verify test still fails (needs init to copy)**

Run: `chmod +x templates/.specdev/skills/orientation/scripts/list-skills.sh`
Run: `rm -rf ./test-output && node ./bin/specdev.js init --target=./test-output && node tests/verify-output.js`
Expected: PASS (both executing and orientation files should now be found)

**Step 5: Commit**

```bash
git add templates/.specdev/skills/orientation/ templates/.specdev/skills/executing/ tests/verify-output.js
git commit -m "feat: add orientation skill — router that helps agents find the right skill"
```

---

### Task 5: Add list-skills.sh test and wire up new tests

Test the list-skills.sh script and wire all executing/orientation tests into the pipeline.

**Files:**
- Create: `tests/test-orientation-scripts.js`
- Modify: `package.json` (add test scripts, update test pipeline, add cleanup dirs)

**Step 1: Create the test file**

Create `tests/test-orientation-scripts.js`:

```javascript
import { existsSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const SCRIPTS_DIR = join(__dirname, '..', 'templates', '.specdev', 'skills', 'orientation', 'scripts')
const TEST_DIR = join(__dirname, 'test-orientation-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) {
    console.error(`  FAIL ${msg}`)
    failures++
  } else {
    console.log(`  PASS ${msg}`)
    passes++
  }
}

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
}

// Setup: init a project
cleanup()
const initResult = spawnSync('node', [CLI, 'init', `--target=${TEST_DIR}`], { encoding: 'utf-8' })
assert(initResult.status === 0, 'init succeeds')

// ---- Test list-skills.sh ----
console.log('\nlist-skills.sh:')

const listScript = join(SCRIPTS_DIR, 'list-skills.sh')
const specdevPath = join(TEST_DIR, '.specdev')
const result = spawnSync('bash', [listScript, specdevPath], { encoding: 'utf-8' })

assert(result.status === 0, 'exits with code 0')
assert(result.stdout.includes('# Available Skills'), 'has header')

// Should list folder-based skills
assert(result.stdout.includes('planning'), 'lists planning skill')
assert(result.stdout.includes('executing'), 'lists executing skill')
assert(result.stdout.includes('orientation'), 'lists orientation skill')
assert(result.stdout.includes('[folder]'), 'marks folder-based skills')

// Should list flat skills
assert(result.stdout.includes('verification-before-completion'), 'lists flat skills')
assert(result.stdout.includes('[flat]'), 'marks flat skills')

// Should show contracts for folder skills
assert(result.stdout.includes('Input') || result.stdout.includes('Contract'), 'shows contract info')

// Test with bad path
const badResult = spawnSync('bash', [listScript, '/nonexistent'], { encoding: 'utf-8' })
assert(badResult.status !== 0, 'exits non-zero for missing path')

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Update package.json**

Add to scripts section:

```json
"test:executing": "node ./tests/test-executing-scripts.js",
"test:orientation": "node ./tests/test-orientation-scripts.js",
```

Update `test` script to include `npm run test:executing && npm run test:orientation` in the sequence (after `test:planning`, before `test:init-platform`).

Update `test:cleanup` to include `./tests/test-executing-output ./tests/test-orientation-output`.

**Step 3: Run full test suite**

Run: `npm test`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add tests/test-orientation-scripts.js package.json
git commit -m "test: add executing and orientation tests, wire into pipeline"
```

---

## Summary

5 tasks total:

| Task | What | Key files |
|------|------|-----------|
| 1 | Executing skill SKILL.md | `templates/.../executing/SKILL.md` |
| 2 | `extract-tasks.sh` | `templates/.../executing/scripts/extract-tasks.sh` |
| 3 | `track-progress.sh` | `templates/.../executing/scripts/track-progress.sh` |
| 4 | Orientation skill + list-skills.sh | `templates/.../orientation/SKILL.md`, `scripts/list-skills.sh` |
| 5 | Tests + pipeline wiring | `tests/test-executing-scripts.js`, `tests/test-orientation-scripts.js` |
