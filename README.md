# SpecDev CLI

SpecDev helps you scope, approve, implement, and review work with a coding agent.
It stores approvals, evidence, and recovery state beside your code in `.specdev/`.
You can inspect or resume the work with another agent or on another machine.

Choose the lightest workflow that fits the job:

- **Direct** for questions, read-only inspection, and small non-behavioral
  documentation writes with no workflow state, receipt, or automatic commit.
- **Adhoc** for one explicitly selected bounded edit with a receipt and final
  commit.
- **Assignment** for a contracted change with approval, implementation, and review.
- **Mission** for a larger objective coordinated across multiple assignments.

## Temporary logs

Successful Assignments, Discussions, and Missions first preserve evidence and
activity summaries. They then remove their execution logs, scratch results, and
temporary runtime files. Explicit abandonment also removes owned temporary cache.
Active, interrupted, recoverable failed, and shelved work keeps diagnostic files.
Completed Discussions keep the metadata needed for listing and later promotion.

Preview existing leftovers with `specdev cleanup`; use `specdev cleanup --apply`
to revalidate and remove eligible files. Both support `--json` and report paths,
reclaimable bytes, and reasons for keeping files. Older logs with missing ownership
records are retained, as are shared caches, live/uncertain Attempts, and unsafe
paths. Filesystem failures are reported; rerun cleanup after resolving the cause.

## Install

Node.js 22.13 or newer is required.

```bash
npm install -g github:leiwu0227/specdev-cli
specdev init
```

Refresh an existing installation with:

```bash
specdev update
```

If stale SpecDev clauses remain in a platform adapter, the command returns a
durable operation and an exact `specdev update --operation=UPD00001` resume
command. Mutating update and resume calls first block on live or ambiguous
running Attempts and reconcile only provably stale local Attempts. The read-only
`specdev update --status` command lists interrupted operations; dry-run never
creates one.

## Examples

Tell your coding agent what you want in natural language. You do not need to
memorize commands. The agent discusses scope and approvals with you, then runs
the workflow commands. The examples below show those commands.

### Ask for a small documentation artifact

> Write an HTTP usage manual under project notes.

The agent announces once, reads only the destination instructions and facts the
manual needs, writes it, and checks it narrowly. This is Direct when it records
existing behavior: it creates no SpecDev state, receipt, or automatic commit.
A handoff note explicitly requested in another repository follows the same
Direct path while honoring that destination's instructions. Documentation that
changes product behavior or a public contract still needs a governed lane.

### Ask for a bounded edit

> Fix the confusing help text. Keep this as a small Adhoc change.

The agent runs:

```bash
specdev adhoc start "repair one help message"
# the agent makes the change
specdev adhoc finish \
  --outcome="Corrected the help text" \
  --verification="Inspected the CLI output"
```

Adhoc work skips the contract and review loop but still records one receipt and
one final Git commit.

### Ask for an approved change

> Keyword search is broken. Create an Assignment and work with me on the
> contract before implementing it.

The agent runs:

```bash
specdev assignment "repair keyword search"
# the agent collaborates with you on brainstorm/contract.md
specdev checkpoint brainstorm
specdev reviewloop brainstorm   # optional
# after you explicitly approve the contract
specdev approve brainstorm
specdev implement
```

An Assignment begins with an interactive brainstorm: you and the coding agent
shape a readable contract, an optional reviewer can challenge it, and you
approve the exact final version. From there, `specdev implement` freezes the
execution owner at the Git boundary. The default `auto` mode keeps standalone
Design and Implementation in the foreground coding session; rerunning the
command validates its delivery artifacts and starts an independent review.
Set `implementation.mode: spawned` in `.specdev/agents.yaml` (or use
`--spawned --execution-reason="..."` before the boundary) for unattended worker
execution. Immediately after Mission contract approval, the user explicitly
chooses inline or spawned implementation for the whole Mission. Inline keeps all
implementation and repair work in the current main coding session and executes
children sequentially; spawned retains automatic workers and eligible parallel
waves. All paths keep the same acceptance evidence, review, recovery, delivery
receipt, and final commit guarantees.

Agent profiles in `.specdev/agents.yaml` keep network authority separate from
filesystem authority. Networking defaults to false for reviewers. A Codex
reviewer may set `network: true`, which enables live search while retaining the
read-only sandbox; provider combinations that cannot enforce network-enabled
read-only access fail before launch. `network: false` means SpecDev grants no
network capability through the adapter, not that it makes claims about a
provider's internal connectivity.

The first standalone Assignment implementation review is always fresh. When a
Claude primary review requests ordinary repair, SpecDev may keep one ignored,
24-hour, single-use lease and resume that exact provider session for the
immediately following repair verification. The lease is discarded on any
Assignment, role, profile, permission, contract, working-directory, candidate,
findings, round, expiry, or provider mismatch; review then falls back once to a
fresh read-only Attempt. Claude must retain its provider-local session transcript
for this narrow resume operation, but SpecDev retains neither that transcript nor
its raw session ID as durable evidence. Codex, Cursor, Mission, resolver,
arbiter, and all other review paths remain fresh-only.

### Ask for a larger mission

> Use a Mission to repair search end to end. Keep it running through the
> approved work and preserve progress if the session is interrupted.

The agent runs:

```bash
specdev mission create "repair search end to end"
specdev mission run M00001
# after you explicitly approve the Mission contract
specdev mission run M00001 --approve
specdev mission status M00001
```

Missions support work that may continue across agent sessions. A Mission runs
children in sequence in the existing checkout. It advances a durable Assignment
queue and records local checkpoints. After approval, choose inline or spawned
implementation. Both modes keep the selected checkout and use independent
reviewers and final verification.

Before approval, Mission output includes one contract-bound execution policy:
worker and reviewer profiles, the exact verification executable and command,
required capabilities, services, platforms, and secret names, approved executor
classes, and every explicit bypass or escalation. Capability facts live in
`.specdev/executors.yaml`; secret values are never stored there or in receipts.

Verification receipts retain executor and candidate provenance. A confirmed
executor-only blockage may use one approved alternate while keeping the exact
command and candidate. Later passing evidence links to, rather than overwrites,
the blocked attempt. Successful child and wave boundaries create recoverable
checkpoints, and convergence refuses uncheckpointed product changes.

An explicitly planned `execution: evidence-only` child succeeds by recording
its exact authorized observation, even when that observation is negative. The
failed receipt remains visible while the queue records
`completed-with-follow-up` and returns control to Mission gap resolution.

An active Mission already blocked inside such a historical child can inspect a
reviewed standalone repair without mutation:

```bash
specdev mission adopt-successor M00001 --assignment=00042
```

Apply only the unchanged content-addressed plan by rerunning the printed command
with `--confirm=<snapshot>`. Adoption preserves the failed child, requires exact
candidate, command, policy, cleanup, review, and provenance identities, and
replays the passing receipt without rerunning verification.

If an evidence-only problem has already terminalized a Mission, keep that
history immutable and draft a fresh approval boundary with:

```bash
specdev mission handoff M00001 --successor-assignment
```

To abandon an unwanted Mission, run `specdev mission abandon M00001
--reason="objective withdrawn"`, inspect the plan, then rerun its exact
`--confirm=<plan-digest>` command. The command preserves partial work and checks
only that Mission's child worktrees; registered worktrees with another Mission's
canonical child branch remain untouched, even when dirty. Unknown ownership,
unregistered pool contents, and dirty children of the retiring Mission still
block abandonment.

To accept delivered work with incomplete verification, write a note that records
the limitations and the user's explicit acceptance, then run:

```bash
specdev mission close M00001 \
  --outcome=accepted-with-limitations \
  --evidence=acceptance.md
```

Inspect the plan with the user. After explicit acceptance, repeat the command
with `--confirm=<plan-digest>`. Closure records a distinct terminal outcome,
preserves failed checks and missing evidence, closes unfinished child execution,
and releases focus and ownership. It retains code, artifacts, and runtime history
and creates one exact local closure commit. It does not claim verification passed
or perform landing. A subsequent Adhoc can start; unrelated dirty work still
requires its normal ownership decision. Retry the same confirmed command after
an interruption. Closed Missions cannot resume.

If an interrupted controller has no local process marker, inspect it before
using `specdev mission pause M00001` to record the interruption. Pause refuses a
live local controller. Record the pause changes in a local commit before
retrying abandonment, which requires a clean worktree. Do not resume an unwanted
Mission just to clear its controller record.

### Mission verification ownership

Single-child Mission contracts declare which criteria the child must prove before
review, and which remain pending for the controller:

```markdown
## Verification ownership

- Child acceptance: AC-1, AC-2, AC-3, AC-4
- Mission acceptance: AC-5
```

List every parent criterion exactly once. Use `none` for an empty Mission list.
Keep mixed obligations in the parent; split criteria before approval when necessary.
The generated child inherits all behavior and scope, but only child-owned acceptance.
Older approved contracts without this section keep their original full-scope child
acceptance. Use the confirmed recovery below if that child reaches an evidence cycle.
The exact final integrated command remains a required controller gate. Child readiness
is not Mission success. Focused child receipts need explicit acceptance authority.

An existing approved full-scope child can recover a verification-order conflict
without changing either approved contract. Prepare an explicit JSON mapping:

```json
{
  "child_acceptance": ["AC-1", "AC-2", "AC-3", "AC-4"],
  "mission_acceptance": ["AC-5"],
  "evidence": [{ "index": 6, "acceptance": ["AC-1", "AC-2", "AC-3", "AC-4"] }]
}
```

Evidence indices are zero-based positions in the child's progress verification array.
Select only focused evidence whose command and scope prove the listed criteria.
The command validates passing status, revision, supersession, and current product
ownership. Confirmation authorizes those exact receipts on that exact candidate.
Original qualification receipts remain unchanged. Omit `evidence` to collect new
authoritative focused evidence instead. A saved amendment approval does not confirm
this new plan. Store the mapping under `.specdev/cache/` to keep it outside product ownership.

```bash
specdev mission verification-boundary M00001 --child=00084 --mapping=.specdev/cache/boundary.json
specdev mission verification-boundary M00001 --child=00084 --mapping=.specdev/cache/boundary.json --confirm=<preview-digest>
```

Inspect the preview's old approval, proposed mapping, selected receipts, candidate,
and retained review state before confirmation. Recovery requires the active child
at implementation review or repair and refuses live or ambiguous execution. Retry
an interrupted operation with the same mapping and digest. Original contracts,
receipts, and blocked review artifacts remain in history. Review starts fresh under
the confirmed boundary. At a repair node, provide the normal foreground repair result.
Then run `specdev mission run M00001`. Only passing final integrated evidence and
required review can complete the Mission. This command cannot change product scope
or serve as a general contract amendment.

## Learn more

See [QUICKSTART.md](QUICKSTART.md) for an end-to-end walkthrough, or run:

```bash
specdev help
```

## License

MIT
