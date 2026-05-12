# Codebase Consistency Audit Implementation Plan

> **For agent:** Implement this plan task-by-task. The deliverables are markdown
> documents (inventories + a findings report), not executable code, so each
> task's "test" is a structural conformance check on the produced file, not a
> unit test.

**Goal:** Produce a findings-only holistic audit of the specdev-cli repo
covering legacy artifacts, contradictions, inconsistencies, duplication, and
drift across root docs, source, templates, tests, and `.specdev/` state.

**Architecture:** Two phases. Phase 1 spawns five parallel general-purpose
subagents (one per scope area), each writing a structured inventory file
under `context/`. Phase 2 is a single synthesis pass in the main session that
reads the five inventories together, detects cross-area contradictions, and
writes a single `findings.md` at the assignment root.

**Tech Stack:** Markdown. Tooling: SpecDev `Agent` tool, `Read`, `Bash`
(`rg`, `find`, `git log`), `Write`/`Edit`.

**Execution Mode:** inline

---

### Task 1: Parallel area inventories

**Mode:** full
**Skills:** test-driven-development
**Files:**
- Create: `.specdev/assignments/00023_familiarization_codebase-consistency-audit/context/inventory-root-docs.md`
- Create: `.specdev/assignments/00023_familiarization_codebase-consistency-audit/context/inventory-source.md`
- Create: `.specdev/assignments/00023_familiarization_codebase-consistency-audit/context/inventory-templates.md`
- Create: `.specdev/assignments/00023_familiarization_codebase-consistency-audit/context/inventory-tests.md`
- Create: `.specdev/assignments/00023_familiarization_codebase-consistency-audit/context/inventory-specdev-state.md`

**Step 1: Write the failing structural check**

Before spawning agents, write the schema conformance check that all five
inventories must pass. The check is a shell snippet that grep-validates each
inventory file for the four required H2 sections from the design schema.

Save as `.specdev/assignments/00023_familiarization_codebase-consistency-audit/context/check-inventory-schema.sh`:

```bash
#!/usr/bin/env bash
# Verify every inventory file conforms to the design schema.
set -e
DIR="$(dirname "$0")"
required_sections=("## Files" "## Claims & instructions" "## References" "## Within-area findings")
fail=0
for f in "$DIR"/inventory-*.md; do
  [ -f "$f" ] || { echo "MISSING: $f"; fail=1; continue; }
  for s in "${required_sections[@]}"; do
    if ! grep -Fq "$s" "$f"; then
      echo "FAIL: $f missing section: $s"
      fail=1
    fi
  done
done
[ $fail -eq 0 ] && echo "ALL INVENTORIES CONFORM"
exit $fail
```

Note: scope area 2 (Source code) is a code area, so the schema allows it to
omit "## Claims & instructions". The check tolerates this only for
`inventory-source.md`: edit the loop to skip that section for that file. See
final form below:

```bash
#!/usr/bin/env bash
set -e
DIR="$(dirname "$0")"
fail=0
for f in "$DIR"/inventory-*.md; do
  [ -f "$f" ] || { echo "MISSING: $f"; fail=1; continue; }
  required=("## Files" "## References" "## Within-area findings")
  case "$(basename "$f")" in
    inventory-source.md) ;;
    *) required+=("## Claims & instructions") ;;
  esac
  for s in "${required[@]}"; do
    grep -Fq "$s" "$f" || { echo "FAIL: $f missing section: $s"; fail=1; }
  done
done
[ $fail -eq 0 ] && echo "ALL INVENTORIES CONFORM"
exit $fail
```

**Step 2: Run the check — verify it fails (RED)**

Run: `bash .specdev/assignments/00023_familiarization_codebase-consistency-audit/context/check-inventory-schema.sh`
Expected: FAIL — output starts with `MISSING:` for all five inventory paths,
exit code 1.

**Step 3: Spawn the five inventory subagents in parallel**

Use a single message containing five `Agent` calls (`subagent_type:
general-purpose`), one per area. Each agent receives:

- The list of files/dirs in its scope (from `brainstorm/design.md` section
  "Scope").
- The inventory schema from `brainstorm/design.md` ("Inventory schema"
  fenced block).
- The output path for its inventory file.
- The audit threshold ("flag anything not actively referenced, even if
  harmless").
- Findings-only reminder.
- Explicit instruction to read in-scope files in FULL, not in excerpts.
- For `inventory-source.md`: schema allows skipping "## Claims &
  instructions".

Agent area assignments (paths anchored at repo root
`/mnt/h/oceanwave/lib/specdev-cli`):

- **inventory-root-docs**: `README.md`, `CLAUDE.md`, `AGENTS.md`,
  `QUICKSTART.md`, `SETUP.md`, `GITHUB_SETUP.md`, `CHANGELOG.md`,
  `setup-github.sh`, `specdev.assignment-schema.json`, `learnings/**`,
  `docs/**`.
- **inventory-source**: `bin/**`, `src/commands/**`, `src/utils/**`,
  `scripts/**`, `hooks/**`.
- **inventory-templates**: `templates/.specdev/**`, `.specdev/_guides/**`,
  `.specdev/_templates/**`, `.specdev/_main.md`, `.specdev/_index.md`.
- **inventory-tests**: `tests/*.js`, `tests/helpers.js`,
  `tests/test-*-output/**`, `tests/tmp-*/**`, `scripts/verify-*.{sh,js}`.
- **inventory-specdev-state**: `.specdev/knowledge/**`,
  `.specdev/project_notes/**`, `.specdev/project_scaffolding/**`,
  `.specdev/discussions/**`, `.specdev/assignments/*/status.json`,
  completed-assignment artifacts (other phase folders).

**Step 4: Run the check — verify it passes (GREEN)**

Run: `bash .specdev/assignments/00023_familiarization_codebase-consistency-audit/context/check-inventory-schema.sh`
Expected: PASS — `ALL INVENTORIES CONFORM`, exit code 0.

If any inventory fails the schema check, send the failing agent a follow-up
via `SendMessage` with the exact missing section name; do not respawn from
scratch.

**Step 5: Commit**

```
git add .specdev/assignments/00023_familiarization_codebase-consistency-audit/context/
git commit -m "$(cat <<'EOF'
feat: capture per-area inventories for 00023 audit

Five general-purpose subagents produced structured inventory files
(root docs, source, templates, tests, .specdev state) feeding the
synthesis phase of the codebase consistency audit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Cross-area synthesis and findings report

**Mode:** full
**Skills:** test-driven-development
**Files:**
- Create: `.specdev/assignments/00023_familiarization_codebase-consistency-audit/findings.md`

**Step 1: Write the failing structural check for findings.md**

Save as `.specdev/assignments/00023_familiarization_codebase-consistency-audit/context/check-findings-schema.sh`:

```bash
#!/usr/bin/env bash
set -e
F=".specdev/assignments/00023_familiarization_codebase-consistency-audit/findings.md"
[ -f "$F" ] || { echo "MISSING: $F"; exit 1; }
fail=0
required=(
  "# Findings"
  "## Executive Summary"
  "## Root Docs and Misc"
  "## Source Code"
  "## Templates and Workflow Content"
  "## Tests"
  "## .specdev State"
)
for s in "${required[@]}"; do
  grep -Fq "$s" "$F" || { echo "FAIL: missing section: $s"; fail=1; }
done
# Each finding row must carry type + severity tags.
if ! grep -Eq '\b(legacy|contradiction|inconsistency|duplication|drift)\b' "$F"; then
  echo "FAIL: no finding type tags present"
  fail=1
fi
if ! grep -Eq '\b(high|med|low)\b' "$F"; then
  echo "FAIL: no severity tags present"
  fail=1
fi
[ $fail -eq 0 ] && echo "FINDINGS CONFORMS"
exit $fail
```

**Step 2: Run the check — verify it fails (RED)**

Run: `bash .specdev/assignments/00023_familiarization_codebase-consistency-audit/context/check-findings-schema.sh`
Expected: FAIL — `MISSING: .specdev/.../findings.md`, exit code 1.

**Step 3: Synthesize findings.md**

Main session reads all five `context/inventory-*.md` files together and
writes `findings.md` with this skeleton:

```markdown
# Findings: Codebase Consistency Audit (00023)

## Executive Summary

- Counts by severity: high=N, med=N, low=N
- Counts by type: legacy=N, contradiction=N, inconsistency=N, duplication=N, drift=N
- Top 5 highest-impact items (path + one-line note + recommended action)

## Root Docs and Misc

| Path | Type | Severity | Note | Suggested action |

## Source Code

| Path | Type | Severity | Note | Suggested action |

## Templates and Workflow Content

| Path | Type | Severity | Note | Suggested action |

## Tests

| Path | Type | Severity | Note | Suggested action |

## .specdev State

| Path | Type | Severity | Note | Suggested action |

## Cross-Area Findings

| Paths involved | Type | Severity | Note | Suggested action |
```

Process:

1. Fold each inventory's "Within-area findings" rows into the matching area
   section of `findings.md`, preserving Type / Severity / Note / Suggested
   action.
2. Detect cross-area contradictions by diffing the "Claims & instructions"
   tables of any two inventories whose claims target the same artifact or
   command. Examples to look for:
   - `templates/.specdev/` ↔ installed `.specdev/` drift (diff matched paths
     under `_main.md`, `_index.md`, `_guides/`, `_templates/`).
   - Help text in `bin/specdev.js` ↔ command behavior described in root
     docs.
   - Knowledge or project_notes claims contradicted by current code paths
     listed in `inventory-source.md`.
   - Duplicated guidance between root docs (e.g., README vs CLAUDE vs
     AGENTS).
3. Each cross-area finding goes under `## Cross-Area Findings` with the
   paths involved and a single Suggested action.
4. Fill the Executive Summary by counting rows produced above and selecting
   the top 5 by severity-then-impact.

**Step 4: Run the check — verify it passes (GREEN)**

Run: `bash .specdev/assignments/00023_familiarization_codebase-consistency-audit/context/check-findings-schema.sh`
Expected: PASS — `FINDINGS CONFORMS`, exit code 0.

Then a manual spot-check: pick 3 random rows from `findings.md` and confirm
each cites a specific file path and a concrete suggested action (not "docs
could be clearer").

**Step 5: Commit**

```
git add .specdev/assignments/00023_familiarization_codebase-consistency-audit/findings.md .specdev/assignments/00023_familiarization_codebase-consistency-audit/context/check-findings-schema.sh
git commit -m "$(cat <<'EOF'
feat: synthesize 00023 audit findings

Cross-area synthesis of the five inventories into findings.md,
organized by scope area + a dedicated cross-area section, with
type and severity tags and a suggested action per row.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```
