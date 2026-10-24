# Outcome

## Delivered behavior

Single-child Missions declare explicit child and controller acceptance ownership.
New generated children retain parent behavior and scope, but do not require later
controller evidence. Already-approved contracts without the new declaration keep
their original full-scope derivation; confirmed recovery can separate that boundary. Parent review and final integrated verification remain required.

The mission verification-boundary command previews and confirms recovery of an
approved full-scope child. It preserves both contracts and records a lifecycle
side-channel decision. Explicitly selected receipts are validated against command,
scope, revision, ownership, supersession, and the frozen candidate. Original receipt
roles remain unchanged. Candidate changes invalidate derived acceptance authority.
Historical blocked evidence and review files remain available. Fresh review uses the
confirmed child boundary; blocked controller evidence remains pending in the parent.
Interrupted recovery can resume safely, and exact retries remain idempotent after
terminal runtime cleanup.

## Deviations

None. The review-loop regression fixture needed an initial Git commit and empty
owned_paths declarations to satisfy existing production invariants. The engine integration fixture now declares explicit verification ownership; its
command was not run because only the three listed commands were authorized. Legacy
compatibility fixtures remain unchanged. The authorized recovery regression now
starts from an already-approved parent without a declaration and covers its full
resume and recovery path.

## Unresolved risks

No known blocking risk in the approved scope. Recovery is deliberately limited to
single full-scope children at review or repair. Evidence sufficiency remains subject
to the explicit user confirmation and independent reviewer. The affected Oceanshed
repository was read-only; no recovery, installation, or publication was performed.

| Acceptance | Evidence | Result |
| --- | --- | --- |
| AC-1 | Explicit ownership generation and receipt regressions; Mission environment and review-loop mode checks passed. | Passed |
| AC-2 | Recovery regression covers preview, immutable contracts, stale confirmation, wrong child, material mapping edits, live attempts, changed candidates, retained history, interrupted retry, and terminal idempotence. | Passed |
| AC-3 | Isolated blocked-child fixture completes after fresh review and passing final verification; missing or failed final evidence cannot complete. Qualification-only evidence alone remains insufficient. | Passed |
