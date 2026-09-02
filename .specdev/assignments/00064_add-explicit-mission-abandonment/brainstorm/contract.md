# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Add the explicit Mission abandonment required by the approved Mission-lane
design. A user who no longer wants a nonterminal Mission must be able to record
that decision as an inspectable terminal outcome without deleting or landing
partial work, confusing abandonment with failure, or editing engine state by
hand.

## Scope and non-goals

- In scope: a reasoned `specdev mission abandon` command; read-only planning and
  exact confirmation; controller, Attempt, Git, and child-worktree preflight;
  durable abandonment artifacts and retained-revision inventory; RippleGraph
  terminal transition and bounded runtime compaction; idempotent recovery;
  Mission status/help/docs; and focused regressions.
- Non-goals: abandoning standalone Assignments; changing Mission completion,
  semantic failure, successor handoff, or landing policy; force-stopping live
  agents; committing ambiguous product dirt; deleting, pruning, merging, or
  landing Mission/child branches or worktrees; or reviving an abandoned Mission.

## Expected behavior

The first invocation requires an explicit reason and returns a content-addressed
plan without changing durable state. The plan identifies the Mission/run,
current checkpoint and focus, controller and owned Attempt state, checked-out
Mission branch and HEAD, base and child branch revisions, registered child
worktrees, and the exact terminal paths and commit it would publish. The command
applies only when a supplied confirmation still matches that plan.

Confirmed abandonment writes a human-readable terminal artifact plus Mission
and status records with the reason, time, retained Git identities, child state,
and absence of delivery. It abandons and compacts only the matching owned
runtime, clears matching focus, and creates one labelled terminal commit on the
Mission branch. It never lands partial work or removes retained branches and
worktrees. Repeating the command recovers or reports the same terminal result.

## Important decisions

- Use a versioned ignored recovery journal only after exact confirmation, so a
  crash between terminal writes, engine transition, compaction, and commit can
  converge without repeating authority.
- Require the Mission branch to be checked out with a clean main worktree and
  require every registered Mission child worktree to be clean and attributable.
  Dirty or unregistered worktree state is ambiguous and blocks before mutation;
  users preserve it through an explicit Git decision outside this command.
- Treat `abandoned` as a distinct terminal Mission status. It is neither
  completed nor failed, has no final delivery revision, and cannot run, land,
  checkpoint, hand off, or satisfy success recovery.

## Constraints and invariants

- No live or ambiguous Mission controller, child worker/reviewer, resolver,
  arbiter, or other Mission-owned running Attempt may exist. The command does
  not kill or reclassify a process to make its own preflight pass.
- Confirmation binds the reason and complete inspected state. Changed HEAD,
  branch/worktree identity, dirt, focus, checkpoint, Mission record, queue, or
  Attempt state invalidates it and produces a replacement plan.
- Preserve the Mission branch, base identity, child branches, registered child
  worktrees, queue, findings, evidence, and partial artifacts. Runtime
  compaction may remove only the matching terminal run and owned Attempt
  records after durable terminal authority exists.
- Existing completed, failed, and already abandoned Missions remain immutable.
  An exact retry of an abandoned Mission is idempotent; conflicting reason or
  identity fails closed.

## Delegated and reserved authority

- Delegated: edit product source, managed templates, documentation, and focused
  tests; define a versioned abandonment plan/journal schema, bounded retained
  identity summary, exact terminal commit trailer, and conservative ownership
  checks within this contract.
- Reserved for the user: approve this contract; supply and confirm the real
  abandonment reason; resolve dirty or ambiguous product/worktree state; stop
  or recover live/uncertain agents; delete or land retained work; revive the
  objective under fresh authority; and authorize tests.

## Risks and assumptions

- A crash can leave durable terminal state ahead of runtime compaction or its
  terminal commit. The journal and commit trailers must recover only the exact
  confirmed plan and never infer broader cleanup authority.
- Git worktrees and branches may have been changed outside SpecDev. Canonical
  registration, ancestry, revision, cleanliness, and ownership checks are
  therefore revalidated immediately before terminal mutation.
- Preserving work rather than deleting it can leave storage and branches for
  later manual cleanup. That is intentional because abandonment authority does
  not imply disposal authority.

## Verification authority

- No test command is authorized by this contract alone. Ask the user explicitly
  before running focused Mission abandonment, liveness, worktree, recovery,
  status, and terminal-compaction regressions.
- Full suite: requires separate explicit user approval.

## Acceptance criteria

- AC-1: An eligible nonterminal Mission produces a stable read-only abandonment
  plan, exact confirmation publishes one reasoned `abandoned` artifact/status
  and labelled terminal commit with retained Mission/base/child Git identities,
  and only then abandons and compacts the matching owned runtime.
- AC-2: Live or ambiguous owned Attempts, wrong or changed branch/HEAD, dirty or
  unsafe main/child worktrees, changed queue/focus/checkpoint/record, and stale or
  mismatched confirmation all fail before durable mutation while preserving
  every branch, worktree, artifact, and product byte.
- AC-3: Interrupted and repeated execution converges idempotently on the same
  abandonment, while status exposes the terminal reason and retained work and
  every run, checkpoint, handoff, landing, or success path refuses to reinterpret
  the abandoned Mission as active, failed, completed, or delivered.
