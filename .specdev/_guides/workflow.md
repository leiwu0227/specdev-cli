# Workflow Guide

Every assignment follows these 4 phases in order. Do not skip phases.

---

## Phase 1: Brainstorm

**Goal:** Understand the problem and produce a validated design or research output.

**Start:** Run `specdev assignment "<description>"` to reserve an ID.
Create the assignment folder: `assignments/NNNNN_<type>_<slug>/`
Where type is: feature | bugfix | refactor | familiarization
And slug is a short hyphenated name derived from the description.
Create `brainstorm/` and `context/` subdirectories inside it.

**Choose the skill that matches your work:**
- Building or changing functionality → `skills/core/brainstorming/SKILL.md`
- Understanding existing code → `skills/core/investigation/SKILL.md`
- Diagnosing a bug → `skills/core/diagnosis/SKILL.md`

**Checkpoint:** Run `specdev checkpoint brainstorm`.
Must pass before requesting review.

**Review (optional):**
- `specdev review brainstorm` — manual review in a separate session
- `specdev reviewloop brainstorm` — automated review via external CLI (e.g., Codex)

**Gate:** `specdev approve brainstorm` must have been run. If you used `specdev reviewloop` and it printed "Phase 'brainstorm' has been approved", the gate is already satisfied — proceed immediately to breakdown. Otherwise, ask the user to run `specdev approve brainstorm`.
Breakdown runs automatically after approval — no separate command needed.

---

## Phase 2: Breakdown

**Goal:** Decompose the approved design into executable tasks.

**Skill:** `skills/core/breakdown/SKILL.md`

**Internal reviews:** Design review (up to 2 rounds) then plan review (1-2 rounds). Both run automatically inside breakdown.

**Output:** `breakdown/plan.md`

---

## Phase 3: Implement

**Goal:** Execute tasks in batches of 3, one subagent per task, TDD, mode-based review.

**Skill:** `skills/core/implementing/SKILL.md`

**Checkpoint:** Run `specdev checkpoint implementation`.
Must pass before requesting review.

**Review (optional):**
- `specdev review implementation` — manual review in a separate session
- `specdev reviewloop implementation` — automated review via external CLI (e.g., Codex)

**Gate:** `specdev approve implementation` must have been run. If you used `specdev reviewloop` and it printed "Phase 'implementation' has been approved", the gate is already satisfied — proceed immediately to summary. Otherwise, ask the user to run `specdev approve implementation`.

---

## Phase 4: Summary

**Goal:** Capture learnings and update project documentation.

**Skill:** `skills/core/knowledge-capture/SKILL.md`

**Output:** `capture/project-notes-diff.md` + `capture/workflow-diff.md`, assignment marked done.

---

## Always-Apply Skills

Read these before starting any assignment:
- `skills/core/verification-before-completion.md` — no completion claims without evidence
- `skills/core/receiving-code-review.md` — no performative agreement in reviews
- `_guides/codestyle_guide.md` — coding standards
