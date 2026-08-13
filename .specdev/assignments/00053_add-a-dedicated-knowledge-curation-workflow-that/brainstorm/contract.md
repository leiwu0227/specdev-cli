# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Add a dedicated `specdev knowledge curate` workflow that turns the existing read-only distillation brief into bounded, verified, user-approved living-knowledge updates and automatically rebuilds the derived search index after publication. The workflow may curate FAQ, architecture, codestyle, domain, workflow, and workflow-feedback notes, and may propose changes to authoritative project context under a stronger explicit approval boundary.

## Scope and non-goals

- In scope: source and stale-entry discovery; duplicate/owner detection; bounded drafts and supersessions; destination-specific verification and approval; exact publication; optional `project_notes/big_picture.md` proposals; automatic SQLite rebuilding; durable receipts; interruption recovery; status/resume/help/guidance; targeted living-knowledge retrieval reminders in Assignment, Mission, and Adhoc workflows; and migration or retirement of the obsolete installed knowledge-distillation graph surface.
- Non-goals: making `knowledge rebuild` semantically edit Markdown, automatically promoting every completed outcome, allowing model confidence to replace evidence, silently refreshing FAQ freshness dates, rewriting project context without explicit approval, indexing Adhoc receipts by default, or treating the disposable SQLite database as authoritative state.

## Expected behavior

`specdev knowledge curate` first performs a mutation-free scan of bounded completed Assignment/Mission outcomes, hash-valid completed Discussion designs, stale or superseded FAQs, existing living knowledge, and current project context. It classifies only reusable findings, searches for the existing owning note, and presents exact proposed creations, edits, supersessions, exclusions, source citations, verification requirements, and destination-specific approval gates. No proposal means no authoritative Markdown mutation.

After the user approves the exact unchanged proposal, SpecDev publishes only those Markdown changes, records their source and verification provenance, and automatically runs the same deterministic index rebuild exposed by `specdev knowledge rebuild`. Successful curation returns one coherent receipt covering proposal identity, approvals, changed paths, verification, publication, and index status. `knowledge rebuild` remains independently available for manual edits, recovery, diagnostics, and automation.

Normal work consumes curated knowledge through bounded search rather than directory-wide reading. Assignment contract and implementation planning search with objective terms; Mission planning searches once and supplies relevant note paths to children, which search again only for child-specific unknowns; Adhoc searches only when repository behavior, conventions, or recurring failures are unfamiliar. Unexpected failures trigger another symptom-focused search. Found relevant paths are carried into the durable plan or child context where one exists, while stale guidance requires explicit retrieval and revalidation.

## Important decisions

- Curation owns semantic Markdown changes; rebuild remains a mechanical authoritative-Markdown-to-disposable-index operation.
- The normal user workflow is one command lifecycle ending with an automatic rebuild, not curate followed by a routine manual rebuild.
- Authority varies by destination: FAQ freshness requires current verification evidence; architecture and other durable notes require attributable reviewed sources; big-picture changes are proposal-only until separately and explicitly approved because they influence future agent assumptions.
- Existing notes are updated or superseded when they own the topic; the workflow does not create parallel duplicate truth.
- Knowledge consumption is command-driven and proportional: always read `big_picture.md`, but search fresh active living knowledge by objective or symptom instead of loading every FAQ, architecture, or workflow note.

## Constraints and invariants

- Planning is read-only and content-addressed. Changed sources, existing destination notes, project context, Git boundary, verification evidence, or proposal bytes invalidate approval before publication.
- Every published claim cites durable `.specdev`-relative sources. Refreshing `verified_at` or `review_after` requires recorded current-repository or authoritative-documentation verification; stale guidance is not made fresh by rewriting dates alone.
- Publication touches only the approved manifest and preserves concurrent Assignment, Mission, Discussion, Test Audit, Adhoc, unrelated product, and unapproved knowledge paths. Dirty or ambiguous ownership fails closed with exact recovery guidance.
- Big-picture proposals are separated visibly from ordinary knowledge edits and require an explicit approval bound to the exact old and new content. Rejecting or omitting them does not prevent independently approved knowledge updates.
- The journaled workflow is idempotently recoverable across proposal, approval, Markdown publication, receipt, and rebuild boundaries. Retry never duplicates notes, citations, supersession records, approvals, or receipts.
- If authoritative Markdown publication succeeds but rebuilding the ignored SQLite cache fails, the Markdown remains published and the receipt reports `index: stale` with the exact `specdev knowledge rebuild` recovery command. It must not roll back truth because derived state failed.
- With no published Markdown changes, rebuild is skipped unless the index is missing or stale. Existing search/list/distill/rebuild behavior and default freshness filtering remain compatible.
- Retrieval reminders must not create workflow state, force irrelevant context into every worker, or let stale/superseded entries silently guide implementation. Mission children receive relevant parent-selected paths without treating them as new authority, and all workflow contracts and repository instructions still outrank knowledge notes.

## Delegated and reserved authority

- Delegated: select concise workflow nodes and artifact names, draft only evidence-supported wording, choose the narrow verification needed per proposal, and implement deterministic rebuild/recovery mechanics within the approved boundaries.
- Reserved for the user: approve exact Markdown publication; approve any big-picture change; accept an unverified freshness refresh, missing provenance, duplicate or conflicting knowledge, changed authority boundary, or unrelated-path adoption.

## Risks and assumptions

- One curation run can propose destinations with different authority; the workflow must not let approval of a low-risk FAQ edit implicitly approve project-context changes.
- Source outcomes are historical evidence rather than automatically current truth, so verification may legitimately reject or narrow a draft.
- A cache failure after publication creates a deliberate split state that must be reported and recoverable without making the authoritative Markdown transaction ambiguous.

## Verification authority

- Focused command-level, recovery, and installed-workflow tests may be proposed; every test command requires explicit user confirmation under repository instructions.
- Full suite: requires separate explicit user approval.

## Acceptance criteria

- AC-1: A curation run produces a bounded mutation-free, content-addressed proposal from eligible durable sources, stale knowledge, existing owners, and project context; it requires attributable verification, identifies duplicates/conflicts and excluded dirt, separates big-picture authority, and refuses stale or ambiguous confirmation without tracked mutation.
- AC-2: Confirming the exact proposal publishes only approved FAQ/architecture/codestyle/domain/workflow/workflow-feedback changes and separately approved big-picture changes, with valid metadata, citations, supersession semantics, current verification evidence where required, no duplicate owning note, preserved concurrent/unrelated paths, and one durable idempotent receipt.
- AC-3: After publication the workflow automatically rebuilds the derived knowledge index and reports a coherent searchable result. If rebuild fails, authoritative Markdown remains published, the receipt records a stale index and exact recovery command, retry converges without duplicate publication, and standalone `knowledge rebuild` remains deterministic and independently usable; no-change curation rebuilds only when the index was already missing or stale.
- AC-4: Installed Assignment, Mission, and Adhoc guidance performs proportional fresh-knowledge retrieval at the appropriate planning or uncertainty boundary, carries relevant note paths into durable plans or child context where available, repeats search for unexpected symptoms, preserves unconditional big-picture reading and authority precedence, and neither bulk-loads all notes nor silently uses stale/superseded guidance.
