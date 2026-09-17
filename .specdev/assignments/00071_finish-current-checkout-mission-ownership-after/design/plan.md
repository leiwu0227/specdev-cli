# Plan

**Implementation Guides:** []
**Review Guides:** []

## Authority and evidence reuse

Continue the exact previously user-approved contract, SHA256
a9e8e3d7d48aad732ca03943ab51957df0c719f7215e72c092c8d2e6735115a1.
Assignment 00070 delivered the implementation at ddcd006fc810bffec9be048b9f9f510c88ecb29d.
Its outcome, focused verification receipts, and approved independent verdict are
at `.specdev/assignments/00070_run-missions-on-the-existing-checkout-without-au/`.
The predecessor is complete; this bounded correction retains that durable
history and does not widen authority or alter the approved contract bytes.

## Tasks

- T-1 (AC-2): Remove stale approval-time dirty-path protection from the child
  checkpoint boundary. The implementation-start adoption gate and exact byte
  manifest remain authoritative; dirty approval paths that were subsequently
  committed must not prohibit future authorized changes to those same files.
- T-2 (AC-1, AC-2, AC-3, AC-4): Exercise the production child checkpoint boundary after a
  separate user commit, preserving unrelated staged and unstaged bytes and
  changed-manifest rejection. Run the approved Mission checkout regression,
  reuse unaffected predecessor evidence, and obtain independent review.
