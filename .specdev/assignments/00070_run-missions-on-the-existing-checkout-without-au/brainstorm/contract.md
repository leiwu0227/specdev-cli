# Assignment contract

Kind: change

## Objective and context

Run Missions in the user's existing checkout and remove SpecDev's automatic Git branch management and instructions prescribing it. The user owns branch selection; SpecDev continues to own approved work, evidence, checkpoints, and delivery.

Context: `.specdev/project_notes/big_picture.md`. Existing landing and abandonment invariants are documented in Assignments 00030 and 00064 outcomes and have been checked against current source. This contract supersedes their requirement for a separate Mission/base-branch relationship.

## Scope and non-goals

- In scope: Mission creation, approval, inline/spawned child execution, resume, owned staging and commits, local checkpoints, completion/status, abandonment, successor recovery, versioned graph contracts, generated skills, template guides, CLI help, and shipped documentation that currently prescribe Git branching, publication, or landing.
- Non-goals: removing Git commits or evidence/revision checks; rewriting historical artifacts; deleting existing user branches/worktrees; changing approval or reviewer policy; updating the installed `.specdev` workflow or publishing roadmap/knowledge changes.

## Expected behavior

- Creating, approving, running, resuming, and finishing a new Mission leaves the selected branch unchanged. SpecDev creates no Mission or child branch, switches no checkout, leases no Git worktree, and performs no branch merge, cherry-pick, landing, or branch deletion as part of that lifecycle.
- Both inline and spawned implementation execute children sequentially in the existing worktree. Inline/spawned selection and independent reviewers remain supported. Dependency ordering and meaningful child boundaries remain; waves no longer grant parallel implementation authority.
- Successful completion records the reviewed result and final verification at a local completion commit on the existing checkout. Status reports the actual revision and progress without a pending landing obligation. Mission operations never push or change upstream configuration. `mission checkpoint --push` rejects before staging, committing, or changing workflow state, exits 1, and reports `publishing_removed`: "Mission checkpoints are local; SpecDev no longer publishes them."
- Before implementation, require a clean product worktree or explicit user adoption of an exact path manifest. Unadopted dirty product paths block before product mutation. Every Mission checkpoint, child delivery, completion, and abandonment commit stages only its exact owned/adopted path manifest; it preserves unrelated working-tree bytes and pre-existing staged changes. Later unrelated edits are excluded; uncertain ownership or overlapping edits block before mutation. A broad `git add -A` is not an ownership decision.
- Remove branch-management prescriptions from shipped guides, generated skills, examples, help, and graph instructions. Retain `specdev mission land <id>` solely as a non-mutating compatibility response: exit 1, JSON `status: unsupported` and `reason: branch_management_removed`, with the message "SpecDev no longer performs Mission landing; Git state is unchanged." This applies to new and historical Missions. Normal completion/status never suggests landing or treats this response as delivery evidence.
- Historical completed Missions remain inspectable, including completed-but-unlanded records recoverable through existing Git history lookup. Report their recorded final revision, evidence, and retained Git identities factually; never claim their changes reached another checkout. Branch integration and publication are outside SpecDev; add no manual branch/merge instructions.
- Resume, checkpoint discovery used to advance work, and eligible failed-Mission handoff validate the recorded checkout identity and that HEAD contains the recorded starting revision and relevant Mission commits, using Mission identity/trailers and revisions rather than a generated branch-name convention. Mismatched, missing, or ambiguous execution authority blocks before mutation. Handoff remains limited to eligible failed Missions.
- Read-only status and inspection require neither checkout matching nor commit containment; report missing or unreachable revisions factually. Terminal abandonment is also exempt from commit containment for both new and historical Missions. It remains reasoned, explicitly confirmed, and gated on recorded checkout identity, current HEAD, liveness, ownership, and cleanliness. If amend, rebase, squash, or another history rewrite makes recorded revisions missing or unreachable, record that discrepancy and the observed current HEAD in the immutable abandonment record and bind them to its confirmation. Do not require restoration of old history to abandon. Abandonment may create its normal owned terminal-record commit, but must not rewrite history, switch checkouts, integrate children, modify product work, or claim delivery.
- Compatible historical sequential state may migrate at a validated quiescent boundary when the current checkout contains its recorded work. In-flight parallel state or work distributed across other checkouts remains blocked and preserved, with affected child identities, revisions, and artifact locations reported. Such a Mission stays inspectable and may use reasoned abandonment from its recorded checkout once existing liveness, ownership, and cleanliness guards pass, without integrating children. SpecDev performs no checkout switch; a fresh approved work item is required to continue work that cannot be migrated.
- Ship the changed Mission lifecycle as a new graph package version. Remove the required Mission-branch approval field and the parallel execution route from the new graph. Keep older pinned packages immutable; compatibility checks distinguish supported migration, required package update, and preserved incompatibility before advancing a run. Do not update this repository's installed workflow as part of this Assignment.

## Important decisions

- This contract proposes removal of all automatic branching, including parallel child branches; consequently both implementation modes become sequential. Detached-worktree parallelism is a viable alternative without named branches, but is excluded here because it retains worktree management, cross-checkout integration, and separate recovery identities. Exact contract approval explicitly confirms sequential execution and this exclusion.
- Record a real starting commit and the existing checkout identity for recovery. New Mission creation and mutating Mission lifecycle operations require an existing Git HEAD on an attached checkout. Reject unborn and detached checkouts factually before changing Git or workflow state; do not create an initial commit or branch automatically. A changed or ambiguous checkout blocks mutation rather than triggering a switch. Read-only historical inspection remains available, including for legacy records whose starting revision is `unborn`; such a sentinel never counts as commit-containment evidence. The abandonment exception above still permits closure on a valid current checkout without a reachable recorded starting revision.
- Checkpoints remain local; explicit publication is removed rather than redirected to the user's current branch. The compatibility responses above reject unsupported operations without changing Git, workflow, or remote state.
- Branch names may remain as factual provenance or compatibility metadata. Guidance directing users or agents to create, switch, merge, land, or delete branches is removed; ordinary references to programming branches are unrelated.

## Constraints and invariants

- Keep contract approval, independent review, final verification, owned delivery commits, terminal cleanup, and immutable abandonment semantics.
- Preserve dirty/unrelated work without modifying, staging, unstaging, or committing it; preserve existing branches/worktrees, concurrent Discussions, recorded evidence, and legacy state on incompatible resume. Never infer that a terminal Mission authorizes altering user-managed Git topology.
- Change source and template source, not installed workflow files. Preserve existing unrelated workspace changes and ensure package.json releaseDate is current before committing.

## Delegated and reserved authority

- Delegated after approval: design, implementation, targeted regression updates, independent implementation review, and normal Assignment delivery within this contract.
- Reserved for the user: exact contract and test approval; choosing another branching/concurrency scope; explicit adoption of pre-existing dirty product paths; destructive migration of existing Git work; running `specdev update` in this repository.

## Risks and assumptions

- Spawned Missions lose parallel implementation throughput in exchange for having no automatic branches or worktrees.
- Historical Missions may require a separately chosen recovery action when their work is spread across old branches/worktrees. Read-only inspection and guarded abandonment remain available; automatic conversion must not lose or silently combine that work. Removing landing/publishing intentionally ends SpecDev's automatic integration/publication service for historical Missions too.

## Verification authority

- Proposed focused commands, including necessary regression updates: `node tests/test-engine-integration.js`, `node tests/test-engine-graphpackages.js`, `node tests/test-vnext-foundations.js`, `node tests/test-mission-landing.js`, `node tests/test-mission-compatibility.js`, `node tests/test-mission-abandonment.js`, `node tests/test-mission-successor-adoption.js`, `node tests/test-mission-user-reapproval.js`, `node tests/test-mission-environment.js`, and `node tests/test-mission-gaps.js`.
- These commands require explicit approval under AGENTS.md; contract drafting grants no test authority. Full-suite execution or additional test commands require separate approval. Read-only inspection and `git diff --check` are authorized.

## Acceptance criteria

- AC-1: New inline and spawned Missions execute children sequentially, checkpoint, resume, and complete on the existing checkout without creating/switching/deleting branches, leasing worktrees, merging/cherry-picking, pushing, or changing upstream configuration. Unborn and detached checkouts reject new Mission creation or mutating lifecycle execution before Git/workflow mutation while allowing read-only inspection. `checkpoint --push` and `mission land` return the specified non-mutating rejection, including for historical Missions. Approval, independent review, final verification, and delivery evidence remain intact.
- AC-2: Unadopted dirty product paths block implementation without changing them; explicit adoption binds an exact manifest. All Mission commit boundaries include only owned/adopted paths and preserve unrelated staged and unstaged changes, including edits introduced after execution begins. Ambiguous/overlapping ownership blocks before mutation.
- AC-3: Resume and eligible failed-Mission handoff enforce checkout/revision/ancestry authority. After a user history rewrite, new and historical Missions with missing or unreachable recorded revisions remain inspectable and can reach immutable abandonment on their recorded checkout once current-HEAD, liveness, ownership, and cleanliness guards pass. Abandonment binds and records the ancestry discrepancy, preserves rewritten history and product work, creates only its owned terminal-record commit, and claims no delivery. Compatible legacy sequential records migrate without losing evidence; historical completed records remain inspectable; incompatible parallel or checkout states stay preserved with inspection/guarded-abandonment availability reported. Repeating or recovering an operation never switches checkouts or duplicates delivery. A new graph version and compatibility fixtures prove old pinned packages are not silently rewritten.
- AC-4: Shipped documentation, generated skills, help, and graph instructions consistently describe current-checkout sequential execution and local checkpoints, with no branch-creation, switching, merging, publication, or landing workflow prescriptions. Factual Git provenance, compatibility messages, and commit/checkpoint guidance remain accurate.
