---
verdict: approved
material_divergence: false
---

## Findings

Scope of inspection: `git status` plus targeted diffs of `src/commands/adhoc.js`, `src/commands/init.js`, `src/utils/cli.js`, `src/utils/commands.js`, `src/utils/git-delivery.js`, `templates/.specdev/_main.md`, both changed test files, and the untracked Assignment artifacts under `.specdev/assignments/00045_.../`. No tracked file was modified.

**Acceptance criteria — all have a final result, all supported by receipts in `implementation/progress.json` at `working-tree@e999661`:**

- AC-1: `classifyWorktree()` in `src/commands/adhoc.js:428` produces one versioned structure (`product_dirty`, `preserved_workflow_state`, `adopted`, `applied_policy`, `decision`) consumed by start-blocked, start-allowed, and finish payloads, and rendered identically in human form by `printWorktree()`. Product dirt still blocks without `--adopt-dirty` (`src/commands/adhoc.js:67`), and preservation is enforced at the commit boundary by the pre-existing `stageOwnedChanges()` exclusion of `.specdev/discussions` and `.specdev/test-audits` (`src/utils/git-delivery.js:55`). Covered by the new assertions in `tests/test-engine-integration.js` (JSON and stderr paths).
- AC-2: `templates/.specdev/_main.md:8-19` now carries a single copyable resolver that tests `[ -x .specdev/cache/bin/specdev ]` before use and otherwise resolves `command -v specdev`, so no ENOENT attempt is expected. A repo-wide grep confirms this is the only launcher mechanism in generated guidance. Announcement granularity is redefined in `_main.md` and in the generated `CLAUDE.md`/`specdev-adhoc` skill text in `src/commands/init.js`, retaining immediate announcement for blockers, plan changes, and failed verification. Asserted in `tests/test-init-platform.js`.
- AC-3: `adhoc verify --label=... -- <command>` uses `spawn` with direct argv (no shell), captures bounded output (16 KiB tail), exit status, duration, working directory, and `tested_revision`, and appends to `verification_attempts` in the ignored `.specdev/cache/adhoc.json` (confirmed ignored via `git check-ignore`). `currentAcceptanceEvidence()` correctly selects the latest attempt per label in chronological order, so a failed attempt followed by a passing rerun yields passing acceptance evidence while the full history is retained. Legacy `--verification="..."` remains accepted (`src/commands/adhoc.js:217`), and the receipt separates "Verification attempt history" from "Current acceptance evidence". The `--` separator required for this surface is added to `parseArgv` (`src/utils/cli.js:6-16`); no existing CLI surface passes a literal `--` positionally, so this is not a regression.
- AC-4: `completedPayload()` returns scope, receipt, `delivery_commit`, `delivery_subject`, `committed_paths` split into product vs receipt, verification (manual + attempts + acceptance evidence), start and end revisions, `remaining_worktree`, and `product_worktree_clean`. Both the normal and recovered (`recovered: true`) paths go through the same function; the test exercises recovery twice by restoring the active-state file and asserts human and JSON parity.
- AC-5: `readableSubject()` truncates at a clause or word boundary and strips trailing function words; `start --title` sets the subject independently while `receiptMarkdown()` still records the full `Scope:`. Consecutive Adhocs are asserted to produce distinct IDs and a linear parent chain of separate delivery commits.

**Dependency check:** none required. `package.json` changes only `releaseDate` to 2026-08-06 as CLAUDE.md requires; `node:child_process` is a builtin. No lockfile or registry evidence is owed.

**Non-blocking observations (no action required for approval):**

1. The committed receipt embeds captured command output (a 2048-char tail in prose plus the bounded capture inside the `## Structured verification` JSON block). This stays within the contract constraint, which forbids transient/raw process data in tracked *product* paths — the implementation itself keeps product and receipt paths distinct — and the design plan explicitly delegated readable receipt sections. Worth watching if attempt counts grow.
2. On spawn failure, `exit_status` records Node's negative `errno` (e.g. `-2` for ENOENT) rather than a shell-style code. The attempt is still correctly marked `failed`.
3. `classifyWorktree(..., { phase: 'finish' })` would report `decision: 'blocked'` if product paths remained after delivery. That never occurs on the success path and `product_worktree_clean` carries the operative signal, but the word reads oddly in a completed-finish payload.

No blocking contract defect remains. Verification receipts are reused as recorded — the focused run `node ./tests/test-engine-integration.js && node ./tests/test-init-platform.js` failed once on two whitespace-sensitive generated-guidance assertions and passed on rerun after correction, which matches the retained-history behavior the contract asks for. No full suite was run and none was authorized.
