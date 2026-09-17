# Assignment contract

Kind: change

## Objective and context

Stop temporary execution logs accumulating after Assignment, Discussion, and Mission completion. Extend existing terminal runtime compaction to remove owned disposable artifacts after preserving useful delivery or discussion records. Provide previewable cleanup for existing leftovers.

Context: `.specdev/project_notes/big_picture.md`; current retention behavior in `src/utils/artifact-retention.js`; recovery constraints recorded in `.specdev/assignments/00032_terminal-run-residual-artifact/outcome.md` and verified against current source.

## Scope and non-goals

- In scope: automatic cleanup at successful standalone Assignment, Discussion, and Mission completion; equivalent owned-cache cleanup at existing explicit abandonment boundaries; a `specdev cleanup` command for accumulated eligible leftovers; documentation of retention behavior.
- Non-goals: time-based retention, background scheduling, generic cache clearing, deleting useful work or Git history, changing review/approval policy, or updating this repository's installed workflow files.

## Expected behavior

- After preserving durable outcomes and activity/evidence summaries, successful completion removes owned stdout/stderr logs, scratch provider results, retired transient artifacts, process markers, and disposable runtime. Mission completion includes owned child execution artifacts. Repeating completion or cleanup is safe.
- Discussion completion preserves enough durable state for listing, inspection, and later Assignment/Mission promotion after its temporary runtime is removed.
- Active, interrupted, blocked, failed-but-recoverable, and shelved work retains diagnostic/recovery cache. Explicit abandonment may remove owned temporary data after preserving its terminal record. Existing terminal lifecycle semantics remain authoritative.
- `specdev cleanup` previews eligible paths, total reclaimable bytes, and skipped candidates with reasons without mutation. `specdev cleanup --apply` revalidates ownership and terminal eligibility before deleting; both support `--json`. Unknown or ambiguous ownership is reported and retained, including legacy logs whose Attempt records no longer exist unless durable evidence establishes their ownership.

## Important decisions

- Clean only artifacts proven to belong to an eligible terminal owner; never clear a shared cache directory wholesale.
- Preserve contracts, proposals/designs, outcomes, acceptance/review evidence, activity summaries, and completion/promotion metadata. Preserve shared caches such as knowledge indexes and local configuration.
- Cleanup must be repeatable after partial failure without losing the ownership information needed to finish safely. Filesystem failures must be reported and remain recoverable.

## Constraints and invariants

- Running Attempts, concurrent Discussions, unrelated workflows, active Mission children, and uncertain liveness/ownership must be protected. Cleanup must not follow symlinks or paths outside validated workflow/cache boundaries.
- Preserve existing terminal-owner, focused-run, and checkpoint-less recovery safeguards. Persist compact durable records before deleting their supporting runtime.
- Product changes belong in source, template source, tests, and documentation; do not run `specdev update`. Preserve unrelated existing workspace changes. Ensure `package.json` releaseDate is current before the delivery commit.

## Delegated and reserved authority

- Delegated after contract approval: implementation/design choices within this scope, focused regression additions, required independent implementation review, and normal Assignment delivery.
- Reserved for the user: exact contract approval; permission to execute tests; expanding scope; deleting legacy artifacts with unproven ownership. Implementing the cleanup command does not authorize applying it to this workspace's existing leftovers.

## Risks and assumptions

- Old cache files may have lost their ownership records; safe cleanup can leave these behind and must explain why.
- Discussion consumers currently rely on callable runtime; preserving completion and promotion behavior is required before removing that runtime.
- Completion ordering and concurrent execution can expose deletion races; revalidation and recoverable cleanup must protect live data.

## Verification authority

- Proposed focused commands: `node tests/test-vnext-foundations.js`, `node tests/test-engine-integration.js`, `node tests/test-mission-abandonment.js`, and `node tests/test-assignment-shelf.js`, with cleanup regressions added to the relevant existing suites.
- All test execution requires explicit user approval under AGENTS.md. No approval is inferred from writing this contract. Full-suite execution requires separate explicit approval.
- Read-only source inspection and `git diff --check` are authorized. Independent reviewers must honor the same test restriction.

## Acceptance criteria

- AC-1: Successful Assignment, Discussion, and Mission completion automatically removes their owned temporary logs/results/runtime, retaining durable evidence and activity summaries; Discussion listing, inspection, and promotion still work. Existing explicit abandonment boundaries also remove eligible owned cache after preserving their terminal record.
- AC-2: Preview and apply cleanup modes report eligible and skipped leftovers accurately; preview makes no changes, apply removes only revalidated eligible artifacts, and repeated or resumed cleanup converges safely after partial failure.
- AC-3: Cleanup preserves active/recoverable/shelved work, concurrent workflows, durable records, shared caches, uncertain legacy artifacts, and paths outside validated boundaries; running/uncertain Attempts and symlink/path-escape cases cannot cause unsafe deletion.
