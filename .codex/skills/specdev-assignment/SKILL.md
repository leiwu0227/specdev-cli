---
name: specdev-assignment
description: Create a new assignment and start the brainstorm phase
---

Run `specdev assignment "<user's description>"` to reserve an assignment ID.

Read the output to get the reserved ID, then:
1. Pick a type (feature | bugfix | refactor | familiarization) and a short hyphenated slug based on the description
2. Create the assignment folder: `.specdev/assignments/<ID>_<type>_<slug>/`
3. Create brainstorm/ and context/ subdirectories inside it
4. Read `.specdev/_guides/workflow.md` to determine which brainstorm skill to use
5. Follow the chosen skill exactly

Announce every subtask with "Specdev: <action>".
