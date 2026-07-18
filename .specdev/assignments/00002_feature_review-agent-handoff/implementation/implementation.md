# Implementation: Automated Review Agent Handoff

## Task Log

| Task ID | Description | Status | Date |
|---------|-------------|--------|------|
| T001 | Schema + Templates | ✅ Done | 2026-02-11 |
| T002 | Gate Check Script | ✅ Done | 2026-02-11 |
| T003 | Review Agent Skill | ✅ Done | 2026-02-11 |
| T004 | CLI Command (8 subcommands) | ✅ Done | 2026-02-11 |
| T005 | Guide and README Updates | ✅ Done | 2026-02-11 |
| T006 | Tests | ✅ Done | 2026-02-11 |

## T001: Schema + Templates

Created two template files:
- `templates/.specdev/_templates/review_request_schema.json` — JSON Schema (draft 2020-12) defining the handoff protocol fields: version, assignment_id, assignment_path, gate, status, timestamp, head_commit, changed_files, notes, reviewer_notes, completed_at
- `templates/.specdev/_templates/review_report_template.md` — Markdown template with sections for pre-flight results, Gate 3 spec compliance review (requirements table, deviations table, verdict), Gate 4 code quality review (findings table with severity, verdict)

## T002: Gate Check Script

Created `scripts/verify-gates.sh` (executable bash script):
- Gates 0-4 structural checks with `pass()`, `fail()`, `warn()` output helpers
- Gate 0: plan.md exists, complexity class detected, skills_invoked.md exists
- Gate 1: scaffold/_architecture.md conditional on MEDIUM/HIGH complexity
- Gate 2: implementation.md exists, TDD table entry detection
- Gate 3: review_request.json exists + valid JSON with required fields, proposal.md + plan.md present
- Gate 4: Gate 3 status check (must be passed first)
- Structural: validation_checklist.md, context/, tasks/ directories
- Exits non-zero on any failure, summary line with failure/warning counts

## T003: Review Agent Skill

Created `templates/.specdev/skills/review-agent.md`:
- Two modes documented: automated (recommended) and manual
- Automated mode flow: `watch` (reviewer) + `wait` (implementer) for zero-coordination operation
- Starter prompt for the reviewer session included
- File-based handoff protocol with status lifecycle and lock mechanism
- Gate 3 (spec compliance) and Gate 4 (code quality) procedures
- Pause and resume section covering all interruption scenarios
- CLI command reference table (8 commands)
- Red flags section

## T004: CLI Command

**`src/utils/scan.js`** — Added `findLatestAssignment()` export: scans assignments dir, sorts by name, returns the last (highest-numbered) entry with parsed id/type/label.

**`src/commands/review.js`** — Eight subcommands:
- `request`: Creates review_request.json with git commit hash, changed files, gate, status=pending. Checks for existing pending/in_progress review.
- `status`: Reads and displays review_request.json with formatted status icons, lock detection, report file detection.
- `run`: Validates pending status, creates lock file, sets in_progress, runs verify-gates.sh, prints gate-specific review instructions.
- `watch`: Polls all assignments every N seconds for pending review_request.json. When found, delegates to `run` flow. Returns after setup so the reviewer agent can do its work, then call `watch` again.
- `wait`: Polls the current assignment's review_request.json until status reaches `passed` or `failed`. On pass, prints result and suggests next gate. On fail, prints reason and exits non-zero.
- `pause`: Resets `in_progress` → `pending`, removes lock file. Handles already-pending and already-completed cases gracefully.
- `accept`: Sets status=passed, removes lock, suggests next gate.
- `reject`: Sets status=failed with reason, removes lock, suggests re-request.

**`bin/specdev.js`** — Added import and `case 'review'` routing with positionalArgs subcommand.

**`src/commands/help.js`** — Added `review <sub>` to COMMANDS list, added review examples (request, status, run, watch, wait).

## T005: Guide and README Updates

- `validation_guide.md`: Added "Automated Review Agent" section with implementer workflow using `request` + `wait`, and reviewer workflow using `watch`.
- `skills/README.md`: Added `review-agent.md` to invoke-when-needed skills list.
- `_templates/README.md`: Added `review_request_schema.json` and `review_report_template.md` entries with purpose, usage, and contents descriptions.

## T006: Tests

- Added 3 new entries to `tests/verify-output.js` required files list: `review-agent.md`, `review_request_schema.json`, `review_report_template.md`
- `npm test` passes: all 54 files verified, all scan tests pass
- Smoke tested all subcommands:
  - `request --gate=gate_3` creates valid review_request.json
  - `status` reads and displays with formatted icons
  - `run` locks + sets in_progress + runs verify-gates.sh + prints instructions
  - `watch` blocks until pending request found, then delegates to run
  - `watch` with no pending request polls silently until interrupted
  - `wait` with passed review unblocks immediately with result
  - `wait` with failed review prints reason and exits non-zero
  - `pause` resets in_progress → pending, removes lock
  - `accept` sets passed, removes lock, suggests gate_4
  - `reject --reason="..."` sets failed with reason
