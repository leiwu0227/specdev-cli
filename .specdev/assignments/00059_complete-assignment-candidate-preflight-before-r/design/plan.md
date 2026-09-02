# Implementation Plan

## Context

- Approved contract: `../brainstorm/contract.md`
- Approved design: `../../../project_notes/roadmap/designs/workflow/lanes/assignment/assignment_candidate_preflight.md`
- Relevant verified history: `../../00046_make-assignment-finalization-evidence-safe-and-o/outcome.md`
- Fresh knowledge search found no narrower living-knowledge owner for this mechanism.

**Implementation Guides:** []
**Review Guides:** []

## Tasks

- T-1 (AC-1): Replace preview-limited verification completeness with a full chronological raw/effective projection that coalesces only matching role, command, and revision obligations while retaining bounded display fields and historical receipt compatibility.
- T-2 (AC-2): Add one shared standalone candidate preflight before the implementation-to-review transition, preserve inline/spawned ownership on failure, and prevent failed preflight from creating or consuming review state.
- T-3 (AC-2, AC-3): Reuse the shared preflight in waiver, review, recovery, and delivery revalidation without changing Mission orchestration.
- T-4 (AC-1, AC-2, AC-3): Extend focused receipt and implementation-recovery fixtures, then record only explicitly user-authorized verification.
