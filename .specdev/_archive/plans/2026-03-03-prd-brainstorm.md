# PRD Brainstorm Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add structured PRD sections to specdev's brainstorming phase — type-based required sections, question category guidance, and checkpoint validation.

**Architecture:** A design template in `_templates/`, updated SKILL.md with question categories, and enhanced `checkpointBrainstorm()` to validate required section headers by assignment type. No new scripts or commands.

**Tech Stack:** Node.js, fs-extra, regex header matching

---

### Task 1: Create the design template

**Files:**
- Create: `templates/.specdev/_templates/brainstorm-design.md`

**Step 1: Write the template file**

```markdown
<!-- BRAINSTORM DESIGN TEMPLATE
     Copy this into brainstorm/design.md and fill in relevant sections.
     Required sections vary by assignment type — see table below.
     Remove sections that don't apply. Remove all HTML comments.

     Required by type:
       feature:         Overview, Goals, Non-Goals, Design, Success Criteria
       bugfix:          Overview, Root Cause, Fix Design, Success Criteria
       refactor:        Overview, Non-Goals, Design, Success Criteria
       familiarization: Overview

     The agent may always add sections beyond the minimum.
-->

## Overview
<!-- What are we building/fixing/refactoring and why? 1-2 paragraphs. -->

## Goals
<!-- Specific, measurable objectives for this work. -->

## Non-Goals
<!-- What this will NOT do. Explicit scope boundaries. -->

## Root Cause
<!-- (Bugfix only) What's broken and why. -->

## Design
<!-- Technical approach: architecture, components, data flow. -->
<!-- For bugfix, use "Fix Design" as the heading instead. -->

## Success Criteria
<!-- How do we know it's done? Verifiable conditions. -->

## User Stories
<!-- Optional. User narratives: As a [user], I want [action] so that [benefit]. -->

## Dependencies
<!-- Optional. Systems, APIs, or components this work depends on. -->

## Risks
<!-- Optional. What could go wrong and how to mitigate. -->

## Technical Constraints
<!-- Optional. Limitations, compatibility requirements, performance targets. -->

## Testing Approach
<!-- Optional. How this will be tested — unit, integration, manual. -->

## Open Questions
<!-- Optional. Unresolved questions or areas needing further clarification. -->
```

**Step 2: Commit**

```bash
git add templates/.specdev/_templates/brainstorm-design.md
git commit -m "feat: add brainstorm design.md template with type-based sections"
```

---

### Task 2: Update brainstorming SKILL.md with question categories and template reference

**Files:**
- Modify: `templates/.specdev/skills/core/brainstorming/SKILL.md`

**Step 1: Add question categories and template reference to SKILL.md**

After the existing "Phase 1: Understand" section (line 35), add question category guidance. In "Phase 3: Design Sections", add reference to the template and type-based scaling. The full updated SKILL.md should be:

```markdown
---
name: brainstorming
description: Interactive idea-to-design session with collaborative Q&A
type: core
phase: brainstorm
input: User idea or request
output: brainstorm/proposal.md + brainstorm/design.md
next: breakdown
---

# Brainstorming

## Contract

- **Input:** A vague idea, feature wish, bug report, or refactoring goal
- **Process:** Context scan → Q&A (1-3 tightly related questions per message) → explore approaches → present design sections → validate each section
- **Output:** `brainstorm/proposal.md` + `brainstorm/design.md` in the assignment folder
- **Next phase:** breakdown (after user runs `specdev approve brainstorm`)

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `scripts/get-project-context.sh` | Scan repo structure, recent commits, knowledge files | At the start, before asking questions |

## Process

### Phase 1: Understand

1. Run `scripts/get-project-context.sh <project-root>` to get current state
2. Read the output — repo structure, recent work, existing knowledge
3. Ask the user 1-3 tightly related questions per message to understand their goal
   - Prefer multiple-choice over open-ended
   - Acknowledge each answer before asking the next question
4. Continue until you understand: purpose, constraints, success criteria
5. Do not proceed until you understand what you are building

**Question categories to cover** (not a rigid script — guide the conversation through these topics as relevant):

| Category | Core? | What to learn |
|----------|-------|---------------|
| Problem/goal | Always | What are we solving and why? |
| Scope boundaries | Always | What should this NOT do? |
| Success criteria | Always | How do we verify it works? |
| Target users/callers | When relevant | Who uses this? |
| Edge cases | When relevant | What could go wrong? |
| Dependencies | When relevant | What does this touch or rely on? |
| Existing patterns | When relevant | How does the codebase handle similar things? |
| Testing approach | When relevant | How will this be tested? |

### Phase 2: Explore Approaches

1. Present 2-3 different approaches with trade-offs
2. Lead with your recommended approach and explain why
3. Keep it conversational — this is a discussion, not a presentation
4. Let the user choose

### Phase 3: Design Sections

Present the design incrementally for validation. Use `_templates/brainstorm-design.md` as a starting point.

**Scale sections to the assignment type:**

| Type | Required sections |
|------|------------------|
| feature | Overview, Goals, Non-Goals, Design, Success Criteria |
| bugfix | Overview, Root Cause, Fix Design, Success Criteria |
| refactor | Overview, Non-Goals, Design, Success Criteria |
| familiarization | Overview |

You may always add optional sections (User Stories, Dependencies, Risks, Technical Constraints, Testing Approach, Open Questions) when the complexity warrants it.

1. Copy the template, keep sections relevant to the assignment type, remove the rest
2. Present one section at a time (200-300 words each)
3. After each section, ask: "Does this look right so far?"
4. Be ready to revise if something doesn't make sense
5. Record key decisions and their reasoning as you go

### Phase 4: Write to Assignment

Once all design sections are validated:

1. Create the assignment folder (use register-assignment pattern)
2. Write `brainstorm/proposal.md` — short (1-2 paragraphs), what and why
3. Write `brainstorm/design.md` — the filled template with validated sections
4. Announce: "Brainstorm complete. Design written to assignment folder."
5. Tell the user: "Run `specdev approve brainstorm` when you're ready to proceed."
6. Stop and wait — do NOT proceed to breakdown until the user has approved

**After stopping**, the user may:
- Review the design themselves and provide feedback
- Run `specdev review brainstorm` in a separate session for an independent review
- Run `specdev approve brainstorm` to proceed to breakdown

## Red Flags

- Skipping get-project-context.sh — need context before asking questions
- Committing to an approach before exploring alternatives — always show 2-3 options
- Presenting the entire design at once — 200-300 word sections, validate each
- Jumping to implementation details too early — stay at design level during brainstorm
- Missing Non-Goals section for features/refactors — scope boundaries prevent wasted work
- Missing Success Criteria — "how do we know it's done" must be explicit

## Integration

- **After this skill:** breakdown (starts after user runs `specdev approve brainstorm`)
- **Review:** User may run `specdev review brainstorm` before approving
```

**Step 2: Commit**

```bash
git add templates/.specdev/skills/core/brainstorming/SKILL.md
git commit -m "feat: add question categories and type-based sections to brainstorming skill"
```

---

### Task 3: Add section validation to brainstorm checkpoint

**Files:**
- Modify: `src/commands/checkpoint.js`

**Step 1: Write the failing test**

Add a new test file `tests/test-checkpoint-brainstorm.js`:

```javascript
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-checkpoint-brainstorm-output')

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

// --- Feature assignment: requires Overview, Goals, Non-Goals, Design, Success Criteria ---

console.log('\nbrainstorm checkpoint — feature with all sections:')
const featureDir = join(TEST_DIR, '.specdev', 'assignments', '001_feature_auth')
mkdirSync(join(featureDir, 'brainstorm'), { recursive: true })

writeFileSync(join(featureDir, 'brainstorm', 'proposal.md'), 'Add JWT authentication to the API endpoints.')
writeFileSync(join(featureDir, 'brainstorm', 'design.md'), `## Overview
Add JWT auth to protect API endpoints.

## Goals
Secure all API endpoints with token-based auth.

## Non-Goals
No OAuth or social login in v1.

## Design
Middleware validates JWT on each request.

## Success Criteria
All protected endpoints return 401 without valid token.
`)

let result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`, `--assignment=${featureDir}`])
assert(result.status === 0, 'feature with all required sections passes')

// --- Feature assignment: missing Non-Goals ---

console.log('\nbrainstorm checkpoint — feature missing Non-Goals:')
const featureDir2 = join(TEST_DIR, '.specdev', 'assignments', '002_feature_search')
mkdirSync(join(featureDir2, 'brainstorm'), { recursive: true })

writeFileSync(join(featureDir2, 'brainstorm', 'proposal.md'), 'Add full-text search to the app.')
writeFileSync(join(featureDir2, 'brainstorm', 'design.md'), `## Overview
Add search functionality.

## Goals
Users can search content.

## Design
Use elasticsearch index.

## Success Criteria
Search returns results within 200ms.
`)

result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`, `--assignment=${featureDir2}`])
assert(result.status === 1, 'feature missing Non-Goals fails')
assert(result.stderr.includes('Non-Goals') || result.stdout.includes('Non-Goals'), 'reports missing Non-Goals section')

// --- Bugfix assignment: requires Overview, Root Cause, Fix Design, Success Criteria ---

console.log('\nbrainstorm checkpoint — bugfix with all sections:')
const bugfixDir = join(TEST_DIR, '.specdev', 'assignments', '003_bugfix_crash')
mkdirSync(join(bugfixDir, 'brainstorm'), { recursive: true })

writeFileSync(join(bugfixDir, 'brainstorm', 'proposal.md'), 'Fix null pointer crash on empty input.')
writeFileSync(join(bugfixDir, 'brainstorm', 'design.md'), `## Overview
App crashes when input is empty.

## Root Cause
Missing null check in parser.

## Fix Design
Add guard clause before parsing.

## Success Criteria
Empty input returns empty result without crash.
`)

result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`, `--assignment=${bugfixDir}`])
assert(result.status === 0, 'bugfix with all required sections passes')

// --- Bugfix missing Root Cause ---

console.log('\nbrainstorm checkpoint — bugfix missing Root Cause:')
const bugfixDir2 = join(TEST_DIR, '.specdev', 'assignments', '004_bugfix_timeout')
mkdirSync(join(bugfixDir2, 'brainstorm'), { recursive: true })

writeFileSync(join(bugfixDir2, 'brainstorm', 'proposal.md'), 'Fix timeout on large uploads.')
writeFileSync(join(bugfixDir2, 'brainstorm', 'design.md'), `## Overview
Large uploads time out.

## Fix Design
Increase timeout and add chunking.

## Success Criteria
Uploads up to 100MB complete successfully.
`)

result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`, `--assignment=${bugfixDir2}`])
assert(result.status === 1, 'bugfix missing Root Cause fails')
assert(result.stderr.includes('Root Cause') || result.stdout.includes('Root Cause'), 'reports missing Root Cause section')

// --- Familiarization: only requires Overview ---

console.log('\nbrainstorm checkpoint — familiarization with Overview:')
const famDir = join(TEST_DIR, '.specdev', 'assignments', '005_familiarization_codebase')
mkdirSync(join(famDir, 'brainstorm'), { recursive: true })

writeFileSync(join(famDir, 'brainstorm', 'proposal.md'), 'Understand the authentication module.')
writeFileSync(join(famDir, 'brainstorm', 'design.md'), `## Overview
Explore the auth module to understand token flow and middleware chain.
`)

result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`, `--assignment=${famDir}`])
assert(result.status === 0, 'familiarization with Overview only passes')

// --- Refactor: requires Overview, Non-Goals, Design, Success Criteria ---

console.log('\nbrainstorm checkpoint — refactor with all sections:')
const refactorDir = join(TEST_DIR, '.specdev', 'assignments', '006_refactor_db-layer')
mkdirSync(join(refactorDir, 'brainstorm'), { recursive: true })

writeFileSync(join(refactorDir, 'brainstorm', 'proposal.md'), 'Refactor database layer to use connection pooling.')
writeFileSync(join(refactorDir, 'brainstorm', 'design.md'), `## Overview
Replace individual connections with a connection pool.

## Non-Goals
No schema changes or migrations in this refactor.

## Design
Introduce a pool manager that wraps pg.Pool.

## Success Criteria
All existing tests pass. Connection count drops under load.
`)

result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`, `--assignment=${refactorDir}`])
assert(result.status === 0, 'refactor with all required sections passes')

// --- Unknown type falls back to feature requirements ---

console.log('\nbrainstorm checkpoint — unknown type falls back to feature:')
const unknownDir = join(TEST_DIR, '.specdev', 'assignments', '007_unknown_thing')
mkdirSync(join(unknownDir, 'brainstorm'), { recursive: true })

writeFileSync(join(unknownDir, 'brainstorm', 'proposal.md'), 'Do something unknown.')
writeFileSync(join(unknownDir, 'brainstorm', 'design.md'), `## Overview
An unknown type assignment.

## Goals
Test fallback behavior.

## Non-Goals
Nothing excluded.

## Design
Simple implementation.

## Success Criteria
It works.
`)

result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`, `--assignment=${unknownDir}`])
assert(result.status === 0, 'unknown type with feature sections passes')

// --- Existing behavior preserved: missing proposal.md still fails ---

console.log('\nbrainstorm checkpoint — missing proposal.md still fails:')
const noProposalDir = join(TEST_DIR, '.specdev', 'assignments', '008_feature_noproposal')
mkdirSync(join(noProposalDir, 'brainstorm'), { recursive: true })

writeFileSync(join(noProposalDir, 'brainstorm', 'design.md'), `## Overview
Has design but no proposal.

## Goals
Test.

## Non-Goals
None.

## Design
Simple.

## Success Criteria
Works.
`)

result = runCmd(['checkpoint', 'brainstorm', `--target=${TEST_DIR}`, `--assignment=${noProposalDir}`])
assert(result.status === 1, 'missing proposal.md still fails')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
```

**Step 2: Run test to verify it fails**

Run: `node tests/test-checkpoint-brainstorm.js`
Expected: Tests for missing sections should FAIL (checkpoint doesn't validate sections yet)

**Step 3: Implement section validation in checkpoint.js**

Modify `src/commands/checkpoint.js`. Import `parseAssignmentId` and add section validation to `checkpointBrainstorm()`:

```javascript
import { resolveAssignmentPath, assignmentName, parseAssignmentId } from '../utils/assignment.js'
```

Replace the `checkpointBrainstorm` function with:

```javascript
const REQUIRED_SECTIONS = {
  feature:         ['Overview', 'Goals', 'Non-Goals', 'Design', 'Success Criteria'],
  bugfix:          ['Overview', 'Root Cause', 'Fix Design', 'Success Criteria'],
  refactor:        ['Overview', 'Non-Goals', 'Design', 'Success Criteria'],
  familiarization: ['Overview'],
}

async function checkpointBrainstorm(assignmentPath, name) {
  const missing = []

  const proposalPath = join(assignmentPath, 'brainstorm', 'proposal.md')
  const designPath = join(assignmentPath, 'brainstorm', 'design.md')

  if (!(await fse.pathExists(proposalPath))) {
    missing.push('brainstorm/proposal.md')
  } else {
    const content = await fse.readFile(proposalPath, 'utf-8')
    if (content.trim().length < 20) {
      missing.push('brainstorm/proposal.md (empty or too short)')
    }
  }

  let designContent = ''
  if (!(await fse.pathExists(designPath))) {
    missing.push('brainstorm/design.md')
  } else {
    designContent = await fse.readFile(designPath, 'utf-8')
    if (designContent.trim().length < 20) {
      missing.push('brainstorm/design.md (empty or too short)')
    }
  }

  // Validate required sections based on assignment type
  if (designContent && missing.length === 0) {
    const parsed = parseAssignmentId(assignmentName(assignmentPath))
    const type = parsed.type || 'feature'
    const required = REQUIRED_SECTIONS[type] || REQUIRED_SECTIONS.feature

    for (const section of required) {
      const pattern = new RegExp(`^##\\s+${section.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`, 'm')
      if (!pattern.test(designContent)) {
        missing.push(`brainstorm/design.md missing required section: ## ${section}`)
      }
    }
  }

  if (missing.length > 0) {
    console.error(`❌ Brainstorm checkpoint failed for ${name}`)
    for (const item of missing) {
      console.log(`   Missing: ${item}`)
    }
    blankLine()
    console.log('Generate the missing artifacts before requesting review.')
    process.exitCode = 1
    return
  }

  console.log(`✅ Brainstorm checkpoint passed for ${name}`)
  console.log('   brainstorm/proposal.md ✓')
  console.log('   brainstorm/design.md ✓')
  blankLine()
  console.log('Ready for review. User may run:')
  console.log('   specdev review brainstorm (optional, in separate session)')
  console.log('   specdev approve brainstorm (to proceed)')
}
```

**Step 4: Run test to verify it passes**

Run: `node tests/test-checkpoint-brainstorm.js`
Expected: All tests PASS

**Step 5: Run full test suite**

Run: `npm test`
Expected: All existing tests still pass (existing brainstorm checkpoint tests should still work since their assignment dirs use `001_feature_test` which now validates feature sections — verify the existing test data has the required headers or adjust)

**Step 6: Wire up the new test in package.json**

Add to `scripts` in `package.json`:
```json
"test:checkpoint-brainstorm": "node ./tests/test-checkpoint-brainstorm.js"
```

And add `npm run test:checkpoint-brainstorm &&` to the `test` script chain, before `test:checkpoint-tools`.

**Step 7: Commit**

```bash
git add src/commands/checkpoint.js tests/test-checkpoint-brainstorm.js package.json
git commit -m "feat: validate required design sections in brainstorm checkpoint by type"
```

---

### Task 4: Update init to copy the new template

**Files:**
- Modify: `src/commands/init.js` (if template copying is explicit) or verify templates are auto-copied

**Step 1: Verify template gets copied on init**

Run: `node bin/specdev.js init --target=/tmp/test-prd-init && ls /tmp/test-prd-init/.specdev/_templates/`

If `brainstorm-design.md` appears, no code change needed — templates are copied by glob.
If not, update the init command to include it.

**Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass including the new checkpoint-brainstorm tests

**Step 3: Commit (if changes needed)**

```bash
git add src/commands/init.js
git commit -m "fix: include brainstorm-design.md template in init"
```

---

### Task 5: Update skills on init (specdev update copies new SKILL.md)

**Step 1: Verify update copies new brainstorming SKILL.md**

Run: `node bin/specdev.js update --target=/tmp/test-prd-update && cat /tmp/test-prd-update/.specdev/skills/core/brainstorming/SKILL.md | head -20`

Verify the updated SKILL.md with question categories is present after update.

**Step 2: Run full test suite one final time**

Run: `npm test`
Expected: All tests pass

**Step 3: Final commit if any cleanup needed**

```bash
git commit -m "chore: verify template and skill propagation on init/update"
```
