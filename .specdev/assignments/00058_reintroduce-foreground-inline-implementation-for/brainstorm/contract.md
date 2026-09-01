# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Reintroduce foreground inline implementation for standalone Assignments as a
fresh execution-mode feature. Ordinary Assignments should preserve the current
coding agent's context by default while retaining explicit spawned execution,
Mission-controlled workers, frozen Git-boundary ownership, recovery,
independent review, and the existing delivery guarantees.

This Assignment ports useful behavior from historical Assignment `00068` onto
the current codebase. The historical implementation is investigation evidence,
not a patch to restore, and its removed protected-architecture machinery is not
part of this work.

## Scope and non-goals

- In scope: provider-neutral `auto`, `inline`, and `spawned` implementation-mode
  resolution; repository and machine-local configuration; explicit CLI
  selection; foreground Design, Implementation, evidence, and repair
  obligations; durable status and receipt visibility; recovery; aligned
  installed guidance; and focused regression coverage.
- In scope: deterministic selection and freezing before product mutation,
  including invalid choices, conflicting choices, legacy spawned recovery, and
  current dirty-worktree ownership checks.
- Non-goals: restoring protected architecture notes or publication workflows;
  removing spawned workers; changing Mission scheduling, parallel worktrees,
  contract approval, review-policy defaults, reviewer independence, delivery
  ownership, or permission to run tests and external actions.

## Expected behavior

- Committed `.specdev/agents.yaml` and ignored
  `.specdev/cache/agents.local.yaml` accept this provider-neutral execution
  setting alongside the existing agent profiles:

  ```yaml
  implementation:
    mode: auto # auto | inline | spawned
  ```

  Omission means `auto`; machine-local configuration overrides repository
  configuration. The agent-profile parser recognizes `implementation` as
  execution configuration rather than a worker/reviewer role. Existing
  `worker` profile precedence remains built-in defaults, repository profile,
  machine-local profile, then diagnostic CLI overrides, and is used only when
  implementation resolves to spawned. The independent `reviewer` profile is
  used in either implementation mode.
- A standalone Assignment resolves `auto` to `inline`. `specdev implement`
  establishes the normal Git boundary, freezes the decision, launches no worker
  process, and returns structured foreground obligations for the approved
  contract, plan, progress, outcome, result envelope, and authorized evidence.
  The foreground coding agent completes those obligations and reruns the
  command to validate and advance the workflow.
- Before the boundary, `--inline` and `--spawned` may select an execution mode.
  A non-default spawned selection records a concise bounded reason. Invalid,
  conflicting, or fixed-policy-incompatible choices fail before mutation, and
  the frozen mode cannot be switched afterward.
- Mission-controlled Assignment execution remains spawned. Existing preserved
  worker results without a recorded mode remain on the spawned recovery path.
- Inline implementation findings and artifact-repair requests return bounded
  obligations to the foreground owner. Spawned execution retains worker
  Attempts, blocked-result reuse, explicit retry, and bounded repair behavior.
- Both execution paths converge on the same acceptance accounting, candidate
  receipt, independent reviewer or approved waiver, divergence handling,
  exact-path delivery manifest, and final host-owned commit. Status, next-action
  output, and receipts expose configured/effective mode, source, bounded reason,
  current owner, and recovery action.

## Important decisions

- `auto` is the compatibility setting, but its deterministic standalone default
  is inline rather than a heuristic or silent provider launch.
- Inline makes the foreground coding agent the implementation worker only; it
  does not grant contract, lifecycle, approval, commit, or reviewer authority.
- Execution ownership freezes at the implementation Git boundary. Ambiguously
  handing dirty work to another executor is forbidden.
- Spawned mode remains available for unattended automation, isolation, or a
  user-selected worker. Mission control remains spawned.

## Constraints and invariants

- Repository instructions, the approved contract hash, RippleGraph semantic
  transitions, Git-boundary ownership, evidence validation, reviewer mutation
  checks, and exact-path delivery remain authoritative.
- Inline mode may write only the product and Assignment-owned artifacts allowed
  to the spawned worker. It does not create a worktree, commit independently,
  or spawn another implementation Attempt.
- Mode resolution and durable records remain provider-neutral. Private
  reasoning and conversation history are not persisted.
- Extending `agents.yaml` must preserve strict rejection of unknown top-level
  keys, invalid role profiles, and invalid implementation modes; it must not
  reinterpret `implementation` as an agent profile.
- Existing spawned execution and recovery behavior must not regress while the
  new inline path is introduced.

## Delegated and reserved authority

- Delegated: within the approved contract, the foreground coding agent may use
  the inline default, complete the returned implementation obligations, collect
  explicitly authorized focused evidence, and repair inline-owned findings.
  Before the Git boundary it may use explicitly selected spawned execution with
  a recorded bounded reason.
- Reserved for the user: changing the approved contract or fixed execution
  policy, waiving required review, authorizing tests under repository rules,
  approving material divergence, destructive or external actions, and any
  expansion beyond this Assignment.

## Risks and assumptions

- The new default may surprise unattended callers; fixed `spawned`
  configuration and explicit CLI selection provide a migration path.
- Inline work can outlive its originating chat session; durable ownership,
  artifacts, and next-action output must support safe continuation.
- The historical implementation may no longer fit current command and review
  structure. Current source and tests govern the fresh design.

## Verification authority

- Focused tests for execution resolution, implementation/recovery, status,
  review/repair routing, installed defaults, and spawned compatibility require
  explicit user approval before execution.
- Full suite requires separate explicit user approval.

## Acceptance criteria

- AC-1: Configuration and CLI resolution support `auto`, `inline`, and
  `spawned`; ordinary standalone `auto` resolves to inline, Mission execution
  remains spawned, explicit and fixed selections are honored, and invalid,
  conflicting, or post-boundary switches fail before ambiguous product
  ownership is created.
- AC-2: Inline implementation launches no worker process, freezes and exposes
  foreground ownership, returns complete resumable obligations, accepts
  validated foreground-authored delivery artifacts, routes inline repair back
  to the foreground owner, and reaches the unchanged independent review and
  delivery gates.
- AC-3: Spawned implementation, retry, legacy recovery, required reviewer
  independence, acceptance accounting, and exact-path delivery remain
  compatible; both modes expose aligned execution facts through machine and
  human status, next-action, receipt, configuration, and installed guidance
  surfaces with focused evidence.
