---
name: specdev-adhoc
description: Make one bounded change without a RippleGraph workflow
---

Use Adhoc only when the user selects a concrete bounded repository change and
does not want an Assignment. Start with `specdev adhoc start "<scope>"`.

If the worktree is dirty, show the bounded summary and wait for the user to
inspect, separately checkpoint, or explicitly adopt every existing change with
`--adopt-dirty`. Make the change directly without a scheduler, worktree,
subagent, or SpecDev approval gate. Finish with `specdev adhoc finish
--outcome="..." --verification="..."`; the host writes one receipt and one
final commit. `specdev adhoc cancel` leaves source changes untouched.

Announce every subtask with "Specdev: <action>".
