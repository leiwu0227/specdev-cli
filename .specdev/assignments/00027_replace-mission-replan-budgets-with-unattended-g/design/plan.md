# Implementation plan

**Implementation Guides:** []
**Review Guides:** []

## Tasks

1. **T-1 — Add durable Mission gap state and queue lineage**
   - Acceptance: AC-1, AC-2, AC-3
   - Define stable source identities, gap deduplication, finite resolution stages,
     repair-descendant lineage, processed-signal tracking, and explicit semantic,
     authority, and infrastructure dispositions.
   - Preserve protected queue entries, existing pending IDs, and exact final
     verification authority while attaching newly generated repair children to
     their parent gap.

2. **T-2 — Replace reason-wide replan budgets in the Mission controller**
   - Acceptance: AC-1, AC-2
   - Translate child, wave, Mission-review, and final-verification recovery
     signals into durable gaps.
   - Run focused resolution, resolver, and arbiter stages automatically; reuse
     gap state after restart; prevent duplicate signal processing; keep ordinary
     Assignment behavior Mission-agnostic.
   - Distinguish objective/authority decisions from provider or controller
     infrastructure failures and compact resolved gap detail into terminal
     Mission outcomes.

3. **T-3 — Publish Mission graph 1.4.0 with legacy routing support**
   - Acceptance: AC-2, AC-3
   - Move semantic gap stages and terminal dispositions into Mission lifecycle
     graph 1.4.0.
   - Keep controller compatibility for active runs pinned to the legacy
     `replan` node without rewriting their graph package or `mission.yaml`.

4. **T-4 — Add focused regression coverage and delivery receipts**
   - Acceptance: AC-1, AC-2, AC-3
   - Cover independent child gaps, stable deduplication, descendant lineage,
     finite escalation, restart state, failure classification, queue authority,
     graph 1.4.0 routing, and legacy `replan` compatibility.
   - Run only the focused authorized checks after repository-required user
     confirmation, then record exact receipts and final acceptance evidence.
