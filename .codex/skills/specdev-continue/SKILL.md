---
name: specdev-continue
description: Resume SpecDev work from durable workflow and folder artifacts
---

Run `specdev next --json` for a focused workflow. For a Mission, run `specdev
mission status <id>` then `specdev mission run <id>`. For a Discussion, run
`specdev discussion <id>`. Ordinary interrupted source may be inspected,
continued, repaired, or rewritten; do not assume database-style recovery.

Before resuming an Assignment, inspect its lifecycle in `specdev status --json`.
A shelved Assignment is terminal and immutable: translate “resume” into
`specdev assignment --from-assignment=<shelved-id>`, which creates a fresh ID
and contract. Never reactivate the old graph or treat its approval or historical
verification as current. Abandoned work remains terminal and is not a shelf.

Announce every subtask with "Specdev: <action>".
