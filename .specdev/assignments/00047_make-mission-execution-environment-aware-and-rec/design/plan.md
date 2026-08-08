# Implementation plan

**Implementation Guides:** [api-security]
**Review Guides:** []

## Tasks

### T-1 — Define and preflight the contract-bound execution policy

Acceptance: AC-1, AC-3

- Add reusable executor-capability and execution-policy utilities with strict normalization, secret-name-only persistence, explicit authorization, exact-command executable resolution, and deterministic local capability observations.
- Extend new Mission contracts with a consolidated execution-policy declaration and make approval/status output surface the derived policy plus actionable missing-capability decisions.
- Bind the approved policy to the contract hash and preserve a compatibility policy for existing Mission artifacts without inferring host, service, network, or platform authority.

### T-2 — Add typed convergence, bounded evidence recovery, scoped findings, and checkpoint guards

Acceptance: AC-2, AC-3, AC-4

- Record typed convergence dispositions and executor provenance on verification receipts.
- Route at most one executor-only recovery to an already-authorized capable executor while preserving and linking both receipts and pinning the exact command and candidate revision.
- Scope Mission findings to acceptance criteria and finding types, supporting explicit closure and supersession provenance.
- Create candidate checkpoints at successful integration boundaries and refuse convergence over material Mission-owned changes outside the recorded checkpoint with a concrete recovery command.

### T-3 — Provide evidence-only terminal handoff and consolidated operator output

Acceptance: AC-1, AC-5

- Add `specdev mission handoff <id> --successor-assignment` for eligible evidence-only terminal Missions.
- Draft a fresh Assignment contract and handoff artifact carrying only unresolved criteria, relevant receipt provenance, supersedable evidence, candidate revision, dirty paths, and the new approval boundary without mutating the terminal Mission.
- Update Mission help, status, and documentation to present the consolidated execution and recovery policy.

### T-4 — Add focused regression coverage and delivery evidence

Acceptance: AC-1, AC-2, AC-3, AC-4, AC-5

- Add focused tests for policy preflight, executor authorization and secret redaction, exact-command recovery bounds, receipt supersession, scoped finding closure, convergence checkpoint refusal, and immutable successor handoff.
- Run only the user-authorized focused verification commands, record working-tree receipts, and summarize acceptance evidence and residual risks in the Assignment artifacts.
