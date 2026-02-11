# Validation & Quality Gates Guide

**Reference Example**: See `_templates/assignment_examples/feature/00000_feature_email-validator/validation_checklist.md`

**Template**: Copy `_templates/gate_checklist.md` into your assignment folder as `validation_checklist.md`.

---

## Gate 1: Post-Scaffolding Review

**When**: After scaffolding documents created, before implementation.

**Checklist**:
- [ ] All functions/classes have clear purpose descriptions
- [ ] Input/output types are specified
- [ ] Edge cases identified in pseudocode
- [ ] Dependencies between files documented
- [ ] No circular dependencies in design

**Action**: User MUST approve scaffolding before proceeding.

---

## Gate 2: Per-Task TDD Validation

**When**: After each task's Red-Green-Refactor cycle completes.

**Checklist**:
- [ ] Failing test was written BEFORE production code
- [ ] Test fails for the correct reason (not setup/import errors)
- [ ] Production code is the minimum to pass the test
- [ ] ALL tests pass (new + existing)
- [ ] Code follows codestyle_guide.md
- [ ] Function signatures match scaffolding
- [ ] No syntax errors

**Action**: Move to next task ONLY if all items pass.

---

## Gates 3–4: Two-Stage Review

After all implementation tasks complete, run two independent review stages IN ORDER. Never start Stage 2 before Stage 1 passes.

### Stage 1: Spec Compliance Review

**Purpose**: Verify the implementation matches what was planned.

```
GATE: Dispatch spec reviewer subagent
  1. Provide reviewer with:
     - proposal.md content (full text)
     - plan.md content (full text)
     - List of files created/modified with paths
  2. Reviewer MUST read actual source code files — never trust implementer claims
  3. Reviewer checks EACH planned behavior against actual code
  4. Output format: PASS or FAIL
     - If FAIL: list each deviation as [file:line] — expected X, found Y
  IF FAIL → implementer fixes deviations → re-run Stage 1 from scratch
  IF PASS → proceed to Stage 2
```

**Spec reviewer stance**: Skeptical. Assume the implementation drifted from spec until proven otherwise. Do not accept "it's equivalent" — verify exact compliance.

**Spec reviewer checks**:
- [ ] Every feature in proposal.md has corresponding implementation
- [ ] Function signatures match scaffolding exactly
- [ ] Edge cases from plan.md are handled
- [ ] No unplanned features added (scope creep)
- [ ] File structure matches plan.md

### Stage 2: Code Quality Review

**Purpose**: Verify code is production-ready.

```
GATE: Dispatch code quality reviewer subagent
  1. Provide reviewer with:
     - All source files (full text)
     - All test files (full text)
     - codestyle_guide.md (full text)
  2. Reviewer evaluates across categories below
  3. Each issue tagged: CRITICAL / IMPORTANT / MINOR
  4. Verdict: READY TO MERGE or NOT READY
     - CRITICAL issues → NOT READY (must fix)
     - IMPORTANT issues → NOT READY (should fix, main agent may override with justification)
     - MINOR only → READY TO MERGE (fix at discretion)
```

**Review categories**:

| Category | What to check |
|----------|---------------|
| Code Quality | Naming, readability, duplication, complexity |
| Architecture | Separation of concerns, dependency direction, coupling |
| Testing | Coverage, edge cases, test isolation, assertion quality |
| Requirements | Completeness vs proposal, no gold-plating |
| Security | Input validation at boundaries, no injection vectors |

---

## Receiving Reviews — Anti-Sycophancy Protocol

When the implementer receives review feedback:

```
GATE: Review response protocol
  FORBIDDEN responses (any of these = protocol violation):
    - "You're absolutely right!"
    - "Great point!"
    - "Thanks for catching that!"
    - Any expression of gratitude or flattery toward reviewer
    - Agreeing without verification

  REQUIRED pattern:
    1. READ the feedback completely
    2. UNDERSTAND what specific change is requested
    3. VERIFY by reading the actual code at [file:line]
    4. EVALUATE: Is the feedback correct?
       - If YES → implement the fix, cite what changed
       - If NO → explain specifically why with code evidence
    5. RESPOND with: "Fixed [file:line]: [what changed]" or "Disagree: [evidence]"
    6. IMPLEMENT all accepted fixes
```

**Why no gratitude**: Sycophantic responses signal the agent is performing compliance rather than evaluating feedback. Genuine engagement means verifying claims against code, not thanking the reviewer.

---

## Rollback

```
GATE: When to rollback
  IF critical bugs at Gates 3–4
  OR implementation doesn't match approved plan
  OR assignment breaks existing functionality
  OR user requests abandonment
  THEN:
    1. Document reason in #####_type_name/rollback_notes.md
    2. Revert code commits related to assignment
    3. Mark "Rolled Back" in assignment_progress.md
    4. Decide: fix and retry, or abandon

  PARTIAL ROLLBACK (some tasks problematic):
    1. Keep working code
    2. Revert problematic tasks
    3. Update implementation.md with revised tasks
    4. Resume from Gate 2 for revised tasks
```

---

## Validation Flow

```
Scaffolding → Gate 1 ✓ →
  Implementation (per-task TDD + Gate 2) ✓ →
    Stage 1: Spec review ✓ →
      Stage 2: Code quality review ✓ →
        Documentation ✓ → DONE
```

If any gate fails: fix → re-validate at that gate → do not proceed until it passes.
