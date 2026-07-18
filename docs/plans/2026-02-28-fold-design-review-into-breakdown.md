# Fold Design Review into Breakdown — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove "auto review" as a user-facing concept by folding the design review into breakdown as an internal step.

**Architecture:** Three markdown template files are edited. No CLI code changes. The design review becomes Phase 1 of breakdown, running silently before task decomposition.

**Tech Stack:** Markdown templates only

---

### Task 1: Update brainstorming SKILL.md — remove auto review language

**Mode:** lightweight

**Files:**
- Modify: `templates/.specdev/skills/core/brainstorming/SKILL.md:56-86`

**Step 1: Edit Phase 4 and After stopping block**

Replace lines 68-74 (the "After stopping" block) with:

```markdown
4. Announce: "Brainstorm complete. Design written to assignment folder."
5. Tell the user: "Run `specdev approve brainstorm` when you're ready to proceed."
6. Stop and wait — do NOT proceed to breakdown until the user has approved

**After stopping**, the user may:
- Review the design themselves and provide feedback
- Run `specdev review brainstorm` in a separate session for an independent review
- Run `specdev approve brainstorm` to proceed to breakdown
```

Key changes:
- Line 68-69: explicit instruction to tell user the approve command
- Line 70: explicit "do NOT proceed" instruction
- Line 74: removed "a subagent review (1 round) checks the design, then breakdown begins automatically" — that review now lives in breakdown

**Step 2: Update Integration section**

Replace line 85:
```markdown
- **After this skill:** breakdown (auto-chains after `specdev approve brainstorm`)
```
With:
```markdown
- **After this skill:** breakdown (starts after user runs `specdev approve brainstorm`)
```

**Step 3: Verify the file reads correctly**

Read the modified file and confirm:
- No mention of "auto review" anywhere
- Phase 4 clearly says to stop and wait for user
- The approve command is explicitly named

**Step 4: Commit**

```bash
git add templates/.specdev/skills/core/brainstorming/SKILL.md
git commit -m "docs: remove auto review language from brainstorming skill"
```

---

### Task 2: Update breakdown SKILL.md — add Design Review phase

**Mode:** lightweight

**Files:**
- Modify: `templates/.specdev/skills/core/breakdown/SKILL.md:14-98`

**Step 1: Update the Contract section**

Replace line 16:
```markdown
- **Process:** Read design → decompose into tasks → detail each task with TDD steps, exact code, exact commands
```
With:
```markdown
- **Process:** Review design (subagent, up to 2 rounds) → decompose into tasks → detail each task with TDD steps, exact code, exact commands
```

**Step 2: Add new Phase 1: Design Review**

Insert a new phase before the current "Phase 1: Read Design and Decompose". The current phases shift: Phase 1 → Phase 2, Phase 2 → Phase 3, Phase 3 → Phase 4, Phase 4 → Phase 5.

Insert after line 20 (`## Process`), before the current Phase 1:

```markdown
### Phase 1: Design Review

Before decomposing, verify the design is complete enough to plan against. Dispatch a subagent to review `brainstorm/design.md`:

**Review criteria:**
- Are the goal, architecture, and success criteria clear and specific?
- Are there obvious gaps (missing error handling, unclear data flow, unaddressed edge cases)?
- Is the scope well-bounded (no vague "and more" items)?
- Are decisions documented with reasoning?

**Does NOT check:** code-level details or whether the design is the "best" approach (user already approved the direction).

**If issues found:**
1. Fix `brainstorm/design.md` directly — add missing sections, clarify vague language, tighten scope
2. Re-review (max 2 rounds total)
3. If still failing after 2 rounds: surface findings to user and pause

This is a lightweight sanity check — the design was already validated section-by-section with the user during brainstorm.
```

**Step 3: Renumber existing phases**

- "Phase 1: Read Design and Decompose" → "Phase 2: Read Design and Decompose"
- "Phase 2: Detail Each Task" → "Phase 3: Detail Each Task"
- "Phase 3: Write Plan" → "Phase 4: Write Plan"
- "Phase 4: Start Implementation" → "Phase 5: Start Implementation"

**Step 4: Update Integration section**

Replace line 119:
```markdown
- **Review:** Inline subagent review (1-2 rounds) checks the plan. Do NOT use `specdev review` here — proceed directly to implementing
```
With:
```markdown
- **Review:** Design review (subagent, up to 2 rounds) runs first, then plan review (subagent, 1-2 rounds). Do NOT use `specdev review` here — proceed directly to implementing
```

**Step 5: Verify the file reads correctly**

Read the modified file and confirm:
- Phase 1 is "Design Review"
- Phases 2-5 are the original phases renumbered
- Contract mentions design review
- Integration section mentions both reviews

**Step 6: Commit**

```bash
git add templates/.specdev/skills/core/breakdown/SKILL.md
git commit -m "docs: add design review phase to breakdown skill"
```

---

### Task 3: Update workflow guide

**Mode:** lightweight

**Files:**
- Modify: `templates/.specdev/_guides/workflow.md:31-39`

**Step 1: Update Phase 2 description**

Replace lines 36-37:
```markdown
**Auto-review:** Subagent reviews the plan (1-2 rounds). Address findings.
```
With:
```markdown
**Internal reviews:** Design review (up to 2 rounds) then plan review (1-2 rounds). Both run automatically inside breakdown.
```

**Step 2: Verify the file reads correctly**

Read the modified file and confirm:
- No "Auto-review" label
- Both reviews mentioned
- Clear that they're internal to breakdown

**Step 3: Commit**

```bash
git add templates/.specdev/_guides/workflow.md
git commit -m "docs: update workflow guide breakdown description"
```

---

### Task 4: Run full test suite

**Mode:** lightweight

**Step 1: Run tests**

Run: `npm test`
Expected: All test suites pass (these are template-only changes, but verify nothing broke)

**Step 2: Manual verification**

Grep across all templates for any remaining "auto review" or "auto-review" references:
```bash
grep -ri "auto.review" templates/
```
Expected: No matches
