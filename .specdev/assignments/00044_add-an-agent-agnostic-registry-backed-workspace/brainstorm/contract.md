# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Extend the existing deterministic `specdev update` command with a registered,
agent-agnostic completion workflow for semantically reconciling stale platform
adapter instructions. The live failure and broader context are recorded in
`.specdev/project_notes/thoughts/2026-08-04_oceanquant-oceandata-live-workflow-friction.md`:
the managed `.specdev` runtime updated successfully while higher-priority
`AGENTS.md` and `CLAUDE.md` continued to direct coding agents through removed
files and obsolete lifecycle rules.

## Scope and non-goals

- In scope: a versioned registry package for update completion; integration
  with the existing `specdev update` entry point; provider-neutral adapter
  inspection/reconciliation instructions; durable interruption and resumption;
  concurrent operation without displacing an active foreground workflow;
  human and JSON next-action output; and focused fixtures using mixed
  project-owned and stale SpecDev instructions.
- Non-goals: deterministic rewriting of arbitrary adapter prose; managed-block
  adoption; changing the deterministic `.specdev` update algorithm; layout or
  Assignment migration; cross-repository handoffs; updating arbitrary project
  documentation; or platform-specific Claude, Codex, Cursor, or skill-owned
  implementations.

## Expected behavior

`specdev update` continues to install managed runtime files and graph packages.
It then either completes when supported platform adapters need no semantic
work, or returns a durable agent-action-required state whose registered graph
instructs the current coding agent to reconcile only stale SpecDev guidance
against the newly installed runtime. The agent can resume the same update
operation after editing, validate the result, and receive a terminal receipt.

The update operation remains available while another Assignment or Mission is
focused. It neither steals nor suspends that workflow, and an interrupted
adapter reconciliation is discoverable and resumable by a later coding agent.

## Important decisions

- Model update completion as a registered callable graph rather than a
  foreground workflow or a provider-specific skill. Its node contracts describe
  required effects and evidence without naming coding-agent tools.
- Treat the explicit `specdev update` request as authority to reconcile stale
  SpecDev-specific adapter clauses. When their boundary from project-owned
  instructions is ambiguous, the graph must report the ambiguity instead of
  rewriting broadly.
- Use the post-update installed runtime and update guidance as the authority for
  reconciliation. Preserve the callable's pinned package until it terminates,
  even if the update installs a newer registry entry.
- Keep deterministic host checks responsible for observable invariants such as
  removed-path references and required current orientation; keep semantic
  preservation and edits with the coding agent.

## Constraints and invariants

- Existing project-owned adapter content outside the stale SpecDev guidance is
  preserved. No entire adapter may be replaced merely because it contains old
  SpecDev text.
- The callable may coexist with an active focused run and must not change its
  focus, checkpoint, lifecycle, or authority.
- `specdev update --dry-run` remains read-only and creates no callable state.
- Missing adapters continue to be backfilled by the deterministic updater;
  adapter reconciliation must not create provider Attempts or require a
  particular coding-agent platform.
- Human and JSON output identify whether runtime update completed, whether
  agent action remains, the durable operation identity, and the exact resume or
  validation command.

## Delegated and reserved authority

- Delegated: exact callable ID/version, node and receipt schemas, operation-ID
  format, semantic command/flag names, supported-adapter discovery, conservative
  drift signatures, diagnostic wording, and focused fixture organization.
- Reserved for the user: permission to rewrite ambiguous project-owned
  instructions, adopt managed blocks, broaden reconciliation beyond supported
  platform adapters, alter another active workflow, or perform unrelated
  migrations and repository changes.

## Risks and assumptions

- The graph is installed during the same update that first needs it, so command
  integration must install/register the package before starting the callable.
- Versioned package retention is assumed to keep an interrupted callable
  readable after later updates; fixtures must exercise that pinning boundary.
- Absence of known obsolete paths is necessary but not sufficient proof that
  arbitrary prose is semantically current, so ambiguous cases must remain an
  explicit agent judgment or blocker.

## Verification authority

- Focused verification: `npm run test:update-workflow` may be run only after the
  repository-required explicit user confirmation.
- Full suite and every other test command: prohibited unless separately approved
  by the user.

## Acceptance criteria

- AC-1: In a workspace with mixed project-owned instructions and stale SpecDev
  clauses, `specdev update` installs the current runtime and returns a pinned,
  provider-neutral callable action that guides bounded adapter reconciliation;
  resumption validates the current orientation, removal of known obsolete
  references, preservation evidence, and produces a terminal receipt.
- AC-2: The update callable starts, resumes, and completes while an unrelated
  Assignment or Mission remains focused without changing that run's focus or
  durable state; interruption and a later package update still resume through
  the originally pinned callable package without duplicating the deterministic
  update or losing adapter evidence.
- AC-3: Current or newly backfilled adapters require no semantic edit, ambiguous
  legacy boundaries fail safely with actionable diagnostics, `--dry-run`
  creates no state, and human/JSON responses consistently expose runtime,
  adapter, operation, and next-action status without relying on an installed
  coding-agent skill or provider.
