# Review overhead on small and medium assignments

## Context

OceanLive CLI assignment `00092_feature_unified-data-readiness-rules` was a
moderately scoped change: replace two readiness-exception mechanisms with one
JSON rule file, route live-day and MockCopy through a shared classifier, update
guidance, and include the policy in Git checkpoints.

The completed goal consumed approximately 73 minutes and 1.10 million tokens.
The four implementation tasks themselves took about 30 minutes. The remaining
time and most token usage came from SpecDev review, repeated context loading,
verification, and completion ceremony.

This was not a case where review had no value. Implementation review found three
real defects:

1. Previously tracked legacy readiness files could survive into a new checkpoint.
2. Unsupported external row statuses could be incorrectly suppressed.
3. An expired high-precedence rule could fall through to a broader rule.

All three were worth fixing. The issue is that finding and confirming them used
a process sized more like a high-risk architectural change than this assignment.

## Sources of drag

### Repeated whole-assignment review

There were three brainstorm review rounds and three implementation review
rounds, in addition to task-level static reviews. Every implementation round
reread the design, plan, full change surface, tests, workflow graphs, guidance,
and relevant upstream backend code.

The three final implementation reviewers alone consumed roughly 462,000 tokens.
Round 2 and Round 3 primarily needed to validate narrow corrections, but still
performed broad static audits.

### Overlapping review layers

Task-level review and phase-level implementation review covered much of the same
code. Both are useful independently, but running both by default creates
duplicate inspection without a clear escalation rule.

### Verification repetition

Targeted tests correctly ran after each fix. The complete unit and integration
lanes were then rerun after multiple review rounds. The suites were fast in this
repository, so wall-clock cost was small, but the workflow still required
repeated orchestration, evidence capture, checkpoints, and commits.

### Completion ceremony

After approval, additional time went into post-review simplification checks,
`specdev next`, status checks, a validation checklist, assignment artifact
selection, transient-log cleanup, and a final documentation commit. These steps
are individually reasonable, but their combined cost is noticeable on a narrow
assignment.

### Review configuration was not risk-adjusted

The automated reviewer used high reasoning effort and a broad review prompt for
every round. SpecDev did not distinguish between:

- initial full review;
- focused verification of previously reported findings; and
- a new full audit justified by a large or high-risk correction.

## Suggested direction

### Introduce review profiles

SpecDev should select or offer a review profile based on assignment risk and
change size:

| Profile | Suggested process |
|---|---|
| Narrow | One design check, one implementation review, focused rereview only if needed |
| Standard | One design review, task verification, one implementation review, focused rereview |
| Deep | Task reviews plus full phase reviews and complete rereview rounds |

Security-sensitive Git operations, persistence formats, and destructive
workflows can explicitly opt into `deep`. Ordinary local refactors and isolated
behavior changes should not inherit that cost automatically.

### Make rereviews incremental by default

After a `needs-changes` verdict, the next reviewer should receive:

- the prior finding IDs;
- the implementation changelog;
- the commits or diff since the prior review; and
- the original surrounding code needed to validate those fixes.

The prompt should ask for a focused disposition first. A whole-assignment audit
should happen only when the fix materially expands scope, changes architecture,
or the reviewer identifies evidence of a broader issue.

### Avoid duplicated review layers

Use task-level reviews or a phase-level review as the default, not both. A
reasonable standard flow is:

1. Review the design once.
2. Implement related tasks with targeted tests.
3. Review the integrated implementation once.
4. Apply findings and perform a focused rereview.
5. Run the complete verification lanes once at the end.

Task-level external review should be reserved for independently risky tasks or
used instead of the broad phase review.

### Track process cost

SpecDev should record wall time and reviewer token usage per phase and round.
The completion summary could show implementation time versus review and workflow
overhead. This would make disproportionate assignments visible and allow review
profiles to be tuned from evidence rather than intuition.

### Consolidate completion evidence

The final checkpoint or approval command could generate the validation evidence
record from commands already run, review verdicts, progress state, and commit
metadata. This would reduce manual checklist work without weakening the evidence
requirement.

## Expected outcome

For an assignment of this size, the target should be approximately 30-40 minutes:
one design review, one integrated implementation review, one focused correction
pass, and one final full verification. This retains the review behavior that
found the three real bugs while removing repeated whole-repository rereads and
duplicated ceremony.
