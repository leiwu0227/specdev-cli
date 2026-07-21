# Skill: Verification Before Completion

**Always-apply.** Read at assignment start, follow throughout.

**Core principle:** Evidence before claims, always. Spirit over letter — rephrasing the claim doesn't bypass the rule.

## The Gate

```
BEFORE claiming any status:

1. IDENTIFY: What command proves this claim?
2. AUTHORIZE: Confirm the contract and repository permit the command
3. RUN: Execute the narrowest fresh command that proves the claim
4. READ: Full output, check exit code, count failures
5. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
6. ONLY THEN: Make the claim
```

## Common Failures

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| Tests pass | Test command output: 0 failures | Previous run, "should pass" |
| Build succeeds | Build command: exit 0 | Linter passing, logs look good |
| Bug fixed | Test original symptom: passes | Code changed, assumed fixed |

## Red Flags — STOP

- Using "should", "probably", "seems to" — these are not evidence
- Expressing satisfaction before verification ("Great!", "Done!")
- Treating a full suite as the default when focused evidence answers the claim
- Repeating the same command on the same revision instead of reusing its receipt
- Running a protected command without repository-required user confirmation

## Evidence Format

| Command | Exit Code | Key Output | Notes |
|---------|-----------|------------|-------|
| [exact command] | [0/1/...] | [summary line] | [context] |

## Deliverable

Record the exact command, revision, scope, status, and duration in
`implementation/progress.json`. Keep `outcome.md` concise and map each
acceptance criterion to its evidence and result.
