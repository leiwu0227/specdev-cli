---
verdict: approved
material_divergence: true
---

## Findings

**Divergence: material (informational, not a defect).** The current contract differs from the frozen baseline in sequencing, invariants, and acceptance meaning — not merely wording:

- `contract.md:24` moves runtime compaction and focus clearing from *after* the verified terminal commit (baseline line 24) to "the final prepared mutation before staging", and newly requires an ignored transaction journal plus post-publication verification of committed terminal state.
- `contract.md:32` now mandates the prepare→compact→clear-focus→stage sequence, where the baseline only forbade a second user-visible commit.
- `contract.md:40` extends the one-commit invariant to include "all tracked runtime-compaction and focus-clearing effects"; `contract.md:41` adds a new ordering constraint (compact only after plan revalidation and durable recovery-state preparation, before staging).
- AC-2 and AC-3 are rewritten accordingly: AC-2 absorbs compaction/focus effects into the terminal commit path set, and AC-3 shifts from *performing* compaction/focus clearing to *verifying* them across committed state.

**Previous blocking finding is resolved.** The prior verdict's contradiction — post-commit compaction dirtying Assignment-owned paths that are by definition outside the single terminal commit — no longer exists. The contract adopted the first suggested resolution (compact and clear focus before staging), and that ordering matches the working precedent in this repository: `src/commands/assignment-shelf.js:198-218` computes `terminalOwnedPaths`, runs `finalizeShelvedRuntime` (204), then `stageTerminalPaths` (205), `assertTerminalIndexSafe` (206), and `commitDelivery` (210). The new `contract.md:41` sequencing also avoids a self-inflicted fail-closed: plan revalidation precedes compaction, so compaction's own path mutations cannot trip the "authorized owned path set has changed" refusal at `contract.md:39`.

**Premises re-verified against the repository.**

- The ignored transaction journal at `contract.md:24` is achievable without touching tracked ignore files: `.specdev/.gitignore` already ignores `cache/`, matching `templates/.specdev/.gitignore`.
- The "tracked removals and pointer updates" hedge is correct for focus state: `.specdev/.current` (`src/utils/current.js:5`, cleared via `clearCurrent` at `src/utils/current.js:67`, called from `src/utils/artifact-retention.js:160`) is untracked in this repo per `git status`, so it contributes no commit effect — the contract does not over-claim one.
- Idempotent retry (`contract.md:38`, AC-2) is implementable against post-compaction state, mirroring the existing-terminal lookup and empty-staging path at `src/commands/assignment-shelf.js:200-218`.

**Non-blocking, materially useful.** AC-2 requires the commit path set to contain "every authorized Assignment-owned path", but the manifest is displayed and authorized *before* compaction (`contract.md:20`, AC-1), while the commit is produced *after* it. An owned path that is untracked and removed by compaction — e.g. run-dir entries or `.specdev/processes/<attempt>.yaml` from `terminalOwnedPaths` (`src/commands/assignment-shelf.js:561-572`), currently untracked per `git status` — will appear in the authorized manifest yet legitimately have no presence in the commit. The compaction/focus clause at `contract.md:40` is hedged with "tracked"; the "every authorized Assignment-owned path" clause is not. This is resolvable under delegated authority (`contract.md:48`) and the shelf precedent handles it directly (`stageTerminalPaths` stages only paths where `exists || tracked`, using `git add -A`, `src/commands/assignment-shelf.js:574-584`), so it does not block approval — but an AC-2 verification test asserting the literal wording would fail against a correct implementation. The implementer should read AC-2 at manifest-entry granularity ("every authorized entry's tracked effect is captured"), or state that reading explicitly when writing the plan.

No tracked files were modified during this review; `git status` is unchanged from the session baseline, and no tests were run.
