# Workflow v3 Implementation Plan

> **For agent:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Migrate specdev from 14+ skills with redundant handoffs to a clean 5-phase, 2-agent architecture.

**Architecture:** Remove 8 skills (planning, verification, spec-review, code-review, gate-coordination, subagent-dispatch, knowledge-capture-project, knowledge-capture-specdev). Rework brainstorming into the combined interactive phase. Create 3 new skills (breakdown, implementing, review-agent). Rework orientation. Simplify knowledge-capture to a single skill. Update assignment folder structure. Rewrite _main.md and _router.md. Update verify-output.js, tests, and package.json.

**Tech Stack:** Node.js (ESM), shell scripts (bash), fs-extra

---

### Task 1: Remove obsolete skills and update verify-output.js

Remove 8 folder-based skills that are absorbed into the new workflow. Update verify-output.js to remove their entries and add new ones. Update the test pipeline.

**Files:**
- Delete: `templates/.specdev/skills/planning/` (entire folder)
- Delete: `templates/.specdev/skills/verification/` (entire folder)
- Delete: `templates/.specdev/skills/spec-review/` (entire folder)
- Delete: `templates/.specdev/skills/code-review/` (entire folder)
- Delete: `templates/.specdev/skills/gate-coordination/` (entire folder)
- Delete: `templates/.specdev/skills/subagent-dispatch/` (entire folder)
- Delete: `templates/.specdev/skills/knowledge-capture-project/` (entire folder)
- Delete: `templates/.specdev/skills/knowledge-capture-specdev/` (entire folder)
- Delete: `templates/.specdev/skills/executing/` (entire folder — replaced by implementing)
- Delete: `tests/test-verification-scripts.js`
- Delete: `tests/test-spec-review-scripts.js`
- Delete: `tests/test-gate-coordination-scripts.js`
- Delete: `tests/test-subagent-dispatch-scripts.js`
- Delete: `tests/test-knowledge-capture-scripts.js`
- Delete: `tests/test-planning-scripts.js`
- Delete: `tests/test-executing-scripts.js`
- Modify: `tests/verify-output.js`
- Modify: `package.json`

**Step 1:** Delete obsolete skill folders:

```bash
rm -rf templates/.specdev/skills/planning
rm -rf templates/.specdev/skills/verification
rm -rf templates/.specdev/skills/spec-review
rm -rf templates/.specdev/skills/code-review
rm -rf templates/.specdev/skills/gate-coordination
rm -rf templates/.specdev/skills/subagent-dispatch
rm -rf templates/.specdev/skills/knowledge-capture-project
rm -rf templates/.specdev/skills/knowledge-capture-specdev
rm -rf templates/.specdev/skills/executing
```

**Step 2:** Delete obsolete test files:

```bash
rm -f tests/test-verification-scripts.js
rm -f tests/test-spec-review-scripts.js
rm -f tests/test-gate-coordination-scripts.js
rm -f tests/test-subagent-dispatch-scripts.js
rm -f tests/test-knowledge-capture-scripts.js
rm -f tests/test-planning-scripts.js
rm -f tests/test-executing-scripts.js
```

**Step 3:** Rewrite `tests/verify-output.js` required files list. Remove all entries for deleted skills. Add entries for new skills:

```javascript
  // Brainstorming skill (directory-based)
  '.specdev/skills/brainstorming/SKILL.md',
  '.specdev/skills/brainstorming/scripts/get-project-context.sh',
  // Breakdown skill (directory-based)
  '.specdev/skills/breakdown/SKILL.md',
  // Implementing skill (directory-based)
  '.specdev/skills/implementing/SKILL.md',
  '.specdev/skills/implementing/scripts/extract-tasks.sh',
  '.specdev/skills/implementing/scripts/track-progress.sh',
  '.specdev/skills/implementing/scripts/poll-for-feedback.sh',
  '.specdev/skills/implementing/prompts/implementer.md',
  '.specdev/skills/implementing/prompts/spec-reviewer.md',
  '.specdev/skills/implementing/prompts/code-reviewer.md',
  // Review-agent skill (directory-based)
  '.specdev/skills/review-agent/SKILL.md',
  '.specdev/skills/review-agent/scripts/poll-for-feedback.sh',
  '.specdev/skills/review-agent/prompts/breakdown-reviewer.md',
  '.specdev/skills/review-agent/prompts/implementation-reviewer.md',
  // Knowledge-capture skill (directory-based)
  '.specdev/skills/knowledge-capture/SKILL.md',
  // Test-driven-development skill (directory-based)
  '.specdev/skills/test-driven-development/SKILL.md',
  '.specdev/skills/test-driven-development/scripts/verify-tests.sh',
  // Systematic-debugging skill (directory-based)
  '.specdev/skills/systematic-debugging/SKILL.md',
  // Parallel-worktrees skill (directory-based)
  '.specdev/skills/parallel-worktrees/SKILL.md',
  '.specdev/skills/parallel-worktrees/scripts/setup-worktree.sh',
  // Orientation skill (directory-based)
  '.specdev/skills/orientation/SKILL.md',
  '.specdev/skills/orientation/scripts/list-skills.sh',
```

**Step 4:** Update `package.json` — remove obsolete test scripts from pipeline and individual entries, remove obsolete cleanup paths. Keep: test:tdd, test:parallel-worktrees, test:orientation. Remove: test:planning, test:executing, test:verification, test:spec-review, test:gate-coordination, test:subagent-dispatch, test:knowledge-capture.

**Step 5:** Run: `rm -rf ./test-output && node ./bin/specdev.js init --target=./test-output && node tests/verify-output.js`
Expected: FAIL (new skill files don't exist yet)

**Step 6:** Commit:

```bash
git add -A
git commit -m "refactor: remove 9 obsolete skills and their tests for v3 migration"
```

---

### Task 2: Rework brainstorming skill

Move `get-project-context.sh` into brainstorming (it was in planning). Rewrite SKILL.md to be the combined interactive phase that produces `proposal.md` + `design.md`.

**Files:**
- Create: `templates/.specdev/skills/brainstorming/scripts/get-project-context.sh` (move from planning)
- Modify: `templates/.specdev/skills/brainstorming/SKILL.md`

**Step 1:** Copy `get-project-context.sh` from the git history or recreate it. It was at `planning/scripts/get-project-context.sh` before Task 1 deleted it. Use `git show HEAD~1:templates/.specdev/skills/planning/scripts/get-project-context.sh` to recover it.

```bash
mkdir -p templates/.specdev/skills/brainstorming/scripts
git show HEAD~1:templates/.specdev/skills/planning/scripts/get-project-context.sh > templates/.specdev/skills/brainstorming/scripts/get-project-context.sh
chmod +x templates/.specdev/skills/brainstorming/scripts/get-project-context.sh
```

**Step 2:** Rewrite `templates/.specdev/skills/brainstorming/SKILL.md`:

```markdown
---
name: brainstorming
description: Interactive idea-to-design session — one question at a time, validated design sections
---

# Brainstorming

## Contract

- **Input:** A vague idea, feature wish, bug report, or refactoring goal
- **Process:** Context scan → Q&A (one question at a time) → explore approaches → present design sections → validate each section
- **Output:** `brainstorm/proposal.md` + `brainstorm/design.md` in the assignment folder
- **Next phase:** breakdown (automatic, triggered by user saying `auto next`)

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `scripts/get-project-context.sh` | Scan repo structure, recent commits, knowledge files | At the start, before asking questions |

## Process

### Phase 1: Understand

1. Run `scripts/get-project-context.sh <project-root>` to get current state
2. Read the output — repo structure, recent work, existing knowledge
3. Ask the user ONE question at a time to understand their goal
4. Prefer multiple-choice questions when possible
5. Continue until you understand: purpose, constraints, success criteria

**Rules:**
- Only ONE question per message
- Multiple choice preferred over open-ended
- Acknowledge each answer before asking the next question
- Do not proceed until you understand what you are building

### Phase 2: Explore Approaches

1. Present 2-3 different approaches with trade-offs
2. Lead with your recommended approach and explain why
3. Keep it conversational — this is a discussion, not a presentation
4. Let the user choose

### Phase 3: Design Sections

Present the design incrementally for validation.

1. Break the design into sections of 200-300 words
2. Present one section at a time
3. After each section, ask: "Does this look right so far?"
4. Cover: architecture, components, data flow, error handling, testing approach
5. Be ready to revise if something doesn't make sense
6. Record key decisions and their reasoning as you go

### Phase 4: Write to Assignment

Once all design sections are validated:

1. Create the assignment folder (use register-assignment pattern)
2. Write `brainstorm/proposal.md` — short (1-2 paragraphs), what and why
3. Write `brainstorm/design.md` — full validated design including:
   - Goal and approach
   - Architecture and components
   - Key decisions with reasoning
   - Success criteria
   - Testing approach
4. Announce: "Brainstorm complete. Design written to assignment folder."
5. Stop and wait for user

**After stopping**, the user may:
- Launch the review agent to review the brainstorm: `review brainstorm`
- Come back with review feedback for you to address
- Say `auto next` to proceed to breakdown + implementation

## Red Flags

- Asking multiple questions at once — one per message, always
- Skipping get-project-context.sh — need context before asking questions
- Committing to an approach before exploring alternatives — always show 2-3 options
- Presenting the entire design at once — 200-300 word sections, validate each
- Jumping to implementation details — stay at the design level during brainstorm

## Integration

- **Before this skill:** orientation (if unsure whether brainstorming is needed)
- **After this skill:** breakdown (automatic, turns design into executable steps)
- **Review:** User may launch review agent between brainstorm and breakdown
```

**Step 3:** Run: `rm -rf ./test-output && node ./bin/specdev.js init --target=./test-output && node tests/verify-output.js`
Expected: FAIL (other new skills still missing)

**Step 4:** Commit:

```bash
git add templates/.specdev/skills/brainstorming/
git commit -m "refactor: rework brainstorming skill for v3 — combined interactive phase"
```

---

### Task 3: Create breakdown skill

New skill — reads `brainstorm/design.md` and generates a detailed superpowers-style executable plan.

**Files:**
- Create: `templates/.specdev/skills/breakdown/SKILL.md`

**Step 1:** Create `templates/.specdev/skills/breakdown/SKILL.md`:

```markdown
---
name: breakdown
description: Turn a validated design into bite-sized executable steps — automatic, no user interaction
---

# Breakdown

## Contract

- **Input:** `brainstorm/design.md` from the assignment folder
- **Process:** Read design → decompose into tasks → detail each task with TDD steps, exact code, exact commands
- **Output:** `breakdown/plan.md` in the assignment folder
- **Next phase:** implementing (automatic)

## Process

### Phase 1: Read Design

1. Read `brainstorm/design.md` from the assignment folder
2. Identify all components, features, and behaviors described
3. Understand the architecture and how pieces connect
4. Note the testing approach and success criteria

### Phase 2: Decompose

Break the design into ordered tasks. Each task should be:

- **2-5 minutes of work** — one logical unit
- **Independent enough to commit** — each task produces working code
- **Ordered by dependency** — later tasks build on earlier ones

### Phase 3: Detail Each Task

Every task MUST follow this structure:

    ### Task N: [Component Name]

    **Files:**
    - Create: `exact/path/to/file.ext`
    - Modify: `exact/path/to/existing.ext`
    - Test: `tests/exact/path/to/test.ext`

    **Step 1: Write the failing test**
    [Complete test code in a fenced code block]

    **Step 2: Run test to verify it fails**
    Run: `exact command`
    Expected: FAIL with "specific error message"

    **Step 3: Write minimal implementation**
    [Complete implementation code in a fenced code block]

    **Step 4: Run test to verify it passes**
    Run: `exact command`
    Expected: PASS

    **Step 5: Commit**
    [Exact git commands with commit message]

### Phase 4: Write Plan

1. Write the plan with header:

```
# [Feature Name] Implementation Plan

> **For agent:** Implement this plan task-by-task using TDD discipline.

**Goal:** [One sentence from design]

**Architecture:** [2-3 sentences from design]

**Tech Stack:** [From design]

---
```

2. Write all tasks in order
3. Save to `breakdown/plan.md` in the assignment folder
4. Write `review/ready-for-review.md` with phase: breakdown
5. Check for `review/watching.json`:
   - If present: run `implementing/scripts/poll-for-feedback.sh` and wait
   - If absent: proceed to implementing phase immediately

## Rules

- Exact file paths always — never "add a test file"
- Complete code in plan — never "add validation logic"
- Exact commands with expected output — never "run the tests"
- Every task follows RED-GREEN-REFACTOR
- DRY, YAGNI — only what the design specifies
- Frequent commits — one per task

## Red Flags

- Vague task steps ("add error handling") — show the actual code
- Tasks longer than 5 minutes — break them down further
- Missing test steps — every task must have RED and GREEN
- Missing file paths — every file must have an exact path
- Tasks that don't commit — every task is an atomic commit

## Integration

- **Before this skill:** brainstorming (produces the design this skill reads)
- **After this skill:** implementing (executes the plan)
- **Review:** Review agent may check the plan before implementation starts
```

**Step 2:** Run verify — Expected: FAIL (more skills needed)

**Step 3:** Commit:

```bash
git add templates/.specdev/skills/breakdown/
git commit -m "feat: add breakdown skill — design to executable plan"
```

---

### Task 4: Create implementing skill

New skill replacing executing + subagent-dispatch. Has scripts (extract-tasks.sh, track-progress.sh, poll-for-feedback.sh) and prompts (implementer.md, spec-reviewer.md, code-reviewer.md).

**Files:**
- Create: `templates/.specdev/skills/implementing/SKILL.md`
- Create: `templates/.specdev/skills/implementing/scripts/extract-tasks.sh` (recover from git)
- Create: `templates/.specdev/skills/implementing/scripts/track-progress.sh` (recover from git)
- Create: `templates/.specdev/skills/implementing/scripts/poll-for-feedback.sh` (new)
- Create: `templates/.specdev/skills/implementing/prompts/implementer.md` (adapt from subagent-dispatch)
- Create: `templates/.specdev/skills/implementing/prompts/spec-reviewer.md` (adapt from code-review)
- Create: `templates/.specdev/skills/implementing/prompts/code-reviewer.md` (adapt from code-review)

**Step 1:** Recover scripts from git history:

```bash
mkdir -p templates/.specdev/skills/implementing/scripts
mkdir -p templates/.specdev/skills/implementing/prompts
git show HEAD~3:templates/.specdev/skills/executing/scripts/extract-tasks.sh > templates/.specdev/skills/implementing/scripts/extract-tasks.sh
git show HEAD~3:templates/.specdev/skills/executing/scripts/track-progress.sh > templates/.specdev/skills/implementing/scripts/track-progress.sh
chmod +x templates/.specdev/skills/implementing/scripts/extract-tasks.sh
chmod +x templates/.specdev/skills/implementing/scripts/track-progress.sh
```

**Step 2:** Create `templates/.specdev/skills/implementing/scripts/poll-for-feedback.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# poll-for-feedback.sh — Block until review-feedback.md appears
#
# Usage: poll-for-feedback.sh <assignment-path> <phase> [timeout-seconds]
# Blocks until review/review-feedback.md appears with matching phase
# Output: Contents of review-feedback.md
# Exit: 0 = feedback received, 1 = timeout or error

ASSIGNMENT_PATH="${1:-}"
PHASE="${2:-}"
TIMEOUT="${3:-1800}"

if [ -z "$ASSIGNMENT_PATH" ] || [ ! -d "$ASSIGNMENT_PATH" ]; then
  echo "Error: assignment directory required" >&2
  echo "Usage: poll-for-feedback.sh <assignment-path> <phase> [timeout-seconds]" >&2
  exit 1
fi

if [ -z "$PHASE" ]; then
  echo "Error: phase required (brainstorm, breakdown, implementation)" >&2
  exit 1
fi

ASSIGNMENT_PATH=$(cd "$ASSIGNMENT_PATH" && pwd)
FEEDBACK_FILE="$ASSIGNMENT_PATH/review/review-feedback.md"
ELAPSED=0
INTERVAL=5

echo "Waiting for review feedback (phase: $PHASE, timeout: ${TIMEOUT}s)..." >&2

while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
  if [ -f "$FEEDBACK_FILE" ]; then
    # Check if feedback is for the right phase
    FEEDBACK_PHASE=$(grep '^\*\*Phase:\*\*' "$FEEDBACK_FILE" 2>/dev/null | sed 's/\*\*Phase:\*\* *//' | tr -d '[:space:]')
    if [ "$FEEDBACK_PHASE" = "$PHASE" ]; then
      cat "$FEEDBACK_FILE"
      exit 0
    fi
  fi
  sleep "$INTERVAL"
  ELAPSED=$((ELAPSED + INTERVAL))
done

echo "Error: timeout waiting for review feedback after ${TIMEOUT}s" >&2
exit 1
```

**Step 3:** Create `templates/.specdev/skills/implementing/prompts/implementer.md`:

```markdown
# Implementer Subagent

You are a focused implementer. Your job is to implement exactly one task from a plan, following TDD discipline.

## Task

{TASK_TEXT}

## Context

- **Project root:** {PROJECT_ROOT}
- **Assignment:** {ASSIGNMENT_NAME}
- **Task number:** {TASK_NUMBER} of {TOTAL_TASKS}

## Before You Start

1. Read the task carefully — understand every requirement
2. If anything is unclear, ask questions BEFORE writing code
3. Identify the files you need to create or modify

## Implementation Protocol

Follow RED-GREEN-REFACTOR:

1. **Write the failing test** — exactly as specified in the task
2. **Run the test** — confirm it fails with the expected error
3. **Write minimal code** — just enough to make the test pass
4. **Run the test** — confirm it passes
5. **Refactor** — clean up if needed, verify tests still pass
6. **Commit** — atomic commit with descriptive message

## Self-Review Checklist

Before reporting completion, verify:

- [ ] All files listed in the task exist
- [ ] All tests pass
- [ ] Code is committed
- [ ] No extra files beyond what the task specifies
- [ ] No changes outside the task scope

## Report Format

```
## Task {TASK_NUMBER} Complete

**Files created:** [list]
**Files modified:** [list]
**Tests:** [pass count] passing
**Commit:** [hash] [message]

### What I Did
[Brief description]

### Decisions Made
[Any choices not covered by the task]

### Issues Encountered
[Problems and resolutions, or "None"]
```

## Rules

- Implement ONLY what the task specifies
- If the task provides exact code, use it
- If tests fail unexpectedly, debug before continuing
- Ask questions rather than guessing
- One commit per task
```

**Step 4:** Create `templates/.specdev/skills/implementing/prompts/spec-reviewer.md`:

```markdown
# Spec Compliance Reviewer

You are an independent spec compliance reviewer. Verify the implementation matches the task spec exactly.

## Task Spec

{TASK_SPEC}

## Implementation Summary

{IMPLEMENTATION_SUMMARY}

## Your Task

For each requirement in the task spec:

1. Is it implemented? (Yes / No / Partial)
2. Does the implementation match exactly? (Exact / Deviation)

## What to Check

- **Missing requirements** — spec says X, implementation doesn't include X
- **Extra work** — implementation includes Y, spec never asked for Y
- **Misinterpretations** — spec says X, implementation does something similar but different

## Critical Rule

> **Do not trust the implementer's report — read the actual code.**

## Output

**PASS** — All requirements met.
**FAIL** — List every deviation.
```

**Step 5:** Create `templates/.specdev/skills/implementing/prompts/code-reviewer.md`:

```markdown
# Code Quality Reviewer

You are an independent code quality reviewer. The spec compliance review already passed — you're checking quality, not correctness.

## Changes

- **Base commit:** {BASE_SHA}
- **Head commit:** {HEAD_SHA}
- **Description:** {DESCRIPTION}

## Evaluate

1. **Correctness** — Edge cases, error handling
2. **Security** — Injection risks, exposed secrets
3. **Readability** — Clear, self-documenting
4. **Maintainability** — Easy to modify
5. **Testing** — Adequate coverage

## Output

### Strengths
- [What was done well]

### Issues

**CRITICAL** — Must fix:
- [Issue + file:line + why]

**IMPORTANT** — Should fix:
- [Issue + file:line + suggestion]

**MINOR** — Nice to fix:
- [Issue + suggestion]

### Verdict

**READY** / **NOT READY**

## Rules

- Be specific — cite file paths and line numbers
- Be fair — acknowledge good work
- Severity must be justified
```

**Step 6:** Create `templates/.specdev/skills/implementing/SKILL.md`:

```markdown
---
name: implementing
description: Execute a plan task-by-task with fresh subagents and two-stage review per task
---

# Implementing

## Contract

- **Input:** `breakdown/plan.md` from the assignment folder
- **Process:** Extract tasks → dispatch subagent per task → spec review → quality review → commit
- **Output:** Implemented code, committed per-task, with progress tracked
- **Next phase:** knowledge-capture

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `scripts/extract-tasks.sh` | Parse plan into structured JSON task list | At the start |
| `scripts/track-progress.sh` | Mark tasks started/completed, get summary | After each task |
| `scripts/poll-for-feedback.sh` | Block until review agent responds | After signaling ready-for-review |

## Prompts

| Prompt | Purpose | When to dispatch |
|--------|---------|-----------------|
| `prompts/implementer.md` | Fresh subagent to implement one task | Per task |
| `prompts/spec-reviewer.md` | Verify implementation matches task spec | After implementer completes |
| `prompts/code-reviewer.md` | Check code quality after spec passes | After spec review passes |

## Process

### Phase 1: Setup

1. Read `breakdown/plan.md`
2. Run `scripts/extract-tasks.sh <plan-file>` to get the structured task list
3. Review — how many tasks, their names, file paths

### Phase 2: Per-Task Execution

For each task in order:

1. Run `scripts/track-progress.sh <plan-file> <N> started`
2. **Dispatch implementer** — use `prompts/implementer.md` with FULL task text
   - Fresh subagent, no prior context
   - Subagent implements, tests, commits, self-reviews
3. **Spec review** — dispatch `prompts/spec-reviewer.md`
   - If FAIL: implementer fixes → re-review (loop until PASS)
4. **Code quality review** — dispatch `prompts/code-reviewer.md`
   - If CRITICAL findings: implementer fixes → re-review (loop until READY)
5. Run `scripts/track-progress.sh <plan-file> <N> completed`

### Phase 3: Final Review

1. Run full test suite one final time
2. Write `review/ready-for-review.md` (phase: implementation)
3. Check `review/watching.json`:
   - If present: run `scripts/poll-for-feedback.sh`, read feedback, fix if needed (up to 3 rounds)
   - If absent: proceed to knowledge capture
4. Run `scripts/track-progress.sh <plan-file> summary`

## Red Flags

- Summarizing task text — always send FULL task text to subagent
- Reusing a subagent across tasks — fresh context per task
- Skipping spec review — check spec BEFORE quality
- Accepting first pass without fixing findings — loop until clean
- Starting quality review before spec passes — wrong order

## Integration

- **Before this skill:** breakdown (creates the plan)
- **After this skill:** knowledge-capture (distill learnings)
- **Review agent:** May do holistic review after all tasks complete
```

**Step 7:** Make scripts executable:

```bash
chmod +x templates/.specdev/skills/implementing/scripts/poll-for-feedback.sh
```

**Step 8:** Run verify — Expected: FAIL (review-agent and knowledge-capture still missing)

**Step 9:** Commit:

```bash
git add templates/.specdev/skills/implementing/
git commit -m "feat: add implementing skill — subagent dispatch with two-stage review"
```

---

### Task 5: Create review-agent skill

The holistic reviewer — separate session, file-based communication, explicit and auto modes.

**Files:**
- Create: `templates/.specdev/skills/review-agent/SKILL.md`
- Create: `templates/.specdev/skills/review-agent/scripts/poll-for-feedback.sh` (symlink or copy)
- Create: `templates/.specdev/skills/review-agent/prompts/breakdown-reviewer.md`
- Create: `templates/.specdev/skills/review-agent/prompts/implementation-reviewer.md`

**Step 1:** Create directory structure:

```bash
mkdir -p templates/.specdev/skills/review-agent/scripts
mkdir -p templates/.specdev/skills/review-agent/prompts
```

**Step 2:** Copy poll-for-feedback.sh (both skills need it):

```bash
cp templates/.specdev/skills/implementing/scripts/poll-for-feedback.sh templates/.specdev/skills/review-agent/scripts/poll-for-feedback.sh
chmod +x templates/.specdev/skills/review-agent/scripts/poll-for-feedback.sh
```

**Step 3:** Create `templates/.specdev/skills/review-agent/SKILL.md`:

```markdown
---
name: review-agent
description: Holistic reviewer — runs in a separate session, checks phase outputs via file signals
---

# Review Agent

## Contract

- **Input:** An assignment folder with completed phase outputs
- **Process:** Read phase artifacts → holistic review → write feedback → iterate until approved
- **Output:** `review/review-feedback.md` with verdict and findings
- **Next:** Main agent reads feedback and addresses issues (or proceeds if approved)

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `scripts/poll-for-feedback.sh` | Block until ready-for-review.md appears | In autoreview mode, waiting for next phase |

## Prompts

| Prompt | Purpose | When to dispatch |
|--------|---------|-----------------|
| `prompts/breakdown-reviewer.md` | Review the breakdown plan holistically | After breakdown phase completes |
| `prompts/implementation-reviewer.md` | Review the full implementation holistically | After implementation phase completes |

## Commands

### Explicit Review

User says: `review brainstorm`, `review breakdown`, or `review implementation`

1. Read the assignment folder
2. Read the relevant phase artifacts
3. Write `review/review-feedback.md` with verdict and findings
4. Done (one-shot)

### Auto Review

User says: `autoreview rest` or `autoreview breakdown and implementation`

**`autoreview brainstorm` is not valid** — brainstorm review is always user-mediated.

1. Write `review/watching.json` with phases to watch
2. Poll for `review/ready-for-review.md`
3. When it appears, review the phase
4. Write `review/review-feedback.md`
5. If needs-changes: wait for main agent to fix and re-signal (up to 3 rounds)
6. If approved: continue watching for next phase
7. After all watched phases reviewed and approved: done

## Review Protocol

### Brainstorm Review (explicit only)

Read `brainstorm/proposal.md` and `brainstorm/design.md`. Check:
- Is the goal clear and specific?
- Does the architecture make sense?
- Are there gaps in the design (missing error handling, unclear data flow)?
- Are the decisions well-reasoned?

### Breakdown Review

Use `prompts/breakdown-reviewer.md`. Check:
- Does the plan cover everything in the design?
- Are tasks ordered correctly (dependencies respected)?
- Is each task small enough (2-5 minutes)?
- Does every task have complete code, exact paths, exact commands?
- Are there missing tasks or unnecessary tasks?

### Implementation Review

Use `prompts/implementation-reviewer.md`. Check:
- Does the full implementation match the design?
- Do all tests pass?
- Are there integration issues between tasks?
- Is there scope drift (things built that weren't in the design)?
- Is test coverage adequate?

## Signal File Formats

### ready-for-review.md (written by main agent)

```markdown
# Ready for Review

**Phase:** breakdown
**Timestamp:** 2025-01-15T10:30:00
**Round:** 1
```

### review-feedback.md (written by review agent)

```markdown
# Review Feedback

**Phase:** breakdown
**Verdict:** approved / needs-changes
**Round:** 1
**Timestamp:** 2025-01-15T10:35:00

## Findings
- [list, or "None — approved"]
```

### watching.json (written by review agent)

```json
{"phases": ["breakdown", "implementation"], "started_at": "2025-01-15T10:00:00"}
```

## Iteration Limit

**3 rounds maximum per phase.** After 3 rounds of back-and-forth without approval, escalate to user:

> "Review loop for [phase] has reached 3 rounds without resolution. Here's what's still unresolved: [findings]. Please intervene."

## Red Flags

- Auto-reviewing brainstorm — brainstorm review must be user-mediated
- Skipping re-review after fixes — always verify fixes actually address findings
- Nitpicking during holistic review — focus on macro issues, not style
- Approving without reading the actual files — always read the artifacts

## Integration

- **Works with:** Main agent (brainstorming, breakdown, implementing skills)
- **Communication:** Via assignment folder signal files
- **Launched by:** User, in a separate session
```

**Step 4:** Create `templates/.specdev/skills/review-agent/prompts/breakdown-reviewer.md`:

```markdown
# Breakdown Plan Reviewer

You are a holistic plan reviewer. Check whether the breakdown plan fully and correctly implements the design.

## Design

{DESIGN_CONTENT}

## Breakdown Plan

{PLAN_CONTENT}

## Your Task

Review the plan as a whole:

1. **Coverage** — Does every design requirement have a corresponding task?
2. **Ordering** — Are tasks ordered by dependency? Can each task build on the previous?
3. **Granularity** — Is each task 2-5 minutes? Are any too large or too small?
4. **Completeness** — Does every task have exact file paths, complete code, exact commands?
5. **TDD** — Does every task follow RED-GREEN-REFACTOR?
6. **Gaps** — Are there missing tasks? Unnecessary tasks?
7. **Integration** — Will the tasks integrate correctly when all complete?

## Output

**Verdict:** approved / needs-changes

## Findings
- [Specific issues with task numbers and descriptions, or "None — approved"]
```

**Step 5:** Create `templates/.specdev/skills/review-agent/prompts/implementation-reviewer.md`:

```markdown
# Implementation Reviewer

You are a holistic implementation reviewer. Check whether the full implementation matches the design and works as an integrated whole.

## Design

{DESIGN_CONTENT}

## Breakdown Plan

{PLAN_CONTENT}

## Implementation

{IMPLEMENTATION_SUMMARY}

## Your Task

Review the implementation holistically:

1. **Design match** — Does the implementation match the design? Any drift?
2. **Integration** — Do all components work together? Any conflicts?
3. **Test coverage** — Are all behaviors tested? Any gaps?
4. **Scope** — Was anything built that wasn't in the design? Anything missing?
5. **Quality** — Any obvious issues visible at the integration level?

## Output

**Verdict:** approved / needs-changes

## Findings
- [Specific issues with file paths and descriptions, or "None — approved"]
```

**Step 6:** Commit:

```bash
git add templates/.specdev/skills/review-agent/
git commit -m "feat: add review-agent skill — holistic reviewer with file-based signals"
```

---

### Task 6: Create knowledge-capture skill + rework orientation

Simplified knowledge-capture (two diff files). Rework orientation for the 5-phase workflow.

**Files:**
- Create: `templates/.specdev/skills/knowledge-capture/SKILL.md`
- Modify: `templates/.specdev/skills/orientation/SKILL.md`

**Step 1:** Create `templates/.specdev/skills/knowledge-capture/SKILL.md`:

```markdown
---
name: knowledge-capture
description: Write two diff files — project notes gaps and workflow observations
---

# Knowledge Capture

## Contract

- **Input:** A completed, verified assignment
- **Process:** Compare learnings against project_notes → compare flow against specdev workflow → write two files
- **Output:** Two files in the knowledge vault
- **Next:** None — this is the final phase

## Process

### Step 1: Project Notes Diff

Compare what you learned during this assignment against the existing project notes:

1. Read `project_notes/big_picture.md` and `project_notes/feature_descriptions.md`
2. What did you learn about the project that these files don't capture?
3. Write findings to `knowledge/project-notes-diff.md`:

```markdown
# Project Notes Diff — [Assignment Name]

**Date:** YYYY-MM-DD
**Assignment:** [id and name]

## Gaps Found
- [What's missing or outdated in project_notes, with specific suggestions]

## No Changes Needed
- [Aspects that are already well-documented]
```

**Do NOT update the project_notes files.** The user decides whether to apply.

### Step 2: Workflow Diff

Compare how the workflow actually went against the specdev process:

1. Reflect on each phase: brainstorm, breakdown, implement, review
2. What worked well? What was friction?
3. Write findings to `knowledge/workflow-diff.md`:

```markdown
# Workflow Diff — [Assignment Name]

**Date:** YYYY-MM-DD
**Assignment:** [id and name]

## What Worked
- [Specific observations]

## What Didn't
- [Friction points, gaps, suggestions]
```

## Red Flags

- Updating project_notes files directly — write diffs only, user decides
- Being too vague — "it went fine" is not useful. Be specific.
- Skipping this phase — even small assignments produce learnings

## Integration

- **Before this skill:** implementing (produces the work to reflect on)
- **After this skill:** None — terminal phase
```

**Step 2:** Rewrite `templates/.specdev/skills/orientation/SKILL.md` for the 5-phase workflow:

```markdown
---
name: orientation
description: Router — helps you find the right skill for your situation
---

# Orientation

## Contract

- **Input:** You're starting work and don't know what to do
- **Process:** Assess the situation → route to the right phase
- **Output:** Directs you to the correct skill
- **Next skill:** Whatever matches your situation

## The 5-Phase Workflow

1. **Brainstorm** → `skills/brainstorming/SKILL.md` — Interactive design session
2. **Breakdown** → `skills/breakdown/SKILL.md` — Design to executable plan (automatic)
3. **Implement** → `skills/implementing/SKILL.md` — Subagent per task with review (automatic)
4. **Verify** → `skills/review-agent/SKILL.md` — Holistic review (separate session)
5. **Capture** → `skills/knowledge-capture/SKILL.md` — Write diff files (automatic)

## Quick Decision Tree

**Starting from scratch with an idea?**
→ Use **brainstorming**

**Have a validated design, need a plan?**
→ Use **breakdown**

**Have a plan, need to implement it?**
→ Use **implementing**

**Need to review someone's work?**
→ Use **review-agent** (launch in separate session)

**Debugging a failing test?**
→ Use **systematic-debugging** (`skills/systematic-debugging/SKILL.md`)

**Need parallel task execution?**
→ Use **parallel-worktrees** (`skills/parallel-worktrees/SKILL.md`)

## Scripts

| Script | Purpose | When to run |
|--------|---------|-------------|
| `scripts/list-skills.sh` | List all available skills | When discovering available skills |

## Two Agents

**Main agent** (your session): brainstorming → breakdown → implementing → knowledge-capture

**Review agent** (separate session): launched by user for holistic phase reviews

The main agent handles everything except holistic review. The review agent is launched separately when the user wants phase-level verification.

## Integration

- This skill is the starting point — it routes to everything else
```

**Step 3:** Run: `rm -rf ./test-output && node ./bin/specdev.js init --target=./test-output && node tests/verify-output.js`
Expected: PASS (all new skills now exist)

**Step 4:** Commit:

```bash
git add templates/.specdev/skills/knowledge-capture/ templates/.specdev/skills/orientation/SKILL.md
git commit -m "feat: add knowledge-capture skill, rework orientation for v3"
```

---

### Task 7: Update _main.md and _router.md

Rewrite the system entry points for the new 5-phase workflow.

**Files:**
- Modify: `templates/.specdev/_main.md`
- Modify: `templates/.specdev/_router.md`

**Step 1:** Rewrite `templates/.specdev/_main.md`:

```markdown
# SpecDev Workflow

You are working in a project that uses SpecDev — a spec-driven development framework with a 5-phase workflow and 2-agent architecture.

## Getting Started

1. Read `project_notes/big_picture.md` for project context
2. Check `assignments/` for active work
3. Read `skills/orientation/SKILL.md` for the decision tree

## The 5 Phases

1. **Brainstorm** — Interactive Q&A → validated design (`brainstorm/proposal.md` + `design.md`)
2. **Breakdown** — Automatic → detailed executable plan (`breakdown/plan.md`)
3. **Implement** — Automatic → subagent per task, TDD, two-stage review per task
4. **Verify** — Review agent (separate session) → holistic check at phase boundaries
5. **Capture** — Automatic → two diff files (project notes gaps + workflow observations)

## Two Agents

**Main agent** (this session): Handles phases 1-3 and 5. Interactive during brainstorm, automatic after.

**Review agent** (separate session): Handles phase 4. Launched by user for holistic phase reviews. Communicates via signal files in `review/`.

## How Skills Work

```
skills/<name>/
  SKILL.md        ← the manual
  scripts/        ← deterministic tools
  prompts/        ← subagent templates
```

## Assignment Folder

```
assignments/<id>/
  brainstorm/     ← proposal.md + design.md
  breakdown/      ← plan.md
  implementation/ ← progress.json
  review/         ← signal files (ready-for-review.md, review-feedback.md)
```

## Rules That Always Apply

- No completion claims without evidence
- No performative agreement in reviews — verify technically before accepting
- Every phase produces an artifact
- Scripts handle polling, state, and validation — don't do these manually
- Per-task reviews use subagents (spec then quality). Holistic reviews use the review agent.
```

**Step 2:** Rewrite `templates/.specdev/_router.md`:

```markdown
Based on the user request, identify the situation and route to the right skill.

---

## First reads

- `.specdev/_main.md` — workflow overview
- `.specdev/_guides/README.md` — guide index
- `.specdev/project_notes/big_picture.md` — project context
- `.specdev/project_notes/feature_descriptions.md` — what exists today

---

## Core guides

- `.specdev/_guides/codestyle_guide.md` (must follow)
- `.specdev/_guides/assignment_guide.md` (must follow)

---

## Skill routing

### Main agent skills (phases 1-3, 5)

- **Brainstorming:** `skills/brainstorming/SKILL.md` — start here for new work
- **Breakdown:** `skills/breakdown/SKILL.md` — design → executable plan
- **Implementing:** `skills/implementing/SKILL.md` — plan → code with subagent dispatch
- **Knowledge Capture:** `skills/knowledge-capture/SKILL.md` — write diff files after completion

### Review agent skill (phase 4)

- **Review Agent:** `skills/review-agent/SKILL.md` — holistic phase reviews (separate session)

### Supporting skills (use when needed)

- **Test-Driven Development:** `skills/test-driven-development/SKILL.md` — RED-GREEN-REFACTOR
- **Systematic Debugging:** `skills/systematic-debugging/SKILL.md` — root-cause analysis
- **Parallel Worktrees:** `skills/parallel-worktrees/SKILL.md` — git worktree isolation
- **Orientation:** `skills/orientation/SKILL.md` — decision tree for skill selection

### Flat skills (reference guides)

- `skills/scaffolding-lite.md` — lightweight scaffolding
- `skills/scaffolding-full.md` — full scaffolding
- `skills/verification-before-completion.md` — always-apply: evidence before claims
- `skills/receiving-code-review.md` — always-apply: no performative agreement

---

## Assignment structure

Assignments live in `.specdev/assignments/<id>/` with subfolders: `brainstorm/`, `breakdown/`, `implementation/`, `review/`.
```

**Step 3:** Commit:

```bash
git add templates/.specdev/_main.md templates/.specdev/_router.md
git commit -m "docs: rewrite _main.md and _router.md for v3 workflow"
```

---

### Task 8: Remove obsolete flat skills, update tests, run full suite

Clean up flat skills that are now redundant, update all tests, run the full pipeline.

**Files:**
- Delete: `templates/.specdev/skills/requesting-code-review.md` (absorbed into implementing prompts)
- Delete: `templates/.specdev/skills/subagent-driven-development.md` (absorbed into implementing)
- Delete: `templates/.specdev/skills/review-agent.md` (replaced by folder-based review-agent)
- Delete: `templates/.specdev/skills/micro-task-planning.md` (absorbed into breakdown)
- Delete: `templates/.specdev/skills/systematic-debugging.md` (flat version — folder version exists)
- Delete: `templates/.specdev/skills/parallel-worktrees.md` (flat version — folder version exists)
- Delete: `templates/.specdev/skills/skills_invoked_template.md` (no longer used)
- Modify: `templates/.specdev/skills/README.md`
- Modify: `tests/verify-output.js` (remove flat skill entries)
- Modify: `package.json` (final cleanup)
- Create: `tests/test-implementing-scripts.js`
- Create: `tests/test-review-agent-scripts.js`

**Step 1:** Delete obsolete flat skills:

```bash
rm -f templates/.specdev/skills/requesting-code-review.md
rm -f templates/.specdev/skills/subagent-driven-development.md
rm -f templates/.specdev/skills/review-agent.md
rm -f templates/.specdev/skills/micro-task-planning.md
rm -f templates/.specdev/skills/systematic-debugging.md
rm -f templates/.specdev/skills/parallel-worktrees.md
rm -f templates/.specdev/skills/skills_invoked_template.md
```

**Step 2:** Update `tests/verify-output.js` — remove deleted flat skill entries. Keep: scaffolding-lite.md, scaffolding-full.md, verification-before-completion.md, receiving-code-review.md, README.md.

**Step 3:** Update `templates/.specdev/skills/README.md` to describe the new skill inventory.

**Step 4:** Create `tests/test-implementing-scripts.js` — test extract-tasks.sh, track-progress.sh (reuse patterns from old executing tests), poll-for-feedback.sh (test timeout behavior with short timeout).

**Step 5:** Create `tests/test-review-agent-scripts.js` — test poll-for-feedback.sh (same script, test from review agent perspective).

**Step 6:** Update `package.json`:
- Add: `test:implementing`, `test:review-agent`
- Remove references to old test scripts
- Update cleanup paths
- Update pipeline order

**Step 7:** Run: `rm -rf ./test-output && npm test`
Expected: ALL PASS

**Step 8:** Commit:

```bash
git add -A
git commit -m "refactor: complete v3 migration — remove obsolete skills, add new tests, update pipeline"
```

---

## Verification

After all 8 tasks:
- `npm test` runs full pipeline with all test suites
- `specdev init` creates the new skill structure (9 folder-based skills + 4 flat reference skills)
- `verify-output.js` confirms all expected files present
- Assignment folder structure matches the v3 design
- _main.md and _router.md reflect the 5-phase, 2-agent architecture
