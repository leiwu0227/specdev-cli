# Mission blocked child and successor adoption gap

**Date:** 2026-08-11  
**Observed in:** Fireplace Mission `M00008`, child Assignments `00168` and `00169`  
**Installed SpecDev:** `0.0.4`  
**Status:** theoretical design note; no implementation is currently planned

## Summary

A Mission can become permanently stuck when an evidence-only child correctly
executes an authorized verification command, records a real product failure,
and therefore cannot satisfy a pass-oriented Assignment acceptance criterion.
The child is classified as implementation-blocked even though it successfully
performed the evidence-collection work the Mission needed. Because the Mission
controller remains positioned inside that child lifecycle, it cannot return to
gap resolution and create the product-repair child.

If the repair is then delivered through a separately approved standalone
Assignment, current SpecDev has no supported transition for adopting that
delivery and its passing evidence back into the blocked Mission. The product can
be repaired, reviewed, and fully verified while the Mission remains durably
blocked on an immutable historical child.

The workflow needs two complementary changes:

1. Evidence-only Mission children need a successful terminal result that means
   “the authorized observation was completed and it requires follow-up,” rather
   than treating every non-passing observation as failed implementation.
2. Existing incidents need an explicit, fail-closed recovery command that can
   adopt a completed reviewed successor Assignment, link its evidence as
   superseding the blocked child, and resume the Mission without rewriting
   history or rerunning already-authoritative verification.

## Fireplace incident

Fireplace Mission `M00008` had already integrated its architecture-refactor
children and reached final integrated verification. The first full gate failed,
a focused repair child was delivered, and child `00168` was then created to run
the authorized clean `pnpm verify` gate once on a loopback-capable host.

Assignment `00168` had deliberately narrow authority:

- run the one authorized gate;
- record its result truthfully;
- do not repair product code; and
- do not rerun a failed gate.

The gate ran and exposed an intermittent browser rendering defect. Twenty of
twenty-one browser cases passed; the waiting-status scenario observed three
blank DOM tail samples. The command correctly exited nonzero and the durable
receipt classified the result as requiring a product change.

This was useful evidence, not failed execution. However, because the
Assignment's acceptance state required the gate to pass, its worker result was
`blocked`. The Mission lifecycle stayed nested inside child `00168`. Re-running
the Mission only re-entered the same immutable child, whose contract still
forbade product repair and a second gate.

The user then explicitly authorized standalone Assignment `00169`. That
Assignment:

- diagnosed the exact fallback-timer race in the live-frame scheduler;
- delivered the smallest product repair and deterministic regression coverage;
- passed the exact browser scenario three consecutive times;
- spent one clean post-repair `pnpm verify` gate, with all ten stages passing,
  including 21/21 browser cases and real iPhone/iPad simulator smoke;
- passed required Claude Opus implementation review without divergence; and
- created delivery commit `8f63469e7434cd705b9f44b48885f4031492de8e`.

Despite this, `M00008` remained blocked on child `00168`. SpecDev `0.0.4` had no
public command to associate `00169` with the open Mission gap or to move the
nested graph past the historical child.

## Why the current state is wrong

Three distinct facts are being collapsed into one `blocked` status:

1. **Execution completion:** Did the child perform the authorized action?
2. **Observed outcome:** Did the command pass, fail, or reveal a new defect?
3. **Mission convergence:** Does the parent Mission need another repair or
   evidence step?

For an ordinary product Assignment, failing acceptance correctly prevents
delivery. For an evidence-only Mission child, a nonzero command may be the
successful output of the child: it established the truth needed for the parent
controller to decide what comes next. Treating that observation as failed child
execution prevents the Mission from using the evidence it requested.

The resulting durable state is misleading:

- the historical failed gate is valid and should remain immutable;
- the defect is subsequently repaired;
- the successor's review and acceptance evidence are complete;
- the current candidate passes the Mission's exact final command; but
- the Mission reports only `Child 00168 implementation blocked` and cannot land.

This is an orchestration transition gap, not a remaining Fireplace product
failure.

## Prevention: complete evidence children with follow-up

Mission-authored evidence children should be able to return a structured result
such as:

```yaml
status: completed_with_follow_up
execution: completed
acceptance: blocked
disposition: needs_product_change
evidence: .specdev/assignments/00168_.../outcome.md
```

This result must not mean that failed acceptance was silently waived. It means
only that the child fulfilled an explicitly evidence-only contract by executing
the authorized observation and recording the negative result completely.

The Mission controller should then:

1. preserve the child contract, receipts, review state, and outcome unchanged;
2. mark the queue entry as `completed` with `follow_up: required`, or introduce
   an equally explicit `observed` terminal queue state;
3. leave the failed acceptance criteria visibly blocked in the child outcome;
4. return from the nested Assignment graph to the Mission controller;
5. record or advance a Mission gap using the child's disposition and evidence;
6. create the next bounded repair child inside the Mission's approved authority;
   and
7. require a fresh final verification receipt after the repair.

This behavior should be available only when the child contract is explicitly
classified as evidence-only or verification-only. A product implementation
child must not use it to convert genuine incomplete work into Mission progress.

### Contract guidance

Generated evidence-child contracts should distinguish the action from the
desired eventual Mission result. For example:

- Child acceptance: “Run exactly one clean `pnpm verify` and record its complete
  result and provenance.”
- Mission acceptance: “The final integrated `pnpm verify` passes.”

The first can pass as an evidence-collection contract even when the command
fails. The second remains open and drives the next repair. This avoids encoding
“the observation must be positive” into the child that exists to discover
whether it is positive.

## Recovery: adopt a completed successor Assignment

Already-stuck Missions need a separate recovery path. A possible interface is:

```sh
specdev mission adopt-successor M00008 --assignment=00169
```

The first invocation should be a read-only planning pass. It should print the
Mission, blocked child, open gap, successor identity, candidate identity,
evidence to be linked, excluded dirt, and exact transitions. A second invocation
with an explicit semantic confirmation such as `--snapshot=owned` should apply
that exact plan. Any changed identity must invalidate confirmation.

### Required validation

Adoption should fail closed unless all of the following hold:

- The Mission is active but blocked inside a Mission-owned child.
- The child is durably blocked, and its evidence is complete enough to explain
  why it could not finish normally.
- The proposed successor is a terminal standalone Assignment with an approved
  implementation review and complete delivery receipt.
- Its approved contract explicitly references the blocked finding, child,
  Mission, or a durable handoff artifact. For older incidents without that
  provenance, explicit user authorization must be recorded during adoption.
- The successor's changed project paths and delivery revision are attributable
  to the current Mission candidate. The delivery commit must be the current
  candidate or an unambiguous descendant of the Mission checkpoint.
- The successor contains authoritative acceptance evidence for the exact
  Mission verification command. Command, candidate revision/digest, environment
  policy, status, and cleanup provenance must match; descriptive similarity is
  insufficient.
- No new bypass, relaxed assertion, changed contract, secret, executor
  permission, or product scope is inherited implicitly.
- Unrelated dirty paths are excluded and preserved.

The command should reject an unreviewed Assignment, a different candidate, a
different command, a passing test against pre-repair code, missing provenance,
or a successor that broadens the Mission's authority.

### Durable transition

Adoption must not edit child `00168` to pretend its gate passed. Instead, it
should append a new immutable relationship:

```text
00168 failed observation
  -> superseded for convergence by Assignment 00169
  -> authoritative verification receipt from 00169
  -> M00008 gap evidence-closed
```

The durable record should include:

- predecessor Mission and child IDs;
- successor Assignment ID and delivery commit;
- source and successor contract hashes;
- reviewed candidate digest;
- paths and hashes of the successor verdict, candidate receipt, progress, and
  outcome;
- the historical receipt being superseded;
- the new authoritative receipt or a content-addressed reference to it;
- the explicit operator authorization; and
- the graph package identities before and after recovery.

The old receipt remains in history with its original `failed` status. The new
receipt should carry `supersedes: verification-002` or equivalent provenance.
Mission summaries should show both attempts and explain why the later one is
authoritative for the repaired candidate.

### Graph recovery

The difficult part is not copying a receipt; it is safely leaving the nested
blocked child graph. The command needs a first-class RippleGraph transition,
not manual edits to `.ripplegraph/` or queue YAML.

A recovery transaction should:

1. validate and freeze the adoption plan;
2. write an ignored crash-recovery journal;
3. record the blocked child as historically superseded without deleting it;
4. close or supersede the associated Mission gap with Assignment `00169` as
   closure authority;
5. append the successor verification receipt reference;
6. transition the nested Assignment lifecycle back to the owning Mission node;
7. replay the already-durable final-verification success into the Mission graph;
8. create the normal Mission completion checkpoint; and
9. compact runtime only after all durable state agrees.

Every write boundary must be idempotently recoverable. Re-running the command
after interruption must either finish the same plan or stop because an identity
changed; it must not append duplicate receipts, transitions, or completion
commits.

## Relationship to Mission handoff

Current `specdev mission handoff --successor-assignment` is not sufficient for
this case. It requires a terminal failed Mission and accepts only evidence-only
failure classifications. Fireplace's Mission was still active-but-blocked, and
the successor contained a real product repair. Forcing the Mission into terminal
failure merely to use handoff would discard useful convergence state and still
would not provide a way to adopt the already-completed Assignment.

The two commands should have separate purposes:

- `mission handoff`: end a terminal Mission and create a fresh approval boundary
  for unresolved future work.
- `mission adopt-successor`: recover an active blocked Mission by attaching an
  already-approved successor whose authority and evidence can be proven to
  satisfy the existing Mission.

Adoption should be exceptional recovery, not the normal path. The
`completed_with_follow_up` prevention change should keep future repair work
inside the Mission automatically.

## Acceptance scenarios

The eventual implementation should cover at least:

1. An evidence-only child runs the exact command, records exit 1 and complete
   provenance, returns `completed_with_follow_up`, and causes the Mission to
   create a repair child without rewriting the failed receipt.
2. An ordinary implementation child with failed acceptance cannot use the
   evidence-only terminal result.
3. A repair child passes review and final verification, closes the original
   Mission gap, and completes the Mission normally.
4. A fixture reproducing Fireplace `M00008` adopts a terminal approved
   successor and completes without launching another provider or test command.
5. Adoption preserves the historical child failure and links the successor as
   explicit superseding authority.
6. Candidate, command, contract-hash, review, or receipt mismatch rejects
   adoption without mutating tracked state.
7. Unrelated dirty paths remain untouched and are reported in the planning
   pass.
8. Interruption after every recovery write boundary resumes idempotently.
9. Repeating a completed adoption returns the existing result and creates no
   duplicate transition or commit.
10. A genuine objective or authority failure cannot be converted to completion
    through successor adoption.
11. A successor that changed browser assertions, used a bypass, or ran a
    filtered substitute for the Mission command is rejected.
12. Mission status and outcome show the failed historical receipt, superseding
    Assignment, passing current receipt, and final completion checkpoint
    coherently.

## Recommended implementation boundary

This appears suitable for one focused SpecDev Assignment rather than a Mission:
the objective is one coherent lifecycle capability with two tightly related
entry paths, shared validation, and one crash-safe transition model. Expected
source areas include Mission controller result handling, Mission/Assignment
artifact validation, RippleGraph lifecycle schemas, durable recovery journaling,
CLI dispatch/help, generated workflow guidance, and command-level recovery
tests.

If the prevention and historical-adoption portions prove too large for one
reviewable contract, split them sequentially: first make future evidence-only
children return control correctly, then add the explicit adoption command using
those same terminal and provenance semantics.

## Design principle

A verification child succeeds when it establishes trustworthy evidence, not
only when the system under test passes. Negative evidence must remain negative,
but it should return control to the Mission that requested it. When a reviewed
repair is delivered through a fresh approval boundary, SpecDev should be able to
adopt it only through a narrow, explicit, content-addressed, crash-safe
transition—never by rewriting history and never by pretending the earlier gate
passed.
