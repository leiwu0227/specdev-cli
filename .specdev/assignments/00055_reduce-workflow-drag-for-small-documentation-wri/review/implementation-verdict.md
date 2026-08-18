---
verdict: approved
material_divergence: false
scope_divergence: none
procedure_divergence: disclosed
evidence_integrity: complete
user_reapproval_required: false
---

## Findings

Evidence integrity: the four artifact digests in `review/candidate-receipt.json` (contract `7267ade9…`, plan `8ee3c5b1…`, progress `42d92dad…`, outcome `a359cd29…`) recompute exactly against the on-disk files. All changed product/host files have mtimes (22:17–22:19) preceding the receipt (22:23:03), and HEAD is `4b6e426`, matching the recorded `working-tree@4b6e426…` revision on both receipts. The receipt's 32 changed project paths reconcile exactly with `git status` (`.claude` 12, `.codex` 11, root 2 = `README.md` + `package.json`, `hooks` 1, `src` 2, `templates` 3, `tests` 1), including the two untracked `specdev-knowledge-curation` host copies. I reused both existing receipts and ran no test; the only command re-executed was the zero-cost `git diff --check`, which still passes.

Acceptance coverage: every criterion has a final result (3 passed, 0 omitted) with `node tests/test-init-platform.js` as the single authoritative acceptance receipt.
- AC-1 — `templates/.specdev/_main.md`, `src/commands/init.js` `adapterContent`, `templates/.specdev/_guides/workflow.md`, and `README.md` classify small non-behavioral user-requested documentation as Direct with "no graph, receipt, or automatic commit", carry the `project_notes/manual/` current-repository example and the cross-repository handoff example, and state the narrow "write first, verify narrowly" orientation rule with an explicit anti-loophole ("A Markdown extension alone does not make an artifact Direct").
- AC-2 — the Adhoc skill front matter now reads `description: Run a user-explicitly-selected Adhoc change without a RippleGraph workflow`, `src/utils/commands.js` help says "user-selected", and the "Use SpecDev Adhoc to update the public API manual and commit it" example is routed to Adhoc. No Adhoc receipt, manifest, or delivery-commit logic changed — only descriptive prose — so the governed semantics are intact.
- AC-3 — no occurrence of "Announce every subtask" remains anywhere in `src/`, `templates/`, `hooks/`, `.claude/`, or `.codex/`; all 11 tracked skills carry the meaningful-phase wording. I independently verified `hooks/session-start.sh` is byte-identical to `.claude/hooks/specdev-session-start.sh`, every `.claude` skill copy is identical to its `.codex` counterpart, and the new `specdev-knowledge-curation` host copy matches the generator's `SKILL_FILES` literal verbatim. The new test block reads every installed `specdev-*` skill and asserts tracked-copy byte equality, so drift in these generated surfaces is now detected rather than assumed.

Scope: `none`. Adding the previously-untracked `.claude`/`.codex` `specdev-knowledge-curation` copies is required by the contract's own decision to synchronize tracked host skill copies as generated outputs once their canonical wording changed, and is disclosed in the receipt's path groups. `package.json` changes only `releaseDate` (2026-08-13 → 2026-08-18), per repository instructions; no dependency was added or upgraded, so no registry/lockfile/advisory evidence is required. Tracked `.specdev/` churn (state files, pruned Attempt/RippleGraph artifacts) matches the pattern of the prior delivery commit `4b6e426` and is runtime state, not authored workflow edits — the non-goal against rewriting installed `.specdev/` workflow files is respected (`.specdev/_main.md` is untouched).

Procedure: `disclosed`. `implementation/progress.json` and `outcome.md` both record that the automatic worker sandbox could not write tracked `.codex` outputs or observe the foreground test authorization, and that the foreground recovered those steps. The recovery preserved the approved behavior and scope, the focused test ran only under the explicit authorization the contract reserves to the user, and the resulting evidence set is complete — so this divergence is informational and does not require re-approval.

Non-blocking observation (no action required for delivery): this repository's own root `CLAUDE.md` still instructs "Before starting any subtask, announce …", which reads inconsistently with the new meaningful-phase policy now shipped in the product surfaces. It is a hand-customized repository instruction rather than a generated artifact, and AC-3 scopes consistency to product-generated guidance and tracked host copies, so it is outside this contract.

No blocking contract defect remains.
