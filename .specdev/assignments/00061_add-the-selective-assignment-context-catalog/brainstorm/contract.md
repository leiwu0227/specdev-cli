# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Add one provider-neutral selective context catalog for Assignment execution, following `project_notes/roadmap/designs/workflow/lanes/assignment/assignment_selective_context_catalog.md` and `project_notes/roadmap/designs/foundations/coding_agent_role.md`. Foreground and spawned roles should receive the smallest useful ordered view of durable authority, current task state, relevant supporting sources, and only permitted role history without treating a generated projection or private session as workflow truth.

## Scope and non-goals

- In scope: a normalized context-entry model and bounded selection policy; authority, task, supporting, and role-history groups; standalone foreground and spawned implementation/repair handoffs; primary reviewer, resolver, and arbiter projections; relevant project context, project guides, fresh living-knowledge results, and Roadmap design paths; parent-bounded Mission children; focused human/JSON/prompt and Attempt-record observability.
- Non-goals: copying source contents into context packets; replacing guide catalogs or knowledge search; persisting private transcripts; reviewer-session continuation; network-policy changes; changing contract, evidence, filesystem, or Mission authority; automatically editing Roadmap designs or project knowledge.

## Expected behavior

- Build each projection from current durable artifacts at the point of use. Present binding authority first, current phase/role task state second, selected supporting paths third, and permitted same-lineage role history last. Required authority or task evidence that is missing, unreadable, stale, or contradictory blocks instead of being treated as optional context.
- Catalog entries identify repository-relative durable paths and their purpose without preloading or summarizing their contents. Supporting selection is bounded by the Assignment objective, active phase, role, and known uncertainty. Handoffs instruct the agent to read selected relevant sources and expand only when an unfamiliar convention, unexpected behavior, material repository change, or unresolved contradiction requires it.
- Foreground action-required payloads and spawned prompts expose equivalent provider-neutral selections. Spawned Attempt records retain the selected entry identities for inspection without making operational records authoritative.
- First independent reviewers receive the contract, exact candidate, evidence, and review-relevant supporting paths, but no worker private reasoning or author-role history. Later primary rounds may receive durable prior findings as permitted reviewer history; resolvers and arbiters receive only the task evidence needed for their fresh roles.
- A Mission child receives its child authority/task context plus only the parent-selected supporting envelope relevant to that delegated child. Child-specific expansion may resolve uncertainty but cannot broaden the parent contract, delegated objective, or permitted context authority.

## Important decisions

- The catalog is a replaceable projection, not a new artifact of approval or a substitute for reading the owning source. Regenerate it on resume or retry rather than trusting cached selection.
- Keep existing guide IDs/version resolution and knowledge-search freshness rules as independent systems; the context catalog composes their relevant durable path references.
- Use positive, typed inclusion rules by role and phase. Do not rely on a single exclusion list that can silently expose new artifact families or author history to reviewers.
- Missing optional supporting context degrades to direct bounded discovery. Missing binding authority or required task evidence fails closed.

## Constraints and invariants

- Approved contracts, parent delegation, candidate identity, verification evidence, and owning workflow state remain authoritative in their existing artifacts.
- Catalog selection never grants read, write, test, network, or lifecycle authority and never turns absence of context into permission.
- Repository instructions remain the highest local execution constraint. Living-knowledge search results remain historical leads requiring current-code validation.
- Standalone reviewer independence is preserved across primary, resolver, and arbiter roles. Mission-child selection is an intersection with parent delegation, never a union with repository-wide context.
- Pre-existing approved Roadmap and user-run update changes remain outside this Assignment's product-behavior scope and must not be reinterpreted or rewritten.

## Delegated and reserved authority

- Delegated: implement the bounded catalog and selectors, integrate equivalent foreground/spawned handoffs and Attempt observability, add Mission-child constraints, update minimal generated guidance, and add focused regressions.
- Reserved for the user: authorizing tests under repository policy; any full-suite run; changing approved scope or context authority; enabling reviewer sessions or networking; publishing or changing project knowledge or Roadmap designs.

## Risks and assumptions

- Filename and heading relevance is conservative and may omit useful optional context; agents must expand from durable sources when stated uncertainty triggers occur.
- Overinclusive supporting paths increase orientation cost, while underinclusive paths risk assumption. Binding authority is therefore mandatory, optional selection is bounded, and absence never grants permission.
- Historical projects may lack optional project guides, knowledge, or Roadmap designs; the catalog must remain useful without manufacturing replacements.

## Verification authority

- Focused tests for changed modules: allowed after repository instructions are satisfied
- Full suite: requires explicit user approval unless already authorized here

## Acceptance criteria

- AC-1: One provider-neutral selector emits bounded, repository-relative entries grouped and ordered as authority, task, supporting, and permitted role history for the current Assignment objective, phase, and role; required missing or invalid authority/task sources fail closed, optional-source absence degrades safely, and retry/resume rebuilds from current durable state.
- AC-2: Standalone foreground handoffs, spawned workers/repairs, primary reviewers, resolvers, and arbiters consume equivalent role-appropriate projections. Spawned Attempts record selected entry identities; first reviewers exclude author history/private reasoning, later primary rounds expose only durable prior findings, and fresh corrective/review roles receive no prohibited lineage.
- AC-3: Mission-owned Assignments receive only child authority/task context plus a child-relevant subset of the parent-selected supporting envelope. Focused evidence demonstrates that child selection and uncertainty expansion cannot enlarge parent authority, while standalone guide selection, knowledge freshness, candidate review, and recovery behavior remain compatible.
