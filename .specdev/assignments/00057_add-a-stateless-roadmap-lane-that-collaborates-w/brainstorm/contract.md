# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Add Roadmap as a first-class, explicitly user-selected SpecDev lane for
collaboratively maintaining agreed future design and sequencing under
`.specdev/project_notes/roadmap/`. Roadmap is lighter than Discussion: it has no
RippleGraph callable, lane identity, lifecycle artifacts, receipt, or promotion
step.

## Scope and non-goals

- In scope: expose and document the Roadmap lane through the CLI and installed
  agent guidance; define and preserve the roadmap project-note layout; constrain
  Roadmap activity to user-approved Markdown changes under that layout.
- Non-goals: implementing forecast items, modifying product code while in the
  Roadmap lane, creating workflow/history artifacts, replacing Assignment or
  Mission planning, or rewriting existing project-owned roadmap content during
  init/update.

## Expected behavior

The user explicitly selects Roadmap before an agent invokes `specdev roadmap`.
The command reports the allowed layout and collaboration instructions without
creating state or changing files. The agent then reads the current roadmap,
collaborates on a proposed change, shows the exact intended roadmap edit, and
waits for explicit user agreement before writing. During that lane, product
code and every path outside `.specdev/project_notes/roadmap/` are read-only.

The project-owned layout is:

- `roadmap/designs/core_concepts.md`: user-agreed core architecture concepts.
- `roadmap/designs/source_code_folder_structure.md`: the user-agreed source-code
  folder design.
- `roadmap/forecast.md`: the user-agreed ordered sequence of likely next
  implementation work.

Roadmap is stateless in SpecDev. Repeated invocation derives context from the
current roadmap files and creates no Roadmap-specific record. Git remains the
repository's ordinary revision history.

## Important decisions

- Roadmap is invoked as `specdev roadmap`; it is a distinct work lane, not a
  Discussion subtype and not a new RippleGraph workflow.
- The lane's authority is documentation-only and path-bounded; it cannot grant
  implementation authority.
- Installed and updated projects receive the supported roadmap layout and agent
  instructions, while existing roadmap bytes remain project-owned and
  preserved.

## Constraints and invariants

- Roadmap may write only UTF-8 Markdown at
  `project_notes/roadmap/forecast.md`,
  `project_notes/roadmap/designs/core_concepts.md`, and
  `project_notes/roadmap/designs/source_code_folder_structure.md`.
- No Roadmap ID, status pointer, run, callable, receipt, cache record, automatic
  commit, or historical snapshot is created.
- No roadmap write occurs without explicit approval of the proposed content;
  merely invoking the lane does not authorize a write.
- Roadmap content is future intent and sequencing, not evidence that a design is
  implemented or that forecast order is an approved implementation contract.
- Verification uses the minimum focused regression coverage needed to prove the
  lane boundary and scaffold-preservation behavior. Prefer extending an
  existing maintained command-level test over adding a new per-module suite or
  an exhaustive scenario matrix.

## Delegated and reserved authority

- Delegated: inspect current roadmap files, ask questions, and draft exact
  candidate edits within the allowed roadmap layout.
- Reserved for the user: select the Roadmap lane, approve each exact roadmap
  change, decide design authority and forecast ordering, and separately approve
  any later implementation work.

## Risks and assumptions

- “No historical record” means no Roadmap-specific SpecDev history; normal Git
  history is not suppressed.
- User approval is enforced through installed agent protocol and observable
  exact-draft interaction because a stateless CLI cannot independently prove
  conversational consent.
- Existing `.specdev/project_notes/roadmap/designs/core-concept.md` does not
  match the agreed fixed layout. It remains project-owned input and is not
  implicitly approved, migrated, rewritten, or deleted by this Assignment.

## Verification authority

- Only the smallest relevant focused test command may be proposed; running it
  still requires the repository-mandated explicit user approval.
- Full suite: requires explicit user approval unless already authorized here

## Acceptance criteria

- AC-1: A user or agent can discover and invoke Roadmap as a distinct lane, and
  installed guidance requires explicit lane selection, exact-content approval,
  code read-only behavior, and writes restricted to the roadmap layout.
- AC-2: Fresh initialization provides `roadmap/forecast.md` plus the fixed
  `roadmap/designs/core_concepts.md` and
  `roadmap/designs/source_code_folder_structure.md` files, while update adds
  missing scaffold files and preserves existing roadmap content byte-for-byte.
- AC-3: The smallest focused regression coverage demonstrates that Roadmap
  invocation and use create no workflow/callable state, IDs, receipts, history
  artifacts, automatic commits, or changes outside
  `.specdev/project_notes/roadmap/`.
