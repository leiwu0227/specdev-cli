---
name: discussion
description: Concurrent code-read-only exploration through a RippleGraph callable
type: core
phase: any
---

# Discussion

Run `specdev discussion "<topic>"`. Inspect code when useful but do not modify
product files. In the returned Discussion's `brainstorm/`, write the required
`proposal.md` and `design.md` plus any useful supporting regular files or nested
directories. Keep `design.md` as the concise conclusion and reference supporting
artifacts where relevant. Do not add symlinks, credentials, provider transcripts,
caches, dependency trees, build output, or unrelated operational files. Then run
`specdev discussion D00001`.

Review is optional: `specdev reviewloop discussion --discussion=D00001`.
Complete when the user is satisfied: `specdev discussion D00001 --complete`.
Promotion creates a fresh Assignment or Mission and revalidates assumptions.
