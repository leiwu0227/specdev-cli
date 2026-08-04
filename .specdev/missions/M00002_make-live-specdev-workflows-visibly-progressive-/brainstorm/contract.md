# Mission contract

Kind: mission

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Make live SpecDev workflows visibly progressive, concise, and self-reporting.
The concrete context is the DataPortal live-use report at
`.specdev/project_notes/thoughts/2026-08-04_dataportal-live-workflow-friction-and-improvements.md`:
the authority model worked, but long attempts looked hung, status buried the
active decision in history, and successful automatic delivery omitted the
receipt users needed at the terminal.

## Scope and non-goals

- In scope: provider-neutral structured progress for long-running worker and
  reviewer Attempts, including safe stale-progress detection; a compact terminal
  delivery receipt for successful standalone Assignment automation; and concise
  active-first `specdev status` output with explicit history opt-in.
- Non-goals: exposing model reasoning or raw provider streams; changing
  approval, review, verification, or commit authority; Mission branch cleanup;
  legacy runtime compaction; `specdev update` reporting; announcement-policy
  changes; or redesigning durable Assignment and Mission artifacts.

## Expected behavior

- Long-running Attempts emit bounded, machine-readable progress derived from
  controller state and optional explicit worker milestones. A useful fallback
  remains available when a provider supplies no milestone, and stale progress
  is reported as a diagnostic state rather than guessed to be failure.
- A successful `specdev implement` prints and, where JSON output is requested,
  returns one delivery receipt containing the Assignment and contract identity,
  review/divergence result, delivery commit, acceptance and verification
  summaries, grouped changed project paths, unresolved risks, artifact paths,
  and final worktree cleanliness.
- Default status answers what is active and what happens next without embedding
  the complete run history. An explicit history option retains access to the
  existing historical data.

## Important decisions

- Progress is ignored runtime telemetry, not new tracked authority. It must not
  contain hidden reasoning, secrets, or unbounded provider text.
- Human-readable and JSON output are projections of the same validated result
  objects rather than independently assembled summaries.
- Attempt milestones are additive and optional. Controller-known role, elapsed
  time, process liveness, log activity, and last valid milestone provide a
  provider-neutral fallback.
- Retry and resume paths aggregate terminal receipts from durable artifacts and
  Git state; they do not require another provider call or duplicate delivery.
- `specdev status --history` is the compatibility path for full historical run
  data. Explicit Assignment and Mission status commands retain their existing
  identity-specific semantics.

## Constraints and invariants

- Existing exact-hash approval, review authorization, verification receipts,
  recovery behavior, and delivery boundaries remain authoritative.
- Progress parsing is fail-safe: malformed or oversized milestones are ignored
  or diagnosed without crashing the controller or treating an Attempt as
  complete, failed, or blocked.
- Terminal receipts must report evidence honestly and must not convert missing,
  failed, skipped, blocked, or stale evidence into success.
- Default status remains deterministic for active, blocked, interrupted, and
  idle workspaces; history remains available without reading raw runtime files.
- Output additions must remain suitable for non-interactive terminals and must
  not depend on ANSI animation.

## Delegated and reserved authority

- Delegated: exact internal schemas and module boundaries; bounded progress and
  staleness thresholds; human formatting; status history flag spelling and
  compatibility details; grouping rules for changed paths; and focused fixture
  design within the invariants above.
- Reserved for the user: changes to workflow authority or retention policy;
  parsing or exposing private model reasoning; destructive branch/runtime
  cleanup; broadening this Mission to the four deferred recommendations; and
  running verification beyond the exact command authorized below.

## Risks and assumptions

- Providers differ in what structured milestones they can supply, so the design
  must remain useful with controller-only fallback telemetry.
- Status JSON is consumed by automation; moving history behind an explicit
  option needs a deliberate compatibility path and fixtures for both shapes.
- Git-derived delivery summaries can be misleading across dirty or resumed
  candidates; the receipt must use the existing delivery boundary and preserve
  ambiguity rather than infer ownership.
- Progress and delivery output can become noisy or oversized; schemas and
  presentation must be deliberately bounded.

## Verification authority

- Focused tests for changed modules: allowed after repository instructions are
  satisfied.
- Final integrated command: the exact command below is authorized only after
  this contract is explicitly approved.
- Full suite and every other test command: prohibited unless separately approved
  by the user.

## Acceptance criteria

- AC-1: During a long-running worker or reviewer Attempt, default command output
  and structured output expose bounded progress with Attempt identity, role or
  phase, elapsed time, process/log liveness, the last valid milestone when
  available, and a fresh/quiet/stale classification; absent, malformed, stale,
  or oversized provider milestones degrade safely without leaking raw reasoning
  or changing lifecycle disposition.
- AC-2: Successful standalone Assignment automation emits a deterministic human
  and JSON delivery receipt with contract/review identity, delivery commit,
  acceptance and verification results, grouped changed project paths,
  unresolved risks, durable artifact paths, and worktree cleanliness; resumed
  completion reconstructs the same receipt without another provider or delivery
  commit, and incomplete evidence remains visibly incomplete.
- AC-3: Default `specdev status` human and JSON output contain only the current
  focus, lifecycle/phase, active Attempt or pending decision, next semantic
  command, dirty-path summary, and blocker as applicable; complete run history
  is omitted by default and remains available through an explicit history
  option with equivalent historical content.
- AC-4: Existing approval, review, verification, recovery, and delivery semantics
  remain unchanged, and focused regressions cover active, quiet/stale, blocked,
  resumed-complete, and idle/history views through the final integrated command.

## Mission execution shape

- Initial child plan: planned
- Split reason: structured Attempt telemetry, terminal delivery aggregation, and
  status compatibility are distinct implementation and verification boundaries;
  progress establishes the shared bounded-output conventions before the two
  user-facing projections are integrated.

<!-- Use planned only for a concrete context, dependency, decision, or independent verification/rollback boundary. -->

## Final integrated verification

- Command: `npm run test:workflow-visibility`
