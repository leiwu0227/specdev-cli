# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Separate user-directed reviews from unattended automatic reviews. Interactive
top-level Brainstorm and Discussion reviews remain under direct user control,
while post-approval implementation, Mission-child Brainstorm, Mission
convergence, and final-verification recovery use finite autonomous convergence
instead of stopping after two rounds for user direction.

## Scope and non-goals

- In scope: review-mode classification; two guaranteed and one conditional
  primary-reviewer rounds; one resolver and one final arbitration Attempt;
  evidence-safe override; durable restart state; bounded Mission replanning;
  immutable Assignment and Mission graph revisions.
- Non-goals: new permanent agent roles, user-configurable numeric budgets,
  unlimited retry loops, automatic changes to approved top-level authority, or
  overriding failed acceptance criteria and verification evidence.

## Expected behavior

Each explicit interactive review performs one review and returns control to the
user without a round-count lockout. Automatic reviews run a finite convergence
ladder: two primary rounds, an optional third when the candidate is changing and
findings are not an unchanged repetition, then one resolver and one arbiter.
The arbiter classifies approval, nonblocking disagreement, or objective failure.
Automatic sessions never pause merely because a review-round budget was
exhausted.

## Important decisions

- Execution mode, not phase name, determines policy. A Mission-child Brainstorm
  is automatic because the parent Mission is already approved.
- Reuse the configured worker and reviewer profiles with task-specific prompts;
  do not add fixed reviewer personas.
- A nonblocking disagreement may advance only through the existing strict host
  evidence gate. Objective failure must replan or terminate explicitly.
- Keep the current repair cycles and add only the graph disposition needed to
  represent terminal failure honestly.

## Constraints and invariants

- Top-level contract approval remains the required user gate before automation.
- The controller may not expand scope, reserved authority, or verification
  authority while resolving findings.
- Primary-review progress uses durable candidate and normalized-findings
  digests; exact intermediate round artifacts remain transient.
- Existing graph packages pinned by in-flight runs remain installed and usable.
- Format-correction Attempts remain separately bounded and do not count as
  semantic review rounds.

## Delegated and reserved authority

- Delegated: automatic repair, conditional third-round selection, resolver and
  arbiter prompts, nonblocking evidence-safe override, and Mission replanning
  wholly within the approved contract.
- Reserved for the user: top-level contract changes, expanded scope or
  authority, protected verification approval, and any explicit cancellation.

## Risks and assumptions

- Reviewer wording may change while expressing the same issue; digest comparison
  is a bounded progress signal, not semantic proof.
- Autonomous override is unsafe without the strict acceptance, receipt,
  deviation, and follow-up checks already used for review waiver.
- A genuinely impossible requirement cannot be made successful by orchestration;
  it must produce an objective terminal failure rather than loop or claim
  completion.

## Verification authority

- Focused tests for changed modules: allowed after repository instructions are satisfied
- Graph/package, command integration, and recovery tests for changed review paths:
  allowed after repository instructions are satisfied
- Full suite and lint: require explicit user approval

## Acceptance criteria

- AC-1: Interactive top-level Brainstorm, Mission Brainstorm, and Discussion
  reviews have no hard round lockout and never start automatic repair or
  arbitration.
- AC-2: Automatic child-Brainstorm, implementation, and Mission convergence
  reviews follow the finite primary/conditional/resolver/arbiter ladder,
  recover from durable state, and never request user direction solely because a
  round count was exhausted.
- AC-3: Only approved or host-validated nonblocking disagreement may advance;
  objective failure uses a bounded replan or terminal failure path, graph
  packages are versioned immutably, and focused tests cover progress, stalling,
  blocked, override, failure, and restart behavior.
