# Oceanpower Mission live workflow friction and improvement opportunities

## Context

This note records friction observed while live-testing SpecDev on Oceanpower's
first large distributed-compute Mission, `M00001`, followed by successor
Assignment `00015`.

The Mission began with five implementation children and ultimately integrated
Assignments `00004` through `00010` and `00012` through `00014`. Assignment
`00011`, native Windows verification, was cancelled after the user explicitly
authorized a platform bypass. The Mission opened four convergence gaps: three
were evidence-closed or user-bypassed, while one reached an irreversible
semantic-failure terminal. Successor Assignment `00015` then preserved the
candidate, ran the intended verification in the supported host environment,
obtained implementation-review approval, and delivered the same candidate.

The eventual product result was good: the supported host suite passed with 44
tests and 9 explicitly classified skips, the independent review approved the
handoff, and the delivery was merged to `main`. The most important workflow
finding is therefore not that SpecDev failed to produce sound work. It is that
environment and evidence-routing problems caused a sound product candidate to
be represented first as a terminally failed Mission and then recovered through
a second lifecycle.

## What worked well

### 1. Convergence review found a real architectural omission

The first Mission convergence review found that the implemented domain pieces
were not yet connected into the promised production path: durable public
submission, identifier-only RQ transport, and the outbound production agent
service were incomplete as one operable vertical slice. Assignments `00013`
and `00014` closed that gap and found a real RQ compatibility defect along the
way (`timeout=0` needed translation to RQ's nonblocking `None`).

This was the strongest part of the workflow. The Mission review was not merely
checking that child checklists were green; it evaluated whether the overall
objective actually worked.

### 2. Durable artifacts made a complicated recovery auditable

The Mission contract, gap ledger, child outcomes, review verdicts, failed
terminal state, post-terminal verification receipt, and successor Assignment
preserved enough context to reconstruct exactly what happened. Assignment
`00015` did not rewrite the failed Mission's history. It explicitly inherited
the candidate and evidence and recorded which receipt superseded which
environment failure.

### 3. User-authorized exceptions remained visible

Native Windows was never represented as passing. Assignment `00011` and the
Mission gap ledger record the user-authorized bypass, while later outcomes keep
Windows as an unverified residual risk. This is materially better than silently
dropping the platform criterion to obtain a green result.

### 4. Reviewer separation improved evidence quality

Independent review caught an incorrect skip classification in Assignment
`00015`: the nine skips were six DSN-gated PostgreSQL tests and three native
Windows tests, not an Oceanseed optional-import skip. The correction changed
only the records, not the product, and made the final handoff more trustworthy.

## Where I felt drag

### 1. The workflow confused an environment mismatch with an objective failure

This was the largest source of drag.

The Mission contract recorded `python3 -m pytest -q`. The review environment's
default `python3` lacked declared runtime dependencies and failed during test
collection. The repository's supported interpreter was later identified as:

```text
/Users/leiwu/code/oceanwave/lib/oceanscript/venv-macos/bin/python
```

That interpreter collected the suite cleanly and ultimately produced `44
passed, 9 skipped`. Nevertheless, convergence reached the irreversible status:

```text
failed / semantic-failure / objective-failure
```

The Mission verdict itself said the remaining blocker was an
"environment/record correction, not a repository defect." That diagnosis and
the terminal classification do not agree. A missing dependency in the selected
verification interpreter should not have the same lifecycle consequence as a
product that cannot satisfy its contract.

Once the correct host verification passed, SpecDev correctly refused to rewrite
terminal history—but that meant a successor Assignment was required purely to
deliver a candidate that the failed Mission had already produced.

### 2. Automatic mode did not preflight facts that later required user input

Before starting the Mission, the user explicitly asked for open questions
because execution was expected to become automatic. The workflow still later
needed decisions about:

- the lack of a native Windows machine;
- whether native Windows could be bypassed;
- which Python environment was supported;
- whether a host-side rerun was authorized after the managed worker denied
  loopback binding; and
- whether live PostgreSQL could be provisioned or reached outside the worker
  sandbox.

These were predictable execution-environment questions. A Mission preflight
could have surfaced them before contract approval and frozen the answers into
verification policy.

### 3. Managed-worker restrictions repeatedly generated follow-up work

Several children encountered the same class of boundary:

- no usable PostgreSQL inside the managed worker;
- no access from the worker to the host PostgreSQL socket;
- denied `127.0.0.1:0` listener binding; and
- no native Windows runtime.

The workflow preserved those failures honestly, which is good, but it repeatedly
treated each one as a fresh child-level evidence gap. Host runs later satisfied
the relevant criteria. This added Assignments `00009`, `00010`, `00012`, and
`00014`, plus successor `00015`, around a smaller number of underlying
environment capabilities.

There should be a reusable Mission-level execution-capability declaration so
the controller can route authorized checks directly to a suitable executor or
classify them as accepted residual evidence gaps without rediscovering the same
sandbox limitation in multiple children.

### 4. Follow-up signals were sticky and semantically ambiguous

The gap sourced from child `00004` propagated through `00009` and `00012`.
Assignment `00009`'s outcome said "No follow-up Assignment is required," while
the Mission ledger still recorded `child:00009:follow-up`. The final Mission
review also noted that contradiction.

This suggests that a follow-up signal is too loosely coupled to the acceptance
criterion it is meant to close. A later successful child should be able to
supersede an earlier signal explicitly. Otherwise, the controller can continue
opening resolver work after the durable outcome says the gap is closed.

### 5. The terminal boundary was too eager and too irreversible

Immutability after a genuine semantic failure is a strength. The problem was
the lack of a pre-terminal recovery state for a reviewer finding that can be
resolved by correcting an interpreter or collecting authorized evidence.

The Mission went from convergence to terminal failure even though:

- the reviewer identified no remaining blocking Oceanpower defect;
- the intended interpreter was available;
- the suite took only a few seconds once run in that interpreter; and
- the user was available to authorize the host execution.

A state such as `verification_blocked` or `needs_evidence_recovery` should have
kept the Mission non-terminal while preserving the failed attempt. Terminal
`semantic-failure` should be reserved for a demonstrated contract failure,
exhausted product repair, or an explicit user decision to stop.

### 6. The product candidate remained dirty and substantially untracked too long

The convergence reviewer found that most of the new Oceanpower implementation,
migrations, and tests were still untracked. The candidate was complete in the
working tree, but a crash or operator mistake before the Mission checkpoint
could have lost a large amount of integrated work.

Mission children may intentionally share a working tree, but successful child
integration should still create a recoverable checkpoint promptly. Reviews
should inspect a named revision plus a narrowly declared dirty delta, not an
entire Mission delivery that exists primarily as untracked files.

### 7. Recovery required too much lifecycle expertise

After terminal failure, the correct recovery required understanding that:

- the Mission status must remain failed;
- post-terminal verification cannot rehabilitate it;
- the dirty candidate must be preserved;
- a successor Assignment can inherit the handoff;
- its contract must describe superseding evidence without rewriting history;
  and
- only then can the final delivery commit be produced.

The durable model supports this, but the operator had to reason about it
manually. A guided command could have proposed the successor and populated the
handoff from the failed Mission automatically.

### 8. Review profiles and verification environments were not one coherent policy

The user selected a high-effort Claude review profile, but model choice,
execution sandbox, test interpreter, host-service access, and platform coverage
were configured or discovered through separate mechanisms. From the user's
perspective these are all parts of "how this Mission will be reviewed."

SpecDev would be easier to reason about if contract approval showed one review
and evidence policy containing both the reviewer profile and the executors on
which required evidence may run.

## Recommended improvements

### Priority 1: Mission environment preflight before approval

Add a deterministic preflight that resolves and records:

- the absolute Python/Node/tool executable for every verification command;
- runtime version and import availability;
- required services such as PostgreSQL and Redis;
- loopback/network/socket capability;
- native platform requirements;
- whether host fallback is allowed;
- authorized environment variables or secret names, without storing values;
  and
- which criteria may be bypassed and how the residual risk must be reported.

For this Mission, preflight should have turned `python3 -m pytest -q` into the
absolute supported-venv command before approval and identified Windows as
unavailable before automatic execution began.

### Priority 2: distinguish product failure from evidence-infrastructure failure

Introduce typed convergence dispositions such as:

```text
needs_product_change
needs_evidence
executor_unavailable
user_decision_required
contract_unsatisfiable
objective_failure
```

Only the last two should normally be eligible for immediate semantic-failure
terminalization. An unavailable or incorrectly selected executor should retain
the reviewer finding and route to evidence recovery.

### Priority 3: add a pre-terminal evidence-recovery state

Before terminal failure, allow one bounded recovery action when:

- no product defect is alleged;
- the failed criterion names a verification or executor problem;
- an approved alternate executor is available; and
- the command and candidate revision remain identical.

The original failure must remain in the receipts. A passing superseding receipt
can then return the same Mission to convergence without rewriting history.

### Priority 4: make executor capabilities first-class and reusable

Represent executor capabilities explicitly, for example:

```yaml
executors:
  managed-worker:
    loopback_bind: false
    postgres: false
    platforms: [macos-arm64]
  authorized-host:
    loopback_bind: true
    postgres: true
    platforms: [macos-arm64]
  windows-native:
    available: false
```

Child planning can then avoid assigning impossible evidence to the managed
worker and avoid generating multiple follow-ups for the same known limitation.

### Priority 5: type follow-up findings by acceptance criterion and supersession

A follow-up signal should include:

- originating acceptance criterion;
- finding type;
- required evidence or repair;
- responsible resolver;
- supersedes/superseded-by relationship; and
- explicit closure authority.

If a resolver outcome says no follow-up remains and proves the same criterion,
the controller should either close the signal or report the contradiction
immediately, rather than carrying both meanings into later convergence.

### Priority 6: checkpoint successful child integration automatically

After each integrated Mission child or bounded wave, create a recoverable
Mission checkpoint containing all product and workflow files owned by that
integration. At minimum, refuse to begin convergence while substantial
untracked Mission-owned product remains outside a checkpoint.

This is about recoverability, not forcing every child to create an independent
final delivery commit.

### Priority 7: provide guided successor recovery

Offer a command similar to:

```text
specdev mission handoff M00001 --successor-assignment
```

It could:

1. preserve the terminal Mission unchanged;
2. snapshot the exact candidate revision and dirty/untracked paths;
3. inherit unresolved criteria and retained receipts;
4. classify which evidence may be superseded;
5. draft the smallest successor contract; and
6. explain why a successor is required.

This would make the escape hatch safe without requiring the operator to know
the entire lifecycle implementation.

### Priority 8: show one consolidated execution policy at approval

The approval preview should include a compact table covering:

- author and reviewer provider/model/effort;
- automatic versus interactive behavior;
- exact verification executables;
- managed versus host executor authority;
- required external services;
- platform matrix; and
- pre-authorized bypasses or escalation points.

This would make "proceed" bind not only the product contract but also the
practical conditions under which automatic execution can finish.

## Suggested regression scenarios

1. A Mission verifier selects an interpreter without dependencies while an
   approved supported interpreter exists. Verify that the Mission routes to
   evidence recovery and does not terminally fail.
2. A managed executor denies loopback binding and an authorized host executor
   is declared. Verify automatic rerouting with both receipts preserved.
3. A required native platform is unavailable and preflight marks it as a
   user-approved bypass. Verify no impossible child is launched and the final
   outcome retains the risk.
4. A child emits a follow-up, a resolver closes the same acceptance criterion,
   and its outcome says no follow-up remains. Verify the original signal is
   superseded rather than propagated.
5. A Mission reaches convergence with untracked Mission-owned product files.
   Verify it checkpoints them or refuses convergence with a recoverability
   action.
6. A genuine product defect survives bounded repair. Verify that
   `objective_failure` still produces an immutable terminal failure.
7. An evidence-only terminal failure is handed to a successor Assignment.
   Verify the generated contract preserves provenance and can deliver without
   manually reconstructing the candidate.

## Overall assessment

I felt meaningful drag, but mostly at the boundary between the lifecycle model
and the execution environment—not in contract authoring or independent review.
The Mission's strictness added real value when it found the missing production
vertical slice and when it kept Windows and skip coverage honest. The avoidable
cost came from treating executor limitations as new product gaps, allowing
ambiguous follow-up signals to propagate, and terminalizing before a cheap,
authorized evidence correction could run.

The highest-value improvement is to make environment capability and evidence
routing first-class before automatic execution starts. That would retain
SpecDev's strongest property—evidence-backed convergence—while removing much
of the recovery ceremony observed in Oceanpower.
