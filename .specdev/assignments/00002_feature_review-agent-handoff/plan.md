# Plan: Automated Review Agent Handoff

**Complexity: LOW**

This is a self-contained feature with clear requirements. No complex architecture decisions — it's a file-based protocol with a CLI wrapper and a skill document.

## Tasks

### T001: Schema + Templates
Create `review_request_schema.json` and `review_report_template.md` in `templates/.specdev/_templates/`.

### T002: Gate Check Script
Create `scripts/verify-gates.sh` — deterministic structural checks for Gates 0-4. Checks file existence, complexity class detection, JSON validation, prerequisite ordering.

### T003: Review Agent Skill
Create `templates/.specdev/skills/review-agent.md` — instructions for the reviewer agent covering the full workflow (automated and manual modes), gate procedures, CLI commands, pause/resume, and red flags. Includes starter prompt for the reviewer session.

### T004: CLI Command
- Add `findLatestAssignment()` helper to `src/utils/scan.js`
- Create `src/commands/review.js` with 8 subcommands:
  - `request` — implementer creates review_request.json
  - `status` — either side checks current review state
  - `run` — reviewer manually starts review (pre-flight + instructions)
  - `watch` — reviewer auto-polls for pending requests, runs when found
  - `wait` — implementer blocks until review completes (passed/failed)
  - `pause` — either side resets in_progress → pending, removes lock
  - `accept` — reviewer marks review passed
  - `reject` — reviewer marks review failed with reason
- Wire into `bin/specdev.js` routing
- Add to `src/commands/help.js`

### T005: Guide and README Updates
- Add automated review agent section to `validation_guide.md` (with `wait` in implementer workflow)
- Add `review-agent.md` to `skills/README.md` listing
- Add schema + report template entries to `_templates/README.md`

### T006: Tests
- Add new template files to `tests/verify-output.js` required files list
- Verify `npm test` passes
- Smoke test all 8 review subcommands

## Implementation Order

T001 → T002 → T003 → T004 → T005 → T006

## Files to Create

| File | Purpose |
|---|---|
| `scripts/verify-gates.sh` | Deterministic structural gate checks |
| `src/commands/review.js` | CLI command implementation (8 subcommands) |
| `templates/.specdev/skills/review-agent.md` | Skill guide for reviewer agent |
| `templates/.specdev/_templates/review_request_schema.json` | Schema reference |
| `templates/.specdev/_templates/review_report_template.md` | Report template |

## Files to Modify

| File | Change |
|---|---|
| `bin/specdev.js` | Add `review` command routing |
| `src/commands/help.js` | Add review to help text + examples |
| `src/utils/scan.js` | Add `findLatestAssignment()` |
| `templates/.specdev/_guides/task/validation_guide.md` | Add review agent section |
| `templates/.specdev/skills/README.md` | Add skill listing |
| `templates/.specdev/_templates/README.md` | Add template docs |
| `tests/verify-output.js` | Add new files to verification |
