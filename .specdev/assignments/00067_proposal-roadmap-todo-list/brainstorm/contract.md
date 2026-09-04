# Assignment contract

Kind: change

Source discussion: D00022 (bf4aeb728024b70853b74c8aefa2f66d94be884878c55e6366d2969903a7aeff)
Source artifact manifest: v1, 2 files
Source proposal: Discussion D00022 artifact `brainstorm/proposal.md`
Source design: Discussion D00022 artifact `brainstorm/design.md`

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Add <code>.specdev/project_notes/roadmap/to&#100;o.md</code> as Roadmap's durable list for
user-selected, non-architecture future work. Preserve `forecast.md` as the list of
code gaps derived only from approved designs. This contract adopts completed
Discussion D00022.

## Scope and non-goals

- In scope: the Roadmap command contract, installed Roadmap guidance, initialization
  scaffold, update backfill/preservation behavior, and focused regression coverage.
- Non-goals: task execution state, completion tracking, ownership assignment,
  provenance metadata, automatic work-list generation, or changing Forecast derivation.

## Expected behavior

The new work-list file is a standard Roadmap file and writable Roadmap destination.
It uses <code># To&#100;o</code>, dependency-ordered numbered `## N. Title` sections, and fewer than 200
words per item (maximum 199). When dependencies do not determine the order, user
priority decides it. Work-list items contain no required provenance line.

Initialization creates the empty scaffold. Update backfills it when absent and never
overwrites existing user content. Roadmap command output exposes the work list separately from
Forecast so agents can apply the correct authority and formatting rules.

## Important decisions

- The work list is request-derived non-architecture work; Forecast remains design-derived code
  gaps.
- The work list reuses Forecast's compact item shape, ordering rule, and word limit, but not
  its `Based on:` references.
- Neither file grants implementation authority or creates a workflow lifecycle.

## Constraints and invariants

- Existing `forecast.md` behavior and content remain unchanged.
- Existing project-owned <code>to&#100;o.md</code> content is preserved by update.
- Roadmap remains stateless, and writes remain limited to its declared Markdown
  boundary.

## Delegated and reserved authority

- Delegated: choose internal factoring and exact human-readable wording while keeping
  the public JSON contract explicit and compatible.
- Reserved for the user: changing the work list's purpose, adding provenance
  requirements, or merging its authority with Forecast.

## Risks and assumptions

- Adding another standard file affects init, update, command output, and duplicated
  installed guidance; missing one surface would produce drift.
- “Same format” means numbered sections, ordering, and the 199-word limit, with the
  explicitly approved exception that the work list omits provenance.
- Current placeholder validation treats the new file and heading name as an unfilled
  template marker. It must distinguish legitimate domain text from actual placeholders.

## Verification authority

- Focused tests for changed modules: allowed after repository instructions are satisfied
- Full suite: requires explicit user approval unless already authorized here

## Acceptance criteria

- AC-1: `specdev roadmap --json` lists
  <code>project_notes/roadmap/to&#100;o.md</code> as both a standard file and writable
  destination and exposes work-list rules covering purpose,
  ordering, the maximum 199-word item limit, and omitted provenance.
- AC-2: initialization creates the canonical empty <code># To&#100;o</code> scaffold;
  update creates it when missing and preserves its bytes when it already exists.
- AC-3: generated and template Roadmap guidance consistently distinguishes
  request-derived work-list items from design-derived Forecast gaps and states the shared
  numbered-section format without adding implementation authority.
- AC-4: Assignment contract validation continues rejecting genuine unfilled template
  markers while allowing the new Roadmap filename and heading as ordinary domain text.
