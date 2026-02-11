# Refactor Assignment Workflow

## Purpose
Restructure code while preserving observable behavior.

## Step 1: Proposal

- Deliverable: `proposal.md`
- Include baseline behavior/metrics and risk notes

## Step 2: Plan

- Deliverable: `plan.md`
- Include current vs target architecture and rollback strategy
- Run complexity/risk gate and choose required skills

## Step 3: Architecture Prep (conditional)

- LOW: none
- MEDIUM: `skills/scaffolding-lite.md` + Gate 1 user approval (contracts)
- HIGH: `skills/scaffolding-full.md` + Gate 1 user approval (full architecture)

## Step 4: Implementation

- Existing tests are baseline; run before/after each step
- Apply TDD slices for behavior parity checks
- Optional parallel execution only if `skills/parallel-worktrees.md` criteria pass

## Step 5: Validation

- Stage 1: behavior/spec compliance
- Stage 2: quality and architecture checks
- Completion requires verification evidence

## Step 6: Finalize

- Update architecture notes and assignment status

## Step 7: Knowledge Capture

- Update `knowledge/architecture/` with new structure and design decisions
- Note workflow observations in `knowledge/_workflow_feedback/` if applicable

## Checkpoints

- behavior parity preserved
- complexity gate documented
- required skill artifacts present
- rollback strategy remains viable during implementation
