# Proposal: Mission-Wide Implementation Execution Choice

## Problem

Mission currently forces every child Assignment to use spawned implementation.
Initial implementation, review repair, and resolver work may therefore move through
several fresh worker sessions, losing useful conversational understanding that already
exists in the main coding session.

Mission should remain unattended after its explicit user gates, but unattended work
does not require spawned implementation. A compatible main coding session can execute
structured inline obligations and re-enter the durable Mission controller without
asking the user to supervise each step.

## Agreed behavior

Immediately after the Mission Brainstorm contract is approved, SpecDev asks the user
to choose one implementation execution mode for the entire Mission:

- `inline`: all product implementation and implementation-repair work is performed
  by the current main coding session. SpecDev does not create an implementation worker
  session.
- `spawned`: implementation uses automatic worker Attempts as it does today.

The choice is explicit, has no silent default, and freezes before Mission Design or
child implementation begins. Every child inherits the same choice. A resumed Mission
reports the frozen choice and never asks again. Executor switching after implementation
has begun is not supported.

The post-approval state presents exact continuation commands, using the existing mode
vocabulary, such as:

```text
specdev mission run M00001 --inline
specdev mission run M00001 --spawned
```

The CLI records the choice; the surrounding SpecDev Mission guide is responsible for
asking the user rather than relying on an interactive terminal prompt.

## Inline Mission execution

The Mission controller advances until a child needs implementation. It then returns a
structured `action_required` result containing the Mission and child identities, the
approved contract, context catalog, required delivery artifacts, verification limits,
and exact resume command.

The same main coding session performs the work and reruns `specdev mission run`. The
controller validates the artifacts and resumes automatically. The Mission guide keeps
looping through these obligations without routine user interaction. The same behavior
applies to review-requested repair and the final bounded implementation resolver, so
no implementation phase silently launches a fresh worker.

Inline mode has one implementation writer. All child Assignments therefore execute
sequentially in the Mission worktree, including independent children that share a
planned wave. Inline mode does not lease parallel worktrees. Static wave information
may remain useful for dependency and ordering semantics, but it does not create
concurrent implementation.

Independent reviewers remain spawned, product-read-only Attempts. Mission-level
convergence, evidence validation, final verification, and lifecycle transitions remain
controller-owned. “All implementation is inline” does not mean the implementation
owner reviews or approves its own candidate.

## Spawned Mission execution

Spawned mode preserves the existing unattended controller behavior. The controller
launches implementation workers, may execute validated independent waves concurrently,
and uses the existing worker result and recovery rules. Worker-session continuation is
not required by this proposal and can be considered separately.

## Unattended meaning

After the user approves the contract and chooses the execution mode, neither mode adds
routine user gates. Spawned mode can complete inside one CLI process. Inline mode is
unattended when driven by a compatible main coding session: the CLI yields bounded
obligations, and the Mission guide fulfills and resumes them within the same coding
conversation.

A direct terminal invocation cannot command an enclosing coding session. If inline
mode is selected without a compatible agent driver, the CLI safely returns the same
`action_required` contract rather than spawning work or pretending to continue.

## Recovery and authority

Conversation context is operational convenience, never durable authority. Contracts,
plans, progress, evidence receipts, outcomes, findings, Git state, and Attempt records
remain sufficient for another main session to recover interrupted inline work.

The Mission-wide choice is stored durably with its source and selection time. Child
Assignment execution records project that parent choice and freeze at their ordinary
Git boundaries. Existing approved or running Missions created under the old mandatory
spawned behavior retain spawned execution rather than gaining a new mid-flight choice.

Configuration in `.specdev/agents.yaml` continues to select ordinary standalone
Assignment behavior and spawned worker/reviewer profiles. It does not silently answer
the new explicit Mission execution question.

## Expected product surfaces

- Add a post-approval Mission execution-choice state and durable projection.
- Teach Mission commands and status output to present, accept, freeze, and recover the
  explicit choice.
- Propagate inline child and repair obligations through `specdev mission run` instead
  of treating them as worker blockers.
- Serialize inline waves while retaining existing spawned parallel execution.
- Update installed Mission, Assignment, workflow, and agent guidance.
- Add focused contract coverage for selection, freezing, resume, repairs, legacy
  Missions, and mode-dependent wave execution.
