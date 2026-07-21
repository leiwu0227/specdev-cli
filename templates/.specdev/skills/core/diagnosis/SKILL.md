---
name: diagnosis
description: Reproduce a defect and establish root cause before approving a fix contract
type: core
phase: brainstorm
---

# Diagnosis

Use focused evidence to reproduce expected versus actual behavior, locate the
first causal divergence, test competing hypotheses, and state the root cause in
one clear sentence. Do not propose a fix before evidence supports the cause.

Record reproduction, root cause, evidence, proposed fix, regression protection,
and blast radius in the active Assignment's single `brainstorm/contract.md`.
Keep test execution inside repository confirmation rules. Diagnosis does not
create a separate proposal/design pair or advance the workflow itself.
