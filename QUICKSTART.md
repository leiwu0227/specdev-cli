# Quick Start

This guide takes a repository from installation to its first completed SpecDev
Assignment. SpecDev is a Node.js CLI; do not install or run it with Python,
`pip`, or `pipx`.

## 1. Install and initialize

Node.js 22.13 or newer is required.

```bash
npm install -g github:leiwu0227/specdev-cli
cd your-project
specdev init
```

For a repository that already contains `.specdev/`, use:

```bash
specdev update
```

Initialization installs the portable workflow under `.specdev/`, host skills
for supported coding CLIs, and platform adapters such as `AGENTS.md` or
`CLAUDE.md`. Managed runtime files can be regenerated; project notes,
Assignments, Missions, Discussions, knowledge, and project guides are
preserved.

After initialization or update, coding agents should prefer the generated
`.specdev/cache/bin/specdev` wrapper. It prevents an older global executable
from driving a newer repository workflow. Commands below use `specdev` for
readability.

## 2. Record project context

In a new repository, ask the coding agent to run:

```bash
specdev start
```

This interactively fills `.specdev/project_notes/big_picture.md`. Check the
current workflow at any time with:

```bash
specdev next --json
specdev status --json
specdev continue
```

## 3. Deliver one Assignment

An Assignment is the default unit of code-changing work.

```bash
specdev assignment "add bounded retry handling"
```

The coding agent collaborates with you in
`brainstorm/contract.md`. Keep the contract specific to this change, normally
with one to three observable acceptance criteria.

```bash
specdev checkpoint brainstorm
specdev reviewloop brainstorm       # optional
specdev checkpoint brainstorm       # repeat if review changed the contract
specdev approve brainstorm          # explicit approval of the exact hash
specdev implement
```

`implement` automatically produces the plan, runs the configured worker,
collects acceptance evidence, and applies the frozen implementation-review
policy. The default policy is:

- Brainstorm review: optional
- Implementation review: required

Set policy when creating an Assignment with
`--brainstorm-review=required|optional` and
`--implementation-review=required|waived`. Approval freezes it. There is no
routine final user gate after an approved implementation.

The durable result is intentionally compact:

```text
.specdev/assignments/00001_add-bounded-retry-handling/
  brainstorm/contract.md
  design/plan.md
  implementation/progress.json
  review/                       # when review runs
  outcome.md
  status.json
```

If a worker blocks, rerunning `specdev implement` reuses preserved artifacts
instead of silently launching another worker. Use `--retry-worker` only when a
fresh worker Attempt is intentional.

## 4. Use a Mission for a larger objective

The user—not SpecDev—chooses when work is a Mission.

```bash
specdev mission create "repair routing and add its monitoring UI"
# collaborate on the Mission contract
specdev reviewloop mission --mission=M00001   # optional
specdev mission run M00001 --approve
```

Mission Design first tries one full-scope Assignment. It splits only for a
context limit, an information dependency, an intermediate decision, or a
meaningfully independent verification or rollback boundary.

If several justified children are independent, Design places them in the same
static wave. The foreground controller automatically leases up to three ignored
`.specdev/worktrees/slot-N` worktrees and integrates completed deliveries in
declared order. The user does not choose a concurrency count. A parallel setup
failure before launch falls back to sequential execution.

Useful Mission commands:

```bash
specdev mission status M00001
specdev mission pause M00001
specdev mission run M00001 --takeover
specdev mission checkpoint M00001
specdev mission checkpoint M00001 --push
```

Mission checkpoints and branches are portable through Git. Raw logs, SQLite,
PIDs, and worktree slots remain local and ignored. Restart recovery recognizes
live children, delivery commits, integration conflicts, and interrupted
two-phase integrations without treating unrelated staged files as its own.

## 5. Explore concurrently without touching code

A Discussion may run while an Assignment or Mission is active:

```bash
specdev discussion "explore a new routing policy"
specdev discussion D00001
specdev reviewloop discussion --discussion=D00001   # optional
specdev discussion D00001 --complete
specdev assignment --from-discussion=D00001
# or: specdev mission create --from-discussion=D00001
```

A Test Audit is also code-read-only. It proposes removals but never deletes
tests itself:

```bash
specdev test-audit "slow routing tests"
specdev test-audit TA00001
specdev test-audit TA00001 --complete
specdev assignment --from-test-audit=TA00001
```

## 6. Search and distill knowledge

Markdown under `.specdev/knowledge/` is authoritative. SQLite is only a local,
rebuildable FTS cache.

```bash
specdev knowledge rebuild
specdev knowledge search "routing retry timeout"
specdev knowledge search "old workaround" --include-stale
specdev knowledge distill
```

Keyword eligibility uses OR semantics by default, then ranks results by term
coverage and BM25. Distillation gives the current coding CLI a bounded list of
completed work and stale FAQs that may deserve curated knowledge updates.

## Compact command reference

| Command                                | Purpose                                          |
| -------------------------------------- | ------------------------------------------------ |
| `specdev init`                         | Initialize portable SpecDev state                |
| `specdev update`                       | Refresh managed runtime files and graph packages |
| `specdev start`                        | Fill or review project context                   |
| `specdev next --json`                  | Show the canonical focused-workflow action       |
| `specdev assignment "<objective>"`     | Create one bounded code change                   |
| `specdev checkpoint brainstorm`        | Validate the editable contract                   |
| `specdev approve brainstorm`           | Approve the exact contract hash                  |
| `specdev implement`                    | Run plan, implementation, evidence, and review   |
| `specdev discussion "<topic>"`         | Start concurrent code-read-only exploration      |
| `specdev test-audit "<scope>"`         | Prepare a safe test-pruning proposal             |
| `specdev mission create "<objective>"` | Create a user-chosen larger objective            |
| `specdev mission run M00001`           | Run or resume its foreground controller          |
| `specdev reviewloop <phase>`           | Run the configured bounded reviewer loop         |
| `specdev knowledge rebuild`            | Rebuild disposable SQLite search                 |
| `specdev knowledge search "<terms>"`   | OR-search authoritative Markdown                 |
| `specdev knowledge distill`            | Prepare an on-demand curation brief              |
| `specdev continue`                     | Diagnose durable state and the next action       |
| `specdev help`                         | Show the complete compact command list           |

## What is committed

Commit project-facing state such as Assignments, Missions, Discussions,
knowledge Markdown, and installed workflows or skills according to your
repository policy. Keep `.specdev/cache/`, `.specdev/worktrees/`,
`knowledge.sqlite`, local provider logs, and process markers ignored.

For the detailed behavior and recovery model, see [README.md](README.md).
