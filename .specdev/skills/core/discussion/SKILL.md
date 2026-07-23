---
name: discussion
description: Concurrent code-read-only exploration through a RippleGraph callable
type: core
phase: any
---

# Discussion

Run `specdev discussion "<topic>"`. Inspect code when useful but do not modify
product files. Write only the returned folder's `brainstorm/proposal.md` and
`brainstorm/design.md`, then run `specdev discussion D00001`.

Review is optional: `specdev reviewloop discussion --discussion=D00001`.
Complete when the user is satisfied: `specdev discussion D00001 --complete`.
Promotion creates a fresh Assignment or Mission and revalidates assumptions.
