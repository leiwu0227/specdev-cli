---
verdict: approved
material_divergence: true
scope_divergence: material
procedure_divergence: none
evidence_integrity: complete
user_reapproval_required: true
---

## Findings

No blocking findings.

Baseline comparison: the current contract materially expands the frozen baseline. New in-scope item "targeted living-knowledge retrieval reminders in Assignment, Mission, and Adhoc workflows"; new Expected-behavior paragraph specifying retrieval boundaries (Assignment contract/implementation planning, Mission plans once and supplies paths to children, Adhoc searches only on unfamiliar behavior, re-search on unexpected failure); new Important decision on proportional command-driven consumption; new Constraint forbidding retrieval reminders from creating workflow state or letting stale entries guide implementation; and new AC-4. This is added consumption-side scope, not a rewrite — the prior three ACs, the authority split, and all publication/rebuild invariants are unchanged and remain internally consistent with the addition. Reporting `material_divergence: true` for the approval gate; it is not a defect.

Soundness of the added scope (read-only checks, no test commands run):

- The retrieval surfaces AC-4 names are real. `templates/.specdev/_main.md:23` already mandates unconditional `project_notes/big_picture.md` reading, and `_main.md:64-69` already directs `specdev knowledge search` on unfamiliar repository-specific failures with `--include-stale` gated behind verification. AC-4 extends that existing rule to planning boundaries rather than contradicting it, so "preserves unconditional big-picture reading and authority precedence" is anchored, not aspirational.
- Assignment, Mission, and Adhoc guidance all have concrete installed homes (`templates/.specdev/workflows/assignment-lifecycle`, `mission-lifecycle`, `_guides/workflow.md`, `_main.md`, and the packaged skills), so AC-4 has real targets even though `templates/.specdev/adhoc/` is only a `.gitkeep` placeholder.
- The unchanged core remains verified against the repository: `src/commands/knowledge.js:22-25` exposes `rebuild`/`index`, `search`, `list`, `distill`, with `distill` read-only (`:218` advises the operator to classify, update Markdown, then rebuild), matching the contract's curation-owns-semantics / rebuild-stays-mechanical split.
- AC-4 is compound but stays independently observable as guidance content plus retrieval behavior, and the Verification authority section already anticipates "installed-workflow tests", so it is checkable under the existing test-confirmation rule.

Materially useful, non-blocking, for the design phase:

- AC-4 is stated over *installed* guidance, while `CLAUDE.md` forbids editing or committing `.specdev/` workflow files outside an explicit `specdev update`. Implementation must therefore land in `templates/.specdev/` and propagate through the update/migration path (`src/commands/update.js`, `src/commands/migrate.js`), and AC-4 evidence should come from a temp/fixture install rather than mutating this repository's installed `.specdev/`. The same advisory from round 1 about retiring the obsolete `.specdev/workflows/knowledge-distillation/` surface still applies and now covers a wider set of files.
- The new constraint "must not create workflow state" is the right guard for reminders placed in graph nodes; the design should confirm the chosen insertion points are guidance text rather than nodes that would add transitions or artifacts to the Assignment/Mission graphs.
