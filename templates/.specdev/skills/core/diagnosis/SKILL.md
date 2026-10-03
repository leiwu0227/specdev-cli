---
name: diagnosis
description: Reproduce a defect and establish root cause before approving a fix contract
type: core
phase: brainstorm
---

# Diagnosis

Reproduce the defect with focused evidence. Compare expected and actual behavior.
Find the first point where they differ and check the possible causes.
State the root cause in one clear sentence. Do not propose a fix until evidence
supports that cause.

Record reproduction, root cause, evidence, proposed fix, regression protection,
and affected scope in the active Assignment's single `brainstorm/contract.md`.
Keep test execution inside repository confirmation rules. Diagnosis does not
create a separate proposal/design pair or advance the workflow itself.
