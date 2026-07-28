---
verdict: approved
material_divergence: false
---

## Findings

No blocking findings. The candidate implements every acceptance criterion, and each has a final recorded result.

**Coverage check**

- AC-1 — `src/commands/assignment-shelf.js` validates lifecycle/mission/terminal eligibility, requires `--reason`, rejects shelving while a non-stale Attempt record is live (`attemptLiveness`), records `clean-head` at `HEAD` or refuses until `--snapshot-paths` exactly matches every dirty path (`assertExactPaths`, re-checked immediately before and after `git add`), commits as `specdev(assignment): shelf <id>`, writes durable `shelf.md` + `status.json.shelf`, and re-entry on an already-shelved Assignment replays only terminal cleanup (`finalizeShelvedRuntime` tolerates a removed run dir and an already-`abandoned` checkpoint). Covered by the live-Attempt rejection, clean/dirty boundary, snapshot-commit, and idempotency cases in `tests/test-assignment-shelf.js`.
- AC-2 — `--from-assignment` in `src/commands/assignment.js` is mutually exclusive with the other promotion sources, rejects non-shelved/Mission/incomplete-shelf sources, and otherwise runs the ordinary creation path: fresh reserved ID, fresh contract, `predecessor_assignment` lineage only. Handoff text is bounded (`shelfSummary` caps each section at 360 chars) and labelled "historical, not current authority"; no prior approval, review, verification, or graph state is copied.
- AC-3 — `assignmentLifecycle`/`assignmentLifecycleNextAction` give `focus`, `continue`, and `status --json` (`artifact_focus`) a shared four-state vocabulary plus `unknown` for pre-migration artifacts; shelved output points at the exact successor command; the generated `specdev-continue` skill in `src/commands/init.js` instructs agents to translate "resume" into successor creation; `dispatchCommand` routes `--help`/`-h` before any command handler, and `cancelCommand` blocks with `requires_reason` when no reason is given.

No dependency clause applies: the `package.json` diff touches only `scripts` (new `test:assignment-shelf`, wired into `test` and `lint`); no dependency was added or upgraded. `releaseDate` is already `2026-07-28`, satisfying the repository rule.

Receipts in `implementation/progress.json` (`node --check` across changed modules, `prettier --check`, `git diff --check`, `npm run test:assignment-shelf`) are all recorded `passed` at `working-tree@c6fd8aa`, which matches current `HEAD`. I reused them and ran no test command.

**Non-blocking observations**

1. `outcome.md` lists "promotion-compatibility" as passing evidence for AC-3, but `tests/test-assignment-shelf.js` contains no `--from-discussion` or `--from-test-audit` case and the existing suites were not rerun. The invariant does hold by inspection — the exclusivity check is semantically equivalent for the two-source case, and `assignmentContractTemplate` appends an empty string when `sourceAssignment` is null — so the claim is accurate in substance but overstated as executed evidence.
2. `specdev cancel` now also writes `status: 'abandoned'` to the focused Assignment's `status.json`. This is needed for AC-3's abandoned state and stays inside the contract's cancellation-routing scope, but it is a durable mutation slightly beyond "help/validation" wording; it keys off `readCurrentFocus`, so a focused Assignment plus a non-Assignment active run would mislabel the Assignment. Missions are a stated non-goal and mission children do not take foreground focus, so the path is not reachable in supported flows.
3. `continue` for a still-`active` Assignment with no live graph state now emits `specdev next --json` instead of `specdev do "<intent>"`. `next` reports blocked in that case, so recovery guidance is one step less direct than before; contract-permitted, but worth a follow-up if crash recovery is exercised often.
4. New status fields (`shelf`, `shelved_at`, `predecessor_assignment`, `abandoned_at`, `abandon_reason`) are not reflected in `docs/assignment-schema.md`. No acceptance criterion requires it.
