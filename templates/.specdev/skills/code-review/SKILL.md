---
name: code-review
description: Code quality review with CRITICAL/IMPORTANT/MINOR severity findings
---

# Code Review

## Contract

- **Input:** An implementation that has passed spec-review (requirements confirmed met)
- **Process:** Independent quality review → findings with severity → verdict
- **Output:** Review report with READY or NOT READY verdict
- **Next skill:** verification (if READY), fix issues (if NOT READY)

## Prompts

This skill uses prompt templates for subagent dispatch:

| Prompt | Purpose | When to use |
|--------|---------|-------------|
| `prompts/code-reviewer.md` | Code quality reviewer subagent template | Dispatch to an independent reviewer |
| `prompts/spec-reviewer.md` | Spec compliance reviewer subagent template | Dispatch to verify plan compliance |

## Process

### Phase 1: Prepare Review Packet

Gather everything the reviewer needs:

1. What was implemented (list of changed files)
2. The plan or requirements it was based on
3. The base commit (before changes) and head commit (after changes)
4. A brief description of what the changes accomplish

### Phase 2: Dispatch Reviewer

1. Use the prompt template from `prompts/code-reviewer.md`
2. Fill in the placeholders: {WHAT_WAS_IMPLEMENTED}, {PLAN_OR_REQUIREMENTS}, {BASE_SHA}, {HEAD_SHA}, {DESCRIPTION}
3. The reviewer should be a fresh subagent with no prior context
4. Let the reviewer work independently — do not influence the review

### Phase 3: Evaluate Findings

The reviewer will report findings in three categories:

- **CRITICAL** — Must be fixed before merging. Security issues, data loss risks, broken functionality.
- **IMPORTANT** — Should be fixed. Poor patterns, missing error handling, unclear code.
- **MINOR** — Nice to fix. Style issues, naming, minor improvements.

### Phase 4: Respond

For each finding:

1. Read the finding carefully
2. Respond with evidence, not agreement:
   - If the finding is valid: "Agreed — this needs fixing because [reason]"
   - If the finding is not applicable: "This doesn't apply because [evidence]"
   - If the finding is debatable: "Here's the trade-off: [explanation]"
3. Do NOT performatively agree with findings you disagree with
4. Every response must cite specific code or evidence

### Phase 5: Verdict

**READY** — No CRITICAL findings remain. All IMPORTANT findings addressed or justified.

**NOT READY** — CRITICAL findings exist, or IMPORTANT findings not addressed.

## Red Flags

- Skipping spec-review before code-review — quality review of wrong code is waste
- Performative agreement — "good point, I'll fix that" without actually evaluating
- Ignoring CRITICAL findings — every CRITICAL must be resolved
- Self-reviewing — the implementer should not be the reviewer
- Reviewing without running the code — always verify the code works

## Integration

- **Before this skill:** spec-review (confirms requirements met first)
- **After this skill:** verification (final gate checks)
- **Critical rule:** Spec review BEFORE code review — always
