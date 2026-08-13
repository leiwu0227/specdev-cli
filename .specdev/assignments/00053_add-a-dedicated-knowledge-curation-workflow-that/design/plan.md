# Implementation plan

## Guides

**Implementation Guides:** [api-security]

**Review Guides:** [api-security]

## Tasks

1. **T-1 — Define and validate the content-addressed curation model (AC-1, AC-2).** Extend the knowledge utilities with bounded source/owner discovery, proposal schema validation, durable-source hashing, destination and metadata rules, separate big-picture authority, Git-boundary checks, and stable proposal identities. Keep scans and drafts outside authoritative Markdown.
2. **T-2 — Implement the resumable publication lifecycle (AC-2, AC-3).** Add `specdev knowledge curate` scan, proposal, status/resume, approval, publication, receipt, automatic rebuild, no-change, stale-index, and recovery behavior. Journal each boundary atomically, publish only the approved manifest, preserve unrelated paths, and keep `knowledge rebuild` independently available.
3. **T-3 — Install proportional retrieval and curation guidance (AC-4).** Add command help and installed agent guidance for objective/symptom searches in Assignment, Mission, and Adhoc work; carry relevant paths into plans or child context where available; retain unconditional big-picture reading and explicit stale revalidation; document curation and retire obsolete distillation-as-editing guidance while preserving the read-only `distill` compatibility command.
4. **T-4 — Add focused acceptance coverage and delivery receipts (AC-1, AC-2, AC-3, AC-4).** Add command-level tests for stale confirmation, authority separation, exact/idempotent publication, rebuild failure recovery, no-change behavior, help, packaging, and retrieval guidance. After repository-authorized execution, record focused evidence and finish `progress.json` and `outcome.md`.

Tasks execute inline in this Attempt. No dependency changes, worktrees, commits, subagents, or per-Task reviews are planned.
