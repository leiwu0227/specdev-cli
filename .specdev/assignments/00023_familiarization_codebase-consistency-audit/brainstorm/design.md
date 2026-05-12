# Design: Holistic Codebase Consistency Audit

## Overview

Holistic audit of the specdev-cli repo to surface legacy artifacts,
contradictions, inconsistencies, duplication, and drift. Findings-only —
cleanup is out of scope. Two phases: parallel per-area inventory by
general-purpose subagents, then a single synthesis pass in the main session
that writes `findings.md`.

Motivation: recent assignments reshaped large parts of the repo (00020
reduced the test suite; 00022 thinned workflow runtime guidance). Older
content (`learnings/`, `docs/plans/`, legacy `distill` helpers, multiple
overlapping root docs, and the `templates/.specdev/` ↔ installed `.specdev/`
relationship) has not been swept end-to-end. A holistic pass will surface what
is stale, contradicted, duplicated, or drifted before it confuses agents or
users.

Threshold: aggressive — flag anything not actively referenced, even if
currently harmless. User triages later.

## Scope

In scope — five inventory areas:

1. **Root docs + misc top-level dirs**
   `README.md`, `CLAUDE.md`, `AGENTS.md`, `QUICKSTART.md`, `SETUP.md`,
   `GITHUB_SETUP.md`, `CHANGELOG.md`, `learnings/`, `docs/`, `docs/plans/`,
   `setup-github.sh`, `specdev.assignment-schema.json`.
   Looking for: overlap/duplication between user-facing docs, stale
   instructions, dirs superseded by `.specdev/knowledge/` or
   `.specdev/assignments/`.

2. **Source code**
   `bin/`, `src/commands/`, `src/utils/`, `scripts/`, `hooks/`.
   Looking for: unused exports/functions, commands flagged "legacy" in help
   text (e.g. `distill`, `distill done`), dead branches, stale CLI flags,
   references to artifacts that no longer exist.

3. **Templates + workflow content**
   `templates/.specdev/` (source of truth shipped to users) and the installed
   `.specdev/_guides/`, `.specdev/_templates/`, `.specdev/_main.md`,
   `.specdev/_index.md`.
   Looking for: drift between `templates/.specdev/` and the installed
   `.specdev/` runtime in this repo (any divergence is a bug since
   `specdev update` should keep them aligned), internal contradictions across
   guides, references to removed phases/commands.

4. **Tests**
   `tests/*.js`, `tests/helpers.js`, `tests/test-*-output/` fixture dirs,
   `scripts/verify-*.{sh,js}`.
   Looking for: orphaned helpers, unused fixtures, tests covering narrow
   implementation details (against the 00020 reduced-suite policy), stale
   `tmp-*` debug dirs.

5. **`.specdev/` project state**
   `.specdev/knowledge/`, `.specdev/project_notes/`,
   `.specdev/project_scaffolding/`, `.specdev/discussions/`,
   `.specdev/assignments/*/status.json` and completed-assignment artifacts.
   Looking for: knowledge entries describing replaced behavior,
   `project_notes/` claims contradicted by current code, scaffolding that no
   longer matches the repo, abandoned/duplicate discussions.

Out of scope: `node_modules/`, `package-lock.json`, `.git/`, runtime
`.specdev/cache/`, and any fix/cleanup work.

## Approach

### Phase 1 — Parallel inventory

Launch five `general-purpose` subagents in a single message, one per scope
area. (`Explore` is unsuitable: it reads excerpts rather than whole files,
its own description forbids cross-file consistency checks, and it cannot
Write — both of which Phase 1 requires.) Each agent is briefed with:

- Its area's file list and any sub-areas to descend into.
- The inventory schema below.
- The audit threshold ("flag anything not actively referenced, even if
  harmless").
- A reminder that this is findings-only — do not propose or apply edits.
- An explicit instruction to read each in-scope file in full, not in
  excerpts, since the audit is a cross-file consistency check.

Each agent writes its output to:

- `context/inventory-root-docs.md`
- `context/inventory-source.md`
- `context/inventory-templates.md`
- `context/inventory-tests.md`
- `context/inventory-specdev-state.md`

### Inventory schema

Each inventory file follows this shape:

```markdown
# Inventory: <area>

## Files
| Path | Purpose (one line) | Last meaningfully touched (commit subject) |

## Claims & instructions
| Path | Claim/instruction (verbatim or paraphrased) | Where else this is asserted (if known) |
(Only for docs/guides/templates/knowledge — skip for pure code.)

## References
| Path | References these (paths/commands/skills it points to) | Referenced by (paths that mention it) |

## Within-area findings
| Path | Type (legacy/contradiction/inconsistency/duplication/drift) | Severity | Note | Suggested action |
```

### Phase 2 — Synthesis (main session)

Main session reads all five inventory files together and produces
`findings.md` at the assignment root:

- Cross-area contradictions become new findings (e.g., `README.md` says X,
  `templates/.specdev/_main.md` says Y).
- Drift between `templates/.specdev/` and the installed `.specdev/` runtime
  is computed by diffing matched paths.
- Within-area findings are folded in, grouped by area, with type tags +
  severity + suggested action.
- A short executive summary at the top: counts by severity, top 5
  highest-impact items.

## Success Criteria

Deliverables:

1. Five inventory files under `context/`, one per scope area, conforming to
   the schema.
2. A single `findings.md` at the assignment root with:
   - Executive summary: counts by severity, top 5 highest-impact items.
   - One section per scope area, each finding tagged with type
     (`legacy / contradiction / inconsistency / duplication / drift`),
     severity (`high / med / low`), and a one-line suggested action.

Done when:

- Every file listed in scope has been read and accounted for in exactly one
  inventory.
- Every cross-area contradiction the synthesis can detect is recorded
  (especially `templates/.specdev/` ↔ `.specdev/` drift, root-docs overlap,
  help-text vs implementation drift in `src/commands/`).
- Every finding has an action recommendation specific enough that a follow-up
  assignment could be opened from it.
- No fix or content change is made in this assignment.

Verification:

- `specdev status` shows the assignment progressed through brainstorm →
  breakdown → implementation, with `findings.md` present at the assignment
  root.
- Spot-check: pick 3 random findings and confirm each cites a specific file
  path and concrete recommendation.

Non-success:

- Generic findings ("docs could be clearer") without a specific path.
- Cross-area contradictions only mentioned in one inventory, never reconciled
  in `findings.md`.
- Cleanup edits sneaking into this assignment.

## Key Decisions

- **Findings-only output.** Cleanup is queued as follow-up assignments to
  keep this assignment scoped and reviewable in one pass.
- **Aggressive threshold.** Flag anything not actively referenced. User
  triages — easier to drop a flagged item than to retroactively notice an
  unflagged one.
- **Two-phase orchestration over linear or pure-parallel.** Parallel
  inventory keeps the main context lean; a single synthesis pass is needed to
  catch cross-area contradictions that per-area agents cannot see.
- **Structured inventory schema.** Apples-to-apples comparison across areas
  during synthesis. Without a shared shape, cross-area reasoning becomes ad
  hoc.
- **Per-area inventories live under `context/`.** They are working artifacts
  for synthesis, not the deliverable. The deliverable is `findings.md` at the
  assignment root.
