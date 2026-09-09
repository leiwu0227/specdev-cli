# Proposal: Optional public-function note guidance

Roadmap may offer a short style suggestion when the user explicitly asks for a
separate public-function design note. It does not create or require a canonical
`public_functions.md`, scaffold a function inventory, or apply the suggestion
to ordinary design notes.

Suggested style:

- Show typed signatures for the functions the user selected.
- Keep function names, parameter names and order, defaults, and async form
  aligned with the implementation or approved target.
- Use CapCase (PascalCase) for classes and `snake_case` when naming instances
  or returned values in the note.
- Show the return type and briefly say what value is returned.
- When useful, mention important side effects or failures and define or link
  unfamiliar custom types.

The signature may use documentation-only type annotations when the source
language is untyped. If an approved target signature differs from current code,
`forecast.md` records that implementation gap.

This is guidance, not a required Markdown structure. The note still follows the
ordinary Roadmap word limit and source-target conventions.

Example:

`roadmapCommand(flags: RoadmapFlags = {}) -> Promise<RoadmapPayload>`

Returns `roadmap_payload: RoadmapPayload`, the stateless Roadmap contract.
