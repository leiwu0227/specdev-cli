# Parallel Mission child execution

## Overview

SpecDev Missions currently execute an ordered child Assignment queue sequentially in the normal Mission worktree. That remains the correct default for a single child and for children with information dependencies, but it unnecessarily extends wall-clock time when a genuinely large Mission already contains several independent children.

Add bounded, local parallel execution as an internal Mission-controller optimization. Mission Design groups existing children into static waves. Children within the current wave may execute concurrently in isolated worktrees; waves themselves remain sequential. The user approves Mission scope and authority exactly as today and does not select a concurrency count or scheduling mode.

## Goals

- Reduce elapsed implementation time for large, already-decomposed Missions.
- Preserve the rule that speed alone is not a reason to create more child Assignments.
- Keep RippleGraph workflows predefined and understandable.
- Keep the ordinary Assignment graph agnostic of whether a Mission launched it.
- Prevent concurrent writers from modifying the same working tree.
- Integrate results deterministically and recover conservatively after interruption.
- Avoid multiplying full-suite test runs or adding user-facing scheduler ceremony.

## Non-Goals

- Dynamic dependency DAGs, readiness solvers, speculative children, or parallel integration.
- Distributed or cross-machine execution, background daemons, or remote schedulers.
- User-selected concurrency counts, provider budgets, or adaptive model selection.
- Splitting a Mission solely to manufacture parallel work.
- Predicted file ownership, mandatory file lists, or proofs of non-overlap.
- Automatic merge-conflict resolution, blind retries, or exact process continuation.
- General fork/join concurrency inside RippleGraph.

## Considered approaches

### Chosen: static waves with host-managed workers

RippleGraph advances to a single Mission `execute-wave` stage. The foreground Mission controller launches independent Assignment runs in worktrees, reconciles their artifacts, and advances after integration. This confines concurrency to the component that already owns processes, Git, and recovery.

### Rejected for the first version: RippleGraph fork/join

First-class engine concurrency would require dynamic fan-out, multiple active positions, atomic joins, cancellation, per-branch recovery, nested reviewer concurrency, and concurrent checkpoint writes. That is a general scheduler rather than a small Mission improvement.

### Rejected: independent manually coordinated Missions

Separate Missions would isolate workers but lose one approved authority boundary, ordered integration, final convergence review, and one integrated verification contract.

## Design

### 1. Decomposition and static waves

Mission decomposition keeps its present rule: try one full-scope Assignment first. A planned split remains justified only by context limits, information dependencies, intermediate decisions, or meaningfully independent verification or rollback. Parallel speed is not a split reason.

For a planned queue, Mission Design assigns every child a dense positive `wave` number beginning at 1:

```yaml
version: 2
assignments:
  - id: '00031'
    title: Add OpenAI-compatible provider
    kind: feature
    wave: 1
    status: pending

  - id: '00032'
    title: Add Anthropic-compatible provider
    kind: feature
    wave: 1
    status: pending

  - id: '00033'
    title: Wire providers into the router
    kind: feature
    wave: 2
    status: pending
```

Wave membership expresses semantic independence: no child in the wave requires another child's output, decision, artifact, or intermediate verification. Design does not predict exact file ownership. Unexpected overlap is safe during implementation because worktrees isolate writers; it becomes an ordinary deterministic integration conflict.

All child IDs are reserved before a wave starts. This retains readable linear repository IDs without concurrent allocation races.

### 2. Automatic bounded scheduling

Users receive no parallelism flag or prompt. The controller applies these rules:

- A wave with one child runs through the current sequential Mission path without a worktree.
- A wave with multiple children runs automatically in isolated worktrees.
- At most three children are active at once. This is an internal first-version constant, not persisted policy.
- Additional children in the wave remain pending and fill free slots.
- The next wave starts only after every child in the current wave is integrated.
- If safe worktree setup fails before any child launches, the controller reports the reason and falls back to sequential execution.

The Mission controller remains a foreground process. It prefixes concise progress with child IDs and stores detailed provider output in the existing ignored attempt/log area. It does not become a daemon.

### 3. RippleGraph boundary

The Mission graph replaces the single-child loop with a wave-level `execute-wave` host stage. RippleGraph records whether Mission Design, the current wave, Mission review, replan, or final verification owns control; it does not represent each live worker as a concurrent graph token.

Each parallel worktree starts an independent ordinary `assignment-lifecycle` root run. Mission authority and queue context are inputs to child contract authoring, but the Assignment graph has no Mission-specific nodes or transitions. The tracked parent Mission queue is the controller's durable summary of all children.

This creates two bounded state layers:

- Parent Mission RippleGraph plus `design/assignments.yaml`: scheduling and integration authority.
- Worktree-local Assignment RippleGraph plus Assignment artifacts: one child's lifecycle.

Worktree-local shared pointers and registry files are never integrated into the parent workspace.

### 4. Queue states and durable fields

Child status transitions are:

```text
pending -> running -> completed -> integrated
                    -> blocked
pending/running -> cancelled
```

`completed` means the Assignment passed its required implementation review and has a controller-created delivery commit. `integrated` means that delivery was applied to the Mission branch and recorded in a Mission checkpoint. A blocker records whether execution or integration failed.

Each queue entry may durably record `wave`, `branch`, `base_revision`, `delivery_revision`, `integrated_revision`, timestamps, and a concise blocker. Machine-local slot paths and PIDs do not belong in the tracked queue.

### 5. Worktree slots and branches

Parallel children lease bounded paths under the already-ignored pool:

```text
.specdev/worktrees/slot-01/
.specdev/worktrees/slot-02/
.specdev/worktrees/slot-03/
```

Before use, SpecDev verifies that a slot is below the expected pool root, ignored, untracked, not a symlink, and registered by `git worktree`. A local ignored lease record maps slots to children; the durable child branch and queue entry are sufficient to reconstruct a missing slot after restart.

Before launching a wave, the controller commits a Mission wave-base checkpoint containing the approved queue and reserved IDs. Every child branch starts from that same revision and is named predictably, for example `specdev/M00001/00031`.

After successful integration, SpecDev removes the registered worktree through `git worktree remove`. It deletes the child branch only after verifying the delivery revision is represented by the integrated Mission checkpoint. Failed, blocked, or conflicted branches are preserved for inspection. SpecDev never applies generic recursive deletion to a slot.

### 6. Child delivery ownership

The child worker does not create or integrate Git commits. After its Assignment passes review, the controller validates and creates one delivery commit containing:

- Product changes authorized by the child contract.
- The child's completed Assignment folder.
- Unique durable Attempt records relevant to that child.

The delivery commit must exclude:

- `.specdev/.ripplegraph/current.json` and registry state.
- The parent Mission folder and parent queue.
- Worktree leases, process markers, caches, and absolute paths.
- Artifacts belonging to another child.

The parent Mission controller is the sole writer of the parent queue and Mission RippleGraph state. This prevents a worktree's focused Assignment from replacing the parent workspace's focused Mission.

### 7. Rolling deterministic integration

Children may finish in any order, but integration follows declared queue order within the wave. The controller does not wait for the entire wave: it integrates the longest completed prefix as soon as it is available.

```text
Declared:   A -> B -> C
Completed:  B, A, C
Integrated: wait; then A -> B; then C
```

For each eligible child, the controller applies its delivery commit with `cherry-pick --no-commit`, updates the parent queue and Mission state, then creates one checkpoint commit such as `specdev(M00001): integrate 00031`. Commit trailers identify the Mission, Assignment, and wave so restart reconciliation can prove that a child was integrated without relying only on mutable YAML.

If integration conflicts, the controller pauses new launches and further integration. Already-running children may finish and preserve their delivery branches. SpecDev does not guess at conflict resolution. The Mission reports the exact child and Git state requiring user-directed repair.

### 8. Failure and restart behavior

When any child blocks or fails to launch, the controller stops filling new slots in that wave. Already-running children may finish; completed deliveries remain buffered. There are no blind retries.

On takeover after interruption, the controller reconciles:

1. The tracked Mission queue and current Mission branch.
2. Registered worktrees and predictable child branches.
3. Assignment status, review verdict, and delivery revision.
4. Integration commit trailers and Git ancestry.
5. Durable Attempt summaries and local liveness markers.

It then conservatively restores `pending`, `running/interrupted`, `completed`, or `integrated`. It never cherry-picks a proven integrated child twice. An interrupted coding process may be relaunched from the existing worktree and artifacts; exact model-process continuation is not required.

Active parallel execution is not portable across machines in this version. A fully integrated wave checkpoint is portable and pushable like the current Mission state.

### 9. Review and verification

Every child keeps the normal Assignment contract, automatic Mission-child brainstorm review policy, focused acceptance evidence, and required implementation review. Parallelism does not waive evidence.

SpecDev does not automatically run a full suite after every child or wave. Conflict-free integration performs structural Git/state checks only. After all waves are integrated, the existing Mission convergence review runs, followed by the one exact integrated verification command authorized in the Mission contract. Failed convergence or final verification appends a bounded repair Assignment, normally in a later wave.

## Risks and mitigations

- **Bad wave grouping wastes compute:** worktrees prevent corruption; integration blocks visibly. Keep grouping semantic and static.
- **Concurrent provider sessions hit limits:** cap active children at three and stop filling slots after a launch/provider failure.
- **Shared `.specdev` files conflict:** exclude child-global RippleGraph and parent Mission state from delivery commits.
- **Build dependencies are absent in a worktree:** classify this as environment/setup failure; fall back before launch where possible, otherwise preserve the branch and block without fabricating test evidence.
- **Crash during integration:** Git sequencer state, queue fields, and commit trailers make the operation detectable; ambiguous states require inspection rather than automatic cleanup.
- **Parallel overhead exceeds benefit:** never use a worktree for a one-child wave and never split solely for speed.

## Success Criteria

- A Mission with at least two independent children runs multiple implementation workers concurrently without concurrent writes to one worktree.
- A Mission with one child behaves as it does today and creates no child worktree.
- Mission Design produces deterministic, validated waves without a dependency graph or file-ownership declarations.
- No more than three children are live, and the user is not asked to tune concurrency.
- Completion order cannot change integration order or final Git history.
- Worktree-local RippleGraph pointers cannot overwrite the parent Mission state.
- A blocked child or merge conflict stops new scheduling, preserves completed work, and reports a recoverable state.
- Restart reconciliation does not duplicate child execution or integration when durable evidence already exists.
- Only the contract-authorized final integrated verification is mandatory at Mission scope; full suites are not multiplied per child or wave.

## Testing Approach

- Unit-test queue validation, dense wave numbering, status transitions, slot caps, and deterministic completed-prefix selection.
- Use temporary Git repositories to test safe slot creation, branch bases, delivery filtering, ordered `cherry-pick --no-commit`, cleanup, and conflict preservation.
- Use fast fake child runners to test out-of-order completion, bounded launch filling, blocked-child behavior, and foreground interruption.
- Exercise restart reconciliation at pre-launch, running, delivery-complete, partially integrated, and conflict states.
- Verify that single-child Missions retain the existing no-worktree path.
- Keep expensive provider and full-suite runs out of scheduler unit tests; perform one focused end-to-end fixture Mission before release.
