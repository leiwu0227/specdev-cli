# SpecDev index

## Canonical state

```text
.specdev/
  agents.yaml                         committed worker/reviewer preferences
  executors.yaml                      reusable capability facts; secret names only
  guides/review.md                    common reviewer contract
  guides/library/catalog.yaml         managed curated guides
  guides/project/catalog.yaml         repository-owned guides
  adhoc/YYYY-MM/AH-<id>_<slug>.md     immutable bounded-change receipts
  assignments/<id>_<slug>/            bounded delivery records
  missions/M<id>_<slug>/              static-wave foreground orchestration
  discussions/D<id>_<slug>/           concurrent thought work
  test-audits/TA<id>_<slug>/           concurrent read-only test pruning proposals
  project_notes/roadmap/designs/
    core_concepts.md                   user-approved core architecture concepts
    source_code_folder_structure.md    user-approved source-code folder design
  project_notes/roadmap/forecast.md    user-approved implementation sequence
  knowledge/faq/                       current, freshness-aware troubleshooting
  knowledge-curations/KC-<hash>.json   verified publication receipts
  processes/ATT-<id>.yaml              durable invocation summaries
  cache/                               ignored machine-local state
  worktrees/slot-N/                    ignored, bounded Mission child leases
```

## Main commands

```bash
specdev adhoc start "<scope>"
specdev adhoc finish --outcome="<result>" --verification="<evidence>"
specdev adhoc status
specdev adhoc show AH-<id>

specdev assignment "<objective>"
specdev checkpoint brainstorm
specdev reviewloop brainstorm          # optional
specdev approve brainstorm
specdev implement

specdev roadmap

specdev discussion "<topic>"
specdev discussion D00001 [--complete]
specdev reviewloop discussion --discussion=D00001

specdev test-audit "<scope>"
specdev test-audit TA00001 [--complete]
specdev assignment --from-test-audit=TA00001

specdev mission create "<objective>"
specdev reviewloop mission --mission=M00001   # optional
specdev mission run|status|pause|checkpoint M00001
specdev mission approve-divergence|reject-divergence M00001 --child=00042 --identity=<sha256>
specdev mission handoff M00001 --successor-assignment

specdev knowledge rebuild
specdev knowledge search "<terms>" [--mode=precise|broad] [--include-stale] [--scope=history|workflow|all]
specdev knowledge curate [--repo-evidence=path#Lstart-Lend] [--status]
specdev knowledge distill
```

## Recovery

- `specdev adhoc status`: active machine-local marker and bounded diff summary.
- `specdev adhoc show <ID>`: derive the start/end commits from the immutable
  receipt and Git trailer rather than storing self-referential hashes.
- `specdev next --json`: focused Assignment/Mission position.
- `specdev discussion --list`: isolated callable positions.
- `specdev test-audit --list`: isolated test-audit callable positions.
- `specdev mission status M00001`: branch, queue counts, blocker, and the
  contract-bound review/execution policy.
- `specdev mission approve-divergence|reject-divergence`: decide only the exact
  reviewed child identity displayed by status; changed identities fail closed.
- `specdev mission run M00001 --takeover`: explicit recovery only after a
  durable running controller has no live local process.

Graph packages are immutable directories selected by `workflows/catalog.json`.
`specdev update` installs new versions but retains packages pinned by in-flight
checkpoints.

When assessing project workflow output or filesystem overhead, count Mission and
Assignment artifacts separately from installed workflows, skills, RippleGraph
checkpoints, and process records. The latter are runtime infrastructure, not
additional project deliverables.
