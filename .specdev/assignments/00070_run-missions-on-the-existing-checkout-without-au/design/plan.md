# Plan

**Implementation Guides:** []
**Review Guides:** []

## Context

The approved contract supersedes branch-based delivery from Assignments 00030
and 00064. Current source confirms automatic switching, parallel worktrees,
landing, and broad checkpoint staging. Preserve immutable historical packages
and the installed workflow; ship changes through source/templates only.

## Tasks

- T-1 (AC-1, AC-3): Add checkout/revision authority, local sequential execution,
  non-mutating compatibility responses, and history-rewrite-safe abandonment.
- T-2 (AC-2): Bind implementation ownership and use exact-path Mission commits.
- T-3 (AC-3, AC-4): Version the graph, guard legacy migration, and revise shipped
  workflow guidance and CLI help.
- T-4 (AC-1–AC-4): Update and run the ten approved focused regression commands,
  record evidence, run independent implementation review, and deliver.
