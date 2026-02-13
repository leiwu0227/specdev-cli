# Feature Assignment Workflow

## Purpose
Deliver a net-new feature with complexity-scaled rigor.

## Step 1: Proposal

- Deliverable: `proposal.md`
- Owner: user

## Step 2: Plan

- Deliverable: `plan.md`
- Owner: agent writes, user approves
- Guide: `.specdev/_guides/task/planning_guide.md`
- Must include complexity/risk class and required skills

## Step 3: Architecture Prep (conditional)

- Guide: `.specdev/_guides/task/scaffolding_guide.md`
- LOW: no scaffold
- MEDIUM: invoke `skills/core/scaffolding-lite.md` and pass Gate 1 user approval (contracts)
- HIGH: invoke `skills/core/scaffolding-full.md` and pass Gate 1 user approval (full architecture)

## Step 4: Implementation

- Deliverable: source code + tests
- Guide: `.specdev/_guides/task/implementing_guide.md`
- Use TDD per task
- Use `skills/core/parallel-worktrees.md` only for parallel-safe tasks

## Step 5: Validation

- Guide: `.specdev/_guides/task/validation_guide.md`
- Stage 1: spec compliance review
- Stage 2: code quality review
- Completion claims require verification evidence

## Step 6: Finalize

- Guide: `.specdev/_guides/task/documentation_guide.md`
- Update docs, scaffolding metadata, assignment status

## Step 7: Knowledge Capture

- Distill learnings into `knowledge/` branches (codestyle, architecture, domain, workflow)
- Note workflow observations in `knowledge/_workflow_feedback/` if applicable
- Keep entries concise and actionable

## Checkpoints

- proposal exists before planning
- complexity gate documented in plan
- required skills invoked and logged
- conditional Gate 1 passed (medium and high complexity)
- Gate 2 passed per task
- Gates 3-4 passed before finalize
