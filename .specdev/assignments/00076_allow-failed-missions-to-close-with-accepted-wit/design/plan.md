# Implementation plan

Implementation Guides: none
Review Guides: none

- T-1 (AC-1, AC-2): Extend existing closure eligibility to failed Missions with active, suspended, or completed-at-failed runtimes. Preserve terminal runtime bytes and original failure snapshots.
- T-2 (AC-1, AC-2, AC-3): Extend command-level closure fixtures for failed Mission confirmation, preservation, recovery, invalid states, and unrelated focus/work safeguards. Update template guidance and release date.
- T-3 (AC-1, AC-2, AC-3): Inspect simplification opportunities, run the three approved checks, record evidence, and complete independent review and delivery.

Context: src/commands/mission-close.js; src/commands/mission.js completeMissionFailure; templates/.specdev/workflows/mission-lifecycle/graph.json; Assignment 00073 outcome. Historical reduced-test-suite knowledge is stale relative to current package scripts; use the existing Mission command-level suites.
