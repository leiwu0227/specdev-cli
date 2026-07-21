# SpecDev index

## Canonical state

```text
.specdev/
  agents.yaml                         committed worker/reviewer preferences
  guides/review.md                    common reviewer contract
  guides/library/catalog.yaml         managed curated guides
  guides/project/catalog.yaml         repository-owned guides
  assignments/<id>_<slug>/            bounded delivery records
  missions/M<id>_<slug>/              static-wave foreground orchestration
  discussions/D<id>_<slug>/           concurrent thought work
  test-audits/TA<id>_<slug>/           concurrent read-only test pruning proposals
  knowledge/faq/                       current, freshness-aware troubleshooting
  processes/ATT-<id>.yaml              durable invocation summaries
  cache/                               ignored machine-local state
  worktrees/slot-N/                    ignored, bounded Mission child leases
```

## Main commands

```bash
specdev assignment "<objective>"
specdev checkpoint brainstorm
specdev reviewloop brainstorm          # optional
specdev approve brainstorm
specdev implement

specdev discussion "<topic>"
specdev discussion D00001 [--complete]
specdev reviewloop discussion --discussion=D00001

specdev test-audit "<scope>"
specdev test-audit TA00001 [--complete]
specdev assignment --from-test-audit=TA00001

specdev mission create "<objective>"
specdev reviewloop mission --mission=M00001   # optional
specdev mission run|status|pause|checkpoint M00001

specdev knowledge rebuild
specdev knowledge search "<terms>" [--include-stale] [--scope=history|workflow|all]
specdev knowledge distill
```

## Recovery

- `specdev next --json`: focused Assignment/Mission position.
- `specdev discussion --list`: isolated callable positions.
- `specdev test-audit --list`: isolated test-audit callable positions.
- `specdev mission status M00001`: branch, queue counts, and blocker.
- `specdev mission run M00001 --takeover`: explicit recovery only after a
  durable running controller has no live local process.

Graph packages are immutable directories selected by `workflows/catalog.json`.
`specdev update` installs new versions but retains packages pinned by in-flight
checkpoints.

When assessing project workflow output or filesystem overhead, count Mission and
Assignment artifacts separately from installed workflows, skills, RippleGraph
checkpoints, and process records. The latter are runtime infrastructure, not
additional project deliverables.
