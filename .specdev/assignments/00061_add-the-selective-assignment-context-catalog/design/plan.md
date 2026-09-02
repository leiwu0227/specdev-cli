# Implementation plan

## Context

- Approved contract: `.specdev/assignments/00061_add-the-selective-assignment-context-catalog/brainstorm/contract.md`
- Relevant design: `.specdev/project_notes/roadmap/designs/workflow/lanes/assignment/assignment_selective_context_catalog.md`
- Relevant role boundary: `.specdev/project_notes/roadmap/designs/foundations/coding_agent_role.md`
- Fresh knowledge consulted: `.specdev/assignments/00046_make-assignment-finalization-evidence-safe-and-o/outcome.md`, `.specdev/assignments/00027_replace-mission-replan-budgets-with-unattended-g/outcome.md`, `.specdev/assignments/00047_make-mission-execution-environment-aware-and-rec/outcome.md`

## Tasks

### T-1 — Build the normalized selector (AC-1)

Add a provider-neutral utility that emits ordered authority, task, supporting, and permitted role-history entries; validates required repository-relative durable paths; bounds objective-based guide, knowledge, and Roadmap selection; and constrains Mission children to the parent supporting envelope.

### T-2 — Integrate foreground and spawned handoffs (AC-2)

Expose equivalent catalogs in inline action-required JSON/human output and spawned prompts, regenerate selections at every handoff, and record selected entry identities in spawned Attempt records. Apply positive role/phase projections to implementation owners, repairs, primary reviewers, resolvers, arbiters, and Mission child contract authors/reviewers.

### T-3 — Preserve Mission and compatibility boundaries (AC-3)

Record the parent-selected Mission supporting envelope in compatible queue state, preserve it through replanning, apply child-relevant intersection selection, and update minimal generated workflow guidance without editing installed runtime guidance.

### T-4 — Add focused regressions and delivery evidence (AC-1, AC-2, AC-3)

Add focused coverage for ordering/fail-closed behavior, reviewer lineage, Attempt observability, inline parity, Mission child subsets, guide/knowledge compatibility, candidate review, and recovery. Run only tests explicitly approved by the user, then record receipts in `implementation/progress.json` and final results in `outcome.md`.

**Implementation Guides:** []

**Review Guides:** []
