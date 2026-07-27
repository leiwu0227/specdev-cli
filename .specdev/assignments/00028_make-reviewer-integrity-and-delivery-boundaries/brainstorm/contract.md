# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Allow SpecDev's explicitly concurrent, code-read-only Discussion and Test Audit
callables to make their own artifacts without invalidating an unrelated review
or being swept into another work item's delivery. Preserve the integrity checks
that detect changes to product files and to the candidate actually under review.

## Scope and non-goals

- In scope: reviewer workspace-integrity scoping for Assignment, Mission, and
  Discussion reviews; concurrency-aware dirty boundaries and scoped staging for
  Adhoc and standalone Assignment delivery; focused regression coverage.
- Non-goals: changing review convergence, approval policy, scheduler
  concurrency, Mission worktree behavior, or Discussion/Test Audit lifecycle
  and commit ownership.

## Expected behavior

- Creating or updating an unrelated `.specdev/discussions/**` or
  `.specdev/test-audits/**` artifact while a reviewer runs does not discard the
  review.
- A product-tree mutation during review still invalidates the pass. A mutation
  to the active reviewed work item's protected inputs also invalidates it; for
  example, D00015 may change during a D00014 review, but D00014's proposal or
  design may not.
- Adhoc and standalone Assignment boundaries do not block on, adopt, stage, or
  commit unrelated concurrent callable artifacts. Those artifacts remain
  untouched for their owning session or a later deliberate commit.

## Important decisions

- Model integrity as a protected product tree plus explicit active-candidate
  inputs, rather than weakening the guard by ignoring all `.specdev/**`.
- Treat both Discussion and Test Audit roots consistently because both are
  declared concurrent, code-read-only callables.
- Replace broad delivery staging where necessary with ownership-scoped staging;
  ignored concurrent artifacts must not silently enter another work item's
  commit.

## Constraints and invariants

- Reviewer result files, Attempt records, caches, and other host-owned outputs
  remain allowed without masking reviewer changes to protected inputs.
- Path handling must cover tracked, untracked, deleted, and renamed files.
- Existing contract hashes, strict result envelopes, approval gates, Git
  trailers, and recovery behavior remain authoritative.
- No new locks, scheduler, background process, or automatic Discussion/Test
  Audit commit is introduced.

## Delegated and reserved authority

- Delegated: choose the smallest reusable integrity-snapshot and scoped-staging
  APIs, plus exact diagnostics and focused test organization.
- Reserved for the user: expanding which workflow roots may run concurrently,
  weakening product or active-candidate protection, or changing who owns commits
  for Discussion/Test Audit artifacts.

## Risks and assumptions

The main risk is making an exclusion too broad and allowing a reviewer or
concurrent writer to alter the active candidate undetected. The implementation
must therefore prove both sides of the boundary: unrelated callable activity is
ignored, while product and active-candidate mutations are still rejected.

## Verification authority

- Focused tests for changed modules: allowed after repository instructions are satisfied
- Full suite: requires explicit user approval unless already authorized here

## Acceptance criteria

- AC-1: Assignment/Mission reviews remain valid when only an unrelated
  Discussion or Test Audit artifact changes during the reviewer invocation.
- AC-2: Discussion review protects the selected Discussion while tolerating
  changes to a different Discussion, and every review still rejects product
  mutations.
- AC-3: Adhoc and standalone Assignment dirty/delivery handling leaves
  unrelated concurrent Discussion/Test Audit artifacts unstaged and uncommitted
  while delivering all owned changes and normal SpecDev evidence.
