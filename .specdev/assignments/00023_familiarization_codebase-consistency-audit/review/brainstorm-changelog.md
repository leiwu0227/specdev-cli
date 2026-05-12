## Round 1

### [F1.1] Agent type mismatch — addressed

Changed `brainstorm/design.md` Phase 1 to launch `general-purpose` subagents
instead of `Explore`, and added a one-line rationale (Explore reads excerpts,
forbids cross-file consistency checks, and lacks Write). Also added an
explicit instruction to each agent's briefing to read in-scope files in full
rather than excerpts.

Diff (paraphrased): "Launch five `Explore` subagents in a single message" →
"Launch five `general-purpose` subagents in a single message. (`Explore` is
unsuitable: ...)". New bullet added under the agent briefing list.

### [F1.2] `.specdev/discussions/` missing from scope — addressed

Added `.specdev/discussions/` to scope area 5 in `brainstorm/design.md`. The
"Looking for" line now also calls out abandoned/duplicate discussions.

Diff (paraphrased): scope area 5 path list now includes
`.specdev/discussions/`; "Looking for" line extended to mention
abandoned/duplicate discussions.

## Round 2

### [F2.1] Overview still said "Explore subagents" — addressed

Updated the Overview paragraph in `brainstorm/design.md` from "parallel
per-area inventory by Explore subagents" to "parallel per-area inventory by
general-purpose subagents". Brings the Overview in line with the Phase 1
section that was fixed in Round 1.
