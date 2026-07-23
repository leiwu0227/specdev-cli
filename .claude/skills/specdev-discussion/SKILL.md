---
name: specdev-discussion
description: Start or resume concurrent code-read-only exploration
---

Run `specdev discussion "<topic>"`. Treat product code as read-only and write
only the returned Discussion's `brainstorm/proposal.md` and
`brainstorm/design.md`. Resume with `specdev discussion D00001`.

Optional review: `specdev reviewloop discussion --discussion=D00001`.
Complete only when the user is satisfied: `specdev discussion D00001
--complete`. Promotion creates fresh identity and a fresh contract.

Announce every subtask with "Specdev: <action>".
