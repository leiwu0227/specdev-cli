# Transactional Assignment shelving plan

**Implementation Guides:** [api-security]
**Review Guides:** []

## Tasks

### T-1 — Replace path manifests with a bounded snapshot token

Acceptance: AC-1, AC-2

- Classify dirty paths into disposable `.specdev/cache/**` entries and user-authorized entries without mutating the index during preflight.
- Derive a short SHA-256 token from the Assignment ID, current `HEAD`, and sorted non-disposable path set; emit a bounded classified summary and exact rerun command.
- Recompute and validate the token immediately before staging, while allowing staged/unstaged movement of the same path set and rejecting changed `HEAD` or path membership.
- Retire tracked cache descendants from the index while preserving ignored local files, including the cache-only path with no snapshot authorization.

### T-2 — Make shelving a two-boundary, idempotent roll-forward transaction

Acceptance: AC-2, AC-3

- Create labelled snapshot-boundary commits only for authorized non-disposable dirt, with Assignment and commit-type trailers; reuse the pre-shelf `HEAD` for clean/cache-only shelving.
- Detect an existing boundary by exact trailers and continue after interruption without creating another snapshot.
- Write terminal shelf/status state, compact the owned run and Attempts, stage only shelf-owned durable/runtime/cache-retirement changes, and create the terminal shelf commit with trailers.
- Recover when terminal metadata exists but its terminal commit is missing, return both commit hashes, and leave unrelated concurrent callable artifacts unstaged.
- Keep Git failures non-destructive and print the exact rerun command needed for roll-forward recovery.

### T-3 — Document and verify the shelf protocol

Acceptance: AC-1, AC-2, AC-3

- Add mutation-free `specdev assignment shelf --help` output covering flags, commit sequence, cache handling, live-Attempt protection, and recovery cases.
- Extend the focused command-level fixture for clean, dirty, cache-only, legacy tracked-cache, token rejection, boundary recovery, terminal-metadata recovery, trailer evidence, and clean shelf-owned status.
- Run only approved focused formatting/static checks and focused shelf tests, recording exact revision-bound receipts.
