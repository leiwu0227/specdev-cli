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
| D00001 | Research learnings from NousResearch Hermes | Promoted | 2026-05-07 | 00008 / 00009 / 00010 / 00011 | Five recommended follow-ups landed as separate assignments: workflow status JSON (00008), reviewer preflight (00009), structured skill inspection (00010), bounded working memory (00011). Architecture page item was dropped as out of scope. |
| D00002 | Autocontinue after reviewloop approval | Promoted | 2026-05-08 | 00019_feature_autocontinue-reviewloop | Proposes `specdev reviewloop <phase> --reviewer=<name> --autocontinue` to carry reviewed brainstorms through implementation and capture. |
| D00003 | Workflow bugs | Deferred | 2026-05-11 | - | Six bugs documented; verified still present in code at the 00023 audit (state.js "Invoke X skill" wording, `KNOWLEDGE_BRANCHES` duplicated across 4 files, `INDEXED_MARKDOWN_ROOTS` allowlist, CLI rejects `specdev checkpoint breakdown`, autocontinue needs-changes handling, discussion autocontinue silent ignore). Awaits a dedicated follow-up assignment. |
| D00004 | SpecDev workflow performance — excessive test runs | Resolved | 2026-05-11 | 00023 cleanup batches | All three proposed layers landed: A) test-driven-development/SKILL.md now requires scoped `verify-tests.sh` calls with end-of-phase full run; B) `npm test` switched to `node --test --test-concurrency=4 ./tests/test-*.js` (4.7× speedup: 5:32 -> 1:11); C) breakdown/SKILL.md per-task `+<count>` budget + plan-header aggregate cap + reviewer prompt enforcement. The full-suite hang was also resolved earlier by removing `test-reviewloop-command.js`. |

---

## Instructions

1. When creating a new discussion, add a row with the discussion ID (D00001 format)
2. Update status as the discussion progresses
3. When promoted, record the assignment ID in the "Promoted To" column
4. Use Notes column for context or abandonment reasons
