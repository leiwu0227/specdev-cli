# Skill: Review Agent

Automated review agent handoff — a separate Claude Code session serves as an independent reviewer for Gates 3-4, eliminating self-review bias.

**Core principle:** Separate process reviews implementation via file-based handoff protocol.

## When to Use

- Gates 3-4 review is needed and you want independent review (not self-review)
- A second Claude Code session is available to act as reviewer
- You want true separation of concerns between implementer and reviewer

## How It Works

### Automated mode (recommended)

Both sessions run autonomously — no human coordination needed.

```
REVIEWER (session 2 — start first):
  1. Runs: specdev review watch
  2. Blocks, polling every 5s for a pending review_request.json
  ... (sits idle until implementer creates a request) ...

IMPLEMENTER (session 1 — works normally):
  1. Finishes implementation + tests
  2. Runs: specdev review request --gate=gate_3
  3. Runs: specdev review wait     ← blocks until reviewer finishes

REVIEWER (session 2 — wakes up automatically):
  4. watch detects the pending request, runs verify-gates.sh pre-flight
  5. Prints review instructions — reviewer agent reads code and reviews
  6. Writes review_report.md in assignment folder
  7. Runs: specdev review accept  OR  specdev review reject --reason="..."
  8. Runs: specdev review watch  (loops back to wait for next request)

IMPLEMENTER (session 1 — unblocks automatically):
  9. wait detects passed/failed, prints result
  10. If passed → specdev review request --gate=gate_4, then wait again
  11. If failed → read review_report.md, fix issues, re-request
```

### Starter prompts

**Session 1 (implementer):** Give it the assignment as usual. The workflow guides tell it to call `specdev review request` + `specdev review wait` when it reaches Gates 3-4.

**Session 2 (reviewer):** Start with this prompt:

> You are a review agent. Read `.specdev/skills/review-agent.md`.
> Run `specdev review watch`. When it finds a pending review, perform
> the gate review following the printed instructions. Write your findings
> in review_report.md, then run `specdev review accept` or
> `specdev review reject --reason="..."`. After that, run
> `specdev review watch` again to wait for the next request.

### Manual mode

If you prefer explicit control, use `run`/`status` instead of `watch`/`wait`:

```
IMPLEMENTER:  specdev review request --gate=gate_3
              (notify reviewer)
REVIEWER:     specdev review run
              (review code)
              specdev review accept / reject
IMPLEMENTER:  specdev review status
```

## File-Based Handoff Protocol

### Signal File: `review_request.json`

Created in the assignment directory. Schema reference: `_templates/review_request_schema.json`

```json
{
  "version": 1,
  "assignment_id": "00001",
  "assignment_path": "assignments/00001_feature_auth",
  "gate": "gate_3",
  "status": "pending",
  "timestamp": "2026-02-11T10:30:00Z",
  "head_commit": "abc1234",
  "changed_files": ["src/auth.js", "tests/auth.test.js"],
  "notes": "Optional context from implementer"
}
```

### Status Lifecycle

`pending` → `in_progress` → `passed` / `failed`

### Lock Mechanism

`review_request.lock` is created when the reviewer starts and removed when done. Prevents concurrent reviews of the same assignment.

---

## Gate Procedures

### Gate 3: Spec Compliance Review

The reviewer must:

1. Read `proposal.md` — understand what was requested
2. Read `plan.md` — understand the approved approach
3. Read changed files — understand what was actually built
4. Compare implementation against proposal/plan scope
5. Check for:
   - **Missing requirements** — things requested but not implemented
   - **Extra work** — things built but not requested
   - **Misinterpretations** — requirements solved differently than intended
6. Write findings in `review_report.md` (use `_templates/review_report_template.md`)
7. Verdict: **PASS** or **FAIL** with specific `file:line` references

### Gate 4: Code Quality Review

Prerequisite: Gate 3 must show `passed` status.

The reviewer must:

1. Read all changed files
2. Review for:
   - Code quality (clean, readable, maintainable)
   - Architecture (appropriate abstractions, separation of concerns)
   - Testing (behavior verification, edge cases, TDD discipline)
   - Style consistency with existing codebase
3. Tag findings as `CRITICAL`, `IMPORTANT`, or `MINOR`
4. Each finding must include `file:line`, impact, and suggested fix
5. Verdict: **READY TO MERGE** or **NOT READY**

---

## CLI Commands

| Command | Who | Purpose |
|---|---|---|
| `specdev review request --gate=gate_3` | Implementer | Create review_request.json |
| `specdev review wait` | Implementer | Block until review completes (passed/failed) |
| `specdev review status` | Either | Show current review status |
| `specdev review watch` | Reviewer | Poll for pending reviews, auto-run when found |
| `specdev review run` | Reviewer | Run pre-flight checks + show review instructions (manual) |
| `specdev review pause` | Either | Reset in-progress review back to pending |
| `specdev review accept` | Reviewer | Mark review as passed |
| `specdev review reject --reason="..."` | Reviewer | Mark review as failed with reason |

---

## Pause and Resume

Either session can be interrupted safely:

- **Ctrl+C on `watch` or `wait`**: Just run the same command again. All state is in `review_request.json`.
- **Reviewer interrupted mid-review** (status stuck at `in_progress`): Run `specdev review pause` to reset back to `pending`. Then `watch` or `run` picks it up again.
- **Implementer interrupted during `wait`**: Just run `specdev review wait` again — it resumes polling.

If a reviewer session dies and leaves an orphaned lock file, `specdev review pause` cleans it up.

---

## Red Flags

**Never:**
- Review your own implementation (defeats the purpose)
- Skip verify-gates.sh pre-flight
- Accept without reading actual code (don't trust reports)
- Start Gate 4 before Gate 3 passes
- Modify the implementer's code directly (write findings, let them fix)

**If pre-flight fails:** Fix structural issues before AI review.

**If review fails:** Implementer fixes, then re-requests review. New review is from scratch.

---

## Skill Artifact

When invoked, log in `skills_invoked.md` with:
- Trigger: Gates 3-4 review needed with independent reviewer
- Artifact: `review_request.json` + `review_report.md` in assignment folder
