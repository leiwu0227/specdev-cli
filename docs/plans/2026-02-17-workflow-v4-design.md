# Workflow V4: Simplified Phases + Superpowers Alignment

## Problem

The current 2-agent review architecture (separate review agent session with `specdev review start/accept/reject`) adds complexity without proportional value. The workflow should be simpler: auto-review via subagents within the same session, explicit user approval gates inline, and an optional manual review escape hatch.

Additionally, specdev's implementation phase should adopt superpowers' battle-tested patterns (per-task subagent execution with spec + code review) rather than maintaining a separate approach.

## Design

### Value Proposition (vs Superpowers alone)

1. **Assignment tracking** — all work organized in `.specdev/assignments/`, building a persistent knowledge base across features. Important for large projects.
2. **Review at intermediate steps** — subagent review after brainstorm and per-task during implementation. Superpowers only reviews code, not designs. Catching a flawed architecture before implementation saves significant rework.
3. **Knowledge distillation** — post-assignment capture of learnings into reusable project knowledge.

### CLI Commands

#### Bash (setup)

```bash
specdev init [--platform=claude]    # Initialize .specdev (+ hooks/skills for claude)
specdev update                      # Update core skills
specdev skills                      # List available skills
```

#### Coding Agent (workflow)

```bash
specdev start                       # Interactive Q&A to write/update big_picture.md
specdev assignment                  # Start interactive brainstorm session
specdev breakdown                   # Decompose design into executable tasks
specdev implement                   # Execute tasks with multi-agent TDD
specdev review                      # Phase-aware manual review (separate session)
specdev ponder workflow             # Capture workflow observations
specdev ponder project              # Capture project-specific learnings
```

#### Removed Commands

```bash
# These are all removed:
specdev main request-review         # replaced by inline user approval
specdev main status                 # replaced by specdev remind / SessionStart hook
specdev main poll-review            # no longer needed (no cross-agent polling)
specdev review start                # replaced by auto subagent review
specdev review accept               # replaced by inline user approval
specdev review reject               # replaced by inline user approval
specdev review resume               # no longer needed
specdev review status               # replaced by remind / hook
specdev review poll-main            # no longer needed
specdev remind                      # replaced by SessionStart hook (auto-injected)
```

### Phase Flow

```
specdev start
  └─ Interactive Q&A → write/update big_picture.md

specdev assignment
  └─ Interactive brainstorm with user
  └─ Produce proposal.md + design.md
  └─ Subagent review (1 round, design focus)
  └─ USER APPROVAL GATE (inline ask in chat)
      └─ User approves in chat → proceed
      └─ User wants deeper review → launch separate session, run `specdev review`
      └─ User gives feedback → iterate on design

specdev breakdown
  └─ Read design.md → decompose into bite-sized TDD tasks
  └─ Produce plan.md (superpowers writing-plans format)
  └─ Subagent review (1-2 rounds, plan completeness)
  └─ Auto-proceed to implementation

specdev implement
  └─ For each task:
      └─ Dispatch implementer subagent (fresh context)
      └─ TDD: red → green → refactor → commit
      └─ Dispatch spec reviewer subagent
          └─ If issues: same implementer fixes → re-review (up to 10 rounds)
      └─ Dispatch code quality reviewer subagent
          └─ If CRITICAL: same implementer fixes → re-review (up to 10 rounds)
          └─ MINOR findings noted, don't block
  └─ USER APPROVAL GATE (inline ask in chat)
      └─ Same options as brainstorm gate

specdev ponder workflow / specdev ponder project
  └─ Post-assignment knowledge capture
```

### Auto-Review Mechanism

Each auto-review dispatches a **fresh subagent** with:
- The phase artifacts (proposal + design, plan, or code)
- A phase-specific review prompt
- The previous round's review report (if re-reviewing)

Review subagent outputs:
- Structured review report with findings tagged `CRITICAL` / `MINOR`
- Verdict: `PASS` or `NOT READY`

Loop logic (driven by main thread):
1. Dispatch review subagent
2. If `PASS` → proceed to next step
3. If `NOT READY` with CRITICALs → fix issues → re-review (increment counter)
4. If max rounds reached → stop, present findings to user at approval gate
5. MINORs are collected and shown to user but never trigger a fix loop

Round caps:
- Brainstorm review: 1 round
- Breakdown review: 1-2 rounds
- Implementation per-task review: up to 10 rounds per review type (spec + code quality)

### User Approval Gate

Hybrid approach:
1. Agent presents review summary inline in chat
2. Asks: "Approve to proceed?"
3. User can:
   - **Approve** — say "yes" / "looks good" → proceed to next phase
   - **Give feedback** — describe issues → agent iterates
   - **Request manual review** — launch a separate coding agent session, run `specdev review` for a deeper phase-aware interactive review, then come back and approve

### Manual Review (`specdev review`)

Launched in a **separate coding agent session**. Phase-aware:

- **After brainstorm:** reviews proposal.md + design.md for completeness, feasibility, scope
- **After implementation:** reviews code for spec compliance + code quality

The review agent:
1. Detects current phase from assignment state
2. Loads appropriate review prompts
3. Reads all relevant artifacts
4. Has interactive discussion with user about findings
5. User returns to main session to approve/reject

### SessionStart Hook (Claude Code)

Installed by `specdev init --platform=claude`. On every session start/resume/compact:

1. Detects `.specdev/` in working directory
2. Finds latest assignment
3. Determines current phase
4. Injects into context:
   - Current assignment name and phase
   - Phase-specific rules
   - Available specdev skills
   - "Announce every subtask with 'Using specdev: <action>'"
5. If no `.specdev/` found → graceful no-op

### Distribution

- **CLI:** `npm install -g` — portable, works with any platform
- **Claude Code:** `specdev init --platform=claude` additionally installs:
  - SessionStart hook to `.claude/`
  - Slash-command skills to `.claude/skills/`
  - CLAUDE.md adapter file
- **Other platforms:** adapter file + manual workflow (no hooks)

### Implementation Phase: Superpowers Alignment

The implementation phase copies superpowers' subagent-driven-development pattern:

- **Task format:** identical to superpowers writing-plans (bite-sized TDD steps with exact file paths, exact code, exact commands)
- **Execution:** fresh subagent per task, no context carryover
- **Per-task review:** spec reviewer → code quality reviewer (same implementer fixes)
- **TDD enforcement:** red → green → refactor per task
- **Verification:** no completion claims without evidence

Specdev adds on top:
- `Skills:` field per task (injects skill content into subagent context)
- Assignment-level tracking (progress.json)
- Knowledge capture after completion

### What Superpowers Covers vs What Specdev Adds

```
Superpowers covers:              Specdev adds on top:
────────────────────             ─────────────────────
                                 Project context (big_picture.md)
                                 Brainstorm phase (interactive Q&A)
                                 Design subagent review
                                 User approval gate
Writing plans               ←   Breakdown (same format + skill declarations)
                                 Plan subagent review
Subagent execution          ←   Implementation (copy superpowers)
Per-task spec+code review        (same, up to 10 rounds)
                                 User approval gate
                                 Manual review escape hatch
                                 Assignment tracking
                                 Knowledge distillation
```

## Files Affected

This is a significant refactor. Key changes:

- **Remove:** `src/commands/main.js`, `src/commands/review.js` (the multi-subcommand versions)
- **Add:** `src/commands/assignment.js`, `src/commands/breakdown.js`, `src/commands/implement.js`, `src/commands/start.js`
- **Rewrite:** `src/commands/review.js` (single command, no subcommands)
- **Update:** `bin/specdev.js` (router), `src/commands/help.js`, skill templates
- **Add:** SessionStart hook (`hooks/session-start.sh`, `hooks/hooks.json`)
- **Update:** `src/commands/init.js` (install hook for claude platform)
- **Rewrite:** skill files under `templates/.specdev/skills/core/` to match new phase flow
- **Update:** tests, README, package.json
