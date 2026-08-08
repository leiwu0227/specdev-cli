# Assignment delivery receipt and live-progress drag

**Date:** 2026-08-08  
**Observed in:** OceanQuant Assignment 00210  
**SpecDev delivery:** `21744a60cd8af7d7fec79e03d737c4e906b093fe`  
**Severity:** high for contradictory terminal state; medium for execution
visibility and repeated live evidence  
**Status:** live-test feedback for SpecDev maintainers

## Context

OceanQuant Assignment 00210 was an evidence-only assignment to validate all ten
canonical public valuation routes against the populated experimental dataset.
The approved contract required real configured pricers, route-specific latest
complete dates, typed limitations, direct read-only data access, and no product,
dataset, or production-pointer changes.

The substantive result was excellent:

- 10 of 10 production routes passed;
- 45 of 45 declared operation cells passed;
- all readiness results were `ready`;
- no data limitation, functionality defect, or unclassified failure remained;
- 14 consumed data files and 1,163 mount-support files were unchanged; and
- implementation review approved all three acceptance criteria.

The workflow still exposed a high-priority delivery defect and two meaningful
sources of drag. The problem was not that SpecDev required a contract or an
independent review. Those gates were appropriate. The problem was that the
workflow could discover an incomplete delivery receipt only after committing
the assignment, print mutually inconsistent terminal conclusions, and then
require a second Adhoc commit to repair a Markdown heading.

## Executive summary

The highest-priority issue is the finalization order:

```text
implementation review: approved
Delivery receipt:
  Evidence: incomplete
  Unresolved risks: missing
  Evidence issues: unresolved_risks_missing
Next: Assignment complete.
```

The outcome did contain unresolved-risk analysis, but as an inline paragraph:

```markdown
Unresolved risks: none blocking. This is an operability smoke, not an
independent market-price accuracy study. ...
```

`summarizeRisks()` in `src/utils/assignment-delivery.js` recognizes only an
exact second-level heading:

```markdown
## Unresolved risks

None blocking. ...
```

Changing only that heading made the actual receipt builder return:

```json
{
  "completeness": "complete",
  "unresolved_risks": {
    "status": "present"
  },
  "issues": [],
  "worktree_clean": true
}
```

The correction required a separate OceanQuant Adhoc and commit
`564fff5015af90d1c3b4f45f51eaf0485e18c3c1` after the Assignment delivery.

Recommended order:

1. Build and validate the candidate delivery receipt before creating the final
   delivery commit or declaring completion.
2. Make the required outcome structure explicit and machine-validated before
   implementation review.
3. Never render `Next: Assignment complete` when receipt completeness is
   `incomplete`.
4. Surface semantic worker/reviewer milestones rather than only
   active/quiet/stale liveness.
5. Separate harness-development probes from the single authoritative live
   acceptance run.

## What worked well

### Exact contract approval remained useful

The hash-bound approval clearly authorized a read-only ten-route matrix and
reserved pricing fixes, data backfills, production changes, and the future
batch API. The approval step did not feel like the main source of drag.

### The worker retained failed attempts honestly

The worker ran the matrix four times while correcting assignment-local harness
defects. It retained all four sequences, including the first run's nine FX
limitations and both intermediate evidence errors. No product or data failure
was silently overwritten.

### Independent review added useful context

The reviewer verified the receipt invariants, preservation evidence, public API
boundary, and route selection. It also called out that the IRS case used HKDQ
instead of the checked-in historical-only USDQ catalog example. That was within
delegated authority but worth making visible.

### The final Adhoc recovery was bounded

Once the cause was understood, Adhoc was the right recovery mechanism. It made
one format-only change, checked the real receipt builder, created a small
receipt, and returned the worktree to clean state.

## Finding 1: an incomplete receipt can be committed and called complete

### Observed behavior

The implementation review approved the candidate and SpecDev immediately
created the Assignment delivery commit. Only afterward did the delivery receipt
report `unresolved_risks_missing` and `Evidence: incomplete`. The same terminal
output still said `Next: Assignment complete`.

This creates three contradictory sources of truth:

- lifecycle state says completed;
- review says approved; and
- delivery evidence says incomplete.

The user cannot tell whether the work is actually finished, whether another
repair loop is required, or whether the warning is merely cosmetic. In this
case it was a formatting omission, but the same ordering could conceal a more
important missing acceptance row, verification receipt, or review identity.

### Why review did not prevent it

The reviewer inspected the substantive outcome and correctly saw the inline
unresolved-risk paragraph. It did not receive a failing candidate delivery
receipt as a blocking input. The strict parser ran at delivery time, after the
review had already approved.

This is an orchestration gap rather than a reviewer-quality problem. Humans and
reviewers can understand the prose; the delivery parser has a narrower schema.
That schema must be checked before approval can transition to delivery.

### Proposed fix

Build a **candidate delivery receipt** before final review completion and before
the delivery commit. The implementation flow should be:

```text
worker artifacts complete
  -> artifact/schema preflight
  -> candidate receipt completeness == complete
  -> implementation review
  -> revalidate candidate receipt against reviewed bytes
  -> delivery commit
  -> final receipt
  -> completed
```

If preflight finds `unresolved_risks_missing`, it should return a repairable
artifact finding to the existing worker continuation without launching a new
broad implementation attempt. No delivery commit should exist yet.

If a receipt becomes incomplete after review because reviewed bytes changed,
the review identity should be invalidated and the normal repair/review path
should run. SpecDev should never print `Assignment complete` alongside
`Evidence: incomplete`.

Suggested terminal states:

```text
Evidence complete     -> Assignment complete
Evidence incomplete   -> Assignment awaiting artifact repair
Review missing/invalid -> Assignment awaiting review
```

## Finding 2: the Markdown contract is stricter than the worker-facing template

### Observed behavior

`summarizeRisks()` uses a regular expression that requires the exact heading
`## Unresolved risks`. The Assignment guide says that `outcome.md` maps
acceptance to evidence and final result, but it does not present a mandatory
outcome skeleton with this exact parser requirement. The generated Assignment
folder also did not contain a pre-populated outcome template.

The worker therefore produced semantically correct prose in a format the
delivery parser rejected. Many existing OceanQuant outcomes use the same inline
style, which suggests this is not an isolated worker mistake.

### Proposed fix

Use one or more of the following, in priority order:

1. Generate `outcome.md` from a strict template containing:

   ```markdown
   # Outcome

   ## Delivered behavior

   ## Deviations

   ## Unresolved risks

   | Acceptance | Evidence | Result |
   ```

2. Add `specdev assignment validate-artifacts <id>` and run it automatically
   before review and delivery.
3. Put the same exact headings in the worker prompt and Assignment guide.
4. For migration resilience, optionally accept a legacy line beginning
   `Unresolved risks:` and normalize it into the receipt. This should not replace
   strict validation for newly generated artifacts.
5. Longer term, store `unresolved_risks` in a small structured outcome record
   and render Markdown from it. A prose heading should not be the sole source of
   delivery completeness.

The parser should also distinguish `none` from `present but non-blocking`. In
Assignment 00210, the caveats were real and correctly became `status: present`
after the heading repair even though none blocked delivery.

## Finding 3: live progress was operationally opaque

### Observed behavior

The worker ran for 853 seconds and the reviewer for 207 seconds. Provider usage
was reported as 249,597 tokens. During most of that time the foreground only
received messages like:

```text
SpecDev Attempt-00660 progress: worker; 9m 30s elapsed;
process live_local; logs active; milestone none; fresh.
```

The liveness classification changed among `active`, `quiet`, and `stale`, but
`milestone` remained `none`. To understand whether the worker was designing,
editing, running the mounted matrix, or stuck, the foreground had to inspect the
ignored raw stderr log directly.

That log already contained useful semantic messages such as:

```text
Specdev: The FX limitation was caused by the harness omitting mounted effective-
construction metadata, not by missing data.
```

The information existed but was not promoted into normal progress output.

### Proposed fix

Capture the latest bounded `Specdev:` announcement or provider commentary as a
semantic milestone. Progress could render:

```text
worker 10m45s — active
phase: live-evidence repair
milestone: correcting mounted FX description adapter
last command: focused matrix dry run
last activity: 8s ago
```

At minimum, expose:

- current task ID from `design/plan.md` or `progress.json`;
- latest worker `Specdev:` announcement;
- whether a test/live command is running;
- last meaningful log timestamp;
- latest passed/failed verification count; and
- whether the workflow is waiting on an external process or provider response.

Do not dump raw chain-of-thought or unbounded logs. A single sanitized milestone
line is enough to distinguish legitimate long work from a stuck attempt.

## Finding 4: one authorized live run became four acceptance runs

### Observed behavior

The contract authorized one bounded mounted-data execution. The Assignment ran
the matrix four times:

1. 45 operation attempts with nine FX limitations because the harness omitted
   effective construction descriptions;
2. a pre-execution failure because OceanData normalized `DIRECT` to lowercase
   `direct`;
3. 45 successful operations followed by an evidence-only prepared-wrapper
   attribute error; and
4. the final 45-of-45 successful retained run.

All runs were read-only, preserved, and disclosed. The reviewer reasonably
approved the result but marked `material_divergence: true` because the evidence
procedure exceeded the contract.

The drag came from using the full acceptance matrix to debug the harness itself.
The first two defects could have been found by narrow adapter preflights, and the
third by generating the receipt from a small synthetic or already retained
successful result.

### Proposed fix

Distinguish **harness qualification** from the **authoritative acceptance run**:

1. Unit-test catalog drift, classification, and receipt rendering without live
   data.
2. Run one exact-date probe per market-data capability family: market-
   independent, FX description, rates curve, and bond future.
3. Validate the preservation and result-rendering paths on those probes.
4. Freeze the harness digest.
5. Run the full authoritative matrix once.

The contract can explicitly allow bounded harness-qualification probes while
still allowing only one authoritative matrix. This avoids forcing the reviewer
to call ordinary harness debugging a material contract divergence.

When an authoritative run fails for a genuine product or data reason, retain it
and stop as the contract requires. When qualification fails before the
authoritative run, repair the harness without consuming the acceptance-run
allowance.

## Finding 5: `material_divergence` needs a clearer user-facing taxonomy

The reviewer approved while setting `material_divergence: true`. That result was
defensible: four read-only runs exceeded the literal verification authority,
but did not change product behavior, hide evidence, or expand operational
authority. Still, `approved; divergence: material` is hard for a user to
interpret without reading the full verdict.

Consider separating:

- `scope_divergence`: changed product behavior or authority;
- `procedure_divergence`: evidence process differed from the contract;
- `evidence_integrity`: complete, preserved, or compromised; and
- `user_reapproval_required`: true or false.

Assignment 00210 would then be approximately:

```json
{
  "verdict": "approved",
  "scope_divergence": "none",
  "procedure_divergence": "material_disclosed",
  "evidence_integrity": "preserved",
  "user_reapproval_required": false
}
```

This conveys why approval and divergence are not contradictory.

## Suggested acceptance tests for the SpecDev CLI fix

### Receipt preflight

- A completed worker outcome with no `## Unresolved risks` heading fails before
  review or delivery commit with a repairable `unresolved_risks_missing`
  finding.
- No `SpecDev-Assignment` delivery commit exists while the candidate receipt is
  incomplete.
- After the heading is repaired, the same worker result is reused without a new
  provider attempt.

### Terminal consistency

- `Evidence: incomplete` is never accompanied by `Assignment complete`.
- A complete receipt produces one delivery commit and one unambiguous completed
  state.
- If backward-compatible inline parsing is implemented, both the legacy inline
  form and canonical heading form have explicit fixtures.

### Review ordering

- The reviewer receives the candidate receipt or its complete/incomplete
  summary.
- Review approval cannot transition to delivery when the candidate receipt is
  incomplete.
- Mutation of reviewed artifacts invalidates the review identity before commit.

### Progress visibility

- A worker `Specdev:` announcement appears as the next bounded progress
  milestone.
- Quiet/stale liveness does not erase the last semantic milestone.
- Progress output remains secret-safe and bounded.

### Acceptance-run accounting

- Harness-qualification probes and the authoritative live run are counted
  separately.
- The final receipt reports both counts and identifies which run supplies
  acceptance evidence.

## Expected outcome

For the same Assignment, the desired terminal path is:

```text
worker completes artifacts
candidate receipt preflight: complete
implementation review: approved
delivery commit created
final receipt: complete
Assignment complete
```

If the worker writes the wrong outcome shape, the desired path is instead:

```text
candidate receipt preflight: incomplete (unresolved_risks_missing)
focused artifact repair reuses current worker result
candidate receipt preflight: complete
review and delivery continue
```

This preserves SpecDev's strong contract and review model while removing an
avoidable post-delivery repair commit, contradictory completion messaging, and
long periods where the foreground cannot tell what the workflow is doing.
