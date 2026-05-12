# Design: Cut SpecDev Workflow Test Overhead

## Overview

Two distinct slowness sources compound during `specdev implement` and `specdev reviewloop`:

1. **Workflow-mandated test cycles (affects every SpecDev project).** `test-driven-development/SKILL.md` tells agents to run `verify-tests.sh` — which auto-detects and runs the *full* test suite — after every RED, GREEN, and REFACTOR step. `implementing/SKILL.md` layers on a full run after every 3-task batch plus a final one. For a typical 9-task assignment that is ~13 full-suite runs during implementation alone. `verify-tests.sh` already accepts an optional `[test-command]` to scope a run, but no skill ever passes one. This shape ships to all downstream users via `templates/.specdev/skills/core/`.

2. **Slow `npm test` shape (specific to this repo).** This repo's `package.json` chains 28 sequential `npm run test:X` invocations with `&&`. Each pays a fresh npm + Node startup (~300ms each, ~8s pure overhead per full run). No parallelism. `test-reviewloop-command.js` (1297 lines, subprocess-heavy) is a known hang source per `workflow_feedback/full-suite-reviewloop-command-hang.md`.

3. **Unbounded test-case growth (affects every SpecDev project).** TDD's "one behavior, one assertion" is read by agents as a license to add edge-case tests beyond what the plan called for. The suite grows per assignment; future agents pay the wall-clock cost on every full run, forever.

The fix has three layers: **(A)** workflow-skill edits that ship via `templates/.specdev/`; **(B)** local-only `package.json` / test-harness changes for this repo; **(C)** test-case budget enforcement via breakdown plan + reviewer check.

## Goals

- **G1.** Reduce workflow-mandated full-suite runs during a typical implementation phase from ~13 to **1** (end of phase only).
- **G2.** Make `verify-tests.sh` invocations during TDD pass a scoped test command, so RED/GREEN/REFACTOR are fast.
- **G3.** Ship A and C via `templates/.specdev/skills/core/` so every SpecDev user benefits on next `specdev update`.
- **G4.** Cut this repo's `npm test` wall-clock by at least the ~8s of eliminated npm/node startup overhead, plus parallelism gains.
- **G5.** Cap new test files per assignment to the plan's declared budget (default ≤ 1 per task, ≤ 5 per assignment).
- **G6.** Capture before/after `npm test` wall-clock numbers in this repo for the eventual assignment notes.

## Non-Goals

- **N1.** No changes to *what* is tested — same files, same assertions, same coverage. Purely about *how* and *how often*.
- **N2.** No reviewer-side behavior change. Reviewer subprocesses (codex/claude) will keep doing whatever they do; the cached-verdict idea is deferred.
- **N3.** No per-changed-file static analysis or test-impact graph. Scoping is by explicit pattern, not by inferring from a diff.
- **N4.** No dropping the TDD discipline. RED must still fail before GREEN. We are shrinking the *scope* of each verify call, not removing it.
- **N5.** No language-specific changes to `verify-tests.sh` auto-detect beyond plumbing the existing `[test-command]` parameter.
- **N6.** No hard CLI enforcement of the test budget — reviewer-prompt enforcement only. Hard enforcement is a possible follow-up.

## Design

### A. Workflow-skill changes (ships to all SpecDev users via `templates/.specdev/`)

**A1. `test-driven-development/SKILL.md` — scope the RED/GREEN/REFACTOR verify calls.**
- Rewrite the three "Run verify-tests.sh" lines to pass a scoped test command as the second arg. Show language-specific examples in a small table:
  - Node: `node tests/test-foo.js`
  - pytest: `pytest tests/test_foo.py`
  - Cargo: `cargo test --test foo`
- Add one Red Flag: "Running the full suite during RED/GREEN/REFACTOR — pass the specific test file as the second arg to verify-tests.sh."
- Keep "ALL tests must pass" but move the *check* for that into the implementing skill's end-of-phase step, not into every TDD cycle.

**A2. `implementing/SKILL.md` — drop the per-batch full run, keep the final.**
- Remove "Run the full test suite" from the batch-end report (currently line 71). Replace with "Report batch summary: tasks completed, latest scoped test results, any notable decisions."
- Keep the existing final-step "Run full test suite one final time" at the end of the implementation phase.
- Update `templates/.specdev/skills/core/implementing/scripts/complete-task.sh` (line 66) to drop the "run test suite before next batch" hint.

**A3. `systematic-debugging/SKILL.md`** — unchanged. Debugging legitimately needs the full suite to know what else is broken.

**A4. `parallel-worktrees/SKILL.md`** — unchanged. "Merge from N worktrees" is exactly when the full suite is most valuable.

**A5. No change to `verify-tests.sh` itself.** The `[test-command]` parameter already exists and works. This is purely a skill-text fix so agents actually use it.

### B. This repo's test harness (local-only, `package.json` + tests)

**B1. Replace the 28-script chain with `node --test`.**
- New `"test"` script: `node --test --test-concurrency=4 tests/test-*.js`. Bump `engines.node` from `>=18` to `>=20` since `node --test` matured in Node 20.
- Keep individual `test:foo` aliases as thin pass-throughs (`node --test tests/test-knowledge.js`) so targeted runs still work.
- Add `test:serial` = `node --test --test-concurrency=1 tests/test-*.js` for debugging parallel-execution flakes.

**B2. Quarantine `test-reviewloop-command.js`.**
- Move it behind opt-in `test:reviewloop-command`. Default `npm test` excludes it via an explicit file list until the open-handle leak from `workflow_feedback/full-suite-reviewloop-command-hang.md` is fixed (separate follow-up assignment).

**B3. Concurrency-safety audit.**
- Each test file already writes to its own `tests/test-*-output/` dir. Exception: `test-knowledge.js` writes to a shared SQLite cache — wrap its setup in a per-test temp dir (mirror `test-init.js`).
- Spot-check the other top subprocess-spawners (`test-scripts.js`, `test-reviewloop-runner.js`) for shared-state assumptions and fix if any.

**B4. Capture before/after wall-clock.**
- One approved `time npm test` run on `main` as baseline.
- One run after B1–B3 as the after.
- Record both numbers in the eventual assignment's `implementation/notes.md`.

### C. Cap test-case creation per assignment

**C1. Breakdown skill: make tests part of the plan.**
- `templates/.specdev/skills/core/breakdown/SKILL.md`: each task in `plan.md` must list its test cases under a `**Tests:**` line.
- Default budget: **1 new test per task**. Adding more requires a one-line plan justification.
- Before adding a new test file, the breakdown step must grep for existing coverage and prefer extending an existing test file. Record the search in the plan.

**C2. Implementing skill: enforce the plan's test list.**
- Agents may not add tests that aren't in the plan's `**Tests:**` lines. If a needed test surfaces mid-implementation, add a plan addendum (`breakdown/plan-addendum.md` or inline `**Tests-added:**` note) — never silently.
- End-of-phase report includes `new_tests_count` and `modified_tests_count`. Excess without addendum fails the implementation gate.

**C3. Review-agent: count check.**
- Add to `templates/.specdev/skills/core/review-agent/prompts/implementation-reviewer.md`: "Count new `it()` / `test()` blocks and new test files in the diff. Compare against `breakdown/plan.md` `**Tests:**` entries. Flag any test not enumerated as either (a) silent scope creep, or (b) missing plan addendum."
- Counting is by *test cases (it/test blocks)*, not just files, to prevent gaming by stuffing many cases into one file.

**C4. Default budget guidance shipped in the breakdown skill.**
- **feature:** ≤ 1 new test per task, ≤ 5 new tests per assignment.
- **refactor:** **0** new test files by default — modify existing tests.
- **bugfix:** **0** new test files by default — add a regression case to an existing file.
- **familiarization:** **0**.
- Above numbers are *defaults*; the plan can deviate with a one-line justification.

## Where tests run in the new design

| # | Workflow step | Scope | Command (Node example) |
|---|---|---|---|
| 1 | TDD RED | scoped | `verify-tests.sh <root> "node tests/test-foo.js"` |
| 2 | TDD GREEN | scoped | same |
| 3 | TDD REFACTOR | scoped | same |
| 4 | Batch end (every 3 tasks) | **removed** | n/a |
| 5 | End of implementation phase | **full** | `verify-tests.sh <root>` (auto-detects `npm test`) |
| 6 | Reviewloop reviewer subprocess | unchanged (deferred follow-up) | reviewer decides |
| 7 | `specdev checkpoint` / `specdev approve` | no test run | n/a |

9-task assignment: ~13 full-suite runs → **1 full-suite run + ~9 scoped runs**.

## Success Criteria

- **SC1.** Updated `implementing/SKILL.md` and `test-driven-development/SKILL.md` show only the end-of-phase step as "full suite"; all other verify steps pass a scoped command.
- **SC2.** Spot check of the next 2–3 assignments shows scoped `verify-tests.sh` invocations during RED/GREEN/REFACTOR.
- **SC3.** This repo's `time npm test` improves over the recorded baseline by at least the ~8s of eliminated npm/node startup overhead.
- **SC4.** Implementation diffs respect the plan's `**Tests:**` budget (or have a documented addendum); reviewer prompt mentions the count check.
- **SC5.** Full suite still passes after the runner change (minus the quarantined `test-reviewloop-command.js`).
- **SC6.** Skill edits land under `templates/.specdev/skills/core/...` so `specdev update` propagates to downstream users.

## Risks

- **R1. Scoped TDD lets regressions slip across files.** End-of-phase full run still gates; refactor/parallel-worktrees skills still say "full suite"; bisect across ≤ 9 commits is bounded.
- **R2. `node --test` parallelism exposes hidden shared-state bugs.** B3 concurrency audit; quarantine known-hang file; `test:serial` fallback for debugging.
- **R3. Bumping `engines.node` from `>=18` to `>=20`.** Node 18 reaches EOL April 2025; this repo's releaseDate is 2026-05-11. Document in CHANGELOG.
- **R4. Test-budget rule is hard to enforce automatically.** Reviewer prompt does soft enforcement (count vs. plan). Hard CLI check is a possible follow-up.
- **R5. Agents may game the budget by stuffing many `it()` cases into one file.** Reviewer counts test *cases*, not just files.
- **R6. Reviewer subprocesses still re-run `npm test`.** Out of scope. Deferred Approach C: cache last-test verdict keyed by git HEAD.

## Testing Approach

- **Workflow skill edits (A, C):** verified via existing skill drift tests (`test-workflow-contract-drift.js`) plus a new test that asserts the canonical TDD/implementing skill text mentions the scoped second-arg pattern. Asserted by reading the markdown, not by running specdev end-to-end.
- **`package.json` runner change (B1):** existing `npm test` is its own integration test — every test file must still pass under `node --test`.
- **Concurrency audit (B3):** run the new `test:fast` 3–5 times locally; if any flake appears, fix the shared state before declaring done.
- **Test budget (C):** add `tests/test-test-budget.js` covering: breakdown skill text mentions the budget defaults; reviewer prompt mentions the counting rule.
- **Wall-clock capture (B4):** one approved `time npm test` on baseline; one after. Recorded in implementation notes.

## Open Questions

- Should B2's quarantine of `test-reviewloop-command.js` be permanent (until a separate assignment fixes the hang) or part of this same assignment? Default: permanent quarantine; the hang-fix is its own work.
- Should `test:serial` be the default `npm test` (safer) and `test:fast` be opt-in (faster)? Default in this design: `test:fast` is default; `test:serial` is fallback.
