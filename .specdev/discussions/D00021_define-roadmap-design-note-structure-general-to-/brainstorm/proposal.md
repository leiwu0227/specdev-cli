# Proposal: Roadmap Design-Node Guidance

## Context

Roadmap design notes favor stable conceptual abstractions but previously gave no
explicit guidance about moving from broad intent to detail or ending with bounded
source ownership.

## Agreed Guidance

- Except for `source_code_folder_structure.md`, a design note begins with general
  descriptions and moves toward more specific detail.
- This is writing guidance, not a prescribed format. No headings, named sections,
  tables, templates, or other Markdown structure are required.
- Except for `core_concepts.md` and `source_code_folder_structure.md`, every design
  note ends by identifying each source file it targets and the maximum total line
  count permitted for the completed file.
- Non-standard design notes may include a small relevant folder tree and a
  pseudocode section when either helps clarify the design. Neither is required.
- These illustrations and ending constraints do not permit the rest of the note to
  reproduce implementation code, runtime history, verification history, or
  incidental source references.

## Implementation Surfaces

The product change aligns the Roadmap command payload, generated Roadmap skill,
managed workflow guide and summaries, and focused contract assertions. The
repository's user-visible release date is updated for the delivery commit.
