# Implementation plan

Implementation Guides: none
Review Guides: none

- T-1 (AC-1): Add exact failure publication with a durable prepared manifest, idempotent Git recovery, and preserved failed status on interruption.
- T-2 (AC-2): Preserve failed runtime during handoff, check durable cleanup ownership, and refuse predecessor deletion at Assignment delivery.
- T-3 (AC-3, AC-4): Distinguish foreground and runtime focus errors and supply one shared ownership digest convention to review handoffs.
- T-4 (AC-1, AC-2, AC-3, AC-4): Extend existing command-level coverage, run authorized focused checks with timed receipts, inspect simplification opportunities, and complete independent review and delivery.

Context: approved contract and the three Roadmap notes published in d6d14b6; Assignment 00047 outcome; current Mission handoff, failure, closure, retention and review paths. The handoff previously removed runtime before creating a successor; Assignment delivery subsequently staged the deletion.

Verification: the user's post-review approval covers the four contract commands plus node tests/test-mission-successor-adoption.js and node tests/test-vnext-foundations.js (selected cleanup suite). No full suite is authorized.

Preserve the pre-existing untracked thought note and completed Assignment 00076 runtime deletions outside this delivery. Record any implementation-stage publication exclusion needed to keep them local.
