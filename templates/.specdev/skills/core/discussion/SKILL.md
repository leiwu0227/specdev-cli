---
name: discussion
description: Start a parallel brainstorming discussion independent of assignments
type: core
phase: any
input: User topic or question to explore
output: discussions/<id>_<slug>/brainstorm/proposal.md + brainstorm/design.md
next: none (standalone)
---

# Discussion Skill

A discussion is a standalone brainstorming session — not tied to any assignment.
Use it to explore ideas, compare approaches, or think through a topic before committing to an assignment.

## Steps

1. Run `specdev discussion "<description>"` to reserve a discussion ID and folder
2. Read the output to get the reserved ID and folder path
3. Follow `.specdev/skills/core/brainstorming/SKILL.md` exactly, writing artifacts to the discussion's `brainstorm/` folder
4. After creating the discussion, add a row to `.specdev/project_notes/discussion_progress.md`

Announce every subtask with "Specdev: <action>".
