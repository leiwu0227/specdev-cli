# Assignment contract

Kind: bugfix

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Make Assignment shelving scalable, clean, and recoverable without weakening its
dirty-worktree safety boundary. “Transactional” here means preflight before
mutation plus idempotent roll-forward after a Git commit, not an attempt to
roll back published commits.

## Scope and non-goals

- In scope: replace pasted exact-path JSON with a short path-set confirmation
  token; classify and retire legacy tracked `.specdev/cache/**`; automatically
  commit the terminal shelf record and owned runtime cleanup; make post-boundary
  interruption idempotently recoverable; add shelf-specific help and recovery
  output.
- Non-goals: reconcile preserved implementation artifacts with `specdev next`
  (a separate follow-up), infer which arbitrary product changes belong to an
  Assignment, restore shelved runs, manage Git stashes, redesign RippleGraph,
  or add interactive terminal prompts.

## Expected behavior

When an eligible Assignment has non-disposable dirty paths, the first shelf
attempt returns a bounded, classified summary and this exact-shaped recovery
command:

```text
specdev assignment shelf <id> --reason="<reason>" --snapshot-token=<token>
```

The token is a short SHA-256-derived value over the Assignment ID, current
`HEAD`, and sorted repository-relative dirty path set after disposable-cache
classification. It deliberately binds the same path-level authority as the
current JSON array, not file contents. The retry recomputes the token before
any mutation. A changed `HEAD` or added/removed/renamed path rejects the token
and prints a fresh summary and command; staged-versus-unstaged movement of the
same paths does not invalidate recovery.

Dirty tracked paths beneath `.specdev/cache/**` do not appear in the
user-authorized path set. Before the snapshot commit, SpecDev stages their
removal from Git tracking while preserving the ignored local files. Cache-only
dirt does not require snapshot authorization.

Shelving then follows one explicit roll-forward protocol:

1. For authorized dirty work, create a labelled snapshot-boundary commit with
   Assignment and commit-type trailers. For an otherwise clean worktree, use
   the pre-shelf `HEAD` as the boundary without an extra snapshot commit.
2. Write `shelf.md` and terminal status referencing that boundary, abandon and
   compact the owned run and Attempts, and stage only the resulting durable
   shelf changes, owned runtime deletions, and legacy cache untracking.
3. Create a terminal shelf commit with Assignment and commit-type trailers.
   Return both the boundary and terminal commit hashes and leave no shelf-owned
   changes in the worktree.

If the process stops after the snapshot commit, rerunning the same shelf command
finds that commit by its trailers and continues at step 2 rather than creating
another snapshot. If terminal metadata exists but its commit is missing, the
existing idempotent shelf path finishes cleanup and creates the terminal commit.
Preflight errors occur before new staging. Later Git errors retain recoverable
state and print the same exact rerun command; the command does not attempt a
destructive index rollback.

`specdev assignment shelf --help` documents the reason and token flags, the
clean/dirty commit sequence, cache treatment, live-Attempt protection, and the
idempotent recovery cases. Help remains mutation-free.

## Important decisions

- Use one path-set token flag, not both a manifest and a confirmation mode.
  This removes command-line bulk while preserving the existing authority
  granularity and time-of-check protection.
- Use trailer-based roll-forward recovery rather than a transaction file or
  automatic Git rollback. Git history is the authority after the first commit.
- The boundary stored in `shelf.md` is the pre-shelf `HEAD` for clean work or
  the labelled snapshot commit for dirty work. The terminal commit cannot be
  embedded in the artifact it commits; it is discoverable by trailer and is
  returned by the command.
- Only `.specdev/cache/**` is disposable in this Assignment. Other ignored or
  tracked paths are not silently generalized into the same policy.
- `next` reconciliation is intentionally split out so this change stays within
  the shelving/Git-delivery boundary.

## Constraints and invariants

- Existing unrelated product changes still require explicit path-set authority,
  revalidated immediately before the snapshot commit.
- No recovery path resets commits, unstages user changes, deletes working-tree
  content, or stages concurrent Discussion/Test Audit artifacts.
- Shelf success means durable lifecycle state, Git trailers, focus,
  RippleGraph runtime, and Attempt cleanup agree. In the absence of genuinely
  concurrent out-of-scope changes, `git status --short` is empty.
- Cache retirement preserves rebuildable local files while ensuring generated
  cache descendants do not remain tracked.
- Existing clean-worktree shelf, live-Attempt protection, successor creation,
  and Assignment delivery behavior remain compatible.

## Delegated and reserved authority

- Delegated: token encoding and length, commit trailer names, bounded summary and
  JSON payload shape, safe owned-path staging mechanics, recovery diagnostics,
  shelf-specific help layout, and focused regression fixtures.
- Reserved for the user: authorizing the displayed non-disposable path set,
  resolving genuinely unrelated dirty changes, contract approval, and test
  execution approval.

## Risks and assumptions

- The token does not detect content edits within an already-authorized path;
  this matches the current path-array authority. The retry snapshots that
  path's current content.
- A previously tracked file remains visible to Git after its parent becomes
  ignored, so cache migration must operate on the index rather than relying on
  `.gitignore`.
- Git hooks or external processes can still fail or introduce changes. The
  protocol promises precise, non-destructive roll-forward recovery rather than
  impossible cross-process atomicity.

## Verification authority

- Focused tests for changed modules: allowed after repository instructions are satisfied
- Full suite: requires explicit user approval unless already authorized here

## Acceptance criteria

- AC-1: A dirty shelf attempt returns a bounded summary and short path-set token
  command; the token accepts the unchanged path set, rejects changed `HEAD` or
  path membership before mutation, and never requires a pasted path array.
- AC-2: Clean, dirty, cache-only, and legacy tracked-cache cases preserve local
  cache content, create the specified boundary and terminal Git evidence,
  durably commit shelf metadata and owned cleanup, and finish without manual
  commits or shelf-owned worktree changes.
- AC-3: Focused command-level interruption cases prove trailer-based,
  idempotent roll-forward after the boundary and after terminal metadata, while
  shelf-specific help explains the exact protocol and performs no mutation.
