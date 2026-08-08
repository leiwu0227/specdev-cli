# Outcome

## Delivered behavior

Missions now declare and preflight a contract-bound execution policy before approval, including exact verification commands, review profiles, executor classes, capability and service requirements, platforms, secret names, bypasses, and escalation decisions. Approved executor facts are reusable without storing secret values or granting authority.

Verification receipts carry typed dispositions, executor and candidate provenance, and immutable attempt history. Executor-only failures can route one bounded recovery to an already-authorized alternate while retaining and linking the original attempt. Criterion-scoped findings and Mission gaps can be explicitly closed or superseded.

Successful integration records recoverable candidate checkpoints and convergence refuses material Mission-owned changes outside the checkpoint. Evidence-only terminal Missions compact their verified terminal runtime state and produce an immutable-provenance successor Assignment through the new guided handoff command.

## Deviations

None.

## Unresolved risks

Executor capability facts may drift after approval; execution receipts therefore remain the authoritative evidence of the executor and observed result. Existing Missions use a fail-closed compatibility policy and gain no implicit host, service, network, platform, or secret authority.

| Acceptance | Evidence | Result |
| --- | --- | --- |
| AC-1 | Mission contract scaffolding, approval preflight, consolidated policy output, and focused policy tests | Passed |
| AC-2 | Typed dispositions, immutable linked verification receipts, bounded alternate routing, and focused recovery tests | Passed |
| AC-3 | Validated executor catalog with secret-name-only persistence, executor provenance, and routing tests | Passed |
| AC-4 | `tests/test-mission-environment.js` executes Mission convergence with a tracked uncheckpointed product path and asserts refusal, the exact path, and the recovery checkpoint command; Mission gap regressions cover scoped supersession | Passed |
| AC-5 | `tests/test-mission-environment.js` executes `mission handoff --successor-assignment` from an evidence-only terminal Mission and asserts the fresh Assignment, handoff provenance, unresolved-only criteria, supersedable receipt, and unchanged source Mission artifacts | Passed |
