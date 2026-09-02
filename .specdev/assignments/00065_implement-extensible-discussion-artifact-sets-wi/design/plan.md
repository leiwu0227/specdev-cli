# Implementation plan

**Implementation Guides:** []

**Review Guides:** []

## Context

- `.specdev/project_notes/roadmap/designs/workflow/lanes/discussion_lane.md`
- `.specdev/knowledge/architecture/reduced-test-suite.md`

## Tasks

1. **T-1 — Build the shared recursive Discussion artifact model (AC-1, AC-2).** Add safe deterministic traversal, canonical validation, per-file fingerprints, an aggregate identity compatible with canonical-only Discussions, and durable completion manifests.
2. **T-2 — Consume one manifest across the lifecycle (AC-2).** Feed the complete artifact catalog to review, revalidate it for knowledge discovery and Assignment/Mission promotion, and retain provenance in destination state.
3. **T-3 — Align public guidance and regression protection (AC-1, AC-3).** Update the versioned Discussion workflow, template and embedded skills, user-facing CLI output, and focused command-level fixtures for nested artifacts, unsafe entries, immutability, promotion, and legacy behavior.

## Verification

No test command may run until the user explicitly approves it. After approval, run the narrow Discussion integration and reviewloop tests first; expand only if their evidence exposes a broader risk.
