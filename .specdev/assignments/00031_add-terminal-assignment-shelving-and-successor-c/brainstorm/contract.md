# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Allow a user to stop useful unfinished Assignment work without pretending that
its execution graph can safely resume later. A shelved Assignment becomes an
immutable historical reference; continuing that work creates a fresh successor
Assignment with a new ID and an explicit lineage back to the shelf.

## Scope and non-goals

- In scope: an Assignment shelf command, durable shelf metadata and Git
  recovery boundary, successor creation from a shelf, lifecycle-aware
  focus/continue/status/help output, and safe cancellation help/validation where
  the same command routing is involved.
- Non-goals: reactivating a shelved RippleGraph run, Git stash management,
  resetting a repository to an old shelf commit, shelving Mission children or
  Missions, transferring old approvals/review budgets, or adding a general
  multi-workflow scheduler.

## Expected behavior

- `specdev assignment shelf <id>` stops an active standalone Assignment after
  protecting against live worker/reviewer processes. It records a shelf reason,
  timestamp, graph/run identity, artifact reference, repository branch, and Git
  commit hash, then terminates the old execution run. Repeating the command is
  idempotent.
- A clean worktree may be shelved directly at `HEAD`. If unfinished tracked
  work exists, SpecDev must not silently discard it or indiscriminately commit
  unrelated concurrent work: it returns an explicit decision, including a
  supported user-authorized snapshot-commit path with a clearly labelled
  `specdev(assignment): shelf <id>` commit.
- `specdev assignment "<objective>" --from-assignment=<shelved-id>` creates a
  normal fresh Assignment and records predecessor lineage. Its contract starts
  with a concise shelf handoff: prior objective and decisions, completed work,
  unresolved work, historical verification, artifact path, and shelf Git
  commit. It does not restore the old graph node or make historical approval
  current.
- When a user asks an agent to “resume” a shelved Assignment, installed
  guidance directs the agent to create this successor instead. CLI output for a
  shelved Assignment likewise explains that it is immutable and gives the exact
  successor command.

## Important decisions

- Shelf is terminal but non-failure. Cancel/abandon remains the terminal
  operation for work the user does not intend to continue.
- Crash recovery is unchanged: an Assignment that remains active may continue
  from durable artifacts. Intentional shelving is what prevents same-run
  continuation.
- A successor begins from the repository's current state. The recorded shelf
  commit is recovery and comparison evidence; SpecDev never silently checks it
  out, resets to it, or assumes it is still the current `HEAD`.
- `focus` selects artifacts but does not mutate lifecycle state.

## Constraints and invariants

- Only an active standalone Assignment can become shelved. Mission children and
  already completed or abandoned Assignments are rejected with a useful next
  action.
- The shelf record and predecessor reference are durable, portable,
  human-readable repository artifacts. RippleGraph remains temporary execution
  state and must agree with the product-facing lifecycle while a run exists.
- Source promotion copies only bounded handoff context; it must not duplicate a
  large prior contract or treat stale verification as current evidence.
- Existing Discussion and Test Audit promotion behavior remains compatible.
- Mutating command help, including `specdev cancel --help`, must render help and
  never perform the mutation. Irreversible cancellation requires an explicit
  reason.

## Delegated and reserved authority

- Delegated: implementation details, exact metadata shape, bounded handoff
  rendering, idempotent recovery mechanics, and focused regression coverage.
- Reserved for the user: authorizing a snapshot commit when the worktree has
  unfinished changes, approving the successor contract, and resolving
  unrelated/concurrent dirty work.

## Risks and assumptions

- Git cannot reliably attribute an arbitrary dirty file to one Assignment.
  Therefore the shelf path must expose ambiguity rather than stage everything
  automatically.
- Old or partially migrated Assignments may lack lifecycle metadata. Read paths
  should remain useful and fail safely without fabricating a resumable state.
- “Resume” is natural conversational wording, but the product must clearly
  report that a new ID and approval contract are being created.

## Verification authority

- Focused tests for changed modules: allowed after repository instructions are satisfied
- Full suite: requires explicit user approval unless already authorized here

## Acceptance criteria

- AC-1: Shelving an eligible standalone Assignment produces an idempotent,
  durable terminal shelf record, safely terminates its run, protects live
  attempts, and either records clean `HEAD` or requires explicit authorization
  before creating a recoverable snapshot commit for unfinished work.
- AC-2: Creating an Assignment from a valid shelf allocates a fresh ID and
  contract with bounded predecessor context and Git/artifact references, while
  never restoring prior graph position, approval, review state, or verification
  authority; invalid source states fail with actionable output.
- AC-3: Focus, continue, status, help, and installed agent guidance distinguish
  active, shelved, abandoned, and completed Assignments, translate a request to
  resume a shelf into successor creation, preserve existing promotion flows,
  and guarantee that help flags cannot trigger cancellation or shelving.
