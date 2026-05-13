# Reduced Test Suite

SpecDev CLI intentionally keeps a compact command-level smoke/regression suite instead of one test file per source module. After assignment 00024 the suite shrank further: per-command smoke tests (init, assignment, update, knowledge, workflow-agent, approve-phase, checkpoints) were removed in favor of three contract-level tests that cover the same surfaces structurally.

The retained suite (three files) is:

- `tests/test-workflow-contract-drift.js` — four assertion classes locking the manifest-as-truth contract: (1) manifest contract presence (every checkpoint step has `interaction:`, every gate has `on_satisfied:`, every step has `requires:`/`produces:`, top-level `interactions:` has `discussion_checkpoint`), (2) core SKILL.md prose contains no hard-coded choice labels or post-gate command strings and contains the generic rendering rule (`AskUserQuestion`, `interaction`, `continuation`, `exact labels and order`), (3) generated `specdev-reviewloop` template in `src/commands/init.js` plus `.codex` / `.claude` mirrors carry the generic rule and no banned labels, (4) repo-wide hard-coded artifact-path sweep with `src/commands/migrate-legacy-assignments.js` allowlisted.
- `tests/test-session-state-protocol.js` — three scenarios for the sticky reviewer/autocontinue protocol: autocontinue-write + terminal-approve-clear, skip-review path emits no session-state with `interrupt: true`, cross-assignment stale session-state is ignored on read (not auto-deleted).
- `tests/test-manifest-as-truth.js` — four mutation scenarios that mutate a test `workflow.yaml` and verify the change propagates end-to-end through `specdev next --json`, `specdev status --json`, `specdev approve <phase>`, `specdev review <phase>`, and `specdev check-review` phase inference. Catches any consumer that retained a hard-coded fallback.

Reviewloop runtime behavior is still intentionally *not* tested end-to-end (real reviewer subprocesses exercised by users via the CLI). The previous `tests/test-reviewloop-command.js` was removed during 00023 cleanup.

The 00024 removal rationale: the three contract tests structurally subsume what the per-command tests asserted. Init/update/checkpoint/approve/review correctness is gated by the manifest-as-truth test (mutated manifest must flow through to user-visible output) plus the drift sweep (no hard-coded artifact paths or labels can creep in). Adding back a per-command smoke test now would duplicate the structural gate.

Avoid reintroducing narrow implementation-detail tests unless they protect a shipped user-facing failure mode that is not covered by the three structural tests.

## Source
- Assignment: 00020_refactor_reduce-test-suite (initial reduction)
- Assignment: 00023_familiarization_codebase-consistency-audit (reviewloop test removal)
- Assignment: 00024_refactor_manifest-step-contracts (per-command tests removed; three contract tests retained)
- Last updated: 2026-05-13
