---
name: specdev-knowledge-curation
description: Propose, approve, publish, and reindex bounded living-knowledge updates
---

Run `specdev knowledge curate --json` for a mutation-free bounded scan. Inspect
only relevant eligible sources and owner candidates. Draft the exact JSON
manifest from `proposal_template` under ignored
`.specdev/cache/knowledge-curation/`; include durable citations, current
verification, owner search results, conflicts, and exclusions. Update or
supersede the owning note instead of creating parallel truth.

When direct code inspection establishes a reusable constraint absent from the
durable source, rerun the scan with bounded
`--repo-evidence=project/path#Lstart-Lend`. Keep the returned content-addressed
`repository_evidence` unchanged and reference it from each supported change.
Repository evidence verifies current code bytes and location; it never replaces
an eligible durable source, owner checks, current verification, or exact user
approval, and source code is never bulk-indexed.

Run `specdev knowledge curate --proposal=<path> --json` to validate and bind
the unchanged proposal. Show its exact paths and proposal ID. Only after user
approval run the displayed `--approve=<proposal-id>` command. A big-picture
proposal has a separate `--approve-big-picture=<id>` token and must never be
inferred from ordinary knowledge approval.

Resume with `specdev knowledge curate --status` or the unchanged approval
command. Publication and its receipt are idempotent. If the index is stale, use
the exact `specdev knowledge rebuild` recovery command and do not roll back
authoritative Markdown.

Announce meaningful phases, plan changes, failed verification, and blockers
with "Specdev: <action>"; repeated read-only probes need no separate announcement.
