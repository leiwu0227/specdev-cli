---
name: specdev-discussion
description: Start or resume concurrent code-read-only exploration
---

Run `specdev discussion "<topic>"`. Treat product code as read-only and write
the required `brainstorm/proposal.md` and `brainstorm/design.md` in the
returned Discussion. You may add useful supporting regular files and nested
directories inside `brainstorm/`; keep `design.md` as the concise conclusion.
Do not add symlinks, credentials, provider transcripts, caches, dependency trees,
build output, or unrelated operational files. Resume with `specdev discussion
D00001`.

Optional review: `specdev reviewloop discussion --discussion=D00001`.
Complete only when the user is satisfied: `specdev discussion D00001
--complete`. Promotion creates fresh identity and a fresh contract.

Announce meaningful phases, plan changes, failed verification, and blockers
with "Specdev: <action>"; repeated read-only probes need no separate announcement.
