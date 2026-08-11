# Implementation plan

**Implementation Guides:** []
**Review Guides:** []

## Tasks

1. **T-1 — Clarify authoritative ownership and lane-selection guidance (AC-1).** Update the workflow template, concise workflow reference, generated platform-adapter wording, and generated Adhoc skill so an explicitly requested cross-repository coordination or handoff note is treated as an auxiliary write rather than an implicit lane selection in the active repository. State the complementary boundary: honor destination instructions, and re-anchor and classify actual destination-repository product, runtime, workflow, or explicitly governed work there.
2. **T-2 — Add focused installed-output regression coverage (AC-2).** Extend the initialization regression test to assert the explicit-lane and repository-ownership boundary in the installed workflow, every supported platform adapter, and every installed Adhoc skill root while retaining the existing Adhoc ownership and exact-transaction assertions.
3. **T-3 — Verify and record delivery evidence (AC-1, AC-2).** Perform narrow static inspection immediately; request repository-required confirmation before executing the focused initialization regression test. Record authoritative evidence when authorized, otherwise record the test as skipped without claiming AC-2 completion.
