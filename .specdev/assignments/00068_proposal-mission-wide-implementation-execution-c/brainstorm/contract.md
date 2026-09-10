# Assignment contract

Kind: change

Source discussion: D00024 (f33363861b23b9beae785f4facdd002b7cb4b7070f4d4cc95580a223d0782533)
Source artifact manifest: v1, 2 files
Source proposal: `.specdev/discussions/D00024_allow-mission-implementation-to-preserve-foregro/brainstorm/proposal.md`
Source design: `.specdev/discussions/D00024_allow-mission-implementation-to-preserve-foregro/brainstorm/design.md`

## Objective and context

Add an explicit Mission-wide implementation execution choice immediately after
Brainstorm approval. The user chooses whether every implementation phase stays in
the current main coding session or uses spawned workers; SpecDev freezes and applies
that choice throughout the Mission.

Authoritative design and rationale are in source Discussion D00024. Use
`.specdev/project_notes/big_picture.md` for project context. Relevant verified history
is recorded in
`.specdev/assignments/00058_reintroduce-foreground-inline-implementation-for/outcome.md`
and
`.specdev/assignments/00061_add-the-selective-assignment-context-catalog/outcome.md`.

## Scope and non-goals

- In scope: Mission lifecycle, durable status and command output, child Assignment
  execution routing, implementation repair/resolver routing, mode-dependent wave
  execution, recovery compatibility, installed guidance, and focused regression
  coverage needed for the explicit Mission choice.
- Non-goals: changing standalone Assignment mode selection, weakening independent
  review or evidence gates, adding worker-session continuation, allowing executor
  switching after implementation starts, or introducing user-configured concurrency.

## Expected behavior

After the exact Mission contract is approved, SpecDev enters a distinct execution
choice state and presents `inline` and `spawned` continuations without selecting a
default. The chosen mode is stored once on the Mission and inherited by every child.

Inline mode returns structured `action_required` obligations to the current main
coding session for initial implementation, review repair, and the bounded resolver.
The Mission guide fulfills those obligations and resumes the controller without
routine user intervention. Inline children execute sequentially in the Mission
worktree and never launch implementation workers or lease parallel worktrees.

Spawned mode retains the current automatic worker and bounded parallel-wave behavior.
Both modes retain independent read-only review, durable recovery artifacts, Mission
convergence, and final verification.

## Important decisions

- Execution choice occurs after contract approval and before Mission Design or child
  implementation.
- The choice is explicit per Mission and does not silently inherit
  `.specdev/agents.yaml` implementation mode.
- “Inline” covers all product-writing implementation roles, including repairs and
  resolvers, but never reviewers.
- A direct terminal invocation in inline mode may return the same actionable contract;
  only a compatible main coding-agent session can fulfill and automatically resume it.
- Existing approved or running Missions without the new field retain spawned behavior.

## Constraints and invariants

- One frozen Mission choice governs every child; no mixed or mid-flight executor mode.
- No product mutation or implementation worker launch may occur before the choice.
- Inline and spawned paths produce and validate equivalent contracts, plans, progress,
  outcomes, result envelopes, acceptance evidence, and review inputs.
- Conversational context is operational convenience, never authority or required
  recovery state.
- Existing exceptional user gates, repository instructions, Git boundaries, and
  verification authority remain enforced.

## Delegated and reserved authority

- Delegated: implement the agreed execution-choice lifecycle, routing, compatibility,
  guidance, and focused regression coverage without changing the approved semantics.
- Reserved for the user: any silent default, different choice timing, mixed-mode
  Mission, weakening of review/evidence gates, destructive migration, new dependency,
  or expansion beyond source Discussion D00024.

## Risks and assumptions

- Inline Mission execution depends on a compatible coding-agent driver to loop over
  CLI obligations; raw terminal use must fail safe by returning the obligation.
- Serializing inline waves may increase elapsed time but is required by the single
  main-session writer model.
- Lifecycle-version and legacy-state handling must not prompt an already-running
  Mission for a new execution decision.

## Verification authority

- Focused tests for changed modules: allowed after repository instructions are satisfied
- Full suite: requires explicit user approval unless already authorized here

## Acceptance criteria

- AC-1: A newly approved Mission stops before Design or implementation, exposes an
  explicit no-default `inline`/`spawned` choice, durably freezes the selected mode for
  all children, rejects later switching, and preserves spawned behavior for eligible
  legacy active Missions.
- AC-2: Inline mode launches no implementation worker for initial work, review repair,
  or resolver work; it returns complete structured foreground obligations, resumes
  from durable artifacts, and executes all planned children sequentially without
  parallel worktree leasing.
- AC-3: Spawned mode retains current automatic and parallel execution, while both modes
  preserve independent review, evidence and recovery invariants, status visibility,
  installed guidance, and focused regression coverage.
