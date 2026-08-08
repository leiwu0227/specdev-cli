# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Add an evidence-preserving terminal unsupported outcome for standalone Assignments, with explicit owned-state snapshot authority, immutable closure provenance, one durable terminal commit, safe runtime compaction, active-focus clearing, concurrent-workflow dirt reporting, and fresh-successor guidance

The authoritative live-test context is `.specdev/project_notes/thoughts/2026-08-08_dataportal-unsupported-assignment-shelf-and-adhoc-pivot-drag.md`. The target case is a successful investigation proving that a requested provider capability is unavailable, not a delivered change, temporary pause, product failure, or discarded effort.

## Scope and non-goals

- In scope: a standalone Assignment `unsupported` terminal disposition; evidence and authority validation; semantic owned-state snapshot confirmation with stale-plan protection; exact one-commit closure; immutable closure artifacts and provenance; idempotent recovery and runtime compaction; focus/status/next behavior; concurrent-workflow dirt reporting; and fresh-successor creation from the terminal result.
- Non-goals: automatically deciding that a capability is unsupported; adding a general lane-pivot command; checkpointing or closing Discussions/Test Audits; adopting concurrent-workflow paths; reopening the terminal Assignment; changing Mission-child outcomes; introducing other terminal dispositions such as `infeasible` or `no-change-required`; or replacing the existing shelf flow for genuinely resumable work.

## Expected behavior

An explicit command closes an eligible standalone Assignment as `unsupported` only after the user supplies a concrete reason and SpecDev can preserve written investigation evidence. Before mutation, it presents a semantic snapshot plan that identifies the exact Assignment-owned paths, current HEAD, evidence sources, paths excluded because another workflow owns them, and the resulting terminal action. Dirty owned state requires an explicit `snapshot=owned` decision; an internal token or digest prevents confirmation after the plan changes without making the token the user-facing decision.

Confirmed closure records the approved contract identity, reason, evidence references, source lifecycle state, owned path manifest, repository boundary, timestamp, and terminal disposition in a canonical artifact and status record. It commits that artifact and all authorized Assignment-owned state as one user-visible terminal commit while leaving concurrent callable and unrelated paths untouched. Partial snapshots, changed HEAD, changed path manifests, live/ambiguous Attempts, or commit-set mismatches fail closed with exact recovery guidance.

As the final prepared mutation before staging, SpecDev safely compacts only the Assignment's runtime and clears active focus. Those tracked removals and pointer updates are included in the same exact terminal commit as the closure artifact and status. An ignored transaction journal records enough pre-commit authority and prepared-state identity to recover deterministically if publication is interrupted. After the commit is published, SpecDev verifies the committed terminal state, reports the focused scheduler as idle while showing the closed Assignment as history, lists remaining dirt by owner, and offers fresh-lane commands. A successor created from the unsupported Assignment receives historical investigation context and provenance but a new identity, contract, approval, evidence, and delivery boundary; the closed source remains immutable.

## Important decisions

- `unsupported` means the requested behavior cannot be supplied under the verified external/provider contract or approved constraints. It is a successful evidence-bearing terminal conclusion, not `completed`, `failed`, `cancelled`, `abandoned`, `blocked`, or `shelved`.
- Closure authority is always explicit and reserved to the user. SpecDev validates evidence and state but never infers unsupported status from skipped tests, provider errors, reviewer prose, or a blocked worker alone.
- A canonical closure artifact is the durable source of reason and evidence provenance. Evidence may reference bounded existing Assignment artifacts or explicitly supplied repository evidence, but must be present and attributable to the closing candidate.
- `--snapshot=owned` (or equivalent semantic confirmation) authorizes exactly the displayed Assignment-owned path manifest. A digest/token remains an internal time-of-check/time-of-use guard and is regenerated with a changed plan.
- Successful dirty closure prepares closure state, compacts owned runtime, and clears focus before exact staging, so every tracked effect is captured in one terminal commit rather than a snapshot commit followed by a terminal commit. Ignored transaction state may survive an interruption but is never a second user-visible commit.
- Concurrent callable, unrelated product, and other workflow-owned paths are never included in the closure commit. They are reported with owner and safe next actions.
- Fresh successor promotion may reuse the existing `--from-assignment` surface, but unsupported provenance is comparison context only and grants no restored authority.

## Constraints and invariants

- Only standalone, nonterminal Assignments with a matching durable lifecycle/run identity are eligible. Mission children and already terminal Assignments fail without mutation, except an exact idempotent retry of the same completed closure.
- Closure cannot proceed while an owned provider Attempt is live or its liveness is ambiguous, while HEAD differs from the confirmed plan, or while the authorized owned path set has changed.
- Exactly one verified terminal commit contains every authorized Assignment-owned path, the canonical closure/status artifacts, and all tracked runtime-compaction and focus-clearing effects; it contains no excluded path and has the pre-close HEAD as its parent.
- Runtime compaction and focus clearing occur only after the close plan is revalidated and durable ignored recovery state is prepared, but before the terminal tree is staged. The Assignment status, closure artifact, Git trailer/commit, RippleGraph terminal state, compacted runtime, and focus state must agree before the command reports success.
- A failed or interrupted close remains recoverable and never reports terminal success from partial durable state. Retry must converge on the same terminal commit or explain the exact inconsistent boundary.
- Closing unsupported preserves negative findings without claiming product delivery or acceptance-criterion passage. Receipts and status use distinct terminology.
- Existing shelf, cancellation, successful delivery, and concurrent-callable ownership semantics remain compatible.

## Delegated and reserved authority

- Delegated: choose the exact command spelling and flags, closure schema/version, supported evidence-reference forms, internal plan token/digest, temporary transaction mechanism, terminal commit trailers, compatibility treatment for interrupted legacy state, and human/JSON formatting, provided the observable behavior and invariants above hold.
- Reserved for the user: declare the Assignment unsupported; supply or select the closing reason and evidence; authorize the exact owned-state snapshot; resolve live or stale Attempts and concurrent-workflow dirt; choose the next lane or successor objective; and authorize tests as required by repository instructions.

## Risks and assumptions

- Negative evidence can become outdated if an external provider later adds capability. The terminal record therefore preserves observation context and time, while any reconsideration starts a fresh Assignment.
- Assignment-owned path classification and concurrent callable ownership may overlap or drift during closure. The operation must use exact manifests, revalidate immediately before commit, and fail closed on ambiguity.
- One-commit finalization requires crash-safe preparation outside visible Git history and compare-and-swap commit publication. Recovery must distinguish a created commit from an accepted terminal transition.
- Existing status and successor code assumes `completed`, `abandoned`, or `shelved`; every terminal-state consumer must either understand `unsupported` or reject it explicitly rather than silently treating it as another state.

## Verification authority

- Focused tests for changed modules: allowed after repository instructions are satisfied
- Full suite: requires explicit user approval unless already authorized here

## Acceptance criteria

- AC-1: An eligible standalone Assignment can request explicit `unsupported` closure only with a reason and attributable written evidence. Before mutation, human/JSON output presents the exact HEAD, Assignment-owned snapshot manifest, evidence sources, excluded paths with owners, and semantic confirmation; missing evidence, an ineligible lifecycle, live/ambiguous Attempts, or a stale confirmation plan refuses without changing Assignment, Git, runtime, or focus state.
- AC-2: Confirmed closure prepares durable recovery state, compacts only the closing Assignment runtime, clears its active focus, then atomically creates one terminal commit whose parent is the confirmed pre-close HEAD and whose path set contains every authorized Assignment-owned path, all tracked compaction/focus effects, and canonical unsupported closure/status artifacts, with no concurrent or unrelated path. The immutable status and artifact record the contract identity, reason, evidence provenance, prior lifecycle, repository boundary, and terminal disposition; partial staging, commit mismatch, or interruption cannot be reported as success and has a deterministic idempotent recovery path.
- AC-3: Successful or recovered closure verifies cross-artifact consistency across the committed terminal status, closure artifact, compacted runtime, and cleared focus; reports the focused scheduler idle; lists remaining dirt by owner with safe next actions; and supports creation of a fresh successor whose unsupported findings are historical context under a new contract and approval boundary while the source Assignment remains immutable.
