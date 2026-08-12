# Mission child user-reapproval has no resumable graph edge

**Date:** 2026-08-12  
**Observed in:** OceanQuant Mission M00020, child Assignment 00262  
**SpecDev version:** 0.0.4  
**Mission workflow:** `mission-lifecycle@1.4.0`  
**Severity:** critical; accepted and verified work cannot advance or terminate
cleanly  
**Status:** live-test handoff for SpecDev maintainers; this note makes no
SpecDev implementation change

## Executive summary

SpecDev has no executable lifecycle path for a Mission-owned Assignment whose
implementation review is substantively approved but carries
`user_reapproval_required: true`.

The review layer intentionally treats that result as unsafe for automatic
delivery. That is correct. The failure is that the Assignment is driven to its
`failed` node, while the parent Mission's `child-assignment` node has only this
edge:

```json
"edges": [{ "to": "advance-queue", "when": { "approved": true } }]
```

The nested Assignment therefore returns a non-approved result for which the
parent has no matching transition. The controller terminates with:

```text
node child-assignment has no matching edge
```

An explicit user approval in the surrounding session cannot be recorded or
consumed at this phase. `specdev mission run M00020` merely launches another
worker/reviewer cycle and reaches the same missing edge. The existing
`mission run --approve` handling applies to the initial `approve-mission` node;
there is no corresponding command or graph node for post-review divergence
approval.

This should be modeled as a first-class, resumable
`awaiting-user-reapproval` state. It must not become an Assignment semantic
failure, and a parent workflow must never throw because a nested workflow
returned a valid non-success disposition.

## Live reproduction

### Mission context

OceanQuant M00020 implemented the unified FX analytics and lifecycle surface
through four normal children and two convergence children:

- 00257: shared lifecycle documents, rates byte-equivalence, and vanilla;
- 00258: deliverable-forward and NDF analytics;
- 00259: digital analytics and lifecycle documents;
- 00260: one-touch analytics, integration, and manual update;
- 00261: convergence-receipt reconciliation; and
- 00262: supply the contract-pinned `test/instruments/fx` evidence path.

The Mission contract pinned this final command:

```sh
../oceanscript/venv-macos/bin/python -m pytest -q test/pricing test/pricers/rates test/pricers/fx test/instruments/fx
```

The original repository had no `test/instruments/fx` directory, so the first
Mission convergence review correctly refused to invent a passing integrated
receipt. The resolver created 00262 to supply substantive tests at the intended
path without changing product code.

Assignment 00262 then:

- added three deterministic tests that exercise the real FX preparation
  services for all five accepted FX signatures;
- passed its focused three-test command;
- made the exact unchanged integrated command executable; and
- recorded that the exact command passed all 235 tests.

The implementation reviewer found no code or acceptance defect. Its verdict
was explicitly:

```yaml
verdict: approved
material_divergence: true
scope_divergence: clarifying
procedure_divergence: disclosed
evidence_integrity: complete
user_reapproval_required: true
```

The three disclosed divergences were:

1. The controller, not a recorded user decision, selected the conservative
   resolution of adding the missing `test/instruments/fx` path.
2. The pinned `test/pricers/rates` argument still contains no substantive
   collected tests, although the accepted rates lifecycle coverage is already
   under `test/pricing`.
3. The child ran the Mission's exact integrated command once under an explicit
   child delegation, whereas the parent contract originally described that run
   as controller-owned.

These are legitimate facts for a user gate. None is a product-code defect.

### What happened next

`src/commands/reviewloop.js` computes:

```js
const unsafeTransition =
  reviewerResult.scope_divergence === 'material' ||
  reviewerResult.evidence_integrity !== 'complete' ||
  reviewerResult.user_reapproval_required === true
const verdict =
  unsafeTransition && reviewerResult.verdict === 'approved'
    ? 'blocked'
    : reviewerResult.verdict
```

That safely prevents automatic delivery, but the automatic review eventually
records an objective-failure disposition and moves the nested Assignment to
`failed`. The transition log shows the critical terminal step twice during
resume attempts:

```text
assignment-lifecycle implementation-review -> failed
```

The parent remains at Mission node `child-assignment`. In
`workflows/mission-lifecycle@1.4.0/graph.json`, that node accepts only
`approved: true`, so the valid nested non-success output has no edge. The
controller throws `node child-assignment has no matching edge` and marks the
Mission blocked.

After the user explicitly approved the disclosed divergences, resuming the
Mission launched more worker and Opus review Attempts, reused the same passing
receipts, and reached the same missing edge. There is no semantic command that
records approval of the exact reviewed candidate and lets the nested Assignment
complete.

At the second blocked status check, the run had accumulated roughly:

- 39 total Attempts;
- 37 provider Attempts;
- more than 1.6 million provider-reported tokens; and
- repeated worker/reviewer cycles over an unchanged candidate.

The substantive implementation and its 235-test verification were already
complete. Most of this later cost came from trying to express a user gate that
the graph cannot represent.

## Root cause

There are three connected state-model gaps.

### 1. Review safety is conflated with semantic failure

`user_reapproval_required: true` means “the candidate may be acceptable, but
automatic authority is insufficient.” It does not mean the candidate failed
its contract. Converting the review to `blocked` is reasonable as a delivery
guard, but driving the Assignment to `failed` loses the distinction between:

- acceptance failure;
- infrastructure failure;
- authority requiring a user decision; and
- an approved candidate awaiting explicit adoption.

The correct terminal-for-now state is an authority pause, not objective
failure.

### 2. The nested Assignment result vocabulary exceeds the parent edge set

The Mission graph assumes every nested Assignment reaching the parent is
`approved: true`. It has no edge for a child that is:

- awaiting user reapproval;
- blocked on authority;
- failed semantically;
- failed due to infrastructure; or
- completed with an explicitly accepted divergence.

Even if the child behavior were imperfect, the parent must route every valid
nested terminal disposition. “No matching edge” should be impossible for an
output that passed the nested workflow's schema.

### 3. Initial contract approval is the only first-class approval event

Mission `--approve` is implemented at the initial `approve-mission` node. A
later review can set `user_reapproval_required`, but there is no semantic
command or durable event containing:

- Mission and child identity;
- approved contract hash;
- reviewed candidate digest/revision;
- findings digest;
- exact disclosed divergences;
- approving actor and timestamp; and
- whether approval adopts the candidate or requests repair.

Consequently, a user's plain-language approval cannot be bound to the bytes and
findings that triggered the gate.

## Proposed lifecycle design

### Add a first-class authority-pause state

When a reviewer returns an otherwise approved candidate with
`user_reapproval_required: true`, produce a structured result such as:

```json
{
  "approved": false,
  "disposition": "awaiting-user-reapproval",
  "contract_hash": "...",
  "candidate_digest": "...",
  "findings_digest": "...",
  "evidence_integrity": "complete",
  "review_verdict": "approved"
}
```

The nested Assignment should pause at an `awaiting-user-reapproval` node. It
must not enter `repair`, arbitration, or `failed` merely because automatic
authority is insufficient.

The parent Mission should surface a compact gate:

```text
Mission M00020 is awaiting user reapproval for child 00262.
Contract: <path and hash>
Candidate: <revision/digest>
Review: <path and findings digest>
Divergences:
  - ...
  - ...
Approve unchanged candidate:
  specdev mission approve-divergence M00020 --child=00262 \
    --candidate=<digest>
Request repair:
  specdev mission reject-divergence M00020 --child=00262 \
    --reason="..."
```

The exact command names are less important than making the decision semantic,
hash-bound, and resumable. If command-surface minimization is preferred,
`specdev mission run M00020 --approve` could consume the pending divergence,
but only when it prints and binds the exact child/candidate/findings identity;
it must not silently reuse the initial Mission approval semantics.

### Record approval as a durable decision

An approval event should contain at least:

```json
{
  "decision": "approve-divergence",
  "mission": "M00020",
  "child": "00262",
  "contract_hash": "...",
  "candidate_digest": "...",
  "findings_digest": "...",
  "actor": "user",
  "approved_at": "..."
}
```

After that event, SpecDev should:

1. confirm the candidate and evidence identities are unchanged;
2. complete the child as `approved-with-user-reapproval`;
3. return a parent output with a matching explicit disposition;
4. integrate/checkpoint the child once;
5. continue to Mission convergence or final verification; and
6. never launch another provider Attempt solely to rediscover the accepted
   divergence.

If candidate bytes, receipts, contract hash, or findings change, the approval
must become stale and a new preview/decision is required.

### Make the parent graph exhaustive

The Mission `child-assignment` node needs explicit edges for all valid nested
terminal outputs. A possible shape is:

```json
"edges": [
  {
    "to": "advance-queue",
    "when": { "disposition": "approved" }
  },
  {
    "to": "advance-queue",
    "when": { "disposition": "approved-with-user-reapproval" }
  },
  {
    "to": "await-user-reapproval",
    "when": { "disposition": "awaiting-user-reapproval" }
  },
  {
    "to": "resolve-gap",
    "when": { "disposition": "semantic-failure" }
  },
  {
    "to": "blocked",
    "when": { "disposition": "authority-failure" }
  },
  {
    "to": "blocked",
    "when": { "disposition": "infrastructure-failure" }
  }
]
```

The exact names can follow the current SpecDev vocabulary, but every nested
schema-valid result must have a deterministic edge. Add a graph validation rule
or test that enumerates the nested terminal result union and proves parent edge
coverage.

## Recommended implementation boundary

Likely affected areas are:

- `src/commands/reviewloop.js`: preserve the difference between an unsafe
  automatic transition and an objectively failed candidate;
- `src/utils/assignment-delivery.js`: represent a complete reviewed candidate
  awaiting authority without calling its evidence incomplete;
- `src/commands/mission.js`: render and consume the post-review approval event;
- `workflows/assignment-lifecycle@*/graph.json`: add the resumable authority
  gate or terminal result;
- `workflows/mission-lifecycle@*/graph.json`: add exhaustive nested-result
  edges; and
- RippleGraph validation: detect parent nodes whose referenced workflow can
  return schema-valid outputs unmatched by every parent edge.

Avoid a special-case mutation of OceanQuant's checkpoint or a one-off edge for
M00020. This is a general composition rule for any nested workflow that can
require higher authority after review.

## Required regression tests

### Review classification

1. Reviewer returns `approved`, complete evidence, clarifying scope,
   disclosed procedure divergence, and `user_reapproval_required=true`.
2. SpecDev does not authorize delivery automatically.
3. SpecDev records `awaiting-user-reapproval`, not objective or semantic
   failure.
4. No repair or arbitration Attempt is launched solely because user approval
   is pending.

### Nested graph routing

1. A Mission-owned child returns each valid terminal disposition.
2. Every disposition has exactly one matching parent edge.
3. No case throws `node child-assignment has no matching edge`.
4. An actually failed child still routes to repair/gap handling and is not
   disguised as an approval gate.

### Approval and rejection

1. Approval binds Mission, child, contract hash, candidate digest, and findings
   digest.
2. Approval completes/integrates the unchanged candidate without another
   worker or reviewer call.
3. Repeating the same approval is idempotent.
4. Rejecting the divergence routes to a bounded repair or user-selected
   terminal disposition.
5. Changed source, receipt, contract, or findings invalidates the approval and
   prints a new preview.

### Resume behavior

1. Stop a Mission at `awaiting-user-reapproval` and restart the CLI.
2. `mission status` reports the exact pending decision and command.
3. The semantic approval command resumes from durable state.
4. Previously passed verification is reused when identities match.
5. Provider Attempts do not multiply on repeated status/resume calls.

### End-to-end reproduction

Build a fixture Mission whose child:

- passes all acceptance checks;
- receives an approved review with complete evidence;
- carries one disclosed material divergence requiring user approval; and
- is nested under `mission-lifecycle@1.4.0` or its successor.

Assert this sequence:

```text
run -> awaiting-user-reapproval
approve exact candidate -> child integrated
mission review/final verification -> normal next state
```

Also assert that no output contains `has no matching edge` and that the user
approval is visible in the durable transition log.

## Additional workflow improvement

The live run exposed a cost-amplification hazard: once the graph reached an
unrepresentable authority state, repeated `mission run` calls launched new
workers and Opus reviewers over an unchanged candidate. SpecDev should detect
that the candidate digest, findings digest, and pending authority decision are
unchanged and return the same gate immediately, with zero provider calls.

A useful invariant is:

> If no candidate, contract, evidence, or decision bytes changed, resuming an
> authority-paused workflow is a pure status operation until the user supplies
> a semantic decision.

That invariant would have prevented most of the 39 Attempts and more than
1.6 million provider-reported tokens consumed after OceanQuant's substantive
implementation was already complete.

## Current OceanQuant state

Do not infer an OceanQuant product defect from the blocked Mission state.

- The four product children and the documentation reconciliation child are
  integrated.
- Assignment 00262 added only deterministic tests under
  `test/instruments/fx`.
- The exact unchanged Mission command passed all 235 tests.
- The implementation reviewer reported no blocking product or acceptance
  finding.
- M00020 remains blocked solely because SpecDev cannot represent and consume
  the required user-reapproval transition.

After SpecDev is fixed, M00020 should resume from its durable candidate and
receipts. It should not rerun implementation or regenerate the accepted FX
analytics changes unless identity validation detects an actual change.
