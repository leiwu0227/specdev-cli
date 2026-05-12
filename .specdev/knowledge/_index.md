# Knowledge Vault

This directory contains accumulated project knowledge, organized by topic.
Agents read this at the start of assignments for context and may add to it
at the end via optional phase-end knowledge capture (see
`skills/core/knowledge-capture/SKILL.md`).

## Branches

| Branch | Purpose |
|--------|---------|
| `codestyle/` | Naming conventions, error handling patterns, test structure |
| `architecture/` | Design patterns, dependencies, module boundaries |
| `domain/` | Business domain concepts and terminology |
| `workflow/` | What worked/didn't in past assignments for this project |

## Workflow Feedback

`workflow_feedback/` contains observations about the SpecDev workflow
itself (not project-specific). Notes follow the structured template at
`.specdev/_templates/workflow_feedback_note.md`: every entry carries
`Status` (open / mitigated / resolved), `Type`, `Severity`, `First seen`,
`Last seen`, and `Assignments observed`, plus `Observation / Impact /
Current Mitigation / Proposed Action` sections so the search index can
rank and filter.

## How This Grows

- Agents add new files (or update existing ones) during optional
  knowledge capture at the end of a phase.
- Periodically, agents consolidate and deduplicate during natural
  workflow pauses (`prune-and-replace` in `knowledge-capture/SKILL.md`).
- Keep entries concise and actionable — this is reference material, not
  a journal.
