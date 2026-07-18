# Review Agent Resilience Design

## Problem

The current review-agent-handoff implementation (assignment 00002) has four robustness issues:

1. **Agent context loss** — Claude Code sessions hit context limits or get closed. The agent loses all memory of what it was doing. `pause` + restart means starting from zero.
2. **Polling is fragile** — `watch`/`wait` are `while(true)` loops in Bash. Claude Code's Bash tool has a 2-minute default timeout (10 min max). After timeout the agent may not recover.
3. **Mid-review interruption** — If the reviewer crashes after reviewing 5/7 files, all intellectual work is lost. `pause` resets to pending.
4. **Coordination overhead** — Two terminals, two prompts, manual babysitting undermines the "automated" promise.

## Solution: Checkpoint-Based Resilience + Simplified CLI

### CLI Surface: Two Commands

Replace all 8 granular commands (`request`, `status`, `run`, `watch`, `wait`, `pause`, `accept`, `reject`) with two role-based commands:

```
specdev work mode=auto     # implementer — build stuff
specdev work mode=manual   # implementer — pause at decision points

specdev check mode=auto    # reviewer — review stuff autonomously
specdev check mode=manual  # reviewer — pause for human approval at verdict
```

**`specdev work`** — implementer loop:
- Read assignment, implement, run tests
- When ready for review: create `review_request.json`, poll for result
- `mode=auto`: auto-fix on rejection, re-request, keep going
- `mode=manual`: pause after rejection, show findings, wait for human

**`specdev check`** — reviewer loop:
- Poll for pending `review_request.json` (non-blocking single check, not infinite loop)
- Run preflight (`verify-gates.sh`), review code, write incremental report
- `mode=auto`: accept/reject autonomously, loop back to poll
- `mode=manual`: set status to `awaiting_approval`, wait for human verdict

**Switching mid-flight:** Interrupt the session (Ctrl+C), restart with the other mode. Checkpoint files ensure continuity.

### Non-Blocking Polling

Replace `while(true)` infinite loops with single-check behavior. The agent (not the CLI) manages its own polling cadence.

- `specdev check` returns immediately with current state
- The skill guide instructs the agent: "Run `specdev check` every 30-60 seconds"
- No Bash timeout issues because each invocation exits promptly
- Bounded timeout option available: `specdev check --timeout=120` polls for up to 2 minutes, then exits cleanly

### Checkpoint Files

#### `review_progress.json`

Created in the assignment directory alongside `review_request.json`. Updated by the reviewer after each file reviewed.

```json
{
  "phase": "reviewing",
  "mode": "auto",
  "started_at": "2026-02-11T10:32:00Z",
  "last_activity": "2026-02-11T10:35:12Z",
  "files_total": 7,
  "files_reviewed": [
    "src/commands/review.js",
    "scripts/verify-gates.sh",
    "templates/.specdev/skills/review-agent.md"
  ],
  "files_remaining": [
    "tests/test-review.js",
    "templates/.specdev/_templates/review_request_schema.json",
    "templates/.specdev/_templates/review_report_template.md",
    "src/utils/scan.js"
  ],
  "findings_so_far": 2,
  "session_id": "abc123"
}
```

**Phases:** `preflight` > `reviewing` > `writing-report` > `done`

**Stale detection:** `specdev check` uses `last_activity` to detect dead sessions (e.g. "no activity for 15m" = stale). A fresh agent can take over.

#### Incremental `review_report.md`

Written per-file as the reviewer progresses, not all at once at the end. Acts as both deliverable and checkpoint.

```markdown
# Review Report
Assignment: 00002 | Gate: gate_3 | Status: IN PROGRESS

## Pre-flight Results
verify-gates.sh passed (all structural checks OK)

## Files Reviewed

### src/commands/review.js
- IMPORTANT: `watch` uses infinite loop with no timeout (line 349)
- MINOR: `git diff --name-only HEAD~1` only captures last commit (line 135)

### scripts/verify-gates.sh
- (no findings)

### templates/.specdev/skills/review-agent.md
- IMPORTANT: Pause/resume section doesn't mention progress recovery (line 149)

## Files Not Yet Reviewed
- tests/test-review.js
- templates/.specdev/_templates/review_request_schema.json
- templates/.specdev/_templates/review_report_template.md
- src/utils/scan.js

## Verdict
PENDING - 4 files remaining
```

On crash and resume, a fresh agent reads the partial report, sees what's covered, and picks up from "Files Not Yet Reviewed."

### Resume Behavior

When `specdev check` detects a stale in-progress review, it prints a full briefing:

```
Resuming review: 00002_feature_review-agent-handoff
   Gate: gate_3 | Phase: reviewing
   Progress: 3/7 files reviewed, 2 findings so far

   Files already reviewed:
     src/commands/review.js (2 findings)
     scripts/verify-gates.sh (0 findings)
     templates/.specdev/skills/review-agent.md (1 finding)

   Files remaining:
     tests/test-review.js
     templates/.specdev/_templates/review_request_schema.json
     templates/.specdev/_templates/review_report_template.md
     src/utils/scan.js

   Next: continue reviewing from tests/test-review.js
```

If no progress file exists, it starts fresh (equivalent to old `run` command).

### Status Lifecycle

**Auto mode:**
`pending` > `in_progress` > `passed` / `failed`

**Manual mode:**
`pending` > `in_progress` > `awaiting_approval` > `passed` / `failed`

In manual mode, the reviewer writes the report and proposed verdict, then sets `awaiting_approval`. The human reads the report and makes the final call via `specdev check` (which detects the state and prompts for accept/reject).

### Updated Protocol File: `review_request.json`

```json
{
  "version": 1,
  "assignment_id": "00002",
  "assignment_path": ".specdev/assignments/00002_feature_review-agent-handoff",
  "gate": "gate_3",
  "status": "pending",
  "mode": "auto",
  "timestamp": "2026-02-11T10:30:00Z",
  "head_commit": "abc1234",
  "changed_files": ["src/commands/review.js", "tests/test-review.js"],
  "notes": "",
  "reviewer_notes": "",
  "proposed_verdict": "",
  "completed_at": ""
}
```

New fields: `mode`, `proposed_verdict` (used in manual mode when reviewer submits but awaits human approval).

## What Gets Deleted

- `specdev review request` — replaced by `specdev work` (creates request automatically when ready)
- `specdev review status` — replaced by `specdev check` / `specdev work` (shows status contextually)
- `specdev review run` — replaced by `specdev check` (auto-runs preflight when pending review found)
- `specdev review watch` — replaced by `specdev check` (non-blocking poll)
- `specdev review wait` — replaced by `specdev work` (non-blocking poll)
- `specdev review pause` — replaced by interrupt + restart (checkpoint files handle continuity)
- `specdev review accept` — replaced by `specdev check mode=auto` (auto-decides) or human approval flow in manual mode
- `specdev review reject` — same as above

## Migration

This is a breaking change to the CLI surface. Since the feature is not yet released (uncommitted on main), this is a redesign before first release — no migration needed.
