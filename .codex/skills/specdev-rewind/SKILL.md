---
name: specdev-rewind
description: Fully re-read the specdev workflow and re-anchor from scratch
---

You have drifted from the specdev workflow. Stop what you're doing and:

1. Read `.specdev/_main.md` completely.
2. Read the typed `.specdev/.current` focus, if present.
3. Run `specdev next --json` for an Assignment, `specdev mission status`
   for a Mission, or `specdev discussion <id>` for a Discussion.
4. Treat the durable graph and folder artifacts as authoritative.

Announce meaningful phases, plan changes, failed verification, and blockers
with "Specdev: <action>"; repeated read-only probes need no separate announcement.
