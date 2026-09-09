# Proposal: Roadmap Todo List

## Problem

Roadmap currently has two durable outputs: architecture designs and `forecast.md`.
The forecast is intentionally limited to implementation gaps derived from approved
designs, so it cannot honestly hold operational, documentation, cleanup, release,
research, or other non-architecture work that the user wants to remember.

## Proposed behavior

Add `.specdev/project_notes/roadmap/todo.md` as a standard Roadmap file and writable
Roadmap destination. It records user-approved future work that is not an architecture
requirement and therefore does not belong in `forecast.md`.

Use the same presentation constraints as the forecast:

- `# Todo` as the document title.
- One numbered `## N. Title` section per item.
- Fewer than 200 words per item, with a maximum of 199.
- Items ordered by dependency, then by the user's preferred priority when no
  dependency determines order.

Unlike forecast items, todo items have no required provenance line. They do not use
`Based on:` design references or substitute request metadata merely to imitate the
forecast's architecture-specific authority.

## Boundary

`forecast.md` remains architecture-derived: designs are the target, and forecast
records code gaps. `todo.md` remains request-derived: the user decides what belongs
there. Neither file grants implementation authority, creates workflow state, or
serves as a completion log.

When a todo becomes an architecture decision, Roadmap collaboration first creates or
updates the appropriate design; any resulting code gap then belongs in the forecast.
When a forecast gap is no longer architecture-derived, it may move to todo only by
explicit user direction.

## Expected product changes

Initialization should seed an empty Todo scaffold. Update should backfill the file
when missing and preserve existing content. `specdev roadmap --json` should list it
as a standard writable file and expose separate todo rules. Installed Roadmap skill
and workflow guidance should explain the distinction, and command-level regression
coverage should verify creation, preservation, payload fields, and formatting rules.
