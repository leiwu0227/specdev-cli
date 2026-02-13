# Bugfix Assignment Workflow

## Purpose
Diagnose and fix defects with root-cause discipline.

## Step 1: Proposal

- Deliverable: `proposal.md`
- Include reproduction steps, expected vs actual, impact

## Step 2: Plan (optional)

Use for complex/high-risk bugs. For simple obvious fixes, keep a short plan section in `implementation.md`.

If root cause is unclear, invoke `skills/core/systematic-debugging.md`.

## Step 3: Architecture Prep (conditional)

Use complexity/risk gate from planning:

- LOW: none
- MEDIUM: `skills/core/scaffolding-lite.md` + Gate 1 approval (contracts)
- HIGH: `skills/core/scaffolding-full.md` + Gate 1 approval (full architecture)

## Step 4: Implementation

- T001 must be failing regression test (or explicit reproducible failing check)
- Fix root cause, not only symptom
- Use TDD for each behavior slice

## Step 5: Validation

- Stage 1: confirm bug scenario now passes and intended behavior remains
- Stage 2: quality/regression review
- Invoke `skills/core/verification-before-completion.md` before claiming fixed

## Step 6: Finalize

- Document root cause and fix
- Record regression coverage
- Update assignment status

## Step 7: Knowledge Capture

- Distill root cause and fix pattern into `knowledge/` (architecture or domain branch)
- Note workflow observations in `knowledge/_workflow_feedback/` if applicable

## Checkpoints

- reproducible failure captured
- root cause evidence documented
- regression test added
- no completion claim without command evidence
