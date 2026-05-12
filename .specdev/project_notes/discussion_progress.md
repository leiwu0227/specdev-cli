# Discussion Progress

Below is a list of discussions and their status.

## Format

| # | Discussion Name | Status | Created Date | Promoted To | Notes |
|---|----------------|--------|--------------|-------------|-------|
| ##### | Short description | Status | YYYY-MM-DD | Assignment ID | Optional notes |

**Status Values:**
- **Active**: Brainstorming in progress
- **Complete**: Brainstorm finished, not yet promoted
- **Promoted**: Converted to an assignment
- **Abandoned**: Discussion dropped

---

## Discussions

| # | Discussion Name | Status | Created Date | Promoted To | Notes |
|---|----------------|--------|--------------|-------------|-------|
| D00002 | Autocontinue after reviewloop approval | Promoted | 2026-05-08 | 00019_feature_autocontinue-reviewloop | Proposes `specdev reviewloop <phase> --reviewer=<name> --autocontinue` to carry reviewed brainstorms through implementation and capture. |
| D00003 | Workflow bugs | Complete | 2026-05-11 | - | Six bugs: (1) `--autocontinue` punts on needs-changes instead of auto-revising; (2) end-of-phase multiple-choice presentation inconsistent — two sources of truth; (3) `knowledge search` AND-default fails on natural-language queries, plus `_main.md`/`_index.md` and three folders unindexed; (4) `KNOWLEDGE_BRANCHES` constant duplicated in 4 files with divergent values; (5) `--autocontinue` on discussion review silently ignored on needs-changes; (6) `state.js` "Invoke X skill" wording misleads agent into looking for a slash-skill that doesn't exist. |
| D00004 | SpecDev workflow performance — excessive test runs | Complete | 2026-05-11 | - | Three-layer fix: (A) scope TDD verify-tests to single test files and drop the per-batch full run, leaving 1 full run at end of phase (was ~13); (B) replace this repo's 28-script `npm test` chain with `node --test --test-concurrency=N` plus quarantine of known-hang `test-reviewloop-command.js`; (C) make `breakdown/plan.md` declare per-task test budget (default ≤1 per task / ≤5 per assignment) and have the implementation reviewer count `it()` blocks vs. plan. A and C ship via `templates/.specdev/` to all downstream users. |

---

## Instructions

1. When creating a new discussion, add a row with the discussion ID (D00001 format)
2. Update status as the discussion progresses
3. When promoted, record the assignment ID in the "Promoted To" column
4. Use Notes column for context or abandonment reasons
